import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from "firebase-admin";

async function bootstrap() {
  var serviceAccount = require("../tippspiel-19914-firebase-adminsdk-dgecm-432900a038.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'tippspiel-19914'
  });

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
