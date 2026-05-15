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
import { IncidentsService } from './incidents.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { ErrorLogsApiKeyGuard } from './guards/error-logs-api-key.guard';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreatePreventiveActionDto } from './dto/create-preventive-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.type';

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
  @UseGuards(JwtAuthGuard)
  getMonthlyReport(
    @Query() query: MonthlyReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.getMonthlyReport(query, request.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('attachments', 5))
  createIncident(
    @Body() body: CreateIncidentDto,
    @Req() request: AuthenticatedRequest,
    @UploadedFiles()
    attachments: UploadedAttachment[] = [],
  ) {
    return this.incidentsService.createIncident(body, attachments, request.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('correctiveAttachments', 6))
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
  @UseGuards(JwtAuthGuard)
  createPreventiveAction(
    @Body() body: CreatePreventiveActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.createPreventiveAction(body, request.user);
  }

  @Post('error-logs')
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
