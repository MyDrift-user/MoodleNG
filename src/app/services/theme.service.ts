import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { catchError } from 'rxjs/operators';

export interface ThemeSettings {
  primaryColor: string;
  backgroundColor: string;
  cardColor: string;
  accentColor: string;
  contentContainerColor: string;
  textColor: string;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private defaultSettings: ThemeSettings = {
    primaryColor: '#3f51b5',
    backgroundColor: '#303030',
    cardColor: '#424242',
    accentColor: '#ff4081',
    contentContainerColor: '#424242',
    textColor: '#ffffff',
  };

  private themeSettingsSubject = new BehaviorSubject<ThemeSettings>(this.defaultSettings);
  public themeSettings$ = this.themeSettingsSubject.asObservable();
  private isBrowser: boolean;
  private mutationObserver: MutationObserver | null = null;
  private debounceTimer: any = null;
  private lastApplied: number = 0;
  private readonly THROTTLE_DELAY = 1000; // 1 second throttle

  // Flag to track if database service is available
  private isDbAvailable: boolean = true;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.loadSavedTheme();

      // Apply theme once when page loads and then on specific events
      window.addEventListener('DOMContentLoaded', () =>
        this.applyTheme(this.themeSettingsSubject.value)
      );
      window.addEventListener('load', () => this.applyTheme(this.themeSettingsSubject.value));

