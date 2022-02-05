import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Competition } from 'src/database/entities/competition.entity';
import { Season } from 'src/database/entities/season.entity';
import { Connection, Repository } from 'typeorm';

@Injectable()
export class CompetitionService {
  private readonly logger = new Logger(CompetitionService.name);
  constructor(
    @InjectRepository(Competition)
    private competitionRepository: Repository<Competition>,
    @InjectRepository(Season)
    private seasonRepository: Repository<Season>,
  ) {}
  async getAllCompetitions() {
    return (await this.competitionRepository.find()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async getSeasonsForCompetition(competition_id: string) {
    const dbcompetition = await this.competitionRepository.findOne({
      where: { competition_id: competition_id },
    });
    if (dbcompetition) {
      return (
        await this.seasonRepository.find({
          where: { competition: dbcompetition },
        })
      ).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      throw new HttpException(
        'The requested competition was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
  async getSingleSeason(season_id: string) {
    const dbseason = await this.seasonRepository.findOne({
      where: { season_id: season_id },
    });
    if (dbseason) {
      return dbseason;
    } else {
      throw new HttpException(
        'The requested season was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
