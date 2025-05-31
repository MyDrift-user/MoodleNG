import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSortModule } from '@angular/material/sort';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MoodleContent, MoodleCourseResult } from '../../models/moodle.models';
import { MoodleService } from '../../services/moodle.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { animate, state, style, transition, trigger } from '@angular/animations';
import JSZip from 'jszip';
import { FilePreviewService } from '../../services/file-preview.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

// Add interface for JSZip metadata
interface JSZipMetadata {
  percent: number;
  currentFile: string;
}

// Add interface that extends JSZipGeneratorOptions to include onUpdate
interface JSZipGeneratorOptionsWithCallback extends JSZip.JSZipGeneratorOptions<'blob'> {
  onUpdate?: (metadata: JSZipMetadata) => void;
}

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
    MatProgressBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatListModule,
    MatTooltipModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatSortModule,
    MatBadgeModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './module-details.component.html',
  styleUrl: './module-details.component.scss',
  animations: [
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0',
          overflow: 'hidden',
          opacity: '0',
          margin: '0',
          padding: '0',
        })
      ),
      state(
        'expanded',
        style({
          height: '*',
          overflow: 'visible',
          opacity: '1',
        })
      ),
      transition('collapsed <=> expanded', [animate('350ms cubic-bezier(0.4, 0.0, 0.2, 1)')]),
    ]),
  ],
})
export class ModuleDetailsComponent implements OnInit {
  moduleId!: number;
  moduleName = 'Module';
  contents: MoodleContent[] = [];
  results: MoodleCourseResult[] = [];
  loadingResults = false;
  resultsError = '';
  activeTabIndex = 0;
  resultsDisplayColumns: string[] = ['name', 'grade', 'percentage', 'weight', 'range', 'feedback'];
  loading = true;
  error = '';

  // Loading states and progress for downloads
  downloadingAll = false;
  downloadAllProgress = 0;
  downloadingSections: { [sectionId: number]: boolean } = {};
  downloadSectionProgress: { [sectionId: number]: number } = {};

  // Track expanded/collapsed sections
  expandedSections: { [sectionId: number]: boolean } = {};

  // Track expanded/collapsed videos
  expandedVideos: { [contentId: number]: boolean } = {};

  // Group contents by section
  groupedContents: { [sectionId: number]: MoodleContent[] } = {};

  // Track all sections in order
  sections: MoodleContent[] = [];

  // Track unenrollment state
  unenrolling = false;

  // Add a property to track the confirmation state
  confirmingUnenroll = false;

