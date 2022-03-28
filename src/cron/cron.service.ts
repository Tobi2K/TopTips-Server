import {
  forwardRef,
  HttpService,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

import * as admin from 'firebase-admin';
import { Competition } from 'src/database/entities/competition.entity';
import { Game } from 'src/database/entities/game.entity';
import { Group } from 'src/database/entities/group.entity';
import { Season } from 'src/database/entities/season.entity';
import { Team } from 'src/database/entities/team.entity';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import { GameService } from 'src/game/game.service';
import { Connection, Like, Repository } from 'typeorm';

var moment = require('moment');

import { createHash } from 'crypto';
import { Points } from 'src/database/entities/points.entity';
import { PointsService } from 'src/points/points.service';
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    private connection: Connection,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,
    private readonly httpService: HttpService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleNotifications() {
    this.logger.debug('Checking for games today');

    const unimportantSeasons = await this.getActiveSeasons(0);
    const importantSeasons = await this.getActiveSeasons(1);
    const allActiveSeasons = unimportantSeasons.concat(importantSeasons);

    allActiveSeasons.forEach(async (season_id) => {
      const dbseason = await this.connection
        .getRepository(Season)
        .findOneOrFail({
          where: { season_id: season_id },
        });
      const games = await this.gameRepository.find({
        where: {
          season: dbseason,
        },
      });
      const gamedays: number[] = [];

      let gameToday = false;
      for (const game of games) {
        if (moment(game.date).isSame(moment(), 'day')) {
          // there is a game today
          gameToday = true;
          if (!gamedays.includes(game.spieltag)) gamedays.push(game.spieltag);
        }
      }
      gamedays.sort((x, y) => x - y);

      if (gameToday && gamedays.length > 0)
        this.sendNotification(dbseason.season_id, dbseason.name, gamedays);
    });
  }

  sendNotification(season_id: string, seasonName: string, gamedays: number[]) {
    let days = '';
    if (gamedays.length == 0) {
      this.logger.debug('No Games Today');
      return;
    } else if (gamedays.length == 1) {
      this.logger.debug('There is a game today');
      days = 'Gameday: ' + gamedays[0];
    } else if (gamedays.length > 1) {
      this.logger.debug('There are games today');
      days = 'Gamedays: ';
      for (let i = 0; i < gamedays.length - 1; i++) {
        days += gamedays[i] + ', ';
      }
      days += gamedays[gamedays.length - 1];
    }

    const topic = season_id.split(':').join('');

    const message = {
      notification: {
        title: 'Have you submitted your guesses?',
        body: 'There are games today. ' + seasonName + ' ' + days,
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

  async getActiveSeasons(importance: number) {
    let activeGroups = await this.connection.getRepository(Group).find();
    var nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() - 8);
    activeGroups = activeGroups.filter((s) => {
      return (
        s.season.important == importance &&
        s.season.start_date < new Date() &&
        s.season.end_date > nextWeek
      );
    });

    let seasons: string[] = [];
    for (let i = 0; i < activeGroups.length; i++) {
      const season = activeGroups[i].season.season_id;
      if (!seasons.includes(season)) {
        seasons.push(season);
      }
    }
    return seasons;
  }

  async syncGames(data: any[], new_season: Season) {
    this.logger.debug('Syncing games and times...');

    data = data.filter(
      (e) => !['postponed'].includes(e.sport_event_status.status),
    );

    data.forEach(async (game) => {
      const new_eventID = game.sport_event.id;
      const new_spieltag =
        game.sport_event.sport_event_context.round.number ?? -1;
      const new_date = game.sport_event.start_time;
      const new_team1 = await this.mapTeamID(
        game.sport_event['competitors'].filter((e) =>
          ['home'].includes(e.qualifier),
        )[0],
      );
      const new_team2 = await this.mapTeamID(
        game.sport_event['competitors'].filter((e) =>
          ['away'].includes(e.qualifier),
        )[0],
      );

      const new_stage = game.sport_event.sport_event_context.round.name ?? null;

      const findByID = await this.gameRepository.findOne({
        event_id: new_eventID,
      });
      const findByData = await this.gameRepository.findOne({
        spieltag: new_spieltag,
        stage: new_stage,
        team1: new_team1,
        team2: new_team2,
        season: new_season,
      });

      const findByBoth = await this.gameRepository.findOne({
        where: {
          event_id: new_eventID,
          spieltag: new_spieltag,
          stage: new_stage,
          team1: new_team1,
          team2: new_team2,
          season: new_season,
        },
        relations: ['special_bet', 'team1', 'team2'],
      });
      if (findByBoth) {
        this.logger.debug('Found game; Updating date');
        findByBoth.date = new_date;

        // update date to be sure
        await this.gameRepository.save(findByBoth);
      } else if (findByID && !findByData) {
        this.logger.debug('Found game with ID; Updating data');
        // game with same event id found, wrong data
        findByID.spieltag = new_spieltag;
        findByID.stage = new_stage;
        findByID.team1 = new_team1;
        findByID.team2 = new_team2;
        findByID.date = new_date;
        await this.gameRepository.save(findByID);
      } else if (!findByID && findByData) {
        this.logger.debug('Found game data; Updating id');
        // game with same data found, wrong id
        findByData.event_id = new_eventID;
        findByData.date = new_date;
        await this.gameRepository.save(findByData);
      } else if (!findByData && !findByID) {
        // new game => add game
        const dto = new CreateGameDto();
        dto.date = new_date;
        dto.eventID = new_eventID;
        dto.team1 = new_team1;
        dto.team2 = new_team2;
        dto.gameday = new_spieltag;
        dto.stage = new_stage;
        dto.season = new_season;

        this.gameService.addGame(dto);
      }
    });
  }

  async syncPoints(data: any[]) {
    const scores = data.filter((e) =>
      ['closed'].includes(e.sport_event_status.status),
    );
    scores.forEach(async (score) => {
      const game = await this.gameRepository.findOne({
        event_id: score.sport_event.id,
      });

      if (!game) {
        return;
      }

      const wasNotComplete: boolean = game.completed == 0;

      const update = new UpdateGameDto();
      update.bet = this.getSpecialBet(game.special_bet.id, score.statistics);
      update.team1 = score.sport_event_status.home_score;
      update.team2 = score.sport_event_status.away_score;

      await this.gameService.updateGame(update, game.id);

      if (wasNotComplete) this.checkIfGamedayIsFinished(game);
    });
  }

  async checkIfGamedayIsFinished(game: Game) {
    this.logger.debug(
      'Checking if ' +
        game.season.name +
        ' gameday ' +
        game.spieltag +
        ' has finshed...',
    );
    let games = await this.gameRepository.find({
      where: {
        season: game.season,
        spieltag: game.spieltag,
      },
    });

    games = games.filter((val) => {
      val.completed == 0;
    });

    if (games.length == 0) {
      const groups = await this.connection.getRepository(Group).find({
        where: {
          season: game.season,
        },
      });
      groups.forEach((group) => {
        this.calculatePointsForGroupByGameday(group, game);
      });
    }
  }

  async calculatePointsForGroupByGameday(group: Group, game: Game) {
    const games = await this.gameRepository.find({
      where: {
        season: game.season,
        spieltag: game.spieltag,
      },
    });

    let points: Points[] = [];
    for (const current_game of games) {
      const game_points = await this.connection.getRepository(Points).find({
        where: {
          game: current_game,
          group: group,
        },
      });

      points = points.concat(game_points);
    }

    let transformed = [];

    for (let i = 0; i < points.length; i++) {
      const element = points[i];

      const total = await this.pointsService.getTotalPointsByPlayer(
        element.user,
        group,
      );

      transformed[i] = {
        uid: element.user.id,
        name: element.user.name,
        points: element.points,
        total: total,
      };
    }

    let final_points = [];
    transformed.map((e) => {
      if (!final_points[e.uid]) {
        final_points[e.uid] = { name: e.name, score: 0, total: e.total };
      }
      final_points[e.uid].score += e.points;
    });

    final_points = Object.entries(final_points)
      .map((value) => {
        return value[1];
      })
      .sort((a, b) => b.score - a.score);

    const standing = this.generateStandingsString(final_points);

    this.sendGroupNotification('group' + group.id, game, group.name, standing);
  }

  private generateStandingsString(points: any[]) {
    let formattedStandings =
      points.length > 0
        ? '1. Place: ' +
          points[0].name +
          ' with ' +
          points[0].score +
          ' points. (Overall: ' +
          points[0].total +
          ')'
        : 'Nobody played this gameday.';
    let place = 1;
    let skipped = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i - 1].score == points[i].score) {
        formattedStandings +=
          '\n' +
          place +
          '. Place: ' +
          points[i].name +
          ' with ' +
          points[i].score +
          ' points. (Overall: ' +
          points[i].total +
          ')';
        skipped += 1;
      } else {
        place += 1 + skipped;
        skipped = 0;
        formattedStandings +=
          '\n' +
          place +
          '. Place: ' +
          points[i].name +
          ' with ' +
          points[i].score +
          ' points. (Overall: ' +
          points[i].total +
          ')';
      }
    }

    return formattedStandings;
  }

  sendGroupNotification(
    group_id: string,
    game: Game,
    groupName: string,
    standings: string,
  ) {
    const topic = group_id;
    this.logger.debug('TOPIC: ' + topic);

    const message = {
      notification: {
        title: game.season.name + ' gameday ' + game.spieltag + ' is over.',
        body: 'How did ' + groupName + ' perform this gameday?\n\n' + standings,
      },
      android: {
        priority: 'high' as any,
        notification: {
          priority: 'max' as any,
          channelId: 'General',
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

  async mapTeamID(competitor: any): Promise<Team> {
    let team = await this.connection.getRepository(Team).findOne({
      where: {
        competitor_id: competitor.id,
      },
    });

    if (!team) {
      team = new Team();
      team.competitor_id = competitor.id;
      team.name = competitor.name;
      team.abbreviation = this.generateAbbreviation(competitor);
      const colors = this.generateColors(competitor.id);
      team.background_color = colors.background_color;
      team.text_color = colors.text_color;
      this.connection.getRepository(Team).save(team);
      return team;
    }
    return team;
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

  @Cron('0 0,16-22 * * *') // At minute 0 past every hour from 16 through 22. => 7 times daily per important season
  async syncImportantGames() {
    this.logger.debug('Syncing important games and scores...');

    const seasons = await this.getActiveSeasons(1);
    for (let i = 0; i < seasons.length; i++) {
      const seasonID = seasons[i];
      const data = (
        await this.httpService
          .get(
            'https://api.sportradar.com/handball/trial/v2/en/seasons/' +
              seasonID +
              '/summaries.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data.summaries as any[];

      const season = await this.connection
        .getRepository(Season)
        .findOne({ where: { season_id: seasonID } });

      this.syncGames(data, season);

      this.syncPoints(data);

      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  @Cron('0 2 * * 1')
  async syncUnimportantGames() {
    this.logger.debug('Syncing unimportant games and scores...');

    const seasons = await this.getActiveSeasons(0);
    for (let i = 0; i < seasons.length; i++) {
      const seasonID = seasons[i];
      const data = (
        await this.httpService
          .get(
            'https://api.sportradar.com/handball/trial/v2/en/seasons/' +
              seasonID +
              '/summaries.json?api_key=' +
              process.env.API_KEY,
          )
          .toPromise()
      ).data.summaries as any[];

      const season = await this.connection
        .getRepository(Season)
        .findOne({ where: { season_id: seasonID } });

      this.syncGames(data, season);

      this.syncPoints(data);

      await new Promise((res) => setTimeout(res, 1000));
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
      ).data.summaries as any[];
      this.syncGames(data, season);
    }
  }

  @Cron('0 3 1 * *') // At 03:00 on day-of-month 1. => 1 time monthly (not per season)
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
      this.logger.debug('Adding league ' + e.name);
      const comp = new Competition();
      comp.competition_id = e.id;
      comp.name = e.name;
      comp.gender = e.gender;
      comp.country = e.category.name;

      competitionRepository.save(comp);
    });
  }

  @Cron('0 4 1 * *') // At 04:00 on day-of-month 1. => 1 time monthly (not per season)
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
    });
  }

  @Cron('0 5 1 * *') // At 05:00 on day-of-month 1. => 1 time monthly per season
  async syncTeams() {
    const groups = await this.connection
      .getRepository(Group)
      .createQueryBuilder('group')
      .innerJoinAndSelect('group.season', 's')
      .getMany();

    let groupSet = new Set();

    for (let i = 0; i < groups.length; i++) {
      groupSet.add(groups[i].season.season_id);
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
        team.abbreviation = this.generateAbbreviation(e);
        const colors = this.generateColors(e.id);
        team.background_color = colors.background_color;
        team.text_color = colors.text_color;
        teamRepository.save(team);
      });

      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  @Cron('0 6 1 * *')
  async syncCurrentGameday() {
    const unimportantSeasons = await this.getActiveSeasons(0);
    const importantSeasons = await this.getActiveSeasons(1);
    const allActiveSeasons = unimportantSeasons.concat(importantSeasons);

    allActiveSeasons.forEach(async (season_id) => {
      const lastGameday = await this.getLastGameday(season_id);
      const season = await this.connection.getRepository(Season).findOne({
        where: { season_id: season_id },
      });

      let currentGameday = 1;

      for (let i = 1; i <= lastGameday; i++) {
        const games = await this.connection.getRepository(Game).find({
          where: {
            season: season,
            spieltag: i,
          },
        });
        let past_game_count = 0;
        let pending_game_count = 0;

        games.forEach((game) => {
          if (moment(game.date) < moment().startOf('day')) {
            // past game
            past_game_count++;
          } else {
            pending_game_count++;
          }
        });

        // if more than 2 games are still to be played, use this gameday as current gameday
        if (past_game_count > games.length - 3) {
          // past games reached critical point
          currentGameday = Math.min(i + 1, games.length);
        } else {
          // first gameday that has more than 2 pending games
          currentGameday = i;
          break;
        }
      }

      this.connection.getRepository(Season).update(season, {
        current_gameday: currentGameday,
      });
    });
  }

  async getLastGameday(season_id: String) {
    const x = await this.connection
      .getRepository(Game)
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.season', 'season')
      .select('MAX(spieltag) as max')
      .where('season.season_id = :sid', { sid: season_id })
      .getRawOne();

    return x.max;
  }

  generateAbbreviation(competitor) {
    let formattedAbbreviation = '';
    if (competitor && competitor.abbreviation) {
      formattedAbbreviation = (competitor.abbreviation as string).slice(0, 3);
    } else if (competitor && competitor.name) {
      // generate abbreviation
      const name = (competitor.name as string)
        .split(' ')
        .filter((value) => value.length > 0);
      if (name.length == 1) {
        formattedAbbreviation = name[0].slice(0, 3);
      } else if (name.length == 2) {
        formattedAbbreviation = name[0].slice(0, 2) + name[1].charAt(0);
      } else if (name.length > 2) {
        formattedAbbreviation =
          name[0].charAt(0) + name[1].charAt(0) + name[2].charAt(0);
      }
      if (formattedAbbreviation.length != 3) {
        formattedAbbreviation = 'N/A';
      }
    } else {
      formattedAbbreviation = 'N/A';
    }

    return formattedAbbreviation;
  }

  generateColors(id: string) {
    // generates hexadecimal hash, slices to 6 digits for color representation
    const slicedHash = createHash('sha256')
      .update(id)
      .digest('hex')
      .slice(0, 6);
    const background_color = '#' + slicedHash;

    // convert hex color to rgb color; further: https://stackoverflow.com/questions/1855884/determine-font-color-based-on-background-color and https://www.w3docs.com/snippets/javascript/how-to-convert-rgb-to-hex-and-vice-versa.html
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
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
