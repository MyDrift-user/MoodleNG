import { Injectable, Inject, Optional } from '@angular/core';
import { AuthService } from './auth.service';
import { MoodleService } from './moodle.service';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private initialized = false;

  constructor(
    private authService: AuthService,
    private moodleService: MoodleService,
    private themeService: ThemeService
  ) {
    // Wait a short delay before initializing to prevent circular dependency issues
    setTimeout(() => this.initialize(), 100);
  }

  /**
   * Initialize user settings - can be called on app start
   * or explicitly after login
   */
  initialize(): void {
    // Prevent multiple initializations
    if (this.initialized) {
      return;
    }

    // Only load settings if user is authenticated
    if (this.authService.isAuthenticated()) {
      const user = this.moodleService.getCurrentUser();
      const site = this.moodleService.getCurrentSite();

      if (user?.username && site?.domain) {
        console.log('Initializing user settings for:', user.username, 'at', site.domain);
        
        // Check user's preference for syncing settings
        const savedPreference = localStorage.getItem('saveThemeToServer');
        
        // If the user has explicitly disabled syncing on this device, respect that choice
        if (savedPreference === 'false') {
          console.log('User explicitly disabled settings sync on this device');
          // Set the flag to false - don't load remote settings
          localStorage.setItem('saveThemeToServer', 'false');
        } else {
          // Either the setting is explicitly enabled (true) or this is a new device (null/undefined)
          // Try to load settings from the server
          console.log('Checking for remote settings');
          
          // Load theme from server - if settings exist, the flag will be set to true
          // If no settings exist, it remains in 'auto' state (or stays true if already true)
          this.themeService.loadUserTheme(user.username, site.domain);
        }
        
        this.initialized = true;
      }
    }
  }

  /**
   * Reset the initialization flag - call this after login/logout
   * to force reinitialization
   */
  reset(): void {
    this.initialized = false;
    // Use setTimeout to defer execution until next macrotask to avoid circular dependencies
    setTimeout(() => this.initialize(), 0);
  }
} 