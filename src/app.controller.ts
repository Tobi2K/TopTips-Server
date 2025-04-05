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
import { ChangeEmailDto } from './dtos/change-email.dto';
import { ChangeNameDto } from './dtos/change-name.dto';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ChangePasswordDto } from './dtos/change-pass.dto';
import { DeleteAccountDto } from './dtos/delete-account.dto';
import { PatchNotesDto } from './dtos/patch-notes.dto';

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

  @Post('patches')
  async getPatchNotes(@Body() body: PatchNotesDto, @Request() req) {
    return await this.appService.getPatchNotes(body.appVersion, req.user);
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

  @Public()
  @Post('auth/forgot')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.name);
  }

  @Post('auth/update')
  async changeEmail(@Body() body: ChangeEmailDto, @Request() req) {
    return await this.authService.changeEmail(body, req.user);
  }

  @Post('auth/updatePass')
  async changePassword(@Body() body: ChangePasswordDto, @Request() req) {
    return await this.authService.changePassword(body, req.user);
  }

  @Post('auth/delete')
  async deleteAccount(@Body() body: DeleteAccountDto, @Request() req) {
    return await this.authService.deleteAccount(body.password, req.user);
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
