export interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  token?: string;
  profilePictureUrl?: string;
}

export interface MoodleSite {
  domain: string;
  sitename?: string;
  logo?: string;
}

export interface MoodleModule {
  id: number;
  name: string;
  description?: string;
  visible: boolean;
  summary?: string;
  lastAccess?: Date;
  courseId: number;
  courseName?: string;
  subject?: string; // Course category/subject (e.g., "Mathematics", "Computer Science")
}

export interface MoodleContent {
  id: number;
  name: string;
  type: string; // 'file', 'text', 'url', 'video', etc.
  content?: string; // For text content
  fileUrl?: string; // For files, videos, etc.
  mimeType?: string; // For files
  timeCreated?: Date;
  timeModified?: Date;
  moduleId: number;
  modname?: string; // Added to track Moodle module type ('assign', 'quiz', etc.)
  
  // Additional fields from API response
  description?: string; // Module description from API
  url?: string; // Direct URL to the module
  visible?: boolean; // Whether the module is visible
  uservisible?: boolean; // Whether the module is visible to current user
  visibleoncoursepage?: boolean; // Whether the module is visible on course page
  modicon?: string; // URL to module icon
  purpose?: string; // Purpose of the module (content, assessment, etc.)
  indent?: number; // Indentation level
  noviewlink?: boolean; // Whether to show view link
  summary?: string; // Summary for sections
  summaryformat?: number; // Summary format for sections
  
  // Enhanced Assignment fields
  dueDate?: Date; // Assignment due date
  allowSubmissionsFromDate?: Date; // When submissions are allowed from
  cutoffDate?: Date; // Cut-off date for submissions
  gradingDueDate?: Date; // When grading is due
  grade?: number; // Maximum grade for assignment
  maxAttempts?: number; // Maximum number of attempts (-1 for unlimited)
  teamSubmission?: boolean; // Whether team submission is enabled
  blindMarking?: boolean; // Whether blind marking is enabled
  requireSubmissionStatement?: boolean; // Whether submission statement is required
  maxFileSubmissions?: number; // Maximum number of files that can be submitted
  maxSubmissionSizeBytes?: number; // Maximum size of submission in bytes
  fileTypesAllowed?: string; // Allowed file types for submission
  
  // Assignment submission status
  submissionStatus?: string; // 'new', 'draft', 'submitted', 'reopened'
  submissionGradingStatus?: string; // 'graded', 'notgraded'
  hasSubmitted?: boolean; // Whether user has submitted
  submissionTimeModified?: Date; // When submission was last modified
  submissionFiles?: AssignmentSubmissionFile[]; // Files submitted
  submissionText?: string; // Text submission content
  submissionComments?: string; // Submission comments
  submissionGrade?: number; // Grade received for submission
  submissionFeedback?: string; // Feedback from instructor
  submissionAttemptNumber?: number; // Current attempt number
  
  // Enhanced Quiz fields
  timeOpen?: Date; // When quiz opens
  timeClose?: Date; // When quiz closes
  timeLimit?: number; // Time limit in seconds
  attempts?: number; // Number of attempts allowed
  gradeMethod?: number; // Grading method (1=highest, 2=average, 3=first, 4=last)
  questionsPerPage?: number; // Questions per page
  sumGrades?: number; // Sum of all question grades
  hasQuestions?: boolean; // Whether quiz has questions
  hasFeedback?: boolean; // Whether quiz has feedback
  overdueHandling?: string; // How to handle overdue attempts
  graceperiod?: number; // Grace period in seconds
  browsersecurity?: string; // Browser security requirements
  
  // Quiz attempt information
  quizAttempts?: QuizAttempt[]; // User's quiz attempts
  bestAttemptGrade?: number; // Best grade achieved
  attemptsUsed?: number; // Number of attempts used
  canAttempt?: boolean; // Whether user can make another attempt
  lastAttemptState?: string; // State of last attempt ('finished', 'inprogress', 'abandoned')
  
  // Common metadata
  introFormat?: number; // Format of intro text
  introFiles?: any[]; // Files attached to intro
}

// Interface for assignment submission files
export interface AssignmentSubmissionFile {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  timemodified: Date;
}

// Interface for quiz attempts
export interface QuizAttempt {
  id: number;
  attempt: number; // Attempt number (1, 2, 3, etc.)
  uniqueid: number; // Unique attempt ID
  layout: string; // Question layout
  currentpage: number; // Current page
  preview: boolean; // Whether this is a preview
  state: string; // 'inprogress', 'finished', 'abandoned'
  timestart: Date; // When attempt started
  timefinish?: Date; // When attempt finished
  timemodified: Date; // When attempt was last modified
  timecheckstate?: Date; // Time check state
  sumgrades?: number; // Sum of grades for this attempt
  grade?: number; // Final grade for this attempt (after scaling)
  gradednotificationsenttime?: Date; // When grade notification was sent
}

export interface MoodleLoginResponse {
  token: string;
  privatetoken?: string;
  error?: string;
  errorcode?: string;
}

export interface MoodleCourseResult {
  id: number;
  name: string;
  itemType: string; // 'quiz', 'assignment', etc.
  gradeFormatted?: string; // The formatted grade (e.g. "85.00 / 100.00")
  gradeRaw?: number; // The raw grade value
  gradeMax?: number; // The maximum possible grade
  feedbackFormatted?: string; // Any feedback provided
  status?: string; // Status of the result (e.g. "submitted", "graded")
  dueDate?: Date; // Due date if applicable
  submissionDate?: Date; // Submission date if applicable
  courseId: number;

  // Fields to support hierarchical structure
  categoryId?: number; // ID of the parent category
  isCategory?: boolean; // If this item is a category
  isCategorySummary?: boolean; // If this is a category summary
  isOverallSummary?: boolean; // If this is the overall summary
  weight?: number; // Weight of this item (percentage)
  weightFormatted?: string; // Formatted weight (e.g. "10.23 %")
  range?: string; // Grade range (e.g. "0-100")
  percentage?: number; // Percentage achieved
  percentageFormatted?: string; // Formatted percentage (e.g. "65.06 %")
  contributionToTotal?: number; // Contribution to total course grade
  contributionFormatted?: string; // Formatted contribution (e.g. "3.41 %")
  children?: MoodleCourseResult[]; // Child items for categories
  level: number; // Nesting level: 0 for overall, 1 for main categories, 2+ for subcategories

  // Fields to track UI state
  isExpanded?: boolean; // For UI to track expanded state
}

// Helper interface for grouped results structure
export interface ResultsGroup {
  category: MoodleCourseResult;
  items: MoodleCourseResult[];
  summary?: MoodleCourseResult;
}
