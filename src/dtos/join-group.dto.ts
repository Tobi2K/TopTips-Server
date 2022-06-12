import { ApiProperty } from '@nestjs/swagger';

export class JoinGroupDto {
  @ApiProperty()
  passphrase: string;
}
