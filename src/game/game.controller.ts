import { Controller, Get, Param, Request } from '@nestjs/common';
import { GameService } from './game.service';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('game')
@ApiBearerAuth('access-token')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('all/format/:group_id')
  getAllGamesFormatted(@Param('group_id') group_id: number, @Request() req) {
    return this.gameService.getAllGamesFormatted(group_id, req.user);
  }
}
