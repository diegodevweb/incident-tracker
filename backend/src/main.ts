import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sem CORS: o navegador só fala com o Next (mesma origem), que faz o proxy.
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Por padrão só aceita conexões locais; em container, defina HOST=0.0.0.0
  // e não publique a porta fora da rede interna.
  await app.listen(process.env.PORT ?? 3001, process.env.HOST ?? '127.0.0.1');
}
bootstrap();
