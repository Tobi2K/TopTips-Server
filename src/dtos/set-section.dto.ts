import { ApiProperty } from '@nestjs/swagger';

export class SetSectionDto {
  @ApiProperty()
  date: Date;
}
