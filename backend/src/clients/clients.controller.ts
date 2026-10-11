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
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@Query() query: ListClientsQueryDto) {
    return this.clientsService.list(query);
  }

  @Post()
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateClientDto) {
    return this.clientsService.update(id, body);
  }

  @Post(':id/password-reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.resetPassword(id);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.disable(id);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.enable(id);
  }
}
