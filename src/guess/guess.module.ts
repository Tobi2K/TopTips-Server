import { Module } from '@nestjs/common';
import { GuessService } from './guess.service';
import { GuessController } from './guess.controller';
import { Guess } from 'src/database/entities/guess.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from 'src/game/game.service';
import { Game } from 'src/database/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guess, Game])],
  providers: [GuessService, GameService],
  controllers: [GuessController]
})
export class GuessModule { }
