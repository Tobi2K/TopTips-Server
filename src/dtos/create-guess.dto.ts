import { ApiProperty } from '@nestjs/swagger';

export class CreateGuessDto {
  @ApiProperty()
  game: number;

  @ApiProperty()
  bet: number;

  @ApiProperty()
  team1: number;

  @ApiProperty()
  team2: number;

  @ApiProperty()
  groupID: number;
}
