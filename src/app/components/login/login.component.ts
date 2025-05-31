import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { Subscription } from 'rxjs';
import { MoodleService } from '../../services/moodle.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ValidationService } from '../../services/validation.service';
import { 
  UrlSanitizerDirective, 
  UsernameSanitizerDirective,
  PreventDangerousInputDirective 
} from '../../directives/input-sanitizer.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
    UrlSanitizerDirective,
    UsernameSanitizerDirective,
    PreventDangerousInputDirective,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  loading = false;
  error = '';
  returnUrl = '/';
  hidePassword = true;

  private subscriptions = new Subscription();
  private loginTimeout: any = null;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private userSettingsService: UserSettingsService,
    private moodleService: MoodleService,
    private errorHandler: ErrorHandlerService,
    private validationService: ValidationService
  ) {
    // Initialize form with custom validators
    this.loginForm = this.formBuilder.group({
      site: [
        '', 
        [
          Validators.required,
          ValidationService.moodleUrlValidator()
        ]
      ],
      username: [
        '', 
        [
          Validators.required,
          ValidationService.usernameValidator()
        ]
      ],
      password: [
        '', 
        [
          Validators.required,
          Validators.minLength(1)
        ]
      ],
    });
  }

  ngOnInit(): void {
    // Get return URL from route parameters or default to '/'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

    // Check if already logged in
    if (this.authService.isAuthenticated()) {
      console.log('User already authenticated, redirecting to dashboard');
      this.userSettingsService.initialize(); // Initialize settings for authenticated user
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions and timeouts to prevent memory leaks
    this.subscriptions.unsubscribe();

    if (this.loginTimeout) {
      clearTimeout(this.loginTimeout);
      this.loginTimeout = null;
    }
  }

  /**
   * Get validation error message for a form field
   */
  getFieldError(fieldName: string): string {
    const control = this.loginForm.get(fieldName);
    if (control && control.invalid && (control.dirty || control.touched)) {
      return this.validationService.getValidationMessage(control, fieldName);
    }
    return '';
  }

  /**
   * Check if a form field has errors
   */
  hasFieldError(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  async onSubmit(): Promise<void> {
    // Clear any previous error
    this.error = '';

    // Validate form
    if (this.loginForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.loginForm.markAllAsTouched();
      
      // Show validation errors
      const errors = this.validationService.getFormErrors(this.loginForm);
      if (errors.length > 0) {
        this.errorHandler.handleValidationError(errors.join('. '), 'Login form');
      }
      return;
    }

    if (this.loading) return;

    this.loading = true;

    try {
      // Get form values and validate using business rules
      const formData = this.loginForm.value;
      const validationResult = this.validationService.validateMoodleLoginData(formData);

      if (!validationResult.isValid) {
        this.errorHandler.handleValidationError(
          validationResult.errors.join('. '), 
          'Login validation'
        );
        this.loading = false;
        return;
      }

      // Use sanitized values for login
      const { site, username, password } = validationResult.sanitizedValue;

      const user = await this.moodleService.login(site, username, password).toPromise();
      
      if (user) {
        console.log('Login successful:', user);
        
        // Reset and initialize user settings
        this.userSettingsService.reset();
        
        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      // The error is already handled by the global error handler and HTTP interceptor
      // We just need to handle any UI-specific logic here
      this.error = 'Login failed. Please check your credentials and try again.';
      
      // Optionally provide more specific feedback based on error type
      if (error?.status === 401) {
        this.error = 'Invalid username or password.';
      } else if (error?.status === 0) {
        this.error = 'Cannot connect to Moodle server. Please check the URL and your internet connection.';
      } else if (error?.message && error.message.includes('Invalid URL')) {
        this.error = 'Invalid Moodle URL format. Please check the URL and try again.';
      }
    } finally {
      this.loading = false;
    }
  }

  /**
   * Handle form field focus to clear errors
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onFieldFocus(_fieldName: string): void {
    // Clear the error when user starts typing
    if (this.error && this.error.includes('Invalid')) {
      this.error = '';
    }
  }
}
