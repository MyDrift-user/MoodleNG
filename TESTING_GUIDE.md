# MoodleNG Testing Guide

## 📋 Overview

This guide provides comprehensive documentation for the testing framework implemented in MoodleNG. The testing strategy ensures code quality, security validation, and regression prevention through automated unit, integration, and component testing.

## 🎯 Testing Strategy

### **Testing Pyramid**
```
    🔺 E2E Tests (Future)
   🔺🔺 Integration Tests  
  🔺🔺🔺 Unit Tests (Current Focus)
```

### **Core Testing Principles**
- **Isolation**: Each test runs independently without side effects
- **Repeatability**: Tests produce consistent results across environments
- **Fast Feedback**: Quick execution for rapid development cycles
- **Comprehensive Coverage**: Security, functionality, and edge cases
- **Documentation**: Tests serve as living documentation

## 🛠️ Testing Infrastructure

### **Framework Stack**
```typescript
// Core Testing Framework
- Jasmine: Test runner and assertion library
- Karma: Test automation and browser integration
- Angular Testing Utilities: Component and service testing
- HttpClientTestingModule: HTTP request mocking
- Angular Material Testing: UI component testing
```

### **Key Testing Utilities**
```typescript
// Essential Testing Imports
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
```

## 📁 Test Organization

### **File Structure**
```
src/
├── app/
│   ├── components/
│   │   └── login/
│   │       ├── login.component.ts
│   │       ├── login.component.spec.ts      # Component tests
│   │       └── login.component.html
│   ├── services/
│   │   ├── sanitization.service.ts
│   │   ├── sanitization.service.spec.ts    # Service tests
│   │   ├── validation.service.ts
│   │   ├── validation.service.spec.ts
│   │   ├── error-handler.service.ts
│   │   └── error-handler.service.spec.ts
│   └── app.component.spec.ts               # App-level tests
```

### **Naming Conventions**
- **Test Files**: `*.spec.ts` suffix
- **Test Suites**: `describe('ClassName', () => {})`
- **Test Cases**: `it('should do something', () => {})`
- **Test Groups**: Nested `describe()` blocks for logical grouping

## 🔒 Security Testing Coverage

### **SanitizationService Tests**
```typescript
// XSS Prevention Testing
describe('Text Sanitization', () => {
  it('should sanitize XSS attempts', () => {
    const maliciousText = '<script>alert("xss")</script>Hello';
    const sanitized = service.sanitizeText(maliciousText);
    expect(sanitized).toBe('Hello');
    expect(sanitized).not.toContain('<script>');
  });
});

// Dangerous Content Detection
describe('Dangerous Content Detection', () => {
  it('should detect script tags', () => {
    expect(service.containsDangerousContent('<script>alert(1)</script>')).toBe(true);
    expect(service.containsDangerousContent('safe text')).toBe(false);
  });
});
```

### **Validation Testing**
```typescript
// Form Validation Testing
describe('Email Validator', () => {
  it('should return null for valid email', () => {
    const control = new FormControl('test@example.com');
    const validator = ValidationService.emailValidator();
    const result = validator(control);
    expect(result).toBeNull();
  });
});
```

## 🎛️ Service Testing Patterns

