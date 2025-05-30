import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ThemeService } from './services/theme.service';
import { MoodleService } from './services/moodle.service';
import { UserSettingsService } from './services/user-settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatSnackBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'MoodleNG';
  
  private subscriptions = new Subscription();
  private initializationTimeout: any = null;

  constructor(
    private themeService: ThemeService,
    private moodleService: MoodleService,
    private userSettingsService: UserSettingsService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}
  
  ngOnInit() {
    // First make sure basic theme is applied regardless of auth state
    const themeSubscription = this.themeService.themeSettings$.subscribe(settings => {
      this.themeService.updateTheme(settings);
    });
    
    this.subscriptions.add(themeSubscription);
    
    // Check if authentication data exists and is valid
    if (this.moodleService.isLoggedIn()) {
      // Use timeout to ensure all services are properly initialized
      // This helps avoid circular dependency issues during startup
      this.initializationTimeout = setTimeout(() => {
        this.userSettingsService.initialize();
        this.initializationTimeout = null;
      }, 200);
      
      // Check if we're returning from a Moodle unenrollment page
      this.checkForUnenrollmentReturn();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.unsubscribe();
    
    // Clean up timeout if still pending
    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
      this.initializationTimeout = null;
    }
    
    // Clean up theme service resources
    this.themeService.destroy();
    
    // Clean up user settings service resources
    this.userSettingsService.destroy();
  }
  
  /**
   * Check if the app is being loaded after returning from a Moodle unenrollment page
   */
  private checkForUnenrollmentReturn(): void {
    const unenrollingCourseId = localStorage.getItem('unenrolling_course_id');
    const unenrollingTimestamp = localStorage.getItem('unenrolling_timestamp');
    
    if (unenrollingCourseId && unenrollingTimestamp) {
      // Check if we're within a reasonable timeframe (10 minutes)
      const timestamp = parseInt(unenrollingTimestamp);
      const now = Date.now();
      const timeElapsed = now - timestamp;
      const maxTimeWindow = 10 * 60 * 1000; // 10 minutes in milliseconds
      
      if (timeElapsed < maxTimeWindow) {
        // We've returned from the unenrollment page within a reasonable time
        // Assume unenrollment was successful
        
        // Show a success message
        this.snackBar.open('You have been unenrolled from the course', 'Close', {
          duration: 5000
        });
        
        // Make sure we're on the dashboard
        if (this.router.url.includes('/modules/')) {
          this.router.navigate(['/']);
        }
        
        // Refresh the user's modules to reflect the unenrollment
        const refreshSubscription = this.moodleService.getUserModules().subscribe();
        this.subscriptions.add(refreshSubscription);
      }
      
      // Clear the unenrollment state regardless of time elapsed
      localStorage.removeItem('unenrolling_course_id');
      localStorage.removeItem('unenrolling_timestamp');
    }
  }
}
