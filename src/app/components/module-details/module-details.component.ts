import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MoodleContent, MoodleModule } from '../../models/moodle.models';
import { MoodleService } from '../../services/moodle.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-module-details',
  standalone: true,  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatDividerModule,
    MatListModule,
    MatTooltipModule
  ],
  templateUrl: './module-details.component.html',
  styleUrl: './module-details.component.scss'
})
export class ModuleDetailsComponent implements OnInit {
  moduleId!: number;
  moduleName = 'Module';
  contents: MoodleContent[] = [];
  loading = true;
  error = '';
  
  constructor(
    private route: ActivatedRoute,
    private moodleService: MoodleService,
    private sanitizer: DomSanitizer
  ) {}
  
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.moduleId = parseInt(idParam, 10);
        this.loadModuleContents();
      } else {
        this.error = 'Module ID not provided';
        this.loading = false;
      }
    });
  }
  
  loadModuleContents(): void {
    this.loading = true;
    this.moodleService.getUserModules().subscribe({
      next: (modules) => {
        // Find the current module to get its name
        const currentModule = modules.find(m => m.id === this.moduleId);
        if (currentModule) {
          this.moduleName = currentModule.name;
        }
        
        // Now get the contents
        this.moodleService.getModuleContents(this.moduleId).subscribe({
          next: (contents) => {
            this.contents = contents;
            this.loading = false;
          },
          error: (err) => {
            this.error = 'Failed to load module contents. Please try again.';
            this.loading = false;
            console.error('Error loading module contents:', err);
          }
        });
      },
      error: (err) => {
        this.error = 'Failed to load module information. Please try again.';
        this.loading = false;
        console.error('Error loading modules:', err);
      }
    });
  }
    // Helper methods for content display
  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
  
  sanitizeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  
  // Opens a URL in a new browser tab
  openInNewTab(url?: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }
  
  getFileIcon(mimeType?: string): string {
    if (!mimeType) return 'insert_drive_file';
    
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'videocam';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio_file';
    } else if (mimeType.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'description';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return 'table_chart';
    } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      return 'slideshow';
    } else if (mimeType.includes('zip') || mimeType.includes('compressed')) {
      return 'folder_zip';
    } else {
      return 'insert_drive_file';
    }
  }
  
  getIconForContentType(type: string): string {
    switch (type) {
      case 'section':
        return 'bookmark';
      case 'text':
        return 'text_snippet';
      case 'url':
        return 'link';
      case 'image':
        return 'image';
      case 'video':
        return 'videocam';
      case 'audio':
        return 'audio_file';
      case 'file':
        return 'insert_drive_file';
      case 'resource':
        return 'article';
      case 'assign':
        return 'assignment';
      case 'forum':
        return 'forum';
      case 'quiz':
        return 'quiz';
      default:
        return 'school';
    }
  }
  
  downloadFile(fileUrl?: string): void {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  }
}
