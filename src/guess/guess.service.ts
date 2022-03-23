import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Guess } from 'src/database/entities/guess.entity';
import { Connection, Repository } from 'typeorm';
import { CreateGuessDto } from 'src/dtos/create-guess.dto';
import { Game } from 'src/database/entities/game.entity';
import { Group } from 'src/database/entities/group.entity';
import { User } from 'src/database/entities/user.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { GroupService } from 'src/group/group.service';

var moment = require('moment');

@Injectable()
export class GuessService {
  private readonly logger = new Logger(GuessService.name);
  constructor(
    @InjectRepository(Guess)
    private guessRepository: Repository<Guess>,

    private readonly groupService: GroupService,
    private connection: Connection,
  ) {}

  async addGuess(body: CreateGuessDto, user: { email: any }) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: body.groupID },
    });
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { email: user.email },
    });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    const dbgame = await this.connection.getRepository(Game).findOne({
      where: { id: body.game },
    });
    if (dbgroup && dbuser && dbgame) {
      const existingGuess = await this.connection.getRepository(Guess).findOne({
        where: { game: dbgame, user: dbuser, group: dbgroup },
      });
      if (existingGuess == undefined) {
        this.logger.debug(
          'Adding guess with: playerID: ' +
            dbuser.id +
            ',  gameID: ' +
            body.game +
            ', groupID:' +
            body.groupID +
            ', result: ' +
            body.team1 +
            ' - ' +
            body.team2 +
            ', ' +
            body.bet,
        );
        const guess = new Guess();
        guess.game = await this.connection
          .getRepository(Game)
          .findOne({ where: { id: body.game } });
        guess.user = dbuser;
        guess.score_team1 = body.team1;
        guess.score_team2 = body.team2;
        guess.special_bet = body.bet;
        guess.group = dbgroup;
        await this.guessRepository.save(guess);
        return 'Guess added successfully';
      } else {
        // update
        this.logger.debug(
          'Updating guess with: playerID: ' +
            dbuser.id +
            ',  gameID: ' +
            body.game +
            ', groupID:' +
            body.groupID +
            ', result: ' +
            body.team1 +
            ' - ' +
            body.team2 +
            ', ' +
            body.bet,
        );
        await this.guessRepository.update(
          {
            game: await this.connection
              .getRepository(Game)
              .findOne({ where: { id: body.game } }),
            user: dbuser,
            group: dbgroup,
          },
          {
            score_team1: body.team1,
            score_team2: body.team2,
            special_bet: body.bet,
          },
        );
        return 'Guess updated successfully';
      }
    } else {
      throw new HttpException(
        'Your group was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getGuess(game_id: number, group_id: number, user: { email: any }) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: group_id },
    });
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { email: user.email },
    });
    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    if (dbgroup && dbuser) {
      return this.guessRepository
        .createQueryBuilder('guess')
        .innerJoinAndSelect('guess.user', 'u')
        .innerJoinAndSelect('guess.game', 'g')
        .innerJoinAndSelect('guess.group', 'group')
        .select(['guess.score_team1', 'guess.score_team2', 'guess.special_bet'])
        .where('g.id = :game', { game: game_id })
        .andWhere('u.id = :uid', { uid: dbuser.id })
        .andWhere('group.id = :groupID', { groupID: dbgroup.id })
        .getOne();
    } else {
      throw new HttpException(
        'Your group was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getAllGroupGuessesForGame(
    game_id: number,
    group_id: number,
    user: { email: any },
  ) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: group_id },
    });
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { email: user.email },
    });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    if (!dbgroup || !dbuser) {
      throw new HttpException(
        'Your group was not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const dbgame = await this.connection.getRepository(Game).findOne({
      where: { id: game_id }
    })

    if (!dbgame) {
      throw new HttpException(
        'Your game was not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const guesses = await this.guessRepository
      .createQueryBuilder('guess')
      .innerJoinAndSelect('guess.user', 'u')
      .innerJoinAndSelect('guess.game', 'g')
      .innerJoinAndSelect('guess.group', 'group')
      .select([
        'guess.id',
        'guess.score_team1',
        'guess.score_team2',
        'guess.special_bet',
        'u.id',
        'u.name',
        'g.completed',
      ])
      .where('g.id = :game', { game: game_id })
      .andWhere('u.id != :uid', { uid: dbuser.id })
      .andWhere('group.id = :groupID', { groupID: dbgroup.id })
      .getMany();

    const formatted = [];

    guesses.forEach((val) => {
      let guess_string;
      let bet;

      if (moment(dbgame.date) > moment()) { // game guesses are not locked in yet
        if (val.score_team1 == 0 && val.score_team2 == 0) {
          guess_string = '-';
          bet = '-';
        } else {
          guess_string = 'hidden';
          bet = '?';
        }
        
      } else {
        if (val.game.completed == 1) {
          if (val.score_team1 == 0 && val.score_team2 == 0) {
            guess_string = '-';
            bet = '-';
          } else {
            guess_string = val.score_team1 + ' : ' + val.score_team2;
            bet = val.special_bet;
          }
        } else {
          guess_string = '-';
          bet = '-';
        }
      }
      

      let x = {
        name: val.user.name,
        guess_string: guess_string,
        bet: bet,
      };

      formatted.push(x);
    });
    return formatted;
  }
}
