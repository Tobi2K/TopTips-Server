import { Controller, Get, Param, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionService } from './competition.service';

@Controller('competition')
@ApiBearerAuth('access-token')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get('country/:country')
  getCompetitionsForCountry(@Param('country') country: string) {
    return this.competitionService.getCompetitionsForCountry(country);
  }

  @Get('user')
  getSeasonsByUser(@Request() req) {
    return this.competitionService.getSeasonsByUser(req.user);
  }

  @Get('seasons/:competition_id')
  getSeasonsForCompetition(@Param('competition_id') competition_id: string) {
    return this.competitionService.getSeasonsForCompetition(competition_id);
  }

  @Get('season/:season_id')
  getSingleSeason(@Param('season_id') season_id: number) {
    return this.competitionService.getSingleSeason(season_id);
  }

  @Get('current/:group_id')
  getCurrentSection(@Param('group_id') group_id: number) {
    return this.competitionService.getCurrentSection(group_id);
  }

  @Get('current/month/:group_id')
  getCurrentMonthSection(@Param('group_id') group_id: number) {
    return this.competitionService.getCurrentMonthSection(group_id);
  }

  @Get('countries')
  async getCountries() {
    return await this.competitionService.getCountries();
  }
}
