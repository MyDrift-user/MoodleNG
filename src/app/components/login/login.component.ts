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
    private errorHandler: ErrorHandlerService
  ) {
    // Initialize form
    this.loginForm = this.formBuilder.group({
      site: ['', [Validators.required]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
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

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid && !this.loading) {
      this.loading = true;
      this.error = '';

      const { site, username, password } = this.loginForm.value;

      try {
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
        this.loading = false;
        
        // Optionally provide more specific feedback based on error type
        if (error?.status === 401) {
          this.error = 'Invalid username or password.';
        } else if (error?.status === 0) {
          this.error = 'Cannot connect to Moodle server. Please check the URL and your internet connection.';
        }
      } finally {
        this.loading = false;
      }
    } else {
      this.errorHandler.handleValidationError('Please fill in all required fields.', 'Login form');
    }
  }
}
