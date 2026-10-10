import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DevAuthSeedService } from './dev-auth-seed.service';
import { getJwtSecret } from './jwt-secret';
import { LoginRateLimitService } from './login-rate-limit.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
        signOptions: {
          expiresIn: '8h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DevAuthSeedService,
    LoginRateLimitService,
    JwtStrategy,
  ],
})
export class AuthModule {}
