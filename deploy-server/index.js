const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// JWT Secret - Replace with your own secret in production
const JWT_SECRET = process.env.JWT_SECRET || 'discord-app-secret-key-2024-prod';

// In-memory database (for free hosting)
const db = {
  users: [],
  messages: [],
  channels: [
    { id: 'general', name: 'general', type: 'text' },
    { id: 'random', name: 'random', type: 'text' }
  ],
  voiceChannels: [
    { id: 'voice-general', name: 'Voice General' },
    { id: 'voice-gaming', name: 'Voice Gaming' }
  ]
};

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = db.users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Create user
    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      avatar: null,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);

    // Generate token
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: userId, username, email } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Find user
    const user = db.users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = db.users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: user.id, username: user.username, email: user.email, avatar: user.avatar });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Channels endpoint
app.get('/api/channels', (req, res) => {
  res.json({ 
    text: db.channels, 
    voice: db.voiceChannels 
  });
});

// Messages endpoint
app.get('/api/messages/:channelId', (req, res) => {
  const messages = db.messages
    .filter(m => m.channelId === req.params.channelId)
    .map(m => {
      const user = db.users.find(u => u.id === m.userId);
      return {
        id: m.id,
        channel_id: m.channelId,
        user_id: m.userId,
        author: user?.username || 'Unknown',
        content: m.content,
        created_at: m.createdAt
      };
    });
  res.json(messages);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', users: db.users.length, messages: db.messages.length });
});

// Initialize Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io handling
const users = new Map(); // socketId -> { userId, username }
const voiceRooms = new Map(); // channelId -> Map<socketId, userInfo>

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Authenticate user
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.users.find(u => u.id === decoded.userId);
      if (user) {
        users.set(socket.id, { userId: user.id, username: user.username });
        socket.emit('authenticated', user);
      }
    } catch (error) {
      socket.emit('auth_error', 'Invalid token');
    }
  });

  // Join text channel
  socket.on('join_channel', (channelId) => {
    socket.join(`channel:${channelId}`);
    console.log(`User ${socket.id} joined channel ${channelId}`);
  });

  // Leave text channel
  socket.on('leave_channel', (channelId) => {
    socket.leave(`channel:${channelId}`);
  });

  // Send message
  socket.on('send_message', ({ channelId, content }) => {
    const userInfo = users.get(socket.id);
    if (!userInfo) return;

    const messageId = uuidv4();
    const now = new Date().toISOString();

    // Save to database
    const message = {
      id: messageId,
      channelId,
      userId: userInfo.userId,
      content,
      createdAt: now
    };
    db.messages.push(message);

    const messageForClient = {
      id: messageId,
      channel_id: channelId,
      user_id: userInfo.userId,
      author: userInfo.username,
      content,
      created_at: now
    };

    io.to(`channel:${channelId}`).emit('new_message', messageForClient);
  });

  // Join voice channel
  socket.on('join_voice', ({ channelId }) => {
    const userInfo = users.get(socket.id);
    if (!userInfo) return;

    socket.join(`voice:${channelId}`);

    if (!voiceRooms.has(channelId)) {
      voiceRooms.set(channelId, new Map());
    }

    const voiceData = {
      socketId: socket.id,
      userId: userInfo.userId,
      username: userInfo.username,
      isMuted: false,
      isDeafened: false
    };

    voiceRooms.get(channelId).set(socket.id, voiceData);

    // Notify others in the room
    socket.to(`voice:${channelId}`).emit('user_joined_voice', voiceData);

    // Send current participants to the joining user
    const participants = Array.from(voiceRooms.get(channelId).values());
    socket.emit('voice_participants', { channelId, participants });

    console.log(`User ${userInfo.username} joined voice channel ${channelId}`);
  });

  // Leave voice channel
  socket.on('leave_voice', ({ channelId }) => {
    const userInfo = users.get(socket.id);
    if (!userInfo) return;

    socket.leave(`voice:${channelId}`);

    if (voiceRooms.has(channelId)) {
      voiceRooms.get(channelId).delete(socket.id);
      socket.to(`voice:${channelId}`).emit('user_left_voice', { socketId: socket.id });
    }
  });

  // Voice controls (mute/deafen)
  socket.on('voice_toggle_mute', ({ channelId }) => {
    if (voiceRooms.has(channelId) && voiceRooms.get(channelId).has(socket.id)) {
      const user = voiceRooms.get(channelId).get(socket.id);
      user.isMuted = !user.isMuted;
      io.to(`voice:${channelId}`).emit('voice_update', { socketId: socket.id, isMuted: user.isMuted });
    }
  });

  socket.on('voice_toggle_deafen', ({ channelId }) => {
    if (voiceRooms.has(channelId) && voiceRooms.get(channelId).has(socket.id)) {
      const user = voiceRooms.get(channelId).get(socket.id);
      user.isDeafened = !user.isDeafened;
      io.to(`voice:${channelId}`).emit('voice_update', { socketId: socket.id, isDeafened: user.isDeafened });
    }
  });

  // WebRTC signaling
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    io.to(to).emit('ice_candidate', { from: socket.id, candidate });
  });

  // Screen sharing
  socket.on('screen_share_start', ({ channelId }) => {
    const userInfo = users.get(socket.id);
    socket.to(`voice:${channelId}`).emit('screen_share_started', { 
      socketId: socket.id, 
      username: userInfo?.username 
    });
  });

  socket.on('screen_share_stop', ({ channelId }) => {
    socket.to(`voice:${channelId}`).emit('screen_share_stopped', { socketId: socket.id });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const userInfo = users.get(socket.id);
    if (userInfo) {
      // Leave all voice channels
      voiceRooms.forEach((participants, channelId) => {
        if (participants.has(socket.id)) {
          participants.delete(socket.id);
          socket.to(`voice:${channelId}`).emit('user_left_voice', { socketId: socket.id });
        }
      });
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});