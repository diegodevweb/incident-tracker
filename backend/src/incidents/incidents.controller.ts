import { Body, Controller, Post } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';

@Controller('incidents')
export class IncidentsController {
    constructor(private readonly incidentsService: IncidentsService) {}

    @Post('error-logs')
    createErrorLog(@Body() body: CreateErrorLogDto) {
        return this.incidentsService.createErrorLog(body);
    }
}
