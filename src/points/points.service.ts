import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { User } from 'src/database/entities/user.entity';
import { GroupService } from 'src/group/group.service';
import { UsersService } from 'src/users/users.service';
import { Connection, Repository } from 'typeorm';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);
  constructor(
    @InjectRepository(Points)
    private pointRepository: Repository<Points>,

    @Inject(forwardRef(() => GroupService))
    private readonly groupService: GroupService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private connection: Connection,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
  ) { }

  async calculateGamePoints(game_id: number) {
    const game: Game = await this.connection.getRepository(Game).findOne({
      where: {
        id: game_id,
      },
    });
    if (game) {
      const guesses = await this.connection
        .getRepository(Guess)
        .find({ where: { game: game } });

      for (let i = 0; i < guesses.length; i++) {
        const userGuess = guesses[i];
        const [points, perfect] = this.calculatePoints(game, userGuess);

        const existingPoints = await this.connection
          .getRepository(Points)
          .findOne({
            where: { game: game, group: userGuess.group, user: userGuess.user },
          });

        if (existingPoints) {          
          await this.pointRepository.update(
            {
              game: game,
              group: userGuess.group,
              user: userGuess.user,
            },
            {
              points: points,
            },
          );
        } else {
          // if (perfect) {
          //   this.notifyPerfectGuess(game, userGuess);
          // }
          const point = new Points();
          point.game = game;
          point.group = userGuess.group;
          point.points = points;
          point.user = userGuess.user;
          await this.pointRepository.save(point);
        }
      }
    }
  }

  calculatePoints(game: Game, guess: Guess): [number, boolean] {
    let perfect = false;
    let points = 0;
    const guess_t1 = guess.score_team1;
    const guess_t2 = guess.score_team2;

    const guess_dif = guess_t1 - guess_t2;
    const guess_winner = guess_t1 > guess_t2 ? 1 : guess_t1 < guess_t2 ? 2 : 0;

    const actual_t1 = game.score_team1;
    const actual_t2 = game.score_team2;

    const actual_dif = actual_t1 - actual_t2;
    const actual_winner =
      actual_t1 > actual_t2 ? 1 : actual_t1 < actual_t2 ? 2 : 0;

    if (guess_t1 == actual_t1) points++;
    if (guess_t2 == actual_t2) points++;
    if (guess_winner == actual_winner) points++;
    if (guess_dif == actual_dif) points++;
    // Everything perfect
    if (points == 4) {
      points++;
      perfect = true;
    }

    // guess predicted draw correctly
    if (guess_winner == 0 && actual_winner == 0) {
      points++;
      // draw predicted perfectly
      if (guess_t1 == actual_t1 && guess_t2 == actual_t2) {
        points++;
        perfect = true;
      }
    }

    return [points, perfect];
  }

  async getPointsFormatted(groupID: number, user: { username: any }) {
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
    });
    await this.groupService.userIsPartOfGroup(dbuser.id, groupID);
    const groupMembers = await this.connection
      .getRepository(GroupMembers)
      .createQueryBuilder('gm')
      .innerJoinAndSelect('gm.user', 'u')
      .innerJoinAndSelect('gm.group', 'g')
      .innerJoinAndSelect('g.season', 's')
      .where('g.id = :gid', { gid: groupID })
      .getMany();

    const maxGameday = await this.connection
      .getRepository(Game)
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.season', 'season')
      .select('MAX(gameday) as max')
      .where('season.id = :sid', {
        sid: groupMembers[0].group.season.id,
      })
      .getRawOne();

    const title_list = ['Player', 'Total'];
    for (let i = 1; i <= maxGameday.max; i++) title_list.push('Gameday ' + i);

    const special = await this.connection.getRepository(Game).find({
      where: {
        season: {
          id: groupMembers[0].group.season.id,
        },
        gameday: -1,
      },
    });

    if (special.length > 0) {
      title_list.push('Playoffs');
    }

    const users_list = [];
    for (let i = 0; i < groupMembers.length; i++) {
      users_list.push(
        await this.assembleList(groupMembers[i].user, groupMembers[i].group),
      );
    }
    users_list.sort((a, b) => b[1] - a[1]);

    return [].concat([title_list], users_list);
  }

  async assembleList(user: User, group: Group) {
    const single_user_list = [];
    single_user_list.push(user.name);

    const total = await this.getTotalPointsByPlayer(user, group);
    single_user_list.push(total);
    const days = await this.getGameDayPointsByPlayer(user, group);
    days.forEach((e) => {
      single_user_list.push(e);
    });

    return single_user_list;
  }

  async getTotalPointsByPlayer(user: User, group: Group) {
    const points = await this.pointRepository.find({
      where: {
        user: user,
        group: group,
      },
    });
    let sum = 0;
    points.forEach((point) => {
      sum += point.points;
    });
    return sum;
  }

  async getGameDayPointsByPlayer(user: User, group: Group) {
    const x = await this.connection
      .getRepository(Game)
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.season', 'season')
      .select('MAX(gameday) as max')
      .where('season.id = :sid', { sid: group.season.id })
      .getRawOne();

    const points_by_gameday = [];
    for (let i = 1; i <= x.max; i++) {
      const gameday = await this.pointRepository
        .createQueryBuilder('points')
        .innerJoinAndSelect('points.game', 'g')
        .where('points.user.id = :uid ', { uid: user.id })
        .andWhere('points.group.id = :gid', { gid: group.id })
        .andWhere('g.gameday = :index', { index: i })
        .getMany();
      let sum = 0;
      gameday.forEach((point) => {
        sum += point.points;
      });
      points_by_gameday.push(sum);
    }
    const special = await this.connection.getRepository(Game).find({
      where: {
        season: {
          id: group.season.id,
        },
        gameday: -1,
      },
    });
    if (special.length > 0) {
      const gameday = await this.pointRepository
        .createQueryBuilder('points')
        .innerJoinAndSelect('points.game', 'g')
        .where('points.user.id = :uid ', { uid: user.id })
        .andWhere('points.group.id = :gid', { gid: group.id })
        .andWhere('g.gameday = :index', { index: -1 })
        .getMany();
      let sum = 0;
      gameday.forEach((point) => {
        sum += point.points;
      });
      points_by_gameday.push(sum);
    }
    return points_by_gameday;
  }

  async getUserRank(user: { username: string }) {
    const dbuser = await this.usersService.findOne(user.username);

    if (dbuser) {
      const ranking = await this.connection
        .getRepository(Points)
        .createQueryBuilder('points')
        .select([
          'user_id, SUM(points) total_points, RANK() OVER (ORDER BY total_points DESC) user_rank',
        ])
        .groupBy('user_id')
        .getRawMany();

      const groups = await this.connection.getRepository(GroupMembers).find({
        where: {
          user: dbuser,
        },
      });

      const userCount = (
        await this.connection.getRepository(User).findAndCount()
      )[1];

      const temp = ranking.filter((value) => {
        // { "user_id", "total_points", "user_rank" }
        if (value.user_id == dbuser.id) return value;
      })[0];

      if (temp && temp.total_points && temp.user_rank) {
        return {
          rank: temp.user_rank,
          points: temp.total_points,
          groups: groups?.length,
        };
      } else {
        return {
          rank: userCount,
          points: 0,
          groups: groups?.length,
        };
      }
    } else {
      throw new HttpException(
        'Something went wrong. Please logout and log back in.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getUserRankInGroup(groupID: number, user: { username: string }) {
    const dbuser = await this.usersService.findOne(user.username);

    if (dbuser) {
      const ranking = await this.connection
        .getRepository(Points)
        .createQueryBuilder('points')
        .select([
          'user_id, SUM(points) total_points, RANK() OVER (ORDER BY total_points DESC) user_rank',
        ])
        .where('group_id = :group_id', {
          group_id: groupID,
        })
        .groupBy('user_id')
        .getRawMany();

      const temp = ranking.filter((value) => {
        // { "user_id", "total_points", "user_rank" }
        if (value.user_id == dbuser.id) return value;
      })[0];

      if (temp) {
        return '#' + temp.user_rank;
      } else {
        return 'N/A';
      }
    }
  }

  async notifyPerfectGuess(game: Game, guess: Guess) {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }

    const group = guess.group
    const user = guess.user

    const message = {
      notification: {
        title: user.name + ' guessed perfectly!',
        body: game.team1.name + ' vs. ' + game.team2.name + ', ' + game.score_team1 + ' - ' + game.score_team2 + " (Group: " + group.name + ")",
      },
      android: {
        priority: 'high' as any,
        notification: {
          priority: 'max' as any,
          channelId: 'General',
        },
      },
      topic: 'group' + group.id,
    };

    admin
      .messaging()
      .send(message)
      .then(() => {
        // Response is a message ID string.
        this.logger.debug(
          'Successfully sent perfect guess message for ' +
          group.name +
          ' (id: ' +
          group.id +
          ') ' + message.notification.title + ' --- ' + message.notification.body,
        );
      })
      .catch((error) => {
        this.logger.error('Error sending message:', error);
      });
  }
}
