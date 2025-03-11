const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const Message = require('./models/Message');
const User = require('./models/User');

// Load environment variables
dotenv.config();

// Define MongoDB Atlas URI with a clear error message if missing
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MongoDB Atlas URI is not defined!');
  console.error('Please create a .env file with your MONGO_URI variable set to your MongoDB Atlas connection string.');
  console.error('Example: MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>');
  process.exit(1); // Exit the application if essential config is missing
}

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

// Connect to MongoDB Atlas with improved error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Longer timeout for Atlas (10s)
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
    
    // Set up error handlers for the connection
    mongoose.connection.on('error', err => {
      console.error('MongoDB Atlas connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB Atlas disconnected. Attempting to reconnect...');
      setTimeout(connectDB, 5000); // Try to reconnect after 5 seconds
    });
    
  } catch (error) {
    console.error('MongoDB Atlas connection failed:', error.message);
    
    // Provide helpful error messages based on error type
    if (error.name === 'MongoServerSelectionError') {
      console.error('Could not connect to MongoDB Atlas. Please check:');
      console.error('1. Your internet connection is working');
      console.error('2. Your MongoDB Atlas cluster is running and accessible');
      console.error('3. Your IP address is whitelisted in MongoDB Atlas network settings');
      console.error('4. Your username, password, and cluster info are correct in the connection string');
    } else if (error.name === 'MongoParseError') {
      console.error('Invalid MongoDB Atlas connection string format. Please check your MONGO_URI.');
    } else if (error.message.includes('Authentication failed')) {
      console.error('MongoDB Atlas authentication failed. Check your username and password in the connection string.');
    }
    
    // Wait 5 seconds and retry instead of crashing
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Initialize connection
connectDB();

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
      
      // Check if MongoDB is connected before saving
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database connection not available');
      }
      
      // Save message to database
      const message = new Message({
        text,
        sender,
        recipient,
        timestamp: new Date(),
        read: false // Initialize as unread
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
      // Notify sender about the error
      socket.emit('messageError', { 
        error: 'Failed to send message. Please try again later.',
        originalMessage: messageData
      });
    }
  });
  
  // Typing indicator events
  socket.on('typing', (data) => {
    const { sender, recipient, isTyping } = data;
    
    // Forward typing status to recipient if online
    if (onlineUsers[recipient]) {
      io.to(onlineUsers[recipient].socketId).emit('typing', {
        sender,
        recipient,
        isTyping
      });
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

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Log error but don't exit process
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log error but don't exit process
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));