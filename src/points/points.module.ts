import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { GuessService } from 'src/guess/guess.service';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [TypeOrmModule.forFeature([Points, Game, Guess])],
  providers: [PointsService, GuessService],
  controllers: [PointsController],
})
export class PointsModule {}
