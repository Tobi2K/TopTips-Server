import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from 'src/database/entities/group.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Season } from 'src/database/entities/season.entity';
import { Team } from 'src/database/entities/team.entity';
import { User } from 'src/database/entities/user.entity';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import { GroupService } from 'src/group/group.service';
import { PointsService } from 'src/points/points.service';
import { StandingService } from 'src/standing/standing.service';
import { Between, Connection, Repository } from 'typeorm';
import { Game } from '../database/entities/game.entity';

@Injectable()
export class GameService {
  private moment = require('moment');
  private readonly logger = new Logger(GameService.name);
  constructor(
    @InjectRepository(Game) private gameRepository: Repository<Game>,
    private connection: Connection,
    private readonly pointsService: PointsService,

    private readonly groupService: GroupService,
    @Inject(forwardRef(() => StandingService))
    private readonly standingService: StandingService,
  ) { }

  async getAllGamesFormatted(group_id: number, user: { username: any }) {
    const dbgroup = await this.connection
      .getRepository(Group)
      .findOne({ where: { id: group_id } });

    const dbuser = await this.connection
      .getRepository(User)
      .findOne({ where: { name: user.username } });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    const dbseason = dbgroup.season;

    const gameDays = await this.connection
      .getRepository(Game)
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.season', 's')
      .select('game.gameday')
      .addSelect('s')
      .addSelect('game.stage')
      .where('s.id = :sid', { sid: dbseason.id })
      .groupBy('gameday')
      .getMany();

    gameDays.sort((a, b) => {
      if (a.gameday == -1) return -1;

      if (b.gameday == -1) return -1;

      return a.gameday - b.gameday;
    });

    const games = [];
    for (let i = 0; i < gameDays.length; i++) {
      games.push(await this.getGamedayFormatted(gameDays[i], dbuser, dbgroup));
    }
    return games;
  }

  async getGamedayFormatted(day: Game, user: User, group: Group) {
    let games = await this.gameRepository.find({
      where: { gameday: day.gameday, season: day.season },
      order: { date: 'ASC' },
    });

    if (games.length > 10) {
      games = await this.gameRepository.find({
        where: { gameday: day.gameday, season: day.season },
        order: { completed: 'ASC', date: 'ASC' },
      });
    }

    const guesses = await this.connection.getRepository(Guess).find({
      where: {
        user: user,
        group: group,
      },
    });

    const formatted = [];

    for (let i = 0; i < games.length; i++) {
      const val = games[i];

      const formattedGame = await this.formatGame(val, guesses, group);
      formatted.push(formattedGame);
    }

    return { games: formatted, sectionTitle: "Gameday " + day.gameday };
  }

  async getAllGamesByTime(group_id: number, user: { username: any }) {
    const dbgroup = await this.connection
      .getRepository(Group)
      .findOne({ where: { id: group_id } });

    const dbuser = await this.connection
      .getRepository(User)
      .findOne({ where: { name: user.username } });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    const dbseason = dbgroup.season;

    const start = this.moment(dbseason.start_date).startOf('month');
    const end = this.moment(dbseason.end_date).startOf('month');

    const monthYears = [];

    const current = start.clone();
    while (current.isSameOrBefore(end)) {
      monthYears.push({
        year: current.year(),
        month: current.month() + 1,
      });
      current.add(1, 'month');
    }

    const games = [];
    for (let i = 0; i < monthYears.length; i++) {
      const gamesByMonth = await this.getGamesByMonth(monthYears[i]['month'], monthYears[i]['year'], dbuser, dbgroup);

      if (gamesByMonth.games.length > 0) games.push(gamesByMonth);
    }
    return games;
  }

  async getGamesByMonth(month: number, year: number, user: User, group: Group) {
    const startOfMonth = this.moment({ year, month: month - 1 }).startOf('month').toDate();
    const endOfMonth = this.moment({ year, month: month - 1 }).endOf('month').toDate();

    let games = await this.gameRepository.find({
      where: {
        date: Between(startOfMonth, endOfMonth),
        season: group.season,
      },
      order: { date: 'ASC' }
    });

    if (games.length > 10) {
      games = await this.gameRepository.find({
        where: {
          date: Between(startOfMonth, endOfMonth),
          season: group.season,
        },
        order: { completed: 'ASC', date: 'ASC' }
      });
    }

    const guesses = await this.connection.getRepository(Guess).find({
      where: {
        user: user,
        group: group,
      },
    });

    const formatted = [];

    for (let i = 0; i < games.length; i++) {
      const val = games[i];

      const formattedGame = await this.formatGame(val, guesses, group);
      formatted.push(formattedGame);
    }

    return { games: formatted, sectionTitle: this.moment(endOfMonth).format('MMMM YYYY') };
  }

