import {
  HttpException,
  HttpStatus,
  Injectable,
  HttpService,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
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
import { User } from 'src/database/entities/user.entity';
import { Points } from 'src/database/entities/points.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { ChangeNameDto } from 'src/dtos/change-name.dto';

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
  ) {}

  async getGroups(user: { email: string }) {
    const db = await this.usersService.findOne(user.email);
    if (db) {
      let groups = await this.groupMembersRepository.find({
        where: { user: db },
      });
      groups = groups.map((e) => {
        delete e.user;
        return e;
      });

      return groups;
    } else {
      throw new HttpException(
        'You are not allowed to do that!',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getSingleGroup(user: { email: string }, group_id: number) {
    const db = await this.usersService.findOne(user.email);
    if (db) {
      let dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        let members = await this.groupMembersRepository.find({
          where: { group: dbgroup },
        });
        let formattedMembers: string[] = [];
        members.forEach((element) => {
          formattedMembers.push(element.user.name);
        });

        let formattedGroup: any = dbgroup;
        formattedGroup.members = formattedMembers;

        if (dbgroup.owner.id != db.id) {
          delete formattedGroup.passphrase;
        }

        delete formattedGroup.owner.id;
        delete formattedGroup.owner.email;
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

  async joinGroup(user: { email: string }, body: JoinGroupDto) {
    const group = await this.groupRepository.findOne({
      where: { passphrase: body.passphrase },
    });
    const dbuser = await this.usersService.findOne(user.email);
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

  async leaveGroup(user: { email: string }, group_id: number) {
    const db = await this.usersService.findOne(user.email);
    if (db) {
      let dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        if (dbgroup.owner.id == db.id) {
          this.logger.debug("Group owner requested leave; denied")
          return;
        }
        this.logger.debug("User with id " + db.id + " is leaving group with id " + dbgroup.id)
        const toDeletePoints = await this.connection.getRepository(Points).find({
          where: {
            user: db,
            group: dbgroup
          }
        })
        this.logger.debug("Number of deleted points: " + toDeletePoints.length)
        await this.connection.getRepository(Points).remove(toDeletePoints)
        
        const toDeleteGuesses = await this.connection.getRepository(Guess).find({
          where: {
            user: db,
            group: dbgroup
          }
        })
        this.logger.debug("Number of deleted guesses: " + toDeleteGuesses.length)
        await this.connection.getRepository(Guess).remove(toDeleteGuesses)

        const toDeleteGroupMember = await this.connection.getRepository(GroupMembers).find({
          where: {
            user: db,
            group: dbgroup
          }
        })
        await this.connection.getRepository(GroupMembers).remove(toDeleteGroupMember)
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

  async deleteGroup(user: { email: string }, group_id: number) {
    const db = await this.usersService.findOne(user.email);
    if (db) {
      let dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        if (dbgroup.owner.id != db.id) {
          this.logger.debug("Non-owner group member requested delete; denied")
          return;
        }
        this.logger.debug("Group with id " + dbgroup.id + " will be deleted")
        const toDeletePoints = await this.connection.getRepository(Points).find({
          where: {
            group: dbgroup
          }
        })
        this.logger.debug("Number of deleted points: " + toDeletePoints.length)
        await this.connection.getRepository(Points).remove(toDeletePoints)
        
        const toDeleteGuesses = await this.connection.getRepository(Guess).find({
          where: {
            group: dbgroup
          }
        })
        this.logger.debug("Number of deleted guesses: " + toDeleteGuesses.length)
        await this.connection.getRepository(Guess).remove(toDeleteGuesses)

        const toDeleteGroupMember = await this.connection.getRepository(GroupMembers).find({
          where: {
            group: dbgroup
          }
        })
        await this.connection.getRepository(GroupMembers).remove(toDeleteGroupMember)

        await this.connection.getRepository(Group).remove(dbgroup)
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

  async renameGroup(user: { email: string }, group_id: number, body: ChangeNameDto) {
    const db = await this.usersService.findOne(user.email);
    if (db) {
      let dbgroup = await this.groupRepository.findOne({
        where: { id: group_id },
      });

      await this.userIsPartOfGroup(db.id, dbgroup.id);

      if (dbgroup) {
        if (dbgroup.owner.id != db.id) {
          this.logger.debug("Non-owner group member requested rename; denied")
          return;
        }
        this.logger.debug("Group with id " + dbgroup.id + " will be renamed")
        
        this.connection.getRepository(Group).update(dbgroup, {
          name: body.name
        })
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

  async createGroup(user: { email: string }, body: CreateGroupDto) {
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
      where: { season_id: body.seasonID },
    });
    this.addTeamsForSeason(season);
    const group = new Group();
    group.season = season;
    group.name = body.groupName;
    group.passphrase = token;
    group.owner = await this.usersService.findOne(user.email);
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

    const data = (
      await this.httpService
        .get(
          'http://api.sportradar.us/handball/trial/v2/en/seasons/' +
            season.season_id +
            '/competitors.json?api_key=' +
            process.env.API_KEY,
        )
        .toPromise()
    ).data;

    const new_teams: any[] = (
      await Promise.all(
        data.season_competitors.map(async (e: { id: any }) => {
          const db = await teamRepository.findOne({
            competitor_id: e.id,
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
}
