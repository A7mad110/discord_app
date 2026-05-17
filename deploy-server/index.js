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
  ],
  friends: [], // { id, userId, friendId, status: 'accepted', createdAt }
  friendRequests: [] // { id, fromId, fromUsername, toUsername, status: 'pending', createdAt }
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

// Friends API endpoints
// Search users by username
app.get('/api/users/search', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Search users (excluding current user)
    const results = db.users
      .filter(u => u.id !== decoded.userId && u.username.toLowerCase().includes(q.toLowerCase()))
      .map(u => ({ id: u.id, username: u.username }))
      .slice(0, 10);

    res.json(results);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get user's friends list
app.get('/api/friends', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get accepted friendships
    const friendships = db.friends
      .filter(f => f.userId === decoded.userId && f.status === 'accepted')
      .map(f => {
        const friend = db.users.find(u => u.id === f.friendId);
        return friend ? { id: friend.id, username: friend.username, status: 'online' } : null;
      })
      .filter(f => f !== null);

    // Get pending sent requests
    const sentRequests = db.friendRequests
      .filter(r => r.fromId === decoded.userId && r.status === 'pending')
      .map(r => ({ id: r.id, toUsername: r.toUsername, status: 'sent' }));

    // Get pending received requests
    const receivedRequests = db.friendRequests
      .filter(r => r.toUsername === db.users.find(u => u.id === decoded.userId)?.username && r.status === 'pending' && r.fromId !== decoded.userId)
      .map(r => ({ id: r.id, fromId: r.fromId, fromUsername: r.fromUsername, status: 'received' }));

    res.json({ friends: friendships, sentRequests, receivedRequests });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Send friend request
app.post('/api/friends/request', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const currentUser = db.users.find(u => u.id === decoded.userId);
    const targetUser = db.users.find(u => u.username === username);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.id === decoded.userId) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    // Check if already friends
    const existing = db.friends.find(f => 
      (f.userId === decoded.userId && f.friendId === targetUser.id) ||
      (f.userId === targetUser.id && f.friendId === decoded.userId)
    );
    if (existing) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if request already exists
    const existingRequest = db.friendRequests.find(r => 
      r.fromId === decoded.userId && r.toUsername === username && r.status === 'pending'
    );
    if (existingRequest) {
      return res.status(400).json({ error: 'Request already sent' });
    }

    // Create friend request
    const request = {
      id: uuidv4(),
      fromId: decoded.userId,
      fromUsername: currentUser.username,
      toUsername: username,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.friendRequests.push(request);

    res.json({ success: true, message: 'Friend request sent!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept friend request
app.post('/api/friends/accept', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { requestId } = req.body;

    const request = db.friendRequests.find(r => r.id === requestId && r.status === 'pending');
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const currentUser = db.users.find(u => u.id === decoded.userId);
    if (request.toUsername !== currentUser.username) {
      return res.status(400).json({ error: 'Request not for you' });
    }

    // Find the sender
    const sender = db.users.find(u => u.id === request.fromId);
    if (!sender) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add friendship both ways
    db.friends.push({
      id: uuidv4(),
      userId: decoded.userId,
      friendId: sender.id,
      status: 'accepted',
      createdAt: new Date().toISOString()
    });

    db.friends.push({
      id: uuidv4(),
      userId: sender.id,
      friendId: decoded.userId,
      status: 'accepted',
      createdAt: new Date().toISOString()
    });

    // Remove the request
    request.status = 'accepted';

    res.json({ success: true, message: 'Friend request accepted!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all online users (for voice room display)
app.get('/api/users/online', (req, res) => {
  try {
    const onlineUsers = [];
    users.forEach((info) => {
      const user = db.users.find(u => u.id === info.userId);
      if (user) {
        onlineUsers.push({ id: user.id, username: user.username });
      }
    });
    res.json(onlineUsers);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
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

  // Direct Messages (DM)
  socket.on('send_dm', ({ to, content }) => {
    const userInfo = users.get(socket.id);
    if (!userInfo) return;

    const dm = {
      id: uuidv4(),
      from: userInfo.username,
      to,
      content,
      createdAt: new Date().toISOString()
    };

    // Find the target user's socket and send to them
    let targetSocket = null;
    users.forEach((info, socketId) => {
      if (info.username === to) {
        targetSocket = socketId;
      }
    });

    // Send to recipient
    if (targetSocket) {
      io.to(targetSocket).emit('new_dm', {
        ...dm,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    // Also send back to sender
    socket.emit('new_dm', {
      ...dm,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
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