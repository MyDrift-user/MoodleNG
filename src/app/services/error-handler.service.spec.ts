import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgZone } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';
import { LoggerService } from './logger.service';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
  let loggerSpy: jasmine.SpyObj<LoggerService>;
  let ngZoneSpy: jasmine.SpyObj<NgZone>;

  beforeEach(() => {
    const snackBarSpyObj = jasmine.createSpyObj('MatSnackBar', ['open']);
    const loggerSpyObj = jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']);
    const ngZoneSpyObj = jasmine.createSpyObj('NgZone', ['run']);

    TestBed.configureTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: MatSnackBar, useValue: snackBarSpyObj },
        { provide: LoggerService, useValue: loggerSpyObj },
        { provide: NgZone, useValue: ngZoneSpyObj }
      ]
    });

    service = TestBed.inject(ErrorHandlerService);
    snackBarSpy = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;
    loggerSpy = TestBed.inject(LoggerService) as jasmine.SpyObj<LoggerService>;
    ngZoneSpy = TestBed.inject(NgZone) as jasmine.SpyObj<NgZone>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Global Error Handling', () => {
    it('should handle JavaScript errors', () => {
      const error = new Error('Test JavaScript error');
      
      service.handleError(error);
      
      expect(loggerSpy.error).toHaveBeenCalledWith('Global error caught:', error);
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      
      service.handleError(error);
      
      expect(loggerSpy.error).toHaveBeenCalledWith('Global error caught:', error);
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle object errors', () => {
      const error = { message: 'Object error', code: 500 };
      
      service.handleError(error);
      
      expect(loggerSpy.error).toHaveBeenCalledWith('Global error caught:', error);
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should sanitize sensitive information', () => {
      const error = new Error('Login failed with password=secret123');
      
      service.handleError(error);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('[REDACTED]'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });
  });

  describe('HTTP Error Handling', () => {
    it('should handle network connection errors', () => {
      const httpError = { status: 0, message: 'Failed to fetch' };
      
      service.handleHttpError(httpError);
      
      expect(loggerSpy.error).toHaveBeenCalledWith('HTTP error:', httpError);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Network connection error'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should handle 401 Unauthorized errors', () => {
      const httpError = { 
        status: 401, 
        error: { message: 'Unauthorized' },
        message: 'Http failure response'
      };
      
      service.handleHttpError(httpError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Authentication failed'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should handle 403 Forbidden errors', () => {
      const httpError = { 
        status: 403, 
        error: { message: 'Forbidden' },
        message: 'Http failure response'
      };
      
      service.handleHttpError(httpError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('permission'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should handle 404 Not Found errors', () => {
      const httpError = { 
        status: 404, 
        error: { message: 'Not Found' },
        message: 'Http failure response'
      };
      
      service.handleHttpError(httpError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('not found'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should handle 500 Server errors', () => {
      const httpError = { 
        status: 500, 
        error: { message: 'Internal Server Error' },
        message: 'Http failure response'
      };
      
      service.handleHttpError(httpError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Server error'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should include context in error message', () => {
      const httpError = { status: 400, message: 'Bad Request' };
      const context = 'User login';
      
      service.handleHttpError(httpError, context);
      
      expect(loggerSpy.error).toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalled();
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle simple validation errors', () => {
      const errors = { username: 'Username is required' };
      
      service.handleValidationError(errors);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Username is required'),
        jasmine.any(String),
        jasmine.objectContaining({ panelClass: ['warn-snackbar'] })
      );
    });

    it('should handle multiple validation errors', () => {
      const errors = { 
        username: 'Username is required',
        email: 'Email is invalid'
      };
      
      service.handleValidationError(errors);
      
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should include context in validation errors', () => {
      const errors = { field: 'Field is required' };
      const context = 'Form validation';
      
      service.handleValidationError(errors, context);
      
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle array of validation errors', () => {
      const errors = ['Username is required', 'Email is invalid'];
      
      service.handleValidationError(errors);
      
      expect(snackBarSpy.open).toHaveBeenCalled();
    });
  });

  describe('Moodle Error Handling', () => {
    it('should handle Moodle API errors with exception', () => {
      const moodleError = {
        exception: 'moodle_exception',
        message: 'Invalid token'
      };
      
      service.handleMoodleError(moodleError);
      
      expect(loggerSpy.error).toHaveBeenCalledWith('Moodle API error:', moodleError);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Invalid token'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should handle Moodle API errors with error field', () => {
      const moodleError = {
        error: 'Access denied'
      };
      
      service.handleMoodleError(moodleError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Access denied'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should handle string Moodle errors', () => {
      const moodleError = 'Connection to Moodle failed';
      
      service.handleMoodleError(moodleError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Connection to Moodle failed'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });

    it('should include context in Moodle errors', () => {
      const moodleError = { error: 'API error' };
      const context = 'Fetching courses';
      
      service.handleMoodleError(moodleError, context);
      
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle unknown Moodle errors', () => {
      const moodleError = { unexpectedField: 'value' };
      
      service.handleMoodleError(moodleError);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining('Moodle API error occurred'),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });
  });

  describe('Error Reporting', () => {
    it('should report custom errors', () => {
      const message = 'Custom error occurred';
      const context = 'User action';
      
      service.reportError(message, context, 'validation');
      
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle error reporting without context', () => {
      const message = 'Simple error';
      
      service.reportError(message);
      
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle different error types', () => {
      service.reportError('Network error', 'API call', 'network');
      service.reportError('JS error', 'Component', 'javascript');
      service.reportError('API error', 'Service', 'api');
      
      expect(snackBarSpy.open).toHaveBeenCalledTimes(3);
    });
  });

  describe('Offline Handling', () => {
    it('should detect offline status', () => {
      const isOffline = service.isApplicationOffline();
      
      expect(typeof isOffline).toBe('boolean');
    });

    it('should queue errors when offline', () => {
      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      const error = new Error('Test error');
      service.handleError(error);
      
      expect(loggerSpy.error).toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalled();
    });
  });

  describe('Message Sanitization', () => {
    it('should remove token information', () => {
      const error = new Error('Authentication failed with token=abc123def456');
      
      service.handleError(error);
      
      const openCall = snackBarSpy.open.calls.mostRecent();
      expect(openCall.args[0]).not.toContain('abc123def456');
      expect(openCall.args[0]).toContain('[REDACTED]');
    });

    it('should remove password information', () => {
      const error = new Error('Login failed with password=secret123');
      
      service.handleError(error);
      
      const openCall = snackBarSpy.open.calls.mostRecent();
      expect(openCall.args[0]).not.toContain('secret123');
      expect(openCall.args[0]).toContain('[REDACTED]');
    });

    it('should remove API key information', () => {
      const error = new Error('API call failed with key=key_123456789');
      
      service.handleError(error);
      
      const openCall = snackBarSpy.open.calls.mostRecent();
      expect(openCall.args[0]).not.toContain('key_123456789');
      expect(openCall.args[0]).toContain('[REDACTED]');
    });

    it('should convert technical errors to user-friendly messages', () => {
      const error = new Error('Failed to fetch');
      
      service.handleError(error);
      
      const openCall = snackBarSpy.open.calls.mostRecent();
      expect(openCall.args[0]).toContain('Network connection error');
    });
  });

  describe('Error Information Creation', () => {
    it('should create error info with proper structure', () => {
      const error = new Error('Test error');
      
      service.handleError(error);
      
      expect(loggerSpy.error).toHaveBeenCalledWith('Global error caught:', error);
      expect(snackBarSpy.open).toHaveBeenCalled();
    });

    it('should handle errors without stack traces', () => {
      const error = { message: 'Error without stack' };
      
      service.handleError(error);
      
      expect(loggerSpy.error).toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalled();
    });
  });
}); 