import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MoodleModule } from '../../models/moodle.models';
import { MoodleService } from '../../services/moodle.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,  
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule
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
  
  // Course search properties
  searchControl = new FormControl('');
  searching = false;
  searchResults: MoodleModule[] = [];
  showSearchResults = false;

  constructor(
    private moodleService: MoodleService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private elementRef: ElementRef
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
    
    // Set up search debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(value => {
      if (value && value.trim().length > 2) {
        this.searchCourses(value);
      } else {
        this.clearSearch();
      }
    });
  }
  
  /**
   * Check if HTML content is effectively empty (contains no text)
   * @param html HTML content to check
   * @returns true if content is empty or only contains HTML tags without text
   */
  isEmptyHtml(html: string | undefined): boolean {
    if (!html) return true;
    
    // Trim the content
    const trimmed = html.trim();
    if (!trimmed) return true;
    
    // Remove all HTML tags and check if there's any content left
    const textOnly = trimmed.replace(/<[^>]*>/g, '').trim();
    return !textOnly;
  }
  
  // Sanitize HTML content from Moodle
  sanitizeHtml(html: string | undefined): SafeHtml {
    if (this.isEmptyHtml(html)) return '';
    
    // Remove img tags before sanitizing
    // At this point we know html is defined because isEmptyHtml would have returned true otherwise
    const imgRemoved = html!.replace(/<img[^>]*>/g, '');
    
    return this.sanitizer.bypassSecurityTrustHtml(imgRemoved);
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
  
  searchCourses(term: string): void {
    this.searching = true;
    this.showSearchResults = true;
    
    this.moodleService.searchCourses(term).pipe(
      finalize(() => this.searching = false)
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
      },
      error: (err) => {
        console.error('Error searching courses:', err);
        this.searchResults = [];
      }
    });
  }
  
  clearSearch(): void {
    this.searchResults = [];
    this.showSearchResults = false;
  }
  
  enrollInCourse(courseId: number): void {
    // In a real implementation, you would call an API to enroll the user
    // For now, we'll just reload the modules after a short delay to simulate enrollment
    setTimeout(() => {
      this.loadModules();
      this.clearSearch();
      this.searchControl.setValue('');
    }, 500);
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

  /**
   * Check if any search result is already enrolled
   */
  hasEnrolledCourses(): boolean {
    return this.searchResults.some(course => this.isEnrolled(course.id));
  }
  
  /**
   * Check if user is already enrolled in a course
   */
  isEnrolled(courseId: number): boolean {
    return this.modules.some(module => module.id === courseId);
  }
  
  /**
   * Navigate to a course if already enrolled
   */
  openCourse(courseId: number): void {
    if (this.isEnrolled(courseId)) {
      this.router.navigate(['/modules', courseId]);
    }
  }

  /**
   * Handle clicks outside the search container to close search results
   */
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    // Check if the clicked element is outside the search container
    const target = event.target as HTMLElement;
    if (this.showSearchResults && !this.elementRef.nativeElement.querySelector('.course-search-container').contains(target)) {
      this.clearSearch();
    }
  }
}
