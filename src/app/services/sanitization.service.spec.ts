import { TestBed } from '@angular/core/testing';
import { SanitizationService } from './sanitization.service';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SanitizationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Text Sanitization', () => {
    it('should sanitize XSS attempts', () => {
      const maliciousText = '<script>alert("xss")</script>Hello';
      const sanitized = service.sanitizeText(maliciousText);
      expect(sanitized).toBe('Hello');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove dangerous HTML tags', () => {
      const dangerousText = '<iframe src="evil.com"></iframe>Safe text<object></object>';
      const sanitized = service.sanitizeText(dangerousText);
      expect(sanitized).toBe('Safe text');
    });

    it('should preserve safe text', () => {
      const safeText = 'This is a safe text with numbers 123 and symbols !@#';
      const sanitized = service.sanitizeText(safeText);
      expect(sanitized).toBe(safeText);
    });

    it('should handle empty and null values', () => {
      expect(service.sanitizeText('')).toBe('');
      expect(service.sanitizeText(null as any)).toBe('');
      expect(service.sanitizeText(undefined as any)).toBe('');
    });
  });

  describe('HTML Sanitization', () => {
    it('should allow safe HTML tags', () => {
      const safeHtml = '<p>Hello <strong>world</strong></p>';
      const sanitized = service.sanitizeHtml(safeHtml);
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
    });

    it('should remove dangerous HTML tags', () => {
      const dangerousHtml = '<p>Safe</p><script>alert("xss")</script><iframe src="evil.com"></iframe>';
      const sanitized = service.sanitizeHtml(dangerousHtml);
      expect(sanitized).toContain('<p>Safe</p>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe>');
    });

    it('should remove dangerous attributes', () => {
      const htmlWithDangerousAttrs = '<p onclick="alert(1)" onmouseover="steal()">Text</p>';
      const sanitized = service.sanitizeHtml(htmlWithDangerousAttrs);
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onmouseover');
      expect(sanitized).toContain('Text');
    });
  });

  describe('URL Sanitization', () => {
    it('should allow safe URLs', () => {
      const safeUrls = [
        'https://example.com',
        'http://localhost:3000',
        'ftp://files.example.com',
        'mailto:test@example.com'
      ];

      safeUrls.forEach(url => {
        const sanitized = service.sanitizeUrl(url);
        expect(sanitized).toBe(url);
      });
    });

    it('should block dangerous URLs', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd'
      ];

      dangerousUrls.forEach(url => {
        const sanitized = service.sanitizeUrl(url);
        expect(sanitized).toBe('about:blank');
      });
    });

    it('should handle malformed URLs', () => {
      expect(service.sanitizeUrl('not-a-url')).toBe('about:blank');
      expect(service.sanitizeUrl('')).toBe('about:blank');
      expect(service.sanitizeUrl(null as any)).toBe('about:blank');
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(service.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(service.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('Username Validation', () => {
    it('should validate correct usernames', () => {
      const validUsernames = [
        'user123',
        'test_user',
        'user-name',
        'User.Name',
        'validuser'
      ];

      validUsernames.forEach(username => {
        expect(service.isValidUsername(username)).toBe(true);
      });
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        'ab', // too short
        'a'.repeat(51), // too long
        'user@domain', // invalid character
        'user space', // space
        '<script>', // dangerous content
        ''
      ];

      invalidUsernames.forEach(username => {
        expect(service.isValidUsername(username)).toBe(false);
      });
    });
  });

  describe('Phone Validation', () => {
    it('should validate correct phone formats', () => {
      const validPhones = [
        '+1234567890',
        '+1-234-567-8900',
        '+44 20 7946 0958',
        '(123) 456-7890',
        '123-456-7890'
      ];

      validPhones.forEach(phone => {
        expect(service.isValidPhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone formats', () => {
      const invalidPhones = [
        '123', // too short
        'abc-def-ghij', // letters
        '+1234567890123456', // too long
        ''
      ];

      invalidPhones.forEach(phone => {
        expect(service.isValidPhone(phone)).toBe(false);
      });
    });
  });

  describe('Dangerous Content Detection', () => {
    it('should detect script tags', () => {
      expect(service.containsDangerousContent('<script>alert(1)</script>')).toBe(true);
      expect(service.containsDangerousContent('safe text')).toBe(false);
    });

    it('should detect event handlers', () => {
      expect(service.containsDangerousContent('onclick="alert(1)"')).toBe(true);
      expect(service.containsDangerousContent('onload="steal()"')).toBe(true);
      expect(service.containsDangerousContent('normal text')).toBe(false);
    });

    it('should detect dangerous protocols', () => {
      expect(service.containsDangerousContent('javascript:alert(1)')).toBe(true);
      expect(service.containsDangerousContent('data:text/html')).toBe(true);
      expect(service.containsDangerousContent('https://safe.com')).toBe(false);
    });
  });

  describe('Object Sanitization', () => {
    it('should sanitize nested objects', () => {
      const dirtyObject = {
        name: '<script>alert(1)</script>John',
        email: 'john@example.com',
        bio: '<p onclick="steal()">Safe bio</p>',
        nested: {
          value: '<iframe src="evil.com"></iframe>Clean'
        }
      };

      const sanitized = service.sanitizeObject(dirtyObject);
      expect(sanitized.name).toBe('John');
      expect(sanitized.email).toBe('john@example.com');
      expect(sanitized.bio).not.toContain('onclick');
      expect(sanitized.nested.value).toBe('Clean');
    });

    it('should handle arrays in objects', () => {
      const objectWithArray = {
        tags: ['<script>evil</script>tag1', 'safe-tag', '<iframe>bad</iframe>tag2']
      };

      const sanitized = service.sanitizeObject(objectWithArray);
      expect(sanitized.tags[0]).toBe('tag1');
      expect(sanitized.tags[1]).toBe('safe-tag');
      expect(sanitized.tags[2]).toBe('tag2');
    });

    it('should preserve non-string values', () => {
      const mixedObject = {
        string: '<script>alert(1)</script>text',
        number: 123,
        boolean: true,
        nullValue: null,
        date: new Date('2023-01-01')
      };

      const sanitized = service.sanitizeObject(mixedObject);
      expect(sanitized.string).toBe('text');
      expect(sanitized.number).toBe(123);
      expect(sanitized.boolean).toBe(true);
      expect(sanitized.nullValue).toBe(null);
      expect(sanitized.date).toEqual(new Date('2023-01-01'));
    });
  });

  describe('Moodle URL Validation', () => {
    it('should validate Moodle URLs', () => {
      const validMoodleUrls = [
        'https://moodle.example.com',
        'http://localhost/moodle',
        'https://learn.university.edu/moodle'
      ];

      validMoodleUrls.forEach(url => {
        expect(service.isValidMoodleUrl(url)).toBe(true);
      });
    });

    it('should reject invalid Moodle URLs', () => {
      const invalidUrls = [
        'ftp://moodle.com',
        'javascript:alert(1)',
        'not-a-url',
        ''
      ];

      invalidUrls.forEach(url => {
        expect(service.isValidMoodleUrl(url)).toBe(false);
      });
    });
  });
}); 