import { Component, Inject, OnInit, CUSTOM_ELEMENTS_SCHEMA, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FilePreviewData } from '../../../services/file-preview.service';
import { NgxDocViewerModule } from 'ngx-doc-viewer';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-file-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgxDocViewerModule,
    MatTooltipModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="file-preview-container">
      <div class="preview-header">
        <h2>{{ fileData.name }}</h2>
        <div class="spacer"></div>
        <div class="button-container">
          <button mat-icon-button [matTooltip]="'Download'" (click)="downloadFile()">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button [matTooltip]="'Close'" (click)="close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="preview-content">
        <!-- Loading spinner -->
        <div *ngIf="loading" class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading preview...</p>
        </div>

        <!-- PDF preview -->
        <div *ngIf="fileData.fileType === 'pdf' && !loading" class="pdf-container">
          <iframe
            [src]="safeUrl"
            frameborder="0"
            style="width:100%; height:100%; position:absolute; top:0; left:0; right:0; bottom:0;"
          ></iframe>
        </div>

        <!-- Text file preview -->
        <div *ngIf="fileData.fileType === 'text' && !loading" class="text-preview">
          <pre>{{ textContent }}</pre>
        </div>

        <!-- Markdown preview -->
        <div *ngIf="fileData.fileType === 'markdown' && !loading" class="markdown-preview">
          <div [innerHTML]="markdownContent"></div>
        </div>

        <!-- Office documents preview -->
        <div *ngIf="fileData.fileType === 'office' && !loading" class="office-preview">
          <ngx-doc-viewer
            [url]="fileData.url"
            viewer="office"
            [viewerUrl]="'https://view.officeapps.live.com/op/embed.aspx?src='"
          ></ngx-doc-viewer>
        </div>

        <!-- Image preview -->
        <div *ngIf="fileData.fileType === 'image' && !loading" class="image-preview">
          <img [src]="safeUrl" alt="Image preview" />
        </div>

        <!-- Fallback for unsupported files -->
        <div *ngIf="fileData.fileType === 'other' && !loading" class="unsupported-file">
          <mat-icon>file_present</mat-icon>
          <p>This file type cannot be previewed</p>
          <button mat-raised-button color="primary" (click)="downloadFile()">Download File</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        min-width: 100%;
        min-height: 100%;
      }

      .file-preview-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: #303030;
        min-width: 100%;
        min-height: 100%;
      }

      .preview-header {
        display: flex;
        align-items: center;
        padding: 0 12px 0 16px;
        background-color: #212121;
        color: white;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        height: 48px;
        min-height: 48px;
        max-height: 48px;
        flex: 0 0 auto;
        width: 100%;
        box-sizing: border-box;
      }

      .preview-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 400;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 80%;
      }

      .button-container {
        display: flex;
        align-items: center;
        margin-right: 4px;
      }

      .button-container button {
        margin-left: 4px;
      }

      .spacer {
        flex: 1 1 auto;
      }

      .preview-content {
        flex: 1 1 auto;
        height: calc(100% - 48px);
        position: relative;
        background-color: #424242;
        overflow: hidden;
        width: 100%;
      }

      .loading-container,
      .pdf-container,
      .text-preview,
      .markdown-preview,
      .office-preview,
      .image-preview,
      .unsupported-file {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .loading-container p {
        margin-top: 16px;
        color: rgba(255, 255, 255, 0.7);
      }

      .pdf-container {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: block;
        position: relative;
      }

      .pdf-container iframe {
        display: block;
        border: none;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      .text-preview {
        padding: 16px;
        background-color: #303030;
        color: rgba(255, 255, 255, 0.87);
      }

      .text-preview pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: 'Roboto Mono', monospace;
        font-size: 14px;
        line-height: 1.5;
      }

      .markdown-preview {
        padding: 16px;
        background-color: #303030;
        color: rgba(255, 255, 255, 0.87);
        overflow: auto;
      }

      .office-preview {
        width: 100%;
        height: 100%;
      }

      /* Target the ngx-doc-viewer component and its iframe */
      .office-preview ::ng-deep ngx-doc-viewer,
      .office-preview ::ng-deep iframe {
        width: 100% !important;
        height: 100% !important;
        border: none;
        display: block;
      }

      .image-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #212121;
        padding: 0;
      }

      .image-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .unsupported-file {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.7);
      }

      .unsupported-file mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        margin-bottom: 16px;
        color: rgba(255, 255, 255, 0.5);
      }

      .unsupported-file button {
        margin: 8px;
      }
    `,
  ],
})
export class FilePreviewDialogComponent implements OnInit, AfterViewInit {
  safeUrl!: SafeResourceUrl;
  loading = true;
  textContent = '';
  markdownContent = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public fileData: FilePreviewData,
    private dialogRef: MatDialogRef<FilePreviewDialogComponent>,
    private sanitizer: DomSanitizer
  ) {
    // Make sure dialog uses maximum width
    this.dialogRef.updateSize('98vw', '90vh');
  }

  ngOnInit(): void {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.fileData.url);

    if (this.fileData.fileType === 'text' || this.fileData.fileType === 'markdown') {
      this.loadTextContent();
    } else {
      // For other file types, just fake a brief loading state
      setTimeout(() => {
        this.loading = false;
      }, 500);
    }
  }

  ngAfterViewInit(): void {
    // Ensure dialog is properly sized
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      // Force dialog to use maximum width by updating size again
      this.dialogRef.updateSize('98vw', '90vh');
    }, 100);
  }

  async loadTextContent(): Promise<void> {
    try {
      const response = await fetch(this.fileData.url);
      const text = await response.text();

      if (this.fileData.fileType === 'text') {
        this.textContent = text;
      } else if (this.fileData.fileType === 'markdown') {
        // Very simple markdown parser (for a more robust solution, use a proper markdown library)
        this.markdownContent = this.parseMarkdown(text);
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading text content:', error);
      this.textContent = 'Error loading content. Please try downloading the file instead.';
      this.loading = false;
    }
  }

  // Very simple markdown parser
  private parseMarkdown(text: string): string {
    // Convert headers
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Convert bold and italic
    text = text.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
    text = text.replace(/\*(.*)\*/gim, '<em>$1</em>');

    // Convert links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

    // Convert line breaks
    text = text.replace(/\n/gim, '<br>');

    return text;
  }

  downloadFile(): void {
    window.open(this.fileData.url, '_blank');
  }

  close(): void {
    this.dialogRef.close();
  }
}
