import { useState, useEffect, useRef } from "react";
import { useComms } from "../hooks/useComms";
import { CyrusAssistant } from "../components/CyrusAssistant";
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
} from "lucide-react";

type TabType = "messages" | "reminders" | "news" | "calls";

export function CommsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("messages");
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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const {
    messages,
    reminders,
    news,
    activeCall,
    localStream,
    remoteStream,
    callControls,
    qualityMetrics,
    sendMessage,
    addReminder,
    completeReminder,
    deleteReminder,
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    getAudioLevel,
    isLoading,
  } = useComms();

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
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Communications</h1>
          <p className="text-gray-400">Enterprise-grade messaging and HD calling</p>
        </header>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex border-b border-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
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
                    <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/50 rounded-xl p-6">
                      <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <Signal className="w-5 h-5 text-blue-400" />
                        Enterprise HD Calling
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Crystal-clear audio with echo cancellation, noise suppression, and adaptive bitrate optimization.
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
                          Create Call
                        </button>
                        <button
                          onClick={() => setCallMode("join")}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            callMode === "join"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-800 text-gray-400 hover:text-white"
                          }`}
                        >
                          Join Call
                        </button>
                      </div>

                      <input
                        type="text"
                        value={callInput}
                        onChange={(e) => setCallInput(e.target.value)}
                        placeholder={
                          callMode === "create"
                            ? "Enter participant name (optional)"
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
      <CyrusAssistant
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
