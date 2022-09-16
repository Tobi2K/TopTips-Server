import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from 'src/cron/cron.service';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { Standing } from 'src/database/entities/standing.entity';
import { GroupService } from 'src/group/group.service';
import { UsersService } from 'src/users/users.service';
import { StandingController } from './standing.controller';
import { StandingService } from './standing.service';
import { User } from 'src/database/entities/user.entity';
import { Game } from 'src/database/entities/game.entity';
import { GameService } from 'src/game/game.service';
import { PointsService } from 'src/points/points.service';
import { Points } from 'src/database/entities/points.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Standing,
      Group,
      GroupMembers,
      User,
      Game,
      Points,
    ]),
    HttpModule,
    ConfigModule,
  ],
  providers: [
    StandingService,
    GroupService,
    UsersService,
    CronService,
    GameService,
    PointsService,
  ],
  controllers: [StandingController],
})
export class StandingModule {}
