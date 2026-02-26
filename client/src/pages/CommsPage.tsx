import { useState, useEffect, useRef, useCallback } from "react";
import { useComms } from "../hooks/useComms";
import { usePresence } from "../contexts/PresenceContext";
import { Link } from "wouter";
import {
  MessageSquare,
  Phone,
  Users,
  Activity,
  Sun,
  Moon,
  ArrowLeft,
  Smile,
  X,
} from "lucide-react";
import { CommsPlatform } from "../components/comms/CommsPlatform";
import { Conversation } from "../components/comms/ConversationList";
import { CommsMessage } from "../components/comms/MessageBubble";
import { CallView, CallParticipant, IncomingCallOverlay } from "../components/comms/CallView";
import { UserDiscovery } from "../components/comms/UserDiscovery";
import { AdminDashboard } from "../components/comms/AdminDashboard";
import { EmojiPicker } from "../components/comms/EmojiPicker";

type MainTab = "chat" | "calls" | "people" | "monitor";

export function CommsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("chat");
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("cyrus-theme") !== "light";
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [callChatMessages, setCallChatMessages] = useState<
    { senderId: string; senderName: string; message: string; timestamp: string }[]
  >([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [selectedConvForMessage, setSelectedConvForMessage] = useState<string | null>(null);

  const {
    messages,
    contacts,
    allUsers,
    sendMessage,
    addContact,
    deleteContact,
    myDeviceId,
  } = useComms();

  const {
    onlineUsers,
    isConnected,
    myUserId,
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    mediaControls,
    callDuration,
    connectPresence,
    callUser,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    sendMessage: presenceSendMessage,
    wsRef,
  } = usePresence();

  useEffect(() => {
    const savedName = localStorage.getItem("cyrus-display-name") || "CYRUS User";
    setDisplayName(savedName);
    if (!isConnected) {
      connectPresence(savedName);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cyrus-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket) return;

    const handleTypingStart = (data: { userId: string; userName: string; conversationId: string }) => {
      setTypingUsers(prev => {
        const users = prev[data.conversationId] || [];
        if (!users.includes(data.userName)) {
          return { ...prev, [data.conversationId]: [...users, data.userName] };
        }
        return prev;
      });
    };

    const handleTypingStop = (data: { userId: string; userName: string; conversationId: string }) => {
      setTypingUsers(prev => {
        const users = (prev[data.conversationId] || []).filter(u => u !== data.userName);
        return { ...prev, [data.conversationId]: users };
      });
    };

    const handleCallChatMessage = (data: { senderId: string; senderName: string; message: string; timestamp: string }) => {
      setCallChatMessages(prev => [...prev, data]);
    };

    socket.on("typing-started", handleTypingStart);
    socket.on("typing-stopped", handleTypingStop);
    socket.on("call-chat-message", handleCallChatMessage);

    return () => {
      socket.off("typing-started", handleTypingStart);
      socket.off("typing-stopped", handleTypingStop);
      socket.off("call-chat-message", handleCallChatMessage);
    };
  }, [wsRef.current]);

  const conversations: Conversation[] = (() => {
    const convMap = new Map<string, Conversation>();
    const msgList = messages || [];
    for (const msg of msgList) {
      const partnerId = msg.senderId === myDeviceId ? msg.recipientId : msg.senderId;
      if (partnerId === "broadcast" || !partnerId) continue;
      const existing = convMap.get(partnerId);
      const partnerUser = allUsers.find(u => u.id === partnerId);
      const partnerOnline = onlineUsers.find(u => u.id === partnerId);
      const name = partnerUser?.displayName || partnerOnline?.displayName || partnerId.substring(0, 12) + "...";
      const isOnline = partnerUser?.isOnline || !!partnerOnline;

      if (!existing || new Date(msg.timestamp) > new Date(existing.lastMessageTime)) {
        const unread = (existing?.unreadCount || 0) + (msg.senderId !== myDeviceId && !msg.read ? 1 : 0);
        convMap.set(partnerId, {
          id: partnerId,
          name,
          isGroup: false,
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          unreadCount: unread,
          isOnline,
        });
      }
    }
    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
  })();

  const commsMessages: CommsMessage[] = (messages || []).map(msg => ({
    id: msg.id,
    senderId: msg.senderId,
    senderName: msg.senderId === myDeviceId ? displayName : (
      allUsers.find(u => u.id === msg.senderId)?.displayName ||
      onlineUsers.find(u => u.id === msg.senderId)?.displayName ||
      msg.senderId.substring(0, 10)
    ),
    recipientId: msg.recipientId,
    content: msg.content,
    timestamp: msg.timestamp,
    read: msg.read,
    type: "text" as const,
  }));

  const handleSendMessage = useCallback((conversationId: string, content: string) => {
    if (!content.trim()) return;
    presenceSendMessage(conversationId, content);
    sendMessage.mutate({ recipientId: conversationId, content });
  }, [presenceSendMessage, sendMessage]);

  const handleSendMedia = useCallback(async (conversationId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/comms/upload", {
        method: "POST",
        body: formData,
        headers: { "X-Device-Id": myDeviceId },
      });
      if (res.ok) {
        const data = await res.json();
        const mediaMsg = file.type.startsWith("image/")
          ? `📷 ${data.fileName}`
          : `📎 ${data.fileName}`;
        presenceSendMessage(conversationId, mediaMsg);
        sendMessage.mutate({ recipientId: conversationId, content: mediaMsg });
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
  }, [myDeviceId, presenceSendMessage, sendMessage]);

  const handleSendVoice = useCallback(async (conversationId: string, blob: Blob, duration: number) => {
    const formData = new FormData();
    formData.append("file", blob, `voice_${Date.now()}.webm`);
    try {
      const res = await fetch("/api/comms/voice-note", {
        method: "POST",
        body: formData,
        headers: { "X-Device-Id": myDeviceId },
      });
      if (res.ok) {
        const data = await res.json();
        const voiceMsg = `🎤 Voice note (${Math.round(duration)}s)`;
        presenceSendMessage(conversationId, voiceMsg);
        sendMessage.mutate({ recipientId: conversationId, content: voiceMsg });
      }
    } catch (err) {
      console.error("Voice upload failed:", err);
    }
  }, [myDeviceId, presenceSendMessage, sendMessage]);

  const handleSendLocation = useCallback((conversationId: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const locationMsg = `📍 Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        presenceSendMessage(conversationId, locationMsg);
        sendMessage.mutate({ recipientId: conversationId, content: locationMsg });
      },
      (err) => console.error("Location error:", err),
      { enableHighAccuracy: true }
    );
  }, [presenceSendMessage, sendMessage]);

  const handleTypingStart = useCallback((conversationId: string) => {
    wsRef.current?.emit("typing-start", { targetUserId: conversationId, conversationId });
  }, [wsRef]);

  const handleTypingStop = useCallback((conversationId: string) => {
    wsRef.current?.emit("typing-stop", { targetUserId: conversationId, conversationId });
  }, [wsRef]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    wsRef.current?.emit("message-reaction", { messageId, emoji });
  }, [wsRef]);

  const handleAudioCall = useCallback((conversationId: string, name: string) => {
    callUser(conversationId, name, "audio");
    setActiveTab("chat");
  }, [callUser]);

  const handleVideoCall = useCallback((conversationId: string, name: string) => {
    callUser(conversationId, name, "video");
    setActiveTab("chat");
  }, [callUser]);

  const handleCreateGroup = useCallback(() => {
    // TODO: Group creation modal
  }, []);

  const handleAddContact = useCallback((contact: { contactId: string; contactName: string }) => {
    addContact.mutate(contact);
  }, [addContact]);

  const handleRemoveContact = useCallback((contactId: string) => {
    deleteContact.mutate(contactId);
  }, [deleteContact]);

  const handleUserMessage = useCallback((userId: string, userName: string) => {
    setSelectedConvForMessage(userId);
    setActiveTab("chat");
  }, []);

  const handleUserCall = useCallback((userId: string, userName: string, type: "audio" | "video") => {
    callUser(userId, userName, type);
  }, [callUser]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setShowEmojiPicker(false);
  }, []);

  const handleScreenShareStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      wsRef.current?.emit("screen-share-start", {
        roomId: activeCall?.roomId,
      });
      stream.getVideoTracks()[0].onended = () => {
        wsRef.current?.emit("screen-share-stop", { roomId: activeCall?.roomId });
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  }, [wsRef, activeCall]);

  const handleScreenShareStop = useCallback(() => {
    wsRef.current?.emit("screen-share-stop", { roomId: activeCall?.roomId });
  }, [wsRef, activeCall]);

  const handleCallChatSend = useCallback((message: string) => {
    if (!activeCall?.roomId || !myUserId) return;
    wsRef.current?.emit("call-chat-message", {
      roomId: activeCall.roomId,
      message,
      timestamp: new Date().toISOString(),
    });
    setCallChatMessages(prev => [...prev, {
      senderId: myUserId,
      senderName: displayName,
      message,
      timestamp: new Date().toISOString(),
    }]);
  }, [wsRef, activeCall, myUserId, displayName]);

  const callParticipants: CallParticipant[] = activeCall
    ? [
        {
          id: activeCall.peerId,
          displayName: activeCall.peerName,
          stream: remoteStream || undefined,
          isMuted: false,
          isVideoEnabled: activeCall.callType === "video",
          connectionQuality: "good" as const,
        },
      ]
    : [];

  const tabConfig = [
    { id: "chat" as MainTab, icon: MessageSquare, label: "Chat" },
    { id: "calls" as MainTab, icon: Phone, label: "Calls" },
    { id: "people" as MainTab, icon: Users, label: "People" },
    { id: "monitor" as MainTab, icon: Activity, label: "Monitor" },
  ];

  const themeClass = darkMode ? "" : "light-theme";

  return (
    <div className={`h-full flex flex-col bg-black/95 ${themeClass}`}>
      {activeCall && activeCall.status === "connected" && (
        <CallView
          roomId={activeCall.roomId}
          callType={activeCall.callType}
          participants={callParticipants}
          localStream={localStream}
          currentUserId={myUserId || ""}
          currentUserName={displayName}
          isMuted={mediaControls.isMuted}
          isVideoEnabled={mediaControls.isVideoEnabled}
          callDuration={callDuration}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
          onStartScreenShare={handleScreenShareStart}
          onStopScreenShare={handleScreenShareStop}
          onSendChatMessage={handleCallChatSend}
          chatMessages={callChatMessages}
          socketRef={wsRef}
        />
      )}

      {incomingCall && (
        <IncomingCallOverlay
          callerName={incomingCall.callerName}
          callType={incomingCall.callType}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-900/30 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="p-1.5 rounded-lg hover:bg-cyan-900/30 text-cyan-400 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-cyan-400 tracking-wide">NEXUS COMMS</h1>
            <p className="text-[10px] text-cyan-600/70 font-mono uppercase tracking-widest">
              {isConnected ? "Connected" : "Connecting..."} · {onlineUsers.length} online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-900/60 rounded-lg p-0.5 border border-cyan-900/20">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-cyan-600/20 text-cyan-400 shadow-lg shadow-cyan-500/10"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg hover:bg-cyan-900/30 text-gray-500 hover:text-cyan-400 transition-colors"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-900/40 border border-cyan-900/20">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] text-gray-500 font-mono">
              {displayName.substring(0, 12)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <CommsPlatform
            conversations={conversations}
            messages={commsMessages}
            currentUserId={myDeviceId}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onSendMedia={handleSendMedia}
            onSendVoice={handleSendVoice}
            onSendLocation={handleSendLocation}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onReact={handleReact}
            onAudioCall={handleAudioCall}
            onVideoCall={handleVideoCall}
            onCreateGroup={handleCreateGroup}
          />
        )}

        {activeTab === "people" && (
          <div className="h-full overflow-y-auto p-4">
            <UserDiscovery
              onlineUsers={onlineUsers}
              allUsers={allUsers}
              contacts={contacts}
              myDeviceId={myDeviceId}
              onMessage={handleUserMessage}
              onCall={handleUserCall}
              onAddContact={handleAddContact}
              onRemoveContact={handleRemoveContact}
            />
          </div>
        )}

        {activeTab === "monitor" && (
          <div className="h-full overflow-y-auto">
            <AdminDashboard />
          </div>
        )}

        {activeTab === "calls" && (
          <div className="h-full overflow-y-auto p-4">
            <CallHistoryPanel
              myDeviceId={myDeviceId}
              allUsers={allUsers}
              onlineUsers={onlineUsers}
              onCall={handleUserCall}
            />
          </div>
        )}
      </div>

      {showEmojiPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEmojiPicker(false)} />
          <div className="relative z-10 mb-20">
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CallHistoryPanel({
  myDeviceId,
  allUsers,
  onlineUsers,
  onCall,
}: {
  myDeviceId: string;
  allUsers: { id: string; displayName: string; isOnline: boolean; lastSeen: string | null; status: string }[];
  onlineUsers: { id: string; displayName: string; deviceId: string; inCall: boolean }[];
  onCall: (userId: string, userName: string, type: "audio" | "video") => void;
}) {
  const onlineOthers = onlineUsers.filter(u => u.id !== myDeviceId && u.id !== "cyrus-001");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Quick Call
        </h3>
        <p className="text-xs text-gray-500 mb-4">Select an online user to start a call</p>

        {onlineOthers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No other users online</p>
            <p className="text-gray-600 text-xs mt-1">Users will appear here when they connect</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {onlineOthers.map(user => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-900/40 border border-cyan-900/20 hover:border-cyan-700/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-gray-900" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{user.displayName}</p>
                    <p className="text-xs text-gray-500">
                      {user.inCall ? "In a call" : "Available"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onCall(user.id, user.displayName, "audio")}
                    disabled={user.inCall}
                    className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-40"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onCall(user.id, user.displayName, "video")}
                    disabled={user.inCall}
                    className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors disabled:opacity-40"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Call Features
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "HD Voice", desc: "Crystal-clear audio", color: "emerald" },
            { label: "HD Video", desc: "1080p video calls", color: "blue" },
            { label: "Screen Share", desc: "Share your screen", color: "purple" },
            { label: "Group Calls", desc: "Up to 6 participants", color: "amber" },
            { label: "In-Call Chat", desc: "Message during calls", color: "cyan" },
            { label: "E2E Encrypted", desc: "Secure communication", color: "red" },
          ].map((feature) => (
            <div
              key={feature.label}
              className={`p-3 rounded-lg bg-gray-900/40 border border-${feature.color}-900/20`}
            >
              <p className={`text-sm font-medium text-${feature.color}-400`}>{feature.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