  async formatGame(currentGame: Game, guesses: Guess[], group: Group) {
    let guess_string = '';
    const guessed =
      guesses.filter((guess) => {
        if (guess.game.id == currentGame.id) {
          guess_string = guess.score_team1 + ' : ' + guess.score_team2;
          return true;
        }
      }).length > 0;
    let game_string: string;
    if (currentGame.completed == 1) {
      game_string = currentGame.score_team1 + ' : ' + currentGame.score_team2;
    } else {
      game_string = '-';
    }

    const PaH_team1 = await this.standingService.getTeamStats(
      group.season.id,
      currentGame.team1.id,
    );
    const PaH_team2 = await this.standingService.getTeamStats(
      group.season.id,
      currentGame.team2.id,
    );

    const head_to_head_team1_home = await this.gameRepository
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.team1', 'team1')
      .innerJoinAndSelect('game.team2', 'team2')
      .where(
        'team1_id = :team_id1 AND team2_id = :team_id2 AND completed = 1',
        {
          team_id1: currentGame.team1.id,
          team_id2: currentGame.team2.id,
        },
      )
      .orderBy('game.date', 'DESC')
      .getMany();

    const head_to_head_team1_away = await this.gameRepository
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.team1', 'team1')
      .innerJoinAndSelect('game.team2', 'team2')
      .where(
        'team1_id = :team_id2 AND team2_id = :team_id1 AND completed = 1',
        {
          team_id1: currentGame.team1.id,
          team_id2: currentGame.team2.id,
        },
      )
      .orderBy('game.date', 'DESC')
      .getMany();

    const head_to_head = head_to_head_team1_home
      .concat(head_to_head_team1_away)
      .map((val) => {
        return {
          game: val,
          team1_won: val.score_team1 > val.score_team2,
          team2_won: val.score_team1 < val.score_team2,
        };
      })
      .sort((a, b) => (a.game.date > b.game.date ? -1 : 1))
      .slice(0, 10);

    const head_to_head_home = head_to_head_team1_home.map((val) => {
      return {
        home_team: val.score_team1,
        away_team: val.score_team2,
        home_team_won: val.score_team1 > val.score_team2,
        away_team_won: val.score_team1 < val.score_team2,
        date: val.date,
      };
    });
    const head_to_head_away = head_to_head_team1_away.map((val) => {
      return {
        home_team: val.score_team2,
        away_team: val.score_team1,
        home_team_won: val.score_team2 > val.score_team1,
        away_team_won: val.score_team2 < val.score_team1,
        date: val.date,
      };
    });

    const draws = head_to_head_home
      .concat(head_to_head_away)
      .filter((val) => {
        return !val.home_team_won && !val.away_team_won;
      }).length;
    const count_home_games = head_to_head_home
      .concat(head_to_head_away)
      .filter((val) => {
        return val.home_team_won;
      }).length;
    const count_away_games = head_to_head_home
      .concat(head_to_head_away)
      .filter((val) => {
        return val.away_team_won;
      }).length;

    const x = {
      id: currentGame.id,
      date: currentGame.date,
      date_string: new Date(currentGame.date).toLocaleString('de-DE', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }),
      team1_id: currentGame.team1.id,
      team1_abbr: currentGame.team1.abbreviation,
      team1_short_name: currentGame.team1.short_name,
      team1_background: currentGame.team1.background_color,
      team1_text: currentGame.team1.text_color,
      team1_stats: PaH_team1,
      team2_id: currentGame.team2.id,
      team2_abbr: currentGame.team2.abbreviation,
      team2_short_name: currentGame.team2.short_name,
      team2_background: currentGame.team2.background_color,
      team2_text: currentGame.team2.text_color,
      team2_stats: PaH_team2,
      team1_name: currentGame.team1.name,
      team2_name: currentGame.team2.name,
      game_string: game_string,
      game_desc: currentGame.stage,
      guessed: guessed,
      guess: guess_string,
      head_to_head: head_to_head,
      home_team_won: count_home_games,
      away_team_won: count_away_games,
      draw_count: draws,
    };

