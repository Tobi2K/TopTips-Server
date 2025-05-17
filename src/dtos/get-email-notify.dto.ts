import { ApiProperty } from '@nestjs/swagger';

export class GetEmailNotifyDto {
  @ApiProperty()
  seasonID: number;

  @ApiProperty()
  isToday: boolean;
}
