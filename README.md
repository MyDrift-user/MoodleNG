# MoodleNG

A custom Angular frontend for Moodle Learning Management System that provides a simplified and modern interface for students to access their courses and learning materials.

# ALPHA STATE

MoodleNG is currently in it's Alpha Stage. The current plan is to study the Moodle Documentation and how to handle it.
The Entire Project is currently spaghetti code, it is only there so that there is something working. My Focus is as said only the Moodle API **at the time**.

## Roadmap

- [x] Authenticate user & get token
- [x] Get User Courses
- [x] Get Course Content
- [x] Get Course Content details (about Quizes, Assignments, Files & more)
- [x] Understand how Quiz taking logic works (get Quiz ID, get attempts, start attempt, Get Attempt Info, Get Quiz Content, Finish Quiz, Rejoin quiz)
- [ ] Upload files
- [ ] Upload files & hand in assignments

- [ ] Refractor Backend -> Python + FastAPI
- [ ] Refractor Frontend -> Custom Frontend Design

## Features

- **Custom Login**: Connect to any Moodle instance by specifying the domain and your credentials
- **Course Dashboard**: View all your enrolled courses sorted by last accessed
- **Content Viewer**: Access course materials including text, files, images, and videos
  - **Previews**: Preview Office Files, PDFs, Images and more directly in your browser without downloading anything.
  - **Zip Download**: Instead of downloading every file of a course seperately let MoodleNG download all of them at once with a single Press of a button.
- **Responsive Design**: Works on desktop and mobile devices
- **Quizes & Assignments**: Take Quizes and hand in Assignments.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
