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
import JSZip from 'jszip';

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
                this.groupedContents[currentSectionId].push(content);                // Initialize videos as collapsed by default
                if (content.type === 'video' || 
                    (content.type === 'resource' && content.mimeType?.startsWith('video/'))) {
                  this.expandedVideos[content.id] = false; // Default to collapsed
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
    // Download all content files from a section
  async downloadSectionContents(sectionId: number, event: Event): Promise<void> {
    // Prevent the click from toggling the section
    event.stopPropagation();
    
    if (!this.groupedContents[sectionId] || this.groupedContents[sectionId].length === 0) {
      return;
    }
    
    // Get all downloadable files in this section
    const downloadableContents = this.groupedContents[sectionId].filter(content => 
      content.fileUrl && 
      content.type !== 'label' && 
      content.type !== 'url'
    );
    
    if (downloadableContents.length === 0) {
      console.log('No downloadable files in this section');
      return;
    }
    
    // Get section name for the zip file
    const sectionName = this.sections.find(s => s.id === sectionId)?.name || 'section';
    const zip = new JSZip();
    
    // Simple loading indicator using console (could be replaced with a proper UI indicator)
    console.log(`Preparing ${downloadableContents.length} files for download...`);
    
    try {
      // Add files to the zip
      const downloadPromises = downloadableContents.map(async (content) => {
        if (!content.fileUrl) return;
        
        try {
          // Get the file name from the URL
          const fileName = this.getFileNameFromUrl(content.fileUrl);
          // Fetch the file
          const response = await fetch(content.fileUrl);
          const blob = await response.blob();
          // Add to zip with a sanitized filename
          zip.file(this.sanitizeFileName(`${content.name || fileName}`), blob);
        } catch (error) {
          console.error(`Error downloading file: ${content.name}`, error);
        }
      });
      
      await Promise.all(downloadPromises);
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = this.sanitizeFileName(`${sectionName}.zip`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('Download complete!');
    } catch (error) {
      console.error('Error creating zip file:', error);
    }
  }
  
  // Helper method to get filename from URL
  private getFileNameFromUrl(url: string): string {
    try {
      // Try to extract the filename from the URL path
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      
      // If we found a reasonable filename, return it
      if (lastPart && lastPart.length > 0 && lastPart.indexOf('.') > 0) {
        return decodeURIComponent(lastPart);
      }
      
      // Fall back to a generic name
      return 'file';
    } catch (e) {
      return 'file';
    }
  }
  
  // Helper method to sanitize filenames
  private sanitizeFileName(name: string): string {
    // Remove any characters that aren't safe for filenames
    return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200);
  }

  // Download all files from all sections in the module
  async downloadAllModuleFiles(): Promise<void> {
    if (this.loading || this.sections.length === 0) {
      return;
    }
    
    // Gather all downloadable content from all sections
    let allDownloadableContents: MoodleContent[] = [];
    
    // Map to store which section each content belongs to
    const contentSectionMap = new Map<number, number>();
    
    // Collect downloadable files from each section and track their section
    for (const section of this.sections) {
      const sectionContents = this.groupedContents[section.id] || [];
      const downloadableContents = sectionContents.filter(content => 
        content.fileUrl && 
        content.type !== 'label' && 
        content.type !== 'url'
      );
      
      // Add to overall collection and map each content to its section
      downloadableContents.forEach(content => {
        allDownloadableContents.push(content);
        contentSectionMap.set(content.id, section.id);
      });
    }
    
    if (allDownloadableContents.length === 0) {
      console.log('No downloadable files in this module');
      return;
    }
    
    const zip = new JSZip();
    
    // Simple loading indicator using console (could be replaced with a proper UI indicator)
    console.log(`Preparing ${allDownloadableContents.length} files for download from ${this.sections.length} sections...`);
    
    try {
      // Create folders for each section
      const sectionFolders: { [sectionId: number]: JSZip } = {};
      
      // Setup folders for each section
      for (const section of this.sections) {
        const safeSectionName = this.sanitizeFileName(section.name || `Section ${section.id}`);
        sectionFolders[section.id] = zip.folder(safeSectionName) as JSZip;
      }
      
      // Add files to respective section folders
      const downloadPromises = allDownloadableContents.map(async (content) => {
        if (!content.fileUrl) return;
        
        try {
          // Find which section this content belongs to using our map
          const sectionId = contentSectionMap.get(content.id);
          
          if (!sectionId || !sectionFolders[sectionId]) {
            // If we can't find the section, put it in the root of the zip
            console.log(`Couldn't find section for content ${content.name}, adding to root`);
            const fileName = this.sanitizeFileName(content.name || this.getFileNameFromUrl(content.fileUrl));
            const response = await fetch(content.fileUrl);
            const blob = await response.blob();
            zip.file(fileName, blob);
            return;
          }
          
          // Get the file name from the URL or content name
          const fileName = this.sanitizeFileName(content.name || this.getFileNameFromUrl(content.fileUrl));
          
          // Fetch the file
          const response = await fetch(content.fileUrl);
          const blob = await response.blob();
          
          // Add to the appropriate section folder
          sectionFolders[sectionId].file(fileName, blob);
          console.log(`Added ${fileName} to section ${sectionId}`);
        } catch (error) {
          console.error(`Error downloading file: ${content.name}`, error);
        }
      });
      
      await Promise.all(downloadPromises);
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = this.sanitizeFileName(`${this.moduleName}.zip`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('Module download complete!');
    } catch (error) {
      console.error('Error creating module zip file:', error);
    }
  }
}
