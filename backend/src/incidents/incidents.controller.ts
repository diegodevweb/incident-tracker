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
  getIncidents(@Query() query: ListIncidentsQueryDto) {
    return this.incidentsService.getIncidents(query);
  }

  @Get('reports/monthly')
  getMonthlyReport(@Query() query: MonthlyReportQueryDto) {
    return this.incidentsService.getMonthlyReport(query);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('attachments', 5))
  createIncident(
    @Body() body: CreateIncidentDto,
    @UploadedFiles()
    attachments: UploadedAttachment[] = [],
  ) {
    return this.incidentsService.createIncident(body, attachments);
  }

  @Patch(':id')
  updateIncident(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateIncidentDto,
  ) {
    return this.incidentsService.updateIncident(id, body);
  }

  @Post('preventive-actions')
  createPreventiveAction(@Body() body: CreatePreventiveActionDto) {
    return this.incidentsService.createPreventiveAction(body);
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
  getIncident(@Param('id', ParseIntPipe) id: number) {
    return this.incidentsService.getIncident(id);
  }
}
