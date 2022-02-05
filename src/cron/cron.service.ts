import {
  forwardRef,
  HttpService,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import * as admin from 'firebase-admin';
import { Competition } from 'src/database/entities/competition.entity';
import { Game } from 'src/database/entities/game.entity';
import { Group } from 'src/database/entities/group.entity';
import { Season } from 'src/database/entities/season.entity';
import { Team } from 'src/database/entities/team.entity';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import { GameService } from 'src/game/game.service';
import { Connection, Like } from 'typeorm';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    private connection: Connection,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly httpService: HttpService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleNotifications() {
    this.logger.debug('Checking for games today');

    const currentDate = new Date();
    const currentDateString =
      currentDate.getFullYear() +
      '-' +
      ('0' + (currentDate.getMonth() + 1)).slice(-2) +
      '-' +
      ('0' + currentDate.getDate()).slice(-2) +
      '%';
    const gamedayResult = await this.connection.getRepository(Game).find({
      select: ['spieltag'],
      where: { date: Like(currentDateString) },
    });

    let days = '';
    const gamedays = [];
    gamedayResult.forEach((e) => {
      if (!gamedays.includes(e.spieltag)) gamedays.push(e.spieltag);
    });
    gamedays.sort((x, y) => x - y);

    if (gamedays.length == 0) {
      this.logger.debug('No Games Today');
      return;
    } else if (gamedays.length == 1) {
      this.logger.debug('There is a game today');
      days = 'Spieltag: ' + gamedays[0];
    } else if (gamedays.length > 1) {
      this.logger.debug('There are games today');
      days = 'Spieltage: ';
      for (let i = 0; i < gamedays.length - 1; i++) {
        days += gamedays[i] + ', ';
      }
      days += gamedays[gamedays.length - 1];
    }

    const topic = 'games';
    const message = {
      notification: {
        title: 'Schon getippt?',
        body: 'Heute finden Spiele statt. ' + days,
      },
      android: {
        priority: 'high' as any,
        notification: {
          priority: 'max' as any,
          channelId: 'Games',
        },
      },
      topic: topic,
    };

    admin
      .messaging()
      .send(message)
      .then((response) => {
        // Response is a message ID string.
        this.logger.debug('Successfully sent message:', response);
      })
      .catch((error) => {
        this.logger.error('Error sending message:', error);
      });
  }

  @Cron('0 0 1 * * 1')
  async syncGames() {
    const gameRepository = this.connection.getRepository(Game);
    this.logger.debug('Syncing games and times...');
    let activeGroups = await this.connection.getRepository(Group).find();

    activeGroups = activeGroups.filter((s) => {
      return s.season.start_date < new Date() && s.season.end_date > new Date();
    });

    let groupSet = new Set<String>();

    for (let i = 0; i < activeGroups.length; i++) {
      groupSet.add(activeGroups[i].season.season_id);
    }

    let activeSeasons = Array.from(groupSet.values());

    for (let i = 0; i < activeSeasons.length; i++) {
      const seasonID = activeSeasons[i];
      const season = await this.connection
        .getRepository(Season)
        .findOne({ where: { season_id: seasonID } });
      const data = (
        await this.httpService
          .get(
            'https://api.sportradar.com/handball/trial/v2/en/seasons/' +
              seasonID +
              '/summaries.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data;

      const new_games_temp: any[] = (
        await Promise.all(
          data.summaries.map(async (e: { sport_event: { id: any } }) => {
            const db = await gameRepository.findOne({
              event_id: e.sport_event.id,
            });
            if (!db) return e;
            return false;
          }),
        )
      ).filter(Boolean);

      const new_games: any[] = new_games_temp.filter(
        (e) => !['postponed'].includes(e.sport_event_status.status),
      );

      new_games.forEach(async (game) => {
        const team1 = await this.mapTeamID(
          game.sport_event['competitors'].filter((e) =>
            ['home'].includes(e.qualifier),
          )[0].id,
        );
        const team2 = await this.mapTeamID(
          game.sport_event['competitors'].filter((e) =>
            ['away'].includes(e.qualifier),
          )[0].id,
        );

        const db = await gameRepository.findOne({
          spieltag: game.sport_event.sport_event_context.round.number ?? -1,
          stage: game.sport_event.sport_event_context.round.name ?? null,
          team1: team1,
          team2: team2,
          season: season,
        });
        if (!db) {
          const dto = new CreateGameDto();
          dto.date = game.sport_event.start_time;
          dto.eventID = game.sport_event.id;
          dto.team1 = team1;
          dto.team2 = team2;
          dto.gameday = game.sport_event.sport_event_context.round.number ?? -1;
          dto.stage = game.sport_event.sport_event_context.round.name ?? null;
          dto.season = season;

          this.gameService.addGame(dto);
        } else {
          this.logger.debug('Duplicate game with id: ' + db.id);

          // game between these teams and on the same gameday exists => duplicate
          await gameRepository.update(
            {
              spieltag: game.sport_event.sport_event_context.round.number ?? -1,
              stage: game.sport_event.sport_event_context.round.name ?? null,
              team1: team1,
              team2: team2,
            },
            {
              event_id: game.sport_event.id,
            },
          );
        }
      });

      const games_update = data.summaries.filter(
        (e) => !['closed'].includes(e.sport_event_status.status),
      );

      games_update.forEach(async (game) => {
        const db = await gameRepository.findOne({
          event_id: game.sport_event.id,
        });
        if (!db) {
          return;
        }
        this.gameService.updateGameDate(db.id, game.sport_event.start_time);
      });
    }
  }

  async syncGamesForNewGroup(season: Season) {
    const gameRepository = this.connection.getRepository(Game);
    const db = await gameRepository.findOne({
      where: { season: season },
    });

    if (db) {
      this.logger.debug('Season ' + season.name + ' already synced!');
      return;
    } else {
      this.logger.debug('Adding games for season ' + season.name);
      const data = (
        await this.httpService
          .get(
            'https://api.sportradar.com/handball/trial/v2/en/seasons/' +
              season.season_id +
              '/summaries.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data;

      const new_games: any[] = (
        await Promise.all(
          data.summaries.map(async (e: { sport_event: { id: any } }) => {
            const db = await gameRepository.findOne({
              event_id: e.sport_event.id,
            });
            if (!db) return e;
            return false;
          }),
        )
      ).filter(Boolean);

      new_games.forEach(async (game) => {
        const team1 = await this.mapTeamID(
          game.sport_event['competitors'].filter((e) =>
            ['home'].includes(e.qualifier),
          )[0].id,
        );
        const team2 = await this.mapTeamID(
          game.sport_event['competitors'].filter((e) =>
            ['away'].includes(e.qualifier),
          )[0].id,
        );

        const dto = new CreateGameDto();
        dto.date = game.sport_event.start_time;
        dto.eventID = game.sport_event.id;
        dto.team1 = team1;
        dto.team2 = team2;
        dto.gameday = game.sport_event.sport_event_context.round.number ?? -1;
        dto.stage = game.sport_event.sport_event_context.round.name ?? null;
        dto.season = season;

        this.gameService.addGame(dto);
      });
    }
  }

  async mapTeamID(competitorID: string): Promise<Team> {
    const team = await this.connection.getRepository(Team).findOne({
      where: {
        competitor_id: competitorID,
      },
    });
    return team;
  }

  @Cron('*/30 13-23 * * *')
  async syncScores() {
    this.logger.debug('Syncing scores...');

    const gameRepository = this.connection.getRepository(Game);
    let activeGroups = await this.connection.getRepository(Group).find();

    activeGroups = activeGroups.filter((s) => {
      return s.season.start_date < new Date() && s.season.end_date > new Date();
    });

    let groupSet = new Set<String>();

    for (let i = 0; i < activeGroups.length; i++) {
      groupSet.add(activeGroups[i].season.season_id);
    }

    let activeSeasons = Array.from(groupSet.values());

    for (let i = 0; i < activeSeasons.length; i++) {
      const seasonID = activeSeasons[i];
      const data = (
        await this.httpService
          .get(
            'https://api.sportradar.com/handball/trial/v2/en/seasons/' +
              seasonID +
              '/summaries.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data;
      const new_scores: any[] = (
        await Promise.all(
          data.summaries.map(async (e: { sport_event: { id: any } }) => {
            const db = await gameRepository.findOne({
              event_id: e.sport_event.id,
              completed: 0,
            });
            if (db) return e;
            return false;
          }),
        )
      )
        .filter(Boolean)
        .filter((e: any) => ['closed'].includes(e.sport_event_status.status));

      new_scores.forEach(async (score) => {
        const game = await gameRepository.findOne({
          event_id: score.sport_event.id,
        });
        if (!game) {
          return;
        }
        const update = new UpdateGameDto();
        update.bet = this.getSpecialBet(game.special_bet.id, score.statistics);
        update.team1 = score.sport_event_status.home_score;
        update.team2 = score.sport_event_status.away_score;

        this.gameService.updateGame(update, game.id);
      });
    }
  }

  @Cron('0 0 * * *')
  async lastsyncScores() {
    this.logger.debug('Syncing scores...');

    const gameRepository = this.connection.getRepository(Game);
    let activeGroups = await this.connection.getRepository(Group).find();

    activeGroups = activeGroups.filter((s) => {
      return s.season.start_date < new Date() && s.season.end_date > new Date();
    });

    let groupSet = new Set<String>();

    for (let i = 0; i < activeGroups.length; i++) {
      groupSet.add(activeGroups[i].season.season_id);
    }

    let activeSeasons = Array.from(groupSet.values());

    for (let i = 0; i < activeSeasons.length; i++) {
      const seasonID = activeSeasons[i];
      const data = (
        await this.httpService
          .get(
            'https://api.sportradar.com/handball/trial/v2/en/seasons/' +
              seasonID +
              '/summaries.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data;
      const new_scores: any[] = (
        await Promise.all(
          data.summaries.map(async (e: { sport_event: { id: any } }) => {
            const db = await gameRepository.findOne({
              event_id: e.sport_event.id,
              completed: 0,
            });
            if (db) return e;
            return false;
          }),
        )
      )
        .filter(Boolean)
        .filter((e: any) => ['closed'].includes(e.sport_event_status.status));

      new_scores.forEach(async (score) => {
        const game = await gameRepository.findOne({
          event_id: score.sport_event.id,
        });
        if (!game) {
          return;
        }
        const update = new UpdateGameDto();
        update.bet = this.getSpecialBet(game.special_bet.id, score.statistics);
        update.team1 = score.sport_event_status.home_score;
        update.team2 = score.sport_event_status.away_score;

        this.gameService.updateGame(update, game.id);
      });
      this.updateAllScores(data);
    }
  }

  // apparently game results can be changed after their status is set closed :thonk:
  async updateAllScores(data: any) {
    /*const data = require('../../example.json'); /* (
      await this.httpService
        .get(
          'https://api.sportradar.com/handball/trial/v2/en/seasons/sr:season:85804/summaries.json?api_key=' + process.env.API_KEY,
        )
        .toPromise()
    ).data */

    const scores = data.summaries.filter((e) =>
      ['closed'].includes(e.sport_event_status.status),
    );
    const gameRepository = this.connection.getRepository(Game);
    scores.forEach(async (score) => {
      const game = await gameRepository.findOne({
        event_id: score.sport_event.id,
      });
      if (!game) {
        return;
      }
      const update = new UpdateGameDto();
      update.bet = this.getSpecialBet(game.special_bet.id, score.statistics);
      update.team1 = score.sport_event_status.home_score;
      update.team2 = score.sport_event_status.away_score;

      this.gameService.updateGame(update, game.id);
    });
  }

  getSpecialBet(id: number, statistics: any): number {
    if (!statistics) return -1;
    const data = statistics.totals.competitors;
    switch (id) {
      case 0: // 7m goals
        return (
          data[0].statistics.seven_m_goals + data[1].statistics.seven_m_goals
        );

      case 1: // yellow cards
        return (
          data[0].statistics.yellow_cards + data[1].statistics.yellow_cards
        );

      case 2: // 2 minute penalties
        return data[0].statistics.suspensions + data[1].statistics.suspensions;

      case 3: // saves
        return data[0].statistics.saves + data[1].statistics.saves;

      case 4: // field goals
        return data[0].statistics.field_goals + data[1].statistics.field_goals;

      case 5: // steals
        return data[0].statistics.steals + data[1].statistics.steals;

      case 6: // blocks
        return data[0].statistics.blocks + data[1].statistics.blocks;

      case 7: // shot accuracy
        return Math.floor(
          (data[0].statistics.shot_accuracy +
            data[1].statistics.shot_accuracy) /
            2,
        );

      default:
        return -1;
    }
  }

  async syncDates() {
    this.logger.debug('Syncing dates...');
    const data = (
      await this.httpService
        .get(
          'https://api.sportradar.com/handball/trial/v2/en/seasons/sr:season:85804/summaries.json?api_key=' +
            process.env.API_KEY,
        )
        .toPromise()
    ).data;
    const gameRepository = this.connection.getRepository(Game);

    data.summaries.forEach(async (game) => {
      const db = await gameRepository.findOne({
        event_id: game.sport_event.id,
      });
      if (!db) {
        return;
      }
      this.gameService.updateGameDate(db.id, game.sport_event.start_time);
    });
  }

  @Cron('0 3 1 * *')
  async syncLeagues() {
    const data = (
      await this.httpService
        .get(
          'http://api.sportradar.us/handball/trial/v2/en/competitions.json?api_key=' +
            process.env.API_KEY,
        )
        .toPromise()
    ).data;

    const competitionRepository = this.connection.getRepository(Competition);

    const new_leagues: any[] = (
      await Promise.all(
        data.competitions.map(async (e) => {
          const db = await competitionRepository.findOne({
            competition_id: e.id,
          });
          if (!db) return e;
          return false;
        }),
      )
    ).filter(Boolean);

    new_leagues.forEach((e) => {
      const comp = new Competition();
      comp.competition_id = e.id;
      comp.name = e.name;
      comp.gender = e.gender;

      competitionRepository.save(comp);
    });
  }

  @Cron('0 4 1 * *')
  async syncSeasons() {
    const seasonRepository = this.connection.getRepository(Season);

    const data = (
      await this.httpService
        .get(
          'http://api.sportradar.us/handball/trial/v2/en/seasons.json?api_key=' +
            process.env.API_KEY,
        )
        .toPromise()
    ).data;

    const new_seasons: any[] = (
      await Promise.all(
        data.seasons.map(async (e) => {
          const db = await seasonRepository.findOne({
            season_id: e.id,
          });
          if (!db) return e;
          return false;
        }),
      )
    ).filter(Boolean);

    new_seasons.forEach(async (e) => {
      const season = new Season();
      season.season_id = e.id;
      season.name = e.name;
      season.start_date = new Date(e.start_date + 'T00:00:00.000Z');
      season.end_date = new Date(e.end_date + 'T00:00:00.000Z');
      season.year = e.year;
      season.competition = await this.connection
        .getRepository(Competition)
        .findOne({ where: { competition_id: e.competition_id } });

      seasonRepository.save(season);
      console.log('ADD: ', season);
    });
  }

  @Cron('0 5 1 * *')
  async syncTeams() {
    const groups = await this.connection
      .getRepository(Group)
      .createQueryBuilder('group')
      .innerJoinAndSelect('group.season', 's')
      .getMany();

    let groupSet = new Set();

    for (let i = 0; i < groups.length; i++) {
      groupSet.add(groups[i].season.season_id);
      console.log(groupSet);
    }

    const cleanedGroup = Array.from(groupSet.values());

    const teamRepository = this.connection.getRepository(Team);

    for (let i = 0; i < cleanedGroup.length; i++) {
      const element = cleanedGroup[i];

      const data = (
        await this.httpService
          .get(
            'http://api.sportradar.us/handball/trial/v2/en/seasons/' +
              element +
              '/competitors.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data;

      const new_teams: any[] = (
        await Promise.all(
          data.season_competitors.map(async (e) => {
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

      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}
