import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { GetEmailNotifyDto } from 'src/dtos/get-email-notify.dto';

@Controller('email')
@ApiBearerAuth('access-token')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('notifyEmail')
  async sendNotification() {
    return this.emailService.handleNotifications();
  }

  @Post('subscribe')
  async subToNotification(@Body() body: GetEmailNotifyDto, @Request() req) {
    return this.emailService.subscribeToNotification(
      req.user,
      body.seasonID,
      body.isToday,
    );
  }

  @Post('unsubscribe')
  async unsubFromNotification(@Body() body: GetEmailNotifyDto, @Request() req) {
    return this.emailService.unsubscribeFromNotification(
      req.user,
      body.seasonID,
      body.isToday,
    );
  }

  @Get('subscribed')
  async getSubscriptions(@Request() req) {
    return this.emailService.getSubscriptions(req.user);
  }
}
