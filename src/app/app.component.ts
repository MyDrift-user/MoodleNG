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
  styleUrl: './app.component.scss',
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
}
