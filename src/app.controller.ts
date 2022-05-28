import {
  Controller,
  Request,
  Get,
  Post,
  SetMetadata,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { ChangeNameDto } from './dtos/change-name.dto';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';

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
  @Get()
  getStatus() {
    return this.appService.getHello();
  }

  @Public()
  @Get('version')
  getVersion() {
    return this.appService.getVersion();
  }

  @Public()
  @Post('auth/login')
  async login(@Body() body: LoginDto) {
    return await this.authService.login(body);
  }

  @Public()
  @Post('auth/register')
  async register(@Body() body: RegisterDto) {
    return await this.authService.register(body);
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
