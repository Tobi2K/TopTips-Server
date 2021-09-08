import { Controller, Get, Param } from '@nestjs/common';
import { Points } from 'src/database/entities/points.entity';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
    constructor(
        private readonly pointsService: PointsService,
    ) { }

    @Get('day/:id')
    getGameday(@Param('id') id: number): Promise<Points[]> {
        return this.pointsService.getGamedayPoints(id);
    }

    @Get('all')
    getAllPoints(): Promise<Points[]> {
        return this.pointsService.getAllPoints();
    }
}
