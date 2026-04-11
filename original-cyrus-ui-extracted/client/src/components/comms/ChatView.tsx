import { useEffect, useRef } from "react";
import {
  Phone,
  Video,
  MoreVertical,
  Users,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { MessageBubble, CommsMessage } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

interface ChatViewProps {
  conversationId: string | null;
  conversationName: string;
  isGroup: boolean;
  isOnline?: boolean;
  participantCount?: number;
  messages: CommsMessage[];
  currentUserId: string;
  typingUsers?: string[];
  onSendMessage: (content: string) => void;
  onSendMedia?: (file: File) => void;
  onSendVoice?: (blob: Blob, duration: number) => void;
  onSendLocation?: () => void;
  onToggleEmoji?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onReact?: (messageId: string, emoji: string) => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  onBack?: () => void;
}

export function ChatView({
  conversationId,
  conversationName,
  isGroup,
  isOnline,
  participantCount,
  messages,
  currentUserId,
  typingUsers = [],
  onSendMessage,
  onSendMedia,
  onSendVoice,
  onSendLocation,
  onToggleEmoji,
  onTypingStart,
  onTypingStop,
  onReact,
  onAudioCall,
  onVideoCall,
  onBack,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950/30 text-gray-500">
        <div className="w-20 h-20 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-gray-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-400 mb-1">Select a Conversation</h3>
        <p className="text-sm text-gray-500">Choose a chat from the sidebar to start messaging</p>
      </div>
    );
  }

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const statusText = isGroup
    ? `${participantCount || 0} participants`
    : isOnline
      ? "Online"
      : "Offline";

  const groupByDate = (msgs: CommsMessage[]) => {
    const groups: { label: string; messages: CommsMessage[] }[] = [];
    let currentLabel = "";
    for (const msg of msgs) {
      const d = new Date(msg.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let label: string;
      if (d.toDateString() === today.toDateString()) {
        label = "Today";
      } else if (d.toDateString() === yesterday.toDateString()) {
        label = "Yesterday";
      } else {
        label = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
      }
      if (label !== currentLabel) {
        groups.push({ label, messages: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].messages.push(msg);
    }
    return groups;
  };

  const dateGroups = groupByDate(messages);

  return (
    <div className="flex flex-col h-full bg-gray-950/30">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/80 border-b border-gray-800/50 backdrop-blur-md">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
            {isGroup ? <Users className="w-5 h-5" /> : getInitials(conversationName)}
          </div>
          {!isGroup && isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{conversationName}</h3>
          <p className={`text-xs ${isOnline ? "text-emerald-400" : "text-gray-500"}`}>
            {statusText}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onAudioCall && (
            <button
              onClick={onAudioCall}
              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
            >
              <Phone className="w-5 h-5" />
            </button>
          )}
          {onVideoCall && (
            <button
              onClick={onVideoCall}
              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
            >
              <Video className="w-5 h-5" />
            </button>
          )}
          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          dateGroups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[10px] text-gray-500 bg-gray-800/60 px-3 py-1 rounded-full">
                  {group.label}
                </span>
              </div>
              {group.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === currentUserId}
                  onReact={onReact}
                />
              ))}
            </div>
          ))
        )}

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-gray-400">
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}
      </div>

      <MessageInput
        onSend={onSendMessage}
        onSendMedia={onSendMedia}
        onSendVoice={onSendVoice}
        onSendLocation={onSendLocation}
        onToggleEmoji={onToggleEmoji}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        disabled={!conversationId}
      />
    </div>
  );
}
