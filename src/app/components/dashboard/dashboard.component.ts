import { Component, OnInit, HostListener, ElementRef, OnDestroy } from '@angular/core';
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
import { Subscription } from 'rxjs';
import { MoodleModule, MoodleUser } from '../../models/moodle.models';
import { MoodleService } from '../../services/moodle.service';
import { AuthService } from '../../services/auth.service';
import { UserProfileService, ProfilePictureResult } from '../../services/user-profile.service';

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
    MatInputModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  modules: MoodleModule[] = [];
  loading = true;
  error = '';
  successMessage = '';
  siteName = '';
  userName = '';
  userProfilePicture: ProfilePictureResult | null = null;
  currentUser: MoodleUser | null = null;
  profilePictureError = false;

  // Course search properties
  searchControl = new FormControl('');
  searching = false;
  searchResults: MoodleModule[] = [];
  showSearchResults = false;
  enrollingCourseId: number | null = null; // Track which course is being enrolled

  // Subscription management
  private subscriptions = new Subscription();

  // Interval reference for cleanup
  private enrollmentRefreshInterval: any;

  // Timer references for cleanup
  private messageTimeouts: any[] = [];

  constructor(
    private moodleService: MoodleService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private elementRef: ElementRef,
    private userProfileService: UserProfileService
  ) {
    // Initialize profile picture properties to ensure default icon shows initially
    this.userProfilePicture = null;
    this.profilePictureError = false;
    this.currentUser = null;
  }

  ngOnInit(): void {
    this.loadModules();

    // Setup a timer to periodically refresh enrollment status while the dashboard is open
    this.enrollmentRefreshInterval = setInterval(() => {
      this.refreshEnrollmentStatus();
    }, 30000); // Refresh every 30 seconds

    // Get site name and user info
    const site = this.moodleService.getCurrentSite();
    if (site) {
      this.siteName = site.sitename || site.domain;
    }

    const user = this.moodleService.getCurrentUser();
    if (user) {
      this.currentUser = user;
      this.userName = user.fullname || user.username;
      
      console.log('Dashboard: User loaded:', user);
      console.log('Dashboard: User profile picture URL:', user.profilePictureUrl);
      
      try {
        // Initialize profile picture using the UserProfileService
        this.userProfilePicture = this.userProfileService.getProfilePicture(user, 'dashboard', {
          size: 35,
          link: false, // Don't make it clickable in the top bar for now
          alttext: true,
          class: 'userpicture-topbar',
          includefullname: false,
          includetoken: true // Include token for Moodle authentication
        });
        
        console.log('Dashboard: Profile picture result:', this.userProfilePicture);
      } catch (error) {
        console.error('Dashboard: Error initializing profile picture:', error);
        this.userProfilePicture = null;
        this.profilePictureError = true;
      }
    } else {
      console.log('Dashboard: No user found');
      this.userProfilePicture = null;
      this.profilePictureError = true;
    }

    // Set up search debounce with subscription management
    const searchSubscription = this.searchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(value => {
        if (value && value.trim().length > 2) {
          this.searchCourses(value);
        } else {
          this.clearSearch();
        }
      });

    this.subscriptions.add(searchSubscription);
  }

  ngOnDestroy(): void {
    // Clear the interval when the component is destroyed
    if (this.enrollmentRefreshInterval) {
      clearInterval(this.enrollmentRefreshInterval);
    }

    // Clear all message timeouts
    this.messageTimeouts.forEach(timeout => clearTimeout(timeout));
    this.messageTimeouts = [];

    // Clean up all subscriptions
    this.subscriptions.unsubscribe();
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
    const loadSubscription = this.moodleService.getUserModules().subscribe({
      next: modules => {
        this.modules = modules;
        this.loading = false;
      },
      error: err => {
        this.error = 'Failed to load your courses. Please try again.';
        this.loading = false;
        console.error('Error loading modules:', err);
      },
    });

    this.subscriptions.add(loadSubscription);
  }

  searchCourses(term: string): void {
    this.searching = true;
    this.showSearchResults = true;

    // First refresh our enrollment status to ensure we show accurate data
    const refreshSubscription = this.moodleService.getUserModules().subscribe({
      next: modules => {
        this.modules = modules;

        // Now perform the search with up-to-date enrollment data
        const searchSubscription = this.moodleService
          .searchCourses(term)
          .pipe(finalize(() => (this.searching = false)))
          .subscribe({
            next: results => {
              this.searchResults = results;
            },
            error: err => {
              console.error('Error searching courses:', err);
              this.searchResults = [];
            },
          });

        this.subscriptions.add(searchSubscription);
      },
      error: err => {
        // If we fail to refresh modules, still try the search
        console.error('Error refreshing modules before search:', err);
        const fallbackSearchSubscription = this.moodleService
          .searchCourses(term)
          .pipe(finalize(() => (this.searching = false)))
          .subscribe({
            next: results => {
              this.searchResults = results;
            },
            error: err => {
              console.error('Error searching courses:', err);
              this.searchResults = [];
            },
          });

        this.subscriptions.add(fallbackSearchSubscription);
      },
    });

    this.subscriptions.add(refreshSubscription);
  }

  clearSearch(): void {
    this.searchResults = [];
    this.showSearchResults = false;
  }

  enrollInCourse(courseId: number): void {
    // Clear any existing messages
    this.error = '';
    this.successMessage = '';

    // Set the enrolling course ID
    this.enrollingCourseId = courseId;

    // Store the current search term to restore it after reload
    const currentSearchTerm = this.searchControl.value;

    const enrollSubscription = this.moodleService.enrollInCourse(courseId).subscribe({
      next: response => {
        if (response.status) {
          // Set success message
          const course = this.searchResults.find(c => c.id === courseId);
          const courseName = course ? course.name : 'course';
          this.successMessage = `Successfully enrolled in ${courseName}`;

          // First, reload modules to get the updated enrollment status
          const reloadSubscription = this.moodleService.getUserModules().subscribe({
            next: modules => {
              // Update the modules list
              this.modules = modules;

              // If we had active search results, run the search again to refresh with current enrollment status
              if (currentSearchTerm) {
                const refreshSearchSubscription = this.moodleService
                  .searchCourses(currentSearchTerm)
                  .subscribe({
                    next: results => {
                      this.searchResults = results;
                      // Keep search results visible
                      this.showSearchResults = true;
                    },
                    error: err => {
                      console.error('Error refreshing search results after enrollment:', err);
                    },
                  });

                this.subscriptions.add(refreshSearchSubscription);
              }
            },
            error: err => {
              console.error('Error updating modules after enrollment:', err);
            },
          });

          this.subscriptions.add(reloadSubscription);

          // Hide success message after a few seconds with cleanup
          this.scheduleMessageClear('success', 5000);
        } else {
          // Enrollment failed with warnings
          console.error('Enrollment failed:', response.warnings);

          const warningMessage =
            response.warnings && response.warnings.length > 0
              ? response.warnings[0].message
              : 'Failed to enroll in the course';

          this.error = warningMessage;

          // Hide error after a few seconds with cleanup
          this.scheduleMessageClear('error', 5000);
        }
        // Reset the enrolling course ID
        this.enrollingCourseId = null;
      },
      error: err => {
        console.error('Error during enrollment:', err);
        this.error = 'Failed to enroll in the course. Please try again.';

        // Reset the enrolling course ID
        this.enrollingCourseId = null;

        // Hide error after a few seconds with cleanup
        this.scheduleMessageClear('error', 5000);
      },
    });

    this.subscriptions.add(enrollSubscription);
  }

  /**
   * Schedule a message to be cleared with proper cleanup tracking
   */
  private scheduleMessageClear(messageType: 'success' | 'error', delay: number): void {
    const timeout = setTimeout(() => {
      if (messageType === 'success') {
        this.successMessage = '';
      } else {
        this.error = '';
      }

      // Remove from tracking array
      const index = this.messageTimeouts.indexOf(timeout);
      if (index > -1) {
        this.messageTimeouts.splice(index, 1);
      }
    }, delay);

    this.messageTimeouts.push(timeout);
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
    if (
      this.showSearchResults &&
      !this.elementRef.nativeElement.querySelector('.course-search-container').contains(target)
    ) {
      this.clearSearch();
    }
  }

  /**
   * Check if a specific course is currently being enrolled
   */
  isEnrolling(courseId: number): boolean {
    return this.enrollingCourseId === courseId;
  }

  /**
   * Force a refresh of the modules list to ensure enrollment status is up to date
   * This helps ensure the UI shows correct enrollment status
   */
  refreshEnrollmentStatus(): void {
    // Silently refresh the enrollment status without showing loading indicators
    const refreshSubscription = this.moodleService.getUserModules().subscribe({
      next: modules => {
        this.modules = modules;
      },
      error: err => {
        // Don't show errors for background refresh
        console.error('Error refreshing enrollment status:', err);
      },
    });

    this.subscriptions.add(refreshSubscription);
  }

  /**
   * Handle profile picture loading errors by falling back to default icon
   */
  onProfilePictureError(): void {
    console.log('Dashboard: Profile picture failed to load');
    this.profilePictureError = true;
  }

  /**
   * Handle successful profile picture loading
   */
  onProfilePictureLoad(): void {
    console.log('Dashboard: Profile picture loaded successfully');
    console.log('Dashboard: userProfilePicture object:', this.userProfilePicture);
  }

  /**
   * Determine if we should show the profile picture or default icon
   */
  shouldShowProfilePicture(): boolean {
    const shouldShow = !!this.userProfilePicture && !this.profilePictureError;
    console.log('Dashboard: shouldShowProfilePicture:', shouldShow, {
      userProfilePicture: !!this.userProfilePicture,
      profilePictureError: this.profilePictureError
    });
    return shouldShow;
  }

  /**
   * Getter to check if we have a valid profile picture to display
   */
  get hasValidProfilePicture(): boolean {
    const isValid = this.userProfilePicture !== null && !this.profilePictureError;
    console.log('Dashboard: hasValidProfilePicture getter:', isValid, {
      userProfilePicture: !!this.userProfilePicture,
      profilePictureError: this.profilePictureError,
      imageUrl: this.userProfilePicture?.imageUrl,
      userProfilePictureObject: this.userProfilePicture
    });
    return isValid;
  }

  /**
   * Debug method to check template conditions
   */
  shouldShowImage(): boolean {
    const result = !!(this.userProfilePicture && this.userProfilePicture.imageUrl && !this.profilePictureError);
    console.log('Dashboard: shouldShowImage:', result, {
      userProfilePicture: !!this.userProfilePicture,
      imageUrl: this.userProfilePicture?.imageUrl,
      profilePictureError: this.profilePictureError
    });
    return result;
  }

  /**
   * Debug method to check if we should show the default icon
   */
  shouldShowIcon(): boolean {
    const result = !this.userProfilePicture || !this.userProfilePicture.imageUrl || this.profilePictureError;
    console.log('Dashboard: shouldShowIcon:', result, {
      userProfilePicture: !!this.userProfilePicture,
      imageUrl: this.userProfilePicture?.imageUrl,
      profilePictureError: this.profilePictureError
    });
    return result;
  }
}
