import { Controller, Get } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get('sync/games')
  syncGames() {
    return this.cronService.syncGames();
  }

  @Get('sync/score')
  syncScores() {
    return this.cronService.syncScores();
  }

  @Get('sync/dates')
  syncDate() {
    return this.cronService.syncDates();
  }

  @Get('sync/scores')
  resyncScores() {
    return this.cronService.updateAllScores();
  }

  @Get('notify')
  handleNotifications() {
    return this.cronService.handleNotifications();
  }
}
