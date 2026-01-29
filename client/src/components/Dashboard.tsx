import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  User,
  Loader2,
  Trash2,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  FileText,
  Upload,
  Search,
  X,
  Paperclip,
  Hexagon,
  Sparkles,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "cyrus";
  content: string;
  createdAt: string;
}

export function Dashboard() {
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, size: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations?limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content }),
      });

      const inferRes = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const inferData = await inferRes.json();

      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "cyrus", content: inferData.response }),
      });

      return inferData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setInput("");
    },
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      await fetch("/api/conversations", { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMessage.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !sendMessage.isPending) {
      sendMessage.mutate(input.trim());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        name: file.name,
        size: formatFileSize(file.size),
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setInput(prev => prev + (prev ? ' ' : '') + `[${file.name}]`);
    }
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleResearch = () => {
    if (researchQuery.trim()) {
      setResearchResults(prev => [`> ${researchQuery}`, "Processing query...", ...prev]);
      setResearchQuery("");
    }
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(84,84,88,0.65)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold">Command Interface</h2>
              <p className="text-[13px] text-[rgba(235,235,245,0.6)]">Neural Link Active</p>
            </div>
          </div>
          <button
            onClick={() => clearHistory.mutate()}
            className="p-2 text-[rgba(235,235,245,0.4)] hover:text-[#ff453a] rounded-full hover:bg-[rgba(255,69,58,0.1)] transition-colors"
            title="Clear History"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-[#0a84ff] animate-spin" />
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] rounded-3xl flex items-center justify-center mb-6">
                <Hexagon className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-[22px] font-semibold mb-2">Welcome to CYRUS</h3>
              <p className="text-[15px] text-[rgba(235,235,245,0.6)] max-w-sm">
                Your autonomous quantum AI system is ready. Enter a command to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {sortedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "cyrus" && (
                    <div className="w-9 h-9 bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] rounded-full flex items-center justify-center flex-shrink-0">
                      <Hexagon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-[#0a84ff] text-white rounded-2xl rounded-br-md"
                      : "bg-[#2c2c2e] text-white rounded-2xl rounded-bl-md"
                  } px-4 py-3`}>
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[11px] mt-2 opacity-50">
                      {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-9 h-9 bg-[#3a3a3c] rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-[rgba(235,235,245,0.6)]" />
                    </div>
                  )}
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] rounded-full flex items-center justify-center">
                    <Hexagon className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#2c2c2e] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[rgba(235,235,245,0.4)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[rgba(235,235,245,0.4)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[rgba(235,235,245,0.4)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[rgba(84,84,88,0.65)]">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 bg-[#2c2c2e] rounded-2xl px-4 py-2">
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={handleChatFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                className="p-2 text-[rgba(235,235,245,0.4)] hover:text-[#0a84ff] rounded-full transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setMicActive(!micActive)}
                className={`p-2 rounded-full transition-colors ${micActive ? 'bg-[#0a84ff] text-white' : 'text-[rgba(235,235,245,0.4)] hover:text-white'}`}
              >
                {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className={`p-2 rounded-full transition-colors ${cameraActive ? 'bg-[#0a84ff] text-white' : 'text-[rgba(235,235,245,0.4)] hover:text-white'}`}
              >
                {cameraActive ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter command or query..."
                className="flex-1 bg-transparent text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] outline-none py-2"
                disabled={sendMessage.isPending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMessage.isPending}
                className="p-2.5 bg-[#0a84ff] text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#409cff] transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Sidebar - Research & Files */}
      <div className="hidden xl:flex w-80 flex-col bg-[#1c1c1e] border-l border-[rgba(84,84,88,0.65)]">
        {/* Research Section */}
        <div className="p-4 border-b border-[rgba(84,84,88,0.65)]">
          <h3 className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-3">Research Portal</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              placeholder="Search query..."
              className="flex-1 bg-[rgba(120,120,128,0.24)] text-[15px] text-white placeholder-[rgba(235,235,245,0.3)] rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#0a84ff]"
              onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            />
            <button
              onClick={handleResearch}
              className="p-2.5 bg-[#0a84ff] text-white rounded-xl hover:bg-[#409cff] transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 max-h-32 overflow-auto">
            {researchResults.length === 0 ? (
              <p className="text-[13px] text-[rgba(235,235,245,0.3)] text-center py-4">No queries yet</p>
            ) : (
              <div className="space-y-1">
                {researchResults.map((result, i) => (
                  <p key={i} className="text-[13px] text-[rgba(235,235,245,0.6)] py-1 border-b border-[rgba(84,84,88,0.3)] last:border-0">
                    {result}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Files Section */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide">File Workspace</h3>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-[#0a84ff] hover:bg-[rgba(10,132,255,0.1)] rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5" />
            </button>
          </div>
          
          {uploadedFiles.length === 0 ? (
            <div 
              className="flex-1 border-2 border-dashed border-[rgba(84,84,88,0.65)] rounded-2xl flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:border-[#0a84ff] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-[rgba(235,235,245,0.3)] mb-2" />
              <p className="text-[13px] text-[rgba(235,235,245,0.4)]">Drop files here</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto space-y-2">
              {uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#2c2c2e] rounded-xl">
                  <div className="w-10 h-10 bg-[rgba(120,120,128,0.24)] rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#0a84ff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-[rgba(235,235,245,0.4)]">{file.size}</p>
                  </div>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-[rgba(235,235,245,0.4)] hover:text-[#ff453a] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
