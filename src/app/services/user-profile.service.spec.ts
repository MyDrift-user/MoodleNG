import { TestBed } from '@angular/core/testing';
import { UserProfileService } from './user-profile.service';
import { MoodleUser } from '../models/moodle.models';

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate profile picture with default options', () => {
    const mockUser: MoodleUser = {
      id: 1,
      username: 'testuser',
      firstname: 'Test',
      lastname: 'User',
      fullname: 'Test User',
      email: 'test@example.com',
      profilePictureUrl: 'https://example.com/profile.jpg'
    };

    const result = service.getProfilePicture(mockUser);

    expect(result.imageUrl).toBe('https://example.com/profile.jpg');
    expect(result.altText).toBe('Picture of Test User');
    expect(result.cssClass).toBe('userpicture');
    expect(result.showFullName).toBe(false);
  });

  it('should use default avatar when no profile picture URL', () => {
    const mockUser: MoodleUser = {
      id: 1,
      username: 'testuser',
      firstname: 'Test',
      lastname: 'User',
      fullname: 'Test User',
      email: 'test@example.com'
    };

    const result = service.getProfilePicture(mockUser);

    expect(result.imageUrl).toContain('data:image/svg+xml;base64');
    expect(result.altText).toBe('Picture of Test User');
  });

  it('should include full name when requested', () => {
    const mockUser: MoodleUser = {
      id: 1,
      username: 'testuser',
      firstname: 'Test',
      lastname: 'User',
      fullname: 'Test User',
      email: 'test@example.com'
    };

    const result = service.getProfilePicture(mockUser, 'dashboard', {
      includefullname: true
    });

    expect(result.showFullName).toBe(true);
    expect(result.fullName).toBe('Test User');
  });

  it('should append token when requested', () => {
    const mockUser: MoodleUser = {
      id: 1,
      username: 'testuser',
      firstname: 'Test',
      lastname: 'User',
      fullname: 'Test User',
      email: 'test@example.com',
      profilePictureUrl: 'https://example.com/profile.jpg',
      token: 'test-token'
    };

    const result = service.getProfilePicture(mockUser, 'dashboard', {
      includetoken: true
    });

    expect(result.imageUrl).toBe('https://example.com/profile.jpg?token=test-token');
  });
}); 