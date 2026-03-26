import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express = require('express');
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  const downloadRoot = path.resolve(process.env.DOWNLOAD_ROOT || './downloads');
  app.use('/downloads', express.static(downloadRoot));

  await app.listen(3001);

  const logger = new Logger('Bootstrap');
  logger.log('API server started at http://localhost:3001');
}

bootstrap().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error(`[FATAL] ${err.message}`);
  process.exitCode = 1;
});
