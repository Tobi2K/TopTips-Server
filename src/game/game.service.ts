import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from 'src/database/entities/group.entity';
import { SpecialBet } from 'src/database/entities/special-bet.entity';
import { User } from 'src/database/entities/user.entity';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import { GroupService } from 'src/group/group.service';
import { PointsService } from 'src/points/points.service';
import { Connection, Repository } from 'typeorm';
import { Game } from '../database/entities/game.entity';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  constructor(
    @InjectRepository(Game) private gameRepository: Repository<Game>,
    private connection: Connection,
    private readonly pointsService: PointsService,

    private readonly groupService: GroupService,
  ) {}

  async getAllGamesFormatted(group_id: number, user: { email: any }) {
    const dbgroup = await this.connection
      .getRepository(Group)
      .findOne({ where: { id: group_id } });

    const dbuser = await this.connection
      .getRepository(User)
      .findOne({ where: { email: user.email } });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    const dbseason = dbgroup.season;

    const gameDays = await this.connection
      .getRepository(Game)
      .createQueryBuilder('game')
      .innerJoinAndSelect('game.season', 's')
      .select('game.spieltag')
      .addSelect('s')
      .addSelect('game.stage')
      .where('s.season_id = :sid', { sid: dbseason.season_id })
      .groupBy('spieltag')
      .getMany();

    gameDays.sort((a, b) => {
      if (a.spieltag == -1) return -1;

      if (b.spieltag == -1) return -1;

      return a.spieltag - b.spieltag;
    });

    const games = [];
    for (let i = 1; i < gameDays.length; i++) {
      games.push(await this.getGamedayFormatted(gameDays[i]));
    }
    return games;
  }

  async getGamedayFormatted(day: Game) {
    const games = await this.gameRepository.find({
      where: { spieltag: day.spieltag, season: day.season },
      order: { date: 'ASC' },
    });

    const special = day.spieltag == -1;

    const formatted = [];

    games.forEach(function (val) {
      let bet_string: string;
      let game_string: string;
      if (val.completed == 1) {
        game_string = val.score_team1 + ' : ' + val.score_team2;
        bet_string = val.special_bet.bet_desc + ': ' + val.special_bet_result;
      } else {
        game_string = '-';
        bet_string = val.special_bet.bet_desc;
      }
      let x = {
        id: val.id,
        date: val.date,
        date_string: new Date(val.date).toLocaleString('de-DE', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        }),
        team1_id: val.team1.id,
        team2_id: val.team2.id,
        team1_name: val.team1.name,
        team2_name: val.team2.name,
        bet_name: val.special_bet.bet_desc,
        bet_string: bet_string,
        game_string: game_string,
        game_desc: val.stage,
      };

      formatted.push(x);
    });

    return { games: formatted, special: special };
  }

  async addGame(body: CreateGameDto) {
    const game = new Game();
    game.spieltag = body.gameday;
    game.stage = body.stage;
    game.event_id = body.eventID;
    game.date = body.date;
    game.team1 = body.team1;
    game.team2 = body.team2;
    game.season = body.season;
    const bet = this.connection.getRepository(SpecialBet).findOne({
      id: Math.floor(Math.random() * (7 + 1)),
    });
    game.special_bet = await bet;
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
        special_bet_result: body.bet,
        completed: 1,
      },
    );
    this.pointsService.calculateGamePoints(id);
  }

  async updateGameDate(id: number, date: Date) {
    this.logger.debug('Updating game date for id: ' + id);

    await this.gameRepository.update(
      {
        id: id,
      },
      {
        date: date,
      },
    );
  }
}
