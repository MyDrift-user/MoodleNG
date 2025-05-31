import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl, SafeResourceUrl } from '@angular/platform-browser';

export interface SanitizationOptions {
  allowBasicHtml?: boolean;
  allowImages?: boolean;
  allowLinks?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SanitizationService {
  // Regex patterns for validation and sanitization
  private readonly EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private readonly URL_PATTERN = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
  private readonly MOODLE_URL_PATTERN = /^https?:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9]+(:[0-9]+)?(\/.*)?$/;
  private readonly USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
  private readonly PHONE_PATTERN = /^[\+]?[1-9][\d]{0,15}$/;
  
  // Dangerous HTML tags and attributes
  private readonly DANGEROUS_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select',
    'button', 'link', 'style', 'meta', 'base', 'applet', 'frameset', 'frame'
  ];
  
  private readonly DANGEROUS_ATTRIBUTES = [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown',
    'onkeyup', 'onkeypress', 'onchange', 'onsubmit', 'onfocus', 'onblur',
    'javascript:', 'vbscript:', 'data:', 'about:'
  ];

  // Safe HTML tags for basic formatting
  private readonly SAFE_BASIC_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div'];
  private readonly SAFE_EXTENDED_TAGS = [...this.SAFE_BASIC_TAGS, 'a', 'img', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  constructor(private domSanitizer: DomSanitizer) {}

  /**
   * Sanitize plain text input by removing dangerous characters and scripts
   */
  sanitizeText(input: string, options: SanitizationOptions = {}): string {
    if (!input) return '';

    let sanitized = input;

    // Trim whitespace if requested
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove javascript: and other dangerous protocols
    sanitized = sanitized.replace(/(javascript|vbscript|data|about):/gi, '');

    // Remove HTML entities that could be dangerous
    sanitized = sanitized.replace(/&[#x]?[0-9a-f]+;?/gi, (match) => {
      const dangerous = ['&#60;', '&#x3C;', '&lt;', '&#62;', '&#x3E;', '&gt;'];
      return dangerous.includes(match.toLowerCase()) ? '' : match;
    });

    // Apply length limit if specified
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize HTML content while preserving safe formatting
   */
  sanitizeHtml(input: string, options: SanitizationOptions = {}): string {
    if (!input) return '';

    let sanitized = input;

    // First apply basic text sanitization
    sanitized = this.sanitizeText(sanitized, { ...options, trimWhitespace: false });

    // Remove dangerous tags
    this.DANGEROUS_TAGS.forEach(tag => {
      const regex = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    // Remove dangerous attributes from all tags
    sanitized = sanitized.replace(/<([^>]+)>/gi, (match, tagContent) => {
      let cleanTag = tagContent;
      
      this.DANGEROUS_ATTRIBUTES.forEach(attr => {
        const attrRegex = new RegExp(`\\s+${attr}\\s*=\\s*[^\\s>]*`, 'gi');
        cleanTag = cleanTag.replace(attrRegex, '');
      });

      return `<${cleanTag}>`;
    });

    // If only basic HTML is allowed, remove advanced tags
    if (!options.allowImages || !options.allowLinks) {
      const allowedTags = options.allowBasicHtml ? this.SAFE_BASIC_TAGS : [];
      
      if (!options.allowImages) {
        sanitized = sanitized.replace(/<img\b[^>]*>/gi, '[Image removed]');
      }
      
      if (!options.allowLinks) {
        sanitized = sanitized.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');
      }

      // Remove any tags not in the allowed list
      if (allowedTags.length > 0) {
        const allowedPattern = allowedTags.join('|');
        const tagRegex = new RegExp(`<(?!\\/?(${allowedPattern})\\b)[^>]+>`, 'gi');
        sanitized = sanitized.replace(tagRegex, '');
      }
    }

    return sanitized;
  }

  /**
   * Sanitize and validate URLs
   */
  sanitizeUrl(url: string): string {
    if (!url) return '';

    let sanitized = url.trim();

    // Remove dangerous protocols
    sanitized = sanitized.replace(/^(javascript|vbscript|data|about):/i, '');

    // Ensure HTTP/HTTPS protocol
    if (!/^https?:\/\//i.test(sanitized) && sanitized.length > 0) {
      sanitized = `https://${sanitized}`;
    }

    return sanitized;
  }

  /**
   * Sanitize email addresses
   */
  sanitizeEmail(email: string): string {
    if (!email) return '';
    
    return email.trim().toLowerCase();
  }

  /**
   * Sanitize username (remove special characters except allowed ones)
   */
  sanitizeUsername(username: string): string {
    if (!username) return '';
    
    // Allow only alphanumeric, dots, underscores, and hyphens
    return username.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  }

  /**
   * Sanitize phone numbers
   */
  sanitizePhone(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digit characters except + at the beginning
    return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    return this.EMAIL_PATTERN.test(email);
  }

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    return this.URL_PATTERN.test(url);
  }

  /**
   * Validate Moodle URL format
   */
  isValidMoodleUrl(url: string): boolean {
    return this.MOODLE_URL_PATTERN.test(url);
  }

  /**
   * Validate username format
   */
  isValidUsername(username: string): boolean {
    return this.USERNAME_PATTERN.test(username) && username.length >= 3 && username.length <= 50;
  }

  /**
   * Validate phone number format
   */
  isValidPhone(phone: string): boolean {
    return this.PHONE_PATTERN.test(phone);
  }

  /**
   * Check if string contains potentially dangerous content
   */
  containsDangerousContent(input: string): boolean {
    if (!input) return false;

    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /data:/i,
      /&#x/i
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Create safe HTML for Angular templates
   */
  createSafeHtml(html: string, options: SanitizationOptions = {}): SafeHtml {
    const sanitized = this.sanitizeHtml(html, options);
    return this.domSanitizer.bypassSecurityTrustHtml(sanitized);
  }

  /**
   * Create safe URL for Angular templates
   */
  createSafeUrl(url: string): SafeUrl {
    const sanitized = this.sanitizeUrl(url);
    return this.domSanitizer.bypassSecurityTrustUrl(sanitized);
  }

  /**
   * Create safe resource URL for Angular templates (for iframes, etc.)
   */
  createSafeResourceUrl(url: string): SafeResourceUrl {
    const sanitized = this.sanitizeUrl(url);
    return this.domSanitizer.bypassSecurityTrustResourceUrl(sanitized);
  }

  /**
   * Sanitize object properties recursively
   */
  sanitizeObject<T extends Record<string, any>>(obj: T, options: SanitizationOptions = {}): T {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = { ...obj } as any;

    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeText(value, options);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' 
            ? this.sanitizeText(item, options)
            : typeof item === 'object' 
              ? this.sanitizeObject(item, options)
              : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, options);
      }
    }

    return sanitized as T;
  }

  /**
   * Remove excess whitespace and normalize line endings
   */
  normalizeWhitespace(input: string): string {
    if (!input) return '';
    
    return input
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Convert remaining \r to \n
      .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
      .replace(/[ \t]+/g, ' ')     // Collapse multiple spaces/tabs
      .trim();
  }

  /**
   * Escape HTML entities for safe display
   */
  escapeHtml(input: string): string {
    if (!input) return '';
    
    const entityMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };

    return input.replace(/[&<>"'\/]/g, (char) => entityMap[char]);
  }

  /**
   * Validate content length and provide truncation
   */
  validateAndTruncate(input: string, maxLength: number, suffix: string = '...'): string {
    if (!input) return '';
    
    if (input.length <= maxLength) return input;
    
    return input.substring(0, maxLength - suffix.length) + suffix;
  }
} 