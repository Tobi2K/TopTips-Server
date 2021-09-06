import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Connection, In, Repository } from 'typeorm';
import { GameService } from 'src/game/game.service';
import { CreateGuessDto } from 'src/dtos/create-guess.dto';
import { GetGuessDto } from 'src/dtos/get-guess.dto';

@Injectable()
export class GuessService {
    constructor(
        @InjectRepository(Guess)
        private guessRepository: Repository<Guess>,
        private gameService: GameService,
        private connection: Connection
    ) { }

    async getGameday(day: number) {
        const ids = await this.gameService.getGameday(day);
        let x = [];
        for (let index = 0; index < ids.length; index++) {
            const element = ids[index].game_id;
            x.push(element)
        }
        return this.guessRepository.createQueryBuilder("game").leftJoin('game.game_id', 'guess').where('game.game_id = guess.game_id', { id: day }).getMany();
    }

    async addGuess(body: CreateGuessDto) {
        const existingGuess = await this.connection.getRepository(Guess).findOne({
            where: { game_id: body.game, user_id: body.user }
        });
        if (existingGuess == undefined) {
            const guess = new Guess;
            guess.game_id = body.game;
            guess.user_id = body.user;
            guess.score_team1 = body.team1;
            guess.score_team2 = body.team2;
            guess.special_bet = body.bet;
            return this.guessRepository.save(guess);
        } else { // update 
            return await this.guessRepository.update({
                game_id: body.game, user_id: body.user
            }, {
                score_team1: body.team1,
                score_team2: body.team2,
                special_bet: body.bet
            })
        }
    }

    async getGuess(id, user) {
        return await this.connection.getRepository(Guess).findOne({
            where: { game_id: id, user_id: user }
        });
    }

    async getAllGuesses() {
        return await this.guessRepository.createQueryBuilder("game").getMany();
    }
}
