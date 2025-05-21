export interface ApiEndpoint {
  name: string;
  function: string;
  description: string;
  parameters: ApiParameter[];
  responseFields?: ApiResponseField[];
  sampleResponse?: any;
  category: 'course' | 'user' | 'grades' | 'files' | 'other' | 'calendar' | 'forum' | 'assignment' | 'quiz' | 'competency' | 'message';
}

export interface ApiParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface ApiResponseField {
  name: string;
  type: string;
  description: string;
  sample?: any;
  isArray?: boolean;
  isObject?: boolean;
  children?: ApiResponseField[];
}

export interface ApiRequest {
  endpoint: string;
  parameters: Record<string, any>;
  timestamp: Date;
}

export interface ApiResponse {
  endpoint: string;
  rawResponse: any;
  formattedResponse?: any;
  timestamp: Date;
  duration: number;
  status: 'success' | 'error';
  error?: string;
}

export interface ApiHistory {
  request: ApiRequest;
  response: ApiResponse;
} 