import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoodleService } from '../../services/moodle.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { ValidationService } from '../../services/validation.service';
import { MoodleContent, QuizAttempt } from '../../models/moodle.models';

@Component({
  selector: 'app-quiz-taking',
  templateUrl: './quiz-taking.component.html',
  styleUrls: ['./quiz-taking.component.scss']
})
export class QuizTakingComponent implements OnInit {
  quizId!: number;
  attemptId?: number;
  quiz?: MoodleContent;
  attempt?: QuizAttempt;
  questions: any[] = [];
  answers: { [key: string]: any } = {};
  loading = false;
  error?: string;
  submitted = false;
  feedback?: any;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private moodleService: MoodleService,
    private errorHandler: ErrorHandlerService,
    private validationService: ValidationService
  ) {}

  ngOnInit(): void {
    this.quizId = Number(this.route.snapshot.paramMap.get('quizId'));
    this.startAttempt();
  }

  startAttempt(): void {
    this.loading = true;
    this.moodleService.startQuizAttempt(this.quizId).subscribe({
      next: (attempt) => {
        this.attempt = attempt;
        this.attemptId = attempt.id;
        this.fetchQuestions();
      },
      error: (err) => {
        this.errorHandler.handleMoodleError(err, 'Failed to start quiz attempt');
        this.error = 'Could not start quiz attempt.';
        this.loading = false;
      }
    });
  }

  fetchQuestions(): void {
    if (!this.attemptId) return;
    this.moodleService.getQuizAttemptData(this.attemptId).subscribe({
      next: (data) => {
        this.questions = data.questions || [];
        this.loading = false;
      },
      error: (err) => {
        this.errorHandler.handleMoodleError(err, 'Failed to load quiz questions');
        this.error = 'Could not load quiz questions.';
        this.loading = false;
      }
    });
  }

  onAnswerChange(slot: number, value: any): void {
    this.answers[slot] = value;
  }

  submitQuiz(): void {
    if (!this.attemptId) return;
    this.loading = true;
    this.moodleService.submitQuizAttempt(this.attemptId, this.answers).subscribe({
      next: (result) => {
        this.submitted = true;
        this.feedback = result;
        this.loading = false;
      },
      error: (err) => {
        this.errorHandler.handleMoodleError(err, 'Failed to submit quiz');
        this.error = 'Could not submit quiz.';
        this.loading = false;
      }
    });
  }
}
