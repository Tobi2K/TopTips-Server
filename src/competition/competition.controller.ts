import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionService } from './competition.service';

@Controller('competition')
@ApiBearerAuth('access-token')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get('all')
  getAllCompetitions() {
    return this.competitionService.getAllCompetitions();
  }

  @Get('seasons/:competition_id')
  getSeasonsForCompetition(@Param('competition_id') competition_id: string) {
    return this.competitionService.getSeasonsForCompetition(competition_id);
  }
  @Get('season/:season_id')
  getSingleSeason(@Param('season_id') season_id: string) {
    return this.competitionService.getSingleSeason(season_id);
  }
}
