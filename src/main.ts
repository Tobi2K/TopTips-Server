import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from "firebase-admin";
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  var serviceAccount = require("../tippspiel-19914-firebase-adminsdk-dgecm-432900a038.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'tippspiel-19914'
  });

  const app = await NestFactory.create(AppModule);
  app.enableCors();


  const config = new DocumentBuilder()
    .setTitle('Tippspiel')
    .setDescription('The Tippspiel API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
