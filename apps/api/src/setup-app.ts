import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Shared HTTP setup for main.ts and e2e tests. */
export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return app;
}
