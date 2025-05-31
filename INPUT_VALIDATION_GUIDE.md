# Input Validation & Sanitization System - Implementation Guide

## Overview

MoodleNG now includes a comprehensive input validation and sanitization system that provides:

- **XSS Prevention**: Automatic sanitization of dangerous HTML and scripts
- **Input Validation**: Custom Angular validators for forms and data integrity
- **Real-time Sanitization**: Directives that clean input as users type
- **Business Rule Validation**: Moodle-specific validation (URLs, usernames, etc.)
- **Security-First Approach**: All user input is sanitized before processing

## Architecture

### Core Components

1. **SanitizationService** (`src/app/services/sanitization.service.ts`)
   - XSS prevention and content sanitization
   - URL, email, username, phone number sanitization
   - Safe HTML creation for Angular templates

2. **ValidationService** (`src/app/services/validation.service.ts`)
   - Custom Angular form validators
   - Business rule validation
   - Integration with sanitization service

3. **Input Directives** (`src/app/directives/input-sanitizer.directive.ts`)
   - Real-time input sanitization
   - Automatic input cleaning on blur/input events
   - Prevention of dangerous content injection

## Security Features

### 🛡️ XSS Prevention

**Automatic Script Removal**:
```typescript
// Removes dangerous content automatically
const clean = sanitizationService.sanitizeText('<script>alert("xss")</script>Hello');
// Result: "Hello"
```

**Safe HTML Handling**:
```typescript
// Creates safe HTML for templates
const safeHtml = sanitizationService.createSafeHtml(userContent, {
  allowBasicHtml: true,
  allowLinks: true,
  allowImages: false
});
```

### 🔒 Input Sanitization

**Real-time Cleaning**:
- Username fields automatically remove invalid characters
- URLs are automatically formatted with https://
- Email addresses are normalized (lowercase, trimmed)
- Phone numbers allow only digits and + prefix

**Dangerous Content Detection**:
```typescript
const isDangerous = sanitizationService.containsDangerousContent(input);
if (isDangerous) {
  // Content will be sanitized before processing
}
```

## Usage Guide

### Basic Form Validation

```typescript
import { ValidationService } from './services/validation.service';

// In component constructor
constructor(
  private fb: FormBuilder,
  private validationService: ValidationService
) {
  this.form = this.fb.group({
    email: ['', [
      Validators.required,
      ValidationService.emailValidator()
    ]],
    website: ['', [
      ValidationService.urlValidator()
    ]],
    username: ['', [
      Validators.required,
      ValidationService.usernameValidator()
    ]]
  });
}

// Get validation error messages
getFieldError(fieldName: string): string {
  const control = this.form.get(fieldName);
  if (control && control.invalid && (control.dirty || control.touched)) {
    return this.validationService.getValidationMessage(control, fieldName);
  }
  return '';
}
```

### Template Integration

```html
<!-- Automatic sanitization directives -->
<input 
  matInput 
  formControlName="username"
  appSanitizeUsername
  appPreventDangerousInput
/>

<input 
  matInput 
  formControlName="website"
  appSanitizeUrl
  appPreventDangerousInput
/>

<input 
  matInput 
  formControlName="email"
  appSanitizeEmail
/>

<!-- Display validation errors -->
<mat-error *ngIf="hasFieldError('username')">
  {{ getFieldError('username') }}
</mat-error>
```

### Custom Validation

```typescript
// Validate entire form with business rules
const validationResult = this.validationService.validateMoodleLoginData({
  site: this.form.value.site,
  username: this.form.value.username,
  password: this.form.value.password
});

if (!validationResult.isValid) {
  this.errorHandler.handleValidationError(
    validationResult.errors.join('. '), 
    'Login form'
  );
  return;
}

// Use sanitized values
const { site, username, password } = validationResult.sanitizedValue;
```

## Available Validators

### Built-in Validators

