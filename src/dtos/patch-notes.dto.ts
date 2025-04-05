import { ApiProperty } from '@nestjs/swagger';

export class PatchNotesDto {
  @ApiProperty()
  appVersion: string;
}