  constructor(
    private route: ActivatedRoute,
    public moodleService: MoodleService,
    private sanitizer: DomSanitizer,
    private filePreviewService: FilePreviewService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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
      next: modules => {
        // Find the current module to get its name
        const currentModule = modules.find(m => m.id === this.moduleId);
        if (currentModule) {
          this.moduleName = currentModule.name;
        }
        // Now get the contents
        this.moodleService.getModuleContents(this.moduleId).subscribe({
          next: contents => {
            this.contents = contents;

            // Debug logging
            console.log('Loaded module contents:', contents);
            const contentTypes = contents.map(c => c.type);
            const uniqueTypes = [...new Set(contentTypes)];
            console.log('Content types in this module:', uniqueTypes);

            // Group contents by section
            this.sections = [];
            this.groupedContents = {};

            let currentSectionId = -1;

            for (const content of contents) {
              if (content.type === 'section') {
                currentSectionId = content.id;
                this.sections.push(content);
                this.groupedContents[currentSectionId] = []; // Initialize as expanded (sections should be expanded by default)
                this.expandedSections[currentSectionId] = true;
              } else if (currentSectionId >= 0) {
                this.groupedContents[currentSectionId].push(content); // Initialize videos as collapsed by default
                if (
                  content.type === 'video' ||
                  (content.type === 'resource' && content.mimeType?.startsWith('video/'))
                ) {
                  this.expandedVideos[content.id] = false; // Default to collapsed
                }
              }
            }

            this.loading = false;
          },
          error: err => {
            this.error = 'Failed to load module contents. Please try again.';
            this.loading = false;
            console.error('Error loading module contents:', err);
          },
        });
      },
      error: err => {
        this.error = 'Failed to load module information. Please try again.';
        this.loading = false;
        console.error('Error loading modules:', err);
      },
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
    console.log('Getting icon for content type:', type);

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
      case 'assignment':
        return 'assignment';
      case 'assign':
        return 'assignment';
      case 'forum':
        return 'forum';
      case 'quiz':
        return 'quiz';
      default:
        console.log('Unknown content type:', type);
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

    // Set loading state and initialize progress for this section
    this.downloadingSections[sectionId] = true;
    this.downloadSectionProgress[sectionId] = 0;

    // Get all downloadable files in this section
    const downloadableContents = this.groupedContents[sectionId].filter(
      content => content.fileUrl && content.type !== 'label' && content.type !== 'url'
    );

    if (downloadableContents.length === 0) {
      console.log('No downloadable files in this section');
      this.downloadingSections[sectionId] = false;
      this.downloadSectionProgress[sectionId] = 0;
      return;
    }

    // Get section name for the zip file
    const sectionName = this.sections.find(s => s.id === sectionId)?.name || 'section';
    const zip = new JSZip();

    // Progress tracking
    const totalFiles = downloadableContents.length;
    let filesProcessed = 0;

    try {
      // Add files to the zip
      const downloadPromises = downloadableContents.map(async content => {
        if (!content.fileUrl) return;

        try {
          // Get the file name from the URL
          const fileName = this.getFileNameFromUrl(content.fileUrl);
          // Fetch the file
          const response = await fetch(content.fileUrl);
          const blob = await response.blob();
          // Add to zip with a sanitized filename
          zip.file(this.sanitizeFileName(`${content.name || fileName}`), blob);

          // Update progress
          filesProcessed++;
          this.downloadSectionProgress[sectionId] = Math.round((filesProcessed / totalFiles) * 70); // 70% for file downloads
        } catch (error) {
          console.error(`Error downloading file: ${content.name}`, error);
          // Still count as processed even if error
          filesProcessed++;
          this.downloadSectionProgress[sectionId] = Math.round((filesProcessed / totalFiles) * 70);
        }
      });

      await Promise.all(downloadPromises);

      // Update progress - compression starting
      this.downloadSectionProgress[sectionId] = 75;

      // Generate the zip file - this can take time for larger files
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        // Add a progress callback
        onUpdate: (metadata: JSZipMetadata) => {
          // Update from 75% to 95% during zip generation
          if (metadata.percent) {
            const zipProgress = Math.round(75 + metadata.percent * 0.2);
            this.downloadSectionProgress[sectionId] = zipProgress;
          }
        },
      } as JSZipGeneratorOptionsWithCallback);

      // Update progress - almost done
      this.downloadSectionProgress[sectionId] = 95;

      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = this.sanitizeFileName(`${sectionName}.zip`);
      document.body.appendChild(downloadLink);

