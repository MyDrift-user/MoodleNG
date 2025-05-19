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
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-module-details',
  standalone: true,  
  imports: [
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
  styleUrl: './module-details.component.scss',  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0',
        overflow: 'hidden',
        opacity: '0',
        margin: '0',
        padding: '0'
      })),
      state('expanded', style({
        height: '*',
        overflow: 'visible',
        opacity: '1'
      })),
      transition('collapsed <=> expanded', [
        animate('350ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ])
    ])
  ]
})
export class ModuleDetailsComponent implements OnInit {
  moduleId!: number;
  moduleName = 'Module';
  contents: MoodleContent[] = [];
  loading = true;
  error = '';
  
  // Track expanded/collapsed sections
  expandedSections: { [sectionId: number]: boolean } = {};
  
  // Track expanded/collapsed videos
  expandedVideos: { [contentId: number]: boolean } = {};
  
  // Group contents by section
  groupedContents: { [sectionId: number]: MoodleContent[] } = {};
  
  // Track all sections in order
  sections: MoodleContent[] = [];
  
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
            
            // Group contents by section
            this.sections = [];
            this.groupedContents = {};
            
            let currentSectionId = -1;
            
            for (const content of contents) {
              if (content.type === 'section') {
                currentSectionId = content.id;
                this.sections.push(content);
                this.groupedContents[currentSectionId] = [];                // Initialize as expanded (sections should be expanded by default)
                this.expandedSections[currentSectionId] = true;
              } else if (currentSectionId >= 0) {
                this.groupedContents[currentSectionId].push(content);                // Initialize videos as expanded
                if (content.type === 'video' || 
                    (content.type === 'resource' && content.mimeType?.startsWith('video/'))) {
                  this.expandedVideos[content.id] = true; // Default to expanded
                }
              }
            }
            
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
        return 'description';
      case 'label':
        return 'label';
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
  
  // Get a human-readable label for resource types
  getResourceTypeLabel(mimeType?: string): string {
    if (!mimeType) return 'Resource';
    
    if (mimeType.startsWith('image/')) {
      return 'Image';
    } else if (mimeType.startsWith('video/')) {
      return 'Video';
    } else if (mimeType.startsWith('audio/')) {
      return 'Audio';
    } else if (mimeType.includes('pdf')) {
      return 'PDF';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'Document';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return 'Spreadsheet';
    } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      return 'Presentation';
    } else if (mimeType.includes('zip') || mimeType.includes('compressed')) {
      return 'Archive';
    } else {
      return 'File';
    }
  }
  
  // Toggle section expansion
  toggleSection(sectionId: number): void {
    this.expandedSections[sectionId] = !this.expandedSections[sectionId];
  }
  
  // Toggle video expansion
  toggleVideo(contentId: number): void {
    this.expandedVideos[contentId] = !this.expandedVideos[contentId];
  }
    // Check if a section is expanded
  isSectionExpanded(sectionId: number): boolean {
    return this.expandedSections[sectionId] === true; // Default to collapsed
  }
  
  // Check if a video is expanded
  isVideoExpanded(contentId: number): boolean {
    return this.expandedVideos[contentId] === true; // Default to collapsed
  }
}
