import { useState } from "react";
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
  const [callPeerId, setCallPeerId] = useState("");

  const {
    messages,
    reminders,
    news,
    activeCall,
    sendMessage,
    addReminder,
    completeReminder,
    deleteReminder,
    startCall,
    endCall,
    isLoading,
  } = useComms();

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

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Communications</h1>
          <p className="text-gray-400">Messages, reminders, news, and calls</p>
        </header>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex border-b border-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
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
                    className="flex-[2] bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendMessage.isPending}
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-auto">
                  {messages.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No messages</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-gray-800 rounded-lg p-3 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {msg.senderId[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{msg.senderId}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {!isLoading && activeTab === "reminders" && (
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={newReminder.title}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, title: e.target.value })
                      }
                      placeholder="Title"
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="datetime-local"
                      value={newReminder.dueAt}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, dueAt: e.target.value })
                      }
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newReminder.description}
                      onChange={(e) =>
                        setNewReminder({
                          ...newReminder,
                          description: e.target.value,
                        })
                      }
                      placeholder="Description (optional)"
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={newReminder.priority}
                      onChange={(e) =>
                        setNewReminder({
                          ...newReminder,
                          priority: e.target.value as "low" | "medium" | "high",
                        })
                      }
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <button
                      onClick={handleAddReminder}
                      disabled={addReminder.isPending}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-auto">
                  {reminders.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No reminders</p>
                  ) : (
                    reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`bg-gray-800 rounded-lg p-3 border-l-4 ${getPriorityColor(
                          reminder.priority
                        )} ${reminder.completed ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p
                              className={`font-medium ${
                                reminder.completed ? "line-through" : ""
                              }`}
                            >
                              {reminder.title}
                            </p>
                            {reminder.description && (
                              <p className="text-sm text-gray-400">
                                {reminder.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {new Date(reminder.dueAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {!reminder.completed && (
                              <button
                                onClick={() => completeReminder.mutate(reminder.id)}
                                className="p-1 text-green-400 hover:text-green-300"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteReminder.mutate(reminder.id)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {!isLoading && activeTab === "news" && (
              <div className="space-y-3 max-h-96 overflow-auto">
                {news.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No news available</p>
                ) : (
                  news.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Newspaper className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {item.summary}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <span>{item.source}</span>
                            <span>•</span>
                            <span>
                              {new Date(item.publishedAt).toLocaleDateString()}
                            </span>
                            <span className="ml-auto px-2 py-0.5 bg-gray-700 rounded">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            )}

            {!isLoading && activeTab === "calls" && (
              <div className="space-y-4">
                {activeCall ? (
                  <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-400">
                          {activeCall.type === "video" ? "Video" : "Audio"} Call
                        </p>
                        <p className="text-sm text-gray-400">
                          With: {activeCall.peerId}
                        </p>
                        <p className="text-xs text-gray-500">
                          Status: {activeCall.status}
                        </p>
                      </div>
                      <button
                        onClick={endCall}
                        className="p-3 bg-red-600 hover:bg-red-700 rounded-full"
                      >
                        <PhoneOff className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={callPeerId}
                      onChange={(e) => setCallPeerId(e.target.value)}
                      placeholder="Enter peer ID to call"
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => startCall(callPeerId, "audio")}
                        disabled={!callPeerId.trim()}
                        className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                        Audio Call
                      </button>
                      <button
                        onClick={() => startCall(callPeerId, "video")}
                        disabled={!callPeerId.trim()}
                        className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                      >
                        <Video className="w-5 h-5" />
                        Video Call
                      </button>
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
        context={`User is in communications module. Active tab: ${activeTab}. ${activeCall ? "Call in progress" : "No active call"}`}
        compact={true}
      />
    </div>
  );
}
