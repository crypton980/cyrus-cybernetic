import { useState } from "react";
import {
  MapPin,
  Play,
  Pause,
  Check,
  CheckCheck,
  Image as ImageIcon,
  FileText,
  Info,
} from "lucide-react";

export type MessageType = "text" | "emoji" | "media" | "voice-note" | "location" | "system";

export interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface CommsMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: MessageType;
  mediaUrl?: string;
  mediaMimeType?: string;
  fileName?: string;
  duration?: number;
  latitude?: number;
  longitude?: number;
  reactions?: Reaction[];
}

interface MessageBubbleProps {
  message: CommsMessage;
  isOwn: boolean;
  onReact?: (messageId: string, emoji: string) => void;
}

export function MessageBubble({ message, isOwn, onReact }: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderContent = () => {
    switch (message.type) {
      case "system":
        return (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 italic py-1">
            <Info className="w-3 h-3" />
            <span>{message.content}</span>
          </div>
        );

      case "media":
        return (
          <div className="space-y-1.5">
            {message.mediaMimeType?.startsWith("image/") ? (
              <div className="rounded-lg overflow-hidden max-w-[240px]">
                <img
                  src={message.mediaUrl}
                  alt={message.fileName || "Image"}
                  className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                />
              </div>
            ) : (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{message.fileName || "File"}</p>
                  <p className="text-xs text-gray-400">{message.mediaMimeType}</p>
                </div>
              </a>
            )}
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        );

      case "voice-note":
        return <VoiceNoteInline duration={message.duration} url={message.mediaUrl} />;

      case "location":
        return (
          <a
            href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <MapPin className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">Shared Location</p>
              <p className="text-xs text-gray-400">
                {message.latitude?.toFixed(4)}, {message.longitude?.toFixed(4)}
              </p>
            </div>
          </a>
        );

      case "emoji":
        return <span className="text-4xl leading-none">{message.content}</span>;

      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-2">
        {renderContent()}
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2 group`}
      onDoubleClick={() => setShowReactions((v) => !v)}
    >
      <div className={`max-w-[75%] relative ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <p className="text-[10px] text-cyan-400/70 mb-0.5 ml-1 font-medium">{message.senderName}</p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 ${
            isOwn
              ? "bg-gradient-to-br from-cyan-600/80 to-blue-600/80 text-white rounded-br-md"
              : "bg-gray-800/80 text-gray-100 border border-gray-700/50 rounded-bl-md"
          }`}
        >
          {renderContent()}
          <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-white/40">{formatTime(message.timestamp)}</span>
            {isOwn && (
              message.read
                ? <CheckCheck className="w-3 h-3 text-cyan-300" />
                : <Check className="w-3 h-3 text-white/40" />
            )}
          </div>
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex gap-0.5 mt-0.5 ${isOwn ? "justify-end mr-1" : "justify-start ml-1"}`}>
            {groupReactions(message.reactions).map(({ emoji, count }) => (
              <span
                key={emoji}
                className="text-xs bg-gray-800/90 border border-gray-700/50 rounded-full px-1.5 py-0.5 cursor-pointer hover:bg-gray-700/90 transition-colors"
                onClick={() => onReact?.(message.id, emoji)}
              >
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}

        {showReactions && onReact && (
          <div
            className={`absolute ${isOwn ? "right-0" : "left-0"} -top-8 flex gap-1 bg-gray-900/95 border border-gray-700/50 rounded-full px-2 py-1 backdrop-blur-md shadow-xl z-10`}
          >
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                className="text-sm hover:scale-125 transition-transform"
                onClick={() => {
                  onReact(message.id, emoji);
                  setShowReactions(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function groupReactions(reactions: Reaction[]) {
  const map = new Map<string, number>();
  for (const r of reactions) {
    map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
  }
  return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
}

function VoiceNoteInline({ duration, url }: { duration?: number; url?: string }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (url ? new Audio(url) : null));

  const togglePlay = () => {
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
      audio.onended = () => setPlaying(false);
    }
    setPlaying(!playing);
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="flex gap-[2px] items-end h-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-current opacity-40"
              style={{ height: `${4 + Math.random() * 12}px` }}
            />
          ))}
        </div>
      </div>
      <span className="text-[10px] text-white/50 shrink-0">{formatDuration(duration)}</span>
    </div>
  );
}
