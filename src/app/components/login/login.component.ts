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
    private userSettingsService: UserSettingsService
  ) {
    // Initialize form
    this.loginForm = this.formBuilder.group({
      domain: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      username: ['', Validators.required],
      password: ['', Validators.required],
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

  onSubmit(): void {
    // Stop if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    const { domain, username, password } = this.loginForm.value;

    const loginSubscription = this.authService.login(domain, username, password).subscribe({
      next: () => {
        // Give a minimal delay to ensure auth state is fully updated
        this.loginTimeout = setTimeout(() => {
          this.userSettingsService.reset();
          this.router.navigate([this.returnUrl]);
          this.loginTimeout = null;
        }, 50); // Reduced from 100ms
      },
      error: err => {
        this.error = err.message || 'Login failed. Please check your credentials.';
        this.loading = false;
      },
    });

    this.subscriptions.add(loginSubscription);
  }
}
