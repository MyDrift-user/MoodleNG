import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';

import { LoginComponent } from './login.component';
import { MoodleService } from '../../services/moodle.service';
import { ValidationService } from '../../services/validation.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { SanitizationService } from '../../services/sanitization.service';
import { LoggerService } from '../../services/logger.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let moodleService: jasmine.SpyObj<MoodleService>;
  let validationService: jasmine.SpyObj<ValidationService>;
  let errorHandlerService: jasmine.SpyObj<ErrorHandlerService>;
  let sanitizationService: jasmine.SpyObj<SanitizationService>;
  let loggerService: jasmine.SpyObj<LoggerService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const moodleServiceSpy = jasmine.createSpyObj('MoodleService', [
      'login',
      'validateConnection',
      'setCredentials'
    ]);
    const validationServiceSpy = jasmine.createSpyObj('ValidationService', [
      'validateMoodleLoginData',
      'getValidationMessages',
      'hasFormErrors'
    ]);
    const errorHandlerServiceSpy = jasmine.createSpyObj('ErrorHandlerService', [
      'handleError',
      'handleHttpError',
      'handleMoodleError'
    ]);
    const sanitizationServiceSpy = jasmine.createSpyObj('SanitizationService', [
      'sanitizeText',
      'sanitizeUrl',
      'isValidMoodleUrl'
    ]);
    const loggerServiceSpy = jasmine.createSpyObj('LoggerService', [
      'info',
      'error',
      'warn'
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        ReactiveFormsModule,
        HttpClientTestingModule,
        MatSnackBarModule,
        MatInputModule,
        MatButtonModule,
        MatCardModule,
        MatProgressSpinnerModule,
        MatIconModule,
        BrowserAnimationsModule
      ],
      providers: [
        { provide: MoodleService, useValue: moodleServiceSpy },
        { provide: ValidationService, useValue: validationServiceSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerServiceSpy },
        { provide: SanitizationService, useValue: sanitizationServiceSpy },
        { provide: LoggerService, useValue: loggerServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    moodleService = TestBed.inject(MoodleService) as jasmine.SpyObj<MoodleService>;
    validationService = TestBed.inject(ValidationService) as jasmine.SpyObj<ValidationService>;
    errorHandlerService = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
    sanitizationService = TestBed.inject(SanitizationService) as jasmine.SpyObj<SanitizationService>;
    loggerService = TestBed.inject(LoggerService) as jasmine.SpyObj<LoggerService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization', () => {
    it('should initialize the login form with validators', () => {
      expect(component.loginForm).toBeDefined();
      expect(component.loginForm.get('site')).toBeDefined();
      expect(component.loginForm.get('username')).toBeDefined();
      expect(component.loginForm.get('password')).toBeDefined();
    });

    it('should have required validators on all fields', () => {
      const siteControl = component.loginForm.get('site');
      const usernameControl = component.loginForm.get('username');
      const passwordControl = component.loginForm.get('password');

      siteControl?.setValue('');
      usernameControl?.setValue('');
      passwordControl?.setValue('');

      expect(siteControl?.hasError('required')).toBe(true);
      expect(usernameControl?.hasError('required')).toBe(true);
      expect(passwordControl?.hasError('required')).toBe(true);
    });

    it('should have custom validators on form fields', () => {
      const siteControl = component.loginForm.get('site');
      const usernameControl = component.loginForm.get('username');
      
      siteControl?.setValue('invalid-url');
      usernameControl?.setValue('a'); // too short

      // Trigger validation
      siteControl?.markAsTouched();
      usernameControl?.markAsTouched();
      fixture.detectChanges();

      expect(siteControl?.invalid).toBe(true);
      expect(usernameControl?.invalid).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should validate Moodle site URL', () => {
      const siteControl = component.loginForm.get('site');
      
      // Test invalid URL
      siteControl?.setValue('not-a-url');
      siteControl?.markAsTouched();
      fixture.detectChanges();
      
      expect(siteControl?.invalid).toBe(true);
      
      // Test valid URL
      siteControl?.setValue('https://moodle.example.com');
      fixture.detectChanges();
      
      expect(siteControl?.valid).toBe(true);
    });

    it('should validate username format', () => {
      const usernameControl = component.loginForm.get('username');
      
      // Test short username
      usernameControl?.setValue('ab');
      usernameControl?.markAsTouched();
      fixture.detectChanges();
      
      expect(usernameControl?.invalid).toBe(true);
      
      // Test valid username
      usernameControl?.setValue('validuser123');
      fixture.detectChanges();
      
      expect(usernameControl?.valid).toBe(true);
    });

    it('should show validation errors for invalid inputs', () => {
      validationService.getValidationMessages.and.returnValue(['Field is required']);
      
      const siteControl = component.loginForm.get('site');
      siteControl?.setValue('');
      siteControl?.markAsTouched();
      
      const errors = component.getFieldErrors('site');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Login Process', () => {
    beforeEach(() => {
      // Set up valid form data
      component.loginForm.patchValue({
        site: 'https://moodle.example.com',
        username: 'testuser',
        password: 'testpassword'
      });
      
      sanitizationService.sanitizeUrl.and.returnValue('https://moodle.example.com');
      sanitizationService.sanitizeText.and.returnValue('testuser');
      validationService.validateMoodleLoginData.and.returnValue({
        isValid: true,
        errors: [],
        sanitizedValue: null
      });
    });

    it('should call MoodleService login on valid form submission', async () => {
      moodleService.login.and.returnValue(Promise.resolve({
        token: 'test-token',
        userId: 123,
        userFullName: 'Test User'
      }));

      await component.onSubmit();

      expect(moodleService.login).toHaveBeenCalledWith(
        'https://moodle.example.com',
        'testuser',
        'testpassword'
      );
    });

    it('should handle successful login', async () => {
      const loginResponse = {
        token: 'test-token',
        userId: 123,
        userFullName: 'Test User'
      };
      
      moodleService.login.and.returnValue(Promise.resolve(loginResponse));

      await component.onSubmit();

      expect(component.isLoading).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should handle login failure', async () => {
      const error = new Error('Invalid credentials');
      moodleService.login.and.returnValue(Promise.reject(error));

      await component.onSubmit();

      expect(component.isLoading).toBe(false);
      expect(errorHandlerService.handleMoodleError).toHaveBeenCalledWith(
        error,
        'Login failed'
      );
    });

    it('should prevent submission with invalid form', async () => {
      component.loginForm.patchValue({
        site: '',
        username: '',
        password: ''
      });

      await component.onSubmit();

      expect(moodleService.login).not.toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous submissions', async () => {
      component.isLoading = true;
      
      await component.onSubmit();
      
      expect(moodleService.login).not.toHaveBeenCalled();
    });
  });

  describe('Connection Testing', () => {
    it('should test Moodle connection', async () => {
      const siteUrl = 'https://moodle.example.com';
      sanitizationService.sanitizeUrl.and.returnValue(siteUrl);
      moodleService.validateConnection.and.returnValue(Promise.resolve(true));

      await component.testConnection();

      expect(sanitizationService.sanitizeUrl).toHaveBeenCalled();
      expect(moodleService.validateConnection).toHaveBeenCalledWith(siteUrl);
    });

    it('should handle connection test success', async () => {
      sanitizationService.sanitizeUrl.and.returnValue('https://moodle.example.com');
      moodleService.validateConnection.and.returnValue(Promise.resolve(true));

      await component.testConnection();

      expect(component.connectionStatus).toBe('success');
    });

    it('should handle connection test failure', async () => {
      sanitizationService.sanitizeUrl.and.returnValue('https://moodle.example.com');
      moodleService.validateConnection.and.returnValue(Promise.resolve(false));

      await component.testConnection();

      expect(component.connectionStatus).toBe('error');
    });

    it('should handle connection test error', async () => {
      const error = new Error('Network error');
      sanitizationService.sanitizeUrl.and.returnValue('https://moodle.example.com');
      moodleService.validateConnection.and.returnValue(Promise.reject(error));

      await component.testConnection();

      expect(component.connectionStatus).toBe('error');
      expect(errorHandlerService.handleHttpError).toHaveBeenCalledWith(
        error,
        'Connection test failed'
      );
    });

    it('should require valid site URL for connection test', async () => {
      component.loginForm.patchValue({ site: '' });

      await component.testConnection();

      expect(moodleService.validateConnection).not.toHaveBeenCalled();
    });
  });

  describe('Form Helpers', () => {
    it('should check if form has errors', () => {
      validationService.hasFormErrors.and.returnValue(true);
      
      const hasErrors = component.hasFormErrors();
      
      expect(validationService.hasFormErrors).toHaveBeenCalledWith(component.loginForm);
      expect(hasErrors).toBe(true);
    });

    it('should get field errors', () => {
      const mockErrors = ['Field is required'];
      validationService.getValidationMessages.and.returnValue(mockErrors);
      
      const errors = component.getFieldErrors('site');
      
      expect(validationService.getValidationMessages).toHaveBeenCalled();
      expect(errors).toEqual(mockErrors);
    });

    it('should check if field is invalid', () => {
      const siteControl = component.loginForm.get('site');
      siteControl?.setValue('');
      siteControl?.markAsTouched();
      
      const isInvalid = component.isFieldInvalid('site');
      
      expect(isInvalid).toBe(true);
    });

    it('should check if field is valid and touched', () => {
      const siteControl = component.loginForm.get('site');
      siteControl?.setValue('https://moodle.example.com');
      siteControl?.markAsTouched();
      
      const isValidAndTouched = component.isFieldValidAndTouched('site');
      
      expect(isValidAndTouched).toBe(true);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize form data before submission', async () => {
      component.loginForm.patchValue({
        site: 'https://moodle.example.com',
        username: 'testuser',
        password: 'testpassword'
      });

      sanitizationService.sanitizeUrl.and.returnValue('https://moodle.example.com');
      sanitizationService.sanitizeText.and.returnValue('testuser');
      validationService.validateMoodleLoginData.and.returnValue({
        isValid: true,
        errors: [],
        sanitizedValue: null
      });
      moodleService.login.and.returnValue(Promise.resolve({
        token: 'test-token',
        userId: 123,
        userFullName: 'Test User'
      }));

      await component.onSubmit();

      expect(sanitizationService.sanitizeUrl).toHaveBeenCalledWith('https://moodle.example.com');
      expect(sanitizationService.sanitizeText).toHaveBeenCalledWith('testuser');
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors during submission', async () => {
      validationService.validateMoodleLoginData.and.returnValue({
        isValid: false,
        errors: ['Invalid URL', 'Username too short'],
        sanitizedValue: null
      });

      await component.onSubmit();

      expect(moodleService.login).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const networkError = { status: 0, message: 'Network unavailable' };
      moodleService.login.and.returnValue(Promise.reject(networkError));

      await component.onSubmit();

      expect(errorHandlerService.handleMoodleError).toHaveBeenCalledWith(
        networkError,
        'Login failed'
      );
    });

    it('should handle Moodle API errors', async () => {
      const moodleError = { error: 'Invalid token', exception: 'moodle_exception' };
      moodleService.login.and.returnValue(Promise.reject(moodleError));

      await component.onSubmit();

      expect(errorHandlerService.handleMoodleError).toHaveBeenCalledWith(
        moodleError,
        'Login failed'
      );
    });
  });

  describe('UI State Management', () => {
    it('should show loading state during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });
      
      moodleService.login.and.returnValue(loginPromise);

      const submitPromise = component.onSubmit();
      
      expect(component.isLoading).toBe(true);
      
      resolveLogin!({
        token: 'test-token',
        userId: 123,
        userFullName: 'Test User'
      });
      
      await submitPromise;
      
      expect(component.isLoading).toBe(false);
    });

    it('should show loading state during connection test', async () => {
      let resolveConnection: (value: any) => void;
      const connectionPromise = new Promise(resolve => {
        resolveConnection = resolve;
      });
      
      sanitizationService.sanitizeUrl.and.returnValue('https://moodle.example.com');
      moodleService.validateConnection.and.returnValue(connectionPromise);

      const testPromise = component.testConnection();
      
      expect(component.isTestingConnection).toBe(true);
      
      resolveConnection!(true);
      
      await testPromise;
      
      expect(component.isTestingConnection).toBe(false);
    });

    it('should reset connection status when site URL changes', () => {
      component.connectionStatus = 'success';
      
      const siteControl = component.loginForm.get('site');
      siteControl?.setValue('https://different.moodle.com');
      
      expect(component.connectionStatus).toBe(null);
    });
  });
}); 