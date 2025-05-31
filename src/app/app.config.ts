import { ApplicationConfig, importProvidersFrom, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { routes } from './app.routes';
import { ErrorHandlerService } from './services/error-handler.service';
import { HttpInterceptorService } from './services/http-interceptor.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    importProvidersFrom(MatDialogModule, MatSnackBarModule),
    
    // Global error handling
    {
      provide: ErrorHandler,
      useClass: ErrorHandlerService,
    },
    
    // HTTP interceptor for network error handling
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpInterceptorService,
      multi: true,
    },
  ],
};
