import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  password: string;
}