| Validator | Purpose | Example |
|-----------|---------|---------|
| `emailValidator()` | Email format validation | `user@example.com` |
| `urlValidator()` | URL format validation | `https://example.com` |
| `moodleUrlValidator()` | Moodle-specific URL validation | `https://moodle.school.edu` |
| `usernameValidator()` | Username format (3-50 chars, alphanumeric + ._-) | `user123` |
| `passwordValidator(minLength)` | Password strength validation | Min length + complexity |
| `phoneValidator()` | Phone number validation | `+1234567890` |
| `safeTextValidator()` | XSS content detection | Detects dangerous scripts |
| `fileSizeValidator(maxBytes)` | File size validation | Max upload size |
| `fileTypeValidator(allowedTypes)` | File type validation | `['pdf', 'doc', 'jpg']` |

### Custom Validators

```typescript
// Password confirmation
this.form = this.fb.group({
  password: ['', ValidationService.passwordValidator(8)],
  confirmPassword: ['']
}, {
  validators: ValidationService.passwordMatchValidator('password', 'confirmPassword')
});

// File upload validation
fileControl: ['', [
  ValidationService.fileSizeValidator(5 * 1024 * 1024), // 5MB
  ValidationService.fileTypeValidator(['pdf', 'doc', 'docx'])
]]
```

## Available Directives

### Input Sanitization Directives

| Directive | Purpose | Usage |
|-----------|---------|-------|
| `appSanitizeInput` | General text sanitization | `<input appSanitizeInput>` |
| `appSanitizeUrl` | URL sanitization | `<input appSanitizeUrl>` |
| `appSanitizeEmail` | Email sanitization | `<input appSanitizeEmail>` |
| `appSanitizeUsername` | Username sanitization | `<input appSanitizeUsername>` |
| `appSanitizePhone` | Phone number sanitization | `<input appSanitizePhone>` |
| `appPreventDangerousInput` | XSS prevention | `<input appPreventDangerousInput>` |
| `appMaxLength` | Length limiting with visual feedback | `<input appMaxLength="100">` |

### Directive Configuration

```html
<!-- Configure sanitization options -->
<textarea 
  appSanitizeInput
  [sanitizeOptions]="{
    allowBasicHtml: true,
    allowLinks: true,
    maxLength: 1000,
    trimWhitespace: true
  }"
  [sanitizeOnInput]="true"
  [sanitizeOnBlur]="true"
></textarea>

<!-- Length limiting with warning -->
<input 
  appMaxLength="50"
  [showWarning]="true"
  [warningThreshold]="0.8"
/>
```

## Security Benefits

### For Users
- **Protected from XSS**: Malicious scripts are automatically removed
- **Data Integrity**: Invalid characters are prevented/removed
- **Clear Feedback**: Real-time validation shows what's acceptable
- **Consistent Experience**: All inputs behave predictably

### For Developers
- **Automatic Protection**: XSS prevention without manual effort
- **Consistent Validation**: Standardized validation across the app
- **Easy Integration**: Simple directives and validators
- **Type Safety**: TypeScript support for all validation

### For Security
- **Defense in Depth**: Multiple layers of input protection
- **Sanitization Logging**: Dangerous content attempts are logged
- **Business Rule Enforcement**: Moodle-specific validations
- **Token Protection**: Sensitive data is not exposed in errors

## Best Practices

### DO ✅
- Use sanitization directives on all user input fields
- Combine multiple validators for comprehensive validation
- Sanitize data from APIs and external sources
- Validate both client-side and server-side
- Use business-specific validators (like `moodleUrlValidator`)

### DON'T ❌
- Trust user input without sanitization
- Skip validation on "trusted" inputs
- Expose sensitive data in validation error messages
- Disable sanitization for "convenience"
- Forget to validate file uploads

## Implementation Examples

### Login Form Enhancement