### **Service Mock Setup**
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let dependencyMock: jasmine.SpyObj<DependencyService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('DependencyService', ['method1', 'method2']);
    
    TestBed.configureTestingModule({
      providers: [
        ServiceName,
        { provide: DependencyService, useValue: spy }
      ]
    });

    service = TestBed.inject(ServiceName);
    dependencyMock = TestBed.inject(DependencyService) as jasmine.SpyObj<DependencyService>;
  });
});
```

### **Error Handling Testing**
```typescript
describe('Error Handling', () => {
  it('should handle validation errors', () => {
    const error = new Error('Invalid input');
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
```

## 🧩 Component Testing Patterns

### **Component Test Setup**
```typescript
describe('ComponentName', () => {
  let component: ComponentName;
  let fixture: ComponentFixture<ComponentName>;
  let serviceMock: jasmine.SpyObj<ServiceName>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('ServiceName', ['method1', 'method2']);

    await TestBed.configureTestingModule({
      imports: [
        ComponentName,
        ReactiveFormsModule,
        HttpClientTestingModule,
        MatSnackBarModule,
        BrowserAnimationsModule
      ],
      providers: [
        { provide: ServiceName, useValue: spy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentName);
    component = fixture.componentInstance;
    serviceMock = TestBed.inject(ServiceName) as jasmine.SpyObj<ServiceName>;
    
    fixture.detectChanges();
  });
});
```

### **Form Testing**
```typescript
describe('Form Validation', () => {
  it('should validate required fields', () => {
    const formControl = component.loginForm.get('username');
    formControl?.setValue('');
    
    expect(formControl?.hasError('required')).toBe(true);
  });

  it('should show validation errors', () => {
    const formControl = component.loginForm.get('email');
    formControl?.setValue('invalid-email');
    formControl?.markAsTouched();
    
    expect(component.hasFieldError('email')).toBe(true);
  });
});
```

## 🔄 Async Testing Patterns

### **Promise Testing**
```typescript
describe('Async Operations', () => {
  it('should handle successful login', async () => {
    const loginResponse = { token: 'test-token', userId: 123 };
    serviceMock.login.and.returnValue(of(loginResponse));

    await component.onSubmit();

    expect(component.loading).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
```

### **Observable Testing**
```typescript
import { of, throwError } from 'rxjs';

describe('Observable Testing', () => {
  it('should handle observable success', () => {
    serviceMock.getData.and.returnValue(of(mockData));
    
    component.loadData();
    
    expect(component.data).toEqual(mockData);
  });

  it('should handle observable error', () => {
    serviceMock.getData.and.returnValue(throwError('Error'));
    
    component.loadData();
    
    expect(errorHandlerSpy.handleError).toHaveBeenCalled();
  });
});
```

## 🎭 Advanced Mocking Techniques

### **Spy Configuration**
```typescript
// Return Values
serviceMock.method.and.returnValue(value);
serviceMock.asyncMethod.and.returnValue(Promise.resolve(value));
serviceMock.observableMethod.and.returnValue(of(value));

// Call Through to Real Implementation
serviceMock.method.and.callThrough();

// Custom Implementation
serviceMock.method.and.callFake((param) => {
  return `processed-${param}`;
});

// Throw Errors
serviceMock.method.and.throwError('Test error');
```

### **Verification Patterns**
```typescript
// Method Called
expect(serviceMock.method).toHaveBeenCalled();

// Method Called With Parameters
expect(serviceMock.method).toHaveBeenCalledWith('expected', 'parameters');

// Method Called Multiple Times
expect(serviceMock.method).toHaveBeenCalledTimes(3);

// Method Not Called
expect(serviceMock.method).not.toHaveBeenCalled();

// Call Order Verification
expect(serviceMock.firstMethod).toHaveBeenCalledBefore(serviceMock.secondMethod);
```

## 🏃‍♂️ Running Tests

### **Command Line Options**
```bash
# Run All Tests
npm test

# Run Tests Once (CI Mode)
npm run test:ci

# Run Tests with Coverage
npm run test:coverage

# Run Specific Test File
ng test --include="**/sanitization.service.spec.ts"

# Run Tests in Watch Mode (Default)
ng test --watch

# Run Tests in Headless Mode
ng test --browsers=ChromeHeadless
```

### **Test Configuration**
```typescript
// karma.conf.js
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true
  });
};
```

## 📊 Test Coverage Analysis

### **Coverage Reports**
```bash
# Generate Coverage Report
npm run test:coverage

# View Coverage Report
open coverage/index.html
```

### **Coverage Metrics**
- **Statements**: 90%+ target for critical services
- **Branches**: 85%+ for conditional logic coverage
- **Functions**: 95%+ for public method coverage
- **Lines**: 90%+ overall line coverage

### **Coverage Exclusions**
```typescript
// Exclude from Coverage
/* istanbul ignore next */
function debugOnlyFunction() {
  console.log('Debug information');
}

// Exclude Entire File
/* istanbul ignore file */
```

## 🧪 Test Data Management

### **Mock Data Patterns**
```typescript
// Test Data Constants
const MOCK_USER = {
  id: 123,
  username: 'testuser',
  email: 'test@example.com'
};

const MOCK_ERROR_RESPONSE = {
  status: 400,
  error: { message: 'Validation failed' }
};

// Mock Builders
class MockUserBuilder {
  private user = { ...MOCK_USER };
  
  withId(id: number): MockUserBuilder {
    this.user.id = id;
    return this;
  }
  
  withUsername(username: string): MockUserBuilder {
    this.user.username = username;
    return this;
  }
  
  build() {
    return { ...this.user };
  }
}

// Usage
const testUser = new MockUserBuilder()
  .withId(456)
  .withUsername('customuser')
  .build();
```

### **Test Utilities**
```typescript
// Test Helper Functions
export class TestUtils {
  static createFormControl(value: any, validators?: any[]): FormControl {
    const control = new FormControl(value, validators);
    control.markAsTouched();
    return control;
  }

  static triggerInputEvent(fixture: ComponentFixture<any>, selector: string, value: string): void {
    const input = fixture.debugElement.query(By.css(selector));
    input.nativeElement.value = value;
    input.nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  static expectElementText(fixture: ComponentFixture<any>, selector: string, expectedText: string): void {
    const element = fixture.debugElement.query(By.css(selector));
    expect(element.nativeElement.textContent.trim()).toBe(expectedText);
  }
}
```

## 🔧 Debugging Tests

### **Debugging Strategies**
```typescript
// Debug Test Output
describe('Debug Tests', () => {
  it('should debug component state', () => {
    console.log('Component state:', component);
    console.log('Form value:', component.loginForm.value);
    console.log('Form errors:', component.loginForm.errors);
  });
});

// Pause Test Execution
fit('should run only this test', () => {
  // Only this test will run
});

xit('should skip this test', () => {
  // This test will be skipped
});
```

### **Common Debugging Issues**
```typescript
// Fix: Component Not Initialized
beforeEach(() => {
  fixture.detectChanges(); // ← Add this after component creation
});

// Fix: Async Operations Not Completed
it('should complete async operation', async () => {
  await component.asyncMethod();
  fixture.detectChanges(); // ← Trigger change detection
  
  expect(component.result).toBeDefined();
});

// Fix: Material Components Not Working
beforeEach(() => {
  TestBed.configureTestingModule({
    imports: [
      BrowserAnimationsModule, // ← Required for Material components
      MatSnackBarModule
    ]
  });
});
```

## 📝 Writing Effective Tests

### **Test Structure (AAA Pattern)**
```typescript
it('should validate user input correctly', () => {
  // Arrange - Set up test data and conditions
  const invalidEmail = 'not-an-email';
  const formControl = new FormControl(invalidEmail);
  
  // Act - Execute the code under test
  const validator = ValidationService.emailValidator();
  const result = validator(formControl);
  
  // Assert - Verify the expected outcome
  expect(result).toEqual({
    email: { message: 'Please enter a valid email address' }
  });
});
```

### **Test Naming Conventions**
```typescript
// Good Test Names (Behavior-Driven)
it('should display error message when login fails')
it('should sanitize malicious script tags from user input')
it('should navigate to dashboard after successful authentication')

// Avoid (Implementation-Driven)
it('should call loginService.authenticate()')
it('should set isLoading to true')
```

### **Edge Case Testing**
```typescript
describe('Edge Cases', () => {
  it('should handle null input gracefully', () => {
    expect(service.sanitizeText(null)).toBe('');
  });

  it('should handle empty arrays', () => {
    expect(service.processItems([])).toEqual([]);
  });

  it('should handle extremely long input', () => {
    const longText = 'a'.repeat(10000);
    expect(service.sanitizeText(longText).length).toBeLessThanOrEqual(1000);
  });
});
```

## 🎯 Test Categories by Feature

### **Security Tests**
```typescript
// XSS Prevention
describe('XSS Prevention', () => {
  const maliciousInputs = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    'javascript:alert(1)',
    '<iframe src="javascript:alert(1)"></iframe>'
  ];

  maliciousInputs.forEach(input => {
    it(`should sanitize: ${input}`, () => {
      const result = service.sanitizeText(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onerror');
    });
  });
});
```

### **Form Validation Tests**
```typescript
describe('Form Validation', () => {
  const validInputs = ['user123', 'test_user', 'User.Name'];
  const invalidInputs = ['ab', 'user@domain', 'user space', '<script>'];

  validInputs.forEach(input => {
    it(`should accept valid username: ${input}`, () => {
      const control = new FormControl(input);
      const result = ValidationService.usernameValidator()(control);
      expect(result).toBeNull();
    });
  });

  invalidInputs.forEach(input => {
    it(`should reject invalid username: ${input}`, () => {
      const control = new FormControl(input);
      const result = ValidationService.usernameValidator()(control);
      expect(result).not.toBeNull();
    });
  });
});
```

### **Error Handling Tests**
```typescript
describe('Error Scenarios', () => {
  const errorScenarios = [
    { status: 401, expected: 'Authentication failed' },
    { status: 403, expected: 'permission' },
    { status: 404, expected: 'not found' },
    { status: 500, expected: 'Server error' }
  ];

  errorScenarios.forEach(scenario => {
    it(`should handle ${scenario.status} error correctly`, () => {
      const error = { status: scenario.status };
      service.handleHttpError(error);
      
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        jasmine.stringContaining(scenario.expected),
        jasmine.any(String),
        jasmine.any(Object)
      );
    });
  });
});
```

## 🚀 Best Practices

### **Test Isolation**
```typescript
// Good: Each test is independent
describe('Service Tests', () => {
  beforeEach(() => {
    // Fresh setup for each test
    service = new Service();
  });
});

// Avoid: Tests depending on each other
describe('Dependent Tests', () => {
  let sharedState: any;
  
  it('should setup state', () => {
    sharedState = service.initialize(); // ❌ Don't do this
  });
  
  it('should use shared state', () => {
    expect(sharedState).toBeDefined(); // ❌ Depends on previous test
  });
});
```

### **Test Performance**
```typescript
// Use beforeAll for expensive setup when safe
describe('Performance Tests', () => {
  beforeAll(() => {
    // One-time expensive setup
    TestBed.configureTestingModule({...});
  });

  beforeEach(() => {
    // Quick per-test setup
    component = TestBed.createComponent(Component);
  });
});
```

### **Readable Assertions**
```typescript
// Good: Clear and specific
expect(component.loginForm.get('email')).toHaveError('email');
expect(service.sanitizeText('<script>evil</script>text')).toBe('text');

// Better: Custom matchers
expect(component).toHaveValidationError('email', 'Invalid email format');
expect(userInput).toBeProperlyEscaped();
```

## 🔍 Troubleshooting Guide

### **Common Issues & Solutions**

#### **1. Tests Fail Randomly**
```typescript
// Problem: Async operations not properly handled
// Solution: Use proper async/await or fakeAsync

// ❌ Wrong
it('should update data', () => {
  service.loadData();
  expect(component.data).toBeDefined(); // May fail
});

// ✅ Correct
it('should update data', async () => {
  await service.loadData();
  expect(component.data).toBeDefined();
});
```

#### **2. Material Components Not Working**
```typescript
// Problem: Missing animations module
// Solution: Add BrowserAnimationsModule

TestBed.configureTestingModule({
  imports: [
    BrowserAnimationsModule, // ← Add this
    MatSnackBarModule
  ]
});
```

#### **3. HTTP Requests Not Mocked**
```typescript
// Problem: Real HTTP requests in tests
// Solution: Use HttpClientTestingModule

TestBed.configureTestingModule({
  imports: [HttpClientTestingModule], // ← Add this
  providers: [ServiceUnderTest]
});
```

#### **4. Dependency Injection Errors**
```typescript
// Problem: Service dependencies not provided
// Solution: Mock all dependencies

const serviceSpy = jasmine.createSpyObj('DependencyService', ['method']);

TestBed.configureTestingModule({
  providers: [
    ServiceUnderTest,
    { provide: DependencyService, useValue: serviceSpy } // ← Mock dependency
  ]
});
```

## 📈 Test Metrics & Quality

### **Quality Indicators**
- **Test Coverage**: > 90% for critical components
- **Test Speed**: < 5 seconds for full suite
- **Test Reliability**: 99%+ pass rate
- **Test Maintainability**: Clear, readable test code

### **Continuous Improvement**
```typescript
// Measure Test Performance
console.time('Test Suite');
// ... run tests
console.timeEnd('Test Suite');

// Track Coverage Trends
// Use tools like CodeCov or SonarQube for tracking
```

## 🎉 Summary

The MoodleNG testing framework provides:

- **Comprehensive Coverage**: Security, validation, error handling, and UI
- **Robust Infrastructure**: Modern Angular testing tools and best practices
- **Developer Productivity**: Fast feedback loops and clear debugging
- **Quality Assurance**: Automated regression prevention and code quality
- **Documentation**: Tests serve as executable specifications

This testing strategy ensures MoodleNG maintains high quality, security, and reliability throughout its development lifecycle.

## 📚 Additional Resources

- [Angular Testing Guide](https://angular.io/guide/testing)
- [Jasmine Documentation](https://jasmine.github.io/)
- [Testing Best Practices](https://testing.googleblog.com/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html) 