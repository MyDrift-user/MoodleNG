import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription, interval, timer } from 'rxjs';
import { MoodleService } from '../../services/moodle.service';
import {
  MoodleContent,
  QuizState,
  QuizQuestion,
  QuizAnswer,
  QuizAttemptData,
  QuizTimer,
  QuizAccessInfo
} from '../../models/moodle.models';
import { SanitizationService } from '../../services/sanitization.service';

@Component({
  selector: 'app-quiz-taking',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatCheckboxModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatToolbarModule,
    MatIconModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule
  ],
  templateUrl: './quiz-taking.component.html',
  styleUrls: ['./quiz-taking.component.scss']
})
export class QuizTakingComponent implements OnInit, OnDestroy {
  @Input() quiz!: MoodleContent;
  @Output() quizCompleted = new EventEmitter<any>();
  @Output() quizCanceled = new EventEmitter<void>();

  quizState: QuizState | null = null;
  quizForm: FormGroup;
  isLoading = false;
  error: string | null = null;
  
  // Timer related
  timerSubscription: Subscription | null = null;
  timeWarningShown = false;
  
  // Auto-save related
  autoSaveSubscription: Subscription | null = null;
  lastSaveTime: Date | null = null;
  isSaving = false;
  
  // Navigation
  currentPageIndex = 0;
  totalPages = 0;
  
  constructor(
    private moodleService: MoodleService,
    private sanitization: SanitizationService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    this.quizForm = this.fb.group({});
  }

  ngOnInit() {
    this.initializeQuiz();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private getQuizId(): number {
    // Use the actual quiz ID if available, otherwise fall back to the content ID
    return this.quiz.quizId || this.quiz.id;
  }

  /**
   * Check if there's an in-progress attempt for a quiz
   * This can be called before opening the quiz dialog
   */
  static async checkForInProgressAttempt(moodleService: MoodleService, quiz: MoodleContent): Promise<{hasInProgress: boolean, attemptInfo?: any}> {
    try {
      const quizId = quiz.quizId || quiz.id;
      const inProgressAttempt = await moodleService.getInProgressAttempt(quizId).toPromise();
      
      if (inProgressAttempt) {
        return {
          hasInProgress: true,
          attemptInfo: {
            id: inProgressAttempt.id,
            currentPage: inProgressAttempt.currentpage || 0,
            timeStart: inProgressAttempt.timestart,
            timeModified: inProgressAttempt.timemodified
          }
        };
      }
      
      return { hasInProgress: false };
    } catch (error) {
      console.error('Failed to check for in-progress attempt:', error);
      return { hasInProgress: false };
    }
  }

  private cleanup() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
  }

  private parseQuestions() {
    if (!this.quizState?.questions) return;
    
    this.quizState.questions.forEach(question => {
      // Use the service to parse question data
      const parsedQuestion = this.moodleService.parseQuestionData(question);
      question.parsedAnswers = parsedQuestion.parsedAnswers;
      question.questionText = parsedQuestion.questionText;
      
      // Debug logging
      console.log('Parsed question:', {
        type: question.type,
        questionText: question.questionText,
        parsedAnswers: question.parsedAnswers
      });
    });
  }

