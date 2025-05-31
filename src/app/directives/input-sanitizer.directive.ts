import { Directive, ElementRef, HostListener, Input, OnInit } from '@angular/core';
import { NgControl } from '@angular/forms';
import { SanitizationService, SanitizationOptions } from '../services/sanitization.service';

@Directive({
  selector: '[appSanitizeInput]',
  standalone: true,
})
export class InputSanitizerDirective implements OnInit {
  @Input() sanitizeOptions: SanitizationOptions = {};
  @Input() sanitizeOnBlur: boolean = true;
  @Input() sanitizeOnInput: boolean = false;

  constructor(
    private el: ElementRef,
    private ngControl: NgControl,
    private sanitizationService: SanitizationService
  ) {}

  ngOnInit(): void {
    // Set default options
    this.sanitizeOptions = {
      trimWhitespace: true,
      allowBasicHtml: false,
      allowImages: false,
      allowLinks: false,
      ...this.sanitizeOptions
    };
  }

  @HostListener('blur', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBlur(_event: Event): void {
    if (this.sanitizeOnBlur) {
      this.sanitizeInput();
    }
  }

  @HostListener('input', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onInput(_event: Event): void {
    if (this.sanitizeOnInput) {
      // For real-time sanitization, be more conservative
      const conservativeOptions = {
        ...this.sanitizeOptions,
        allowBasicHtml: false,
        allowImages: false,
        allowLinks: false
      };
      this.sanitizeInput(conservativeOptions);
    }
  }

  private sanitizeInput(options?: SanitizationOptions): void {
    const element = this.el.nativeElement;
    const currentValue = element.value;

    if (!currentValue) return;

    const sanitizedValue = this.sanitizationService.sanitizeText(
      currentValue, 
      options || this.sanitizeOptions
    );

    if (sanitizedValue !== currentValue) {
      // Update the input value
      element.value = sanitizedValue;

      // Update the form control if available
      if (this.ngControl && this.ngControl.control) {
        this.ngControl.control.setValue(sanitizedValue);
      }

      // Trigger input event to notify Angular of the change
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

@Directive({
  selector: '[appSanitizeUrl]',
  standalone: true,
})
export class UrlSanitizerDirective {
  constructor(
    private el: ElementRef,
    private ngControl: NgControl,
    private sanitizationService: SanitizationService
  ) {}

  @HostListener('blur', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBlur(_event: Event): void {
    this.sanitizeUrl();
  }

  private sanitizeUrl(): void {
    const element = this.el.nativeElement;
    const currentValue = element.value;

    if (!currentValue) return;

    const sanitizedValue = this.sanitizationService.sanitizeUrl(currentValue);

    if (sanitizedValue !== currentValue) {
      element.value = sanitizedValue;

      if (this.ngControl && this.ngControl.control) {
        this.ngControl.control.setValue(sanitizedValue);
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

@Directive({
  selector: '[appSanitizeEmail]',
  standalone: true,
})
export class EmailSanitizerDirective {
  constructor(
    private el: ElementRef,
    private ngControl: NgControl,
    private sanitizationService: SanitizationService
  ) {}

  @HostListener('blur', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBlur(_event: Event): void {
    this.sanitizeEmail();
  }

  private sanitizeEmail(): void {
    const element = this.el.nativeElement;
    const currentValue = element.value;

    if (!currentValue) return;

    const sanitizedValue = this.sanitizationService.sanitizeEmail(currentValue);

    if (sanitizedValue !== currentValue) {
      element.value = sanitizedValue;

      if (this.ngControl && this.ngControl.control) {
        this.ngControl.control.setValue(sanitizedValue);
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

@Directive({
  selector: '[appSanitizeUsername]',
  standalone: true,
})
export class UsernameSanitizerDirective {
  constructor(
    private el: ElementRef,
    private ngControl: NgControl,
    private sanitizationService: SanitizationService
  ) {}

  @HostListener('input', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onInput(_event: Event): void {
    // Real-time sanitization for usernames to prevent invalid characters
    this.sanitizeUsername();
  }

  private sanitizeUsername(): void {
    const element = this.el.nativeElement;
    const currentValue = element.value;

    if (!currentValue) return;

    const sanitizedValue = this.sanitizationService.sanitizeUsername(currentValue);

    if (sanitizedValue !== currentValue) {
      // Get cursor position before changing value
      const cursorPosition = element.selectionStart;

      element.value = sanitizedValue;

      if (this.ngControl && this.ngControl.control) {
        this.ngControl.control.setValue(sanitizedValue);
      }

      // Restore cursor position (accounting for removed characters)
      const lengthDiff = currentValue.length - sanitizedValue.length;
      const newPosition = Math.max(0, cursorPosition - lengthDiff);
      element.setSelectionRange(newPosition, newPosition);

      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

@Directive({
  selector: '[appSanitizePhone]',
  standalone: true,
})
export class PhoneSanitizerDirective {
  constructor(
    private el: ElementRef,
    private ngControl: NgControl,
    private sanitizationService: SanitizationService
  ) {}

  @HostListener('input', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onInput(_event: Event): void {
    this.sanitizePhone();
  }

  private sanitizePhone(): void {
    const element = this.el.nativeElement;
    const currentValue = element.value;

    if (!currentValue) return;

    const sanitizedValue = this.sanitizationService.sanitizePhone(currentValue);

    if (sanitizedValue !== currentValue) {
      const cursorPosition = element.selectionStart;

      element.value = sanitizedValue;

      if (this.ngControl && this.ngControl.control) {
        this.ngControl.control.setValue(sanitizedValue);
      }

      // Restore cursor position
      const lengthDiff = currentValue.length - sanitizedValue.length;
      const newPosition = Math.max(0, cursorPosition - lengthDiff);
      element.setSelectionRange(newPosition, newPosition);

      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

@Directive({
  selector: '[appPreventDangerousInput]',
  standalone: true,
})
export class PreventDangerousInputDirective {
  constructor(
    private el: ElementRef,
    private sanitizationService: SanitizationService
  ) {}

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    
    const pastedText = event.clipboardData?.getData('text') || '';
    
    if (this.sanitizationService.containsDangerousContent(pastedText)) {
      // Show warning and sanitize
      const sanitizedText = this.sanitizationService.sanitizeText(pastedText);
      this.insertText(sanitizedText);
      
      // You could show a notification here
      console.warn('Dangerous content detected in paste operation and was sanitized');
    } else {
      this.insertText(pastedText);
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Prevent common XSS injection attempts
    if (event.ctrlKey || event.metaKey) {
      const dangerousKeys = ['u', 'shift+i']; // View source, developer tools
      const keyCombo = event.shiftKey ? `shift+${event.key.toLowerCase()}` : event.key.toLowerCase();
      
      if (dangerousKeys.includes(keyCombo)) {
        // Allow these as they're legitimate user actions
        return;
      }
    }

    // Block script injection attempts
    const input = event.key;
    if (input === '<' && this.isScriptAttempt()) {
      event.preventDefault();
      console.warn('Potential script injection attempt blocked');
    }
  }

  private insertText(text: string): void {
    const element = this.el.nativeElement;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const currentValue = element.value;

    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    element.value = newValue;

    // Set cursor position after inserted text
    const newPosition = start + text.length;
    element.setSelectionRange(newPosition, newPosition);

    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private isScriptAttempt(): boolean {
    const element = this.el.nativeElement;
    const currentValue = element.value;
    const cursorPosition = element.selectionStart;

    // Look for script-like patterns near cursor
    const beforeCursor = currentValue.substring(Math.max(0, cursorPosition - 10), cursorPosition);
    const afterCursor = currentValue.substring(cursorPosition, Math.min(currentValue.length, cursorPosition + 10));

    const combined = beforeCursor + '<' + afterCursor;
    
    return /script|iframe|object|embed/i.test(combined);
  }
}

@Directive({
  selector: '[appMaxLength]',
  standalone: true,
})
export class MaxLengthDirective {
  @Input() appMaxLength!: number;
  @Input() showWarning: boolean = true;
  @Input() warningThreshold: number = 0.9; // Show warning at 90% of max length

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const element = this.el.nativeElement;
    const currentLength = element.value.length;

    if (currentLength > this.appMaxLength) {
      // Truncate to max length
      element.value = element.value.substring(0, this.appMaxLength);
      
      // Prevent further input
      event.preventDefault();
      
      // Trigger input event for the truncated value
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (this.showWarning && currentLength > this.appMaxLength * this.warningThreshold) {
      // Show visual warning (you could add CSS class here)
      element.classList.add('approaching-limit');
    } else {
      element.classList.remove('approaching-limit');
    }
  }
} 