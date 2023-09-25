import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Guess } from 'src/database/entities/guess.entity';
import { Connection, Repository } from 'typeorm';
import { CreateGuessDto } from 'src/dtos/create-guess.dto';
import { Game } from 'src/database/entities/game.entity';
import { Group } from 'src/database/entities/group.entity';
import { User } from 'src/database/entities/user.entity';
import { GroupService } from 'src/group/group.service';
import { Points } from 'src/database/entities/points.entity';

@Injectable()
export class GuessService {
  private moment = require('moment');

  private readonly logger = new Logger(GuessService.name);
  constructor(
    @InjectRepository(Guess)
    private guessRepository: Repository<Guess>,

    private readonly groupService: GroupService,
    private connection: Connection,
  ) {}

  async addGuess(body: CreateGuessDto, user: { username: any }) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: body.groupID },
    });
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
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
            body.team2,
        );
        const guess = new Guess();
        guess.game = await this.connection
          .getRepository(Game)
          .findOne({ where: { id: body.game } });
        guess.user = dbuser;
        guess.score_team1 = body.team1;
        guess.score_team2 = body.team2;
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
            body.team2,
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

  async getGuess(game_id: number, group_id: number, user: { username: any }) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: group_id },
    });
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
    });
    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    if (dbgroup && dbuser) {
      const el = await this.guessRepository
        .createQueryBuilder('guess')
        .innerJoinAndSelect('guess.user', 'u')
        .innerJoinAndSelect('guess.game', 'g')
        .innerJoinAndSelect('guess.group', 'group')
        .select(['guess.score_team1', 'guess.score_team2'])
        .where('g.id = :game', { game: game_id })
        .andWhere('u.id = :uid', { uid: dbuser.id })
        .andWhere('group.id = :groupID', { groupID: dbgroup.id })
        .getOne();
      const dbgame = await this.connection.getRepository(Game).findOne({
        where: {
          id: game_id,
        },
      });
      const dbpoints = await this.connection.getRepository(Points).findOne({
        where: {
          group: dbgroup,
          user: dbuser,
          game: dbgame,
        },
      });
      const result = el as any;
      if (dbpoints) {
        result.points = dbpoints.points;
      }
      return result;
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
    user: { username: any },
  ) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: group_id },
    });
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
    });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    if (!dbgroup || !dbuser) {
      throw new HttpException(
        'Your group was not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const dbgame = await this.connection.getRepository(Game).findOne({
      where: { id: game_id },
    });

    if (!dbgame) {
      throw new HttpException('Your game was not found.', HttpStatus.NOT_FOUND);
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
        'u.id',
        'u.name',
        'g.completed',
      ])
      .where('g.id = :game', { game: game_id })
      .andWhere('u.id != :uid', { uid: dbuser.id })
      .andWhere('group.id = :groupID', { groupID: dbgroup.id })
      .getMany();

    const formatted = [];

    for (let i = 0; i < guesses.length; i++) {
      const val = guesses[i];

      let guess_string: string;
      let points: string | number;

      const dbpoints = await this.connection.getRepository(Points).findOne({
        where: {
          group: dbgroup,
          user: val.user,
          game: dbgame,
        },
      });

      if (this.moment(dbgame.date) > this.moment() || dbgame.postponed) {
        // game guesses are not locked in yet
        if (val.score_team1 == 0 && val.score_team2 == 0) {
          guess_string = '-';
        } else {
          guess_string = 'hidden';
        }
      } else {
        if (val.score_team1 == 0 && val.score_team2 == 0) {
          guess_string = '-';
        } else {
          guess_string = val.score_team1 + ' : ' + val.score_team2;
        }
        if (dbpoints) {
          points = dbpoints.points;
        } else {
          points = 'N/A';
        }
      }

      const x = {
        name: val.user.name,
        guess_string: guess_string,
        points: points,
      };

      formatted.push(x);
    }
    formatted.sort((a, b) => a.name.localeCompare(b.name));
    return formatted;
  }
}
