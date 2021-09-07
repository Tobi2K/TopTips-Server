import {
    Injectable
} from '@nestjs/common';
import {
    InjectRepository
} from '@nestjs/typeorm';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';
import {
    Repository,
    Connection
} from 'typeorm';
import {
    Game
} from '../database/entities/game.entity';

@Injectable()
export class GameService {
    constructor(
        @InjectRepository(Game) private gameRepository: Repository<Game>
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
        //const count = await this.gameRepository.createQueryBuilder("game").where("game.spieltag = :day", { day: body.gameday }).getCount();
        game.special_bet_id = Math.floor(Math.random() * (8 + 1));;
        this.gameRepository.save(game)
    }

    async deleteGame(id: number) {
        return this.gameRepository.remove(await this.gameRepository.createQueryBuilder("game").where("game.game_id = :id", { id }).getOne());
    }

    async updateGame(body: UpdateGameDto, id: number) {
        return await this.gameRepository.update({
            game_id: id,
        }, {
            score_team1: body.team1,
            score_team2: body.team2,
            special_bet: body.bet
        })
    }
}