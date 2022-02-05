import { Body, Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';

@Controller('users')
@ApiBearerAuth('access-token')
export class UsersController {}
