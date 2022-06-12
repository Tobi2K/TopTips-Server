import { HttpModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from 'src/cron/cron.service';
import { Game } from 'src/database/entities/game.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { User } from 'src/database/entities/user.entity';
import { GameService } from 'src/game/game.service';
import { GroupService } from 'src/group/group.service';
import { GuessService } from 'src/guess/guess.service';
import { UsersService } from 'src/users/users.service';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Points, Game, Guess, Group, GroupMembers, User]),
    HttpModule,
  ],
  providers: [
    PointsService,
    GuessService,
    GameService,
    GroupService,
    UsersService,
    CronService,
  ],
  controllers: [PointsController],
})
export class PointsModule {}