      // Check if the database service is available
      this.checkServerStatus();
    }
  }

  private checkServerStatus(): void {
    this.http
      .get<any>('/api/settings/status')
      .pipe(
        catchError(err => {
          console.error('Error checking server status:', err);
          this.isDbAvailable = false;
          return of({ status: 'error', dbAvailable: false, localStorageOnly: true });
        })
      )
      .subscribe(response => {
        this.isDbAvailable = response.dbAvailable;
        console.log('Server database available:', this.isDbAvailable);
      });
  }

  private loadSavedTheme(): void {
    const savedTheme = localStorage.getItem('user-theme');
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        this.themeSettingsSubject.next(parsedTheme);
        // Force immediate theme application
        this.applyTheme(parsedTheme);
      } catch (e) {
        console.error('Error parsing saved theme', e);
        this.applyTheme(this.defaultSettings);
      }
    } else {
      // Apply default theme if no saved theme exists
      this.applyTheme(this.defaultSettings);
    }
  }

  public updateTheme(settings: Partial<ThemeSettings>): void {
    const currentSettings = this.themeSettingsSubject.value;
    const newSettings = { ...currentSettings, ...settings };

    this.themeSettingsSubject.next(newSettings);

    // Apply theme immediately
    this.applyTheme(newSettings);

    if (this.isBrowser) {
      localStorage.setItem('user-theme', JSON.stringify(newSettings));
    }
  }

  public resetTheme(): void {
    this.themeSettingsSubject.next(this.defaultSettings);
    this.applyTheme(this.defaultSettings);

    if (this.isBrowser) {
      localStorage.removeItem('user-theme');
    }
  }

  public saveThemeSettings(username: string, moodleUrl: string): boolean {
    // Check if database service is available first
    if (!this.isDbAvailable) {
      console.warn('Database service unavailable. Theme will be saved to local storage only.');
      return false;
    }

    // Only save to database if user explicitly wants to save settings
    const settings = {
      username,
      moodleUrl,
      themeSettings: this.themeSettingsSubject.value,
    };

    this.http
      .post<any>('/api/settings/theme', settings)
      .pipe(
        catchError(err => {
          console.error('Error saving theme settings to server:', err);
          // If server returns specific error about database availability
          if (err.error && err.error.localStorageOnly) {
            this.isDbAvailable = false;
          }
          return of({ message: 'Error saving settings', localStorageOnly: true });
        })
      )
      .subscribe(response => {
        if (response.localStorageOnly) {
          console.warn('Settings saved to local storage only due to server error');
          return;
        }
        console.log('Theme settings saved to server successfully');
      });

    return this.isDbAvailable;
  }

  public deleteUserSettings(username: string, moodleUrl: string): boolean {
    // Check if database service is available first
    if (!this.isDbAvailable) {
      console.warn('Database service unavailable. Cannot delete remote settings.');
      return false;
    }

    this.http
      .delete<any>(
        `/api/settings/theme/${encodeURIComponent(username)}?moodleUrl=${encodeURIComponent(moodleUrl)}`
      )
      .pipe(
        catchError(err => {
          console.error('Error deleting user settings:', err);
          // If server returns specific error about database availability
          if (err.error && err.error.localStorageOnly) {
            this.isDbAvailable = false;
          }
          return of({ message: 'Error deleting settings', localStorageOnly: true });
        })
      )
      .subscribe(response => {
        if (response.localStorageOnly) {
          console.warn('Settings could not be deleted from server due to service unavailability');
          return;
        }
        console.log('User settings deleted from server');
        this.resetTheme();
      });

    return this.isDbAvailable;
  }

  // Load user theme from server
  public loadUserTheme(username: string, moodleUrl: string): void {
    // Check if database service is available first
    if (!this.isDbAvailable) {
      console.warn('Database service unavailable. Cannot load remote settings.');
      return;
    }

    this.http
      .get<any>(
        `/api/settings/theme/${encodeURIComponent(username)}?moodleUrl=${encodeURIComponent(moodleUrl)}`
      )
      .pipe(
        catchError(err => {
          console.error('Error loading user theme:', err);
          // If server returns specific error about database availability
          if (err.error && err.error.localStorageOnly) {
            this.isDbAvailable = false;
          }
          return of({ status: 'error', message: 'Error loading theme', localStorageOnly: true });
        })
      )
      .subscribe(response => {
        if (response.status === 'error' || !response.data || !response.data.theme_settings) {
          console.log('No saved theme found on server or error loading theme');
          return;
        }

        // Settings exist on server - apply them
        console.log('Found saved settings on server - applying theme');
        const themeSettings = response.data.theme_settings;
        this.themeSettingsSubject.next(themeSettings);
        this.applyTheme(themeSettings);

        // Save to local storage
        if (this.isBrowser) {
          localStorage.setItem('user-theme', JSON.stringify(themeSettings));

          // If the saveThemeToServer preference wasn't explicitly set to false,
          // set it to true since we found settings on the server
          const savedPreference = localStorage.getItem('saveThemeToServer');
          if (savedPreference !== 'false') {
            console.log('Auto-enabling settings sync since settings exist on server');
            localStorage.setItem('saveThemeToServer', 'true');
          }
        }

        console.log('Theme loaded from server successfully');
      });
  }

  // Returns whether the database service is available
  public isDatabaseAvailable(): boolean {
    return this.isDbAvailable;
  }

  private applyTheme(settings: ThemeSettings): void {
    if (!this.isBrowser) return;

    // Throttle theme application to prevent performance issues
    const now = Date.now();
    if (now - this.lastApplied < this.THROTTLE_DELAY) {
      // Clear any existing timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Debounce to apply theme only after a delay
      this.debounceTimer = setTimeout(() => {
        this.actuallyApplyTheme(settings);
      }, this.THROTTLE_DELAY);

      return;
    }

    this.actuallyApplyTheme(settings);
  }

  private actuallyApplyTheme(settings: ThemeSettings): void {
    this.lastApplied = Date.now();

    // Apply CSS variables to document root
    document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
    document.documentElement.style.setProperty('--background-color', settings.backgroundColor);
    document.documentElement.style.setProperty('--card-color', settings.cardColor);
    document.documentElement.style.setProperty('--accent-color', settings.accentColor);
    document.documentElement.style.setProperty(
      '--content-container-color',
      settings.contentContainerColor
    );
    document.documentElement.style.setProperty('--text-color', settings.textColor);

    // Apply to body element directly
    document.body.style.backgroundColor = settings.backgroundColor;
    document.body.style.color = settings.textColor;

    // Apply to all Material components
    this.applyMaterialTheming(settings);
  }

  private applyMaterialTheming(settings: ThemeSettings): void {
    // Apply primary color to all toolbar elements
    const toolbars = document.querySelectorAll('.mat-toolbar.mat-primary');
    toolbars.forEach(toolbar => {
      (toolbar as HTMLElement).style.backgroundColor = settings.primaryColor;
    });

    // Apply card background to all cards
    const cards = document.querySelectorAll('.mat-mdc-card');
    cards.forEach(card => {
      (card as HTMLElement).style.backgroundColor = settings.cardColor;
    });

    // Apply to form fields
    const formFields = document.querySelectorAll('.mdc-text-field--filled');
    formFields.forEach(field => {
      (field as HTMLElement).style.backgroundColor = settings.cardColor;
    });

    // Apply accent color to input focus states
    const focusRipples = document.querySelectorAll('.mdc-line-ripple::after');
    focusRipples.forEach(ripple => {
      (ripple as HTMLElement).style.borderBottomColor = settings.accentColor;
    });

    // Apply to accent elements
    const accentButtons = document.querySelectorAll(
      '.mat-mdc-raised-button.mat-accent, .mat-mdc-unelevated-button.mat-accent'
    );
    accentButtons.forEach(button => {
      (button as HTMLElement).style.backgroundColor = settings.accentColor;
    });

    // Apply background color to root containers
    const backgroundContainers = document.querySelectorAll(
      '.app-container, .dashboard-container, .login-container, .settings-container, .module-details-container'
    );
    backgroundContainers.forEach(container => {
      (container as HTMLElement).style.backgroundColor = settings.backgroundColor;
    });

    // Apply to content containers safely
    this.applyContentContainerColor(settings);

    // Ensure content wrappers use background color
    const contentWrappers = document.querySelectorAll('.content-wrapper');
    contentWrappers.forEach(wrapper => {
      (wrapper as HTMLElement).style.backgroundColor = settings.backgroundColor;
    });

    // Apply styles to module detail components
    const contentCards = document.querySelectorAll('.content-card');
    contentCards.forEach(card => {
      (card as HTMLElement).style.backgroundColor = settings.cardColor;
    });

    // Apply styles to section cards
    const sectionCards = document.querySelectorAll('.section-card');
    sectionCards.forEach(card => {
      (card as HTMLElement).style.backgroundColor = settings.contentContainerColor;
    });
  }

  private applyContentContainerColor(settings: ThemeSettings): void {
    // Only apply to a limited number of content containers to prevent performance issues
    const contentContainers = document.querySelectorAll('.content-container');
    const maxContainers = Math.min(contentContainers.length, 10); // Limit to 10 containers

    for (let i = 0; i < maxContainers; i++) {
      (contentContainers[i] as HTMLElement).style.backgroundColor = settings.contentContainerColor;
    }
  }

  // Clean up method to prevent memory leaks
  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
}
