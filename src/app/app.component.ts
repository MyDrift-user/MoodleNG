import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { UserSettingsService } from './services/user-settings.service';
import { MoodleService } from './services/moodle.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'MoodleNG';
  
  constructor(
    private themeService: ThemeService,
    private userSettingsService: UserSettingsService,
    private moodleService: MoodleService
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
    } else {
      console.log('User not logged in, using local theme only');
    }
  }
}
