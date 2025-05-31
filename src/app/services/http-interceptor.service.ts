import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpResponse,
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry, timeout, tap, finalize } from 'rxjs/operators';
import { ErrorHandlerService } from './error-handler.service';
import { LoggerService } from './logger.service';

@Injectable()
export class HttpInterceptorService implements HttpInterceptor {
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private pendingRequests = new Map<string, number>();

  constructor(
    private errorHandler: ErrorHandlerService,
    private logger: LoggerService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Generate a unique request ID for tracking
    const requestId = this.generateRequestId(request);
    
    // Add request timeout
    const timeoutMs = this.getRequestTimeout(request);
    
    // Log request start
    this.logger.debug(`HTTP Request [${requestId}]: ${request.method} ${request.url}`);
    this.trackRequest(requestId);

    return next.handle(request).pipe(
      // Add timeout
      timeout(timeoutMs),
      
      // Add retry logic for specific errors
      this.addRetryLogic(request, requestId),
      
      // Log successful responses
      tap(event => {
        if (event instanceof HttpResponse) {
          this.logger.debug(`HTTP Response [${requestId}]: ${event.status} ${event.statusText}`);
        }
      }),
      
      // Handle errors
      catchError((error: HttpErrorResponse) => {
        this.logger.error(`HTTP Error [${requestId}]:`, error);
        return this.handleHttpError(error, request);
      }),
      
      // Clean up tracking
      finalize(() => {
        this.untrackRequest(requestId);
      })
    );
  }

  private generateRequestId(request: HttpRequest<any>): string {
    return `${request.method}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRequestTimeout(request: HttpRequest<any>): number {
    // Check if request has custom timeout in headers
    const customTimeout = request.headers.get('X-Timeout');
    if (customTimeout) {
      return parseInt(customTimeout, 10);
    }

    // Different timeouts for different request types
    if (request.url.includes('/webservice/rest/server.php')) {
      return 45000; // Moodle API calls can be slower
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      return 60000; // Upload operations need more time
    }

    return this.DEFAULT_TIMEOUT;
  }

  private addRetryLogic(request: HttpRequest<any>, requestId: string) {
    return (source: Observable<HttpEvent<any>>) => source.pipe(
      retry({
        count: this.MAX_RETRIES,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          // Only retry on specific conditions
          if (!this.shouldRetry(error, request, retryCount)) {
            throw error;
          }

          const delay = this.calculateRetryDelay(retryCount);
          this.logger.debug(`Retrying request [${requestId}] (attempt ${retryCount + 1}/${this.MAX_RETRIES}) after ${delay}ms`);
          
          return timer(delay);
        },
      })
    );
  }

  private shouldRetry(error: HttpErrorResponse, request: HttpRequest<any>, retryCount: number): boolean {
    // Don't retry if we've exceeded max retries
    if (retryCount >= this.MAX_RETRIES) {
      return false;
    }

    // Don't retry client errors (4xx) except for specific cases
    if (error.status >= 400 && error.status < 500) {
      // Retry 408 (timeout), 429 (rate limit)
      return error.status === 408 || error.status === 429;
    }

    // Retry server errors (5xx)
    if (error.status >= 500) {
      return true;
    }

    // Retry network errors (status 0) or timeout errors
    if (error.status === 0 || error.error instanceof Error) {
      return true;
    }

    // Don't retry by default
    return false;
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return this.RETRY_DELAY * Math.pow(2, retryCount);
  }

  private handleHttpError(error: HttpErrorResponse, request: HttpRequest<any>): Observable<never> {
    // Determine the context based on the request
    const context = this.getRequestContext(request);
    
    // Handle specific Moodle API errors
    if (this.isMoodleApiRequest(request)) {
      return this.handleMoodleApiError(error, context);
    }

    // Handle authentication errors globally
    if (error.status === 401) {
      this.handleAuthenticationError(error, context);
      return throwError(() => error);
    }

    // Handle rate limiting
    if (error.status === 429) {
      this.handleRateLimitError(error, context);
      return throwError(() => error);
    }

    // Handle network connectivity issues
    if (error.status === 0 || this.isTimeoutError(error)) {
      this.handleNetworkError(error, context);
      return throwError(() => error);
    }

    // Use error handler service for other errors
    this.errorHandler.handleHttpError(error, context);
    return throwError(() => error);
  }

  private getRequestContext(request: HttpRequest<any>): string {
    const url = request.url;
    
    if (url.includes('/login/token.php')) {
      return 'User login';
    }
    
    if (url.includes('/webservice/rest/server.php')) {
      // Try to extract the function name
      const wsFunction = request.params?.get('wsfunction');
      if (wsFunction) {
        return `Moodle API (${wsFunction})`;
      }
      return 'Moodle API';
    }
    
    if (url.includes('/api/settings')) {
      return 'Settings';
    }
    
    return `${request.method} ${url}`;
  }

  private isMoodleApiRequest(request: HttpRequest<any>): boolean {
    return request.url.includes('/webservice/rest/server.php') || 
           request.url.includes('/login/token.php');
  }

  private handleMoodleApiError(error: HttpErrorResponse, context: string): Observable<never> {
    // Check if the error response contains Moodle-specific error information
    if (error.error && typeof error.error === 'object') {
      if (error.error.exception || error.error.errorcode) {
        this.errorHandler.handleMoodleError(error.error, context);
        return throwError(() => error);
      }
    }

    // Fall back to general HTTP error handling
    this.errorHandler.handleHttpError(error, context);
    return throwError(() => error);
  }

  private handleAuthenticationError(error: HttpErrorResponse, context: string): void {
    this.logger.warn('Authentication error detected, user may need to re-login');
    
    // Could trigger automatic logout or redirect to login
    // For now, just show error message
    this.errorHandler.handleHttpError(error, context);
    
    // TODO: Implement automatic token refresh or logout
    // this.authService.logout();
    // this.router.navigate(['/login']);
  }

  private handleRateLimitError(error: HttpErrorResponse, context: string): void {
    const retryAfter = error.headers.get('Retry-After');
    const message = retryAfter 
      ? `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
      : 'Rate limit exceeded. Please wait a moment before trying again.';
    
    this.errorHandler.reportError(message, context, 'network');
  }

  private handleNetworkError(error: HttpErrorResponse, context: string): void {
    let message = 'Network connection error. Please check your internet connection.';
    
    if (this.isTimeoutError(error)) {
      message = 'Request timed out. Please try again.';
    }
    
    this.errorHandler.reportError(message, context, 'network');
  }

  private isTimeoutError(error: HttpErrorResponse): boolean {
    // Check if it's a timeout error by examining the error object
    return error.error instanceof Error && error.error.name === 'TimeoutError';
  }

  private trackRequest(requestId: string): void {
    const count = this.pendingRequests.get(requestId) || 0;
    this.pendingRequests.set(requestId, count + 1);
  }

  private untrackRequest(requestId: string): void {
    const count = this.pendingRequests.get(requestId) || 0;
    if (count <= 1) {
      this.pendingRequests.delete(requestId);
    } else {
      this.pendingRequests.set(requestId, count - 1);
    }
  }

  /**
   * Get the number of pending requests
   */
  getPendingRequestCount(): number {
    return Array.from(this.pendingRequests.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Check if there are any pending requests
   */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }
} 