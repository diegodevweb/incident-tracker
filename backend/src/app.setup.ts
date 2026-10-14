import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { parseTrustProxy } from './common/parse-trust-proxy';

/** Configuração HTTP da API, a mesma no main.ts e nos testes e2e. */
export function configureApp(app: NestExpressApplication) {
  // Sem isto, X-Forwarded-For é ignorado (seguro). Defina TRUST_PROXY com o número de proxies na frente.
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  // Sem CORS: o navegador só fala com o Next (mesma origem), que faz o proxy.
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
