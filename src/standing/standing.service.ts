import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group } from 'src/database/entities/group.entity';
import { Standing } from 'src/database/entities/standing.entity';
import { User } from 'src/database/entities/user.entity';
import { GroupService } from 'src/group/group.service';
import { Connection, Repository } from 'typeorm';

@Injectable()
export class StandingService {
  constructor(
    @InjectRepository(Standing)
    private standingRepository: Repository<Standing>,
    private connection: Connection,

    private readonly groupService: GroupService,
  ) {}

  async getStanding(group_id: number, user: { username: any }) {
    const dbgroup = await this.connection
      .getRepository(Group)
      .findOne({ where: { id: group_id } });

    const dbuser = await this.connection
      .getRepository(User)
      .findOne({ where: { name: user.username } });

    await this.groupService.userIsPartOfGroup(dbuser.id, dbgroup.id);

    const dbseason = dbgroup.season;

    const standing = await this.standingRepository.findOne({
      where: {
        season: dbseason,
      },
    });
    if (!standing) return [];
    const parsed: any[] = JSON.parse(standing.ranking);

    return parsed.sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position,
    );
  }

  async getTeamStats(season_id: number, team_id: number) {
    const dbstanding = await this.connection.getRepository(Standing).findOne({
      where: {
        season: {
          id: season_id,
        },
      },
    });

    if (!dbstanding) {
      return null;
    } else {
      const parsed: any[] = JSON.parse(dbstanding.ranking);

      const filtered = parsed.filter((val) => {
        return val.team_id == team_id;
      });

      if (filtered.length == 0) {
        return null;
      } else {
        return {
          position: filtered[0].position,
          history: filtered[0].history,
          win: filtered[0].win,
          draw: filtered[0].draw,
          lose: filtered[0].lose,
          goals_for: filtered[0].goals_for,
          goals_against: filtered[0].goals_against,
        };
      }
    }
  }
}
