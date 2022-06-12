import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { Game } from 'src/database/entities/game.entity';
import { PointsService } from 'src/points/points.service';
import { GuessService } from 'src/guess/guess.service';
import { Points } from 'src/database/entities/points.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { GroupService } from 'src/group/group.service';
import { Group } from 'src/database/entities/group.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { UsersService } from 'src/users/users.service';
import { CronService } from 'src/cron/cron.service';
import { User } from 'src/database/entities/user.entity';
import { Team } from 'src/database/entities/team.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Game,
      Points,
      Guess,
      Group,
      GroupMembers,
      User,
      Team,
    ]),
    HttpModule,
  ],
  providers: [
    GameService,
    PointsService,
    GuessService,
    GroupService,
    UsersService,
    CronService,
  ],
  controllers: [GameController],
})
export class GameModule {}
