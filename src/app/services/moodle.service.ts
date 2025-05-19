import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap, of, switchMap } from 'rxjs';
import { 
  MoodleUser, 
  MoodleSite, 
  MoodleModule, 
  MoodleContent, 
  MoodleLoginResponse 
} from '../models/moodle.models';

@Injectable({
  providedIn: 'root'
})
export class MoodleService {
  private currentUser: MoodleUser | null = null;
  private currentSite: MoodleSite | null = null;
  
  constructor(private http: HttpClient) { 
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
    // Format the domain correctly
    const formattedDomain = this.formatDomain(site);
    
    // Store the site information
    this.currentSite = { domain: formattedDomain };
    
    // Construct the login URL
    const loginUrl = `${formattedDomain}/login/token.php`;
      // Set up the parameters
    const params = new HttpParams()
      .set('username', username)
      .set('password', password)
      .set('service', 'moodle_mobile_app');
    
    return this.http.post<MoodleLoginResponse>(loginUrl, null, { params }).pipe(
      switchMap(response => {
        if (response.error) {
          throw new Error(response.error);
        }
        
        // Get user details with the token
        return this.getUserInfo(formattedDomain, response.token);
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
        // Create user object
        const user: MoodleUser = {
          id: info.userid,
          username: info.username,
          firstname: info.firstname,
          lastname: info.lastname,
          fullname: info.fullname,
          email: info.email,
          token: token
        };
        
        // Store user in the service and localStorage
        this.setCurrentUser(user);
        this.currentSite = {
          domain: domain,
          sitename: info.sitename,
          logo: info.userpictureurl
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
        // Map API response to our MoodleModule interface
        return courses.map(course => ({
          id: course.id,
          name: course.fullname,
          description: course.summary,
          visible: course.visible === 1,
          summary: course.summary,
          lastAccess: course.lastaccess ? new Date(course.lastaccess * 1000) : undefined,
          courseId: course.id,
          courseName: course.shortname
        }));
      }),
      // Sort by last access date (most recent first)
      map(modules => modules.sort((a, b) => {
        if (!a.lastAccess) return 1;
        if (!b.lastAccess) return -1;
        return b.lastAccess.getTime() - a.lastAccess.getTime();
      }))
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
        const allContents: MoodleContent[] = [];        sections.forEach(section => {
          // Add section title as text content
          if (section.name) {
            allContents.push({
              id: section.id,
              name: section.name,
              type: 'section',
              content: section.summary || '',
              moduleId: courseId
            });
          }
          
          // Process each module in the section
          if (section.modules) {
            // Group modules by type for better organization
            const sectionModules: { [key: string]: any[] } = {};
            
            section.modules.forEach((module: any) => {
              // Skip modules without contents
              if (!module.contents || module.contents.length === 0) {
                return;
              }
              
              // Handle special case for labels - integrate them directly into section
              if (module.modname === 'label') {
                // Add label content directly to section without separate header
                if (module.contents && module.contents.length > 0 && module.contents[0].content) {
                  allContents.push({
                    id: module.id,
                    name: '',  // No name for labels
                    type: 'label',
                    content: module.contents[0].content,
                    moduleId: courseId
                  });
                }
                return;
              }
              
              // Create an entry for the module with all its content combined
              const mainContent: MoodleContent = {
                id: module.id,
                name: module.name,
                type: module.modname || 'unknown',
                content: '',
                moduleId: courseId
              };
              
              // Process contents of the module
              if (module.contents) {
                // For resources like files, combine all information into one entry
                if (module.modname === 'resource' && module.contents.length > 0) {
                  const fileContent = module.contents[0];
                  mainContent.fileUrl = fileContent.fileurl ? this.appendTokenToUrl(fileContent.fileurl) : undefined;
                  mainContent.mimeType = fileContent.mimetype;
                  mainContent.type = this.determineContentType(fileContent);
                  
                  // If there's a description, add it to the main content
                  const descriptionContent = module.contents.find((c: any) => c.type === 'file' && c.content);
                  if (descriptionContent) {
                    mainContent.content = descriptionContent.content;
                  }
                  
                  allContents.push(mainContent);
                }                // Handle URLs properly
                else if (module.modname === 'url' && module.contents.length > 0) {
                  const urlContent = module.contents[0];
                  
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
                  
                  mainContent.fileUrl = externalUrl;
                  mainContent.type = 'url';
                  
                  // If there's a description, add it to the main content
                  if (urlContent.content) {
                    mainContent.content = urlContent.content;
                  }
                  
                  allContents.push(mainContent);
                }
                // Handle other module types
                else {
                  allContents.push(mainContent);
                  
                  // Add subcontents as needed
                  module.contents.forEach((content: any) => {
                    // Skip content that's just metadata or already processed
                    if (content.type === 'file' && content.mimetype) {
                      allContents.push({
                        id: content.fileurl ? content.fileurl.hashCode() : Math.random(),
                        name: content.filename || content.name || 'Content',
                        type: this.determineContentType(content),
                        content: content.content,
                        fileUrl: content.fileurl ? this.appendTokenToUrl(content.fileurl) : undefined,
                        mimeType: content.mimetype,
                        timeModified: content.timemodified ? new Date(content.timemodified * 1000) : undefined,
                        moduleId: courseId
                      });
                    }
                  });
                }
              }
            });
          }
        });
        
        return allContents;
      })
    );
  }

  /**
   * Determine the type of content based on the API response
   */
  private determineContentType(content: any): string {
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
    const userJson = localStorage.getItem('moodleUser');
    const siteJson = localStorage.getItem('moodleSite');
    
    if (userJson && siteJson) {
      this.currentUser = JSON.parse(userJson);
      this.currentSite = JSON.parse(siteJson);
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
}

// Helper extension to generate ID from string
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function(): number {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};
