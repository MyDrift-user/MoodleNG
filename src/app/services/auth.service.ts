import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { MoodleService } from './moodle.service';
import { MoodleUser } from '../models/moodle.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private moodleService: MoodleService,
    private router: Router
  ) {}

  /**
   * Login to a Moodle instance
   */
  login(site: string, username: string, password: string): Observable<MoodleUser> {
    return this.moodleService.login(site, username, password).pipe(
      tap(() => {
        // Navigate to dashboard after successful login
        this.router.navigate(['/dashboard']);
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): void {
    this.moodleService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.moodleService.isLoggedIn();
  }

  /**
   * Get current user
   */
  getCurrentUser(): MoodleUser | null {
    return this.moodleService.getCurrentUser();
  }
}
