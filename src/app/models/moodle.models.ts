export interface MoodleUser {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    fullname: string;
    email: string;
    token?: string;
}

export interface MoodleSite {
    domain: string;
    sitename?: string;
    logo?: string;
}

export interface MoodleModule {
    id: number;
    name: string;
    description?: string;
    visible: boolean;
    summary?: string;
    lastAccess?: Date;
    courseId: number;
    courseName?: string;
}

export interface MoodleContent {
    id: number;
    name: string;
    type: string; // 'file', 'text', 'url', 'video', etc.
    content?: string; // For text content
    fileUrl?: string; // For files, videos, etc.
    mimeType?: string; // For files
    timeCreated?: Date;
    timeModified?: Date;
    moduleId: number;
}

export interface MoodleLoginResponse {
    token: string;
    privatetoken?: string;
    error?: string;
    errorcode?: string;
}
