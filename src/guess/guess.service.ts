import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Guess } from 'src/database/entities/guess.entity';
import { Connection, Repository } from 'typeorm';
import { CreateGuessDto } from 'src/dtos/create-guess.dto';

@Injectable()
export class GuessService {
  private readonly logger = new Logger(GuessService.name);
  constructor(
    @InjectRepository(Guess)
    private guessRepository: Repository<Guess>,
    private connection: Connection,
  ) {}

  async getGameday(day: number) {
    return this.guessRepository
      .createQueryBuilder('game')
      .leftJoin('game.game_id', 'guess')
      .where('game.game_id = guess.game_id', { id: day })
      .getMany();
  }

  async addGuess(body: CreateGuessDto) {
    const existingGuess = await this.connection.getRepository(Guess).findOne({
      where: { game_id: body.game, user_id: body.user },
    });
    if (existingGuess == undefined) {
      this.logger.debug(
        'Adding guess with: playerID: ' +
          body.user +
          ',  gameID: ' +
          body.game +
          ', result: ' +
          body.team1 +
          ' - ' +
          body.team2 +
          ', ' +
          body.bet,
      );
      const guess = new Guess();
      guess.game_id = body.game;
      guess.user_id = body.user;
      guess.score_team1 = body.team1;
      guess.score_team2 = body.team2;
      guess.special_bet = body.bet;
      return this.guessRepository.save(guess);
    } else {
      // update
      this.logger.debug(
        'Updating guess with: playerID: ' +
          body.user +
          ',  gameID: ' +
          body.game +
          ', result: ' +
          body.team1 +
          ' - ' +
          body.team2 +
          ', ' +
          body.bet,
      );
      return await this.guessRepository.update(
        {
          game_id: body.game,
          user_id: body.user,
        },
        {
          score_team1: body.team1,
          score_team2: body.team2,
          special_bet: body.bet,
        },
      );
    }
  }

  async getGuess(id, user) {
    return await this.connection.getRepository(Guess).findOne({
      where: { game_id: id, user_id: user },
    });
  }

  async getAllGuesses() {
    return await this.guessRepository.createQueryBuilder('guess').getMany();
  }
}
