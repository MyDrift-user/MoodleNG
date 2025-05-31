import { Injectable, ErrorHandler, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoggerService } from './logger.service';
import { environment } from '../../environments/environment';

export interface ErrorInfo {
  message: string;
  stack?: string;
  url?: string;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
  errorType: 'javascript' | 'network' | 'api' | 'validation' | 'unknown';
}

@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService implements ErrorHandler {
  private readonly MAX_RETRIES = 3;
  private errorQueue: ErrorInfo[] = [];
  private isOffline = false;

  constructor(
    private snackBar: MatSnackBar,
    private logger: LoggerService,
    private zone: NgZone
  ) {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOffline = false;
        this.processErrorQueue();
      });
      
      window.addEventListener('offline', () => {
        this.isOffline = true;
      });
    }
  }

  handleError(error: any): void {
    const errorInfo = this.createErrorInfo(error);
    
    // Log error for debugging
    this.logger.error('Global error caught:', error);
    
    // Show user-friendly notification
    this.showUserNotification(errorInfo);
    
    // Log error for monitoring (if online)
    this.logError(errorInfo);
  }

  /**
   * Handle HTTP errors specifically
   */
  handleHttpError(error: any, context?: string): void {
    const errorInfo = this.createErrorInfo(error, 'network');
    errorInfo.message = this.getHttpErrorMessage(error);
    
    if (context) {
      errorInfo.message = `${context}: ${errorInfo.message}`;
    }
    
    this.logger.error('HTTP error:', error);
    this.showUserNotification(errorInfo);
    this.logError(errorInfo);
  }

  /**
   * Handle API validation errors
   */
  handleValidationError(errors: any, context?: string): void {
    const message = this.formatValidationErrors(errors);
    const errorInfo: ErrorInfo = {
      message: context ? `${context}: ${message}` : message,
      timestamp: new Date(),
      errorType: 'validation',
    };
    
    this.showUserNotification(errorInfo, 'warn');
    this.logError(errorInfo);
  }

  /**
   * Handle Moodle API specific errors
   */
  handleMoodleError(error: any, context?: string): void {
    let message = 'Moodle API error occurred';
    
    if (error.exception) {
      message = error.message || error.exception;
    } else if (error.error) {
      message = error.error;
    } else if (typeof error === 'string') {
      message = error;
    }
    
    const errorInfo: ErrorInfo = {
      message: context ? `${context}: ${message}` : message,
      timestamp: new Date(),
      errorType: 'api',
    };
    
    this.logger.error('Moodle API error:', error);
    this.showUserNotification(errorInfo);
    this.logError(errorInfo);
  }

  private createErrorInfo(error: any, type: ErrorInfo['errorType'] = 'unknown'): ErrorInfo {
    let message = 'An unexpected error occurred';
    let stack: string | undefined;
    
    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error?.message) {
      message = error.message;
      stack = error.stack;
    }
    
    return {
      message: this.sanitizeErrorMessage(message),
      stack,
      url: window?.location?.href,
      timestamp: new Date(),
      userAgent: navigator?.userAgent,
      errorType: type,
    };
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove sensitive information and make user-friendly
    const sensitivePatterns = [
      /token=[\w-]+/gi,
      /password=[\w-]+/gi,
      /key=[\w-]+/gi,
    ];
    
    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    // Common error message improvements
    if (sanitized.includes('Failed to fetch')) {
      return 'Network connection error. Please check your internet connection.';
    }
    
    if (sanitized.includes('404')) {
      return 'The requested resource was not found.';
    }
    
    if (sanitized.includes('401') || sanitized.includes('Unauthorized')) {
      return 'Authentication failed. Please log in again.';
    }
    
    if (sanitized.includes('403') || sanitized.includes('Forbidden')) {
      return 'You do not have permission to perform this action.';
    }
    
    if (sanitized.includes('500')) {
      return 'Server error occurred. Please try again later.';
    }
    
    if (sanitized.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    return sanitized;
  }

  private getHttpErrorMessage(error: any): string {
    if (!error) return 'Unknown network error';
    
    if (error.status === 0) {
      return 'Network connection error. Please check your internet connection.';
    }
    
    if (error.status >= 400 && error.status < 500) {
      switch (error.status) {
        case 401:
          return 'Authentication failed. Please log in again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 408:
          return 'Request timed out. Please try again.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        default:
          return error.error?.message || `Client error (${error.status})`;
      }
    }
    
    if (error.status >= 500) {
      return 'Server error occurred. Please try again later.';
    }
    
    return error.error?.message || error.message || 'Network error occurred';
  }

  private formatValidationErrors(errors: any): string {
    if (typeof errors === 'string') {
      return errors;
    }
    
    if (Array.isArray(errors)) {
      return errors.join(', ');
    }
    
    if (typeof errors === 'object') {
      const messages: string[] = [];
      for (const [field, fieldErrors] of Object.entries(errors)) {
        if (Array.isArray(fieldErrors)) {
          messages.push(`${field}: ${fieldErrors.join(', ')}`);
        } else {
          messages.push(`${field}: ${fieldErrors}`);
        }
      }
      return messages.join('; ');
    }
    
    return 'Validation error occurred';
  }

  private showUserNotification(errorInfo: ErrorInfo, type: 'error' | 'warn' = 'error'): void {
    // Use NgZone to ensure notifications show up properly
    this.zone.run(() => {
      const action = type === 'error' ? 'Dismiss' : 'OK';
      const panelClass = type === 'error' ? 'error-snackbar' : 'warning-snackbar';
      
      this.snackBar.open(errorInfo.message, action, {
        duration: type === 'error' ? 8000 : 5000, // Errors stay longer
        verticalPosition: 'top',
        horizontalPosition: 'center',
        panelClass: [panelClass],
      });
    });
  }

  private logError(errorInfo: ErrorInfo): void {
    if (this.isOffline) {
      // Queue error for later transmission
      this.errorQueue.push(errorInfo);
      return;
    }
    
    // In a real app, this would send to an error tracking service
    // For now, we'll just log locally
    this.logger.error('Error logged:', {
      ...errorInfo,
      environment: environment.production ? 'production' : 'development',
    });
    
    // TODO: Implement error reporting to external service
    // this.sendErrorToService(errorInfo);
  }

  private processErrorQueue(): void {
    if (this.errorQueue.length === 0) return;
    
    // Process queued errors when back online
    const errors = [...this.errorQueue];
    this.errorQueue = [];
    
    errors.forEach(error => this.logError(error));
  }

  /**
   * Public method to manually report errors
   */
  reportError(message: string, context?: string, errorType: ErrorInfo['errorType'] = 'unknown'): void {
    const errorInfo: ErrorInfo = {
      message: context ? `${context}: ${message}` : message,
      timestamp: new Date(),
      errorType,
      url: window?.location?.href,
      userAgent: navigator?.userAgent,
    };
    
    this.showUserNotification(errorInfo);
    this.logError(errorInfo);
  }

  /**
   * Check if the application is currently offline
   */
  isApplicationOffline(): boolean {
    return this.isOffline;
  }
} 