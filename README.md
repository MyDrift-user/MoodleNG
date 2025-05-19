# MoodleNG

A custom Angular frontend for Moodle Learning Management System that provides a simplified and modern interface for students to access their courses and learning materials.

## Features

- **Custom Login**: Connect to any Moodle instance by specifying the domain and your credentials
- **Course Dashboard**: View all your enrolled courses sorted by last accessed
- **Content Viewer**: Access course materials including text, files, images, and videos
- **Responsive Design**: Works on desktop and mobile devices
- **Material Design**: Modern and intuitive user interface

## Getting Started

### Prerequisites

- Node.js (v20+)
- npm (v10+)
- A valid Moodle instance with API access enabled

### Prerequisites

- Node.js (v20+)
- npm (v10+)
- A valid Moodle instance with API access enabled

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/MoodleNG.git
   cd MoodleNG
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   
   Alternatively, use the proxy configuration to avoid CORS issues:
   ```bash
   npm run start:proxy
   ```
   Note: You'll need to update the `proxy.conf.json` file with your Moodle instance URL.

4. Open your browser and navigate to `http://localhost:4200`

## Building for Production

To create a production build:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Moodle API Requirements

This application requires the following Moodle Web Service APIs to be enabled on the target Moodle instance:

- `core_webservice_get_site_info`: To retrieve user and site information
- `core_enrol_get_users_courses`: To get the user's enrolled courses
- `core_course_get_contents`: To fetch course content

Make sure your Moodle administrator has enabled these services and has set up the mobile app service correctly.

## Architecture

The application follows a modular architecture with the following components:

- **Login Component**: Handles authentication with Moodle instances
- **Dashboard Component**: Lists all courses/modules sorted by last accessed
- **Module Details Component**: Displays module contents with specialized viewers for different content types

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
