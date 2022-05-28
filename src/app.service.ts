import { Injectable } from '@nestjs/common';
import { appVersion } from './main';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getVersion(): string {
    return appVersion;
  }
}
