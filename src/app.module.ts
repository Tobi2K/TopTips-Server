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
import { CronService } from './cron/cron.service';
import { SectionController } from './section/section.controller';
import { SectionModule } from './section/section.module';
import { Section } from './database/entities/section.entity';


@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'root',
      database: 'tippspiel',
      entities: [User, Game, Guess, SpecialBet, Team, Points, Section],
      namingStrategy: new SnakeNamingStrategy()
    }),
    UsersModule,
    GameModule,
    GuessModule,
    PointsModule,
    SectionModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, CronService],
})
export class AppModule { }
