import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ValidationService } from './validation.service';
import { SanitizationService } from './sanitization.service';
import { ErrorHandlerService } from './error-handler.service';

describe('ValidationService', () => {
  let service: ValidationService;
  let sanitizationService: jasmine.SpyObj<SanitizationService>;
  let errorHandlerService: jasmine.SpyObj<ErrorHandlerService>;

  beforeEach(() => {
    const sanitizationSpy = jasmine.createSpyObj('SanitizationService', [
      'isValidEmail',
      'isValidUrl',
      'isValidMoodleUrl',
      'isValidUsername',
      'isValidPhone',
      'containsDangerousContent',
      'sanitizeText'
    ]);

    const errorHandlerSpy = jasmine.createSpyObj('ErrorHandlerService', [
      'handleError',
      'createError'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ValidationService,
        { provide: SanitizationService, useValue: sanitizationSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerSpy }
      ]
    });

    service = TestBed.inject(ValidationService);
    sanitizationService = TestBed.inject(SanitizationService) as jasmine.SpyObj<SanitizationService>;
    errorHandlerService = TestBed.inject(ErrorHandlerService) as jasmine.SpyObj<ErrorHandlerService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Email Validator', () => {
    it('should return null for valid email', () => {
      const control = new FormControl('test@example.com');
      const validator = ValidationService.emailValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for invalid email', () => {
      const control = new FormControl('invalid-email');
      const validator = ValidationService.emailValidator();
      const result = validator(control);
      expect(result).toEqual({
        email: {
          message: 'Please enter a valid email address'
        }
      });
    });

    it('should return null for empty value', () => {
      const control = new FormControl('');
      const validator = ValidationService.emailValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('URL Validator', () => {
    it('should return null for valid URL', () => {
      const control = new FormControl('https://example.com');
      const validator = ValidationService.urlValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for invalid URL', () => {
      const control = new FormControl('not-a-url');
      const validator = ValidationService.urlValidator();
      const result = validator(control);
      expect(result).toEqual({
        url: {
          message: 'Please enter a valid URL (must start with http:// or https://)'
        }
      });
    });
  });

  describe('Moodle URL Validator', () => {
    it('should return null for valid Moodle URL', () => {
      const control = new FormControl('https://moodle.example.com');
      const validator = ValidationService.moodleUrlValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return warning for URL without Moodle indicators', () => {
      const control = new FormControl('https://generic-site.com');
      const validator = ValidationService.moodleUrlValidator();
      const result = validator(control);
      expect(result).toEqual({
        moodleUrl: {
          message: 'This URL may not be a Moodle site. Please verify the URL is correct.',
          warning: true
        }
      });
    });

    it('should return error for invalid URL format', () => {
      const control = new FormControl('ftp://moodle.com');
      const validator = ValidationService.moodleUrlValidator();
      const result = validator(control);
      expect(result).toEqual({
        moodleUrl: {
          message: 'Please enter a valid Moodle URL (e.g., https://moodle.example.com)'
        }
      });
    });
  });

  describe('Username Validator', () => {
    it('should return null for valid username', () => {
      const control = new FormControl('validuser123');
      const validator = ValidationService.usernameValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for short username', () => {
      const control = new FormControl('ab');
      const validator = ValidationService.usernameValidator();
      const result = validator(control);
      expect(result).toEqual({
        username: {
          message: 'Username must be at least 3 characters long'
        }
      });
    });

    it('should return error for invalid characters', () => {
      const control = new FormControl('user@domain');
      const validator = ValidationService.usernameValidator();
      const result = validator(control);
      expect(result).toEqual({
        username: {
          message: 'Username can only contain letters, numbers, dots, underscores, and hyphens'
        }
      });
    });
  });

  describe('Password Validator', () => {
    it('should return null for strong password', () => {
      const control = new FormControl('StrongPass123');
      const validator = ValidationService.passwordValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for short password', () => {
      const control = new FormControl('weak');
      const validator = ValidationService.passwordValidator();
      const result = validator(control);
      expect(result).toEqual({
        password: {
          minLength: { message: 'Password must be at least 8 characters long' },
          uppercase: { message: 'Password must contain at least one uppercase letter' },
          number: { message: 'Password must contain at least one number' }
        }
      });
    });

    it('should return error for password without uppercase', () => {
      const control = new FormControl('lowercase123');
      const validator = ValidationService.passwordValidator();
      const result = validator(control);
      expect(result).toEqual({
        password: {
          uppercase: { message: 'Password must contain at least one uppercase letter' }
        }
      });
    });

    it('should accept custom minimum length', () => {
      const control = new FormControl('short');
      const validator = ValidationService.passwordValidator(10);
      const result = validator(control);
      expect(result).toEqual({
        password: {
          minLength: { message: 'Password must be at least 10 characters long' },
          uppercase: { message: 'Password must contain at least one uppercase letter' },
          number: { message: 'Password must contain at least one number' }
        }
      });
    });
  });

  describe('Phone Validator', () => {
    it('should return null for valid phone', () => {
      const control = new FormControl('+1234567890');
      const validator = ValidationService.phoneValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for invalid phone', () => {
      const control = new FormControl('123');
      const validator = ValidationService.phoneValidator();
      const result = validator(control);
      expect(result).toEqual({
        phone: {
          message: 'Please enter a valid phone number'
        }
      });
    });
  });

  describe('Safe Text Validator', () => {
    it('should return null for safe text', () => {
      const control = new FormControl('Safe text content');
      const validator = ValidationService.safeTextValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for dangerous content', () => {
      const control = new FormControl('<script>alert(1)</script>');
      const validator = ValidationService.safeTextValidator();
      const result = validator(control);
      expect(result).toEqual({
        safeText: {
          message: 'Content contains potentially dangerous elements'
        }
      });
    });
  });

  describe('File Size Validator', () => {
    it('should return null for file within size limit', () => {
      const mockFile = { size: 1024 * 1024 } as File; // 1MB
      const control = new FormControl(mockFile);
      const validator = ValidationService.fileSizeValidator(5 * 1024 * 1024); // 5MB limit
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for file exceeding size limit', () => {
      const mockFile = { size: 10 * 1024 * 1024 } as File; // 10MB
      const control = new FormControl(mockFile);
      const validator = ValidationService.fileSizeValidator(5 * 1024 * 1024); // 5MB limit
      const result = validator(control);
      expect(result).toEqual({
        fileSize: {
          message: 'File size must not exceed 5.0 MB'
        }
      });
    });

    it('should return null for non-file value', () => {
      const control = new FormControl('not a file');
      const validator = ValidationService.fileSizeValidator(5 * 1024 * 1024);
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('File Type Validator', () => {
    it('should return null for allowed file type', () => {
      const mockFile = { name: 'document.pdf', type: 'application/pdf' } as File;
      const control = new FormControl(mockFile);
      const validator = ValidationService.fileTypeValidator(['pdf', 'doc']);
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should return error for disallowed file type', () => {
      const mockFile = { name: 'script.exe', type: 'application/octet-stream' } as File;
      const control = new FormControl(mockFile);
      const validator = ValidationService.fileTypeValidator(['pdf', 'doc']);
      const result = validator(control);
      expect(result).toEqual({
        fileType: {
          message: 'File type not allowed. Allowed types: pdf, doc'
        }
      });
    });

    it('should return null for non-file value', () => {
      const control = new FormControl('not a file');
      const validator = ValidationService.fileTypeValidator(['pdf']);
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('Password Match Validator', () => {
    it('should return null for matching passwords', () => {
      const form = new FormGroup({
        password: new FormControl('password123'),
        confirmPassword: new FormControl('password123')
      });
      const validator = ValidationService.passwordMatchValidator('password', 'confirmPassword');
      const result = validator(form);
      expect(result).toBeNull();
    });

    it('should return error for non-matching passwords', () => {
      const form = new FormGroup({
        password: new FormControl('password123'),
        confirmPassword: new FormControl('different456')
      });
      const validator = ValidationService.passwordMatchValidator('password', 'confirmPassword');
      const result = validator(form);
      expect(result).toEqual({
        passwordMatch: {
          message: 'Passwords do not match'
        }
      });
    });

    it('should return null when either field is missing', () => {
      const form = new FormGroup({
        password: new FormControl('password123')
      });
      const validator = ValidationService.passwordMatchValidator('password', 'confirmPassword');
      const result = validator(form);
      expect(result).toBeNull();
    });
  });

  describe('Instance Methods', () => {
    beforeEach(() => {
      sanitizationService.sanitizeText.and.callFake((text: string) => text);
    });

    it('should validate field with config', () => {
      const result = service.validateField('test@example.com', {
        required: true,
        sanitize: true
      });
      expect(result.isValid).toBe(true);
    });

    it('should sanitize form data', () => {
      const formData = {
        text: '<script>alert(1)</script>Clean text',
        number: 123
      };
      
      const result = service.sanitizeFormData(formData);
      expect(sanitizationService.sanitizeText).toHaveBeenCalled();
    });

    it('should validate Moodle login data', () => {
      sanitizationService.isValidMoodleUrl.and.returnValue(true);
      sanitizationService.isValidUsername.and.returnValue(true);

      const result = service.validateMoodleLoginData({
        site: 'https://moodle.example.com',
        username: 'validuser',
        password: 'password123'
      });

      expect(result.isValid).toBe(true);
    });

    it('should detect form errors', () => {
      const form = new FormGroup({
        email: new FormControl('')
      });
      
      form.get('email')?.setErrors({ required: true });
      
      expect(service.hasFormErrors(form)).toBe(true);
    });

    it('should get form errors', () => {
      const form = new FormGroup({
        email: new FormControl('')
      });
      
      form.get('email')?.setErrors({
        email: { message: 'Invalid email' }
      });
      
      const errors = service.getFormErrors(form);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
}); 