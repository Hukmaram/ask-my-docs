import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppModule } from './app/app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({
    limit: '100kb',
    extended: true,
  }));
  app.use(morgan('dev'));

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);

  console.log(`Server running on http://localhost:${port}`);
}

void bootstrap();
