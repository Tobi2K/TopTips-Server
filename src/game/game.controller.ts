import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GameService } from './game.service';
import { Game } from 'src/database/entities/game.entity';
import { CreateGameDto } from 'src/dtos/create-game.dto';
import { UpdateGameDto } from 'src/dtos/update-game.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('day/:id')
  getGameday(@Param('id') id: number): Promise<Game[]> {
    return this.gameService.getGameday(id);
  }

  @Get('all')
  getAllGames() {
    return this.gameService.getAllGames();
  }

  @Post('add')
  async addGame(@Body() body: CreateGameDto) {
    return this.gameService.addGame(body);
  }

  @Post('delete/:id')
  async deleteGame(@Param('id') id: number) {
    return this.gameService.deleteGame(id);
  }

  @Post('update/:id')
  async updateGame(@Param('id') id: number, @Body() body: UpdateGameDto) {
    return this.gameService.updateGame(body, id);
  }
}
