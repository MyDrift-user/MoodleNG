import { Injectable, Inject, Optional } from '@angular/core';
import { AuthService } from './auth.service';
import { MoodleService } from './moodle.service';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private initialized = false;
  private initializationTimeout: any = null;

  constructor(
    private authService: AuthService,
    private moodleService: MoodleService,
    private themeService: ThemeService
  ) {
    // Use a single timeout to prevent multiple initialization calls
    this.scheduleInitialization(100);
  }

  private scheduleInitialization(delay: number): void {
    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
    }
    
    this.initializationTimeout = setTimeout(() => {
      this.initialize();
      this.initializationTimeout = null;
    }, delay);
  }

  /**
   * Initialize user settings if user is logged in and not already initialized
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Check if user is logged in
    if (!this.moodleService.isLoggedIn()) {
      return;
    }

    const user = this.moodleService.getCurrentUser();
    const site = this.moodleService.getCurrentSite();

    if (!user || !site) {
      return;
    }

    this.initialized = true;

    // Load user preferences
    const saveToServer = localStorage.getItem('saveThemeToServer');
    if (saveToServer === 'true') {
      this.themeService.loadUserTheme(user.username, site.domain);
    }
  }

  /**
   * Reset the initialization flag - call this after login/logout
   * to force reinitialization
   */
  reset(): void {
    this.initialized = false;
    
    // Clear any pending initialization
    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
      this.initializationTimeout = null;
    }
    
    // Schedule immediate re-initialization
    this.scheduleInitialization(0);
  }

  /**
   * Clean up resources to prevent memory leaks
   */
  destroy(): void {
    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
      this.initializationTimeout = null;
    }
  }
} 