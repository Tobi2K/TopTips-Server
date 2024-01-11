import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty()
  password: string;
}
