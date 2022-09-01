import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import 'dotenv/config';

export const options = {
  headers: {
    'X-RapidAPI-Host': 'api-handball.p.rapidapi.com',
    'X-RapidAPI-Key': process.env.API_KEY,
  },
};

export const appVersion = '2.2.1';

async function bootstrap() {
  const { privateKey } = JSON.parse(process.env.FIREBASE_PRIVATE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    projectId: 'top-tips-online',
  });

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Top Tips')
    .setDescription('The Top Tips API description')
    .setVersion('1.0')
    .addBearerAuth(
      {
        description: `Please enter token in following format: Bearer <JWT>`,
        name: 'Authorization',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3001);
}
bootstrap();
