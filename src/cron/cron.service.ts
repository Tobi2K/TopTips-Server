import { HttpService, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import * as admin from 'firebase-admin';
import { Game } from 'src/database/entities/game.entity';
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
    private gameService: GameService,
    private httpService: HttpService,
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
    this.logger.debug('Syncing games and times...');
    const data = (
      await this.httpService
        .get(
          'https://api.sportradar.com/handball/trial/v2/en/seasons/sr:season:85804/summaries.json?api_key=75wxqg3r57z3cw8acsqfg9fw',
        )
        .toPromise()
    ).data;

    const gameRepository = this.connection.getRepository(Game);

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
        spieltag: game.sport_event.sport_event_context.round.number,
        team1_id: team1,
        team2_id: team2,
      });
      if (!db) {
        const dto = new CreateGameDto();
        dto.date = game.sport_event.start_time;
        dto.eventID = game.sport_event.id;
        dto.team1 = team1;
        dto.team2 = team2;
        dto.gameday = game.sport_event.sport_event_context.round.number;

        this.gameService.addGame(dto);
      } else {
        this.logger.debug('Duplicate game with id: ' + db.game_id);

        // game between these teams and on the same gameday exists => duplicate
        await gameRepository.update(
          {
            spieltag: game.sport_event.sport_event_context.round.number,
            team1_id: team1,
            team2_id: team2,
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
      this.gameService.updateGameDate(db.game_id, game.sport_event.start_time);
    });
  }

  async mapTeamID(compID: string): Promise<number> {
    const team = await this.connection.getRepository(Team).findOne({
      where: {
        competitor_id: compID,
      },
    });
    return team.team_id;
  }

  @Cron('*/30 0,13-23 * * *')
  async syncScores() {
    this.logger.debug('Syncing scores...');
    const data = (
      await this.httpService
        .get(
          'https://api.sportradar.com/handball/trial/v2/en/seasons/sr:season:85804/summaries.json?api_key=75wxqg3r57z3cw8acsqfg9fw',
        )
        .toPromise()
    ).data;
    const gameRepository = this.connection.getRepository(Game);
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
      update.bet = this.getSpecialBet(
        game.special_bet_id,
        score.statistics.totals.competitors,
      );
      update.team1 = score.sport_event_status.home_score;
      update.team2 = score.sport_event_status.away_score;

      this.gameService.updateGame(update, game.game_id);
    });
  }

  // apparently game results can be changed after their status is set closed :thonk:
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async updateAllScores() {
    const data = (
      await this.httpService
        .get(
          'https://api.sportradar.com/handball/trial/v2/en/seasons/sr:season:85804/summaries.json?api_key=75wxqg3r57z3cw8acsqfg9fw',
        )
        .toPromise()
    ).data;

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
      update.bet = this.getSpecialBet(
        game.special_bet_id,
        score.statistics.totals.competitors,
      );
      update.team1 = score.sport_event_status.home_score;
      update.team2 = score.sport_event_status.away_score;

      this.gameService.updateGame(update, game.game_id);
    });
  }

  getSpecialBet(id: number, data): number {
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
        return 0;
    }
  }

  async syncDates() {
    this.logger.debug('Syncing dates...');
    const data = (
      await this.httpService
        .get(
          'https://api.sportradar.com/handball/trial/v2/en/seasons/sr:season:85804/summaries.json?api_key=75wxqg3r57z3cw8acsqfg9fw',
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
      this.gameService.updateGameDate(db.game_id, game.sport_event.start_time);
    });
  }
}
