import { useState, useCallback, useEffect } from "react";
import { ConversationList, Conversation } from "./ConversationList";
import { ChatView } from "./ChatView";
import { CommsMessage } from "./MessageBubble";

interface CommsPlatformProps {
  conversations: Conversation[];
  messages: CommsMessage[];
  currentUserId: string;
  typingUsers?: Record<string, string[]>;
  initialConversationId?: string | null;
  onSendMessage: (conversationId: string, content: string) => void;
  onSendMedia?: (conversationId: string, file: File) => void;
  onSendVoice?: (conversationId: string, blob: Blob, duration: number) => void;
  onSendLocation?: (conversationId: string) => void;
  onToggleEmoji?: () => void;
  onTypingStart?: (conversationId: string) => void;
  onTypingStop?: (conversationId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onAudioCall?: (conversationId: string, name: string) => void;
  onVideoCall?: (conversationId: string, name: string) => void;
  onCreateGroup?: () => void;
  onNewChat?: () => void;
  sidebar?: React.ReactNode;
}

export function CommsPlatform({
  conversations,
  messages,
  currentUserId,
  typingUsers = {},
  initialConversationId,
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
  onCreateGroup,
  onNewChat,
  sidebar,
}: CommsPlatformProps) {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  useEffect(() => {
    if (initialConversationId) {
      const conv = conversations.find(c => c.id === initialConversationId);
      if (conv) {
        setSelectedConversation(conv);
        setMobileView("chat");
      }
    }
  }, [initialConversationId, conversations]);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setSelectedConversation(conv);
    setMobileView("chat");
  }, []);

  const handleBack = useCallback(() => {
    setMobileView("list");
  }, []);

  const filteredMessages = selectedConversation
    ? messages.filter(
        (m) =>
          m.recipientId === selectedConversation.id ||
          m.senderId === selectedConversation.id ||
          (selectedConversation.isGroup && m.recipientId === selectedConversation.id)
      )
    : [];

  const currentTyping = selectedConversation ? typingUsers[selectedConversation.id] || [] : [];

  return (
    <div className="flex h-full rounded-2xl overflow-hidden border border-gray-800/50 bg-gray-950/60 backdrop-blur-md shadow-2xl shadow-black/40">
      {sidebar && (
        <div className="hidden lg:flex w-16 flex-col items-center py-4 bg-gray-950/80 border-r border-gray-800/50">
          {sidebar}
        </div>
      )}

      <div
        className={`w-full md:w-80 lg:w-80 shrink-0 border-r border-gray-800/50 ${
          mobileView === "chat" ? "hidden md:flex md:flex-col" : "flex flex-col"
        }`}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id || null}
          onSelect={handleSelectConversation}
          onCreateGroup={onCreateGroup}
          onNewChat={onNewChat}
        />
      </div>

      <div
        className={`flex-1 min-w-0 ${
          mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
        }`}
      >
        <ChatView
          conversationId={selectedConversation?.id || null}
          conversationName={selectedConversation?.name || ""}
          isGroup={selectedConversation?.isGroup || false}
          isOnline={selectedConversation?.isOnline}
          participantCount={selectedConversation?.participants?.length}
          messages={filteredMessages}
          currentUserId={currentUserId}
          typingUsers={currentTyping}
          onSendMessage={(content) =>
            selectedConversation && onSendMessage(selectedConversation.id, content)
          }
          onSendMedia={
            onSendMedia && selectedConversation
              ? (file) => onSendMedia(selectedConversation.id, file)
              : undefined
          }
          onSendVoice={
            onSendVoice && selectedConversation
              ? (blob, dur) => onSendVoice(selectedConversation.id, blob, dur)
              : undefined
          }
          onSendLocation={
            onSendLocation && selectedConversation
              ? () => onSendLocation(selectedConversation.id)
              : undefined
          }
          onToggleEmoji={onToggleEmoji}
          onTypingStart={
            onTypingStart && selectedConversation
              ? () => onTypingStart(selectedConversation.id)
              : undefined
          }
          onTypingStop={
            onTypingStop && selectedConversation
              ? () => onTypingStop(selectedConversation.id)
              : undefined
          }
          onReact={onReact}
          onAudioCall={
            onAudioCall && selectedConversation
              ? () => onAudioCall(selectedConversation.id, selectedConversation.name)
              : undefined
          }
          onVideoCall={
            onVideoCall && selectedConversation
              ? () => onVideoCall(selectedConversation.id, selectedConversation.name)
              : undefined
          }
          onBack={handleBack}
        />
      </div>
    </div>
  );
}
