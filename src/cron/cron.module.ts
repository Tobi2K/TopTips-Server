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

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Points, Guess, GroupMembers, Group, User]),
    HttpModule,
    GameModule,
  ],
  providers: [
    GameService,
    CronService,
    PointsService,
    GuessService,
    GroupService,
    UsersService,
  ],
  controllers: [CronController],
})
export class CronModule {}
