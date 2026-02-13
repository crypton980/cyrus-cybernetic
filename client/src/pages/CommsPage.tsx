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
  X,
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
    activeCall: localActiveCall,
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
    endCall: localEndCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    getAudioLevel,
    isLoading,
  } = useComms();
  
  const { 
    onlineUsers, 
    isConnected, 
    myUserId, 
    incomingCall,
    activeCall: presenceActiveCall,
    notifications,
    callUser,
    acceptCall,
    declineCall,
    endCall: presenceEndCall,
    clearNotification,
  } = usePresence();

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

  const handleAcceptCall = () => {
    console.log("[CommsPage] Accept button clicked");
    acceptCall();
  };

  const handleDeclineCall = () => {
    console.log("[CommsPage] Decline button clicked");
    declineCall();
  };

  const handleCallUser = (userId: string, userName: string, type: "audio" | "video") => {
    console.log(`[CommsPage] Calling ${userName} (${userId}) - ${type}`);
    callUser(userId, userName, type);
  };

  const copyRoomId = () => {
    if (localActiveCall?.roomId) {
      navigator.clipboard.writeText(localActiveCall.roomId);
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

  const getNotifColor = (type: string) => {
    switch (type) {
      case "success": return "bg-green-900/90 border-green-500/50 text-green-300";
      case "error": return "bg-red-900/90 border-red-500/50 text-red-300";
      case "warning": return "bg-yellow-900/90 border-yellow-500/50 text-yellow-300";
      default: return "bg-blue-900/90 border-blue-500/50 text-blue-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-[100000] flex flex-col gap-2 max-w-sm">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`px-4 py-3 rounded-lg border backdrop-blur-sm shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-right ${getNotifColor(notif.type)}`}
            >
              <span className="text-sm font-medium">{notif.message}</span>
              <button
                onClick={() => clearNotification(notif.id)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {incomingCall && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.95)' }}
        >
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 max-w-sm w-[90%] text-center border border-green-500/30 shadow-2xl shadow-green-500/10">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <PhoneIncoming className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Incoming Call
            </h3>
            <p className="text-gray-200 text-lg mb-1">
              {incomingCall.callerName}
            </p>
            <p className="text-gray-400 text-sm mb-8">
              {incomingCall.callType === "video" ? "HD Video" : "HD Audio"} Call
            </p>
            <div className="flex gap-8 justify-center">
              <button
                type="button"
                onClick={handleDeclineCall}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-700 border-2 border-white/30 flex items-center justify-center shadow-xl shadow-red-500/40 hover:from-red-500 hover:to-red-600 active:scale-95 transition-all cursor-pointer"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <button
                type="button"
                onClick={handleAcceptCall}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-700 border-2 border-white/30 flex items-center justify-center shadow-xl shadow-green-500/40 hover:from-green-500 hover:to-green-600 active:scale-95 transition-all cursor-pointer"
              >
                <Phone className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {presenceActiveCall && presenceActiveCall.status === "ringing" && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 99998, backgroundColor: 'rgba(0,0,0,0.9)' }}
        >
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 max-w-sm w-[90%] text-center border border-blue-500/30 shadow-2xl">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <PhoneCall className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Calling...</h3>
            <p className="text-gray-200 text-lg mb-6">{presenceActiveCall.peerName}</p>
            <p className="text-gray-400 text-sm mb-8 animate-pulse">Ringing...</p>
            <button
              type="button"
              onClick={() => presenceEndCall()}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-700 border-2 border-white/30 flex items-center justify-center mx-auto shadow-xl shadow-red-500/40 hover:from-red-500 hover:to-red-600 active:scale-95 transition-all cursor-pointer"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>
        </div>
      )}

      {presenceActiveCall && presenceActiveCall.status === "connected" && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 99997, backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 max-w-md w-[90%] text-center border border-green-500/30 shadow-2xl">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Connected</h3>
            <p className="text-green-400 text-lg mb-6">{presenceActiveCall.peerName}</p>
            <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-8">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Call in progress
            </div>
            <button
              type="button"
              onClick={() => presenceEndCall()}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-700 border-2 border-white/30 flex items-center justify-center mx-auto shadow-xl shadow-red-500/40 hover:from-red-500 hover:to-red-600 active:scale-95 transition-all cursor-pointer"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
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
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
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
                        onClick={() => handleCallUser(user.id, user.displayName, "audio")}
                        disabled={user.inCall}
                        className="p-2.5 bg-green-600 hover:bg-green-500 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 cursor-pointer"
                        title="Start Audio Call"
                      >
                        <Phone className="w-4 h-4 text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCallUser(user.id, user.displayName, "video")}
                        disabled={user.inCall}
                        className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                        title="Start Video Call"
                      >
                        <Video className="w-4 h-4 text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewMessage({ ...newMessage, recipient: user.displayName });
                          setActiveTab("messages");
                        }}
                        className="p-2.5 bg-purple-600 hover:bg-purple-500 rounded-full transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
                        title="Send Message"
                      >
                        <MessageSquare className="w-4 h-4 text-white" />
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
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-gray-800 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-blue-400 text-sm">
                            {msg.senderId === "self" ? "You" : msg.senderId}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-200 text-sm">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === "reminders" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newReminder.title}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, title: e.target.value })
                    }
                    placeholder="Reminder title"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <textarea
                    value={newReminder.description}
                    onChange={(e) =>
                      setNewReminder({ ...newReminder, description: e.target.value })
                    }
                    placeholder="Description (optional)"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={newReminder.dueAt}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, dueAt: e.target.value })
                      }
                      className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                      value={newReminder.priority}
                      onChange={(e) =>
                        setNewReminder({
                          ...newReminder,
                          priority: e.target.value as "low" | "medium" | "high",
                        })
                      }
                      className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <button
                      onClick={handleAddReminder}
                      className="p-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {reminders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No reminders set</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`bg-gray-800 rounded-lg p-3 border-l-4 ${getPriorityColor(
                          reminder.priority
                        )}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{reminder.title}</h4>
                            {reminder.description && (
                              <p className="text-sm text-gray-400 mt-1">
                                {reminder.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(reminder.dueAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => completeReminder.mutate(reminder.id)}
                              className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteReminder.mutate(reminder.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
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
              <div className="space-y-3">
                {news.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Newspaper className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No news articles</p>
                  </div>
                ) : (
                  news.map((article) => (
                    <div
                      key={article.id}
                      className="bg-gray-800 rounded-lg p-4"
                    >
                      <h3 className="font-medium text-white mb-1">
                        {article.title}
                      </h3>
                      <p className="text-sm text-gray-400 mb-2">
                        {article.summary}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{article.source}</span>
                        <span>
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!isLoading && activeTab === "calls" && (
              <div className="space-y-6">
                {localActiveCall ? (
                  <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-800/50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(localActiveCall.status)}`} />
                        <h3 className="text-lg font-medium">
                          {localActiveCall.status === "connected" ? "In Call" : localActiveCall.status}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {getQualityIcon()}
                        <span className="text-sm text-gray-400">
                          Room: {localActiveCall.roomId.slice(0, 8)}...
                        </span>
                        <button
                          onClick={copyRoomId}
                          className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                          title="Copy Room ID"
                        >
                          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {localActiveCall.type === "video" && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-0.5 rounded">You</span>
                        </div>
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                          <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-0.5 rounded">Remote</span>
                        </div>
                      </div>
                    )}

                    {localActiveCall.type === "audio" && (
                      <audio ref={remoteAudioRef} autoPlay />
                    )}

                    <div className="flex justify-center gap-3">
                      {callControls && (
                        <>
                          <button
                            onClick={toggleMute}
                            className={`p-3 rounded-full transition-colors ${callControls.isMuted ? 'bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}
                          >
                            {callControls.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                          </button>
                          {localActiveCall.type === "video" && (
                            <button
                              onClick={toggleVideo}
                              className={`p-3 rounded-full transition-colors ${!callControls.isVideoEnabled ? 'bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}
                            >
                              {!callControls.isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={localEndCall}
                        className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                      >
                        <PhoneOff className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
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
                                  onClick={() => handleCallUser(user.id, user.displayName, "audio")}
                                  disabled={user.inCall}
                                  className="p-2 bg-green-600 hover:bg-green-700 rounded-full disabled:opacity-50 transition-colors cursor-pointer"
                                  title="Audio Call"
                                >
                                  <Phone className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCallUser(user.id, user.displayName, "video")}
                                  disabled={user.inCall}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full disabled:opacity-50 transition-colors cursor-pointer"
                                  title="Video Call"
                                >
                                  <Video className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => addContact.mutate({ contactId: user.id, contactName: user.displayName })}
                                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors cursor-pointer"
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
                                  onClick={() => handleCallUser(contact.contactId, contact.contactName, "audio")}
                                  className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors cursor-pointer"
                                  title="Audio Call"
                                >
                                  <Phone className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCallUser(contact.contactId, contact.contactName, "video")}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors cursor-pointer"
                                  title="Video Call"
                                >
                                  <Video className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteContact.mutate(contact.id)}
                                  className="p-2 bg-red-600/50 hover:bg-red-600 rounded-full transition-colors cursor-pointer"
                                  title="Remove Contact"
                                >
                                  <Trash2 className="w-4 h-4" />
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
          </div>
        </div>
      </div>
      <CyrusHumanoid
        module="communications"
        context={`User is in communications module. Active tab: ${activeTab}. ${
          presenceActiveCall
            ? `Call in progress: ${presenceActiveCall.callType} call, status: ${presenceActiveCall.status}, peer: ${presenceActiveCall.peerName}`
            : "No active call"
        }`}
        compact={true}
      />
    </div>
  );
}
