import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  var serviceAccount = require('../top-tips-online-firebase-adminsdk-p5hb4-db7c1e9d40.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'top-tips-online',
  });

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Tippspiel')
    .setDescription('The Tippspiel API description')
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

  console.log('Test');

  await app.listen(3001);
}
bootstrap();
