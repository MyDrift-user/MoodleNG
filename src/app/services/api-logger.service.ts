import { Injectable } from '@angular/core';

export interface ApiLogEntry {
  timestamp: Date;
  endpoint: string;
  function: string;
  parameters: { [key: string]: any };
  request: {
    url: string;
    method: string;
    headers?: { [key: string]: string };
  };
  response: {
    status: 'success' | 'error';
    statusCode?: number;
    data: any;
    error?: string;
    duration: number;
  };
  userAgent: string;
  sessionId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiLoggerService {
  private logs: ApiLogEntry[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadLogsFromStorage();
  }

  /**
   * Log an API request and response
   */
  logApiCall(
    endpoint: string,
    functionName: string,
    parameters: { [key: string]: any },
    request: { url: string; method: string; headers?: { [key: string]: string } },
    response: { status: 'success' | 'error'; statusCode?: number; data: any; error?: string; duration: number }
  ): void {
    const logEntry: ApiLogEntry = {
      timestamp: new Date(),
      endpoint: endpoint,
      function: functionName,
      parameters: parameters,
      request: request,
      response: response,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    this.logs.push(logEntry);
    this.saveLogsToStorage();
  }

  /**
   * Get all logs
   */
  getLogs(): ApiLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs for a specific function
   */
  getLogsByFunction(functionName: string): ApiLogEntry[] {
    return this.logs.filter(log => log.function === functionName);
  }

  /**
   * Get logs within a date range
   */
  getLogsByDateRange(startDate: Date, endDate: Date): ApiLogEntry[] {
    return this.logs.filter(log => 
      log.timestamp >= startDate && log.timestamp <= endDate
    );
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
  }

  /**
   * Export logs to JSON file
   */
  exportLogsToJson(): void {
    const dataStr = JSON.stringify(this.logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `moodle-api-logs-${this.formatDateForFilename(new Date())}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
  }

  /**
   * Export logs to CSV file
   */
  exportLogsToCsv(): void {
    if (this.logs.length === 0) {
      return;
    }

    const headers = [
      'Timestamp',
      'Endpoint',
      'Function',
      'Parameters',
      'Request URL',
      'Request Method',
      'Response Status',
      'Response Status Code',
      'Response Data',
      'Error',
      'Duration (ms)',
      'User Agent',
      'Session ID'
    ];

    const csvRows = [
      headers.join(','),
      ...this.logs.map(log => [
        `"${log.timestamp.toISOString()}"`,
        `"${log.endpoint}"`,
        `"${log.function}"`,
        `"${JSON.stringify(log.parameters).replace(/"/g, '""')}"`,
        `"${log.request.url}"`,
        `"${log.request.method}"`,
        `"${log.response.status}"`,
        `"${log.response.statusCode || ''}"`,
        `"${JSON.stringify(log.response.data).replace(/"/g, '""')}"`,
        `"${log.response.error || ''}"`,
        `"${log.response.duration}"`,
        `"${log.userAgent}"`,
        `"${log.sessionId}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `moodle-api-logs-${this.formatDateForFilename(new Date())}.csv`;
    link.click();
    
    URL.revokeObjectURL(link.href);
  }

  /**
   * Export logs as formatted text file
   */
  exportLogsToText(): void {
    const textContent = this.logs.map(log => {
      return [
        `=== API Call Log Entry ===`,
        `Timestamp: ${log.timestamp.toISOString()}`,
        `Endpoint: ${log.endpoint}`,
        `Function: ${log.function}`,
        `Session ID: ${log.sessionId}`,
        ``,
        `Request:`,
        `  URL: ${log.request.url}`,
        `  Method: ${log.request.method}`,
        `  Parameters:`,
        ...Object.entries(log.parameters).map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`),
        ``,
        `Response:`,
        `  Status: ${log.response.status}`,
        `  Status Code: ${log.response.statusCode || 'N/A'}`,
        `  Duration: ${log.response.duration}ms`,
        `  Error: ${log.response.error || 'None'}`,
        `  Data:`,
        `    ${JSON.stringify(log.response.data, null, 4).split('\n').join('\n    ')}`,
        ``,
        `User Agent: ${log.userAgent}`,
        ``,
        `${'='.repeat(50)}`,
        ``
      ].join('\n');
    }).join('\n');

    const dataBlob = new Blob([textContent], { type: 'text/plain' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `moodle-api-logs-${this.formatDateForFilename(new Date())}.txt`;
    link.click();
    
    URL.revokeObjectURL(link.href);
  }

  /**
   * Get log statistics
   */
  getLogStatistics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
    functionCounts: { [key: string]: number };
    dateRange: { start: Date | null; end: Date | null };
  } {
    if (this.logs.length === 0) {
      return {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
        functionCounts: {},
        dateRange: { start: null, end: null }
      };
    }

    const successfulCalls = this.logs.filter(log => log.response.status === 'success').length;
    const failedCalls = this.logs.length - successfulCalls;
    const totalDuration = this.logs.reduce((sum, log) => sum + log.response.duration, 0);
    const averageDuration = totalDuration / this.logs.length;

    const functionCounts: { [key: string]: number } = {};
    this.logs.forEach(log => {
      functionCounts[log.function] = (functionCounts[log.function] || 0) + 1;
    });

    const timestamps = this.logs.map(log => log.timestamp);
    const dateRange = {
      start: new Date(Math.min(...timestamps.map(d => d.getTime()))),
      end: new Date(Math.max(...timestamps.map(d => d.getTime())))
    };

    return {
      totalCalls: this.logs.length,
      successfulCalls,
      failedCalls,
      averageDuration,
      functionCounts,
      dateRange
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDateForFilename(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
           date.toTimeString().split(' ')[0].replace(/:/g, '-');
  }

  private saveLogsToStorage(): void {
    try {
      localStorage.setItem('moodle_api_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Failed to save logs to localStorage:', error);
    }
  }

  private loadLogsFromStorage(): void {
    try {
      const stored = localStorage.getItem('moodle_api_logs');
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        this.logs = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load logs from localStorage:', error);
      this.logs = [];
    }
  }
} 