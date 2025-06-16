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
  AssignmentSubmissionFile,
  QuizAttempt,
  QuizQuestion,
  QuizAttemptData,
  QuizAccessInfo,
  QuizStartResponse,
  QuizSubmitResponse,
  QuizSaveResponse,
  QuizTimer,
  QuizState,
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
      switchMap(info => {
        console.log('MoodleService: Raw API response from core_webservice_get_site_info:', info);
        
        // Sanitize user info from API
        const sanitizedInfo = this.sanitization.sanitizeObject(info, {
          allowBasicHtml: false,
          trimWhitespace: true
        });

        console.log('MoodleService: Sanitized info:', sanitizedInfo);

        // Get complete user details using core_user_get_users_by_field
        return this.getUserDetailsByField('id', sanitizedInfo.userid.toString(), token, domain).pipe(
          map(userDetails => {
            console.log('MoodleService: Complete user details from core_user_get_users_by_field:', userDetails);

            // Use profile picture from detailed user info if available, otherwise fallback to site info
            const profilePictureUrl = userDetails?.profileimageurl || userDetails?.profileimageurlsmall || sanitizedInfo.userpictureurl || '';
            console.log('MoodleService: Profile picture URL found:', profilePictureUrl);

            // Create user object with complete information
            const user: MoodleUser = {
              id: sanitizedInfo.userid,
              username: this.sanitization.sanitizeUsername(sanitizedInfo.username || ''),
              firstname: this.sanitization.sanitizeText(sanitizedInfo.firstname || ''),
              lastname: this.sanitization.sanitizeText(sanitizedInfo.lastname || ''),
              fullname: this.sanitization.sanitizeText(sanitizedInfo.fullname || ''),
              email: this.sanitization.sanitizeEmail(sanitizedInfo.email || ''),
              token: token, // Don't sanitize token
              profilePictureUrl: this.sanitization.sanitizeUrl(profilePictureUrl),
            };

            console.log('MoodleService: Created user object with profile picture:', user);

            // Store user in the service and localStorage
            this.setCurrentUser(user);
            this.currentSite = {
              domain: domain,
              sitename: this.sanitization.sanitizeText(sanitizedInfo.sitename || ''),
              logo: this.sanitization.sanitizeUrl(sanitizedInfo.sitelogo || ''),
            };
            this.saveSession();

            return user;
          }),
          catchError(userDetailsError => {
            console.warn('MoodleService: Failed to get detailed user info, using basic info:', userDetailsError);
            
            // Fallback to basic user info if detailed fetch fails
            const user: MoodleUser = {
              id: sanitizedInfo.userid,
              username: this.sanitization.sanitizeUsername(sanitizedInfo.username || ''),
              firstname: this.sanitization.sanitizeText(sanitizedInfo.firstname || ''),
              lastname: this.sanitization.sanitizeText(sanitizedInfo.lastname || ''),
              fullname: this.sanitization.sanitizeText(sanitizedInfo.fullname || ''),
              email: this.sanitization.sanitizeEmail(sanitizedInfo.email || ''),
              token: token, // Don't sanitize token
              profilePictureUrl: this.sanitization.sanitizeUrl(sanitizedInfo.userpictureurl || ''),
            };

            console.log('MoodleService: Created fallback user object:', user);

            // Store user in the service and localStorage
            this.setCurrentUser(user);
            this.currentSite = {
              domain: domain,
              sitename: this.sanitization.sanitizeText(sanitizedInfo.sitename || ''),
              logo: this.sanitization.sanitizeUrl(sanitizedInfo.sitelogo || ''),
            };
            this.saveSession();

            return of(user);
          })
        );
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
      switchMap(courses => {
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
            subject: '' // Initialize empty subject
          };
        });

        // If no courses, return empty array
        if (sanitizedCourses.length === 0) {
          return of([]);
        }

        // Fetch categories for all courses in parallel
        const categoryRequests = sanitizedCourses.map(course => 
          this.getCourseCategory(course.id).pipe(
            map(subject => ({ courseId: course.id, subject })),
            catchError(error => {
              console.error(`Error loading category for course ${course.id}:`, error);
              return of({ courseId: course.id, subject: '' });
            })
          )
        );

        return forkJoin(categoryRequests).pipe(
          map(categoryResults => {
            // Merge categories back into courses
            const subjectsByCourseId = new Map(
              categoryResults.map(result => [result.courseId, result.subject])
            );

            return sanitizedCourses.map(course => ({
              ...course,
              subject: subjectsByCourseId.get(course.id) || ''
            }));
          })
        );
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

    // Fetch base content and enhanced details in parallel
    return forkJoin({
      baseContent: this.http.get<any[]>(webServiceUrl, { params }),
      assignments: this.getAssignmentDetails(courseId),
      quizzes: this.getQuizDetails(courseId)
    }).pipe(
      switchMap(({ baseContent, assignments, quizzes }) => {
        // Create lookup maps for enhanced data
        const assignmentMap = new Map(assignments.map((a: any) => [a.cmid, a]));
        const quizMap = new Map(quizzes.map((q: any) => [q.coursemodule, q]));

        // Collect all assignment and quiz IDs for individual API calls
        const assignmentApiCalls: Observable<any>[] = [];
        const quizApiCalls: Observable<any>[] = [];
        const assignmentIds: number[] = [];
        const quizIds: number[] = [];

        // First pass: collect all assignment and quiz IDs
        baseContent.forEach(section => {
          if (section.modules) {
            section.modules.forEach((module: any) => {
              if (module.modname === 'assign') {
                const assignmentDetails = assignmentMap.get(module.id);
                if (assignmentDetails) {
                  assignmentIds.push(assignmentDetails.id);
                  assignmentApiCalls.push(
                    this.getAssignmentSubmission(assignmentDetails.id).pipe(
                      map(result => ({ moduleId: module.id, assignmentId: assignmentDetails.id, data: result }))
                    )
                  );
                }
              } else if (module.modname === 'quiz') {
                const quizDetails = quizMap.get(module.id);
                if (quizDetails) {
                  quizIds.push(quizDetails.id);
                  quizApiCalls.push(
                    this.getQuizAttemptsForQuiz(quizDetails.id).pipe(
                      map(result => ({ moduleId: module.id, quizId: quizDetails.id, data: result }))
                    )
                  );
                }
              }
            });
          }
        });

        // Make all individual API calls
        const allApiCalls = [...assignmentApiCalls, ...quizApiCalls];
        
        if (allApiCalls.length === 0) {
          // No assignments or quizzes, process normally
          return of({ baseContent, assignments, quizzes, submissionData: [], quizAttemptData: [] });
        }

        return forkJoin(allApiCalls).pipe(
          map(results => {
            const submissionData = results.filter(r => 'assignmentId' in r);
            const quizAttemptData = results.filter(r => 'quizId' in r);
            return { baseContent, assignments, quizzes, submissionData, quizAttemptData };
          }),
          catchError(error => {
            console.warn('Some individual API calls failed, continuing with basic data:', error);
            return of({ baseContent, assignments, quizzes, submissionData: [], quizAttemptData: [] });
          })
        );
      }),
      map(({ baseContent, assignments, quizzes, submissionData, quizAttemptData }) => {
        // Create lookup maps for enhanced data
        const assignmentMap = new Map(assignments.map((a: any) => [a.cmid, a]));
        const quizMap = new Map(quizzes.map((q: any) => [q.coursemodule, q]));
        
        // Create lookup maps for submission and attempt data
        const submissionMap = new Map(submissionData.map((s: any) => [s.moduleId, s.data]));
        const quizAttemptsMap = new Map(quizAttemptData.map((q: any) => [q.moduleId, q.data]));

        // Flatten all sections and modules into our content format
        const allContents: MoodleContent[] = [];
        baseContent.forEach(section => {
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
              summary: this.sanitization.sanitizeHtml(sanitizedSection.summary || '', {
                allowBasicHtml: true,
                allowLinks: true,
                allowImages: true
              }),
              summaryformat: sanitizedSection.summaryformat,
              visible: sanitizedSection.visible,
              uservisible: sanitizedSection.uservisible,
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

              // Skip invisible modules unless they should be shown
              if (!sanitizedModule.uservisible && !sanitizedModule.visible) {
                return;
              }

              // Create base content object for each module
              const baseContent: MoodleContent = {
                id: sanitizedModule.id,
                name: this.sanitization.sanitizeText(sanitizedModule.name || ''),
                type: sanitizedModule.modname || 'unknown',
                description: this.sanitization.sanitizeHtml(sanitizedModule.description || '', {
                  allowBasicHtml: true,
                  allowLinks: true,
                  allowImages: true
                }),
                url: sanitizedModule.url ? this.sanitization.sanitizeUrl(sanitizedModule.url) : undefined,
                visible: sanitizedModule.visible,
                uservisible: sanitizedModule.uservisible,
                visibleoncoursepage: sanitizedModule.visibleoncoursepage,
                modicon: sanitizedModule.modicon ? this.sanitization.sanitizeUrl(sanitizedModule.modicon) : undefined,
                purpose: this.sanitization.sanitizeText(sanitizedModule.purpose || ''),
                indent: sanitizedModule.indent || 0,
                noviewlink: sanitizedModule.noviewlink,
                moduleId: courseId,
                modname: sanitizedModule.modname,
                timeModified: sanitizedModule.timemodified
                  ? new Date(sanitizedModule.timemodified * 1000)
                  : undefined,
              };

              // Handle different module types
              switch (sanitizedModule.modname) {
                case 'label':
                  // Labels have their content in the description field
                  baseContent.type = 'label';
                  baseContent.content = baseContent.description; // Use description as content
                  allContents.push(baseContent);
                  break;

                case 'assign':
                  baseContent.type = 'assignment';
                  baseContent.content = baseContent.description;
                  // Add direct link to assignment
                  if (this.currentSite?.domain) {
                    baseContent.fileUrl = this.sanitization.sanitizeUrl(
                      `${this.currentSite.domain}/mod/assign/view.php?id=${sanitizedModule.id}`
                    );
                  }
                  
                  // Merge assignment details
                  const assignmentDetails: any = assignmentMap.get(sanitizedModule.id);
                  if (assignmentDetails) {
                    baseContent.dueDate = assignmentDetails.duedate ? new Date(assignmentDetails.duedate * 1000) : undefined;
                    baseContent.allowSubmissionsFromDate = assignmentDetails.allowsubmissionsfromdate ? new Date(assignmentDetails.allowsubmissionsfromdate * 1000) : undefined;
                    baseContent.cutoffDate = assignmentDetails.cutoffdate ? new Date(assignmentDetails.cutoffdate * 1000) : undefined;
                    baseContent.gradingDueDate = assignmentDetails.gradingduedate ? new Date(assignmentDetails.gradingduedate * 1000) : undefined;
                    baseContent.grade = assignmentDetails.grade;
                    baseContent.maxAttempts = assignmentDetails.maxattempts;
                    baseContent.teamSubmission = assignmentDetails.teamsubmission === 1;
                    baseContent.blindMarking = assignmentDetails.blindmarking === 1;
                    baseContent.requireSubmissionStatement = assignmentDetails.requiresubmissionstatement === 1;
                    
                    // Extract submission configuration
                    const fileConfig = assignmentDetails.configs?.find((c: any) => c.plugin === 'file' && c.name === 'maxfilesubmissions');
                    if (fileConfig) {
                      baseContent.maxFileSubmissions = parseInt(fileConfig.value);
                    }
                    
                    const sizeConfig = assignmentDetails.configs?.find((c: any) => c.plugin === 'file' && c.name === 'maxsubmissionsizebytes');
                    if (sizeConfig) {
                      baseContent.maxSubmissionSizeBytes = parseInt(sizeConfig.value);
                    }
                    
                    const typesConfig = assignmentDetails.configs?.find((c: any) => c.plugin === 'file' && c.name === 'filetypeslist');
                    if (typesConfig) {
                      baseContent.fileTypesAllowed = typesConfig.value;
                    }
                  }
                  
                  // Always set hasSubmitted to false as default to show the submission status section
                  baseContent.hasSubmitted = false;
                  baseContent.submissionStatus = 'new';
                  baseContent.submissionGradingStatus = 'notgraded';
                  
                  // Merge submission status if available
                  const submissionData = submissionMap.get(sanitizedModule.id);
                  if (submissionData && submissionData.lastattempt) {
                    const submission = submissionData.lastattempt.submission;
                    const grade = submissionData.lastattempt.grade;
                    
                    if (submission) {
                      baseContent.submissionStatus = submission.status || 'new';
                      baseContent.hasSubmitted = submission.status === 'submitted';
                      baseContent.submissionTimeModified = submission.timemodified ? new Date(submission.timemodified * 1000) : undefined;
                      baseContent.submissionAttemptNumber = submission.attemptnumber;
                      
                      // Process submitted files
                      if (submission.plugins) {
                        const filePlugin = submission.plugins.find((p: any) => p.type === 'file');
                        if (filePlugin && filePlugin.fileareas) {
                          const submissionFiles = filePlugin.fileareas.find((fa: any) => fa.area === 'submission_files');
                          if (submissionFiles && submissionFiles.files) {
                            baseContent.submissionFiles = submissionFiles.files.map((file: any) => ({
                              filename: file.filename,
                              filepath: file.filepath,
                              filesize: file.filesize,
                              fileurl: this.appendTokenToUrl(this.sanitization.sanitizeUrl(file.fileurl)),
                              mimetype: file.mimetype,
                              timemodified: new Date(file.timemodified * 1000)
                            }));
                          }
                        }
                        
                        // Process text submission
                        const textPlugin = submission.plugins.find((p: any) => p.type === 'onlinetext');
                        if (textPlugin && textPlugin.editorfields) {
                          const textField = textPlugin.editorfields.find((ef: any) => ef.name === 'onlinetext_editor');
                          if (textField) {
                            baseContent.submissionText = textField.text;
                          }
                        }
                      }
                    }
                    
                    if (grade) {
                      baseContent.submissionGradingStatus = grade.grade !== null ? 'graded' : 'notgraded';
                      baseContent.submissionGrade = grade.grade;
                      baseContent.submissionFeedback = grade.feedbackcomments;
                    }
                  }
                  
                  allContents.push(baseContent);
                  break;

                case 'quiz':
                  baseContent.type = 'quiz';
                  baseContent.content = baseContent.description;
                  // Add direct link to quiz
                  if (this.currentSite?.domain) {
                    baseContent.fileUrl = this.sanitization.sanitizeUrl(
                      `${this.currentSite.domain}/mod/quiz/view.php?id=${sanitizedModule.id}`
                    );
                  }
                  
                  // Merge quiz details
                  const quizDetails: any = quizMap.get(sanitizedModule.id);
                  if (quizDetails) {
                    baseContent.quizId = quizDetails.id; // Store the actual quiz ID
                    baseContent.timeOpen = quizDetails.timeopen ? new Date(quizDetails.timeopen * 1000) : undefined;
                    baseContent.timeClose = quizDetails.timeclose ? new Date(quizDetails.timeclose * 1000) : undefined;
                    baseContent.timeLimit = quizDetails.timelimit;
                    baseContent.attempts = quizDetails.attempts;
                    baseContent.gradeMethod = quizDetails.grademethod;
                    baseContent.questionsPerPage = quizDetails.questionsperpage;
                    baseContent.sumGrades = quizDetails.sumgrades;
                    baseContent.grade = quizDetails.grade;
                    baseContent.hasQuestions = quizDetails.hasquestions === 1;
                    baseContent.hasFeedback = quizDetails.hasfeedback === 1;
                    baseContent.overdueHandling = quizDetails.overduehandling;
                    baseContent.graceperiod = quizDetails.graceperiod;
                    baseContent.browsersecurity = quizDetails.browsersecurity;
                    
                    // Set default values
                    baseContent.attemptsUsed = 0;
                    baseContent.canAttempt = true;
                    baseContent.quizAttempts = [];
                    
                    // Merge quiz attempts if available
                    const attempts = quizAttemptsMap.get(sanitizedModule.id) || [];
                    if (attempts.length > 0) {
                      baseContent.quizAttempts = attempts.map((attempt: any) => ({
                        id: attempt.id,
                        attempt: attempt.attempt,
                        uniqueid: attempt.uniqueid,
                        layout: attempt.layout,
                        currentpage: attempt.currentpage,
                        preview: attempt.preview === 1,
                        state: attempt.state,
                        timestart: new Date(attempt.timestart * 1000),
                        timefinish: attempt.timefinish ? new Date(attempt.timefinish * 1000) : undefined,
                        timemodified: new Date(attempt.timemodified * 1000),
                        timecheckstate: attempt.timecheckstate ? new Date(attempt.timecheckstate * 1000) : undefined,
                        sumgrades: attempt.sumgrades,
                        grade: attempt.grade,
                        gradednotificationsenttime: attempt.gradednotificationsenttime ? new Date(attempt.gradednotificationsenttime * 1000) : undefined
                      }));
                      
                      baseContent.attemptsUsed = attempts.length;
                      const validGrades = attempts.filter((a: any) => a.grade !== null && a.grade !== undefined).map((a: any) => a.grade);
                      if (validGrades.length > 0) {
                        baseContent.bestAttemptGrade = Math.max(...validGrades);
                      }
                      baseContent.lastAttemptState = attempts[attempts.length - 1]?.state;
                      baseContent.canAttempt = ((baseContent.attempts || 0) === 0 || (baseContent.attemptsUsed || 0) < (baseContent.attempts || 0)) && 
                                              baseContent.lastAttemptState !== 'inprogress';
                    }
                  }
                  
                  allContents.push(baseContent);
                  break;

                case 'forum':
                  baseContent.type = 'forum';
                  baseContent.content = baseContent.description;
                  baseContent.fileUrl = baseContent.url; // Use the URL from the module
                  allContents.push(baseContent);
                  break;

                case 'resource':
                  // Handle file resources
                  if (sanitizedModule.contents && sanitizedModule.contents.length > 0) {
                    const fileContent = sanitizedModule.contents[0];
                    baseContent.fileUrl = fileContent.fileurl
                      ? this.appendTokenToUrl(this.sanitization.sanitizeUrl(fileContent.fileurl))
                      : undefined;
                    baseContent.mimeType = this.sanitization.sanitizeText(fileContent.mimetype || '');
                    baseContent.type = this.determineContentType(fileContent);
                    baseContent.content = baseContent.description; // Use description for resource content
                    baseContent.timeCreated = fileContent.timecreated
                      ? new Date(fileContent.timecreated * 1000)
                      : undefined;
                    baseContent.timeModified = fileContent.timemodified
                      ? new Date(fileContent.timemodified * 1000)
                      : undefined;
                  } else {
                    baseContent.type = 'resource';
                    baseContent.content = baseContent.description;
                  }
                  allContents.push(baseContent);
                  break;

                case 'url':
                  // Handle URL resources
                  baseContent.type = 'url';
                  baseContent.content = baseContent.description;
                  if (sanitizedModule.contents && sanitizedModule.contents.length > 0) {
                    const urlContent = sanitizedModule.contents[0];
                    // Extract external URL from fileurl parameter
                    if (urlContent.fileurl) {
                      const urlMatch = urlContent.fileurl.match(/url=([^&]+)/);
                      if (urlMatch && urlMatch[1]) {
                        baseContent.fileUrl = this.sanitization.sanitizeUrl(decodeURIComponent(urlMatch[1]));
                      } else {
                        baseContent.fileUrl = this.sanitization.sanitizeUrl(urlContent.fileurl);
                      }
                    }
                  } else if (baseContent.url) {
                    // Use the module URL if no contents
                    baseContent.fileUrl = baseContent.url;
                  }
                  allContents.push(baseContent);
                  break;

                default:
                  // Handle any other module types
                  baseContent.content = baseContent.description;
                  // If module has contents, process them
                  if (sanitizedModule.contents && sanitizedModule.contents.length > 0) {
                    sanitizedModule.contents.forEach((content: any) => {
                      if (content.type === 'file' && content.mimetype) {
                        const subContent: MoodleContent = {
                          ...baseContent,
                          id: content.fileurl ? content.fileurl.hashCode() : Math.random(),
                          name: this.sanitization.sanitizeText(content.filename || content.name || baseContent.name),
                          type: this.determineContentType(content),
                          fileUrl: content.fileurl
                            ? this.appendTokenToUrl(this.sanitization.sanitizeUrl(content.fileurl))
                            : undefined,
                          mimeType: this.sanitization.sanitizeText(content.mimetype || ''),
                          timeCreated: content.timecreated
                            ? new Date(content.timecreated * 1000)
                            : undefined,
                          timeModified: content.timemodified
                            ? new Date(content.timemodified * 1000)
                            : undefined,
                        };
                        allContents.push(subContent);
                      }
                    });
                  } else {
                    // No contents, just add the base module
                    allContents.push(baseContent);
                  }
                  break;
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
   * Formats the domain to ensure it has the correct protocol (always HTTPS)
   */
  private formatDomain(domain: string): string {
    // Enforce HTTPS protocol for security
    // Trim whitespace and convert to lowercase
    const sanitized = domain.trim().toLowerCase();

    // Extract domain using a forgiving regex
    const match = sanitized.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);

    return match ? `https://${match[1]}` : '';
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
      switchMap(response => {
        if (!response || !response.courses || response.courses.length === 0) {
          return of([]);
        }

        // Map API response to our MoodleModule interface without subject first
        const courses: MoodleModule[] = response.courses.map((course: any) => ({
          id: course.id,
          name: course.fullname,
          description: course.summary,
          visible: course.visible === 1,
          summary: course.summary,
          lastAccess: undefined,
          courseId: course.id,
          courseName: course.shortname,
          subject: '' // Initialize empty subject
        }));

        // Fetch categories for all found courses
        const categoryRequests = courses.map((course: MoodleModule) => 
          this.getCourseCategory(course.id).pipe(
            map(subject => ({ courseId: course.id, subject })),
            catchError(error => {
              console.error(`Error loading category for search result course ${course.id}:`, error);
              return of({ courseId: course.id, subject: '' });
            })
          )
        );

        return forkJoin(categoryRequests).pipe(
          map((categoryResults: { courseId: number; subject: string }[]) => {
            // Merge categories back into courses
            const subjectsByCourseId = new Map(
              categoryResults.map((result: { courseId: number; subject: string }) => [result.courseId, result.subject])
            );

            return courses.map((course: MoodleModule) => ({
              ...course,
              subject: subjectsByCourseId.get(course.id) || ''
            }));
          })
        );
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
          subject: '' // Initialize empty subject - could be populated later if needed
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
   * Get complete user information including profile picture using core_user_get_users_by_field
   */
  getUserDetailsByField(field: string, value: string, token: string, domain: string): Observable<any> {
    const webServiceUrl = `${domain}/webservice/rest/server.php`;
    
    const params = new HttpParams()
      .set('wstoken', token)
      .set('wsfunction', 'core_user_get_users_by_field')
      .set('moodlewsrestformat', 'json')
      .set('field', field)
      .set('values[0]', value);

    console.log('MoodleService: Fetching user details using core_user_get_users_by_field:', {
      field,
      value,
      url: webServiceUrl
    });

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(users => {
        console.log('MoodleService: Raw user details response:', users);
        if (Array.isArray(users) && users.length > 0) {
          const user = users[0];
          console.log('MoodleService: User profile picture fields:', {
            profileimageurl: user.profileimageurl,
            profileimageurlsmall: user.profileimageurlsmall,
            picture: user.picture,
            imagealt: user.imagealt
          });
          
          // Try to construct the proper profile picture URL based on Moodle's user_picture logic
          // If the user has a custom picture (picture > 0), use the profileimageurl
          // Otherwise, fall back to default avatar handling
          if (user.picture && user.picture > 0 && user.profileimageurl) {
            console.log('MoodleService: User has custom profile picture');
            return user;
          } else {
            console.log('MoodleService: User has no custom profile picture, will use default');
            // Set profileimageurl to empty so we fall back to default avatar
            user.profileimageurl = '';
            user.profileimageurlsmall = '';
            return user;
          }
        }
        return null;
      })
    );
  }

  /**
   * Get the category/subject for a specific course
   */
  getCourseCategory(courseId: number): Observable<string> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of('');
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'core_course_get_courses_by_field')
      .set('field', 'id')
      .set('value', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      switchMap(response => {
        if (!response || !response.courses || response.courses.length === 0) {
          return of('');
        }

        const course = response.courses[0];
        if (!course.categoryid) {
          return of('');
        }

        // Ensure we still have a valid token and user
        if (!this.currentUser?.token) {
          return of('');
        }

        // Now get the category details
        const categoryParams = new HttpParams()
          .set('wstoken', this.currentUser.token)
          .set('wsfunction', 'core_course_get_categories')
          .set('criteria[0][key]', 'id')
          .set('criteria[0][value]', course.categoryid.toString())
          .set('moodlewsrestformat', 'json');

        return this.http.get<any[]>(webServiceUrl, { params: categoryParams }).pipe(
          map(categories => {
            if (categories && categories.length > 0) {
              return this.sanitization.sanitizeText(categories[0].name || '');
            }
            return '';
          })
        );
      }),
      catchError(error => {
        console.error('Error loading course category:', error);
        return of('');
      })
    );
  }

  /**
   * Get user's private files using the correct Moodle API
   */
  getUserPrivateFiles(): Observable<any[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const token = this.currentUser.token;
    const domain = this.currentSite.domain;
    const userId = this.currentUser.id;

    const webServiceUrl = `${domain}/webservice/rest/server.php`;

    // Use the correct API for accessing user private files
    // The correct approach is to use core_files_get_files with proper user context
    const params = new HttpParams()
      .set('wstoken', token)
      .set('wsfunction', 'core_files_get_files')
      .set('contextid', '1') // System context 
      .set('component', 'user')
      .set('filearea', 'private')
      .set('itemid', userId.toString()) // Use user ID as item ID
      .set('filepath', '/')
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Private files API response:', response);
        
        // Handle different response formats from Moodle API
        let files: any[] = [];
        
        if (response && typeof response === 'object') {
          // Check for error response
          if (response.errorcode) {
            console.error('Moodle API error:', response);
            // Return empty array instead of mock files
            return [];
          }
          
          // Handle successful response
          if (Array.isArray(response.files)) {
            files = response.files;
          } else if (Array.isArray(response)) {
            files = response;
          } else {
            console.warn('Unexpected response format from core_files_get_files:', response);
            return [];
          }
        }

        // Filter and sanitize file data
        return files
          .filter(file => file && file.filename && file.filename !== '.' && !file.filename.startsWith('..'))
          .map(file => {
            const sanitizedFile = this.sanitization.sanitizeObject(file, {
              allowBasicHtml: false,
              trimWhitespace: true
            });

            return {
              filename: this.sanitization.sanitizeText(sanitizedFile.filename || ''),
              filepath: this.sanitization.sanitizeText(sanitizedFile.filepath || '/'),
              mimetype: this.sanitization.sanitizeText(sanitizedFile.mimetype || 'application/octet-stream'),
              fileurl: this.sanitization.sanitizeUrl(sanitizedFile.fileurl || ''),
              filesize: parseInt(sanitizedFile.filesize) || 0,
              timemodified: sanitizedFile.timemodified || 0,
              timecreated: sanitizedFile.timecreated || 0,
              author: this.sanitization.sanitizeText(sanitizedFile.author || ''),
              license: this.sanitization.sanitizeText(sanitizedFile.license || '')
            };
          });
      }),
      catchError(error => {
        console.error('Error in getUserPrivateFiles:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to load private files');
        // Return empty array on error
        return of([]);
      })
    );
  }

  /**
   * Get user's private file storage quota and usage information
   */
  getUserFileStorageInfo(): Observable<{used: number, quota: number}> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of({used: 0, quota: 0});
    }

    // Get user's private files to calculate usage
    return this.getUserPrivateFiles().pipe(
      map(files => {
        // Calculate used space from actual files
        const usedBytes = files.reduce((total, file) => {
          const fileSize = typeof file.filesize === 'number' ? file.filesize : parseInt(file.filesize) || 0;
          return total + fileSize;
        }, 0);
        
        // Default quota - this would typically come from Moodle site configuration
        const quotaBytes = 100 * 1024 * 1024; // 100MB default
        
        return {
          used: usedBytes,
          quota: quotaBytes
        };
      }),
      catchError(error => {
        console.error('Error getting file storage info:', error);
        return of({used: 0, quota: 100 * 1024 * 1024});
      })
    );
  }

  /**
   * Upload a file to user's private file area
   */
  uploadPrivateFile(file: File): Observable<any> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      throw new Error('User not authenticated');
    }

    const uploadUrl = `${this.currentSite.domain}/webservice/upload.php`;
    
    const formData = new FormData();
    formData.append('token', this.currentUser.token);
    formData.append('component', 'user');
    formData.append('filearea', 'private');
    formData.append('itemid', '0');
    formData.append('filepath', '/');
    formData.append('file_1', file);

    return this.http.post<any>(uploadUrl, formData).pipe(
      map(response => {
        console.log('Upload response:', response);
        
        // Handle different response formats
        if (Array.isArray(response) && response.length > 0) {
          // Moodle typically returns an array with file info
          const sanitizedResponse = this.sanitization.sanitizeObject(response[0], {
            allowBasicHtml: false,
            trimWhitespace: true
          });
          return sanitizedResponse;
        } else if (response && typeof response === 'object') {
          // If it's a single object response
          const sanitizedResponse = this.sanitization.sanitizeObject(response, {
            allowBasicHtml: false,
            trimWhitespace: true
          });
          return sanitizedResponse;
        } else {
          console.warn('Unexpected upload response format:', response);
          return response;
        }
      }),
      catchError(error => {
        console.error('Upload error details:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to upload file');
        throw error;
      })
    );
  }

  /**
   * Delete a file from user's private area
   */
  deletePrivateFile(filename: string, filepath: string = '/'): Observable<boolean> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of(false);
    }

    // Note: Moodle doesn't have a direct web service to delete files
    // This would typically require a custom web service or use of core_files_delete_draft_files
    // For now, we'll simulate the operation
    console.warn('File deletion not fully implemented - requires custom Moodle web service');
    
    return of(true).pipe(
      catchError(error => {
        console.error('Error deleting file:', error);
        return of(false);
      })
    );
  }

  /**
   * Get file download URL for private files
   */
  getPrivateFileUrl(filename: string, filepath: string = '/'): string {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return '';
    }

    // Construct the download URL for private files
    const baseUrl = `${this.currentSite.domain}/webservice/pluginfile.php`;
    const contextId = this.currentUser.id; // Use user ID as context
    const component = 'user';
    const fileArea = 'private';
    const itemId = 0;
    
    return `${baseUrl}/${contextId}/${component}/${fileArea}/${itemId}${filepath}${filename}?token=${this.currentUser.token}`;
  }

  /**
   * Get assignment details for a course
   */
  private getAssignmentDetails(courseId: number): Observable<any[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_assign_get_assignments')
      .set('courseids[0]', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        // Extract assignments from the response structure
        if (response.courses && response.courses.length > 0) {
          return response.courses[0].assignments || [];
        }
        return [];
      }),
      catchError(error => {
        console.warn('Failed to load assignment details:', error);
        return of([]);
      })
    );
  }

  /**
   * Get quiz details for a course
   */
  private getQuizDetails(courseId: number): Observable<any[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_get_quizzes_by_courses')
      .set('courseids[0]', courseId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        // Extract quizzes from the response structure
        return response.quizzes || [];
      }),
      catchError(error => {
        console.warn('Failed to load quiz details:', error);
        return of([]);
      })
    );
  }

  /**
   * Get assignment submissions for a course
   */
  private getAssignmentSubmissions(courseId: number): Observable<any[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_assign_get_submissions')
      .set('assignmentids[0]', '0') // Get all assignments first, then we'll filter
      .set('status', '')
      .set('since', '0')
      .set('before', '0')
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Assignment submissions response:', response);
        // The response structure may vary depending on Moodle version
        if (response && response.assignments) {
          return response.assignments;
        }
        return [];
      }),
      catchError(error => {
        console.warn('Failed to load assignment submissions (this is normal if the API is not available):', error);
        return of([]);
      })
    );
  }

  /**
   * Get quiz attempts for a course - using alternative approach
   */
  private getQuizAttempts(courseId: number): Observable<any[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    // Try to get quiz attempts using mod_quiz_get_user_attempts
    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_get_user_attempts')
      .set('quizid', '0') // We'll need to call this for each quiz individually
      .set('userid', this.currentUser.id.toString())
      .set('status', 'all')
      .set('includepreviews', '0')
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Quiz attempts response:', response);
        if (response && response.attempts) {
          return response.attempts;
        }
        return [];
      }),
      catchError(error => {
        console.warn('Failed to load quiz attempts (this is normal if the API is not available):', error);
        return of([]);
      })
    );
  }

  /**
   * Get individual assignment submission - called for specific assignments
   */
  private getAssignmentSubmission(assignmentId: number): Observable<any> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      return of(null);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_assign_get_submission_status')
      .set('assignid', assignmentId.toString())
      .set('userid', this.currentUser.id.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Individual assignment submission response:', response);
        return response;
      }),
      catchError(error => {
        console.warn('Failed to load individual assignment submission:', error);
        return of(null);
      })
    );
  }

  /**
   * Get individual quiz attempts - called for specific quizzes
   */
  public getQuizAttemptsForQuiz(quizId: number): Observable<any[]> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      console.warn('Cannot get quiz attempts: User not authenticated');
      return of([]);
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_get_user_attempts')
      .set('quizid', quizId.toString())
      .set('userid', this.currentUser.id.toString())
      .set('status', 'all')
      .set('includepreviews', '0')
      .set('moodlewsrestformat', 'json');

    console.log(`Fetching quiz attempts for quiz ${quizId}, user ${this.currentUser.id}`);

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Quiz attempts response for quiz', quizId, ':', response);
        
        if (response && response.attempts) {
          const attempts = response.attempts;
          console.log(`Found ${attempts.length} attempts for quiz ${quizId}:`);
          
          attempts.forEach((attempt: any, index: number) => {
            console.log(`  Attempt ${index + 1}:`, {
              id: attempt.id,
              state: attempt.state,
              currentpage: attempt.currentpage,
              timestart: attempt.timestart,
              timefinish: attempt.timefinish,
              timemodified: attempt.timemodified
            });
          });
          
          const inProgressAttempts = attempts.filter((a: any) => a.state === 'inprogress');
          if (inProgressAttempts.length > 0) {
            console.log(`Found ${inProgressAttempts.length} in-progress attempts:`, inProgressAttempts);
          } else {
            console.log('No in-progress attempts found');
          }
          
          return attempts;
        }
        
        console.log('No attempts found in response for quiz', quizId);
        return [];
      }),
      catchError(error => {
        console.error('Failed to load quiz attempts for quiz', quizId, ':', error);
        // Don't throw error, just return empty array to allow new attempt
        return of([]);
      })
    );
  }

  // Alias for backwards compatibility and clearer naming
  public getUserQuizAttempts(quizId: number): Observable<any[]> {
    return this.getQuizAttemptsForQuiz(quizId);
  }

  /**
   * Check if user has any in-progress attempts for a quiz
   */
  public hasInProgressAttempt(quizId: number): Observable<boolean> {
    return this.getUserQuizAttempts(quizId).pipe(
      map(attempts => {
        const inProgressAttempt = attempts.find(a => a.state === 'inprogress');
        return !!inProgressAttempt;
      }),
      catchError(error => {
        console.error('Failed to check for in-progress attempts:', error);
        return of(false);
      })
    );
  }

  /**
   * Get the current in-progress attempt for a quiz, if any
   */
  public getInProgressAttempt(quizId: number): Observable<any | null> {
    return this.getUserQuizAttempts(quizId).pipe(
      map(attempts => {
        const inProgressAttempt = attempts.find(a => a.state === 'inprogress');
        return inProgressAttempt || null;
      }),
      catchError(error => {
        console.error('Failed to get in-progress attempt:', error);
        return of(null);
      })
    );
  }

  // ==================== QUIZ TAKING METHODS ====================

  /**
   * Get quiz access information to check if user can attempt the quiz
   */
  getQuizAccessInfo(quizId: number): Observable<QuizAccessInfo> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      throw new Error('User not authenticated');
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    const params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_get_quiz_access_information')
      .set('quizid', quizId.toString())
      .set('moodlewsrestformat', 'json');

    return this.http.get<QuizAccessInfo>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Quiz access info:', response);
        return response;
      }),
      catchError(error => {
        console.error('Failed to get quiz access info:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to check quiz access');
        throw error;
      })
    );
  }

  /**
   * Start a new quiz attempt
   */
  startQuizAttempt(quizId: number, forcenew: boolean = false): Observable<QuizStartResponse> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      throw new Error('User not authenticated');
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    let params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_start_attempt')
      .set('quizid', quizId.toString())
      .set('moodlewsrestformat', 'json');

    if (forcenew) {
      params = params.set('forcenew', '1');
    }

    return this.http.post<QuizStartResponse>(webServiceUrl, null, { params }).pipe(
      map(response => {
        console.log('Quiz attempt started:', response);
        // Convert timestamps to Date objects
        if (response.attempt) {
          response.attempt.timestart = new Date((response.attempt.timestart as any) * 1000);
          if (response.attempt.timefinish) {
            response.attempt.timefinish = new Date((response.attempt.timefinish as any) * 1000);
          }
          if (response.attempt.timemodified) {
            response.attempt.timemodified = new Date((response.attempt.timemodified as any) * 1000);
          }
          if (response.attempt.timecheckstate) {
            response.attempt.timecheckstate = new Date((response.attempt.timecheckstate as any) * 1000);
          }
        }
        return response;
      }),
      catchError(error => {
        console.error('Failed to start quiz attempt:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to start quiz attempt');
        throw error;
      })
    );
  }

  /**
   * Get quiz attempt data including questions
   */
  getQuizAttemptData(attemptId: number, page: number = 0): Observable<QuizAttemptData> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      throw new Error('User not authenticated');
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    let params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_get_attempt_data')
      .set('attemptid', attemptId.toString())
      .set('moodlewsrestformat', 'json');

    if (page >= 0) {
      params = params.set('page', page.toString());
    }

    return this.http.get<QuizAttemptData>(webServiceUrl, { params }).pipe(
      map(response => {
        console.log('Quiz attempt data:', response);
        
        // Convert timestamps to Date objects
        if (response.attempt) {
          response.attempt.timestart = new Date((response.attempt.timestart as any) * 1000);
          if (response.attempt.timefinish) {
            response.attempt.timefinish = new Date((response.attempt.timefinish as any) * 1000);
          }
          if (response.attempt.timemodified) {
            response.attempt.timemodified = new Date((response.attempt.timemodified as any) * 1000);
          }
          if (response.attempt.timecheckstate) {
            response.attempt.timecheckstate = new Date((response.attempt.timecheckstate as any) * 1000);
          }
        }

        // Parse questions to extract form data
        if (response.questions) {
          response.questions = response.questions.map(question => this.parseQuestionData(question));
        }

        return response;
      }),
      catchError(error => {
        console.error('Failed to get quiz attempt data:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to load quiz questions');
        throw error;
      })
    );
  }

  /**
   * Save quiz attempt answers (auto-save)
   */
  saveQuizAttempt(attemptId: number, answers: { [key: string]: any }): Observable<QuizSaveResponse> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      throw new Error('User not authenticated');
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    let params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_save_attempt')
      .set('attemptid', attemptId.toString())
      .set('moodlewsrestformat', 'json');

    // Add answer data to params
    Object.keys(answers).forEach(key => {
      params = params.set(key, answers[key]);
    });

    return this.http.post<QuizSaveResponse>(webServiceUrl, null, { params }).pipe(
      map(response => {
        console.log('Quiz attempt saved:', response);
        return response;
      }),
      catchError(error => {
        console.error('Failed to save quiz attempt:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to save quiz answers');
        throw error;
      })
    );
  }

  /**
   * Submit quiz attempt for grading
   */
  submitQuizAttempt(attemptId: number, answers: { [key: string]: any }): Observable<QuizSubmitResponse> {
    if (!this.currentUser?.token || !this.currentSite?.domain) {
      throw new Error('User not authenticated');
    }

    const webServiceUrl = `${this.currentSite.domain}/webservice/rest/server.php`;

    let params = new HttpParams()
      .set('wstoken', this.currentUser.token)
      .set('wsfunction', 'mod_quiz_process_attempt')
      .set('attemptid', attemptId.toString())
      .set('finishattempt', '1')
      .set('moodlewsrestformat', 'json');

    // Add answer data to params
    Object.keys(answers).forEach(key => {
      params = params.set(key, answers[key]);
    });

    return this.http.post<QuizSubmitResponse>(webServiceUrl, null, { params }).pipe(
      map(response => {
        console.log('Quiz attempt submitted:', response);
        return response;
      }),
      catchError(error => {
        console.error('Failed to submit quiz attempt:', error);
        this.errorHandler.handleMoodleError(error, 'Failed to submit quiz');
        throw error;
      })
    );
  }

  /**
   * Parse question HTML to extract form data and create answer objects
   */
  public parseQuestionData(question: QuizQuestion): QuizQuestion {
    const parser = new DOMParser();
    const doc = parser.parseFromString(question.html, 'text/html');
    
    // Extract question text - try multiple selectors for different question types
    let questionText = '';
    
    // Try .formulation .qtext first (standard questions)
    let questionTextElement = doc.querySelector('.formulation .qtext');
    if (questionTextElement) {
      questionText = questionTextElement.textContent?.trim() || '';
    } else {
      // For multianswer questions, get the formulation content but preserve structure
      const formulationElement = doc.querySelector('.formulation');
      if (formulationElement) {
        // Clone the element to avoid modifying the original
        const clone = formulationElement.cloneNode(true) as Element;
        
        // Remove scripts and hidden inputs but keep the structure
        clone.querySelectorAll('script, input[type="hidden"]').forEach(el => el.remove());
        
        // Replace input elements with placeholders to show where answers go
        clone.querySelectorAll('input[type="text"], input[type="number"], textarea, select').forEach(el => {
          const placeholder = document.createElement('span');
          placeholder.className = 'answer-placeholder';
          placeholder.textContent = '_____';
          placeholder.style.borderBottom = '1px solid #ccc';
          placeholder.style.minWidth = '60px';
          placeholder.style.display = 'inline-block';
          placeholder.style.textAlign = 'center';
          el.parentNode?.replaceChild(placeholder, el);
        });
        
        // Get the HTML content with placeholders
        questionText = clone.innerHTML;
        
        // Clean up any remaining unwanted elements
        questionText = questionText
          .replace(/<label[^>]*class="[^"]*accesshide[^"]*"[^>]*>.*?<\/label>/gi, '') // Remove screen reader labels
          .replace(/class="[^"]*"/g, '') // Remove class attributes
          .replace(/id="[^"]*"/g, '') // Remove id attributes
          .replace(/for="[^"]*"/g, '') // Remove for attributes
          .trim();
      }
    }
    
    question.questionText = questionText;
    
    // Extract form inputs
    const inputs = doc.querySelectorAll('input, select, textarea');
    question.parsedAnswers = [];
    
    inputs.forEach(input => {
      const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      
      if (element.type === 'hidden' || element.name.includes('sequencecheck') || element.name.includes('flagged')) {
        return; // Skip hidden fields and system fields
      }
      
      const answer: any = {
        id: element.id || element.name,
        name: element.name,
        type: this.getInputType(element),
        value: element.value || '',
        label: this.getInputLabel(doc, element),
        required: element.hasAttribute('required')
      };
      
      // Handle select options
      if (element.tagName === 'SELECT') {
        const selectElement = element as HTMLSelectElement;
        answer.options = Array.from(selectElement.options).map(option => ({
          value: option.value,
          label: option.textContent?.trim() || '',
          selected: option.selected
        }));
      }
      
      // Handle radio/checkbox groups
      if (element.type === 'radio' || element.type === 'checkbox') {
        const existingAnswer = question.parsedAnswers?.find(a => a.name === element.name);
        if (existingAnswer) {
          if (!(existingAnswer as any).options) {
            (existingAnswer as any).options = [];
          }
          (existingAnswer as any).options.push({
            value: element.value,
            label: this.getInputLabel(doc, element),
            selected: (element as HTMLInputElement).checked
          });
          return;
        }
        
        answer.options = [{
          value: element.value,
          label: this.getInputLabel(doc, element),
          selected: (element as HTMLInputElement).checked
        }];
      }
      
      question.parsedAnswers?.push(answer);
    });
    
    return question;
  }

  /**
   * Get input type for quiz answer
   */
  private getInputType(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): 'radio' | 'checkbox' | 'text' | 'textarea' | 'select' | 'dragdrop' | 'match' {
    if (element.tagName === 'SELECT') return 'select';
    if (element.tagName === 'TEXTAREA') return 'textarea';
    
    const inputElement = element as HTMLInputElement;
    switch (inputElement.type) {
      case 'radio': return 'radio';
      case 'checkbox': return 'checkbox';
      case 'text':
      case 'email':
      case 'url':
      case 'number':
      default: return 'text';
    }
  }

  /**
   * Get label for input element
   */
  private getInputLabel(doc: Document, element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
    // Try to find associated label
    if (element.id) {
      const label = doc.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent?.trim() || '';
      }
    }
    
    // Try to find parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent?.trim() || '';
    }
    
    // Try to find nearby text
    const parent = element.parentElement;
    if (parent) {
      const text = parent.textContent?.trim() || '';
      return text.replace(element.value, '').trim();
    }
    
    return element.name || '';
  }

  /**
   * Create timer for quiz with time limit
   */
  createQuizTimer(timeLimit: number, startTime: Date): QuizTimer {
    const endTime = new Date(startTime.getTime() + (timeLimit * 1000));
    const now = new Date();
    const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
    
    return {
      timeLimit,
      timeRemaining,
      startTime,
      endTime,
      isActive: timeRemaining > 0,
      warningThreshold: 300 // 5 minutes
    };
  }

  /**
   * Update quiz timer
   */
  updateQuizTimer(timer: QuizTimer): QuizTimer {
    const now = new Date();
    const timeRemaining = Math.max(0, Math.floor((timer.endTime.getTime() - now.getTime()) / 1000));
    
    return {
      ...timer,
      timeRemaining,
      isActive: timeRemaining > 0
    };
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
