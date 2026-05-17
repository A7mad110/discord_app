import React, { useState, useEffect, useRef } from 'react';
import socketService from './services/socketService';
import useWebRTC from './hooks/useWebRTC';
import './index.css';

// Use environment variable or fallback to production URL for Electron builds
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  return 'https://discord-app-y247.onrender.com';
};

const API_URL = getApiUrl();
const APP_URL = typeof window !== 'undefined' ? (window.location.origin || 'https://inspiring-granita-3408e3.netlify.app') : 'https://inspiring-granita-3408e3.netlify.app';

// Auth Component
const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password || (!isLogin && !email)) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { username, password }
        : { username, email, password };

      const response = await fetch(API_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save token and user data
      localStorage.setItem('discord_token', data.token);
      localStorage.setItem('discord_user', JSON.stringify(data.user));

      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">{isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="auth-input"
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {!isLogin && (
            <input
              type="email"
              className="auth-input"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            className="auth-input"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={{ color: '#ed4245', fontSize: '14px' }}>{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'جاري...' : (isLogin ? 'دخول' : 'إنشاء حساب')}
          </button>
        </form>
        <div className="auth-switch">
          {isLogin ? (
            <>ما عندك حساب؟ <button type="button" onClick={() => setIsLogin(false)} style={{ background: 'none', border: 'none', color: '#5865f2', cursor: 'pointer', textDecoration: 'underline' }}>سجل الآن</button></>
          ) : (
            <>عندك حساب؟ <button type="button" onClick={() => setIsLogin(true)} style={{ background: 'none', border: 'none', color: '#5865f2', cursor: 'pointer', textDecoration: 'underline' }}>سجل دخول</button></>
          )}
        </div>
      </div>
    </div>
  );
};

// Friends Panel Component
const FriendsPanel = ({ friends, onSelectDM, onAddFriend, currentDM }) => {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const handleAddFriend = () => {
    if (friendUsername.trim()) {
      onAddFriend(friendUsername);
      setFriendUsername('');
      setShowAddFriend(false);
    }
  };

  const copyInviteLink = () => {
    const link = `${APP_URL}?invite=true`;
    navigator.clipboard.writeText(link);
    setInviteLink('تم النسخ! 📋');
    setTimeout(() => setInviteLink(''), 2000);
  };

  return (
    <div className="friends-panel">
      <div className="friends-header">
        <span>الأصدقاء 👥</span>
        <div className="friends-actions">
          <button onClick={() => setShowAddFriend(!showAddFriend)} title="إضافة صديق">➕</button>
          <button onClick={() => setShowInvite(!showInvite)} title="رابط الدعوة">🔗</button>
        </div>
      </div>

      {showAddFriend && (
        <div className="add-friend-form">
          <input
            type="text"
            placeholder="اسم المستخدم"
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
          />
          <button onClick={handleAddFriend}>أضف</button>
        </div>
      )}

      {showInvite && (
        <div className="invite-section">
          <p>شارك هذا الرابط مع صديقك:</p>
          <div className="invite-link-box">
            <code>{APP_URL}?invite=true</code>
          </div>
          <button onClick={copyInviteLink} className="copy-btn">
            {inviteLink || 'نسخ الرابط'}
          </button>
        </div>
      )}

      <div className="friends-list">
        {friends.length === 0 ? (
          <div className="no-friends">لا يوجد أصدقاء بعد</div>
        ) : (
          friends.map((friend, index) => (
            <div
              key={index}
              className={`friend-item ${currentDM === friend.username ? 'active' : ''}`}
              onClick={() => onSelectDM(friend.username)}
            >
              <div className="friend-avatar">{(friend.username || 'U')[0].toUpperCase()}</div>
              <div className="friend-info">
                <span className="friend-name">{friend.username}</span>
                <span className="friend-status">متصل 🟢</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Direct Message Component
const DirectMessage = ({ otherUser, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Listen for DM messages
    socketService.onDirectMessage((msg) => {
      if (msg.from === otherUser || msg.to === otherUser || msg.to === 'all') {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      socketService.offDirectMessage();
    };
  }, [otherUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msg = {
      id: Date.now(),
      from: currentUser,
      to: otherUser,
      content: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socketService.sendDirectMessage(otherUser, newMessage);
    setMessages([...messages, msg]);
    setNewMessage('');
  };

  return (
    <>
      <div className="chat-header">
        <span style={{ color: '#5865f2' }}>@</span>
        <span className="chat-header-title">محادثة خاصة مع {otherUser}</span>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <div className="message-avatar">{(msg.from || 'U')[0].toUpperCase()}</div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{msg.from}</span>
                <span className="message-time">{msg.time}</span>
              </div>
              <div className="message-text">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSend}>
          <input
            type="text"
            className="chat-input"
            placeholder={`رسالة خاصة لـ ${otherUser}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
        </form>
      </div>
    </>
  );
};

// Sidebar Component
const Sidebar = ({ 
  currentChannel, 
  currentVoiceChannel, 
  onChannelChange, 
  onLogout,
  user,
  friends,
  onAddFriend,
  onSelectDM,
  currentDM
}) => {
  return (
    <div className="sidebar">
      <div className="server-header">
        <span className="server-name">🎮 Discord App</span>
      </div>

      <FriendsPanel
        friends={friends}
        onSelectDM={onSelectDM}
        onAddFriend={onAddFriend}
        currentDM={currentDM}
      />

      <div className="channels-section">
        <div className="channel-category">📝 النصوص</div>
        <div
          className={`channel-item ${currentChannel === 'general' && !currentVoiceChannel && !currentDM ? 'active' : ''}`}
          onClick={() => onChannelChange('general', null, null)}
        >
          <span className="channel-icon">#</span>
          <span className="channel-name">شات عام</span>
        </div>
        <div
          className={`channel-item ${currentChannel === 'random' && !currentVoiceChannel && !currentDM ? 'active' : ''}`}
          onClick={() => onChannelChange('random', null, null)}
        >
          <span className="channel-icon">#</span>
          <span className="channel-name">حوارات عشوائية</span>
        </div>

        <div className="channel-category">🔊 الصوتي</div>
        <div
          className={`voice-item ${currentVoiceChannel === 'voice-general' ? 'active' : ''}`}
          onClick={() => onChannelChange(null, 'voice-general', null)}
        >
          <span>🔊</span>
          <span>روم صوتي عام</span>
        </div>
        <div
          className={`voice-item ${currentVoiceChannel === 'voice-gaming' ? 'active' : ''}`}
          onClick={() => onChannelChange(null, 'voice-gaming', null)}
        >
          <span>🔊</span>
          <span>روم جيمينق</span>
        </div>
      </div>

      <div className="user-panel" onClick={onLogout} style={{ cursor: 'pointer' }}>
        <div className="user-avatar-small">{(user?.username?.[0] || 'U').toUpperCase()}</div>
        <div className="user-info">
          <div className="user-name">{user?.username || 'مستخدم'}</div>
          <div className="user-status-text">متصل ✓</div>
        </div>
        <div style={{ marginLeft: 'auto', color: '#b9bbbe', fontSize: '12px' }}>خروج</div>
      </div>
    </div>
  );
};

// Text Chat Component
const TextChat = ({ channel, token }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Fetch messages on channel change
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/messages/${channel}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    socketService.joinChannel(channel);

    return () => {
      socketService.leaveChannel(channel);
    };
  }, [channel, token]);

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = (message) => {
      if (message.channel_id === channel) {
        setMessages(prev => [...prev, message]);
      }
    };

    socketService.onNewMessage(handleNewMessage);

    return () => {
      socketService.offNewMessage(handleNewMessage);
    };
  }, [channel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socketService.sendMessage(channel, newMessage);
    setNewMessage('');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="chat-header">
        <span style={{ color: '#8e9297' }}>#</span>
        <span className="chat-header-title">
          {channel === 'general' ? 'شات عام' : 'حوارات عشوائية'}
        </span>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div style={{ textAlign: 'center', color: '#72767d', padding: '20px' }}>جاري تحميل الرسائل...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#72767d', padding: '20px' }}>
            لا توجد رسائل بعد. كن أول من يحكي! 👋
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="message">
              <div className="message-avatar">{msg.author?.[0]?.toUpperCase() || 'U'}</div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-author">{msg.author || 'مستخدم'}</span>
                  <span className="message-time">{formatTime(msg.created_at)}</span>
                </div>
                <div className="message-text">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form onSubmit={handleSend}>
          <input
            type="text"
            className="chat-input"
            placeholder={`رسالة في #${channel}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
        </form>
      </div>
    </>
  );
};

// Voice Channel Component
const VoiceChannel = ({ channel, token }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [screenShareUser, setScreenShareUser] = useState(null);
  const videoRef = useRef(null);

  const { 
    localStream, 
    screenStream, 
    isScreenSharing, 
    startScreenShare, 
    stopScreenShare 
  } = useWebRTC(channel);

  // Update participants from socket events
  useEffect(() => {
    const handleParticipants = ({ participants }) => {
      setParticipants(participants);
    };

    const handleUserJoined = (user) => {
      setParticipants(prev => [...prev, user]);
    };

    const handleUserLeft = ({ socketId }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
    };

    const handleScreenShareStarted = ({ username }) => {
      setScreenShareUser(username);
    };

    const handleScreenShareStopped = () => {
      setScreenShareUser(null);
    };

    socketService.onVoiceParticipants(handleParticipants);
    socketService.onUserJoinedVoice(handleUserJoined);
    socketService.onUserLeftVoice(handleUserLeft);
    socketService.onScreenShareStarted(handleScreenShareStarted);
    socketService.onScreenShareStopped(handleScreenShareStopped);

    return () => {
      socketService.offNewMessage();
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      socketService.toggleMute(channel);
    }
  };

  const toggleDeafen = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isDeafened;
      });
      setIsDeafened(!isDeafened);
      socketService.toggleDeafen(channel);
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  // Update video preview
  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  return (
    <div className="voice-area">
      <div className="voice-header">
        <h2 className="voice-title">🔊 {channel === 'voice-general' ? 'روم صوتي عام' : 'روم جيمينق'}</h2>
        <p className="voice-subtitle">متصل الآن مع {participants.length} أشخاص</p>
      </div>

      {screenStream && (
        <div className="screen-share-container">
          <div className="screen-preview">
            <video 
              autoPlay 
              muted 
              ref={videoRef} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ color: '#b9bbbe', textAlign: 'center' }}>مشاركة الشاشة مفعلة</div>
        </div>
      )}

      {screenShareUser && !screenStream && (
        <div className="screen-share-container">
          <div style={{ color: '#b9bbbe', textAlign: 'center' }}>
            🎬 {screenShareUser} يشارك الشاشة
          </div>
        </div>
      )}

      <div className="voice-controls">
        <button
          className={`voice-button mute ${isMuted ? 'active' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'إلغاء كتم' : 'كتم'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          className={`voice-button deafen ${isDeafened ? 'active' : ''}`}
          onClick={toggleDeafen}
          title={isDeafened ? 'إلغاء deafen' : 'Deafen'}
        >
          {isDeafened ? '🔕' : '🎧'}
        </button>

        <button
          className={`voice-button screen ${isScreenSharing ? 'active' : ''}`}
          onClick={handleScreenShare}
          title={isScreenSharing ? 'إيقاف مشاركة الشاشة' : 'مشاركة الشاشة'}
        >
          🖥️
        </button>

        <button
          className="voice-button disconnect"
          onClick={() => window.location.reload()}
          title="الخروج"
        >
          📴
        </button>
      </div>

      <div className="voice-participants">
        {participants.map((p) => (
          <div key={p.socketId || p.userId} className="voice-participant">
            <div className={`participant-avatar ${p.isMuted ? '' : 'speaking'}`}>
              {p.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="participant-name">{p.username || 'مستخدم'}</span>
            <div className="participant-status">
              {p.isMuted && <span className="status-icon">🔇</span>}
              {p.isDeafened && <span className="status-icon">🔕</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentChannel, setCurrentChannel] = useState('general');
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null);
  const [currentDM, setCurrentDM] = useState(null);
  const [friends, setFriends] = useState([]);

  // Check for existing session
  useEffect(() => {
    const savedToken = localStorage.getItem('discord_token');
    const savedUser = localStorage.getItem('discord_user');

    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setToken(savedToken);
        socketService.connect(savedToken);
      } catch (e) {
        localStorage.removeItem('discord_token');
        localStorage.removeItem('discord_user');
      }
    }

    // Check for invite in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('invite') === 'true') {
      // Show invite message
      alert('🎉 تم دعوتك! سجل دخول وانضم لصديقك!');
    }
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    socketService.connect(authToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('discord_user');
    socketService.disconnect();
    setUser(null);
    setToken(null);
    setCurrentChannel('general');
    setCurrentVoiceChannel(null);
    setCurrentDM(null);
  };

  const handleChannelChange = (textChannel, voiceChannel, dm) => {
    if (currentVoiceChannel && currentVoiceChannel !== voiceChannel) {
      socketService.leaveVoice(currentVoiceChannel);
    }
    setCurrentChannel(textChannel || currentChannel);
    setCurrentVoiceChannel(voiceChannel);
    setCurrentDM(dm);
  };

  const handleAddFriend = (username) => {
    if (!friends.find(f => f.username === username)) {
      setFriends([...friends, { username }]);
      alert(`تم إضافة ${username} كصديق! 🎉`);
    }
  };

  const handleSelectDM = (username) => {
    setCurrentDM(username);
    setCurrentChannel(null);
    setCurrentVoiceChannel(null);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Sidebar
        currentChannel={currentChannel}
        currentVoiceChannel={currentVoiceChannel}
        onChannelChange={handleChannelChange}
        onLogout={handleLogout}
        user={user}
        friends={friends}
        onAddFriend={handleAddFriend}
        onSelectDM={handleSelectDM}
        currentDM={currentDM}
      />

      <div className="chat-area">
        {currentDM ? (
          <DirectMessage otherUser={currentDM} currentUser={user.username} />
        ) : currentVoiceChannel ? (
          <VoiceChannel channel={currentVoiceChannel} token={token} />
        ) : (
          <TextChat channel={currentChannel} token={token} />
        )}
      </div>
    </div>
  );
}

export default App;