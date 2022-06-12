import { Controller } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('users')
@ApiBearerAuth('access-token')
export class UsersController {}
