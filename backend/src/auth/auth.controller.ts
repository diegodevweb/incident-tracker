import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './authenticated-request.type';
import { AllowPendingPasswordChange } from './allow-pending-password-change.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto, @Req() request: Request) {
    // request.ip só considera X-Forwarded-For dentro do limite de TRUST_PROXY.
    return this.authService.login(
      body,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  async logout(@Req() request: AuthenticatedRequest) {
    await this.authService.logout(request.user.sub);
  }
}
