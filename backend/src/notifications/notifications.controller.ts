import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.type';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.list(request.user);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @Req() request: AuthenticatedRequest,
    @Body() body: MarkNotificationsReadDto,
  ) {
    return this.notificationsService.markRead(request.user, body.incidentId);
  }
}
