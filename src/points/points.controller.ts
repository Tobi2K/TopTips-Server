import { Controller, Get, Param } from '@nestjs/common';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
    constructor(
        private readonly pointsService: PointsService,
    ) { }

    @Get('day/:id')
    getGameday(@Param('id') id: number) {
        return this.pointsService.getGamedayPoints(id);
    }

    @Get('all')
    getAllPoints() {
        return this.pointsService.getAllPoints();
    }
}
