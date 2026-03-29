import React, { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { 
  Monitor, 
  Users, 
  Copy, 
  LogOut, 
  Share2, 
  Video, 
  Mic, 
  MicOff,
  VideoOff,
  ScreenShare,
  StopCircle,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface PeerConnection {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
}

// --- Components ---

const VideoTile = ({ stream, isLocal, name }: { stream?: MediaStream; isLocal?: boolean; name: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 group shadow-2xl">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-500">
            {name ? name[0].toUpperCase() : '?'}
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 flex items-center space-x-2">
        <div className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-xs font-medium">
          {name} {isLocal && "(You)"}
        </div>
        {isLocal && stream?.getVideoTracks()[0]?.label?.includes('screen') && (
          <div className="px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-bold uppercase tracking-tighter">HD</div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  
  const peersRef = useRef<PeerConnection[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check for room ID in URL
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  const toggleMic = async () => {
    try {
      if (micEnabled) {
        micStream?.getAudioTracks().forEach(track => track.stop());
        setMicStream(null);
        setMicEnabled(false);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);
        setMicEnabled(true);
      }
    } catch (err) {
      console.error("Error toggling mic:", err);
      setError("Could not access microphone.");
    }
  };

  const toggleVideo = async () => {
    try {
      if (videoEnabled) {
        localStream?.getVideoTracks().forEach(track => track.stop());
        if (!isSharing) setLocalStream(null);
        setVideoEnabled(false);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setLocalStream(stream);
        setVideoEnabled(true);
      }
    } catch (err) {
      console.error("Error toggling video:", err);
      setError("Could not access camera.");
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          displaySurface: "monitor",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      setLocalStream(stream);
      streamRef.current = stream;
      setIsSharing(true);
      setError(null);
    } catch (err: any) {
      console.error("Error sharing screen:", err);
      if (err.name === 'NotAllowedError') {
        setError("Permission denied. Please allow screen sharing in your browser settings.");
      } else if (err.message.includes('permissions policy')) {
        setError("Screen sharing is disallowed by the security policy. Please try opening the app in a new tab.");
      } else {
        setError("Failed to start screen sharing. Please try again.");
      }
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    streamRef.current = null;
    setIsSharing(false);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !userName) return;

    // Check if already in a room
    if (inRoom) {
      setError("You are already in a room. Please leave first.");
      return;
    }

    // Simple demo mode - just show local video
    setInRoom(true);
    
    // Try to get camera/mic immediately
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        setVideoEnabled(true);
        setMicEnabled(true);
      })
      .catch(err => {
        console.error("Error accessing media:", err);
        setError("Could not access camera/microphone.");
      });
  };

  const leaveRoom = () => {
    stopScreenShare();
    setInRoom(false);
    setPeers([]);
    peersRef.current = [];
    setRoomId('');
    setUserName('');
    setError(null);
  };

  const copyRoomLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
  };

  if (!inRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#050505] relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md z-10"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-4 sm:mb-0 sm:mr-4">
              <Monitor className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-center sm:text-left">ScreenShare<span className="text-blue-500">Hub</span></h1>
          </div>

          <div className="glass p-6 sm:p-8 rounded-3xl border border-white/5">
            <h2 className="text-lg sm:text-xl font-semibold mb-6 text-zinc-200 text-center sm:text-left">Welcome back</h2>
            
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={joinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Display Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Room ID</label>
                <input
                  type="text"
                  placeholder="Enter room ID or create new"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center group"
              >
                Join Room
                <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <button 
                onClick={() => setRoomId(Math.random().toString(36).substring(7))}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Generate new ID
              </button>
              <div className="flex items-center text-xs text-zinc-500">
                <Users className="w-3 h-3 mr-1" />
                Demo Mode - Local Only
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Monitor className="text-white w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold font-display">ScreenShare Hub</h1>
            <div className="flex items-center text-[10px] text-zinc-500 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
              Demo Room: {roomId}
            </div>
          </div>
          <div className="sm:hidden">
            <div className="flex items-center text-[10px] text-zinc-500 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
              {roomId.substring(0, 8)}...
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button 
            onClick={copyRoomLink}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white flex items-center text-xs"
          >
            <Copy className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Copy Link</span>
          </button>
          <button 
            onClick={leaveRoom}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-2 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">✕</button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <VideoTile stream={localStream || undefined} isLocal name={userName} />
            
            <AnimatePresence>
              {peers.map((peer) => (
                <motion.div
                  key={peer.peerId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <VideoTile stream={peer.stream} name={`Peer ${peer.peerId.substring(0, 4)}`} />
                </motion.div>
              ))}
            </AnimatePresence>

            {peers.length === 0 && !isSharing && (
              <div className="aspect-video rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-600">
                <Users className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Demo Mode - Local Only</p>
                <p className="text-xs text-zinc-500 mt-2">Multi-user requires server setup</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="h-20 sm:h-24 border-t border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-center px-4 sm:px-6">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button 
            onClick={toggleMic}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${micEnabled ? 'bg-blue-600 text-white' : 'glass text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            {micEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          <button 
            onClick={toggleVideo}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${videoEnabled ? 'bg-blue-600 text-white' : 'glass text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            {videoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          
          <div className="w-px h-6 sm:h-8 bg-white/10 mx-1 sm:mx-2" />

          {!isSharing ? (
            <button 
              onClick={startScreenShare}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-semibold flex items-center shadow-lg shadow-blue-600/20 transition-all active:scale-95 text-xs sm:text-sm"
            >
              <ScreenShare className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-3 mr-2" />
              <span className="hidden sm:inline">Share Screen</span>
              <span className="sm:hidden">Share</span>
            </button>
          ) : (
            <button 
              onClick={stopScreenShare}
              className="bg-red-600 hover:bg-red-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-semibold flex items-center shadow-lg shadow-red-600/20 transition-all active:scale-95 text-xs sm:text-sm"
            >
              <StopCircle className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-3 mr-2" />
              <span className="hidden sm:inline">Stop Sharing</span>
              <span className="sm:hidden">Stop</span>
            </button>
          )}

          <div className="w-px h-6 sm:h-8 bg-white/10 mx-1 sm:mx-2" />

          <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-full glass flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
