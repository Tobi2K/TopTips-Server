import { ApiProperty } from '@nestjs/swagger';
import { Season } from 'src/database/entities/season.entity';
import { Team } from 'src/database/entities/team.entity';

export class CreateGameDto {
  @ApiProperty()
  gameday: number;

  @ApiProperty()
  stage: string;

  @ApiProperty()
  eventID: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  team1: Team;

  @ApiProperty()
  team2: Team;

  @ApiProperty()
  season: Season;
}
