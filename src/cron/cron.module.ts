import { HttpModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { GameService } from 'src/game/game.service';
import { GuessService } from 'src/guess/guess.service';
import { PointsService } from 'src/points/points.service';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Points, Guess]), HttpModule],
  providers: [GameService, CronService, PointsService, GuessService],
  controllers: [CronController],
})
export class CronModule {}
