import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { ErrorLogsApiKeyGuard } from './guards/error-logs-api-key.guard';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';

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
  createIncident(@Body() body: CreateIncidentDto) {
    return this.incidentsService.createIncident(body);
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
