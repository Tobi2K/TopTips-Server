import { Body, Controller, Get, Post, Param, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateGuessDto } from 'src/dtos/create-guess.dto';
import { UserDto } from 'src/dtos/user.dto';
import { GuessService } from './guess.service';

@Controller('guess')
@ApiBearerAuth('access-token')
export class GuessController {
  constructor(private readonly guessService: GuessService) {}

  @Post('add')
  async addGuess(@Body() body: CreateGuessDto, @Request() req) {
    return this.guessService.addGuess(body, req.user);
  }

  @Get('game/:game_id/:group_id')
  getGuess(
    @Param('game_id') game_id: number,
    @Param('group_id') group_id: number,
    @Request() req,
  ) {
    return this.guessService.getGuess(game_id, group_id, req.user);
  }

  @Get('all/:game_id/:group_id')
  getAllGuessesForGame(
    @Param('game_id') game_id: number,
    @Param('group_id') group_id: number,
    @Request() req,
  ) {
    return this.guessService.getAllGroupGuessesForGame(
      game_id,
      group_id,
      req.user,
    );
  }
}
