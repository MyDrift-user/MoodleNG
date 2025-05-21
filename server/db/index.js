const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create db directory if it doesn't exist
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'settings.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create user settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          moodle_url TEXT NOT NULL,
          theme_settings TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(username, moodle_url)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating user_settings table:', err);
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  });
};

// Get user settings by username and moodle URL
const getUserSettings = (username, moodleUrl) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM user_settings WHERE username = ? AND moodle_url = ?',
      [username, moodleUrl],
      (err, row) => {
        if (err) {
          console.error('Error getting user settings:', err);
          reject(err);
        } else {
          if (row && row.theme_settings) {
            try {
              row.theme_settings = JSON.parse(row.theme_settings);
            } catch (e) {
              console.error('Error parsing theme settings:', e);
            }
          }
          resolve(row);
        }
      }
    );
  });
};

// Save user settings
const saveUserSettings = (username, moodleUrl, themeSettings) => {
  return new Promise((resolve, reject) => {
    // Convert theme settings to JSON string
    const themeSettingsJson = JSON.stringify(themeSettings);
    
    // Use INSERT OR REPLACE to handle both new and existing records
    db.run(
      `INSERT OR REPLACE INTO user_settings 
       (username, moodle_url, theme_settings, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [username, moodleUrl, themeSettingsJson],
      function(err) {
        if (err) {
          console.error('Error saving user settings:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      }
    );
  });
};

// Delete user settings
const deleteUserSettings = (username, moodleUrl) => {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM user_settings WHERE username = ? AND moodle_url = ?',
      [username, moodleUrl],
      function(err) {
        if (err) {
          console.error('Error deleting user settings:', err);
          reject(err);
        } else {
          resolve({ deleted: this.changes > 0 });
        }
      }
    );
  });
};

// Check database health
const checkDbHealth = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1', (err, row) => {
      if (err) {
        console.error('Database health check failed:', err);
        reject(err);
      } else {
        resolve({ healthy: true });
      }
    });
  });
};

module.exports = {
  initDb,
  getUserSettings,
  saveUserSettings,
  deleteUserSettings,
  checkDbHealth
}; 