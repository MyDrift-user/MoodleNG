import { Injectable } from '@angular/core';
import { MoodleUser } from '../models/moodle.models';

export interface ProfilePictureOptions {
  courseid?: number;
  size?: number;
  link?: boolean;
  popup?: boolean;
  alttext?: boolean;
  class?: string;
  visibletoscreenreaders?: boolean;
  includefullname?: boolean;
  includetoken?: boolean;
}

export interface ProfilePictureResult {
  imageUrl: string;
  altText: string;
  cssClass: string;
  showFullName: boolean;
  fullName?: string;
  linkUrl?: string;
  shouldOpenInPopup: boolean;
  isVisibleToScreenReaders: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {

  constructor() { }

  /**
   * Generate user profile picture configuration based on Moodle's core_user::get_profile_picture API
   * @param user The person to get details of
   * @param context The context (for now we'll use a simple string, but in full Moodle this would be a context object)
   * @param options Display options to be overridden
   * @returns ProfilePictureResult with all the necessary data for rendering
   */
  getProfilePicture(user: MoodleUser, context: string = 'dashboard', options: ProfilePictureOptions = {}): ProfilePictureResult {
    console.log('UserProfileService: getProfilePicture called with:', { user, context, options });
    
    // Set defaults based on Moodle's API
    const defaultOptions: Required<ProfilePictureOptions> = {
      courseid: 0,
      size: 35,
      link: true,
      popup: false,
      alttext: true,
      class: 'userpicture',
      visibletoscreenreaders: true,
      includefullname: false,
      includetoken: false
    };

    // Merge provided options with defaults
    const finalOptions = { ...defaultOptions, ...options };
    console.log('UserProfileService: Final options:', finalOptions);

    // Determine the image URL
    let imageUrl = user.profilePictureUrl || '';
    console.log('UserProfileService: Initial image URL:', imageUrl);
    
    // Moodle profile picture logic: if user has no profile picture URL or it's empty, use default
    if (!imageUrl || imageUrl.trim() === '') {
      console.log('UserProfileService: No profile picture URL found, using default avatar');
      imageUrl = this.getDefaultAvatarUrl();
    } else {
      console.log('UserProfileService: Using Moodle profile picture URL:', imageUrl);
      
      // Add token to Moodle URLs if requested and user has a token
      if (finalOptions.includetoken && user.token) {
        imageUrl = this.appendTokenToUrl(imageUrl, user.token);
        console.log('UserProfileService: Added token to URL:', imageUrl);
      }
    }

    // Generate alt text
    let altText = '';
    if (finalOptions.alttext) {
      altText = `Picture of ${user.fullname || user.username}`;
    }

    // Generate CSS class
    const cssClass = finalOptions.class;

    // Determine link URL (simplified - in full Moodle this would be based on context and permissions)
    let linkUrl = '';
    if (finalOptions.link) {
      // In a real Moodle implementation, this would generate a proper profile URL
      // For now, we'll use a placeholder or the current site's user profile URL structure
      linkUrl = this.generateProfileUrl(user, context, finalOptions.courseid);
    }

    const result = {
      imageUrl,
      altText,
      cssClass,
      showFullName: finalOptions.includefullname,
      fullName: finalOptions.includefullname ? user.fullname : undefined,
      linkUrl: finalOptions.link ? linkUrl : '',
      shouldOpenInPopup: finalOptions.popup,
      isVisibleToScreenReaders: finalOptions.visibletoscreenreaders
    };

    console.log('UserProfileService: Returning result:', result);
    return result;
  }

  /**
   * Generate a profile URL for the user
   * This is a simplified version of core_user::get_profile_url
   */
  getProfileUrl(user: MoodleUser, context: string = 'dashboard'): string {
    return this.generateProfileUrl(user, context);
  }

  /**
   * Get the full name with proper formatting
   * This is a simplified version of core_user::get_fullname
   */
  getFullName(user: MoodleUser, context: string = 'dashboard', options: { override?: boolean } = {}): string {
    // In a full Moodle implementation, this would check forced firstname/lastname settings
    // For now, we'll return the fullname or construct it from first/last name
    if (options.override) {
      return `${user.firstname} ${user.lastname}`.trim();
    }
    return user.fullname || `${user.firstname} ${user.lastname}`.trim();
  }

  /**
   * Generate default avatar URL when user has no profile picture
   */
  private getDefaultAvatarUrl(): string {
    // In a real implementation, this might be a configurable default avatar
    // For now, we'll return a data URL for a simple SVG avatar
    return 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill="#e0e0e0"/>
        <circle cx="50" cy="35" r="15" fill="#9e9e9e"/>
        <path d="M50 55 C35 55, 25 65, 25 80 L75 80 C75 65, 65 55, 50 55 Z" fill="#9e9e9e"/>
      </svg>
    `);
  }

  /**
   * Append authentication token to URL if needed
   */
  private appendTokenToUrl(url: string, token: string): string {
    if (!url || !token) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  /**
   * Generate profile URL for user
   */
  private generateProfileUrl(user: MoodleUser, context: string, courseid?: number): string {
    // In a real Moodle implementation, this would generate proper profile URLs
    // For now, we'll return an empty string or a placeholder
    // This could be enhanced to link to a user profile page in the application
    return '#'; // Placeholder for profile link
  }
} 