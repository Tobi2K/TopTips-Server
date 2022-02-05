import { Controller, Get, Param, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PointsService } from './points.service';

@Controller('points')
@ApiBearerAuth('access-token')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('all/format/:groupID')
  getPointsFormatted(@Param('groupID') groupID: number, @Request() req) {
    return this.pointsService.getPointsFormatted(groupID, req.user);
  }

  @Get('calculate/:game_id')
  calculate(@Param('game_id') game_id: number) {
    return this.pointsService.calculateGamePoints(game_id);
  }
}
