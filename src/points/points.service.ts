import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { User } from 'src/database/entities/user.entity';
import { GroupService } from 'src/group/group.service';
import { Connection, Repository } from 'typeorm';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(Points)
    private pointRepository: Repository<Points>,

    @Inject(forwardRef(() => GroupService))
    private readonly groupService: GroupService,
    private connection: Connection,
  ) {}

  async calculateGamePoints(game_id: number) {
    const game: Game = await this.connection.getRepository(Game).findOne({
      id: game_id,
    });
    if (game) {
      const guesses = await this.connection
        .getRepository(Guess)
        .find({ where: { game: game } });

      guesses.forEach(async (value) => {
        const points = this.calculatePoints(game, value);

        const existingPoints = await this.connection
          .getRepository(Points)
          .findOne({
            where: { game: game, group: value.group, user: value.user },
          });

        if (existingPoints) {
          return this.pointRepository.update(
            {
              game: game,
              group: value.group,
              user: value.user,
            },
            {
              points: points,
            },
          );
        } else {
          const point = new Points();
          point.game = game;
          point.group = value.group;
          point.points = points;
          point.user = value.user;
          return this.pointRepository.save(point);
        }
      });
    }
  }

  calculatePoints(game: Game, guess: Guess): number {
    let points = 0;
    const guess_t1 = guess.score_team1;
    const guess_t2 = guess.score_team2;
    const guess_sb = guess.special_bet;

    const guess_dif = guess_t1 - guess_t2;
    const guess_winner = guess_t1 > guess_t2 ? 1 : guess_t1 < guess_t2 ? 2 : 0;

    const actual_t1 = game.score_team1;
    const actual_t2 = game.score_team2;
    const actual_sb = game.special_bet_result;

    const actual_dif = actual_t1 - actual_t2;
    const actual_winner =
      actual_t1 > actual_t2 ? 1 : actual_t1 < actual_t2 ? 2 : 0;

    if (guess_t1 == actual_t1) points++;
    if (guess_t2 == actual_t2) points++;
    if (guess_winner == actual_winner) points++;
    if (guess_dif == actual_dif) points++;
    if (points == 4) points++;

    if (guess_sb == actual_sb) points++;

    return points;
  }

  async getPointsFormatted(groupID, user) {
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { email: user.email },
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
      .select('MAX(spieltag) as max')
      .where('season.season_id = :sid', {
        sid: groupMembers[0].group.season.season_id,
      })
      .getRawOne();

    const title_list = ['Player', 'Total'];
    for (let i = 1; i <= maxGameday.max; i++) title_list.push('Gameday ' + i);

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
      .select('MAX(spieltag) as max')
      .where('season.season_id = :sid', { sid: group.season.season_id })
      .getRawOne();

    const points_by_gameday = [];
    for (let i = 1; i <= x.max; i++) {
      const gameday = await this.pointRepository
        .createQueryBuilder('points')
        .innerJoinAndSelect('points.game', 'g')
        .where('points.user.id = :uid ', { uid: user.id })
        .andWhere('points.group.id = :gid', { gid: group.id })
        .andWhere('g.spieltag = :index', { index: i })
        .getMany();
      let sum = 0;
      gameday.forEach((point) => {
        sum += point.points;
      });
      points_by_gameday.push(sum);
    }
    return points_by_gameday;
  }
}
