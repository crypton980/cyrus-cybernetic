import { useState, useEffect, useRef } from "react";
import { useComms } from "../hooks/useComms";
import { usePresence } from "../contexts/PresenceContext";
import { CyrusHumanoid } from "../components/CyrusHumanoid";
import { Link } from "wouter";
import {
  MessageSquare,
  Bell,
  Newspaper,
  Phone,
  Video,
  Send,
  Plus,
  Check,
  Trash2,
  RefreshCw,
  PhoneOff,
  Clock,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  SignalZero,
  Wifi,
  WifiOff,
  Copy,
  Users,
  UserPlus,
  PhoneIncoming,
  PhoneCall,
  Star,
  Circle,
  User,
  ArrowLeft,
  Radio,
} from "lucide-react";

type TabType = "messages" | "reminders" | "news" | "calls";
type CallSubTab = "online" | "contacts" | "room";

export function CommsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("messages");
  const [callSubTab, setCallSubTab] = useState<CallSubTab>("online");
  const [newMessage, setNewMessage] = useState({ recipient: "", content: "" });
  const [newReminder, setNewReminder] = useState({
    title: "",
    description: "",
    dueAt: "",
    priority: "medium" as "low" | "medium" | "high",
  });
  const [callInput, setCallInput] = useState("");
  const [callMode, setCallMode] = useState<"create" | "join">("create");
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const {
    messages,
    reminders,
    news,
    contacts,
    incomingCall: localIncomingCall,
    myUserId: localMyUserId,
    isConnected: localIsConnected,
    activeCall,
    localStream,
    remoteStream,
    callControls,
    qualityMetrics,
    sendMessage,
    addReminder,
    completeReminder,
    deleteReminder,
    addContact,
    deleteContact,
    startCall,
    joinCall,
    endCall,
    callUser: localCallUser,
    acceptIncomingCall,
    declineIncomingCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    getAudioLevel,
    isLoading,
  } = useComms();
  
  // Use global presence for online users (connected at App level)
  const { 
    onlineUsers, 
    isConnected, 
    myUserId, 
    incomingCall: globalIncomingCall,
    callUser: globalCallUser,
    acceptCall: globalAcceptCall,
    declineCall: globalDeclineCall,
    connectPresence,
  } = usePresence();
  
  // Merge incoming call from both sources - prefer global
  const incomingCall = globalIncomingCall || localIncomingCall;
  
  // Use appropriate accept/decline based on call source
  const handleAcceptCall = () => {
    console.log("[CommsPage] Accepting call...");
    if (globalIncomingCall) {
      console.log("[CommsPage] Using global accept");
      globalAcceptCall();
    } else {
      console.log("[CommsPage] Using local accept");
      acceptIncomingCall();
    }
  };
  
  const handleDeclineCall = () => {
    console.log("[CommsPage] Declining call...");
    if (globalIncomingCall) {
      console.log("[CommsPage] Using global decline");
      globalDeclineCall();
    } else {
      console.log("[CommsPage] Using local decline");
      declineIncomingCall();
    }
  };
  
  // Use global callUser from PresenceContext for proper WebSocket connection
  const callUser = (userId: string, userName: string, type: "audio" | "video") => {
    console.log(`[CommsPage] BUTTON CLICKED - Calling user: ${userName} (${userId}) - Type: ${type}`);
    console.log(`[CommsPage] IsConnected: ${isConnected}, MyUserId: ${myUserId}`);
    globalCallUser(userId, userName, type);
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const savedName = localStorage.getItem("cyrus-display-name") || "CYRUS User";
    setDisplayName(savedName);
    // Global presence is already connected from App level - no need to connect again
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.recipient.trim() || !newMessage.content.trim()) return;
    sendMessage.mutate({
      recipientId: newMessage.recipient,
      content: newMessage.content,
    });
    setNewMessage({ recipient: "", content: "" });
  };

  const handleAddReminder = () => {
    if (!newReminder.title.trim() || !newReminder.dueAt) return;
    addReminder.mutate({
      title: newReminder.title,
      description: newReminder.description,
      dueAt: new Date(newReminder.dueAt).toISOString(),
      priority: newReminder.priority,
    });
    setNewReminder({ title: "", description: "", dueAt: "", priority: "medium" });
  };

  const handleStartCall = async (type: "audio" | "video") => {
    if (callMode === "create") {
      await startCall(callInput || "guest", type);
    } else if (callInput.trim()) {
      await joinCall(callInput, type);
    }
  };

  const copyRoomId = () => {
    if (activeCall?.roomId) {
      navigator.clipboard.writeText(activeCall.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "news", label: "News", icon: Newspaper },
    { id: "calls", label: "Calls", icon: Phone },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-400 border-red-600";
      case "medium":
        return "text-yellow-400 border-yellow-600";
      default:
        return "text-green-400 border-green-600";
    }
  };

  const getQualityIcon = () => {
    if (!qualityMetrics) return <Signal className="w-4 h-4 text-gray-500" />;
    switch (qualityMetrics.qualityScore) {
      case "excellent":
        return <SignalHigh className="w-4 h-4 text-green-400" />;
      case "good":
        return <SignalMedium className="w-4 h-4 text-green-400" />;
      case "fair":
        return <SignalLow className="w-4 h-4 text-yellow-400" />;
      case "poor":
        return <SignalZero className="w-4 h-4 text-red-400" />;
      default:
        return <Signal className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500 animate-pulse";
      case "reconnecting":
        return "bg-orange-500 animate-pulse";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {incomingCall && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.95)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 99999,
            pointerEvents: 'auto'
          }}
        >
          <div 
            style={{ 
              background: 'linear-gradient(135deg, #1a472a 0%, #1a365d 100%)', 
              borderRadius: '16px', 
              padding: '32px', 
              maxWidth: '350px', 
              width: '90%', 
              textAlign: 'center',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ 
              width: '96px', 
              height: '96px', 
              background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 16px' 
            }}>
              <PhoneIncoming style={{ width: '48px', height: '48px', color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
              Incoming Call
            </h3>
            <p style={{ color: '#e5e7eb', fontSize: '18px', marginBottom: '4px' }}>
              {incomingCall.callerName}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '32px' }}>
              {incomingCall.callType === "video" ? "HD Video" : "HD Audio"} Call
            </p>
            <div style={{ display: 'flex', gap: '32px', justifyContent: 'center' }}>
              <div
                role="button"
                tabIndex={0}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dc2626 0%, #be123c 100%)',
                  border: '3px solid #fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px rgba(220, 38, 38, 0.5)',
                  userSelect: 'none',
                }}
                onPointerDown={() => {
                  alert("Call declined!");
                  globalDeclineCall();
                }}
              >
                <PhoneOff style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
              <div
                role="button"
                tabIndex={0}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                  border: '3px solid #fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px rgba(22, 163, 74, 0.5)',
                  userSelect: 'none',
                }}
                onPointerDown={() => {
                  alert("Accepting call...");
                  globalAcceptCall();
                }}
              >
                <Phone style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                      Secure Communications
                    </h1>
                    <p className="text-gray-400 text-sm">Enterprise HD Voice & Video</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">
                  {isConnected ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-gray-400">Messages</span>
              </div>
              <p className="text-lg font-bold text-blue-400">{messages.length}</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs text-gray-400">Reminders</span>
              </div>
              <p className="text-lg font-bold text-amber-400">{reminders.length}</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Newspaper className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs text-gray-400">News Feed</span>
              </div>
              <p className="text-lg font-bold text-purple-400">{news.length}</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-gray-400">Online</span>
              </div>
              <p className="text-lg font-bold text-green-400">{onlineUsers.length}</p>
            </div>
          </div>

          {/* Always-Visible Online Users Panel */}
          <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 backdrop-blur-sm border border-green-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/30 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-green-400">Online Users</h3>
                  <p className="text-xs text-gray-400">
                    {isConnected ? (
                      <span className="flex items-center gap-1">
                        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                        Connected as {displayName || "CYRUS User"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500" />
                        Connecting...
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-sm text-green-400 font-semibold">
                {onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} online
              </div>
            </div>
            
            {onlineUsers.length === 0 ? (
              <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-400 text-sm">No other users online</p>
                <p className="text-gray-500 text-xs mt-1">Share this app with others to connect</p>
              </div>
            ) : (
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {onlineUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-gray-900/60 rounded-lg p-3 flex items-center justify-between hover:bg-gray-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${user.inCall ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.displayName}</p>
                        <p className="text-xs text-gray-400">
                          {user.inCall ? 'In a call' : 'Available'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("[CallButton] Audio call clicked for:", user.displayName);
                          callUser(user.id, user.displayName, "audio");
                        }}
                        disabled={user.inCall}
                        className="p-2.5 bg-green-600 hover:bg-green-500 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 cursor-pointer z-10"
                        title="Start Audio Call"
                      >
                        <Phone className="w-4 h-4 text-white pointer-events-none" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("[CallButton] Video call clicked for:", user.displayName);
                          callUser(user.id, user.displayName, "video");
                        }}
                        disabled={user.inCall}
                        className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 cursor-pointer z-10"
                        title="Start Video Call"
                      >
                        <Video className="w-4 h-4 text-white pointer-events-none" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNewMessage({ ...newMessage, recipient: user.displayName });
                          setActiveTab("messages");
                        }}
                        className="p-2.5 bg-purple-600 hover:bg-purple-500 rounded-full transition-all shadow-lg shadow-purple-500/20 cursor-pointer z-10"
                        title="Send Message"
                      >
                        <MessageSquare className="w-4 h-4 text-white pointer-events-none" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-800/50">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 transition-all ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-400 border-b-2 border-green-500"
                        : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                </div>
              )}

            {!isLoading && activeTab === "messages" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage.recipient}
                    onChange={(e) =>
                      setNewMessage({ ...newMessage, recipient: e.target.value })
                    }
                    placeholder="Recipient"
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newMessage.content}
                    onChange={(e) =>
                      setNewMessage({ ...newMessage, content: e.target.value })
                    }
                    placeholder="Message"
                    className="flex-2 bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>

                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-gray-800 rounded-lg p-3 space-y-1"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-blue-400">
                            To: {msg.recipientId}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-200">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === "reminders" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newReminder.title}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, title: e.target.value })
                    }
                    placeholder="Reminder title"
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="datetime-local"
                    value={newReminder.dueAt}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, dueAt: e.target.value })
                    }
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newReminder.description}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, description: e.target.value })
                    }
                    placeholder="Description (optional)"
                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newReminder.priority}
                    onChange={(e) =>
                      setNewReminder({
                        ...newReminder,
                        priority: e.target.value as "low" | "medium" | "high",
                      })
                    }
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button
                    onClick={handleAddReminder}
                    className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {reminders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No reminders</p>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`bg-gray-800 rounded-lg p-3 border-l-4 ${getPriorityColor(
                          reminder.priority
                        )} ${reminder.completed ? "opacity-50" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3
                              className={`font-medium ${
                                reminder.completed ? "line-through" : ""
                              }`}
                            >
                              {reminder.title}
                            </h3>
                            {reminder.description && (
                              <p className="text-sm text-gray-400">
                                {reminder.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <Clock className="w-3 h-3" />
                              {new Date(reminder.dueAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {!reminder.completed && (
                              <button
                                onClick={() => completeReminder.mutate(reminder.id)}
                                className="p-1 text-green-400 hover:bg-green-900/50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteReminder.mutate(reminder.id)}
                              className="p-1 text-red-400 hover:bg-red-900/50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === "news" && (
              <div className="space-y-4">
                {news.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No news</p>
                ) : (
                  <div className="space-y-3">
                    {news.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-blue-400 uppercase">
                            {item.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-medium text-white mb-1">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-400">{item.summary}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Source: {item.source}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === "calls" && (
              <div className="space-y-4">
                {activeCall ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-600/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(activeCall.status)}`} />
                          <div>
                            <p className="font-medium text-green-400">
                              {activeCall.type === "video" ? "HD Video" : "HD Audio"} Call
                            </p>
                            <p className="text-xs text-gray-400">
                              Status: {activeCall.status.charAt(0).toUpperCase() + activeCall.status.slice(1)}
                              {activeCall.qualityPreset && ` | Quality: ${activeCall.qualityPreset}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            {getQualityIcon()}
                            {qualityMetrics && (
                              <span className="text-gray-400">
                                {qualityMetrics.qualityScore}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={copyRoomId}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                            title="Copy room ID to share"
                          >
                            <Copy className="w-4 h-4" />
                            {copied ? "Copied!" : "Share"}
                          </button>
                        </div>
                      </div>

                      {qualityMetrics && (
                        <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
                          <div className="bg-gray-800/50 rounded p-2 text-center">
                            <p className="text-gray-500">Latency</p>
                            <p className="text-white font-mono">
                              {(qualityMetrics.roundTripTime * 1000).toFixed(0)}ms
                            </p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-2 text-center">
                            <p className="text-gray-500">Packet Loss</p>
                            <p className="text-white font-mono">
                              {qualityMetrics.packetLossRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-2 text-center">
                            <p className="text-gray-500">Bitrate</p>
                            <p className="text-white font-mono">
                              {(qualityMetrics.bitrate / 1000).toFixed(0)} kbps
                            </p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-2 text-center">
                            <p className="text-gray-500">Resolution</p>
                            <p className="text-white font-mono">
                              {qualityMetrics.resolution.width}x{qualityMetrics.resolution.height}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={toggleMute}
                          className={`p-3 rounded-full transition-colors ${
                            callControls.isMuted
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-gray-700 hover:bg-gray-600"
                          }`}
                          title={callControls.isMuted ? "Unmute" : "Mute"}
                        >
                          {callControls.isMuted ? (
                            <MicOff className="w-5 h-5" />
                          ) : (
                            <Mic className="w-5 h-5" />
                          )}
                        </button>

                        {activeCall.type === "video" && (
                          <>
                            <button
                              onClick={toggleVideo}
                              className={`p-3 rounded-full transition-colors ${
                                !callControls.isVideoEnabled
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-gray-700 hover:bg-gray-600"
                              }`}
                              title={callControls.isVideoEnabled ? "Disable Video" : "Enable Video"}
                            >
                              {callControls.isVideoEnabled ? (
                                <Video className="w-5 h-5" />
                              ) : (
                                <VideoOff className="w-5 h-5" />
                              )}
                            </button>

                            <button
                              onClick={switchCamera}
                              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                              title="Switch Camera"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={endCall}
                          className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                          title="End Call"
                        >
                          <PhoneOff className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {activeCall.type === "video" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                          <p className="text-xs text-gray-400 mb-2">Your Camera</p>
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full aspect-video bg-gray-800 rounded-lg object-cover"
                          />
                          {!callControls.isVideoEnabled && (
                            <div className="absolute inset-0 mt-6 flex items-center justify-center bg-gray-800 rounded-lg">
                              <VideoOff className="w-10 h-10 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <p className="text-xs text-gray-400 mb-2">Remote Video</p>
                          <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full aspect-video bg-gray-800 rounded-lg object-cover"
                          />
                          {!remoteStream && (
                            <div className="absolute inset-0 flex items-center justify-center mt-6">
                              <div className="text-center">
                                <Users className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">Waiting for peer...</p>
                                <p className="text-gray-600 text-xs mt-1">Share the room code to connect</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeCall.type === "audio" && (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <div className="w-24 h-24 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-green-500/20">
                            <Phone className="w-12 h-12" />
                          </div>
                          <p className="text-lg font-medium text-white mb-1">HD Audio Call</p>
                          <p className="text-gray-400 text-sm">
                            {remoteStream ? "Connected" : "Waiting for peer to join..."}
                          </p>
                          <audio ref={remoteAudioRef} autoPlay />
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Room ID:</span>
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-900 px-2 py-1 rounded text-xs font-mono text-green-400">
                            {activeCall.roomId}
                          </code>
                          <button
                            onClick={copyRoomId}
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!isConnected ? (
                      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-800/50 rounded-xl p-6">
                        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                          <User className="w-5 h-5 text-purple-400" />
                          Connect to Start
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                          Enter your display name to connect and see online users.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your display name"
                            className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            onClick={() => {
                              const name = displayName || "User";
                              localStorage.setItem("cyrus-display-name", name);
                              connectPresence(name);
                            }}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                          >
                            {isConnected ? "Reconnect" : "Connect"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Circle className="w-3 h-3 text-green-500 fill-green-500" />
                            <span className="text-sm text-green-400">Connected</span>
                            {myUserId && <span className="text-xs text-gray-500">({myUserId.substring(0, 12)}...)</span>}
                          </div>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <button
                            onClick={() => setCallSubTab("online")}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              callSubTab === "online"
                                ? "bg-green-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            <Users className="w-4 h-4" />
                            Online ({onlineUsers.length})
                          </button>
                          <button
                            onClick={() => setCallSubTab("contacts")}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              callSubTab === "contacts"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            <Star className="w-4 h-4" />
                            Contacts ({contacts.length})
                          </button>
                          <button
                            onClick={() => setCallSubTab("room")}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              callSubTab === "room"
                                ? "bg-purple-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            <PhoneCall className="w-4 h-4" />
                            Room
                          </button>
                        </div>

                        {callSubTab === "online" && (
                          <div className="space-y-2">
                            {onlineUsers.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No other users online</p>
                                <p className="text-xs mt-1">Share the app link to invite others</p>
                              </div>
                            ) : (
                              onlineUsers.map((user) => (
                                <div
                                  key={user.id}
                                  className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                      <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="font-medium">{user.displayName}</p>
                                      <div className="flex items-center gap-1 text-xs">
                                        {user.inCall ? (
                                          <span className="text-yellow-400">In a call</span>
                                        ) : (
                                          <span className="text-green-400">Available</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("[CallButton] Audio call clicked for:", user.displayName);
                                        callUser(user.id, user.displayName, "audio");
                                      }}
                                      disabled={user.inCall}
                                      className="p-2 bg-green-600 hover:bg-green-700 rounded-full disabled:opacity-50 transition-colors cursor-pointer z-10"
                                      title="Audio Call"
                                    >
                                      <Phone className="w-4 h-4 pointer-events-none" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("[CallButton] Video call clicked for:", user.displayName);
                                        callUser(user.id, user.displayName, "video");
                                      }}
                                      disabled={user.inCall}
                                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full disabled:opacity-50 transition-colors cursor-pointer z-10"
                                      title="Video Call"
                                    >
                                      <Video className="w-4 h-4 pointer-events-none" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addContact.mutate({ contactId: user.id, contactName: user.displayName })}
                                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors cursor-pointer z-10"
                                      title="Add to Contacts"
                                    >
                                      <UserPlus className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {callSubTab === "contacts" && (
                          <div className="space-y-2">
                            {contacts.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No contacts saved</p>
                                <p className="text-xs mt-1">Add users from the Online tab</p>
                              </div>
                            ) : (
                              contacts.map((contact) => (
                                <div
                                  key={contact.id}
                                  className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                                      <Star className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="font-medium">{contact.contactName}</p>
                                      {contact.contactEmail && (
                                        <p className="text-xs text-gray-400">{contact.contactEmail}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("[CallButton] Audio call clicked for contact:", contact.contactName);
                                        callUser(contact.contactId, contact.contactName, "audio");
                                      }}
                                      className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors cursor-pointer z-10"
                                      title="Audio Call"
                                    >
                                      <Phone className="w-4 h-4 pointer-events-none" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("[CallButton] Video call clicked for contact:", contact.contactName);
                                        callUser(contact.contactId, contact.contactName, "video");
                                      }}
                                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors cursor-pointer z-10"
                                      title="Video Call"
                                    >
                                      <Video className="w-4 h-4 pointer-events-none" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteContact.mutate(contact.id)}
                                      className="p-2 bg-red-600/50 hover:bg-red-600 rounded-full transition-colors cursor-pointer z-10"
                                      title="Remove Contact"
                                    >
                                      <Trash2 className="w-4 h-4 pointer-events-none" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {callSubTab === "room" && (
                          <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/50 rounded-xl p-6">
                            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                              <Signal className="w-5 h-5 text-blue-400" />
                              Room-Based Calling
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                              Create or join a call room using a room code.
                            </p>

                            <div className="flex gap-2 mb-4">
                              <button
                                onClick={() => setCallMode("create")}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  callMode === "create"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-800 text-gray-400 hover:text-white"
                                }`}
                              >
                                Create Room
                              </button>
                              <button
                                onClick={() => setCallMode("join")}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  callMode === "join"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-800 text-gray-400 hover:text-white"
                                }`}
                              >
                                Join Room
                              </button>
                            </div>

                            <input
                              type="text"
                              value={callInput}
                              onChange={(e) => setCallInput(e.target.value)}
                              placeholder={
                                callMode === "create"
                                  ? "Room name (optional)"
                                  : "Enter room code to join"
                              }
                              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            />

                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleStartCall("audio")}
                                disabled={callMode === "join" && !callInput.trim()}
                                className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-xl font-medium disabled:opacity-50 transition-all shadow-lg shadow-green-500/20"
                              >
                                <Phone className="w-5 h-5" />
                                HD Audio
                              </button>
                              <button
                                onClick={() => handleStartCall("video")}
                                disabled={callMode === "join" && !callInput.trim()}
                                className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl font-medium disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                              >
                                <Video className="w-5 h-5" />
                                HD Video
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                        <Wifi className="w-6 h-6 mx-auto mb-2 text-green-400" />
                        <p className="text-xs text-gray-400">Global STUN/TURN</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                        <Volume2 className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                        <p className="text-xs text-gray-400">Noise Suppression</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                        <Signal className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                        <p className="text-xs text-gray-400">Adaptive Bitrate</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                        <RotateCcw className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                        <p className="text-xs text-gray-400">Auto Reconnect</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      <CyrusHumanoid
        module="communications"
        context={`User is in communications module. Active tab: ${activeTab}. ${
          activeCall
            ? `Call in progress: ${activeCall.type} call, status: ${activeCall.status}, quality: ${activeCall.qualityPreset || "unknown"}`
            : "No active call"
        }`}
        compact={true}
      />
    </div>
  );
}
