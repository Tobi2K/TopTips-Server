import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
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
import { Connection, Repository } from 'typeorm';

import { createHash } from 'crypto';
import { Points } from 'src/database/entities/points.entity';
import { PointsService } from 'src/points/points.service';
import { options } from 'src/main';
import { Standing } from 'src/database/entities/standing.entity';
import { TeamDetails } from 'src/helper';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class CronService {
  private moment = require('moment');
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
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_NOON, { name: 'notifications' })
  async handleNotifications() {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }
    this.logger.debug('Checking for games today');

    const allActiveSeasons = await this.getActiveSeasons(1);

    allActiveSeasons.forEach(async (season) => {
      const dbseason = await this.connection
        .getRepository(Season)
        .findOneOrFail({
          where: { id: season.id },
        });
      const games = await this.gameRepository.find({
        where: {
          season: dbseason,
        },
      });
      const gamedays: number[] = [];

      let gameToday = false;
      for (const game of games) {
        if (this.moment(game.date).isSame(this.moment(), 'day')) {
          // there is a game today
          gameToday = true;
          if (!gamedays.includes(game.gameday)) gamedays.push(game.gameday);
        }
      }
      gamedays.sort((x, y) => x - y);

      if (gameToday && gamedays.length > 0)
        this.sendNotification(dbseason.id, dbseason.name, gamedays);
    });
  }

  sendNotification(id: number, seasonName: string, gamedays: number[]) {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }
    let days = '';
    if (gamedays.length == 0) {
      this.logger.debug('No Games Today');
      return;
    } else if (gamedays.length == 1) {
      this.logger.debug('There is a game today');
      if (gamedays[0] == -1) {
        days = 'Gameday: Playoffs';
      } else {
        days = 'Gameday: ' + gamedays[0];
      }
    } else if (gamedays.length > 1) {
      this.logger.debug('There are games today');
      days = 'Gamedays: ';
      for (let i = 0; i < gamedays.length - 1; i++) {
        if (gamedays[i] == -1) {
          days += 'Playoffs, ';
        } else {
          days += gamedays[i] + ', ';
        }
      }
      if (gamedays[gamedays.length - 1] == -1) {
        days += 'Playoffs';
      } else {
        days += gamedays[gamedays.length - 1];
      }
    }

    const topic = 'season' + id;

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
        this.logger.debug('Successfully sent reminder message:', response);
      })
      .catch((error) => {
        this.logger.error('Error sending message:', error);
      });
  }

  async getActiveSeasons(importance: number) {
    let activeGroups = await this.connection.getRepository(Group).find();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() - 8);
    activeGroups = activeGroups.filter((s) => {
      return (
        s.season.important == importance &&
        s.season.start_date < new Date() &&
        s.season.end_date > nextWeek &&
        s.season.current
      );
    });

    const seasons: Season[] = [];
    for (let i = 0; i < activeGroups.length; i++) {
      const season = activeGroups[i].season;
      const seasonID = activeGroups[i].season.id;
      const filtered = seasons.filter((seas) => {
        if (seas.id != seasonID) {
          return false;
        } else {
          return true;
        }
      });
      if (filtered.length == 0) {
        seasons.push(season);
      }
    }
    return seasons;
  }

  async syncGames(data: any[], new_season: Season) {
    this.logger.debug('Syncing games and times... | ' + new_season.name);
    for (let i = 0; i < data.length; i++) {
      const game = data[i];

      const new_eventID = game.id;
      let new_gameday = game.week;
      let new_stage = game.week;
      if (isNaN(new_gameday)) {
        new_gameday = -1;
      } else {
        new_stage = null;
      }
      if (new_gameday == null) {
        new_gameday = 1;
      }
      const new_date = game.date;
      const new_team1 = await this.mapTeamID(game.teams.home);
      const new_team2 = await this.mapTeamID(game.teams.away);
      let new_post = 0;
      if (game.status.short == 'POST') {
        new_post = 1;
      }

      // Not needed for new API, but might be useful later.
      /*if (new_stage != null)
        new_stage = (new_stage as string)
          .replace(/_/g, ' ')
          .toLowerCase()
          .split(' ')
          .map(function (word) {
            return word[0].toUpperCase() + word.substr(1);
          })
          .join(' ');*/

      const db: Game = await this.gameRepository.findOne({
        where: {
          event_id: new_eventID,
        },
      });

      if (db) {
        this.gameRepository.save({
          id: db.id,
          date: new_date,
          event_id: new_eventID,
          postponed: new_post,
        });
      } else {
        // new game => add game
        const dto = new CreateGameDto();
        dto.date = new_date;
        dto.eventID = new_eventID;
        dto.team1 = new_team1;
        dto.team2 = new_team2;
        dto.gameday = new_gameday;
        dto.stage = new_stage;
        dto.season = new_season;
        dto.postponed = new_post;

        this.gameService.addGame(dto);
      }
    }
  }

  async syncPoints(data: any[]) {
    const scores = data.filter((e) =>
      ['FT', 'AET', 'AP'].includes(e.status.short),
    );

    const gamedaySet: number[] = [];
    const gameSet: Game[] = [];

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      const game = await this.gameRepository.findOne({
        where: {
          event_id: score.id,
        },
      });

      if (!game) {
        return;
      }

      if (game.completed == 0)
        if (!gamedaySet.includes(game.gameday)) {
          gamedaySet.push(game.gameday);
          gameSet.push(game);
        }

      const update = new UpdateGameDto();
      update.team1 = score.scores.home;
      update.team2 = score.scores.away;

      await this.gameService.updateGame(update, game.id);
    }
    gameSet.forEach((game) => this.checkIfGamedayIsFinished(game));
  }

  async checkIfGamedayIsFinished(game: Game) {
    this.logger.debug(
      'Checking if ' +
        game.season.name +
        ' gameday ' +
        game.gameday +
        ' has finshed...',
    );
    let games = await this.gameRepository.find({
      where: {
        season: game.season,
        gameday: game.gameday,
      },
    });

    games = games.filter((val) => {
      return val.completed == 0;
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
        gameday: game.gameday,
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

    const transformed = [];

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
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }

    let tmp_gameday: any = game.gameday;

    if (tmp_gameday == -1) {
      tmp_gameday = 'Playoffs';
    }

    const message = {
      notification: {
        title: game.season.name + ' gameday ' + tmp_gameday + ' is over.',
        body: 'How did ' + groupName + ' perform this gameday?\n\n' + standings,
      },
      android: {
        priority: 'high' as any,
        notification: {
          priority: 'max' as any,
          channelId: 'General',
        },
      },
      topic: group_id,
    };

    admin
      .messaging()
      .send(message)
      .then(() => {
        // Response is a message ID string.
        this.logger.debug(
          'Successfully sent group message for ' +
            groupName +
            ' (id: ' +
            group_id +
            ')',
        );
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
      team.abbreviation = competitor.name.slice(0, 3).toString().toUpperCase();
      team.short_name =
        competitor.name
          .split(' ')
          .filter((val: string) => {
            return (
              val.length > 2 && !/[!@#$%^&*()_+=\[\]{};':"\\|,<>?]+/.test(val)
            );
          })
          .at(-1) ?? competitor.name;
      const colors = this.generateColors(competitor.id + competitor.name);
      team.background_color = colors.background_color;
      team.text_color = colors.text_color;
      this.connection.getRepository(Team).save(team);
      return team;
    }
    return team;
  }

  @Cron('0,30 0,12,16-23 * * *', { name: 'sync-important-games' }) // At minute 0 past hour 0, 12, and every hour from 16 through 23. => 10 times daily per important season
  async syncImportantGames() {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }
    this.logger.debug('Syncing important games and scores...');

    const seasons = await this.getActiveSeasons(1);
    for (let i = 0; i < seasons.length; i++) {
      const season = seasons[i];
      const x = options as any;
      x.params = {
        league: season.competition.competition_id,
        season: season.season_id,
      };

      const data = (
        await this.httpService
          .get('https://api-handball.p.rapidapi.com/games', x)
          .toPromise()
      ).data.response;

      // DIRTY FIX FOR WORLD CHAMPIONSHIP 2025 --> Games for World cup since 2021 are all combined into a single competition, so we split only the games after Jan. 1st 2025
      if (season.id == 1075) {
        const filtered_data = data.filter(
          (e) => this.moment('2025-01-01') < this.moment(e.date),
        );
        await this.syncGames(filtered_data, season);

        this.syncPoints(filtered_data);
      } else {
        await this.syncGames(data, season);

        this.syncPoints(data);
      }

      await new Promise((res) => setTimeout(res, 6000));
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
      const x = options as any;
      x.params = {
        league: season.competition.competition_id,
        season: season.season_id,
      };

      const data = (
        await this.httpService
          .get('https://api-handball.p.rapidapi.com/games', x)
          .toPromise()
      ).data.response;

      this.syncGames(data, season);
    }
  }

  @Cron('0 3 * * 1', { name: 'sync-leagues' }) // At 03:00 on Monday. => 1 time weekly (not per season)
  async syncLeagues() {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }
    const data = (
      await this.httpService
        .get('https://api-handball.p.rapidapi.com/leagues', options)
        .toPromise()
    ).data.response as any[];

    const competitionRepository = this.connection.getRepository(Competition);

    data.forEach(async (league) => {
      const db = await competitionRepository.findOne({
        where: {
          competition_id: league.id,
        },
      });

      if (!db) {
        // new league
        this.logger.debug('Adding league ' + league.name);
        const comp = new Competition();
        comp.competition_id = league.id;
        comp.name = league.name;
        comp.country = league.country.name;

        competitionRepository.save(comp);
        this.syncSeasons(comp, league.seasons);
      } else {
        // old league
        this.syncSeasons(db, league.seasons);
      }
    });
  }

  async syncSeasons(comp: Competition, season_data: any) {
    const seasonRepository = this.connection.getRepository(Season);

    season_data.forEach(
      async (season: {
        season: string;
        start: string;
        end: string;
        current: boolean;
      }) => {
        const db = await seasonRepository.findOne({
          where: {
            season_id: season.season,
            competition: comp,
          },
        });
        if (!db) {
          this.logger.debug('Adding season for ' + comp.name);
          const seas = new Season();
          seas.season_id = season.season;
          seas.name = comp.name + ' ' + season.season;
          seas.start_date = new Date(season.start + 'T00:00:00.000Z');
          seas.end_date = new Date(season.end + 'T00:00:00.000Z');
          seas.competition = comp;
          seas.current = season.current;
          seasonRepository.save(seas);
        } else {
          db.current = season.current;
          db.name = comp.name + ' ' + season.season;
          if (
            this.moment(db.end_date).add(1, 'days') <
            this.moment().startOf('day')
          ) {
            db.important = 0;
          }
          seasonRepository.save(db);
        }
      },
    );
  }

  @Cron('0 5 * * 1', { name: 'sync-teams' }) // At 05:00 on Monday. => 1 time per week per season
  async syncTeams() {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      return;
    }
    const allActiveSeasons = await this.getActiveSeasons(1);

    const teamRepository = this.connection.getRepository(Team);

    for (let i = 0; i < allActiveSeasons.length; i++) {
      const element = allActiveSeasons[i];

      const x = options as any;

      x.params = {
        league: element.competition.competition_id,
        season: element.season_id,
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
        team.short_name =
          e.name
            .split(' ')
            .filter((val: string) => {
              return (
                val.length > 2 && !/[!@#$%^&*()_+=\[\]{};':"\\|,<>?]+/.test(val)
              );
            })
            .at(-1) ?? e.name;
        const colors = this.generateColors(e.id + e.name);
        team.background_color = colors.background_color;
        team.text_color = colors.text_color;
        teamRepository.save(team);
      });

      await new Promise((res) => setTimeout(res, 6000));
    }
  }

  @Cron('0 6 * * *', { name: 'sync-current-gameday' })
  async syncCurrentGameday() {
    const allActiveSeasons = await this.getActiveSeasons(1);

    allActiveSeasons.forEach(async (season) => {
      if (season.id == 1685) {
        return;
      }
      const lastGameday = await this.getLastGameday(season);

      let currentGameday = 1;

      for (let i = 1; i <= lastGameday; i++) {
        const games = await this.connection.getRepository(Game).find({
          where: {
            season: season,
            gameday: i,
          },
        });
        let past_game_count = 0;

        games.forEach((game) => {
          if (
            this.moment(game.date).add(1, 'days') < this.moment().startOf('day')
          ) {
            // past game
            past_game_count++;
          }
        });

        // if more than 2 games are still to be played, use this gameday as current gameday
        if (past_game_count > games.length - 3) {
          // past games reached critical point
          currentGameday = Math.min(i + 1, lastGameday);
        } else {
          // first gameday that has more than 2 pending games
          currentGameday = i;
          break;
        }
      }
      if (season.current_gameday < currentGameday) {
        this.connection.getRepository(Season).update(season, {
          current_gameday: currentGameday,
        });
      }
    });
  }

  async getLastGameday(season: Season) {
    const x = await this.connection
      .getRepository(Game)
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.season', 'season')
      .select('MAX(gameday) as max')
      .where('season.id = :sid', { sid: season.id })
      .getRawOne();

    return x.max;
  }

  generateColors(id: string) {
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

  @Cron('0 4 * * *', { name: 'sync-standing' })
  async syncStanding() {
    if (this.configService.get<string>('CRON') != 'enabled') {
      this.logger.debug('Cron jobs are not enabled!');
      // return;
    }
    this.logger.debug('Syncing standings...');
    const importantSeasons = await this.getActiveSeasons(1);

    const teamRepository = this.connection.getRepository(Team);

    for (let i = 0; i < importantSeasons.length; i++) {
      const season = importantSeasons[i];
      this.logger.debug(' > for ' + season.name);

      const x = options as any;

      x.params = {
        league: season.competition.competition_id,
        season: season.season_id,
      };

      const raw_data = (
        await this.httpService
          .get('https://api-handball.p.rapidapi.com/standings', x)
          .toPromise()
      ).data.response;

      let data = raw_data[0];

      // Hot fix for European Championship
      if (['177'].includes(season.competition.competition_id)) {
        data = raw_data[1];
      }

      data.sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position,
      );

      const ranking: TeamDetails[] = [];

      for (let j = 0; j < data.length; j++) {
        const element = data[j];
        const team = await teamRepository.findOne({
          where: {
            competitor_id: element.team.id,
          },
        });
        const history = await this.generateHistory(team.id, season.id);

        const goal_stats = await this.gameService.getGoalStats(
          team.id,
          season.id,
        );

        let team_name = team.name;

        // Hot fix for European Championship
        if (
          ['177'].includes(season.competition.competition_id) &&
          element.league &&
          element.league.type == 'cup'
        ) {
          let stage = element.stage.split(' - ')[1];
          if (stage == 'Regular Season') {
            stage = 'Main Round';
          }
          team_name += ' (' + stage + ' - ' + element.group.name + ')';
        }

        ranking.push(
          new TeamDetails(
            team_name,
            team.id,
            element.position,
            element.games.win.total,
            element.games.draw.total,
            element.games.lose.total,
            goal_stats?.goals_for,
            goal_stats?.goals_against,
            goal_stats?.max_goals,
            goal_stats?.min_goals,
            goal_stats?.avg_goals,
            element.points,
            history,
          ),
        );
      }
      const dbstanding = await this.connection.getRepository(Standing).findOne({
        where: {
          season: season,
        },
      });

      const stand = new Standing();
      stand.season = season;
      stand.ranking = JSON.stringify(ranking);

      if (dbstanding) {
        this.connection.getRepository(Standing).update(dbstanding, stand);
      } else {
        this.connection.getRepository(Standing).save(stand);
      }

      this.logger.debug('    > ' + season.name + ' done');
      await new Promise((res) => setTimeout(res, 6000));
    }
  }

  async generateHistory(
    team_id: number,
    season_id: number,
  ): Promise<{
    result: string;
    scores_home_team: number[];
    scores_away_team: number[];
    other_team_name: string[];
  }> {
    const games = await this.gameRepository
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.team1', 'team1')
      .innerJoinAndSelect('game.team2', 'team2')
      .where(
        'season_id = :season_id AND (team1_id = :team_id OR team2_id = :team_id) AND completed = 1',
        {
          season_id: season_id,
          team_id: team_id,
        },
      )
      .orderBy('game.date', 'DESC')
      .limit(5)
      .getMany();

    const history_string = {
      result: '',
      scores_home_team: [],
      scores_away_team: [],
      other_team_name: [],
    };
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const team1 = team_id == game.team1.id;
      history_string.scores_home_team.push(game.score_team1);
      history_string.scores_away_team.push(game.score_team2);
      if (team1) {
        history_string.other_team_name.push(game.team2.name);
      } else {
        history_string.other_team_name.push(game.team1.name);
      }
      if (game.score_team1 > game.score_team2) {
        if (team1) {
          history_string.result += 'W';
        } else {
          history_string.result += 'L';
        }
      } else if (game.score_team1 < game.score_team2) {
        if (team1) {
          history_string.result += 'L';
        } else {
          history_string.result += 'W';
        }
      } else {
        history_string.result += 'D';
      }
    }
    return history_string;
  }
}
