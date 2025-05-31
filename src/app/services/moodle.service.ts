import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, switchMap, catchError, forkJoin } from 'rxjs';
import {
  MoodleUser,
  MoodleSite,
  MoodleModule,
  MoodleContent,
  MoodleLoginResponse,
  MoodleCourseResult,
} from '../models/moodle.models';
import { ErrorHandlerService } from './error-handler.service';
import { SanitizationService } from './sanitization.service';

@Injectable({
  providedIn: 'root',
})
export class MoodleService {
  private currentUser: MoodleUser | null = null;
  private currentSite: MoodleSite | null = null;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService,
    private sanitization: SanitizationService
  ) {
    // Try to restore session from localStorage
    this.restoreSession();
  }

  /**
   * Authenticates user to Moodle site
   * @param site Moodle site domain
   * @param username User's username
   * @param password User's password
   */
  login(site: string, username: string, password: string): Observable<MoodleUser> {
    // Sanitize inputs
    const sanitizedSite = this.sanitization.sanitizeUrl(site);
    const sanitizedUsername = this.sanitization.sanitizeUsername(username);
    // Note: Don't sanitize password as it may contain special characters

    // Validate inputs
    if (!this.sanitization.isValidMoodleUrl(sanitizedSite)) {
      throw new Error('Invalid Moodle URL format');
    }

    if (!this.sanitization.isValidUsername(sanitizedUsername)) {
      throw new Error('Invalid username format');
    }

    // Format the domain correctly
    const formattedDomain = this.formatDomain(sanitizedSite);

    // Store the site information
    this.currentSite = { domain: formattedDomain };

    // Construct the login URL
    const loginUrl = `${formattedDomain}/login/token.php`;
    // Set up the parameters
    const params = new HttpParams()
      .set('username', sanitizedUsername)
      .set('password', password) // Don't sanitize password
      .set('service', 'moodle_mobile_app');

    return this.http.post<MoodleLoginResponse>(loginUrl, null, { params }).pipe(
      switchMap(response => {
        if (response.error) {
          throw new Error(response.error);
        }

        // Get user details with the token
        return this.getUserInfo(formattedDomain, response.token);
      }),
      catchError(error => {
        this.errorHandler.handleMoodleError(error, 'Login failed');
        throw error;
      })
    );
  }

  /**
   * Get user information using the token
   */
  private getUserInfo(domain: string, token: string): Observable<MoodleUser> {
    const webServiceUrl = `${domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', token)
      .set('wsfunction', 'core_webservice_get_site_info')
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(info => {
        // Sanitize user info from API
        const sanitizedInfo = this.sanitization.sanitizeObject(info, {
          allowBasicHtml: false,
          trimWhitespace: true
        });

        // Create user object
        const user: MoodleUser = {
          id: sanitizedInfo.userid,
          username: this.sanitization.sanitizeUsername(sanitizedInfo.username || ''),
          firstname: this.sanitization.sanitizeText(sanitizedInfo.firstname || ''),
          lastname: this.sanitization.sanitizeText(sanitizedInfo.lastname || ''),
          fullname: this.sanitization.sanitizeText(sanitizedInfo.fullname || ''),
          email: this.sanitization.sanitizeEmail(sanitizedInfo.email || ''),
          token: token, // Don't sanitize token
        };

        // Store user in the service and localStorage
        this.setCurrentUser(user);
        this.currentSite = {
          domain: domain,
          sitename: this.sanitization.sanitizeText(sanitizedInfo.sitename || ''),
          logo: this.sanitization.sanitizeUrl(sanitizedInfo.userpictureurl || ''),
        };
        this.saveSession();

        return user;
      })
    );
  }

  /**
   * Get all courses/modules for the current user
   */
  getUserModules(): Observable<MoodleModule[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'core_enrol_get_users_courses')
      .set('userid', this.currentUser.id.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any[]>(webServiceUrl, { params }).pipe(
      map(courses => {
        // Sanitize course data from API
        const sanitizedCourses = courses.map(course => {
          const sanitizedCourse = this.sanitization.sanitizeObject(course, {
            allowBasicHtml: true, // Allow basic HTML in course descriptions
            trimWhitespace: true
          });

          return {
            id: sanitizedCourse.id,
            name: this.sanitization.sanitizeText(sanitizedCourse.fullname || ''),
            description: this.sanitization.sanitizeHtml(sanitizedCourse.summary || '', {
              allowBasicHtml: true,
              allowLinks: true,
              allowImages: false
            }),
            visible: sanitizedCourse.visible === 1,
            summary: this.sanitization.sanitizeHtml(sanitizedCourse.summary || '', {
              allowBasicHtml: true,
              allowLinks: true,
              allowImages: false
            }),
            lastAccess: sanitizedCourse.lastaccess ? new Date(sanitizedCourse.lastaccess * 1000) : undefined,
            courseId: sanitizedCourse.id,
            courseName: this.sanitization.sanitizeText(sanitizedCourse.shortname || ''),
          };
        });

        return sanitizedCourses;
      }),
      // Sort by last access date (most recent first)
      map(modules =>
        modules.sort((a, b) => {
          if (!a.lastAccess) return 1;
          if (!b.lastAccess) return -1;
          return b.lastAccess.getTime() - a.lastAccess.getTime();
        })
      ),
      catchError(error => {
        this.errorHandler.handleMoodleError(error, 'Failed to load courses');
        return of([]);
      })
    );
  }

  /**
   * Get the contents of a specific module/course
   */
  getModuleContents(courseId: number): Observable<MoodleContent[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'core_course_get_contents')
      .set('courseid', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any[]>(webServiceUrl, { params }).pipe(
      map(sections => {
        // Flatten all sections and modules into our content format
        const allContents: MoodleContent[] = [];
        sections.forEach(section => {
          // Sanitize section data
          const sanitizedSection = this.sanitization.sanitizeObject(section, {
            allowBasicHtml: true,
            allowLinks: true,
            allowImages: true
          });

          // Add section title as text content
          if (sanitizedSection.name) {
            allContents.push({
              id: sanitizedSection.id,
              name: this.sanitization.sanitizeText(sanitizedSection.name),
              type: 'section',
              content: this.sanitization.sanitizeHtml(sanitizedSection.summary || '', {
                allowBasicHtml: true,
                allowLinks: true,
                allowImages: true
              }),
              moduleId: courseId,
            });
          }

          // Process each module in the section
          if (sanitizedSection.modules) {
            sanitizedSection.modules.forEach((module: any) => {
              // Sanitize module data
              const sanitizedModule = this.sanitization.sanitizeObject(module, {
                allowBasicHtml: true,
                allowLinks: true,
                allowImages: true
              });

              // Special handling for assignments and quizzes
              if (sanitizedModule.modname === 'assign' || sanitizedModule.modname === 'quiz') {
                // Create content object for the module
                const specialContent: MoodleContent = {
                  id: sanitizedModule.id,
                  name: this.sanitization.sanitizeText(sanitizedModule.name || ''),
                  type: sanitizedModule.modname === 'assign' ? 'assignment' : 'quiz',
                  content: this.sanitization.sanitizeHtml(sanitizedModule.description || '', {
                    allowBasicHtml: true,
                    allowLinks: true,
                    allowImages: false
                  }),
                  moduleId: courseId,
                  modname: sanitizedModule.modname,
                  timeModified: sanitizedModule.timemodified
                    ? new Date(sanitizedModule.timemodified * 1000)
                    : undefined,
                };

                // Add direct link to Moodle activity
                if (this.currentSite?.domain) {
                  specialContent.fileUrl = this.sanitization.sanitizeUrl(
                    `https://${this.currentSite.domain}/mod/${sanitizedModule.modname}/view.php?id=${sanitizedModule.id}`
                  );
                }

                // Always add this content
                allContents.push(specialContent);

                // Continue to next module
                return;
              }

              // Skip modules without contents (except assignments and quizzes, handled above)
              if (!sanitizedModule.contents || sanitizedModule.contents.length === 0) {
                return;
              }

              // Handle special case for labels - integrate them directly into section
              if (sanitizedModule.modname === 'label') {
                // Add label content directly to section without separate header
                if (sanitizedModule.contents && sanitizedModule.contents.length > 0 && sanitizedModule.contents[0].content) {
                  allContents.push({
                    id: sanitizedModule.id,
                    name: '', // No name for labels
                    type: 'label',
                    content: this.sanitization.sanitizeHtml(sanitizedModule.contents[0].content, {
                      allowBasicHtml: true,
                      allowLinks: true,
                      allowImages: true
                    }),
                    moduleId: courseId,
                  });
                }
                return;
              }

              // Create a main content object for each module
              const mainContent: MoodleContent = {
                id: sanitizedModule.id,
                name: this.sanitization.sanitizeText(sanitizedModule.name || ''),
                type: sanitizedModule.modname || 'unknown', // Use modname as the initial type
                content: this.sanitization.sanitizeHtml(sanitizedModule.description || '', {
                  allowBasicHtml: true,
                  allowLinks: true,
                  allowImages: false
                }),
                moduleId: courseId,
                modname: sanitizedModule.modname, // Add the modname property
                timeModified: sanitizedModule.timemodified
                  ? new Date(sanitizedModule.timemodified * 1000)
                  : undefined,
              };

              // Set specific types for special modules
              if (sanitizedModule.modname === 'assign') {
                mainContent.type = 'assignment';
              } else if (sanitizedModule.modname === 'quiz') {
                mainContent.type = 'quiz';
              }

              // Process contents of the module
              if (sanitizedModule.contents) {
                // For resources like files, combine all information into one entry
                if (sanitizedModule.modname === 'resource' && sanitizedModule.contents.length > 0) {
                  const fileContent = sanitizedModule.contents[0];
                  mainContent.fileUrl = fileContent.fileurl
                    ? this.appendTokenToUrl(this.sanitization.sanitizeUrl(fileContent.fileurl))
                    : undefined;
                  mainContent.mimeType = this.sanitization.sanitizeText(fileContent.mimetype || '');
                  mainContent.type = this.determineContentType(fileContent);

                  // If there's a description, add it to the main content
                  const descriptionContent = sanitizedModule.contents.find(
                    (c: any) => c.type === 'file' && c.content
                  );
                  if (descriptionContent) {
                    mainContent.content = this.sanitization.sanitizeHtml(descriptionContent.content, {
                      allowBasicHtml: true,
                      allowLinks: true,
                      allowImages: true
                    });
                  }

                  allContents.push(mainContent);
                } // Handle URLs properly
                else if (sanitizedModule.modname === 'url' && sanitizedModule.contents.length > 0) {
                  const urlContent = sanitizedModule.contents[0];

                  // For external URL modules, extract the correct URL
                  // from the fileurl parameter or externalurl
                  let externalUrl = '';
                  if (urlContent.fileurl) {
                    // The URL is often embedded as a parameter in the fileurl
                    const urlMatch = urlContent.fileurl.match(/url=([^&]+)/);
                    if (urlMatch && urlMatch[1]) {
                      externalUrl = decodeURIComponent(urlMatch[1]);
                    } else {
                      externalUrl = urlContent.fileurl;
                    }
                  }

                  mainContent.fileUrl = this.sanitization.sanitizeUrl(externalUrl);
                  mainContent.type = 'url';

                  // If there's a description, add it to the main content
                  if (urlContent.content) {
                    mainContent.content = this.sanitization.sanitizeHtml(urlContent.content, {
                      allowBasicHtml: true,
                      allowLinks: true,
                      allowImages: true
                    });
                  }

                  allContents.push(mainContent);
                }
                // Handle other module types (assignments and quizzes now handled earlier)
                else {
                  allContents.push(mainContent);

                  // Add subcontents as needed
                  sanitizedModule.contents.forEach((content: any) => {
                    // Skip content that's just metadata or already processed
                    if (content.type === 'file' && content.mimetype) {
                      allContents.push({
                        id: content.fileurl ? content.fileurl.hashCode() : Math.random(),
                        name: this.sanitization.sanitizeText(content.filename || content.name || 'Content'),
                        type: this.determineContentType(content),
                        content: this.sanitization.sanitizeHtml(content.content || '', {
                          allowBasicHtml: true,
                          allowLinks: true,
                          allowImages: true
                        }),
                        fileUrl: content.fileurl
                          ? this.appendTokenToUrl(this.sanitization.sanitizeUrl(content.fileurl))
                          : undefined,
                        mimeType: this.sanitization.sanitizeText(content.mimetype || ''),
                        timeModified: content.timemodified
                          ? new Date(content.timemodified * 1000)
                          : undefined,
                        moduleId: courseId,
                      });
                    }
                  });
                }
              }
            });
          }
        });

        return allContents;
      }),
      catchError(error => {
        this.errorHandler.handleMoodleError(error, 'Failed to load course contents');
        return of([]);
      })
    );
  }

  /**
   * Determine the type of content based on the API response
   */
  private determineContentType(content: any): string {
    // Check for module type first
    if (content.modname === 'assign') {
      return 'assignment';
    } else if (content.modname === 'quiz') {
      return 'quiz';
    }

    // Then check based on file type or mime type
    if (content.type === 'file') {
      if (content.mimetype?.startsWith('image/')) {
        return 'image';
      } else if (content.mimetype?.startsWith('video/')) {
        return 'video';
      } else if (content.mimetype?.startsWith('audio/')) {
        return 'audio';
      } else {
        return 'file';
      }
    } else if (content.type === 'url') {
      return 'url';
    } else if (content.content) {
      return 'text';
    }

    return content.type || 'unknown';
  }

  /**
   * Add the token to file URLs for authentication
   */
  private appendTokenToUrl(url: string): string {
    if (!this.currentUser?.token) return url;

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${this.currentUser.token}`;
  }

  /**
   * Formats the domain to ensure it has the correct protocol
   */
  private formatDomain(domain: string): string {
    // Remove trailing slashes
    domain = domain.replace(/\/+$/, '');

    // Add https:// if no protocol is specified
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }

    return domain;
  }

  /**
   * Stores current user
   */
  private setCurrentUser(user: MoodleUser) {
    this.currentUser = user;
  }

  /**
   * Gets current user info
   */
  getCurrentUser(): MoodleUser | null {
    return this.currentUser;
  }

  /**
   * Gets current site info
   */
  getCurrentSite(): MoodleSite | null {
    return this.currentSite;
  }

  /**
   * Allows manually setting user info (for debugging or recovery)
   * @param user The user object to set
   */
  setUser(user: MoodleUser): void {
    if (!user.email || !user.token) {
      console.warn('Setting incomplete user object. This may cause issues.');
    }
    this.currentUser = user;
    this.saveSession();
  }

  /**
   * Allows manually setting site info (for debugging or recovery)
   * @param site The site object to set
   */
  setSite(site: MoodleSite): void {
    if (!site.domain) {
      console.warn('Setting incomplete site object. This may cause issues.');
    }
    this.currentSite = site;
    this.saveSession();
  }

  /**
   * Save session to localStorage
   */
  private saveSession() {
    if (this.currentUser && this.currentSite) {
      localStorage.setItem('moodleUser', JSON.stringify(this.currentUser));
      localStorage.setItem('moodleSite', JSON.stringify(this.currentSite));
    }
  }

  /**
   * Restore session from localStorage
   */
  private restoreSession() {
    try {
      const userJson = localStorage.getItem('moodleUser');
      const siteJson = localStorage.getItem('moodleSite');

      if (userJson && siteJson) {
        const parsedUser = JSON.parse(userJson);
        const parsedSite = JSON.parse(siteJson);

        let sessionValid = true;

        if (!parsedUser || !parsedUser.token || !parsedUser.username) {
          console.warn('Incomplete user data found in localStorage');
          sessionValid = false;
        }

        if (!parsedSite || !parsedSite.domain) {
          console.warn('Incomplete site data found in localStorage');
          sessionValid = false;
        }

        if (sessionValid) {
          console.log('Restoring user session from localStorage');
          
          // Sanitize restored data for security
          this.currentUser = this.sanitization.sanitizeObject(parsedUser, {
            allowBasicHtml: false,
            trimWhitespace: true
          });
          
          this.currentSite = this.sanitization.sanitizeObject(parsedSite, {
            allowBasicHtml: false,
            trimWhitespace: true
          });
          
          console.log('Session restored successfully');
        } else {
          console.warn('Invalid session data, clearing session');
          this.logout();
        }
      } else {
        // Just log - don't clear if we don't have data
        console.warn('No stored session found in localStorage');
      }
    } catch (e) {
      this.errorHandler.reportError('Failed to restore user session', 'Session management');
      // Reset state to prevent partial or corrupted state
      this.currentUser = null;
      this.currentSite = null;
      localStorage.removeItem('moodleUser');
      localStorage.removeItem('moodleSite');
    }
  }

  /**
   * Logout current user
   */
  logout() {
    this.currentUser = null;
    this.currentSite = null;
    localStorage.removeItem('moodleUser');
    localStorage.removeItem('moodleSite');
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return !!this.currentUser && !!this.currentUser.token;
  }

  /**
   * Get the results/grades for a specific course
   */
  getCourseResults(courseId: number): Observable<MoodleCourseResult[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'gradereport_user_get_grade_items')
      .set('courseid', courseId.toString())
      .set('userid', this.currentUser.id.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        // Ensure we have the usergrades structure
        if (
          !response ||
          !response.usergrades ||
          !response.usergrades[0] ||
          !response.usergrades[0].gradeitems
        ) {
          return [];
        }

        // Extract grade items and map to our interface
        const gradeItems = response.usergrades[0].gradeitems;

        // First pass - create all result items
        const allResults: MoodleCourseResult[] = [];

        // Track categories by ID
        const categoriesById: { [key: number]: MoodleCourseResult } = {};

        // Track items that belong to each category
        const itemsByCategory: { [key: number]: MoodleCourseResult[] } = {};

        // Process each item and identify categories
        gradeItems.forEach((item: any) => {
          const isCategory = item.itemtype === 'category';
          const isCategorySummary =
            item.itemtype === 'category' && item.itemname.includes('gesamt');
          const isOverallSummary =
            item.itemtype === 'course' ||
            (item.itemname && item.itemname.toLowerCase().includes('kurs gesamt'));

          // Process each grade item
          const result: MoodleCourseResult = {
            id: item.id,
            name: item.itemname || '',
            itemType: item.itemtype || item.itemmodule || 'unknown',
            gradeFormatted: item.gradeformatted,
            gradeRaw: item.graderaw !== undefined ? parseFloat(item.graderaw) : undefined,
            gradeMax: item.grademax !== undefined ? parseFloat(item.grademax) : undefined,
            feedbackFormatted: item.feedback,
            status: this.determineGradeStatus(item),
            courseId: courseId,

            // Category-specific fields
            isCategory: isCategory,
            isCategorySummary: isCategorySummary,
            isOverallSummary: isOverallSummary,
            categoryId: item.categoryid || 0,
            weight: item.weightraw !== undefined ? parseFloat(item.weightraw) * 100 : undefined,
            weightFormatted: item.weightformatted,
            range:
              item.grademin !== undefined && item.grademax !== undefined
                ? `${item.grademin}–${item.grademax}`
                : undefined,
            percentage:
              item.percentageformatted !== undefined
                ? parseFloat(item.percentageformatted.replace('%', '').trim())
                : undefined,
            percentageFormatted: item.percentageformatted,
            contributionToTotal:
              item.contributiontocoursetotalraw !== undefined
                ? parseFloat(item.contributiontocoursetotalraw) * 100
                : undefined,
            contributionFormatted: item.contributiontocourseformatted,
            level: 0, // Default level, will be updated later
            isExpanded: true, // Default to expanded
          };

          allResults.push(result);

          // Track categories for later processing
          if (isCategory) {
            categoriesById[item.id] = result;

            // Initialize the items array for this category
            if (!itemsByCategory[item.id]) {
              itemsByCategory[item.id] = [];
            }
          }

          // Add to parent category's children (if it has a parent)
          if (item.categoryid && item.categoryid > 0) {
            if (!itemsByCategory[item.categoryid]) {
              itemsByCategory[item.categoryid] = [];
            }

            // Add this item to its parent category's items
            itemsByCategory[item.categoryid].push(result);
          }
        });

        // Second pass - establish hierarchy and levels
        const processedResults: MoodleCourseResult[] = [];
        const processedIds = new Set<number>();

        // Find the root categories (those without parents or with parent = 0)
        const rootCategories = allResults.filter(
          r => r.isCategory && (!r.categoryId || r.categoryId === 0)
        );

        // Start with overall summary if it exists
        const overallSummary = allResults.find(r => r.isOverallSummary);
        if (overallSummary) {
          overallSummary.level = 0;
          processedResults.push(overallSummary);
          processedIds.add(overallSummary.id);
        }

        // Process each root category and its children
        rootCategories.forEach(category => {
          // Skip if already processed (avoid duplicates)
          if (processedIds.has(category.id)) return;

          // Set the level for the category
          category.level = 1;
          processedResults.push(category);
          processedIds.add(category.id);

          // Get all items for this category
          const categoryItems = itemsByCategory[category.id] || [];

          // Further categorize by subcategories
          const subcategories = categoryItems.filter(item => item.isCategory);
          const directItems = categoryItems.filter(
            item => !item.isCategory && !item.isCategorySummary
          );

          // Add direct items first
          directItems.forEach(item => {
            item.level = 2;
            processedResults.push(item);
            processedIds.add(item.id);
          });

          // Then process each subcategory
          subcategories.forEach(subcategory => {
            // Skip if already processed (avoid duplicates)
            if (processedIds.has(subcategory.id)) return;

            subcategory.level = 2;
            processedResults.push(subcategory);
            processedIds.add(subcategory.id);

            // Get all items for this subcategory
            const subcategoryItems = itemsByCategory[subcategory.id] || [];

            // Add items from subcategory
            subcategoryItems.forEach(item => {
              // Skip if already processed or if it's a category itself
              if (processedIds.has(item.id) || item.isCategory) return;

              item.level = 3;
              processedResults.push(item);
              processedIds.add(item.id);
            });

            // Add subcategory summary if it exists
            const subcategorySummary = allResults.find(
              r => r.isCategorySummary && r.categoryId === subcategory.id
            );

            if (subcategorySummary) {
              subcategorySummary.level = 3;
              processedResults.push(subcategorySummary);
              processedIds.add(subcategorySummary.id);
            }
          });

          // Add category summary if it exists
          const categorySummary = allResults.find(
            r => r.isCategorySummary && r.categoryId === category.id
          );

          if (categorySummary) {
            categorySummary.level = 2;
            processedResults.push(categorySummary);
            processedIds.add(categorySummary.id);
          }
        });

        // Add any remaining items that weren't processed
        allResults.forEach(result => {
          if (!processedIds.has(result.id)) {
            processedResults.push(result);
          }
        });

        return processedResults;
      })
    );
  }

  /**
   * Helper function to determine the status of a grade item
   */
  private determineGradeStatus(gradeItem: any): string {
    if (gradeItem.graderaw === null || gradeItem.graderaw === undefined) {
      return 'notsubmitted';
    }

    if (gradeItem.feedback) {
      return 'graded';
    }

    return 'submitted';
  }

  /**
   * Search for available courses - handles both ID and name searches
   * @param searchTerm Keyword or ID to search for
   */
  searchCourses(searchTerm: string): Observable<MoodleModule[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const trimmedTerm = searchTerm.trim();

    // If empty search term, return empty array
    if (!trimmedTerm) {
      return of([]);
    }

    // Check if the search term is purely numeric (likely an ID)
    const isNumeric = /^\d+$/.test(trimmedTerm);

    // For numeric search terms, search by both ID and name
    if (isNumeric) {
      const courseId = Number(trimmedTerm);

      // First search by ID
      const idSearch = this.searchCourseById(courseId);

      // Then search by name using the same numeric term
      const nameSearch = this.searchCoursesByName(trimmedTerm);

      // Combine results and remove duplicates
      return forkJoin([idSearch, nameSearch]).pipe(
        map(([idResults, nameResults]) => {
          // Combine both result sets
          const combinedResults = [...idResults, ...nameResults];

          // Remove duplicates by using course ID as unique identifier
          const uniqueResults = combinedResults.filter(
            (course, index, self) => index === self.findIndex(c => c.id === course.id)
          );

          return uniqueResults;
        }),
        catchError(error => {
          console.error('Error in combined search:', error);
          // Fallback to name search if combined search fails
          return this.searchCoursesByName(trimmedTerm);
        })
      );
    }

    // For non-numeric search terms, just use the name search
    return this.searchCoursesByName(trimmedTerm);
  }

  /**
   * Search course directly by ID
   * @param courseId The course ID to search for
   */
  private searchCourseById(courseId: number): Observable<MoodleModule[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'core_course_get_courses_by_field')
      .set('field', 'id')
      .set('value', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        if (!response || !response.courses || response.courses.length === 0) {
          return [];
        }

        // Map API response to our MoodleModule interface
        return response.courses.map((course: any) => ({
          id: course.id,
          name: course.fullname,
          description: course.summary,
          visible: course.visible === 1,
          summary: course.summary,
          lastAccess: undefined,
          courseId: course.id,
          courseName: course.shortname,
        }));
      }),
      catchError(error => {
        console.error('Error searching by ID:', error);
        return of([]);
      })
    );
  }

  /**
   * Search courses by name using the search API
   * @param searchTerm Keyword to search for
   */
  private searchCoursesByName(searchTerm: string): Observable<MoodleModule[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'core_course_search_courses')
      .set('criterianame', 'search')
      .set('criteriavalue', searchTerm)
      .set('moodlewsrestformat', 'json')
      .set('page', '0')
      .set('perpage', '100')
      .set('limittoenrolled', '0');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        if (!response || !response.courses) {
          return [];
        }

        // Map API response to our MoodleModule interface
        return response.courses.map((course: any) => ({
          id: course.id,
          name: course.fullname,
          description: course.summary,
          visible: course.visible === 1,
          summary: course.summary,
          lastAccess: undefined,
          courseId: course.id,
          courseName: course.shortname,
        }));
      }),
      catchError(error => {
        console.error('Error searching by name:', error);
        return of([]);
      })
    );
  }

  /**
   * Enroll the current user in a course
   * @param courseId The ID of the course to enroll in
   * @returns An observable with the enrollment status
   */
  enrollInCourse(courseId: number): Observable<{ status: boolean; warnings?: any[] }> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of({ status: false, warnings: [{ message: 'User not logged in' }] });
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'enrol_self_enrol_user')
      .set('courseid', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        // Check if there was an error
        if (response.errorcode) {
          console.error('Enrollment error:', response);
          return {
            status: false,
            warnings: [{ message: response.message || 'Failed to enroll in course' }],
          };
        }

        // Handle successful enrollment
        return {
          status: response.status || true,
          warnings: response.warnings || [],
        };
      }),
      catchError(error => {
        console.error('Enrollment request failed:', error);
        return of({
          status: false,
          warnings: [{ message: 'Enrollment request failed' }],
        });
      })
    );
  }

  /**
   * Unenroll the current user from a course
   * @param courseId The ID of the course to unenroll from
   * @returns An observable with the unenrollment status
   */
  unenrollFromCourse(courseId: number): Observable<{ status: boolean; warnings?: any[] }> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of({ status: false, warnings: [{ message: 'User not logged in' }] });
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    // Try direct unenrollment first using self method
    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'enrol_self_unenrol_user')
      .set('courseid', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        // Check if there was an error
        if (response.errorcode) {
          console.error('Unenrollment error:', response);

          // If the API function doesn't exist, provide a fallback URL
          if (response.errorcode === 'invalidfunction') {
            const fallbackUrl = `${this.currentSite?.domain}/enrol/self/unenrolself.php?id=${courseId}`;
            return {
              status: true,
              warnings: [
                {
                  message: 'Direct API unenrollment not supported by this Moodle instance.',
                  fallbackUrl: fallbackUrl,
                },
              ],
            };
          }

          return {
            status: false,
            warnings: [{ message: response.message || 'Failed to unenroll from course' }],
          };
        }

        // Handle successful unenrollment
        return {
          status: true,
          warnings: response.warnings || [],
        };
      }),
      catchError(error => {
        console.error('Unenrollment request failed:', error);

        // Provide a fallback URL to the standard Moodle unenroll page
        if (this.currentSite?.domain) {
          const fallbackUrl = `${this.currentSite.domain}/enrol/self/unenrolself.php?id=${courseId}`;
          return of({
            status: true,
            warnings: [
              {
                message: 'Direct API unenrollment failed.',
                fallbackUrl: fallbackUrl,
              },
            ],
          });
        }

        return of({
          status: false,
          warnings: [{ message: 'Unenrollment request failed' }],
        });
      })
    );
  }
}

// Helper extension to generate ID from string
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function (): number {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};
