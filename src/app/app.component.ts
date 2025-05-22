import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { UserSettingsService } from './services/user-settings.service';
import { MoodleService } from './services/moodle.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatSnackBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'MoodleNG';
  
  constructor(
    private themeService: ThemeService,
    private userSettingsService: UserSettingsService,
    private moodleService: MoodleService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit() {
    console.log('App initializing');
    
    // First make sure basic theme is applied regardless of auth state
    this.themeService.themeSettings$.subscribe(settings => {
      this.themeService.updateTheme(settings);
    });
    
    // Check if authentication data exists and is valid
    if (this.moodleService.isLoggedIn()) {
      console.log('User is logged in, initializing user settings');
      
      // Use timeout to ensure all services are properly initialized
      // This helps avoid circular dependency issues during startup
      setTimeout(() => {
        this.userSettingsService.initialize();
      }, 200);
      
      // Check if we're returning from a Moodle unenrollment page
      this.checkForUnenrollmentReturn();
    } else {
      console.log('User not logged in, using local theme only');
    }
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
        console.log('Detected return from unenrollment page');
        
        // Show a success message
        this.snackBar.open('You have been unenrolled from the course', 'Close', {
          duration: 5000
        });
        
        // Make sure we're on the dashboard
        if (this.router.url.includes('/modules/')) {
          this.router.navigate(['/']);
        }
        
        // Refresh the user's modules to reflect the unenrollment
        this.moodleService.getUserModules().subscribe();
      }
      
      // Clear the unenrollment state regardless of time elapsed
      localStorage.removeItem('unenrolling_course_id');
      localStorage.removeItem('unenrolling_timestamp');
    }
  }
}
