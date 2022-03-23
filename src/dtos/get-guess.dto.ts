import { ApiProperty } from '@nestjs/swagger';

export class GetGuessDto {
  @ApiProperty()
  gameID: number;

  @ApiProperty()
  user: number;
}
