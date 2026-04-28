import { Body, Controller, Post, Get, Param, ParseIntPipe } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';

@Controller('incidents')
export class IncidentsController {
    constructor(private readonly incidentsService: IncidentsService) {}

    @Post('error-logs')
    createErrorLog(@Body() body: CreateErrorLogDto) {
        return this.incidentsService.createErrorLog(body);
    }

    @Get('error-log/:id')
    getErrorLog(@Param('id', ParseIntPipe) id: number) {
        return this.incidentsService.getErrorLog(id);
    }

    @Get('error-logs')
    getErrorLogs() {
        return this.incidentsService.getErrorLogs();
    }
}
