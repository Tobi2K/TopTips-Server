import { ApiProperty } from '@nestjs/swagger';

export class ChangeEmailDto {
  @ApiProperty()
  email: string;
}
