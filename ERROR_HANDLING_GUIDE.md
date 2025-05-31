# Error Handling System - Implementation Guide

## Overview

MoodleNG now includes a comprehensive error handling system that provides:

- **Global Error Handling**: Catches all unhandled errors
- **HTTP Error Interception**: Automatic retry logic and timeouts
- **User-Friendly Notifications**: Clear error messages for users
- **Error Logging**: Structured error tracking and reporting
- **Offline Support**: Error queuing when offline

## Architecture

### Core Components

1. **ErrorHandlerService** (`src/app/services/error-handler.service.ts`)
   - Global error handler implementing Angular's `ErrorHandler`
   - User notification management
   - Error sanitization and logging

2. **HttpInterceptorService** (`src/app/services/http-interceptor.service.ts`)
   - HTTP request/response interception
   - Automatic retry logic with exponential backoff
   - Request timeout management
   - Moodle-specific error handling

3. **LoggerService** (`src/app/services/logger.service.ts`)
   - Environment-aware logging
   - Production-safe console output

## Features

### 🔄 Automatic Retry Logic

The HTTP interceptor automatically retries failed requests:

- **Network errors** (status 0): Retries up to 3 times
- **Server errors** (5xx): Retries up to 3 times  
- **Timeout errors** (408): Retries up to 3 times
- **Rate limit errors** (429): Retries with backoff

**Exponential Backoff**: 1s → 2s → 4s between retries

### ⏱️ Smart Timeouts

Different timeout values based on request type:

- **Default requests**: 30 seconds
- **Moodle API calls**: 45 seconds
- **Upload operations**: 60 seconds
- **Custom timeouts**: Add `X-Timeout` header

### 🎯 Context-Aware Error Messages

Errors are automatically categorized and contextualized:

```typescript
// Automatically detects context
"Moodle API (core_enrol_get_users_courses): Network connection error"
"User login: Invalid username or password"
"Settings: Request timed out"
```

### 🔐 Security Features

- **Token sanitization**: Removes tokens from error messages
- **Sensitive data filtering**: Redacts passwords and keys
- **Safe error reporting**: No sensitive data in logs

### 📱 User Experience

- **Non-intrusive notifications**: Top-center snackbars
- **Appropriate duration**: Errors (8s), warnings (5s)
- **Clear actions**: Dismiss/OK buttons
- **Visual hierarchy**: Color-coded by severity

## Usage Guide

### Basic Error Handling

Most errors are handled automatically. For manual error reporting:

```typescript
import { ErrorHandlerService } from './services/error-handler.service';

constructor(private errorHandler: ErrorHandlerService) {}

// Report a custom error
this.errorHandler.reportError('Something went wrong', 'Feature Name');

// Handle validation errors
this.errorHandler.handleValidationError(formErrors, 'User Registration');

// Handle Moodle-specific errors
this.errorHandler.handleMoodleError(moodleResponse, 'Course Loading');
```

### HTTP Request Configuration

```typescript
// Add custom timeout
const headers = new HttpHeaders().set('X-Timeout', '60000');
this.http.get(url, { headers });

// The interceptor automatically:
// - Adds request tracking
// - Implements retry logic
// - Handles errors
// - Manages timeouts
```

### Service Integration

Services should let the global handler manage errors:

```typescript
getCourses(): Observable<Course[]> {
  return this.http.get<Course[]>('/api/courses').pipe(
    // Don't add catchError here - let the interceptor handle it
    map(response => this.transformCourses(response))
  );
}
```

### Component Error Handling

Components should focus on UI state, not error details:

```typescript
async loadData(): Promise<void> {
  this.loading = true;
  try {
    this.data = await this.service.getData().toPromise();
  } catch (error) {
    // Error already handled globally
    // Just manage UI state
    this.hasError = true;
  } finally {
    this.loading = false;
  }
}
```

## Error Types

### Network Errors
- Connection failures
- Timeout errors  
- DNS resolution issues
- **Action**: Automatic retry with backoff

