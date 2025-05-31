export interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  token?: string;
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
