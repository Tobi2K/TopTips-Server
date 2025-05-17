import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Group } from 'src/database/entities/group.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { User } from 'src/database/entities/user.entity';
import { Team } from 'src/database/entities/team.entity';
import { Standing } from 'src/database/entities/standing.entity';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { GameService } from 'src/game/game.service';
import { PointsService } from 'src/points/points.service';
import { GuessService } from 'src/guess/guess.service';
import { GroupService } from 'src/group/group.service';
import { UsersService } from 'src/users/users.service';
import { CronService } from 'src/cron/cron.service';
import { StandingService } from 'src/standing/standing.service';
import { Points } from 'src/database/entities/points.entity';
import { EmailService } from './email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Game,
      Guess,
      Group,
      GroupMembers,
      User,
      Team,
      Standing,
      Points,
    ]),
    HttpModule,
    ConfigModule,
  ],
  providers: [
    EmailService,
    GameService,
    PointsService,
    GuessService,
    GroupService,
    UsersService,
    CronService,
    StandingService,
  ],
  controllers: [EmailController],
})
export class EmailModule {}
