import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AllowPendingPasswordChange } from '../auth/allow-pending-password-change.decorator';
import type { AuthenticatedRequest } from '../auth/authenticated-request.type';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

// Por IP e por minuto. A troca confere a senha atual, então um token roubado
// não pode virar um jeito de testar senhas em massa.
export const CHANGE_PASSWORD_THROTTLE = { limit: 10, ttl: 60_000 };

/** A conta de quem está logado, admin ou cliente. */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @AllowPendingPasswordChange()
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.accountService.getProfile(request.user.sub);
  }

  @Patch()
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateAccountDto,
  ) {
    return this.accountService.updateProfile(request.user.sub, body);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @AllowPendingPasswordChange()
  @Throttle({ default: CHANGE_PASSWORD_THROTTLE })
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    return this.accountService.changePassword(request.user.sub, body);
  }
}
