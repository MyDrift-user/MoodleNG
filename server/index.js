const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');

// Import database module
const db = require('./db');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' })
}));

// Serve static files from Angular app - path matches Docker file copy destination
app.use(express.static(path.join(__dirname, '../dist')));

// Define API routes
app.use('/api/settings', require('./routes/settings'));

// Catch-all route to serve Angular app for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Initialize database before starting server
db.initDb()
  .then(() => {
    // Start server after database initialization
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    console.log('Starting server without database support...');
    
    // Start server even if database initialization fails
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (without database support)`);
    });
  }); 