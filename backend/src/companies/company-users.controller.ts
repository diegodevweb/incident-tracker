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
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompanyUsersService } from './company-users.service';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';

@Controller('companies/:companyId/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CompanyUsersController {
  constructor(private readonly companyUsers: CompanyUsersService) {}

  @Get()
  list(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.companyUsers.list(companyId);
  }

  @Post()
  create(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() body: CreateCompanyUserDto,
  ) {
    return this.companyUsers.create(companyId, body);
  }

  @Patch(':userId')
  update(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdateCompanyUserDto,
  ) {
    return this.companyUsers.update(companyId, userId, body);
  }

  @Post(':userId/password-reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.companyUsers.resetPassword(companyId, userId);
  }

  @Post(':userId/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.companyUsers.disable(companyId, userId);
  }

  @Post(':userId/enable')
  @HttpCode(HttpStatus.OK)
  enable(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.companyUsers.enable(companyId, userId);
  }
}
