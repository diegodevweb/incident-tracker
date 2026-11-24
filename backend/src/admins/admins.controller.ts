import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/authenticated-request.type';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateManagedUserDto } from '../users/dto/create-managed-user.dto';
import { UpdateManagedUserDto } from '../users/dto/update-managed-user.dto';
import { AdminsService } from './admins.service';

@Controller('admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  create(@Body() body: CreateManagedUserDto) {
    return this.admins.create(body);
  }

  @Patch(':userId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdateManagedUserDto,
  ) {
    return this.admins.update(request.user.sub, userId, body);
  }

  @Post(':userId/password-reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.admins.resetPassword(request.user.sub, userId);
  }

  @Post(':userId/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.admins.disable(request.user.sub, userId);
  }

  @Post(':userId/enable')
  @HttpCode(HttpStatus.OK)
  enable(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.admins.enable(request.user.sub, userId);
  }
}