      // Wait a moment to ensure UI updates
      setTimeout(() => {
        this.downloadSectionProgress[sectionId] = 100;
        downloadLink.click();
        document.body.removeChild(downloadLink);
        console.log('Download complete!');

        // Reset after a brief moment to show 100% completion
        setTimeout(() => {
          this.downloadingSections[sectionId] = false;
          this.downloadSectionProgress[sectionId] = 0;
        }, 1000);
      }, 500);
    } catch (error) {
      console.error('Error creating zip file:', error);
      this.downloadingSections[sectionId] = false;
      this.downloadSectionProgress[sectionId] = 0;
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

    // Set loading state and initialize progress
    this.downloadingAll = true;
    this.downloadAllProgress = 0;

    // Gather all downloadable content from all sections
    const allDownloadableContents: MoodleContent[] = [];

    // Map to store which section each content belongs to
    const contentSectionMap = new Map<number, number>();

    // Collect downloadable files from each section and track their section
    for (const section of this.sections) {
      const sectionContents = this.groupedContents[section.id] || [];
      const downloadableContents = sectionContents.filter(
        content => content.fileUrl && content.type !== 'label' && content.type !== 'url'
      );

      // Add to overall collection and map each content to its section
      downloadableContents.forEach(content => {
        allDownloadableContents.push(content);
        contentSectionMap.set(content.id, section.id);
      });
    }

    if (allDownloadableContents.length === 0) {
      console.log('No downloadable files in this module');
      this.downloadingAll = false;
      this.downloadAllProgress = 0;
      return;
    }

    const zip = new JSZip();

    // Progress tracking
    const totalFiles = allDownloadableContents.length;
    let filesProcessed = 0;

    try {
      // Create folders for each section
      const sectionFolders: { [sectionId: number]: JSZip } = {};

      // Setup folders for each section
      for (const section of this.sections) {
        const safeSectionName = this.sanitizeFileName(section.name || `Section ${section.id}`);
        sectionFolders[section.id] = zip.folder(safeSectionName) as JSZip;

        // Update progress slightly for folder creation
        this.downloadAllProgress = Math.round(
          (this.sections.indexOf(section) / this.sections.length) * 5
        );
      }

      // Add files to respective section folders
      const downloadPromises = allDownloadableContents.map(async content => {
        if (!content.fileUrl) return;

        try {
          // Find which section this content belongs to using our map
          const sectionId = contentSectionMap.get(content.id);

          if (!sectionId || !sectionFolders[sectionId]) {
            // If we can't find the section, put it in the root of the zip
            console.log(`Couldn't find section for content ${content.name}, adding to root`);
            const fileName = this.sanitizeFileName(
              content.name || this.getFileNameFromUrl(content.fileUrl)
            );
            const response = await fetch(content.fileUrl);
            const blob = await response.blob();
            zip.file(fileName, blob);
          } else {
            // Get the file name from the URL or content name
            const fileName = this.sanitizeFileName(
              content.name || this.getFileNameFromUrl(content.fileUrl)
            );

            // Fetch the file
            const response = await fetch(content.fileUrl);
            const blob = await response.blob();

            // Add to the appropriate section folder
            sectionFolders[sectionId].file(fileName, blob);
          }

          // Update progress
          filesProcessed++;
          this.downloadAllProgress = 5 + Math.round((filesProcessed / totalFiles) * 65); // 5-70% for downloads
        } catch (error) {
          console.error(`Error downloading file: ${content.name}`, error);
          // Still count as processed even if error
          filesProcessed++;
          this.downloadAllProgress = 5 + Math.round((filesProcessed / totalFiles) * 65);
        }
      });

      await Promise.all(downloadPromises);

      // Update progress - compression starting
      this.downloadAllProgress = 75;

      // Generate the zip file
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        // Add a progress callback
        onUpdate: (metadata: JSZipMetadata) => {
          // Update from 75% to 95% during zip generation
          if (metadata.percent) {
            const zipProgress = Math.round(75 + metadata.percent * 0.2);
            this.downloadAllProgress = zipProgress;
          }
        },
      } as JSZipGeneratorOptionsWithCallback);

      // Update progress - almost done
      this.downloadAllProgress = 95;

      // Create download link
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = this.sanitizeFileName(`${this.moduleName}.zip`);
      document.body.appendChild(downloadLink);

      // Wait a moment to ensure UI updates
      setTimeout(() => {
        this.downloadAllProgress = 100;
        downloadLink.click();
        document.body.removeChild(downloadLink);
        console.log('Module download complete!');

        // Reset after a brief moment to show 100% completion
        setTimeout(() => {
          this.downloadingAll = false;
          this.downloadAllProgress = 0;
        }, 1000);
      }, 500);
    } catch (error) {
      console.error('Error creating module zip file:', error);
      this.downloadingAll = false;
      this.downloadAllProgress = 0;
    }
  }

  // File previewing methods
  previewFile(content: MoodleContent): void {
    if (!content.fileUrl) return;

    const fileType = this.filePreviewService.detectFileType(content.mimeType || '');

    this.filePreviewService.openPreview({
      url: content.fileUrl,
      name: content.name || 'File',
      mimeType: content.mimeType || '',
      fileType: fileType,
    });
  }

  // Check if a file can be previewed
  canPreviewFile(content: MoodleContent): boolean {
    if (!content.fileUrl) return false;

    const mimeType = content.mimeType || '';

    // File types that can be previewed
    return (
      mimeType.includes('pdf') ||
      mimeType.includes('text/') ||
      mimeType.includes('application/json') ||
      mimeType.includes('text/markdown') ||
      mimeType.endsWith('.md') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('officedocument') ||
      mimeType.includes('opendocument') ||
      mimeType.startsWith('image/')
    );
  }

  // Load course results
  loadCourseResults(): void {
    if (this.activeTabIndex !== 1) {
      return; // Only load when on the results tab
    }

    this.loadingResults = true;
    this.resultsError = '';

    this.moodleService.getCourseResults(this.moduleId).subscribe({
      next: results => {
        // First filter - keep non-categories, overall summary, and named categories
        const filteredResults = results.filter(result => {
          if (!result.isCategory) {
            return true;
          }

          if (result.isOverallSummary) {
            // Update the overall summary's name to be more descriptive
            result.name = `${this.moduleName} Overall Summary`;
            return true;
          }

          if (!result.name || result.name.trim() === '') {
            return false;
          }

          return true;
        });

        // Process items that might have lost their parent categories
        for (let i = 0; i < filteredResults.length; i++) {
          const item = filteredResults[i];

          // Skip categories and summary items
          if (item.isCategory || item.isCategorySummary || item.isOverallSummary) {
            continue;
          }

          // Check if this item's parent category exists in filtered results
          const parentExists = filteredResults.some(
            result => result.isCategory && result.id === item.categoryId
          );

          // If parent was filtered out, change this item's level to make it top-level
          if (!parentExists) {
            item.level = 1;
          }
        }

        // Assign the processed results
        this.results = filteredResults;
        this.loadingResults = false;
      },
      error: err => {
        this.resultsError = 'Failed to load course results. Please try again.';
        this.loadingResults = false;
        console.error('Error loading course results:', err);
      },
    });
  }

  // Handle tab changes
  onTabChange(event: any): void {
    this.activeTabIndex = event.index;
    if (event.index === 1) {
      this.loadCourseResults();
    }
  }

  // Toggle category expansion
  toggleCategoryExpansion(result: MoodleCourseResult): void {
    if (!result.isCategory) return;

    result.isExpanded = !result.isExpanded;
  }

  // Check if a result should be shown based on its parent's expansion state
  shouldShowResult(result: MoodleCourseResult, index: number): boolean {
    // Always show top-level items and overall summary
    if (result.level <= 1 || result.isOverallSummary) return true;

    // For nested items, try to find their parent category
    let parentFound = false;

    for (let i = index - 1; i >= 0; i--) {
      const potentialParent = this.results[i];

      // Found the immediate parent
      if (potentialParent.isCategory && result.categoryId === potentialParent.id) {
        parentFound = true;
        return potentialParent.isExpanded === true;
      }

      // If we reached a category with a lower level than our current item,
      // we've gone beyond the scope of potential parents
      if (potentialParent.isCategory && potentialParent.level < result.level - 1) {
        break;
      }
    }

    // If no parent found (possibly filtered out), show the item by default
    return !parentFound || true;
  }

  // Get indentation based on level for hierarchical display
  getIndentation(level: number): string {
    // Ensure level is at least 0 (for safety)
    const safeLevel = Math.max(0, level || 0);
    return `${safeLevel * 16}px`;
  }

  // Get icon for category/item
  getCategoryIcon(result: MoodleCourseResult): string {
    if (result.isOverallSummary) {
      return 'grade'; // Using 'grade' icon instead of 'star' to better represent overall score
    }

    if (result.isCategory) {
      if (!result.name || result.name.trim() === '') {
        return 'help_outline'; // Default icon for unnamed categories (should be filtered out)
      }
      return result.isExpanded ? 'folder_open' : 'folder';
    }

    if (result.isCategorySummary) {
      return 'summarize';
    }

    switch (result.itemType?.toLowerCase()) {
      case 'test':
        return 'quiz';
      case 'aufgabe':
        return 'assignment';
      case 'einfach gewichteter durchschnitt':
        return 'calculate';
      case 'summe':
        return 'functions';
      default:
        return 'description';
    }
  }

  // Get color for result status
  getStatusColor(status: string): string {
    switch (status) {
      case 'graded':
        return 'primary';
      case 'submitted':
        return 'accent';
      case 'notsubmitted':
      default:
        return 'warn';
    }
  }

  // Get label for result status
  getStatusLabel(status: string): string {
    switch (status) {
      case 'graded':
        return 'Graded';
      case 'submitted':
        return 'Submitted';
      case 'notsubmitted':
        return 'Not Submitted';
      default:
        return status;
    }
  }

  // Get row class based on result type
  getRowClass(result: MoodleCourseResult): string {
    if (result.isOverallSummary) return 'overall-summary-row';
    if (result.isCategorySummary) return 'category-summary-row';
    if (result.isCategory) return 'category-row';
    return '';
  }

  // Format number if it exists, otherwise return placeholder
  formatNumberOrPlaceholder(value: number | undefined, placeholder: string = '-'): string {
    return value !== undefined ? value.toString() : placeholder;
  }

  // Helper method to check if a value is NaN for use in the template
  isNaN(value: any): boolean {
    return Number.isNaN(value);
  }

  /**
   * Handles the unenroll button click with a double-click confirmation pattern
   */
  unenrollFromCourse(): void {
    // Don't allow unenrollment if already in progress
    if (this.unenrolling) return;

    // First click - enter confirmation state
    if (!this.confirmingUnenroll) {
      this.confirmingUnenroll = true;

      // Auto-reset after 3 seconds if the user doesn't confirm
      setTimeout(() => {
        this.confirmingUnenroll = false;
      }, 3000);

      return;
    }

    // Second click - proceed with unenrollment
    this.unenrolling = true;
    this.confirmingUnenroll = false;

    // Get the current site domain from the Moodle service
    const site = this.moodleService.getCurrentSite();

    if (!site || !site.domain) {
      this.snackBar.open('Unable to unenroll: site information not available', 'Close', {
        duration: 5000,
      });
      this.unenrolling = false;
      return;
    }

    // Since the API approach isn't working, we'll try several possible URLs for Moodle unenrollment
    // Note: Different Moodle versions and configurations use different URLs

    // Try redirecting to the enrollment management page first
    const unenrollOptions = [
      // Most common URL for self-unenrollment page
      `${site.domain}/enrol/index.php?id=${this.moduleId}`,
      // Try Moodle 3.9+ unenrollment link
      `${site.domain}/enrol/self/unenrolself.php?id=${this.moduleId}`,
      // Direct course page as fallback
      `${site.domain}/course/view.php?id=${this.moduleId}#section-0`,
    ];

    // Use the first option as the redirect URL
    const unenrollUrl = unenrollOptions[0];

    this.snackBar.open(`Redirecting to the enrollment page where you can unenroll`, 'Close', {
      duration: 3000,
    });

    // After showing the message, redirect to Moodle
    setTimeout(() => {
      // Navigate to the unenrollment page
      window.location.href = unenrollUrl;

      // Also handle the redirect back to our app once the user is done
      // Store some information in localStorage to help handle the return flow
      localStorage.setItem('unenrolling_course_id', this.moduleId.toString());
      localStorage.setItem('unenrolling_timestamp', Date.now().toString());
    }, 1000);
  }
}
