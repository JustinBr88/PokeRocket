import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { API_URL, WS_URL } from '../../lib/sprites';
import { usePlayerImageStore } from '../../stores/playerImageStore';

interface Player {
  odiserId: string;
  name: string;
  side: 'blue' | 'red';
  ready: boolean;
  teamReady?: boolean;
}

interface RoomState {
  code: string;
  mode: 'casual' | 'ranked';
  status: string;
  players: Player[];
}

interface ChatMessage {
  playerId: string;
  name: string;
  text: string;
  timestamp?: string;
  clientId?: string;
  playerImageUrl?: string;
}

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const { setPlayerImage, getPlayerImage } = usePlayerImageStore();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const playerId = user?.id ?? 'guest';
  const playerName = user?.username ?? user?.firstName ?? 'Player';

  // Store current user's avatar on mount
  useEffect(() => {
    if (user?.id && user?.imageUrl) {
      setPlayerImage(user.id, user.imageUrl);
    }
  }, [user?.id, user?.imageUrl, setPlayerImage]);

  // WebSocket connection with reconnect
  useEffect(() => {
    const rid = roomId;
    const pid = playerId;
    // Guard against undefined — must have BOTH values before any connection
    if (!rid || !pid || rid === 'undefined' || pid === 'undefined') return;

    // Store current user's image before connection
    if (user?.imageUrl) {
      setPlayerImage(pid, user.imageUrl);
    }

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      const url = `${WS_URL}/ws/${rid}/${pid}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        setConnected(true);
        // Send JOIN_ROOM message with imageUrl
        if (user?.imageUrl) {
          ws.send(JSON.stringify({
            type: 'JOIN_ROOM',
            playerId: pid,
            playerImageUrl: user.imageUrl
          }));
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        if (closed) return;
        ws.close();
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWsMessage(msg);
        } catch {}
      };

      wsRef.current = ws;
    }

    connect();

    // Fetch initial room state
    fetch(`${API_URL}/rooms/${rid}`)
      .then(r => r.json())
      .then(data => {
        setRoom(data);
        // Check if this player already has ready=true
        const me = data.players?.find((p: Player) => p.odiserId === pid);
        if (me?.ready) setIsReady(true);
      })
      .catch(console.error);

    // Fetch chat history
    fetch(`${API_URL}/rooms/${rid}/chat`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(console.error);

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [roomId, playerId]);

  function handleWsMessage(msg: any) {
    switch (msg.type) {
      case 'PLAYER_CONNECTED':
        if (msg.playerId !== playerId) {
          // Another player connected — refresh room state and store their image
          if (msg.playerImageUrl) {
            setPlayerImage(msg.playerId, msg.playerImageUrl);
          }
          fetch(`${API_URL}/rooms/${roomId}`).then(r => r.json()).then(setRoom);
          addSystemMessage(`${msg.playerId.slice(-4)} connected`);
        }
        break;
      case 'PLAYER_DISCONNECTED':
        fetch(`${API_URL}/rooms/${roomId}`).then(r => r.json()).then(setRoom);
        addSystemMessage(`Player disconnected`);
        break;
      case 'PLAYER_READY':
        // Another player marked ready — update room state so we see their card update
        fetch(`${API_URL}/rooms/${roomId}`).then(r => r.json()).then(setRoom);
        break;
      case 'CHAT_MESSAGE':
        setMessages(prev => {
          // Deduplicate using clientId (prioritize this over timestamp matching)
          const isDuplicate = prev.some(m =>
            msg.clientId && m.clientId === msg.clientId
          );
          if (isDuplicate) return prev;

          // Add message with server timestamp
          return [...prev, {
            playerId: msg.playerId,
            name: msg.name,
            text: msg.text,
            timestamp: msg.timestamp,
            clientId: msg.clientId,
            playerImageUrl: msg.playerImageUrl
          }];
        });
        break;
      case 'LOBBY_READY':
        // Both players ready — navigate to team builder
        navigate(`/teams/${roomId}`);
        break;
    }
  }

  function addSystemMessage(text: string) {
    setMessages(prev => [...prev, { playerId: 'SYSTEM', name: 'SYSTEM', text, timestamp: new Date().toISOString() }]);
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleReady() {
    if (!room) return;

    const res = await fetch(`${API_URL}/rooms/${roomId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ odiserId: playerId }),
    });

    if (res.ok) {
      const data = await res.json();
      setIsReady(true);
      // DO NOT navigate here — wait for LOBBY_READY WS event from server
      // The server broadcasts LOBBY_READY when both are ready
    }
  }

  async function handleCancel() {
    navigate('/home');
  }

  function handleSendChat() {
    if (!chatInput.trim() || !wsRef.current) return;
    const ws = wsRef.current;
    if (ws.readyState === WebSocket.OPEN) {
      const timestamp = new Date().toISOString();
      const clientId = `${playerId}-${Date.now()}-${Math.random()}`;
      ws.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        roomCode: roomId,
        playerId,
        name: playerName,
        text: chatInput.trim(),
        playerImageUrl: user?.imageUrl,
        clientId
      }));
      setMessages(prev => [...prev, { playerId, name: playerName, text: chatInput.trim(), timestamp, clientId }]);
    }
    setChatInput('');
  }

  if (!isSignedIn && room?.mode === 'ranked') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-headline text-headline-md text-primary">Please sign in first</p>
      </div>
    );
  }

   const mySide = room?.players?.find((p: Player) => p.odiserId === playerId)?.side;
   const otherPlayer = room?.players?.find((p: Player) => p.odiserId !== playerId);
   
   // Get avatar URLs for both players
   const myAvatarUrl = user?.imageUrl;
   const otherAvatarUrl = otherPlayer ? getPlayerImage(otherPlayer.odiserId) : null;

  return (
    <div className="min-h-screen bg-background font-body overflow-hidden h-screen flex flex-col">
      <div className="crt-overlay" />

      {/* Top Nav */}
      <header className="flex justify-between items-center w-full px-4 h-16 bg-surface-container-lowest border-b-3 border-black bg-gradient-to-b from-surface-container-highest to-surface-container z-50">
        <div className="font-headline text-headline-lg text-primary tracking-tighter uppercase">PokéRocket</div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-ping' : 'bg-error'}`} />
          <span className="font-label-lg text-label-lg text-on-surface-variant">{connected ? 'CONNECTED' : 'RECONNECTING...'}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Lobby Content */}
        <main className="flex-1 p-gutter overflow-y-auto flex flex-col gap-6 dot-pattern">
          {/* Room Header */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-container-highest border-3 border-black p-4 chamfer-tl relative overflow-hidden">
            <div className="absolute inset-0 gloss-effect opacity-30 pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-4 h-4 bg-primary animate-pulse border-2 border-black" />
              <div className="font-headline text-headline-md text-on-surface uppercase tracking-wider">
                {room?.status === 'waiting' ? 'WAITING FOR PLAYERS...' : 'LOBBY'}
              </div>
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-surface-container-low px-4 py-2 border-3 border-black">
                <span className="text-label-sm text-on-surface-variant uppercase block">Room Code</span>
                <span className="text-headline-md text-primary font-headline tracking-[0.2em]">{roomId}</span>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter flex-1">
            {/* Player Column */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Player 1 (Blue) */}
              <div className={`bg-surface-container border-3 border-black chamfer-both p-6 flex items-center gap-6 relative group ${mySide === 'blue' ? 'border-primary' : ''}`}>
                {mySide === 'blue' && (
                  <>
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-6 border-l-6 border-primary z-10" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-6 border-r-6 border-primary z-10" />
                  </>
                )}
                <div className="w-32 h-32 bg-surface-container-high border-4 border-black overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/micro-carbon.png')] flex items-center justify-center">
                  {mySide === 'blue' ? (
                    <img 
                      src={myAvatarUrl || 'https://via.placeholder.com/128'} 
                      alt={playerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={otherAvatarUrl || 'https://via.placeholder.com/128'} 
                      alt={otherPlayer?.name ?? 'Player'}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline text-headline-lg text-on-surface uppercase">
                      {mySide === 'blue' ? playerName : otherPlayer?.name ?? 'WAITING...'}
                    </h3>
                    {mySide === 'blue' && (
                      <div className={`px-3 py-1 font-headline text-headline-md border-2 border-black ${isReady ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant'}`}>
                        {isReady ? 'READY!' : 'NOT READY'}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-12 bg-surface-container-highest border-2 border-black flex items-center justify-center opacity-60">
                        <span className="material-symbols-outlined text-primary-container">question_mark</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player 2 (Red) */}
              <div className={`bg-surface-container border-3 border-black chamfer-both p-6 flex items-center gap-6 relative group opacity-90 ${mySide === 'red' ? 'border-secondary' : ''}`}>
                {mySide === 'red' && (
                  <>
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-6 border-l-6 border-secondary z-10" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-6 border-r-6 border-secondary z-10" />
                  </>
                )}
                <div className="w-32 h-32 bg-surface-container-high border-4 border-black overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/micro-carbon.png')] flex items-center justify-center">
                  {mySide === 'red' ? (
                    <img 
                      src={myAvatarUrl || 'https://via.placeholder.com/128'} 
                      alt={playerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={otherAvatarUrl || 'https://via.placeholder.com/128'} 
                      alt={otherPlayer?.name ?? 'Player'}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline text-headline-lg text-on-surface uppercase">
                      {mySide === 'red' ? playerName : otherPlayer?.name ?? 'WAITING...'}
                    </h3>
                    {mySide === 'red' && (
                      <div className={`px-3 py-1 font-headline text-headline-md border-2 border-black ${isReady ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant'}`}>
                        {isReady ? 'READY!' : 'NOT READY'}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-12 bg-surface-container-highest border-2 border-black flex items-center justify-center opacity-20">
                        <span className="material-symbols-outlined">question_mark</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Box */}
            <div className="lg:col-span-5 flex flex-col bg-surface-container-low border-3 border-black chamfer-both max-h-[500px]">
              <div className="bg-black text-primary px-4 py-2 font-label-lg uppercase flex items-center gap-2 border-b-3 border-black">
                <span className="material-symbols-outlined text-[16px]">chat</span>
                Communication Log
              </div>
               <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-body">
                 {messages.map((msg, i) => {
                   const timestamp = msg.timestamp ? formatTime(msg.timestamp) : '';
                   const avatarUrl = msg.playerId !== 'SYSTEM' ? getPlayerImage(msg.playerId) : null;
                   return (
                     <div key={i} className={`flex gap-2 items-start ${msg.playerId === playerId ? 'flex-row-reverse' : ''}`}>
                       {msg.playerId === 'SYSTEM' ? (
                         <div className="text-on-surface-variant text-xs italic">{msg.text}</div>
                       ) : (
                         <>
                           <img 
                             src={avatarUrl || 'https://via.placeholder.com/32'} 
                             alt={msg.name}
                             className="w-8 h-8 rounded-full object-cover border border-primary flex-shrink-0"
                           />
                           <div className={`flex flex-col gap-1 ${msg.playerId === playerId ? 'items-end' : ''}`}>
                             <div className={`text-label-xs uppercase font-bold flex items-center gap-2 ${msg.playerId === playerId ? 'text-primary' : 'text-secondary'}`}>
                               <span>{timestamp}</span>
                               <span>{msg.name}:</span>
                             </div>
                             <div className={`p-3 border-2 border-black chamfer-inverse ${msg.playerId === playerId ? 'bg-primary/20 border-primary text-on-surface' : 'bg-surface-container-high text-on-surface'}`}>
                               {msg.text}
                             </div>
                           </div>
                         </>
                       )}
                     </div>
                   );
                 })}
                 <div ref={chatEndRef} />
               </div>
              <div className="p-4 bg-surface-container border-t-3 border-black flex gap-2">
                <input
                  className="flex-1 bg-surface-container-lowest border-2 border-black text-on-surface p-2 focus:ring-0 focus:border-primary placeholder:text-surface-variant font-body"
                  placeholder="TYPE MESSAGE..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                />
                <button
                  onClick={handleSendChat}
                  className="bg-surface-container-highest p-2 border-2 border-black hover:bg-primary hover:text-on-primary transition-colors"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Action Area */}
          <div className="mt-auto pt-6 flex flex-col md:flex-row gap-gutter items-center">
            <button
              onClick={handleCancel}
              className="w-full md:w-1/3 bg-surface-container-highest text-on-surface p-6 border-4 border-black chamfer-tl font-headline text-headline-md flex items-center justify-center gap-4 group active:translate-y-0.5 transition-transform"
            >
              <span className="material-symbols-outlined group-hover:rotate-45 transition-transform">close</span>
              CANCEL LOBBY
            </button>
            <button
              onClick={handleReady}
              className={`w-full md:w-2/3 p-6 border-4 border-black chamfer-tl font-headline text-headline-lg flex items-center justify-center gap-6 group hover:scale-[1.02] active:scale-95 transition-all gloss-effect ${
                isReady ? 'bg-surface-container text-on-surface' : 'bg-primary text-on-primary hover:bg-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-[32px]">swords</span>
              {isReady ? 'CANCEL READY' : 'CONFIRM READY'}
            </button>
          </div>
        </main>
      </div>

      <style>{`
        .dot-pattern { background-image: radial-gradient(#353535 1px, transparent 1px); background-size: 8px 8px; }
        .chamfer-inverse { clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px); }
      `}</style>
    </div>
  );
}