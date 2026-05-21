import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // open cors
  app.enableCors();

  // Aktifkan validasi DTO secara global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // mencegah mass assignment
      forbidNonWhitelisted: true, // tolak properti yang tidak ada di DTO
      transform: true,
    }),
  );

  // Aktifkan exception filter untuk response yang konsisten
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(3000);
}
bootstrap();
