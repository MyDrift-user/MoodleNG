import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, finalize } from 'rxjs';
import { MoodleService } from './moodle.service';
import { MoodleUser } from '../models/moodle.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private loginInProgress = false;
  private logoutInProgress = false;

  constructor(
    private moodleService: MoodleService,
    private router: Router
  ) {}

  /**
   * Login to a Moodle instance
   */
  login(site: string, username: string, password: string): Observable<MoodleUser> {
    this.loginInProgress = true;
    
    return this.moodleService.login(site, username, password).pipe(
      tap(() => {
        console.log('Login successful, navigating to dashboard');
        // Navigate to dashboard after successful login
        this.router.navigate(['/dashboard']);
      }),
      finalize(() => {
        this.loginInProgress = false;
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): void {
    if (this.logoutInProgress) return;
    
    this.logoutInProgress = true;
    try {
      console.log('Logging out user');
      this.moodleService.logout();
      
      // Clear settings-related storage
      localStorage.removeItem('saveThemeToServer');
      
      // Navigate to login
      this.router.navigate(['/login']);
    } finally {
      this.logoutInProgress = false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const isLoggedIn = this.moodleService.isLoggedIn();
    return isLoggedIn;
  }

  /**
   * Get current user
   */
  getCurrentUser(): MoodleUser | null {
    return this.moodleService.getCurrentUser();
  }
}
