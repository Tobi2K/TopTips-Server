import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { CreateGuessDto } from 'src/dtos/create-guess.dto';
import { GuessService } from './guess.service';

@Controller('guess')
export class GuessController {
  constructor(private readonly guessService: GuessService) {}

  @Get('day/:id')
  getGameday(@Param('id') id: number) {
    return this.guessService.getGameday(id);
  }

  @Post('add')
  async addGuess(@Body() body: CreateGuessDto) {
    return this.guessService.addGuess(body);
  }

  @Get('game/:id/:user')
  getGuess(@Param('id') id: number, @Param('user') user: number) {
    return this.guessService.getGuess(id, user);
  }

  @Get()
  getAllGuesses() {
    return this.guessService.getAllGuesses();
  }
}
