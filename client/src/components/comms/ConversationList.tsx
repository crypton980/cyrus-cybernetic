import { useState } from "react";
import {
  Search,
  Users,
  MessageSquare,
  Plus,
} from "lucide-react";

export interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatarColor?: string;
  participants?: string[];
  isOnline?: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  onCreateGroup?: () => void;
  onNewChat?: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreateGroup,
  onNewChat,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString([], { weekday: "short" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const gradients = [
    "from-cyan-500 to-blue-600",
    "from-purple-500 to-pink-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-indigo-500 to-violet-600",
    "from-rose-500 to-pink-600",
  ];

  const getGradient = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className="flex flex-col h-full bg-gray-950/50">
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Chats</h2>
          <div className="flex items-center gap-1">
            {onNewChat && (
              <button
                onClick={onNewChat}
                className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                title="New Chat"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}
            {onCreateGroup && (
              <button
                onClick={onCreateGroup}
                className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                title="New Group"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-gray-800/60 border border-gray-700/40 text-sm text-white placeholder-gray-500 pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-800">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">
              {search ? "No conversations found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                selectedId === conv.id
                  ? "bg-cyan-500/10 border border-cyan-500/20"
                  : "hover:bg-gray-800/50 border border-transparent"
              }`}
            >
              <div className="relative shrink-0">
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${getGradient(conv.id)} flex items-center justify-center text-white text-sm font-semibold shadow-md`}
                >
                  {conv.isGroup ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    getInitials(conv.name)
                  )}
                </div>
                {conv.isOnline && !conv.isGroup && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-gray-950" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-sm font-medium truncate ${
                      selectedId === conv.id ? "text-cyan-400" : "text-white"
                    }`}
                  >
                    {conv.name}
                  </span>
                  <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                    {formatTime(conv.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 truncate pr-2">{conv.lastMessage}</p>
                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center bg-cyan-500 text-[10px] font-bold text-white rounded-full px-1">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
