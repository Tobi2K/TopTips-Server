import { Module } from '@nestjs/common';
import { GuessService } from './guess.service';
import { GuessController } from './guess.controller';
import { Guess } from 'src/database/entities/guess.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from 'src/game/game.service';
import { Game } from 'src/database/entities/game.entity';
import { PointsService } from 'src/points/points.service';
import { Points } from 'src/database/entities/points.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guess, Game, Points])],
  providers: [GuessService, GameService, PointsService],
  controllers: [GuessController]
})
export class GuessModule { }