  async initializeQuiz() {
    this.isLoading = true;
    this.error = null;

    try {
      const quizId = this.getQuizId();
      console.log('Initializing quiz with ID:', quizId);

      // Check for existing in-progress attempt
      const inProgressAttempt = await this.moodleService.getInProgressAttempt(quizId).toPromise();
      console.log('In-progress attempt check result:', inProgressAttempt);
      
      let attemptData;
      let accessInfo;
      
      if (inProgressAttempt) {
        // Resume existing attempt
        console.log('Found in-progress attempt:', inProgressAttempt.id, 'on page:', inProgressAttempt.currentpage);
        
        // Show user feedback about resuming
        this.snackBar.open(
          `Resuming quiz attempt from page ${(inProgressAttempt.currentpage || 0) + 1}...`, 
          'OK', 
          { 
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
        
        const currentPage = inProgressAttempt.currentpage || 0;
        
        try {
          // Load the attempt data from the current page
          attemptData = await this.moodleService.getQuizAttemptData(inProgressAttempt.id, currentPage).toPromise();
          console.log('Resumed attempt data loaded:', attemptData);
          
          // Get access info for the existing attempt
          accessInfo = await this.moodleService.getQuizAccessInfo(quizId).toPromise();
          
        } catch (resumeError) {
          console.error('Failed to resume existing attempt:', resumeError);
          // If resuming fails, try to start a new attempt
          console.log('Attempting to start new quiz attempt after resume failure...');
          const startResponse = await this.moodleService.startQuizAttempt(quizId).toPromise();
          
          if (!startResponse?.attempt) {
            throw new Error('Failed to start quiz attempt after resume failure');
          }
          
          console.log('New quiz attempt started after resume failure:', startResponse.attempt.id);
          attemptData = await this.moodleService.getQuizAttemptData(startResponse.attempt.id, 0).toPromise();
          accessInfo = await this.moodleService.getQuizAccessInfo(quizId).toPromise();
        }
        
      } else {
        // Start new attempt - let the API handle access restrictions
        console.log('No in-progress attempts found. Starting new quiz attempt for quiz:', quizId);
        
        this.snackBar.open(
          'Starting new quiz attempt...', 
          'OK', 
          { 
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
        
        const startResponse = await this.moodleService.startQuizAttempt(quizId).toPromise();
        
        if (!startResponse?.attempt) {
          throw new Error('Failed to start quiz attempt');
        }
        
        console.log('New quiz attempt started:', startResponse.attempt.id);
        
        // Get quiz attempt data starting from page 0
        attemptData = await this.moodleService.getQuizAttemptData(startResponse.attempt.id, 0).toPromise();
        
        // Get access info after starting the attempt
        accessInfo = await this.moodleService.getQuizAccessInfo(quizId).toPromise();
      }
      
      if (!attemptData) {
        throw new Error('Failed to load quiz questions');
      }

      console.log('Quiz attempt data loaded:', attemptData);

      // Initialize quiz state
      const questions = attemptData.questions || [];
      const currentPage = inProgressAttempt ? (inProgressAttempt.currentpage || 0) : 0;
      
      this.quizState = {
        quiz: this.quiz,
        attempt: attemptData.attempt,
        questions: questions,
        currentPage: currentPage,
        totalPages: questions.length > 0 ? Math.max(1, Math.max(...questions.map(q => q.page)) + 1) : 1,
        timer: null,
        accessInfo: accessInfo || null,
        isDirty: false,
        isSubmitting: false,
        autoSaveInterval: 60, // Default auto-save interval
        lastAutoSave: null
      };
      
      // Set the current page index for UI
      this.currentPageIndex = currentPage;

      // Initialize timer if quiz has time limit
      if (this.quiz.timeLimit && this.quiz.timeLimit > 0) {
        this.quizState.timer = this.moodleService.createQuizTimer(
          this.quiz.timeLimit,
          attemptData.attempt.timestart
        );
        this.startTimer();
        
        // Show timer info if resuming
        if (inProgressAttempt && this.quizState.timer) {
          const timeRemaining = this.formatTime(this.quizState.timer.timeRemaining);
          console.log(`Quiz resumed with ${timeRemaining} remaining`);
        }
      }

      // Parse questions and initialize form
      this.parseQuestions();
      this.initializeForm();
      
      // Start auto-save
      this.startAutoSave();

      // Show success message
      const message = inProgressAttempt 
        ? `Quiz resumed successfully! Page ${currentPage + 1} of ${this.quizState.totalPages}`
        : `Quiz started successfully! Page 1 of ${this.quizState.totalPages}`;
        
      this.snackBar.open(message, 'OK', { 
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });

      this.isLoading = false;
    } catch (error: any) {
      this.error = error.message || 'Failed to initialize quiz';
      this.isLoading = false;
      console.error('Quiz initialization error:', error);
      
      // Show error message to user
      this.snackBar.open(
        `Failed to load quiz: ${this.error}`, 
        'Close', 
        { 
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        }
      );
    }
  }

  private initializeForm() {
    if (!this.quizState?.questions) return;

    const formControls: { [key: string]: any } = {};

    this.quizState.questions.forEach(question => {
      if (question.parsedAnswers) {
        question.parsedAnswers.forEach(answer => {
          if (answer.type === 'checkbox') {
            // For checkboxes, create individual controls
            if (answer.options) {
              answer.options.forEach(option => {
                formControls[`${answer.name}_${option.value}`] = [option.selected || false];
              });
            }
          } else {
            formControls[answer.name] = [answer.value || ''];
          }
        });
      }
    });

    this.quizForm = this.fb.group(formControls);
    
    // Listen for form changes to mark as dirty
    this.quizForm.valueChanges.subscribe(() => {
      if (this.quizState) {
        this.quizState.isDirty = true;
      }
    });
  }

  private startTimer() {
    if (!this.quizState?.timer) return;

    this.timerSubscription = interval(1000).subscribe(() => {
      if (this.quizState?.timer) {
        this.quizState.timer = this.moodleService.updateQuizTimer(this.quizState.timer);
        
        // Show warning when time is running low
        if (this.quizState.timer.timeRemaining <= this.quizState.timer.warningThreshold && !this.timeWarningShown) {
          this.showTimeWarning();
          this.timeWarningShown = true;
        }
        
        // Auto-submit when time runs out
        if (this.quizState.timer.timeRemaining <= 0) {
          this.autoSubmitQuiz();
        }
        
        this.cdr.detectChanges();
      }
    });
  }

  private startAutoSave() {
    if (!this.quizState?.autoSaveInterval) return;

    this.autoSaveSubscription = interval(this.quizState.autoSaveInterval * 1000).subscribe(() => {
      if (this.quizState?.isDirty && !this.quizState.isSubmitting) {
        this.autoSave();
      }
    });
  }

  private async autoSave() {
    if (!this.quizState?.attempt || this.isSaving) return;

    this.isSaving = true;
    
    try {
      const answers = this.collectAnswers();
      await this.moodleService.saveQuizAttempt(this.quizState.attempt.id, answers).toPromise();
      
      this.quizState.isDirty = false;
      this.quizState.lastAutoSave = new Date();
      this.lastSaveTime = new Date();
      
      this.snackBar.open('Answers saved automatically', 'OK', { 
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      this.isSaving = false;
    }
  }

  private collectAnswers(): { [key: string]: any } {
    const formValues = this.quizForm.value;
    const answers: { [key: string]: any } = {};

    // Convert form values to Moodle format
    Object.keys(formValues).forEach(key => {
      const value = formValues[key];
      
      // Handle checkbox groups
      if (key.includes('_') && typeof value === 'boolean') {
        const [baseName, optionValue] = key.split('_');
        if (value) {
          if (!answers[baseName]) {
            answers[baseName] = [];
          }
          if (Array.isArray(answers[baseName])) {
            answers[baseName].push(optionValue);
          }
        }
      } else {
        answers[key] = value;
      }
    });

    return answers;
  }

  getCurrentPageQuestions(): QuizQuestion[] {
    if (!this.quizState?.questions) return [];
    return this.quizState.questions.filter(q => q.page === this.currentPageIndex);
  }

  canNavigateToPage(pageIndex: number): boolean {
    // In most quiz systems, you can navigate freely unless specifically blocked
    return pageIndex >= 0 && pageIndex < (this.quizState?.totalPages || 0);
  }

  async navigateToPage(pageIndex: number) {
    if (this.canNavigateToPage(pageIndex)) {
      this.currentPageIndex = pageIndex;
      if (this.quizState) {
        this.quizState.currentPage = pageIndex;
        
                // Load questions for the new page
        if (this.quizState.attempt) {
          try {
            this.isLoading = true;
            const attemptData = await this.moodleService.getQuizAttemptData(this.quizState.attempt.id, pageIndex).toPromise();
            if (attemptData?.questions) {
              // Update questions for this page
              this.quizState.questions = attemptData.questions;
              this.parseQuestions();
              this.initializeForm();
            }
          } catch (error) {
            console.error('Failed to load page questions:', error);
          } finally {
            this.isLoading = false;
          }
        }
      }
    }
  }

  nextPage() {
    if (this.currentPageIndex < (this.quizState?.totalPages || 1) - 1) {
      this.navigateToPage(this.currentPageIndex + 1);
    }
  }

  previousPage() {
    if (this.currentPageIndex > 0) {
      this.navigateToPage(this.currentPageIndex - 1);
    }
  }

  async submitQuiz() {
    if (!this.quizState?.attempt) return;

    // Confirm submission
    const confirmResult = await this.showConfirmDialog(
      'Submit Quiz',
      'Are you sure you want to submit your quiz? This action cannot be undone.'
    );

    if (!confirmResult) return;

    this.quizState.isSubmitting = true;
    
    try {
      const answers = this.collectAnswers();
      const response = await this.moodleService.submitQuizAttempt(
        this.quizState.attempt.id,
        answers
      ).toPromise();
      
      this.snackBar.open('Quiz submitted successfully!', 'OK', { duration: 3000 });
      this.quizCompleted.emit(response);
    } catch (error: any) {
      this.snackBar.open(
        error.message || 'Failed to submit quiz',
        'OK',
        { duration: 5000 }
      );
      this.quizState.isSubmitting = false;
    }
  }

  async cancelQuiz() {
    const confirmResult = await this.showConfirmDialog(
      'Cancel Quiz',
      'Are you sure you want to cancel this quiz? Your progress will be lost.'
    );

    if (confirmResult) {
      this.quizCanceled.emit();
    }
  }

  private showTimeWarning() {
    this.snackBar.open(
      `Warning: Only ${this.formatTime(this.quizState?.timer?.timeRemaining || 0)} remaining!`,
      'OK',
      {
        duration: 10000,
        panelClass: ['warning-snackbar']
      }
    );
  }

  private async autoSubmitQuiz() {
    if (this.quizState?.timer?.timeRemaining === 0) {
      this.snackBar.open('Time is up! Quiz will be submitted automatically.', 'OK', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      
      // Wait a moment then submit
      setTimeout(() => {
        this.submitQuiz();
      }, 2000);
    }
  }

  private async showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: { title, message }
      });

      dialogRef.afterClosed().subscribe(result => {
        resolve(result === true);
      });
    });
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  getTimerClass(): string {
    if (!this.quizState?.timer) return '';
    
    const remaining = this.quizState.timer.timeRemaining;
    const total = this.quizState.timer.timeLimit;
    const percentage = (remaining / total) * 100;
    
    if (percentage <= 10) return 'timer-critical';
    if (percentage <= 25) return 'timer-warning';
    return 'timer-normal';
  }

  sanitizeHtml(html: string): string {
    // For question text, we want to preserve the HTML structure since we control it
    // Just do basic sanitization to remove potentially dangerous scripts
    if (!html) return '';
    
    // Remove script tags and event handlers but preserve formatting
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }
}

// Simple confirmation dialog component
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h1 mat-dialog-title>{{ data.title }}</h1>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-button color="primary" (click)="onConfirm()">Confirm</button>
    </div>
  `,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; message: string }
  ) {}

  onCancel() {
    this.dialogRef.close(false);
  }

  onConfirm() {
    this.dialogRef.close(true);
  }
} 