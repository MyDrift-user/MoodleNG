import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService, ThemeSettings } from '../../services/theme.service';
import { MoodleService } from '../../services/moodle.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatToolbarModule,
    MatIconModule,
    MatTooltipModule
  ]
})
export class SettingsComponent implements OnInit {
  settingsForm: FormGroup;
  themeSettings: ThemeSettings | null = null;
  saveToServer = false;
  username: string = '';
  moodleDomain: string = '';
  isLoggedIn: boolean = false;
  
  // Debugging flags
  userDataLoaded: boolean = false;
  loginChecked: boolean = false;

  constructor(
    private fb: FormBuilder,
    public themeService: ThemeService,
    private moodleService: MoodleService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    console.log('SettingsComponent constructor started');
    
    this.settingsForm = this.fb.group({
      primaryColor: ['', Validators.required],
      accentColor: ['', Validators.required],
      backgroundColor: ['', Validators.required],
      cardColor: ['', Validators.required],
      contentContainerColor: ['', Validators.required],
      username: ['', [Validators.required]],
      moodleUrl: ['']
    });

    // Check login status - this should happen first
    this.isLoggedIn = this.authService.isAuthenticated();
    this.loginChecked = true;
    console.log('Auth status checked, isLoggedIn:', this.isLoggedIn);
    
    // Load user data
    this.loadUserData();
    
    // Force-check localStorage directly for debugging
    this.checkLocalStorage();
    
    // Load save preference from localStorage
    this.loadSavePreference();
  }
  
  private checkLocalStorage(): void {
    console.log('Directly checking localStorage contents:');
    console.log('moodleUser exists in localStorage:', !!localStorage.getItem('moodleUser'));
    console.log('moodleSite exists in localStorage:', !!localStorage.getItem('moodleSite'));
    
    try {
      const rawUserData = localStorage.getItem('moodleUser');
      if (rawUserData) {
        const userData = JSON.parse(rawUserData);
        console.log('localStorage user data:', userData);
        console.log('has username:', !!userData?.username);
        console.log('has token:', !!userData?.token);
      }
      
      const rawSiteData = localStorage.getItem('moodleSite');
      if (rawSiteData) {
        const siteData = JSON.parse(rawSiteData);
        console.log('localStorage site data:', siteData);
        console.log('has domain:', !!siteData?.domain);
      }
    } catch (e) {
      console.error('Error parsing localStorage data:', e);
    }
  }

