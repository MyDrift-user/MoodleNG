import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiEndpoint, ApiRequest, ApiResponse, ApiHistory } from '../models/api-explorer.models';
import { MoodleService } from './moodle.service';

@Injectable({
  providedIn: 'root',
})
export class ApiExplorerService {
  private apiHistorySubject = new BehaviorSubject<ApiHistory[]>([]);
  private knownEndpoints: ApiEndpoint[] = [
    // Course API Endpoints
    {
      name: 'Get User Courses',
      function: 'core_enrol_get_users_courses',
      description: 'Returns a list of courses that the user is enrolled in',
      parameters: [
        {
          name: 'userid',
          type: 'number',
          description: 'User ID (defaults to current user)',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'course',
    },
    {
      name: 'Get Course Contents',
      function: 'core_course_get_contents',
      description: 'Returns course contents including modules and sections',
      parameters: [
        {
          name: 'courseid',
          type: 'number',
          description: 'Course ID',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'course',
    },
    {
      name: 'Get Courses',
      function: 'core_course_get_courses',
      description: 'Returns course details for provided course IDs',
      parameters: [
        {
          name: 'options[ids]',
          type: 'string',
          description: 'List of course IDs separated by commas',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'course',
    },
    {
      name: 'Get Courses by Field',
      function: 'core_course_get_courses_by_field',
      description: 'Get courses matching a specific field value',
      parameters: [
        {
          name: 'field',
          type: 'string',
          description: 'Field to search by',
          required: true,
          defaultValue: 'id',
        },
        {
          name: 'value',
          type: 'string',
          description: 'Value to match',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'course',
    },

    // Grades API Endpoints
    {
      name: 'Get Grade Items',
      function: 'gradereport_user_get_grade_items',
      description: 'Returns grade items and results for a specific course',
      parameters: [
        {
          name: 'courseid',
          type: 'number',
          description: 'Course ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'userid',
          type: 'number',
          description: 'User ID (defaults to current user)',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'grades',
    },
    {
      name: 'Get Grade Definitions',
      function: 'core_grades_get_gradedefinitions',
      description: 'Returns grade definitions including grade types, scales, and outcomes',
      parameters: [],
      category: 'grades',
    },
    {
      name: 'Get Grading Component Definitions',
      function: 'core_grading_get_definitions',
      description: 'Get grading definitions for a specific activity',
      parameters: [
        {
          name: 'cmid',
          type: 'number',
          description: 'Course module ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'areaname',
          type: 'string',
          description: 'Grading area name',
          required: true,
          defaultValue: 'submission',
        },
      ],
      category: 'grades',
    },

    // User API Endpoints
    {
      name: 'Get Site Info',
      function: 'core_webservice_get_site_info',
      description: 'Returns information about the site and the current user',
      parameters: [],
      category: 'user',
    },
    {
      name: 'Get User Profiles',
      function: 'core_user_get_users_by_field',
      description: 'Get user profiles by field',
      parameters: [
        {
          name: 'field',
          type: 'string',
          description: 'Field to search by (id, username, email)',
          required: true,
          defaultValue: 'id',
        },
        {
          name: 'values[]',
          type: 'string',
          description: 'Field values to match, separated by commas',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'user',
    },
    {
      name: 'Get User Preferences',
      function: 'core_user_get_user_preferences',
      description: 'Get user preferences',
      parameters: [
        {
          name: 'userid',
          type: 'number',
          description: 'User ID (defaults to current user)',
          required: false,
          defaultValue: '',
        },
        {
          name: 'name',
          type: 'string',
          description: 'Preference name',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'user',
    },

    // Quiz API Endpoints
    {
      name: 'Get Quizzes by Courses',
      function: 'mod_quiz_get_quizzes_by_courses',
      description: 'Returns all quizzes in the specified courses',
      parameters: [
        {
          name: 'courseids[]',
          type: 'string',
          description: 'Course IDs separated by commas (leave empty for all enrolled courses)',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Get Quiz Access Information',
      function: 'mod_quiz_get_quiz_access_information',
      description: 'Get access information for a quiz (permissions, restrictions, etc.)',
      parameters: [
        {
          name: 'quizid',
          type: 'number',
          description: 'Quiz ID',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Get User Quiz Attempts',
      function: 'mod_quiz_get_user_attempts',
      description: 'Get all attempts by the current user for a specific quiz',
      parameters: [
        {
          name: 'quizid',
          type: 'number',
          description: 'Quiz ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'status',
          type: 'string',
          description: 'Filter by attempt status (all, finished, inprogress)',
          required: false,
          defaultValue: 'all',
        },
        {
          name: 'includepreviews',
          type: 'number',
          description: 'Include preview attempts (0 or 1)',
          required: false,
          defaultValue: '0',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Start Quiz Attempt',
      function: 'mod_quiz_start_attempt',
      description: 'Start a new quiz attempt',
      parameters: [
        {
          name: 'quizid',
          type: 'number',
          description: 'Quiz ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'forcenew',
          type: 'number',
          description: 'Force a new attempt even if one is in progress (0 or 1)',
          required: false,
          defaultValue: '0',
        },
        {
          name: 'preflightdata',
          type: 'string',
          description: 'Preflight data (JSON string for password, etc.)',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Get Quiz Attempt Data',
      function: 'mod_quiz_get_attempt_data',
      description: 'Get attempt data including questions for a specific attempt',
      parameters: [
        {
          name: 'attemptid',
          type: 'number',
          description: 'Attempt ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'page',
          type: 'number',
          description: 'Page number (-1 for all pages)',
          required: false,
          defaultValue: '-1',
        },
        {
          name: 'preflightdata',
          type: 'string',
          description: 'Preflight data (JSON string)',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Save Quiz Attempt',
      function: 'mod_quiz_save_attempt',
      description: 'Save answers for a quiz attempt (auto-save)',
      parameters: [
        {
          name: 'attemptid',
          type: 'number',
          description: 'Attempt ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'data',
          type: 'string',
          description: 'Answer data (JSON string with question answers)',
          required: false,
          defaultValue: '{}',
        },
        {
          name: 'finishattempt',
          type: 'number',
          description: 'Finish the attempt (0 or 1)',
          required: false,
          defaultValue: '0',
        },
        {
          name: 'timeup',
          type: 'number',
          description: 'Time is up (0 or 1)',
          required: false,
          defaultValue: '0',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Process Quiz Attempt',
      function: 'mod_quiz_process_attempt',
      description: 'Process a quiz attempt (submit answers for a page)',
      parameters: [
        {
          name: 'attemptid',
          type: 'number',
          description: 'Attempt ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'data',
          type: 'string',
          description: 'Answer data (JSON string with question answers)',
          required: false,
          defaultValue: '{}',
        },
        {
          name: 'finishattempt',
          type: 'number',
          description: 'Finish the attempt (0 or 1)',
          required: false,
          defaultValue: '0',
        },
        {
          name: 'timeup',
          type: 'number',
          description: 'Time is up (0 or 1)',
          required: false,
          defaultValue: '0',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Get Quiz Attempt Review',
      function: 'mod_quiz_get_attempt_review',
      description: 'Get review data for a completed quiz attempt',
      parameters: [
        {
          name: 'attemptid',
          type: 'number',
          description: 'Attempt ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'page',
          type: 'number',
          description: 'Page number (-1 for all pages)',
          required: false,
          defaultValue: '-1',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Get Quiz Attempt Summary',
      function: 'mod_quiz_get_attempt_summary',
      description: 'Get summary data for a quiz attempt',
      parameters: [
        {
          name: 'attemptid',
          type: 'number',
          description: 'Attempt ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'preflightdata',
          type: 'string',
          description: 'Preflight data (JSON string)',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'View Quiz',
      function: 'mod_quiz_view_quiz',
      description: 'Trigger the quiz viewed event',
      parameters: [
        {
          name: 'quizid',
          type: 'number',
          description: 'Quiz ID',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'View Quiz Attempt',
      function: 'mod_quiz_view_attempt',
      description: 'Trigger the attempt viewed event',
      parameters: [
        {
          name: 'attemptid',
          type: 'number',
          description: 'Attempt ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'page',
          type: 'number',
          description: 'Page number',
          required: false,
          defaultValue: '0',
        },
      ],
      category: 'quiz',
    },

    // Calendar API Endpoints
    {
      name: 'Get Calendar Events',
      function: 'core_calendar_get_calendar_events',
      description: 'Get calendar events by courseid, eventids, or other filters',
      parameters: [
        {
          name: 'events[courseids][]',
          type: 'string',
          description: 'Course IDs separated by commas',
          required: false,
          defaultValue: '',
        },
        {
          name: 'events[eventids][]',
          type: 'string',
          description: 'Event IDs separated by commas',
          required: false,
          defaultValue: '',
        },
        {
          name: 'options[timestart]',
          type: 'number',
          description: 'Time start timestamp',
          required: false,
          defaultValue: '',
        },
        {
          name: 'options[timeend]',
          type: 'number',
          description: 'Time end timestamp',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'calendar',
    },
    {
      name: 'Get Calendar Action Events',
      function: 'core_calendar_get_action_events_by_course',
      description: 'Get action events for a specific course',
      parameters: [
        {
          name: 'courseid',
          type: 'number',
          description: 'Course ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'timesortfrom',
          type: 'number',
          description: 'Start time timestamp',
          required: false,
          defaultValue: '',
        },
        {
          name: 'timesortto',
          type: 'number',
          description: 'End time timestamp',
          required: false,
          defaultValue: '',
        },
        {
          name: 'limitnum',
          type: 'number',
          description: 'Maximum number of results to return',
          required: false,
          defaultValue: '20',
        },
      ],
      category: 'calendar',
    },

    // File API Endpoints
    {
      name: 'Get Files',
      function: 'core_files_get_files',
      description: 'Get files list for a specific context',
      parameters: [
        {
          name: 'contextid',
          type: 'number',
          description: 'Context ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'component',
          type: 'string',
          description: 'Component',
          required: true,
          defaultValue: 'user',
        },
        {
          name: 'filearea',
          type: 'string',
          description: 'File area',
          required: true,
          defaultValue: 'private',
        },
        {
          name: 'itemid',
          type: 'number',
          description: 'Item ID',
          required: true,
          defaultValue: '0',
        },
        {
          name: 'filepath',
          type: 'string',
          description: 'File path',
          required: true,
          defaultValue: '/',
        },
        {
          name: 'filename',
          type: 'string',
          description: 'File name',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'files',
    },

    // Forum API Endpoints
    {
      name: 'Get Forum Discussions',
      function: 'mod_forum_get_forum_discussions',
      description: 'Get forum discussions for a specific forum',
      parameters: [
        {
          name: 'forumid',
          type: 'number',
          description: 'Forum ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'sortby',
          type: 'string',
          description: 'Sort order (id, timemodified, timestart, timeend)',
          required: false,
          defaultValue: 'timemodified',
        },
        {
          name: 'sortdirection',
          type: 'string',
          description: 'Sort direction (ASC or DESC)',
          required: false,
          defaultValue: 'DESC',
        },
        {
          name: 'page',
          type: 'number',
          description: 'Page number',
          required: false,
          defaultValue: '0',
        },
        {
          name: 'perpage',
          type: 'number',
          description: 'Items per page',
          required: false,
          defaultValue: '10',
        },
      ],
      category: 'forum',
    },
    {
      name: 'Get Forum Discussion Posts',
      function: 'mod_forum_get_forum_discussion_posts',
      description: 'Get posts for a specific forum discussion',
      parameters: [
        {
          name: 'discussionid',
          type: 'number',
          description: 'Discussion ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'sortby',
          type: 'string',
          description: 'Sort by (id, created, modified)',
          required: false,
          defaultValue: 'created',
        },
        {
          name: 'sortdirection',
          type: 'string',
          description: 'Sort direction (ASC or DESC)',
          required: false,
          defaultValue: 'ASC',
        },
      ],
      category: 'forum',
    },

    // Assignment API Endpoints
    {
      name: 'Get Assignments',
      function: 'mod_assign_get_assignments',
      description: 'Get assignments in courses',
      parameters: [
        {
          name: 'courseids[]',
          type: 'string',
          description: 'Course IDs separated by commas',
          required: false,
          defaultValue: '',
        },
        {
          name: 'capabilities[]',
          type: 'string',
          description: 'Capabilities to check (mod/assign:grade, mod/assign:submit)',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'assignment',
    },
    {
      name: 'Get Submission Status',
      function: 'mod_assign_get_submission_status',
      description: 'Get the submission status for a student in an assignment',
      parameters: [
        {
          name: 'assignid',
          type: 'number',
          description: 'Assignment ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'userid',
          type: 'number',
          description: 'User ID',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'assignment',
    },

    // Quiz API Endpoints
    {
      name: 'Get Quizzes',
      function: 'mod_quiz_get_quizzes_by_courses',
      description: 'Get quizzes in courses',
      parameters: [
        {
          name: 'courseids[]',
          type: 'string',
          description: 'Course IDs separated by commas',
          required: false,
          defaultValue: '',
        },
      ],
      category: 'quiz',
    },
    {
      name: 'Get User Attempts',
      function: 'mod_quiz_get_user_attempts',
      description: "Get a user's attempts at a quiz",
      parameters: [
        {
          name: 'quizid',
          type: 'number',
          description: 'Quiz ID',
          required: true,
          defaultValue: '',
        },
        {
          name: 'userid',
          type: 'number',
          description: 'User ID',
          required: false,
          defaultValue: '',
        },
        {
          name: 'status',
          type: 'string',
          description: 'Status (all, finished, unfinished)',
          required: false,
          defaultValue: 'all',
        },
      ],
      category: 'quiz',
    },

    // Competency API Endpoints
    {
      name: 'Get Course Competencies',
      function: 'tool_lp_data_for_course_competencies_page',
      description: 'Get a list of competencies for a specific course',
      parameters: [
        {
          name: 'courseid',
          type: 'number',
          description: 'Course ID',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'competency',
    },
    {
      name: 'Get User Plans',
      function: 'core_competency_list_user_plans',
      description: "Get a user's learning plans",
      parameters: [
        {
          name: 'userid',
          type: 'number',
          description: 'User ID',
          required: true,
          defaultValue: '',
        },
      ],
      category: 'competency',
    },

    // Message API Endpoints
    {
      name: 'Get User Messages',
      function: 'core_message_get_messages',
      description: 'Get messages for a specific user',
      parameters: [
        {
          name: 'useridto',
          type: 'number',
          description: 'User ID to (recipient)',
          required: true,
          defaultValue: '',
        },
        {
          name: 'useridfrom',
          type: 'number',
          description: 'User ID from (sender)',
          required: false,
          defaultValue: '',
        },
        {
          name: 'type',
          type: 'string',
          description: 'Type (notifications, conversations, both)',
          required: false,
          defaultValue: 'both',
        },
        {
          name: 'read',
          type: 'number',
          description: 'Read status (0, 1, or empty for any)',
          required: false,
          defaultValue: '',
        },
        {
          name: 'newestfirst',
          type: 'number',
          description: 'Sort newest first (0, 1)',
          required: false,
          defaultValue: '1',
        },
        {
          name: 'limitfrom',
          type: 'number',
          description: 'Limit from',
          required: false,
          defaultValue: '0',
        },
        {
          name: 'limitnum',
          type: 'number',
          description: 'Limit number',
          required: false,
          defaultValue: '100',
        },
      ],
      category: 'message',
    },
  ];

  constructor(
    private http: HttpClient,
    private moodleService: MoodleService
  ) {
    // Try to load history from localStorage
    this.loadHistory();
  }

  get apiHistory$(): Observable<ApiHistory[]> {
    return this.apiHistorySubject.asObservable();
  }

  get availableEndpoints(): ApiEndpoint[] {
    return this.knownEndpoints;
  }

  executeApiCall(endpoint: string, parameters: Record<string, any>): Observable<ApiResponse> {
    const user = this.moodleService.getCurrentUser();
    const site = this.moodleService.getCurrentSite();

    if (!user?.token || !site?.domain) {
      return throwError(() => new Error('User not logged in or site not available'));
    }

    const webServiceUrl = `${site.domain}/webservice/rest/server.php`;

    // Start timing the request
    const startTime = new Date();
    const request: ApiRequest = {
      endpoint,
      parameters,
      timestamp: startTime,
    };

    // Prepare parameters
    let params = new HttpParams()
      .set('wstoken', user.token)
      .set('wsfunction', endpoint)
      .set('moodlewsrestformat', 'json');

    // Add all custom parameters
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<any>(webServiceUrl, { params }).pipe(
      map(response => {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Check if the response has an error
        if (response && typeof response === 'object' && response.exception) {
          const apiResponse: ApiResponse = {
            endpoint,
            rawResponse: response,
            timestamp: endTime,
            duration,
            status: 'error',
            error: response.message || 'Unknown error',
          };
          this.addToHistory(request, apiResponse);
          return apiResponse;
        }

        // Success response
        const apiResponse: ApiResponse = {
          endpoint,
          rawResponse: response,
          timestamp: endTime,
          duration,
          status: 'success',
        };

        // Update the known endpoint with sample response if needed
        this.updateEndpointSampleResponse(endpoint, response);

        // Add to history
        this.addToHistory(request, apiResponse);

        return apiResponse;
      }),
      catchError(error => {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        const apiResponse: ApiResponse = {
          endpoint,
          rawResponse: error,
          timestamp: endTime,
          duration,
          status: 'error',
          error: error.message || 'Unknown error',
        };

        this.addToHistory(request, apiResponse);
        return of(apiResponse);
      })
    );
  }

  clearHistory(): void {
    this.apiHistorySubject.next([]);
    localStorage.removeItem('moodle_api_history');
  }

  private addToHistory(request: ApiRequest, response: ApiResponse): void {
    const history = this.apiHistorySubject.value;
    const newItem: ApiHistory = { request, response };

    // Add to the beginning of the array (most recent first)
    const updatedHistory = [newItem, ...history];

    // Limit history to 50 items
    if (updatedHistory.length > 50) {
      updatedHistory.pop();
    }

    this.apiHistorySubject.next(updatedHistory);
    this.saveHistory();
  }

  private saveHistory(): void {
    try {
      const historyToSave = this.apiHistorySubject.value.map(item => ({
        request: {
          endpoint: item.request.endpoint,
          parameters: item.request.parameters,
          timestamp: item.request.timestamp.toISOString(),
        },
        response: {
          endpoint: item.response.endpoint,
          rawResponse: JSON.stringify(item.response.rawResponse),
          timestamp: item.response.timestamp.toISOString(),
          duration: item.response.duration,
          status: item.response.status,
          error: item.response.error,
        },
      }));

      localStorage.setItem('moodle_api_history', JSON.stringify(historyToSave));
    } catch (e) {
      console.error('Failed to save API history to localStorage', e);
    }
  }

  private loadHistory(): void {
    try {
      const savedHistory = localStorage.getItem('moodle_api_history');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);

        // Convert timestamps back to Date objects
        const history = parsed.map((item: any) => ({
          request: {
            endpoint: item.request.endpoint,
            parameters: item.request.parameters,
            timestamp: new Date(item.request.timestamp),
          },
          response: {
            endpoint: item.response.endpoint,
            rawResponse: JSON.parse(item.response.rawResponse),
            timestamp: new Date(item.response.timestamp),
            duration: item.response.duration,
            status: item.response.status,
            error: item.response.error,
          },
        }));

        this.apiHistorySubject.next(history);
      }
    } catch (e) {
      console.error('Failed to load API history from localStorage', e);
    }
  }

  private updateEndpointSampleResponse(endpoint: string, response: any): void {
    const endpointIndex = this.knownEndpoints.findIndex(e => e.function === endpoint);
    if (endpointIndex >= 0) {
      this.knownEndpoints[endpointIndex].sampleResponse = response;
    }
  }

  addEndpoint(endpoint: ApiEndpoint): void {
    // Check if endpoint already exists
    const existingIndex = this.knownEndpoints.findIndex(e => e.function === endpoint.function);
    if (existingIndex >= 0) {
      // Update existing endpoint
      this.knownEndpoints[existingIndex] = {
        ...this.knownEndpoints[existingIndex],
        ...endpoint,
      };
    } else {
      // Add new endpoint
      this.knownEndpoints.push(endpoint);
    }
  }

  getEndpoint(functionName: string): ApiEndpoint | undefined {
    return this.knownEndpoints.find(e => e.function === functionName);
  }

  generateTypeDefinition(response: any, functionName: string, entityName?: string): string {
    // Default entity name based on function name if not provided
    if (!entityName) {
      // Convert from snake_case to CamelCase
      entityName = functionName
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

      // Add 'Response' suffix if not already present
      if (!entityName.endsWith('Response')) {
        entityName += 'Response';
      }
    }

    // Generate TypeScript interface definition based on response structure
    let definition = `export interface ${entityName} {\n`;

    function getTypeForValue(value: any): string {
      if (value === null || value === undefined) {
        return 'any';
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return 'any[]';
        }
        return `${getTypeForValue(value[0])}[]`;
      }
      if (typeof value === 'object') {
        return getObjectTypeString(value);
      }
      return typeof value;
    }

    function getObjectTypeString(obj: any): string {
      if (Object.keys(obj).length === 0) {
        return 'Record<string, any>';
      }

      // For complex nested objects, suggest creating a separate interface
      return 'object'; // Simplified for now
    }

    // Add properties based on the response
    if (response && typeof response === 'object') {
      for (const [key, value] of Object.entries(response)) {
        const type = getTypeForValue(value);
        definition += `  ${key}: ${type};\n`;
      }
    }

    definition += '}';
    return definition;
  }
}
