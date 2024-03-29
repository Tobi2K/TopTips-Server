import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GuessService } from './guess.service';
import { GuessController } from './guess.controller';
import { Guess } from 'src/database/entities/guess.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from 'src/game/game.service';
import { Game } from 'src/database/entities/game.entity';
import { PointsService } from 'src/points/points.service';
import { Points } from 'src/database/entities/points.entity';
import { User } from 'src/database/entities/user.entity';
import { GroupService } from 'src/group/group.service';
import { Group } from 'src/database/entities/group.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { UsersService } from 'src/users/users.service';
import { CronService } from 'src/cron/cron.service';
import { StandingService } from 'src/standing/standing.service';
import { Standing } from 'src/database/entities/standing.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Guess,
      Game,
      Points,
      User,
      Group,
      GroupMembers,
      Standing,
    ]),
    HttpModule,
    ConfigModule,
  ],
  providers: [
    GuessService,
    GameService,
    PointsService,
    GroupService,
    UsersService,
    CronService,
    StandingService,
  ],
  controllers: [GuessController],
})
export class GuessModule {}
