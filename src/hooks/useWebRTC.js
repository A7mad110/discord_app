import { useState, useEffect, useRef, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import socketService from '../services/socketService';

export const useWebRTC = (channelId) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const peersRef = useRef({});

  // Get local audio stream
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      return null;
    }
  }, []);

  // Create peer connection
  const createPeer = useCallback((targetSocketId, initiator, stream) => {
    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: true
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socketService.sendOffer(targetSocketId, data);
      } else if (data.type === 'answer') {
        socketService.sendAnswer(targetSocketId, data);
      } else {
        socketService.sendIceCandidate(targetSocketId, data);
      }
    });

    peer.on('stream', (remoteStream) => {
      setPeers(prev => ({
        ...prev,
        [targetSocketId]: { ...prev[targetSocketId], stream: remoteStream }
      }));
    });

    peer.on('close', () => {
      const newPeers = { ...peersRef.current };
      delete newPeers[targetSocketId];
      peersRef.current = newPeers;
      setPeers(prev => {
        const updated = { ...prev };
        delete updated[targetSocketId];
        return updated;
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    peersRef.current[targetSocketId] = peer;
    return peer;
  }, []);

  // Initialize WebRTC when joining voice
  useEffect(() => {
    if (!channelId) return;

    const init = async () => {
      const stream = await getLocalStream();
      if (!stream) return;

      // Join voice channel
      socketService.joinVoice(channelId);

      // Handle incoming participants
      socketService.onVoiceParticipants(({ participants }) => {
        participants.forEach(p => {
          if (p.socketId !== socketService.socket?.id) {
            // Create peer for each existing participant
            const peer = createPeer(p.socketId, true, stream);
            setPeers(prev => ({
              ...prev,
              [p.socketId]: { ...p, peer }
            }));
          }
        });
      });

      // Handle new users joining
      socketService.onUserJoinedVoice((user) => {
        if (user.socketId !== socketService.socket?.id) {
          const peer = createPeer(user.socketId, false, stream);
          setPeers(prev => ({
            ...prev,
            [user.socketId]: { ...user, peer }
          }));
        }
      });

      // Handle users leaving
      socketService.onUserLeftVoice(({ socketId }) => {
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].destroy();
          delete peersRef.current[socketId];
          setPeers(prev => {
            const updated = { ...prev };
            delete updated[socketId];
            return updated;
          });
        }
      });
    };

    init();

    return () => {
      // Cleanup
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      peersRef.current = {};
      setPeers({});
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      socketService.leaveVoice(channelId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, getLocalStream, createPeer]);

  // Handle WebRTC signaling
  useEffect(() => {
    if (!channelId) return;

    socketService.onOffer(({ from, offer }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].signal(offer);
      } else {
        // New peer - create with false (not initiator)
        getLocalStream().then(stream => {
          const peer = createPeer(from, false, stream);
          peer.signal(offer);
        });
      }
    });

    socketService.onAnswer(({ from, answer }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].signal(answer);
      }
    });

    socketService.onIceCandidate(({ from, candidate }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].signal(candidate);
      }
    });
  }, [channelId, getLocalStream, createPeer]);

  // Screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      });
      setScreenStream(stream);
      setIsScreenSharing(true);
      socketService.startScreenShare(channelId);
      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }, [channelId]);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    socketService.stopScreenShare(channelId);
  }, [channelId, screenStream]);

  return {
    peers,
    localStream,
    screenStream,
    isScreenSharing,
    startScreenShare,
    stopScreenShare
  };
};

export default useWebRTC;