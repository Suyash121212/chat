const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['student', 'shopkeeper'],
    required: true
  },
  email: {
    type: String,
    required: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);