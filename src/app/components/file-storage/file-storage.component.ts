import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';
import { MoodleService } from '../../services/moodle.service';
import { FilePreviewService, FilePreviewData } from '../../services/file-preview.service';

interface PrivateFile {
  filename: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  timemodified: number;
  timecreated: number;
  author: string;
  license: string;
  fileurl?: string;
}

interface StorageInfo {
  used: number;
  quota: number;
}

@Component({
  selector: 'app-file-storage',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule,
  ],
  templateUrl: './file-storage.component.html',
  styleUrl: './file-storage.component.scss',
})
export class FileStorageComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  files: PrivateFile[] = [];
  storageInfo: StorageInfo = { used: 0, quota: 0 };
  loading = true;
  uploading = false;
  error = '';

  displayedColumns: string[] = ['name', 'size', 'type', 'modified', 'actions'];

  private subscriptions = new Subscription();

  constructor(
    private moodleService: MoodleService,
    private filePreviewService: FilePreviewService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFiles();
    this.loadStorageInfo();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadFiles(): void {
    this.loading = true;
    this.error = '';

    console.log('FileStorageComponent: Loading files...');

    const filesSubscription = this.moodleService.getUserPrivateFiles().subscribe({
      next: (files) => {
        console.log('FileStorageComponent: Received files:', files);
        this.files = files.filter(file => file.filename !== '.'); // Filter out directory entries
        console.log('FileStorageComponent: Filtered files:', this.files);
        this.loading = false;
      },
      error: (err) => {
        console.error('FileStorageComponent: Error loading files:', err);
        this.error = 'Failed to load files. Please try again.';
        this.loading = false;
      },
    });

    this.subscriptions.add(filesSubscription);
  }

  loadStorageInfo(): void {
    console.log('FileStorageComponent: Loading storage info...');
    
    const storageSubscription = this.moodleService.getUserFileStorageInfo().subscribe({
      next: (info) => {
        console.log('FileStorageComponent: Received storage info:', info);
        this.storageInfo = info;
      },
      error: (err) => {
        console.error('FileStorageComponent: Error loading storage info:', err);
        // Use default values on error
        this.storageInfo = { used: 0, quota: 100 * 1024 * 1024 };
      },
    });

    this.subscriptions.add(storageSubscription);
  }

  triggerFileUpload(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadFile(file);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.uploadFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  uploadFile(file: File): void {
    if (!file) return;

    // Check if file would exceed quota
    if (this.storageInfo.used + file.size > this.storageInfo.quota) {
      this.snackBar.open('File would exceed storage quota', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    this.uploading = true;

    const uploadSubscription = this.moodleService.uploadPrivateFile(file).subscribe({
      next: (response) => {
        this.uploading = false;
        this.snackBar.open('File uploaded successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar'],
        });

        // Refresh file list and storage info
        this.loadFiles();
        this.loadStorageInfo();

        // Clear file input
        this.fileInput.nativeElement.value = '';
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.open('Failed to upload file', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        console.error('Upload error:', err);

        // Clear file input
        this.fileInput.nativeElement.value = '';
      },
    });

    this.subscriptions.add(uploadSubscription);
  }

  downloadFile(file: PrivateFile): void {
    const downloadUrl = this.moodleService.getPrivateFileUrl(file.filename, file.filepath);
    
    if (downloadUrl) {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      this.snackBar.open('Failed to generate download link', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  previewFile(file: PrivateFile): void {
    const fileUrl = this.moodleService.getPrivateFileUrl(file.filename, file.filepath);
    
    if (!fileUrl) {
      this.snackBar.open('Cannot preview this file', 'Close', {
        duration: 3000,
      });
      return;
    }

    const fileType = this.filePreviewService.detectFileType(file.mimetype);
    
    const previewData: FilePreviewData = {
      url: fileUrl,
      name: file.filename,
      mimeType: file.mimetype,
      fileType: fileType,
    };

    this.filePreviewService.openPreview(previewData);
  }

  deleteFile(file: PrivateFile): void {
    if (confirm(`Are you sure you want to delete "${file.filename}"?`)) {
      const deleteSubscription = this.moodleService.deletePrivateFile(file.filename, file.filepath).subscribe({
        next: (success) => {
          if (success) {
            this.snackBar.open('File deleted successfully', 'Close', {
              duration: 3000,
              panelClass: ['success-snackbar'],
            });
            
            // Refresh file list and storage info
            this.loadFiles();
            this.loadStorageInfo();
          } else {
            this.snackBar.open('Failed to delete file', 'Close', {
              duration: 3000,
              panelClass: ['error-snackbar'],
            });
          }
        },
        error: (err) => {
          this.snackBar.open('Error deleting file', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar'],
          });
          console.error('Delete error:', err);
        },
      });

      this.subscriptions.add(deleteSubscription);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(timestamp: number): string {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  getFileIcon(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.includes('pdf')) return 'picture_as_pdf';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'description';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'table_chart';
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'slideshow';
    if (mimetype.startsWith('video/')) return 'movie';
    if (mimetype.startsWith('audio/')) return 'music_note';
    if (mimetype.includes('zip') || mimetype.includes('archive')) return 'archive';
    if (mimetype.includes('text/')) return 'text_snippet';
    return 'insert_drive_file';
  }

  canPreview(mimetype: string): boolean {
    const previewableTypes = [
      'application/pdf',
      'text/',
      'image/',
      'video/',
      'audio/',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    return previewableTypes.some(type => mimetype.includes(type));
  }

  getStoragePercentage(): number {
    if (this.storageInfo.quota === 0) return 0;
    return (this.storageInfo.used / this.storageInfo.quota) * 100;
  }

  getStorageColor(): string {
    const percentage = this.getStoragePercentage();
    if (percentage >= 90) return 'warn';
    if (percentage >= 75) return 'accent';
    return 'primary';
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
} 