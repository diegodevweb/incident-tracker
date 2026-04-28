import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IncidentsModule } from './incidents/incidents.module';
import { IncidentsService } from './incidents/incidents.service';

@Module({
  imports: [IncidentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