```typescript
// Before: Basic validation
this.loginForm = this.fb.group({
  site: ['', Validators.required],
  username: ['', Validators.required],
  password: ['', Validators.required]
});

// After: Comprehensive validation + sanitization
this.loginForm = this.fb.group({
  site: ['', [
    Validators.required,
    ValidationService.moodleUrlValidator()
  ]],
  username: ['', [
    Validators.required,
    ValidationService.usernameValidator()
  ]],
  password: ['', [
    Validators.required,
    Validators.minLength(1)
  ]]
});
```

```html
<!-- Template with sanitization -->
<input 
  matInput 
  formControlName="site"
  placeholder="https://moodle.yourschool.com"
  appSanitizeUrl
  appPreventDangerousInput
  (focus)="onFieldFocus('site')"
/>
<mat-error *ngIf="hasFieldError('site')">
  {{ getFieldError('site') }}
</mat-error>
```

### API Data Sanitization

```typescript
// Sanitize data from external APIs
getUserInfo(): Observable<User> {
  return this.http.get<User>('/api/user').pipe(
    map(user => this.sanitization.sanitizeObject(user, {
      allowBasicHtml: false,
      trimWhitespace: true
    }))
  );
}
```

### File Upload Validation

```typescript
uploadForm = this.fb.group({
  file: ['', [
    Validators.required,
    ValidationService.fileSizeValidator(10 * 1024 * 1024), // 10MB
    ValidationService.fileTypeValidator(['pdf', 'doc', 'docx', 'jpg', 'png'])
  ]],
  description: ['', [
    Validators.maxLength(500),
    ValidationService.safeTextValidator()
  ]]
});
```

## Error Handling Integration

The validation system integrates seamlessly with the error handling system:

```typescript
// Validation errors are automatically handled
if (this.form.invalid) {
  const errors = this.validationService.getFormErrors(this.form);
  this.errorHandler.handleValidationError(
    errors.join('. '), 
    'Form validation'
  );
  return;
}

// Business rule validation
const validationResult = this.validationService.validateMoodleLoginData(formData);
if (!validationResult.isValid) {
  this.errorHandler.handleValidationError(
    validationResult.errors.join('. '),
    'Business rules'
  );
  return;
}
```

## Testing

### Unit Testing Validation

```typescript
describe('ValidationService', () => {
  it('should validate email format', () => {
    const validator = ValidationService.emailValidator();
    
    expect(validator({ value: 'user@example.com' } as AbstractControl)).toBeNull();
    expect(validator({ value: 'invalid-email' } as AbstractControl)).toBeTruthy();
  });

  it('should sanitize dangerous content', () => {
    const result = service.sanitizeText('<script>alert("xss")</script>Hello');
    expect(result).toBe('Hello');
  });
});
```

### Integration Testing

```typescript
describe('Login Component', () => {
  it('should sanitize and validate login inputs', () => {
    component.loginForm.patchValue({
      site: 'moodle.example.com',
      username: 'user@123',
      password: 'password'
    });

    expect(component.loginForm.get('site')?.value).toBe('https://moodle.example.com');
    expect(component.loginForm.get('username')?.value).toBe('user123');
  });
});
```

## Performance Considerations

- **Lazy Sanitization**: Only sanitizes when necessary
- **Efficient Patterns**: Uses optimized regex patterns
- **Debounced Validation**: Real-time validation is debounced
- **Memory Safe**: Proper cleanup in directives

## Migration Guide

### Updating Existing Forms

1. **Add Validators**: Replace basic validators with custom ones
2. **Add Directives**: Apply sanitization directives to inputs
3. **Update Error Handling**: Use `getFieldError()` method
4. **Test Thoroughly**: Ensure all validation scenarios work

### Backward Compatibility

- Existing forms continue to work without changes
- New validation is opt-in via directives and validators
- No breaking changes to existing APIs

---

This input validation and sanitization system provides a robust foundation for application security. It automatically protects against XSS attacks, ensures data integrity, and provides excellent user experience with clear validation feedback. 