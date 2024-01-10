import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { UsersService } from 'src/users/users.service';
import { Connection, Repository } from 'typeorm';
import * as randtoken from 'rand-token';
import { CreateGroupDto } from 'src/dtos/create-group.dto';
import { JoinGroupDto } from 'src/dtos/join-group.dto';
import { Season } from 'src/database/entities/season.entity';
import { Team } from 'src/database/entities/team.entity';
import { CronService } from 'src/cron/cron.service';
import { Points } from 'src/database/entities/points.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { ChangeNameDto } from 'src/dtos/change-name.dto';

import { createHash } from 'crypto';
import { options } from 'src/main';
import { PointsService } from 'src/points/points.service';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);
  constructor(
    @InjectRepository(Group) private groupRepository: Repository<Group>,
    @InjectRepository(GroupMembers)
    private groupMembersRepository: Repository<GroupMembers>,
    private readonly usersService: UsersService,
    private readonly cronService: CronService,
    private readonly connection: Connection,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,
  ) {}

  async getGroups(user: { username: string }) {
    const db = await this.usersService.findOne(user.username);
    if (db) {
      let groups = await this.groupMembersRepository.find({
        where: { user: db },
      });
      groups = groups.map((e) => {
        delete e.user;
        delete e.group.owner.id;
        delete e.group.owner.password;

        return e;
      });

      const adaptedGroups = [] as any;

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i] as any;

        group.rank = await this.pointsService.getUserRankInGroup(
          group.group.id,
          user,
        );

        group.memberCount = await this.groupMembersRepository.count({
          where: {
            group: group.group,
          },
        });
        adaptedGroups.push(group);
      }

      return adaptedGroups;
    } else {
      throw new HttpException(
        'You are not allowed to do that!',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getSingleGroup(user: { username: string }, group_id: number) {
    const db = await this.usersService.findOne(user.username);
    if (db) {
      const dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        const members = await this.groupMembersRepository.find({
          where: { group: dbgroup },
        });
        const formattedMembers: string[] = [];
        members.forEach((element) => {
          formattedMembers.push(element.user.name);
        });

        const formattedGroup: any = dbgroup;
        formattedGroup.members = formattedMembers;

        if (dbgroup.owner.id != db.id) {
          delete formattedGroup.passphrase;
        }

        delete formattedGroup.owner.id;
        delete formattedGroup.owner.password;

        return formattedGroup;
      } else {
        throw new HttpException(
          'The requested group was not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      throw new HttpException(
        'You are not allowed to do that!',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async joinGroup(user: { username: string }, body: JoinGroupDto) {
    const group = await this.groupRepository.findOne({
      where: { passphrase: body.passphrase },
    });
    const dbuser = await this.usersService.findOne(user.username);
    if (group && dbuser) {
      const groupMember = await this.groupMembersRepository.findOne({
        where: { group: group, user: dbuser },
      });
      if (groupMember) {
        throw new HttpException(
          'You are already part of that group!',
          HttpStatus.FORBIDDEN,
        );
      } else {
        const newGroupMember = new GroupMembers();
        newGroupMember.group = group;
        newGroupMember.user = dbuser;
        this.groupMembersRepository.save(newGroupMember);

        return group.id;
      }
    } else {
      throw new HttpException(
        'The requested group was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async leaveGroup(user: { username: string }, group_id: number) {
    const db = await this.usersService.findOne(user.username);
    if (db) {
      const dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        if (dbgroup.owner.id == db.id) {
          this.logger.debug('Group owner requested leave; denied');
          return;
        }
        this.logger.debug(
          'User with id ' + db.id + ' is leaving group with id ' + dbgroup.id,
        );
        const toDeletePoints = await this.connection
          .getRepository(Points)
          .find({
            where: {
              user: db,
              group: dbgroup,
            },
          });
        this.logger.debug('Number of deleted points: ' + toDeletePoints.length);
        await this.connection.getRepository(Points).remove(toDeletePoints);

        const toDeleteGuesses = await this.connection
          .getRepository(Guess)
          .find({
            where: {
              user: db,
              group: dbgroup,
            },
          });
        this.logger.debug(
          'Number of deleted guesses: ' + toDeleteGuesses.length,
        );
        await this.connection.getRepository(Guess).remove(toDeleteGuesses);

        const toDeleteGroupMember = await this.connection
          .getRepository(GroupMembers)
          .find({
            where: {
              user: db,
              group: dbgroup,
            },
          });
        await this.connection
          .getRepository(GroupMembers)
          .remove(toDeleteGroupMember);
      } else {
        throw new HttpException(
          'The requested group was not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      throw new HttpException(
        'You are not allowed to do that!',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async deleteGroup(user: { username: string }, group_id: number) {
    const db = await this.usersService.findOne(user.username);
    if (db) {
      const dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        if (dbgroup.owner.id != db.id) {
          this.logger.debug('Non-owner group member requested delete; denied');
          return;
        }
        this.logger.debug('Group with id ' + dbgroup.id + ' will be deleted');
        const toDeletePoints = await this.connection
          .getRepository(Points)
          .find({
            where: {
              group: dbgroup,
            },
          });
        this.logger.debug('Number of deleted points: ' + toDeletePoints.length);
        await this.connection.getRepository(Points).remove(toDeletePoints);

        const toDeleteGuesses = await this.connection
          .getRepository(Guess)
          .find({
            where: {
              group: dbgroup,
            },
          });
        this.logger.debug(
          'Number of deleted guesses: ' + toDeleteGuesses.length,
        );
        await this.connection.getRepository(Guess).remove(toDeleteGuesses);

        const toDeleteGroupMember = await this.connection
          .getRepository(GroupMembers)
          .find({
            where: {
              group: dbgroup,
            },
          });
        await this.connection
          .getRepository(GroupMembers)
          .remove(toDeleteGroupMember);

        await this.connection.getRepository(Group).remove(dbgroup);
      } else {
        throw new HttpException(
          'The requested group was not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      throw new HttpException(
        'You are not allowed to do that!',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async renameGroup(
    user: { username: string },
    group_id: number,
    body: ChangeNameDto,
  ) {
    const db = await this.usersService.findOne(user.username);
    if (db) {
      const dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        if (dbgroup.owner.id != db.id) {
          this.logger.debug('Non-owner group member requested rename; denied');
          return;
        }
        this.logger.debug('Group with id ' + dbgroup.id + ' will be renamed');

        this.connection.getRepository(Group).update(dbgroup, {
          name: body.name,
        });
      } else {
        throw new HttpException(
          'The requested group was not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      throw new HttpException(
        'You are not allowed to do that!',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async createGroup(user: { username: string }, body: CreateGroupDto) {
    let created = false;
    let token = '';
    while (!created) {
      token = randtoken.generate(10);
      const db = await this.groupRepository.findOne({
        where: { passphrase: token },
      });

      if (db) {
        continue;
      } else {
        created = true;
      }
    }
    const season = await this.connection.getRepository(Season).findOne({
      where: { id: Number(body.seasonID) },
    });
    this.addTeamsForSeason(season);
    const group = new Group();
    group.season = season;
    group.name = body.groupName;
    group.passphrase = token;
    group.owner = await this.usersService.findOne(user.username);
    const dbgroup = await this.groupRepository.save(group);

    const groupMember = new GroupMembers();
    groupMember.group = group;
    groupMember.user = group.owner;
    this.groupMembersRepository.save(groupMember);

    this.cronService.syncGamesForNewGroup(season);

    return { id: dbgroup.id, passphrase: token };
  }

  async addTeamsForSeason(season: Season) {
    const teamRepository = this.connection.getRepository(Team);

    const x = options as any;

    x.params = {
      league: season.competition.competition_id,
      season: season.season_id,
    };

    const data = (
      await this.httpService
        .get('https://api-handball.p.rapidapi.com/teams', x)
        .toPromise()
    ).data.response;

    const new_teams: any[] = (
      await Promise.all(
        data.map(async (e: { id: any }) => {
          const db = await teamRepository.findOne({
            where: {
              competitor_id: e.id,
            },
          });
          if (!db) return e;
          return false;
        }),
      )
    ).filter(Boolean);

    new_teams.forEach((e) => {
      const team = new Team();
      team.competitor_id = e.id;
      team.name = e.name;
      team.abbreviation = e.name.slice(0, 3).toString().toUpperCase();
      const colors = this.generateColors(e.id + e.name);
      team.background_color = colors.background_color;
      team.text_color = colors.text_color;
      teamRepository.save(team);
    });
  }

  async userIsPartOfGroup(user_id: number, group_id: number) {
    const dbgroupMember = await this.groupMembersRepository.findOne({
      where: { group: { id: group_id }, user: { id: user_id } },
    });

    if (!dbgroupMember) {
      throw new HttpException(
        'You are not part of that group.',
        HttpStatus.FORBIDDEN,
      );
    } else return true;
  }

  private generateColors(id: string) {
    // generates hexadecimal hash, slices to 6 digits for color representation
    const slicedHash = createHash('sha256')
      .update(id)
      .digest('hex')
      .slice(0, 6);
    const background_color = '#' + slicedHash;

    // convert hex color to rgb color; further: https://stackoverflow.com/questions/1855884/determine-font-color-based-on-background-color and https://www.w3docs.com/snippets/javascript/how-to-convert-rgb-to-hex-and-vice-versa.html
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
      background_color,
    );
    const rgb = result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;

    // calculate if color is visually light or dark
    const is_light =
      1 - (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 < 0.5;

    const text_color = is_light ? '#000000' : '#FFFFFF';

    return {
      background_color: background_color,
      text_color: text_color,
    };
  }
}
