import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyUsersController } from './company-users.controller';
import { CompanyUsersService } from './company-users.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompaniesController, CompanyUsersController],
  providers: [CompaniesService, CompanyUsersService],
})
export class CompaniesModule {}
