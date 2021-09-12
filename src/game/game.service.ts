import {
    Injectable,
    Logger
} from '@nestjs/common';
import {
    InjectRepository
} from '@nestjs/typeorm';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import { PointsService } from 'src/points/points.service';
import {
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
        private readonly pointsService: PointsService
    ) { }

    getGameday(day: number): Promise<Game[]> {
        return this.gameRepository.createQueryBuilder("game").where("game.spieltag = :day", {
            day
        }).orderBy("game.date").getMany();
    }

    async addGame(body: CreateGameDto) {
        const game = new Game;
        game.spieltag = body.gameday;
        game.date = body.date;
        game.team1_id = body.team1;
        game.team2_id = body.team2;
        game.special_bet_id = Math.floor(Math.random() * (8 + 1));
        const x = await this.gameRepository.save(game);

        this.logger.debug("Adding game with id: " + x.game_id);
    }

    async deleteGame(id: number) {
        this.logger.debug("Deleting game with id: " + id);
        return this.gameRepository.remove(await this.gameRepository.createQueryBuilder("game").where("game.game_id = :id", { id }).getOne());
    }

    async updateGame(body: UpdateGameDto, id: number) {
        this.logger.debug("Updating game with id: " + id)
        await this.gameRepository.update({
            game_id: id,
        }, {
            score_team1: body.team1,
            score_team2: body.team2,
            special_bet: body.bet
        })
        this.pointsService.calculateGamePoints(id);
    }
}