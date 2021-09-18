import {
    Injectable,
    Logger
} from '@nestjs/common';
import {
    InjectRepository
} from '@nestjs/typeorm';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import { PointsService } from 'src/points/points.service';
import {
    Connection,
    Repository
} from 'typeorm';
import {
    Game
} from '../database/entities/game.entity';

@Injectable()
export class GameService {
    private readonly logger = new Logger(GameService.name);
    constructor(
        @InjectRepository(Game) private gameRepository: Repository<Game>,
        private connection: Connection,
        private readonly pointsService: PointsService
    ) { }

    getGameday(day: number): Promise<Game[]> {
        return this.gameRepository.createQueryBuilder("game").where("game.spieltag = :day", {
            day
        }).orderBy("game.date").getMany();
    }

    async getAllGames() {
        const games = [];
        for (let i = 1; i < 35; i++) {
            games.push(await this.getGameday(i));
        }
        return games;
    }

    async addGame(body: CreateGameDto) {
        const game = new Game;
        game.spieltag = body.gameday;
        game.event_id = body.eventID;
        game.date = body.date;
        game.team1_id = body.team1;
        game.team2_id = body.team2;
        game.special_bet_id = Math.floor(Math.random() * (7 + 1));
        const x = await this.gameRepository.save(game);

        this.logger.debug("Adding game with id: " + x.game_id);
    }

    async deleteGame(id: number) {
        this.logger.debug("Deleting game with id: " + id);
        const pointRepository = this.connection.getRepository(Points);
        pointRepository.remove(
            await pointRepository.find({
                where: { game_id: id }
            })
        );
        const guessRepository = this.connection.getRepository(Guess);
        guessRepository.remove(
            await guessRepository.find({
                where: { game_id: id }
            })
        )
        return this.gameRepository.remove(await this.gameRepository.createQueryBuilder("game").where("game.game_id = :id", { id }).getOne());
    }

    async updateGame(body: UpdateGameDto, id: number) {
        this.logger.debug("Updating game with id: " + id)
        await this.gameRepository.update({
            game_id: id,
            completed: 0
        }, {
            score_team1: body.team1,
            score_team2: body.team2,
            special_bet: body.bet,
            completed: 1
        })
        this.pointsService.calculateGamePoints(id);
    }

    async updateGameDate(id: number, date: Date) {
        await this.gameRepository.update({
            game_id: id,
            completed: 0
        }, {
            date: date
        })
    }
}