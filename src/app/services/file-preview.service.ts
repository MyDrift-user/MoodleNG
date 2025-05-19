import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { FilePreviewDialogComponent } from '../components/shared/file-preview-dialog/file-preview-dialog.component';

export interface FilePreviewData {
  url: string;
  name: string;
  mimeType: string;
  fileType: 'pdf' | 'text' | 'markdown' | 'office' | 'image' | 'other';
}

@Injectable({
  providedIn: 'root'
})
export class FilePreviewService {

  constructor(private dialog: MatDialog) { }

  openPreview(fileData: FilePreviewData): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.width = '98vw';
    dialogConfig.maxWidth = '98vw';
    dialogConfig.height = '90vh';
    dialogConfig.data = fileData;
    dialogConfig.panelClass = 'file-preview-dialog';
    dialogConfig.autoFocus = false;
    dialogConfig.disableClose = false;
    dialogConfig.hasBackdrop = true;

    this.dialog.open(FilePreviewDialogComponent, dialogConfig);
  }

  detectFileType(mimeType: string): FilePreviewData['fileType'] {
    if (!mimeType) return 'other';

    if (mimeType.includes('pdf')) {
      return 'pdf';
    } else if (
      mimeType.includes('text/plain') || 
      mimeType.includes('text/html') ||
      mimeType.includes('application/json') ||
      mimeType.includes('text/csv')
    ) {
      return 'text';
    } else if (
      mimeType.includes('text/markdown') || 
      mimeType.endsWith('.md')
    ) {
      return 'markdown';
    } else if (
      mimeType.includes('word') || 
      mimeType.includes('excel') || 
      mimeType.includes('spreadsheet') ||
      mimeType.includes('powerpoint') || 
      mimeType.includes('presentation') ||
      mimeType.includes('officedocument') ||
      mimeType.includes('opendocument')
    ) {
      return 'office';
    } else if (mimeType.startsWith('image/')) {
      return 'image';
    } else {
      return 'other';
    }
  }
} 