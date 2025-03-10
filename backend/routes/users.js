const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register/login user
router.post('/login', async (req, res) => {
  try {
    const { userId, name, userType, email } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ userId });
    
    if (user) {
      // Update last seen
      user.lastSeen = new Date();
      await user.save();
    } else {
      // Create new user
      user = new User({
        userId,
        name,
        userType,
        email
      });
      await user.save();
    }
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all students (fix: added route for singular "student" as well)
router.get('/type/students', async (req, res) => {
  try {
    const students = await User.find({ userType: 'student' })
      .sort({ name: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add route for singular "student" to match frontend request
router.get('/type/student', async (req, res) => {
  try {
    const students = await User.find({ userType: 'student' })
      .sort({ name: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shopkeeper
router.get('/type/shopkeeper', async (req, res) => {
  try {
    const shopkeeper = await User.findOne({ userType: 'shopkeeper' });
    res.json(shopkeeper || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;