  private loadUserData(): void {
    console.log('Loading user data...');
    
    // First try getting from MoodleService directly
    const user = this.moodleService.getCurrentUser();
    const site = this.moodleService.getCurrentSite();

    console.log('User from MoodleService:', user);
    console.log('Site from MoodleService:', site);

    if (user && user.username) {
      console.log('User data found from MoodleService:', user);
      this.username = user.username;
      this.settingsForm.get('username')?.setValue(user.username);
      this.userDataLoaded = true;
    } else {
      console.warn('User data not found from MoodleService');
      
      // Try getting from localStorage directly as fallback
      const storedUser = localStorage.getItem('moodleUser');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('User data found from localStorage:', parsedUser);
          if (parsedUser && parsedUser.username) {
            this.username = parsedUser.username;
            this.settingsForm.get('username')?.setValue(parsedUser.username);
            this.userDataLoaded = true;
            
            // Restore user data to MoodleService if needed
            if (!user) {
              console.log('Restoring user data to MoodleService from localStorage');
              this.moodleService.setUser(parsedUser);
            }
          }
        } catch (e) {
          console.error('Error parsing user data from localStorage:', e);
        }
      }
    }

    if (site && site.domain) {
      console.log('Site data found from MoodleService:', site);
      this.moodleDomain = site.domain;
      this.settingsForm.get('moodleUrl')?.setValue(site.domain);
    } else {
      console.warn('Site data not found from MoodleService');
      
      // Try getting from localStorage directly as fallback
      const storedSite = localStorage.getItem('moodleSite');
      if (storedSite) {
        try {
          const parsedSite = JSON.parse(storedSite);
          console.log('Site data found from localStorage:', parsedSite);
          if (parsedSite && parsedSite.domain) {
            this.moodleDomain = parsedSite.domain;
            this.settingsForm.get('moodleUrl')?.setValue(parsedSite.domain);
            
            // Restore site data to MoodleService if needed
            if (!site) {
              console.log('Restoring site data to MoodleService from localStorage');
              this.moodleService.setSite(parsedSite);
            }
          }
        } catch (e) {
          console.error('Error parsing site data from localStorage:', e);
        }
      }
    }
    
    console.log('User data loading complete. Results:', {
      username: this.username,
      moodleDomain: this.moodleDomain,
      isLoggedIn: this.isLoggedIn
    });
  }

  private loadSavePreference(): void {
    // Load save preference from localStorage
    const savedPreference = localStorage.getItem('saveThemeToServer');
    
    // If preference is explicitly set in either direction, use that value
    if (savedPreference === 'true') {
      console.log('Loading saved preference: save to server enabled');
      this.saveToServer = true;
    } else if (savedPreference === 'false') {
      console.log('Loading saved preference: save to server disabled');
      this.saveToServer = false;
    } else {
      // For the 'auto' state (null/undefined), set saveToServer to false in UI
      // but it might be changed to true if settings are found on the server
      console.log('No explicit preference found, defaulting to disabled in UI');
      this.saveToServer = false;
    }
  }

  ngOnInit(): void {
    console.log('ngOnInit called, subscribing to theme settings');
    this.themeService.themeSettings$.subscribe(settings => {
      this.themeSettings = settings;
      
      // Update form with current theme settings
      this.settingsForm.patchValue({
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        backgroundColor: settings.backgroundColor,
        cardColor: settings.cardColor,
        contentContainerColor: settings.contentContainerColor
      });
    });
    
    // If we're logged in but no user data was found during construction,
    // try once more to load the data
    if (this.isLoggedIn && (!this.username || !this.moodleDomain)) {
      console.log('Logged in but missing user data, trying again...');
      setTimeout(() => this.loadUserData(), 1000);
    }
    // DO NOT automatically check for saved settings here, as it may re-enable sync
    // when the user has specifically disabled it
  }
  
  private checkForSavedSettings(): void {
    if (!this.isLoggedIn || !this.username || !this.moodleDomain) {
      console.log('Cannot check for saved settings: user not logged in or missing user data');
      return;
    }
    
    // Only try to load from server if database service is available
    if (!this.themeService.isDatabaseAvailable()) {
      console.log('Database service unavailable, skipping check for saved settings');
      return;
    }
    
    // Only load settings if the user has explicitly enabled saving to server
    if (this.saveToServer) {
      console.log('Attempting to load user theme from server');
      this.themeService.loadUserTheme(this.username, this.moodleDomain);
    } else {
      console.log('Save to server is disabled, not loading settings from server');
    }
  }

  onColorChange(colorType: keyof ThemeSettings, event: Event): void {
    const input = event.target as HTMLInputElement;
    const color = input.value;
    
    // Update the theme immediately for preview
    this.themeService.updateTheme({ [colorType]: color } as Partial<ThemeSettings>);
  }

  onSaveToServerChange(event: any): void {
    console.log('onSaveToServerChange called, checked:', event.checked);
    
    // Save preference to localStorage
    localStorage.setItem('saveThemeToServer', event.checked.toString());
    
    // If enabling save to server, use the user's username and Moodle URL from login
    if (event.checked) {
      if (!this.isLoggedIn) {
        this.snackBar.open('You need to be logged in to save settings to the server.', 'Close', {
          duration: 3000
        });
        this.saveToServer = false;
        return;
      }
      
      if (this.username && this.moodleDomain) {
        this.settingsForm.get('username')?.setValue(this.username);
        this.settingsForm.get('moodleUrl')?.setValue(this.moodleDomain);
        
        // When enabling save to server, check if there are any settings to load
        this.checkForSavedSettings();
      } else {
        console.log('Attempting to reload user data before showing error');
        // Try reloading user data before showing error
        this.loadUserData();
        this.checkLocalStorage();
        
        if (this.username && this.moodleDomain) {
          this.settingsForm.get('username')?.setValue(this.username);
          this.settingsForm.get('moodleUrl')?.setValue(this.moodleDomain);
          
          // When enabling save to server, check if there are any settings to load
          this.checkForSavedSettings();
        } else {
          this.snackBar.open('Could not retrieve user information. Make sure you are logged in.', 'Close', {
            duration: 3000
          });
          this.saveToServer = false;
        }
      }
    }
  }

  onSaveSettings(): void {
    const { primaryColor, accentColor, backgroundColor, cardColor, contentContainerColor } = this.settingsForm.value;
    
    // Always save theme to localStorage
    this.themeService.updateTheme({
      primaryColor,
      accentColor,
      backgroundColor,
      cardColor,
      contentContainerColor
    });

    // Only save to server if user has opted in
    if (this.saveToServer) {
      // Check if database service is available
      if (!this.themeService.isDatabaseAvailable()) {
        this.snackBar.open('Database service is unavailable. Settings saved to this device only.', 'Close', {
          duration: 3000
        });
        // We still save the preference in localStorage so when service becomes available it will try to sync
        localStorage.setItem('saveThemeToServer', 'true');
        return;
      }
      
      if (!this.username || !this.moodleDomain) {
        // Try reloading user data before showing error
        this.loadUserData();
        this.checkLocalStorage();
      }
      
      if (this.username && this.moodleDomain) {
        const saveSuccess = this.themeService.saveThemeSettings(this.username, this.moodleDomain);
        
        // Explicitly set save preference to true - user has actively chosen to save
        localStorage.setItem('saveThemeToServer', 'true');
        
        if (saveSuccess) {
          this.snackBar.open('Settings saved and will be preserved across devices', 'Close', {
            duration: 3000
          });
        } else {
          this.snackBar.open('Settings saved to this device only. Server sync unavailable.', 'Close', {
            duration: 3000
          });
        }
      } else {
        this.snackBar.open('Could not save to server: Missing user information. Using local storage only.', 'Close', {
          duration: 3000
        });
        this.saveToServer = false;
        localStorage.setItem('saveThemeToServer', 'false');
      }
    } else {
      // User has explicitly chosen to disable syncing - set to false, not null/undefined
      // to prevent auto-enable even if settings exist on the server
      localStorage.setItem('saveThemeToServer', 'false');
      
      this.snackBar.open('Settings saved to this device only', 'Close', {
        duration: 3000
      });
    }
  }

  onResetTheme(): void {
    this.themeService.resetTheme();
    this.settingsForm.patchValue({
      primaryColor: this.themeSettings?.primaryColor,
      accentColor: this.themeSettings?.accentColor,
      backgroundColor: this.themeSettings?.backgroundColor,
      cardColor: this.themeSettings?.cardColor,
      contentContainerColor: this.themeSettings?.contentContainerColor
    });
    this.snackBar.open('Theme has been reset to default', 'Close', {
      duration: 3000
    });
  }

  onDeleteSettings(): void {
    if (this.username && this.moodleDomain) {
      // Check if database service is available
      if (!this.themeService.isDatabaseAvailable()) {
        this.snackBar.open('Database service is unavailable. Cannot delete remote settings.', 'Close', {
          duration: 3000
        });
        return;
      }
      
      const deleteSuccess = this.themeService.deleteUserSettings(this.username, this.moodleDomain);
      this.saveToServer = false;
      
      // Reset save preference after deleting settings
      localStorage.setItem('saveThemeToServer', 'false');
      
      if (deleteSuccess) {
        this.snackBar.open('Your data has been deleted from the server', 'Close', {
          duration: 3000
        });
      } else {
        this.snackBar.open('Cannot delete data: Server unavailable', 'Close', {
          duration: 3000
        });
      }
    } else {
      this.snackBar.open('Could not delete your data. Username or Moodle domain information is missing.', 'Close', {
        duration: 3000
      });
    }
  }
  
  applyManualUserInfo(): void {
    console.log('Applying manual user info');
    const username = this.settingsForm.get('username')?.value;
    const moodleUrl = this.settingsForm.get('moodleUrl')?.value;
    
    if (username && moodleUrl) {
      this.username = username;
      this.moodleDomain = moodleUrl;
      
      // Mock creation of user/site objects for MoodleService
      const userObj = {
        id: 0,
        username: username,
        firstname: 'Manual',
        lastname: 'Entry',
        fullname: 'Manual Entry',
        email: 'manual@entry.com',
        token: 'manual-entry'
      };
      
      const siteObj = {
        domain: moodleUrl,
        sitename: 'Manually Configured Site',
      };
      
      // Update the service with manual information using proper methods
      this.moodleService.setUser(userObj);
      this.moodleService.setSite(siteObj);
      
      this.snackBar.open('User information applied successfully', 'Close', {
        duration: 3000
      });
    } else {
      this.snackBar.open('Please provide both username and Moodle URL', 'Close', {
        duration: 3000
      });
    }
  }
} 