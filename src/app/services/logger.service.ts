import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  log(message: any, ...optionalParams: any[]): void {
    if (!environment.production) {
      console.log(message, ...optionalParams);
    }
  }

  warn(message: any, ...optionalParams: any[]): void {
    if (!environment.production) {
      console.warn(message, ...optionalParams);
    }
  }

  error(message: any, ...optionalParams: any[]): void {
    if (!environment.production) {
      console.error(message, ...optionalParams);
    }
  }

  debug(message: any, ...optionalParams: any[]): void {
    if (!environment.production) {
      console.debug(message, ...optionalParams);
    }
  }
}
