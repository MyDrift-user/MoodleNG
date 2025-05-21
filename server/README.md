# MoodleNG Server

This is the backend implementation for the MoodleNG application, focusing on storing user settings across devices.

## Features

- User settings storage (theme preferences)
- Cross-device synchronization
- Privacy controls (opt-in/opt-out for data storage)

## Setup

1. Make sure you have Node.js installed (v14+ recommended)
2. Install dependencies:
   ```
   npm install
   ```
3. Run the server:
   ```
   npm run server
   ```
   
Or run both the frontend and backend together:
```
npm run dev
```

## API Endpoints

### Settings API

- `GET /api/settings/status` - Check if database service is available
- `GET /api/settings/theme/:username?moodleUrl=url` - Get user's theme settings
- `POST /api/settings/theme` - Save user's theme settings
- `DELETE /api/settings/theme/:username?moodleUrl=url` - Delete user's theme settings

## Database

The application uses SQLite for simplicity. The database file is stored in `server/db/data/settings.db`.

## Implementation Details

### User Identity

- User settings are identified by a combination of username and Moodle URL
- When a user logs in, the system checks if there are existing settings for that user
- Settings are only saved to the server if the user explicitly enables this feature

### Privacy

- Users can opt-out of server-side storage at any time
- "Delete My Data" button permanently removes all user data from the server
- Settings are only applied automatically if the user previously enabled server-side storage

## Folder Structure

```
server/
  ├── db/               # Database implementation
  │   └── data/         # Database files
  ├── logs/             # Server logs
  ├── routes/           # API routes
  ├── uploads/          # File uploads directory
  └── index.js          # Main server file
``` 