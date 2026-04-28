import { Body, Controller, Post, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { ErrorLogsApiKeyGuard } from './guards/error-logs-api-key.guard';

@Controller('incidents')
export class IncidentsController {
    constructor(private readonly incidentsService: IncidentsService) {}

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
}
