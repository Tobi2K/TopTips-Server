import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Competition } from 'src/database/entities/competition.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { Group } from 'src/database/entities/group.entity';
import { Season } from 'src/database/entities/season.entity';
import { User } from 'src/database/entities/user.entity';
import { Connection, Repository } from 'typeorm';

@Injectable()
export class CompetitionService {
  constructor(
    @InjectRepository(Competition)
    private competitionRepository: Repository<Competition>,
    @InjectRepository(Season)
    private seasonRepository: Repository<Season>,
    private connection: Connection,
  ) {}
  async getCompetitionsForCountry(country: string) {
    return await this.competitionRepository.find({
      where: { country: country },
    });
  }

  async getSeasonsForCompetition(competition_id: string) {
    const dbcompetition = await this.competitionRepository.findOne({
      where: { competition_id: competition_id },
    });
    if (dbcompetition) {
      return (
        await this.seasonRepository.find({
          where: { competition: dbcompetition, current: true },
        })
      ).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      throw new HttpException(
        'The requested competition was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getSeasonsByUser(user: { username: any }) {
    const dbuser = await this.connection
      .getRepository(User)
      .findOne({ where: { name: user.username } });

    if (dbuser) {
      const dbgroupmemberships = await this.connection
        .getRepository(GroupMembers)
        .find({
          where: {
            user: dbuser,
          }
        });

      const seasonArray: Season[] = [];
      const groupIDArray: number[] = [];

      const unimportantSeasons = await this.getActiveSeasons(0);
      const importantSeasons = await this.getActiveSeasons(1);
      const allActiveSeasons = unimportantSeasons.concat(importantSeasons);
      const activeID = allActiveSeasons.map((seas) => {
        return seas.id;
      })
      for (const group of dbgroupmemberships) {
        const dbgroup = await this.connection
          .getRepository(Group)
          .findOne({where: group.group});

        if (dbgroup) {
          if (
            activeID.includes(dbgroup.season.id) &&
            !groupIDArray.includes(dbgroup.season.id)
          ) {
            seasonArray.push(dbgroup.season);
            groupIDArray.push(dbgroup.season.id);
          }
        } else {
          throw new HttpException(
            'The requested group was not found.',
            HttpStatus.NOT_FOUND,
          );
        }
      }
      return seasonArray;
    }
  }

  async getActiveSeasons(importance: number) {
    let activeGroups = await this.connection.getRepository(Group).find();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() - 8);
    activeGroups = activeGroups.filter((s) => {
      return (
        s.season.important == importance &&
        s.season.start_date < new Date() &&
        s.season.end_date > nextWeek
      );
    });

    const seasons: Season[] = [];
    for (let i = 0; i < activeGroups.length; i++) {
      const season = activeGroups[i].season;
      if (!seasons.includes(season)) {
        seasons.push(season);
      }
    }
    return seasons;
  }

  async getSingleSeason(id: number) {
    const dbseason = await this.seasonRepository.findOne({
      where: { id: id },
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

  async getCurrentSection(group_id: number) {
    const dbgroup = await this.connection.getRepository(Group).findOne({
      where: { id: group_id },
    });
    if (dbgroup) {
      return dbgroup.season.current_gameday;
    } else {
      throw new HttpException(
        'The requested season was not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getCountries() {
    return await this.connection
      .getRepository(Competition)
      .createQueryBuilder('comp')
      .select(['country'])
      .groupBy('comp.country')
      .getRawMany();
  }
}
