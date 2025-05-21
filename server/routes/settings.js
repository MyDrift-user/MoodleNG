const express = require('express');
const router = express.Router();
const db = require('../db');

// Check if database service is available
router.get('/status', async (req, res) => {
  try {
    const result = await db.checkDbHealth();
    res.json({
      status: 'ok',
      dbAvailable: true,
      message: 'Database service is available'
    });
  } catch (err) {
    console.error('Database service unavailable:', err);
    res.status(503).json({
      status: 'error',
      dbAvailable: false,
      localStorageOnly: true,
      message: 'Database service unavailable, settings will be saved to local storage only'
    });
  }
});

// Get user settings
router.get('/theme/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { moodleUrl } = req.query;
    
    if (!username || !moodleUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and moodleUrl are required'
      });
    }
    
    const settings = await db.getUserSettings(username, moodleUrl);
    
    if (!settings) {
      return res.status(404).json({
        status: 'error',
        message: 'Settings not found'
      });
    }
    
    res.json({
      status: 'ok',
      data: settings
    });
  } catch (err) {
    console.error('Error retrieving settings:', err);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving settings',
      localStorageOnly: true
    });
  }
});

// Save user settings
router.post('/theme', async (req, res) => {
  try {
    const { username, moodleUrl, themeSettings } = req.body;
    
    if (!username || !moodleUrl || !themeSettings) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, moodleUrl, and themeSettings are required'
      });
    }
    
    const result = await db.saveUserSettings(username, moodleUrl, themeSettings);
    
    res.json({
      status: 'ok',
      message: 'Settings saved successfully',
      id: result.id
    });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({
      status: 'error',
      message: 'Error saving settings',
      localStorageOnly: true
    });
  }
});

// Delete user settings
router.delete('/theme/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { moodleUrl } = req.query;
    
    if (!username || !moodleUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and moodleUrl are required'
      });
    }
    
    const result = await db.deleteUserSettings(username, moodleUrl);
    
    if (!result.deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Settings not found or already deleted'
      });
    }
    
    res.json({
      status: 'ok',
      message: 'Settings deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting settings:', err);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting settings',
      localStorageOnly: true
    });
  }
});

module.exports = router; 