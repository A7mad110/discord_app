import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.token = localStorage.getItem('discord_token');
  }

  connect(token) {
    if (this.socket) {
      this.disconnect();
    }

    this.token = token;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.socket.emit('authenticate', token);
    });

    this.socket.on('authenticated', (user) => {
      console.log('Authenticated as:', user.username);
    });

    this.socket.on('auth_error', (error) => {
      console.error('Auth error:', error);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Text channel methods
  joinChannel(channelId) {
    if (this.socket) {
      this.socket.emit('join_channel', channelId);
    }
  }

  leaveChannel(channelId) {
    if (this.socket) {
      this.socket.emit('leave_channel', channelId);
    }
  }

  sendMessage(channelId, content) {
    if (this.socket) {
      this.socket.emit('send_message', { channelId, content });
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  offNewMessage(callback) {
    if (this.socket) {
      this.socket.off('new_message', callback);
    }
  }

  // Voice channel methods
  joinVoice(channelId) {
    if (this.socket) {
      this.socket.emit('join_voice', { channelId });
    }
  }

  leaveVoice(channelId) {
    if (this.socket) {
      this.socket.emit('leave_voice', { channelId });
    }
  }

  toggleMute(channelId) {
    if (this.socket) {
      this.socket.emit('voice_toggle_mute', { channelId });
    }
  }

  toggleDeafen(channelId) {
    if (this.socket) {
      this.socket.emit('voice_toggle_deafen', { channelId });
    }
  }

  onVoiceParticipants(callback) {
    if (this.socket) {
      this.socket.on('voice_participants', callback);
    }
  }

  onUserJoinedVoice(callback) {
    if (this.socket) {
      this.socket.on('user_joined_voice', callback);
    }
  }

  onUserLeftVoice(callback) {
    if (this.socket) {
      this.socket.on('user_left_voice', callback);
    }
  }

  onVoiceUpdate(callback) {
    if (this.socket) {
      this.socket.on('voice_update', callback);
    }
  }

  // WebRTC signaling
  sendOffer(to, offer) {
    if (this.socket) {
      this.socket.emit('offer', { to, offer });
    }
  }

  sendAnswer(to, answer) {
    if (this.socket) {
      this.socket.emit('answer', { to, answer });
    }
  }

  sendIceCandidate(to, candidate) {
    if (this.socket) {
      this.socket.emit('ice_candidate', { to, candidate });
    }
  }

  onOffer(callback) {
    if (this.socket) {
      this.socket.on('offer', callback);
    }
  }

  onAnswer(callback) {
    if (this.socket) {
      this.socket.on('answer', callback);
    }
  }

  onIceCandidate(callback) {
    if (this.socket) {
      this.socket.on('ice_candidate', callback);
    }
  }

  // Screen sharing
  startScreenShare(channelId) {
    if (this.socket) {
      this.socket.emit('screen_share_start', { channelId });
    }
  }

  stopScreenShare(channelId) {
    if (this.socket) {
      this.socket.emit('screen_share_stop', { channelId });
    }
  }

  onScreenShareStarted(callback) {
    if (this.socket) {
      this.socket.on('screen_share_started', callback);
    }
  }

  onScreenShareStopped(callback) {
    if (this.socket) {
      this.socket.on('screen_share_stopped', callback);
    }
  }
}

export default new SocketService();