### API Errors
- Moodle API exceptions
- Authentication failures
- Permission denied
- **Action**: User notification with context

### Validation Errors
- Form validation failures
- Input format errors
- Required field errors
- **Action**: Warning notification

### JavaScript Errors
- Runtime exceptions
- Type errors
- Reference errors
- **Action**: Error logging and user notification

## Configuration

### Error Handler Setup

Already configured in `src/app/app.config.ts`:

```typescript
{
  provide: ErrorHandler,
  useClass: ErrorHandlerService,
}
```

### HTTP Interceptor Setup

```typescript
{
  provide: HTTP_INTERCEPTORS,
  useClass: HttpInterceptorService,
  multi: true,
}
```

### Custom Styling

Error notifications use CSS classes defined in `src/styles.scss`:

- `.error-snackbar`: Red error notifications
- `.warning-snackbar`: Orange warning notifications  
- `.success-snackbar`: Green success notifications

## Benefits

### For Users
- **Clear feedback**: Understand what went wrong
- **Automatic recovery**: Retries handle temporary issues
- **Consistent experience**: Uniform error presentation
- **No sensitive data**: Safe error messages

### For Developers  
- **Centralized handling**: One place for error logic
- **Automatic logging**: All errors tracked
- **Context preservation**: Know where errors occurred
- **Testing support**: Consistent error patterns

### For Operations
- **Error monitoring**: Structured error data
- **Performance insights**: Request timing and failures
- **User experience**: Reduced error impact
- **Debugging support**: Detailed error context

## Monitoring

### Available Methods

```typescript
// Check offline status
const isOffline = errorHandler.isApplicationOffline();

// Monitor pending requests
const pendingCount = httpInterceptor.getPendingRequestCount();
const hasPending = httpInterceptor.hasPendingRequests();
```

### Error Analytics

All errors include:
- **Timestamp**: When the error occurred
- **Context**: Where the error happened  
- **Error type**: Category of error
- **User agent**: Browser information
- **URL**: Current page when error occurred
- **Stack trace**: For JavaScript errors

## Future Enhancements

### Planned Features
- [ ] External error reporting service integration
- [ ] Error trend analysis
- [ ] User error feedback collection
- [ ] Advanced retry strategies
- [ ] Circuit breaker pattern
- [ ] Error recovery suggestions

### Extension Points
- Custom error handlers for specific modules
- Pluggable notification systems
- Advanced error filtering
- Custom retry strategies

## Testing

The error handling system is designed to be testable:

```typescript
// Mock error handler in tests
const mockErrorHandler = jasmine.createSpyObj('ErrorHandlerService', [
  'handleError',
  'reportError',
  'handleValidationError'
]);

// Verify error handling
expect(mockErrorHandler.reportError).toHaveBeenCalledWith(
  'Expected error message',
  'Test Context'
);
```

## Best Practices

### DO
✅ Let the global handler manage most errors  
✅ Provide context when manually reporting errors  
✅ Focus on UI state in components  
✅ Use appropriate error types  
✅ Test error scenarios  

### DON'T
❌ Catch and hide errors unnecessarily  
❌ Show technical error details to users  
❌ Duplicate error handling logic  
❌ Ignore validation errors  
❌ Expose sensitive data in errors  

## Troubleshooting

### Common Issues

**Q: Errors not showing notifications**  
A: Check that MatSnackBarModule is imported and ErrorHandlerService is provided

**Q: Retries not working**  
A: Verify HTTP_INTERCEPTORS provider is configured with `multi: true`

**Q: Custom timeouts ignored**  
A: Ensure X-Timeout header is set correctly on requests

**Q: Console errors in production**  
A: Check environment.production setting in LoggerService

### Debug Mode

Enable detailed logging in development:

```typescript
// In error-handler.service.ts
private logError(errorInfo: ErrorInfo): void {
  console.debug('Detailed error info:', errorInfo);
  // ... rest of method
}
```

---

This error handling system provides a robust foundation for application reliability and user experience. It handles the complexity of error management so developers can focus on building features. 