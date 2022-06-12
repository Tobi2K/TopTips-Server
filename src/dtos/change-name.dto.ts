import { ApiProperty } from '@nestjs/swagger';

export class ChangeNameDto {
  @ApiProperty()
  name: string;
}
