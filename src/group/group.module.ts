import { HttpModule, Module } from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from 'src/database/entities/group.entity';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/database/entities/user.entity';
import { AuthModule } from 'src/auth/auth.module';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from 'src/auth/constants';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { GameService } from 'src/game/game.service';
import { Game } from 'src/database/entities/game.entity';
import { PointsService } from 'src/points/points.service';
import { Points } from 'src/database/entities/points.entity';
import { CronService } from 'src/cron/cron.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Group, User, GroupMembers, Game, Points]),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    GroupService,
    UsersService,
    JwtStrategy,
    GameService,
    PointsService,
    CronService,
  ],
  controllers: [GroupController],
})
export class GroupModule {}
