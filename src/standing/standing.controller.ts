import { Controller, Get, Param, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { StandingService } from './standing.service';

@Controller('standing')
@ApiBearerAuth('access-token')
export class StandingController {
  constructor(private readonly standingService: StandingService) {}

  @Get(':group_id')
  getStanding(@Param('group_id') group_id: number, @Request() req) {
    return this.standingService.getStanding(group_id, req.user);
  }

  @Get('team/:season_id/:team_id')
  getTeamPositionAndHistory(
    @Param('season_id') season_id: number,
    @Param('team_id') team_id: number,
  ) {
    return this.standingService.getTeamStats(season_id, team_id);
  }
}
