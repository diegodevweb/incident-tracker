import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IncidentsService } from './incidents.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { ErrorLogsApiKeyGuard } from './guards/error-logs-api-key.guard';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreatePreventiveActionDto } from './dto/create-preventive-action.dto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.type';
import {
  MAX_CORRECTIVE_ATTACHMENTS,
  MAX_INCIDENT_ATTACHMENTS,
  UPLOAD_THROTTLE,
  WEBHOOK_THROTTLE,
  uploadLimits,
} from './limits';

type UploadedAttachment = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getIncidents(
    @Query() query: ListIncidentsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.getIncidents(query, request.user);
  }

  @Get('reports/monthly')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getMonthlyReport(
    @Query() query: MonthlyReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.getMonthlyReport(query, request.user);
  }

  @Post()
  @Throttle({ default: UPLOAD_THROTTLE })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor(
      'attachments',
      MAX_INCIDENT_ATTACHMENTS,
      uploadLimits(MAX_INCIDENT_ATTACHMENTS),
    ),
  )
  createIncident(
    @Body() body: CreateIncidentDto,
    @Req() request: AuthenticatedRequest,
    @UploadedFiles()
    attachments: UploadedAttachment[] = [],
  ) {
    return this.incidentsService.createIncident(body, attachments, request.user);
  }

  @Patch(':id')
  @Throttle({ default: UPLOAD_THROTTLE })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FilesInterceptor(
      'correctiveAttachments',
      MAX_CORRECTIVE_ATTACHMENTS,
      uploadLimits(MAX_CORRECTIVE_ATTACHMENTS),
    ),
  )
  updateIncident(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateIncidentDto,
    @UploadedFiles() correctiveAttachments: UploadedAttachment[] = [],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.updateIncident(
      id,
      body,
      request.user,
      correctiveAttachments,
    );
  }

  @Post('preventive-actions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createPreventiveAction(
    @Body() body: CreatePreventiveActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.createPreventiveAction(body, request.user);
  }

  @Post('error-logs')
  @Throttle({ default: WEBHOOK_THROTTLE })
  @UseGuards(ErrorLogsApiKeyGuard)
  createErrorLog(@Body() body: CreateErrorLogDto) {
    return this.incidentsService.createErrorLog(body);
  }

  @Get('error-log/:id')
  @UseGuards(ErrorLogsApiKeyGuard)
  getErrorLog(@Param('id', ParseIntPipe) id: number) {
    return this.incidentsService.getErrorLog(id);
  }

  @Get('error-logs')
  @UseGuards(ErrorLogsApiKeyGuard)
  getErrorLogs() {
    return this.incidentsService.getErrorLogs();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getIncident(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.getIncident(id, request.user);
  }
}