    return x;
  }

  async addGame(body: CreateGameDto) {
    const game = new Game();
    game.gameday = body.gameday;
    game.stage = body.stage;
    game.event_id = body.eventID;
    game.date = body.date;
    game.team1 = body.team1;
    game.team2 = body.team2;
    game.season = body.season;
    game.postponed = body.postponed;
    const x = await this.gameRepository.save(game);
    this.logger.debug('Adding game with id: ' + x.id);
  }

  async updateGame(body: UpdateGameDto, id: number) {
    this.logger.debug('Updating game with id: ' + id);
    await this.gameRepository.update(
      {
        id: id,
      },
      {
        score_team1: body.team1,
        score_team2: body.team2,
        completed: 1,
      },
    );
    await this.pointsService.calculateGamePoints(id);
  }

  async getActiveGamedays(group_id: number, user: { username: any }) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: group_id },
    });

    const dbuser = await this.connection
      .getRepository(User)
      .findOne({ where: { name: user.username } });

    if (!dbgroup) {
      throw new HttpException('Group not found.', HttpStatus.NOT_FOUND);
    }

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    const games = await this.gameRepository.find({
      where: {
        season: dbgroup.season,
      },
    });
    const gamedays: any[] = [];

    for (const game of games) {
      if (this.moment(game.date).isSame(this.moment(), 'day')) {
        // there is a game today
        if (!gamedays.includes(game.gameday)) gamedays.push(game.gameday);
      }
    }
    gamedays.sort((x, y) => x - y);

    const special = gamedays.indexOf(-1);

    if (special != -1) {
      gamedays[special] = 'Special';
    }

    return gamedays;
  }

  async getGoalStats(team_id: number, season_id: number) {
    const dbteam = await this.connection.getRepository(Team).findOne({
      where: {
        id: team_id,
      },
    });

    const dbseason = await this.connection.getRepository(Season).findOne({
      where: {
        id: season_id,
      },
    });

    if (dbteam && dbseason) {
      const goals_team1 = await this.gameRepository
        .createQueryBuilder('game')
        .innerJoinAndSelect('game.team1', 'team1')
        .where(
          'season_id = :season_id AND team1_id = :team_id AND completed = 1',
          {
            season_id: season_id,
            team_id: team_id,
          },
        )
        .select([
          'AVG(score_team1) goals_avg, MAX(score_team1) goals_max, MIN(score_team1) goals_min, SUM(score_team1) goals_for, SUM(score_team2) goals_against',
        ])
        .getRawOne();

      const goals_team2 = await this.gameRepository
        .createQueryBuilder('game')
        .innerJoinAndSelect('game.team2', 'team2')
        .where(
          'season_id = :season_id AND team2_id = :team_id AND completed = 1',
          {
            season_id: season_id,
            team_id: team_id,
          },
        )
        .select([
          'AVG(score_team2) goals_avg, MAX(score_team2) goals_max, MIN(score_team2) goals_min, SUM(score_team2) goals_for, SUM(score_team1) goals_against',
        ])
        .getRawOne();

      let avg_goals;
      let max_goals;
      let min_goals;
      let goals_for;
      let goals_against;

      if (goals_team1.goals_avg && goals_team2.goals_avg) {
        avg_goals = (
          (Number(goals_team1.goals_avg) + Number(goals_team2.goals_avg)) /
          2
        ).toFixed(2);
      } else if (goals_team1.goals_avg) {
        avg_goals = Number(goals_team1.goals_avg).toFixed(2);
      } else if (goals_team2.goals_avg) {
        avg_goals = Number(goals_team2.goals_avg).toFixed(2);
      } else {
        avg_goals = '-';
      }

      if (goals_team1.goals_min && goals_team2.goals_min) {
        min_goals = Math.min(goals_team1.goals_min, goals_team2.goals_min);
      } else if (goals_team1.goals_min) {
        min_goals = goals_team1.goals_min;
      } else if (goals_team2.goals_min) {
        min_goals = goals_team2.goals_min;
      } else {
        min_goals = '-';
      }

      if (goals_team1.goals_max && goals_team2.goals_max) {
        max_goals = Math.max(goals_team1.goals_max, goals_team2.goals_max);
      } else if (goals_team1.goals_max) {
        max_goals = goals_team1.goals_max;
      } else if (goals_team2.goals_max) {
        max_goals = goals_team2.goals_max;
      } else {
        max_goals = '-';
      }

      if (goals_team1.goals_for && goals_team2.goals_for) {
        goals_for =
          Number(goals_team1.goals_for) + Number(goals_team2.goals_for);
      } else if (goals_team1.goals_for) {
        goals_for = Number(goals_team1.goals_for);
      } else if (goals_team2.goals_for) {
        goals_for = Number(goals_team2.goals_for);
      } else {
        goals_for = '-';
      }

      if (goals_team1.goals_against && goals_team2.goals_against) {
        goals_against =
          Number(goals_team1.goals_against) + Number(goals_team2.goals_against);
      } else if (goals_team1.goals_against) {
        goals_against = Number(goals_team1.goals_against);
      } else if (goals_team2.goals_against) {
        goals_against = Number(goals_team2.goals_against);
      } else {
        goals_against = '-';
      }

      return { avg_goals, min_goals, max_goals, goals_for, goals_against };
    } else {
      return null;
    }
  }
}
