const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/shopChat', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB', err));

// Routes
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Store online users
const onlineUsers = {};

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected: ' + socket.id);
  
  // User login
  socket.on('login', async (userData) => {
    try {
      const { userId, userType } = userData;
      
      // Store socket id with user
      onlineUsers[userId] = {
        socketId: socket.id,
        userType
      };
      
      socket.userId = userId;
      socket.userType = userType;
      
      // If shopkeeper logs in, notify all online students
      if (userType === 'shopkeeper') {
        io.emit('shopkeeperStatus', { online: true });
      }
      
      // Emit online status to everyone
      io.emit('userStatus', { userId, online: true });
      
      console.log(`${userType} logged in: ${userId}`);
    } catch (error) {
      console.error('Login error:', error);
    }
  });
  
  // Listen for direct messages
  socket.on('sendDirectMessage', async (messageData) => {
    try {
      const { text, sender, recipient } = messageData;
      
      // Save message to database
      const message = new Message({
        text,
        sender,
        recipient,
        timestamp: new Date()
      });
      
      await message.save();
      
      // Send to recipient if online
      if (onlineUsers[recipient]) {
        io.to(onlineUsers[recipient].socketId).emit('directMessage', message);
      }
      
      // Send back to sender as confirmation
      socket.emit('directMessage', message);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      
      // Notify all clients that user is offline
      io.emit('userStatus', { userId: socket.userId, online: false });
      
      // If shopkeeper disconnects, notify all students
      if (socket.userType === 'shopkeeper') {
        io.emit('shopkeeperStatus', { online: false });
      }
      
      console.log(`User disconnected: ${socket.userId}`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));