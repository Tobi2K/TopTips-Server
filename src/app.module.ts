import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './database/entities/user.entity';
import { UsersModule } from './users/users.module';
import { Game } from './database/entities/game.entity';
import { GameModule } from './game/game.module';
import { SpecialBet } from './database/entities/special-bet.entity';
import { Team } from './database/entities/team.entity';
import { GuessModule } from './guess/guess.module';
import { Guess } from './database/entities/guess.entity';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PointsModule } from './points/points.module';
import { Points } from './database/entities/points.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { Group } from './database/entities/group.entity';
import { GroupMembers } from './database/entities/group-members.entity';
import { GroupModule } from './group/group.module';
import { Competition } from './database/entities/competition.entity';
import { ConfigModule } from '@nestjs/config';
import { Season } from './database/entities/season.entity';
import { CompetitionModule } from './competition/competition.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'root',
      database: 'tippspiel_test',
      entities: [
        User,
        Game,
        Guess,
        SpecialBet,
        Team,
        Points,
        Group,
        GroupMembers,
        Competition,
        Season,
      ],
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: true,
    }),
    UsersModule,
    GameModule,
    GuessModule,
    PointsModule,
    CronModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    AuthModule,
    GroupModule,
    CompetitionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
