import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { GuessService } from 'src/guess/guess.service';
import { Connection, Repository } from 'typeorm';

@Injectable()
export class PointsService {
    constructor(
        @InjectRepository(Points)
        private pointRepository: Repository<Points>,
        private connection: Connection,
        private readonly guessService: GuessService
    ) { }

    async getGamedayPoints(day: number) {
        const ids = await this.connection.getRepository(Game).find({
            where: { spieltag: day }
        });
        let x = [];
        for (let i = 0; i < ids.length; i++) {
            const v = await this.pointRepository.findOne({
                where: { game_id: ids[i].game_id }
            });
            x.push(v);
        };
        return this.sumPoints(x);
    }

    async getAllPoints() {
        const x = await this.pointRepository.createQueryBuilder("points").getMany();

        return this.sumPoints(x);
    }

    sumPoints(points: Points[]) {
        let pointsP1 = 0;
        let pointsP2 = 0;
        let pointsP3 = 0;
        points.forEach(p => {
            if (p != undefined) {
                pointsP1 += p.points_player1;
                pointsP2 += p.points_player2;
                pointsP3 += p.points_player3;
            }
        });
        return [pointsP1, pointsP2, pointsP3]
    }

    async calculateGamePoints(game_id: number) {
        const player1: Guess = await this.guessService.getGuess(game_id, 1);
        const player2: Guess = await this.guessService.getGuess(game_id, 2);
        const player3: Guess = await this.guessService.getGuess(game_id, 3);
        const game: Game = await this.connection.getRepository(Game).findOne({
            game_id: game_id
        });
        let pointsPlayer1 = 0;
        let pointsPlayer2 = 0;
        let pointsPlayer3 = 0;
        if (player1) pointsPlayer1 = this.calculatePoints(game, player1);
        if (player2) pointsPlayer2 = this.calculatePoints(game, player2);
        if (player3) pointsPlayer3 = this.calculatePoints(game, player3);

        const existingPoints = await this.connection.getRepository(Points).findOne({
            where: { game_id: game_id }
        });
        if (existingPoints == undefined) {
            const points = new Points;
            points.game_id = game_id;
            points.points_player1 = pointsPlayer1;
            points.points_player2 = pointsPlayer2;
            points.points_player3 = pointsPlayer3;
            return this.pointRepository.save(points);
        } else {
            return this.pointRepository.update({
                game_id: game_id
            }, {
                points_player1: pointsPlayer1,
                points_player2: pointsPlayer2,
                points_player3: pointsPlayer3
            })
        }
    }

    calculatePoints(game: Game, guess: Guess) {
        let points = 0;
        const guess_t1 = guess.score_team1;
        const guess_t2 = guess.score_team2;
        const guess_sb = guess.special_bet;

        const guess_dif = guess_t1 - guess_t2;
        const guess_winner = guess_t1 > guess_t2 ? 1 : (guess_t1 < guess_t2 ? 2 : 0);


        const actual_t1 = game.score_team1;
        const actual_t2 = game.score_team2;
        const actual_sb = game.special_bet;

        const actual_dif = actual_t1 - actual_t2;
        const actual_winner = actual_t1 > actual_t2 ? 1 : (actual_t1 < actual_t2 ? 2 : 0);

        if (guess_t1 == actual_t1) points++;
        if (guess_t2 == actual_t2) points++;
        if (guess_winner == actual_winner) points++;
        if (guess_dif == actual_dif) points++;
        if (points == 4) points++;

        if (guess_sb == actual_sb) points++;

        return points;
    }
}
