const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection flag
let dbAvailable = false;

// Connect to PostgreSQL
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  // Test the connection
  pool.query('SELECT NOW()')
    .then(() => {
      console.log('PostgreSQL connection successful');
      dbAvailable = true;
      // Only initialize DB if connection is successful
      initDb();
    })
    .catch(err => {
      console.error('PostgreSQL connection failed:', err.message);
      console.log('Operating in local storage mode only');
      dbAvailable = false;
    });
} catch (err) {
  console.error('Error creating PostgreSQL pool:', err.message);
  console.log('Operating in local storage mode only');
  dbAvailable = false;
}

// Initialize database tables
async function initDb() {
  try {
    if (!dbAvailable) return;
    
    // Create theme settings table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_theme_settings (
        id SERIAL PRIMARY KEY,
        username_hash VARCHAR(64) NOT NULL UNIQUE,
        moodle_url_hash VARCHAR(64) NOT NULL,
        theme_settings JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Check if we need to migrate from old email_hash schema
    const columnCheckResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_theme_settings' AND column_name = 'email_hash';
    `);
    
    // If email_hash column exists, migrate data and drop the column
    if (columnCheckResult.rows.length > 0) {
      console.log('Migrating from email_hash to username_hash...');
      
      // Rename email_hash to username_hash if necessary
      await pool.query(`
        ALTER TABLE user_theme_settings 
        RENAME COLUMN email_hash TO username_hash;
      `);
      
      console.log('Migration completed successfully');
    }
    
    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database tables:', err);
    dbAvailable = false;
  }
}

// Hash sensitive data for privacy
function hashSensitiveData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Get theme settings by username
router.get('/theme/:usernameHash', async (req, res) => {
  try {
    if (!dbAvailable) {
      return res.status(503).json({ 
        message: 'Database service unavailable, using local storage only',
        localStorageOnly: true
      });
    }
    
    const { usernameHash } = req.params;
    
    const result = await pool.query(
      'SELECT theme_settings FROM user_theme_settings WHERE username_hash = $1',
      [usernameHash]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Theme settings not found' });
    }
    
    res.status(200).json({ themeSettings: result.rows[0].theme_settings });
  } catch (err) {
    console.error('Error fetching theme settings:', err);
    res.status(500).json({ 
      message: 'Server error, using local storage only',
      localStorageOnly: true 
    });
  }
});

// Save theme settings
router.post('/theme', async (req, res) => {
  try {
    if (!dbAvailable) {
      return res.status(503).json({ 
        message: 'Database service unavailable, using local storage only',
        localStorageOnly: true
      });
    }
    
    const { username, moodleUrl, themeSettings } = req.body;
    
    if (!username || !moodleUrl || !themeSettings) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Hash the username and moodleUrl for privacy
    const usernameHash = hashSensitiveData(username.toLowerCase());
    const moodleUrlHash = hashSensitiveData(moodleUrl.toLowerCase());
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM user_theme_settings WHERE username_hash = $1',
      [usernameHash]
    );
    
    if (existingUser.rows.length > 0) {
      // Update existing user's theme settings
      await pool.query(
        `UPDATE user_theme_settings 
         SET theme_settings = $1, moodle_url_hash = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE username_hash = $3`,
        [themeSettings, moodleUrlHash, usernameHash]
      );
    } else {
      // Insert new user's theme settings
      await pool.query(
        `INSERT INTO user_theme_settings 
         (username_hash, moodle_url_hash, theme_settings) 
         VALUES ($1, $2, $3)`,
        [usernameHash, moodleUrlHash, themeSettings]
      );
    }
    
    res.status(200).json({ message: 'Theme settings saved successfully' });
  } catch (err) {
    console.error('Error saving theme settings:', err);
    res.status(500).json({ 
      message: 'Server error, using local storage only',
      localStorageOnly: true 
    });
  }
});

// Delete theme settings
router.delete('/theme/:username', async (req, res) => {
  try {
    if (!dbAvailable) {
      return res.status(503).json({ 
        message: 'Database service unavailable, using local storage only',
        localStorageOnly: true
      });
    }
    
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    // Hash the username for privacy
    const usernameHash = hashSensitiveData(username.toLowerCase());
    
    // Delete the user's theme settings
    await pool.query(
      'DELETE FROM user_theme_settings WHERE username_hash = $1',
      [usernameHash]
    );
    
    res.status(200).json({ message: 'Theme settings deleted successfully' });
  } catch (err) {
    console.error('Error deleting theme settings:', err);
    res.status(500).json({ 
      message: 'Server error, using local storage only',
      localStorageOnly: true 
    });
  }
});

// Service status check endpoint
router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    dbAvailable: dbAvailable,
    localStorageOnly: !dbAvailable
  });
});

module.exports = router; 