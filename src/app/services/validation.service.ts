import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn, FormGroup } from '@angular/forms';
import { SanitizationService } from './sanitization.service';
import { ErrorHandlerService } from './error-handler.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export interface FieldValidationConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => string | null;
  sanitize?: boolean;
  allowHtml?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ValidationService {
  constructor(
    private sanitization: SanitizationService,
    private errorHandler: ErrorHandlerService
  ) {}

  /**
   * Custom validator for email addresses
   */
  static emailValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const email = control.value.trim().toLowerCase();
      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      if (!emailPattern.test(email)) {
        return { email: { message: 'Please enter a valid email address' } };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for URLs
   */
  static urlValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const url = control.value.trim();
      const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
      
      if (!urlPattern.test(url)) {
        return { url: { message: 'Please enter a valid URL (must start with http:// or https://)' } };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for Moodle URLs
   */
  static moodleUrlValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const url = control.value.trim();
      
      // Basic URL validation first
      const urlPattern = /^https?:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9]+(:[0-9]+)?(\/.*)?$/;
      
      if (!urlPattern.test(url)) {
        return { 
          moodleUrl: { 
            message: 'Please enter a valid Moodle URL (e.g., https://moodle.example.com)' 
          } 
        };
      }

      // Check for common Moodle indicators (optional but helpful)
      const moodleIndicators = [
        'moodle', 'lms', 'elearning', 'learn', 'education', 'course', 'campus'
      ];
      
      const hasIndicator = moodleIndicators.some(indicator => 
        url.toLowerCase().includes(indicator)
      );
      
      if (!hasIndicator && !url.includes('login/token.php')) {
        return {
          moodleUrl: {
            message: 'This URL may not be a Moodle site. Please verify the URL is correct.',
            warning: true
          }
        };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for usernames
   */
  static usernameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const username = control.value.trim();
      
      if (username.length < 3) {
        return { username: { message: 'Username must be at least 3 characters long' } };
      }
      
      if (username.length > 50) {
        return { username: { message: 'Username must be less than 50 characters long' } };
      }
      
      const usernamePattern = /^[a-zA-Z0-9._-]+$/;
      if (!usernamePattern.test(username)) {
        return { 
          username: { 
            message: 'Username can only contain letters, numbers, dots, underscores, and hyphens' 
          } 
        };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for passwords
   */
  static passwordValidator(minLength: number = 8): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const password = control.value;
      const errors: any = {};
      
      if (password.length < minLength) {
        errors.minLength = { message: `Password must be at least ${minLength} characters long` };
      }
      
      if (!/[A-Z]/.test(password)) {
        errors.uppercase = { message: 'Password must contain at least one uppercase letter' };
      }
      
      if (!/[a-z]/.test(password)) {
        errors.lowercase = { message: 'Password must contain at least one lowercase letter' };
      }
      
      if (!/[0-9]/.test(password)) {
        errors.number = { message: 'Password must contain at least one number' };
      }
      
      if (Object.keys(errors).length > 0) {
        return { password: errors };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for phone numbers
   */
  static phoneValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const phone = control.value.replace(/[^\d+]/g, '');
      const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
      
      if (!phonePattern.test(phone)) {
        return { 
          phone: { 
            message: 'Please enter a valid phone number' 
          } 
        };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for safe text (no XSS)
   */
  static safeTextValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const text = control.value;
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
      ];
      
      const hasDangerousContent = dangerousPatterns.some(pattern => pattern.test(text));
      
      if (hasDangerousContent) {
        return { 
          safeText: { 
            message: 'Input contains potentially dangerous content and will be sanitized' 
          } 
        };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for file size
   */
  static fileSizeValidator(maxSizeBytes: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const file = control.value;
      
      if (file instanceof File && file.size > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
        return { 
          fileSize: { 
            message: `File size must be less than ${maxSizeMB} MB` 
          } 
        };
      }
      
      return null;
    };
  }

  /**
   * Custom validator for allowed file types
   */
  static fileTypeValidator(allowedTypes: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const file = control.value;
      
      if (file instanceof File) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          return { 
            fileType: { 
              message: `File type must be one of: ${allowedTypes.join(', ')}` 
            } 
          };
        }
      }
      
      return null;
    };
  }

  /**
   * Custom validator to confirm password matches
   */
  static passwordMatchValidator(passwordField: string, confirmPasswordField: string): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const password = formGroup.get(passwordField);
      const confirmPassword = formGroup.get(confirmPasswordField);
      
      if (!password || !confirmPassword) return null;
      
      if (password.value !== confirmPassword.value) {
        confirmPassword.setErrors({ 
          passwordMatch: { message: 'Passwords do not match' } 
        });
        return { passwordMatch: true };
      } else {
        // Clear the error if passwords match
        const errors = confirmPassword.errors;
        if (errors) {
          delete errors['passwordMatch'];
          confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
      
      return null;
    };
  }

  /**
   * Validate a single field with configuration
   */
  validateField(value: any, config: FieldValidationConfig): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    try {
      // Sanitize if requested
      if (config.sanitize && typeof value === 'string') {
        sanitizedValue = config.allowHtml 
          ? this.sanitization.sanitizeHtml(value, { allowBasicHtml: true })
          : this.sanitization.sanitizeText(value);
      }

      // Required validation
      if (config.required && (!sanitizedValue || sanitizedValue.toString().trim().length === 0)) {
        errors.push('This field is required');
      }

      // Only continue with other validations if we have a value
      if (sanitizedValue && sanitizedValue.toString().trim().length > 0) {
        const stringValue = sanitizedValue.toString();

        // Length validations
        if (config.minLength && stringValue.length < config.minLength) {
          errors.push(`Must be at least ${config.minLength} characters long`);
        }

        if (config.maxLength && stringValue.length > config.maxLength) {
          errors.push(`Must be less than ${config.maxLength} characters long`);
        }

        // Pattern validation
        if (config.pattern && !config.pattern.test(stringValue)) {
          errors.push('Invalid format');
        }

        // Custom validation
        if (config.customValidator) {
          const customError = config.customValidator(sanitizedValue);
          if (customError) {
            errors.push(customError);
          }
        }

        // Check for dangerous content if not allowing HTML
        if (!config.allowHtml && typeof sanitizedValue === 'string') {
          if (this.sanitization.containsDangerousContent(sanitizedValue)) {
            errors.push('Input contains potentially dangerous content');
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedValue
      };

    } catch (error) {
      this.errorHandler.reportError('Validation error occurred', 'Field validation');
      return {
        isValid: false,
        errors: ['Validation failed'],
        sanitizedValue: value
      };
    }
  }

  /**
   * Validate an entire form with field configurations
   */
  validateForm(formData: any, fieldConfigs: { [key: string]: FieldValidationConfig }): ValidationResult {
    const allErrors: string[] = [];
    const sanitizedData: any = {};

    for (const [fieldName, config] of Object.entries(fieldConfigs)) {
      const fieldValue = formData[fieldName];
      const result = this.validateField(fieldValue, config);
      
      if (!result.isValid) {
        result.errors.forEach(error => {
          allErrors.push(`${fieldName}: ${error}`);
        });
      }

      sanitizedData[fieldName] = result.sanitizedValue;
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      sanitizedValue: sanitizedData
    };
  }

  /**
   * Get validation error message from Angular form control
   */
  getValidationMessage(control: AbstractControl, fieldName: string = 'Field'): string {
    if (!control.errors) return '';

    // Handle nested error objects (from custom validators)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_errorKey, errorValue] of Object.entries(control.errors)) {
      if (typeof errorValue === 'object' && errorValue !== null) {
        if ('message' in errorValue) {
          return errorValue.message as string;
        }
        
        // Handle nested validation errors (like password validator)
        if (typeof errorValue === 'object') {
          for (const nestedError of Object.values(errorValue)) {
            if (typeof nestedError === 'object' && nestedError !== null && 'message' in nestedError) {
              return nestedError.message as string;
            }
          }
        }
      }
    }

    // Handle standard Angular validators
    if (control.errors['required']) {
      return `${fieldName} is required`;
    }

    if (control.errors['email']) {
      return 'Please enter a valid email address';
    }

    if (control.errors['minlength']) {
      const requiredLength = control.errors['minlength'].requiredLength;
      return `${fieldName} must be at least ${requiredLength} characters long`;
    }

    if (control.errors['maxlength']) {
      const requiredLength = control.errors['maxlength'].requiredLength;
      return `${fieldName} must be less than ${requiredLength} characters long`;
    }

    if (control.errors['pattern']) {
      return `${fieldName} format is invalid`;
    }

    if (control.errors['min']) {
      return `${fieldName} must be at least ${control.errors['min'].min}`;
    }

    if (control.errors['max']) {
      return `${fieldName} must be no more than ${control.errors['max'].max}`;
    }

    // Default error message
    return `${fieldName} is invalid`;
  }

  /**
   * Sanitize form data before submission
   */
  sanitizeFormData(formData: any, allowHtml: boolean = false): any {
    return this.sanitization.sanitizeObject(formData, {
      allowBasicHtml: allowHtml,
      trimWhitespace: true
    });
  }

  /**
   * Validate business rules for Moodle login
   */
  validateMoodleLoginData(loginData: { site: string; username: string; password: string }): ValidationResult {
    const fieldConfigs: { [key: string]: FieldValidationConfig } = {
      site: {
        required: true,
        sanitize: true,
        customValidator: (value) => {
          if (!this.sanitization.isValidMoodleUrl(value)) {
            return 'Please enter a valid Moodle URL';
          }
          return null;
        }
      },
      username: {
        required: true,
        minLength: 3,
        maxLength: 50,
        sanitize: true,
        customValidator: (value) => {
          if (!this.sanitization.isValidUsername(value)) {
            return 'Username contains invalid characters';
          }
          return null;
        }
      },
      password: {
        required: true,
        minLength: 1, // Moodle passwords can be simple
        sanitize: false // Don't sanitize passwords
      }
    };

    return this.validateForm(loginData, fieldConfigs);
  }

  /**
   * Check if form has any validation errors
   */
  hasFormErrors(formGroup: FormGroup): boolean {
    if (formGroup.invalid) return true;

    // Check all controls recursively
    for (const control of Object.values(formGroup.controls)) {
      if (control instanceof FormGroup) {
        if (this.hasFormErrors(control)) return true;
      } else if (control.invalid) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all form validation errors
   */
  getFormErrors(formGroup: FormGroup): string[] {
    const errors: string[] = [];

    for (const [fieldName, control] of Object.entries(formGroup.controls)) {
      if (control.invalid) {
        const message = this.getValidationMessage(control, fieldName);
        if (message) {
          errors.push(message);
        }
      }
    }

    return errors;
  }
} 