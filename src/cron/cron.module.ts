import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { User } from 'src/database/entities/user.entity';
import { GameModule } from 'src/game/game.module';
import { GameService } from 'src/game/game.service';
import { GroupService } from 'src/group/group.service';
import { GuessService } from 'src/guess/guess.service';
import { PointsService } from 'src/points/points.service';
import { UsersService } from 'src/users/users.service';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';
import { StandingService } from 'src/standing/standing.service';
import { Standing } from 'src/database/entities/standing.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Game,
      Points,
      Guess,
      GroupMembers,
      Group,
      User,
      Standing,
    ]),
    HttpModule,
    GameModule,
    ConfigModule,
  ],
  providers: [
    GameService,
    CronService,
    PointsService,
    GuessService,
    GroupService,
    UsersService,
    StandingService,
  ],
  controllers: [CronController],
})
export class CronModule {}
