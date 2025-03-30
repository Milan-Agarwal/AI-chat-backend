const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const express = require('express')
const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/user');
const cors = require("cors");
// const axios = require('axios')
// const multer = require('multer');
const bodyParser = require('body-parser');
// const fs = require('fs')
// const path = require('path');/
const app = express()
const port = process.env.PORT || 3000
// app.use(bodyParser.json());
app.use(express.json())
app.use(cors({ origin: "*" }));

mongoose.connect(process.env.MONGO_URI, { 
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const gemini_api_key = process.env.API_KEY;
const googleAI = new GoogleGenerativeAI(gemini_api_key);
const geminiModel = googleAI.getGenerativeModel({
  model: "gemini-1.5-flash-8b",
});

// var question = "what is the value of pie in maths ?";

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1); // Exit the process to avoid undefined behavior
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Exit the process to avoid undefined behavior
});

app.get('/', (req, res) => {
    res.send('Hello World!')
  })
  
app.post('/content', async (req, res) => {
    try {
        const { prompt } = req.body;
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        res.json({ result: text }); // Return the translated text directly
    } catch (error) {
        console.error("Error generating content:", error);
        res.status(500).json({ error: "Failed to generate content" });
    }
});

app.post('/rooms', async (req, res) => {
  try {
    const { roomName, creator } = req.body;
    const room = new Room({ name: roomName, creator });
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

app.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

app.get('/messages', async (req, res) => {
  try {
    const { roomId } = req.query; // Assuming roomId is passed as a query parameter
    const room = await Room.findById(roomId).populate('messages.sender', 'username profilePicture'); // Populate sender details

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room.messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post('/messages', async (req, res) => {
  try {
    const { roomId, senderId, text } = req.body; // Use senderId to reference the user
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const newMessage = { sender: senderId, text }; // Save sender as ObjectId
    room.messages.push(newMessage);
    await room.save();

    const populatedMessage = await room.populate('messages.sender', 'username profilePicture'); // Populate sender details
    res.status(201).json(populatedMessage.messages.pop()); // Return the newly added message
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if a user with the same email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({ username, email, password });
    await user.save();
   
    res.status(201).json({ message: 'User signed up successfully', user });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Failed to sign up user" });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    console.log("User logged in:", user);

    res.status(200).json({ message: 'Login successful' ,user});
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.put('/users/:id/profile-picture', async (req, res) => {
  try {
    const userId = req.params.id;
    const { profilePicture } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.profilePicture = profilePicture; // Update the profile picture
    await user.save();

    res.status(200).json({ message: 'Profile picture updated successfully', user });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

app.get('/users/:id/profile-picture', async (req, res) => {
  try {
   
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
     console.log("User found:", user);
    // Assuming the profile picture URL is stored in user.profilePicture
    res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching profile picture:', error);
    res.status(500).json({ error: 'Failed to fetch profile picture' });
  }
});

app.delete('/rooms/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const { creator } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.creator !== creator) {
      return res.status(403).json({ error: 'Only the creator can delete this room' });
    }

    await room.deleteOne();
    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
