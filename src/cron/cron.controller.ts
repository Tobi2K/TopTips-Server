import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Season } from 'src/database/entities/season.entity';
import { Connection } from 'typeorm';
import { CronService } from './cron.service';

@Controller('cron')
@ApiBearerAuth('access-token')
export class CronController {
  constructor(
    private readonly cronService: CronService,
    private readonly connection: Connection,
  ) {}

  @Get('sync/games/primary')
  syncImportantGames() {
    return this.cronService.syncImportantGames();
  }

  @Get('sync/games/secondary')
  syncUnimportantGames() {
    return this.cronService.syncUnimportantGames();
  }

  @Get('notify')
  handleNotifications() {
    return this.cronService.handleNotifications();
  }

  @Get('sync/leagues')
  syncLeagues() {
    return this.cronService.syncLeagues();
  }

  @Get('sync/seasons')
  syncSeasons() {
    return this.cronService.syncSeasons();
  }

  @Get('sync/seasons/:season_id')
  async syncSingleSeason(@Param('season_id') season_id: string) {
    const season = await this.connection
      .getRepository(Season)
      .findOne({ where: { season_id: season_id } });

    return this.cronService.syncGamesForNewGroup(season);
  }

  @Get('sync/teams')
  syncTeams() {
    return this.cronService.syncTeams();
  }

  @Get('sync/currentGameday')
  syncCurrentGameday() {
    return this.cronService.syncCurrentGameday();
  }
}
