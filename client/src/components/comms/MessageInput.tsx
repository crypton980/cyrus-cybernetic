import { useState, useRef, useCallback, KeyboardEvent } from "react";
import {
  Send,
  Smile,
  Paperclip,
  Mic,
  MapPin,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";

interface MessageInputProps {
  onSend: (content: string) => void;
  onSendMedia?: (file: File) => void;
  onSendVoice?: (blob: Blob, duration: number) => void;
  onSendLocation?: () => void;
  onToggleEmoji?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  onSendMedia,
  onSendVoice,
  onSendLocation,
  onToggleEmoji,
  onTypingStart,
  onTypingStop,
  disabled = false,
  placeholder = "Type a message...",
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachPreview, setAttachPreview] = useState<{ file: File; url: string } | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = useCallback(() => {
    if (attachPreview && onSendMedia) {
      onSendMedia(attachPreview.file);
      URL.revokeObjectURL(attachPreview.url);
      setAttachPreview(null);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    onTypingStop?.();
  }, [text, attachPreview, onSend, onSendMedia, onTypingStop]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (val.length > 0) {
      onTypingStart?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTypingStop?.(), 2000);
    } else {
      onTypingStop?.();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAttachPreview({ file, url });
    e.target.value = "";
  };

  const clearAttachment = () => {
    if (attachPreview) {
      URL.revokeObjectURL(attachPreview.url);
      setAttachPreview(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        onSendVoice?.(blob, recordingTime);
        setIsRecording(false);
        setRecordingTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((p) => {
          if (p >= 300) {
            mediaRecorderRef.current?.stop();
            return p;
          }
          return p + 1;
        });
      }, 1000);
    } catch {
      console.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/80 border-t border-gray-800/50 backdrop-blur-md">
        <button
          onClick={cancelRecording}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-400 font-mono">{formatTime(recordingTime)}</span>
          <div className="flex gap-[2px] items-center flex-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-[2px] bg-red-400/60 rounded-full animate-pulse"
                style={{
                  height: `${6 + Math.random() * 16}px`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={stopRecording}
          className="p-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-colors"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative border-t border-gray-800/50 bg-gray-900/80 backdrop-blur-md">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 z-50">
          <EmojiPicker
            onSelect={(emoji) => {
              setText(prev => prev + emoji);
              setShowEmoji(false);
            }}
            onClose={() => setShowEmoji(false)}
          />
        </div>
      )}
      {attachPreview && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <div className="relative inline-block">
            {attachPreview.file.type.startsWith("image/") ? (
              <img src={attachPreview.url} alt="" className="h-16 rounded-lg border border-gray-700/50" />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/50">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-gray-300 max-w-[120px] truncate">{attachPreview.file.name}</span>
              </div>
            )}
            <button
              onClick={clearAttachment}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            disabled={disabled}
            className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
              showEmoji ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10"
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>
          {onSendMedia && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-full transition-colors disabled:opacity-40"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
              />
            </>
          )}
          {onSendLocation && (
            <button
              onClick={onSendLocation}
              disabled={disabled}
              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-full transition-colors disabled:opacity-40"
            >
              <MapPin className="w-5 h-5" />
            </button>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-gray-800/60 border border-gray-700/40 text-white text-sm placeholder-gray-500 px-3.5 py-2.5 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 max-h-[120px] disabled:opacity-40"
          style={{ minHeight: "40px" }}
        />

        {text.trim() || attachPreview ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="p-2.5 bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        ) : onSendVoice ? (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="p-2.5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-full transition-colors disabled:opacity-40"
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="p-2.5 bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
