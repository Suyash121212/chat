const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get conversation between two users
router.get('/conversation', async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    
    if (!user1 || !user2) {
      return res.status(400).json({ message: 'Both user IDs are required' });
    }
    
    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    }).sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all conversations for shopkeeper
router.get('/shopkeeper/:shopkeeperId', async (req, res) => {
  try {
    const { shopkeeperId } = req.params;
    
    // Find all unique students who messaged the shopkeeper
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: shopkeeperId },
            { recipient: shopkeeperId }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", shopkeeperId] },
              "$recipient",
              "$sender"
            ]
          },
          lastMessage: { $last: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$recipient", shopkeeperId] },
                  { $eq: ["$read", false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { "lastMessage.timestamp": -1 }
      }
    ]);
    
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark messages as read
router.put('/read', async (req, res) => {
  try {
    const { sender, recipient } = req.body;
    
    await Message.updateMany(
      { sender, recipient, read: false },
      { $set: { read: true } }
    );
    
    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;