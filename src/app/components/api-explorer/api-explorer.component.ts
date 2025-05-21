import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { JsonPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ApiExplorerService } from '../../services/api-explorer.service';
import { ApiEndpoint, ApiHistory, ApiResponse } from '../../models/api-explorer.models';
import { MoodleService } from '../../services/moodle.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-api-explorer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    JsonPipe
  ],
  templateUrl: './api-explorer.component.html',
  styleUrls: ['./api-explorer.component.scss']
})
export class ApiExplorerComponent implements OnInit, OnDestroy {
  apiForm: FormGroup;
  selectedEndpoint: ApiEndpoint | null = null;
  loading = false;
  apiHistory: ApiHistory[] = [];
  endpoints: ApiEndpoint[] = [];
  currentResponse: ApiResponse | null = null;
  generatedInterface: string = '';
  customEndpointForm: FormGroup;
  activePanelIndex = 0;
  groupedEndpoints: { [key: string]: ApiEndpoint[] } = {};
  JSON = JSON;
  Object = Object;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    public apiExplorerService: ApiExplorerService,
    private moodleService: MoodleService,
    private snackBar: MatSnackBar
  ) {
    this.apiForm = this.fb.group({
      endpoint: ['', Validators.required],
      parameters: this.fb.group({})
    });

    this.customEndpointForm = this.fb.group({
      name: ['', Validators.required],
      function: ['', Validators.required],
      description: [''],
      category: ['other', Validators.required]
    });
  }

  ngOnInit() {
    // Load endpoints
    this.endpoints = this.apiExplorerService.availableEndpoints;
    this.groupEndpoints();

    // Subscribe to history changes
    this.apiExplorerService.apiHistory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.apiHistory = history;
      });

    // Handle endpoint selection changes
    this.apiForm.get('endpoint')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (value) {
          this.onEndpointSelected(value);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  groupEndpoints() {
    // Initialize all categories with empty arrays
    this.groupedEndpoints = {
      'course': [],
      'user': [],
      'grades': [],
      'files': [],
      'calendar': [],
      'forum': [],
      'assignment': [],
      'quiz': [],
      'competency': [],
      'message': [],
      'other': []
    };
    
    // Add endpoints to their respective categories
    this.endpoints.forEach(endpoint => {
      this.groupedEndpoints[endpoint.category].push(endpoint);
    });
  }

  onEndpointSelected(functionName: string) {
    const endpoint = this.apiExplorerService.getEndpoint(functionName);
    if (!endpoint) {
      return;
    }
    
    this.selectedEndpoint = endpoint;

    // Reset the parameter form
    const paramGroup = this.fb.group({});
    
    // Add form controls for each parameter
    this.selectedEndpoint.parameters.forEach(param => {
      // Get current user ID for userids
      let defaultValue = param.defaultValue;
      if (param.name === 'userid' && !defaultValue) {
        const currentUser = this.moodleService.getCurrentUser();
        if (currentUser) {
          defaultValue = currentUser.id;
        }
      }
      
      paramGroup.addControl(
        param.name, 
        this.fb.control(defaultValue, param.required ? Validators.required : null)
      );
    });
    
    this.apiForm.setControl('parameters', paramGroup);
  }

  executeApiCall() {
    if (this.apiForm.invalid) {
      return;
    }

    const endpoint = this.apiForm.get('endpoint')?.value;
    const parameters = this.apiForm.get('parameters')?.value;

    this.loading = true;
    this.apiExplorerService.executeApiCall(endpoint, parameters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.currentResponse = response;
          this.activePanelIndex = 1; // Switch to the response tab
          
          // Generate interface for this response
          if (response.status === 'success') {
            this.generatedInterface = this.apiExplorerService.generateTypeDefinition(
              response.rawResponse, 
              endpoint
            );
          }
        },
        error: (error) => {
          this.loading = false;
          this.snackBar.open('Error executing API call: ' + error.message, 'Close', {
            duration: 5000
          });
        }
      });
  }

  clearHistory() {
    this.apiExplorerService.clearHistory();
  }

  copyToClipboard(text: string, message: string = 'Copied to clipboard') {
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open(message, 'Close', {
        duration: 2000
      });
    });
  }

  viewHistoryItem(historyItem: ApiHistory) {
    this.currentResponse = historyItem.response;
    
    // Set the form values to match the history item
    this.apiForm.get('endpoint')?.setValue(historyItem.request.endpoint);
    
    // Wait for endpoint selection to update the form
    setTimeout(() => {
      const parameterFormGroup = this.apiForm.get('parameters') as FormGroup;
      if (parameterFormGroup) {
        Object.entries(historyItem.request.parameters).forEach(([key, value]) => {
          if (parameterFormGroup.get(key)) {
            parameterFormGroup.get(key)?.setValue(value);
          }
        });
      }
    }, 0);
    
    // Generate interface
    if (historyItem.response.status === 'success') {
      this.generatedInterface = this.apiExplorerService.generateTypeDefinition(
        historyItem.response.rawResponse,
        historyItem.request.endpoint
      );
    }
    
    this.activePanelIndex = 1; // Switch to response tab
  }

  addCustomEndpoint() {
    if (this.customEndpointForm.invalid) {
      return;
    }

    const formValue = this.customEndpointForm.value;
    
    const newEndpoint: ApiEndpoint = {
      name: formValue.name,
      function: formValue.function,
      description: formValue.description || '',
      parameters: [],
      category: formValue.category
    };

    this.apiExplorerService.addEndpoint(newEndpoint);
    this.endpoints = this.apiExplorerService.availableEndpoints;
    this.groupEndpoints();
    
    this.snackBar.open('Custom endpoint added', 'Close', {
      duration: 3000
    });
    
    this.customEndpointForm.reset({
      category: 'other'
    });
  }

  formatDatetime(date: Date): string {
    return date.toLocaleString();
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }
} 