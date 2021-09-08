import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { Game } from 'src/database/entities/game.entity';
import { PointsService } from 'src/points/points.service';
import { GuessService } from 'src/guess/guess.service';
import { Points } from 'src/database/entities/points.entity';
import { Guess } from 'src/database/entities/guess.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Points, Guess])],
  providers: [GameService, PointsService, GuessService],
  controllers: [GameController]
})
export class GameModule { }
