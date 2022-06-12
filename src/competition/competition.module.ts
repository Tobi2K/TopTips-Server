import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Competition } from 'src/database/entities/competition.entity';
import { Season } from 'src/database/entities/season.entity';
import { CompetitionController } from './competition.controller';
import { CompetitionService } from './competition.service';

@Module({
  imports: [TypeOrmModule.forFeature([Competition, Season])],
  controllers: [CompetitionController],
  providers: [CompetitionService],
})
export class CompetitionModule {}
