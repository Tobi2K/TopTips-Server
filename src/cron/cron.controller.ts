import { Controller, Get } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('cron')
export class CronController {
    constructor(
        private readonly cronService: CronService
    ) { }

    @Get('sync/games')
    syncGames() {
        return this.cronService.syncGames();
    }

    @Get('sync/score')
    syncScores() {
        return this.cronService.syncScores();
    }
}
