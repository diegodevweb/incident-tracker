import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { ListErrorLogsQueryDto } from './dto/list-error-logs-query.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreatePreventiveActionDto } from './dto/create-preventive-action.dto';
import { CreateIncidentCommentDto } from './dto/create-incident-comment.dto';
import { DeleteIncidentDto } from './dto/delete-incident.dto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.type';
import {
  WebhookKeyGuard,
  type WebhookRequest,
} from '../webhook-keys/webhook-key.guard';
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

  // Os dois papéis veem: o cliente escolhe a criticidade ao abrir o chamado.
  @Get('sla-rules')
  @UseGuards(JwtAuthGuard)
  getSlaRules() {
    return this.incidentsService.getSlaRules();
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
    return this.incidentsService.createIncident(
      body,
      attachments,
      request.user,
    );
  }

  // Aberto ao cliente, mas só para resolver ou reabrir: o service confere.
  @Patch(':id')
  @Throttle({ default: UPLOAD_THROTTLE })
  @UseGuards(JwtAuthGuard)
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

  @Post(':id/attachments')
  @Throttle({ default: UPLOAD_THROTTLE })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor(
      'attachments',
      MAX_INCIDENT_ATTACHMENTS,
      uploadLimits(MAX_INCIDENT_ATTACHMENTS),
    ),
  )
  addAttachments(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() attachments: UploadedAttachment[] = [],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.addAttachments(id, attachments, request.user);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateIncidentCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.addComment(id, body, request.user);
  }

  // Exclusão lógica. Aberto ao cliente só para o que ele abriu e a equipe não
  // tocou: o service confere.
  @Post(':id/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  deleteIncident(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DeleteIncidentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.deleteIncident(id, body, request.user);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  restoreIncident(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.incidentsService.restoreIncident(id, request.user);
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
  @UseGuards(WebhookKeyGuard)
  createErrorLog(
    @Body() body: CreateErrorLogDto,
    @Req() request: WebhookRequest,
  ) {
    return this.incidentsService.createErrorLog(body, request.webhookKey);
  }

  @Get('error-log/:id')
  @UseGuards(WebhookKeyGuard)
  getErrorLog(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: WebhookRequest,
  ) {
    return this.incidentsService.getErrorLog(id, request.webhookKey.companyId);
  }

  @Get('error-logs')
  @UseGuards(WebhookKeyGuard)
  getErrorLogs(
    @Query() query: ListErrorLogsQueryDto,
    @Req() request: WebhookRequest,
  ) {
    return this.incidentsService.getErrorLogs(
      query,
      request.webhookKey.companyId,
    );
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
