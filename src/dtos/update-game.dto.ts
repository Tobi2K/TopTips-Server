import { ApiProperty } from '@nestjs/swagger';

export class UpdateGameDto {
  @ApiProperty()
  team1: number;

  @ApiProperty()
  team2: number;

  @ApiProperty()
  bet: number;
}
