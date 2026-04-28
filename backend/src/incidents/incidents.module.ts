import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  providers: [IncidentsService],
  controllers: [IncidentsController],
  imports: [PrismaModule],
})
export class IncidentsModule {}
