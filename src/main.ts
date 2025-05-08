import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import 'dotenv/config';

import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const host = process.env.HOST || '0.0.0.0';
  const port = process.env.PORT || 3000;

  await app.listen(port, host, () =>
    Logger.log(`Listening on ${host}:${port}`),
  );
}

bootstrap().catch((error) => Logger.error(error, error.stack));
