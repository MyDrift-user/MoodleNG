import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MoodleModule } from '../../models/moodle.models';
import { MoodleService } from '../../services/moodle.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  modules: MoodleModule[] = [];
  loading = true;
  error = '';
  siteName = '';
  userName = '';

  constructor(
    private moodleService: MoodleService,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}
  ngOnInit(): void {
    this.loadModules();
    
    // Get site name and user info
    const site = this.moodleService.getCurrentSite();
    if (site) {
      this.siteName = site.sitename || site.domain;
    }
    
    const user = this.moodleService.getCurrentUser();
    if (user) {
      this.userName = user.fullname || user.username;
    }
  }
  
  // Sanitize HTML content from Moodle
  sanitizeHtml(html: string | undefined): SafeHtml {
    if (!html) return '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  loadModules(): void {
    this.loading = true;
    this.moodleService.getUserModules().subscribe({
      next: (modules) => {
        this.modules = modules;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load your courses. Please try again.';
        this.loading = false;
        console.error('Error loading modules:', err);
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  // Format the date in a user-friendly way
  formatLastAccess(date?: Date): string {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
