import {
  Controller,
  Request,
  Get,
  Post,
  UseGuards,
  SetMetadata,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { ChangeNameDto } from './dtos/change-name.dto';
import { LoginDto } from './dtos/login.dto';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller()
@ApiBearerAuth('access-token')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthService,
  ) {}

  @Public()
  @Post('auth/login')
  async login(@Body() body: LoginDto) {
    return await this.authService.login(body);
  }

  @Public()
  @Post('auth/register')
  async register(@Request() req) {
    return await this.authService.register(req.body);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Get('user/single')
  async getUserByJWT(@Request() req) {
    return { name: req.user.username };
  }

  @Post('user/name')
  setUsername(@Request() req, @Body() body: ChangeNameDto) {
    return this.authService.updateUserByJWT(body, req.user);
  }
}
