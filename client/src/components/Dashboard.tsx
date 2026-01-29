import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Send,
  User,
  Loader2,
  Trash2,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Activity,
  Shield,
  Cpu,
  Brain,
  FileText,
  Volume2,
  Upload,
  Search,
  X,
  Paperclip,
  Eye,
  Hexagon,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "cyrus";
  content: string;
  createdAt: string;
}

interface SystemModule {
  name: string;
  status: "online" | "standby" | "offline";
  load: number;
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

  const systemModules: SystemModule[] = [
    { name: "QUANTUM", status: "online", load: 87 },
    { name: "NEURAL", status: "online", load: 92 },
    { name: "VISION", status: cameraActive ? "online" : "standby", load: cameraActive ? 65 : 0 },
    { name: "AUDIO", status: micActive ? "online" : "standby", load: micActive ? 72 : 0 },
    { name: "SECURITY", status: "online", load: 45 },
    { name: "MEMORY", status: "online", load: 68 },
  ];

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
    <div className="h-full flex flex-col overflow-hidden bg-black">
      <div className="border-b border-[#1f1f1f]">
        <div className="px-6 py-3 flex items-center gap-px bg-[#0a0a0a]">
          {systemModules.map((module) => (
            <div key={module.name} className="flex-1 px-3 py-2 border-r border-[#1f1f1f] last:border-r-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  module.status === 'online' ? 'bg-[#00c853]' :
                  module.status === 'standby' ? 'bg-[#ffab00]' : 'bg-[#ff1744]'
                }`} />
                <span className="text-[9px] text-[#666] font-medium tracking-wider">{module.name}</span>
              </div>
              <div className="h-1 bg-[#1a1a1a] rounded-sm overflow-hidden">
                <div 
                  className="h-full bg-[#333] transition-all duration-500"
                  style={{ width: `${module.load}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-px bg-[#1f1f1f] overflow-hidden">
        <div className="lg:col-span-3 bg-black flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-3">
              <Hexagon className="w-4 h-4 text-white" strokeWidth={1.5} />
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Command Interface</span>
            </div>
            <button
              onClick={() => clearHistory.mutate()}
              className="p-1.5 text-[#444] hover:text-[#ff1744] transition-colors"
              title="Clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
              </div>
            ) : sortedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Hexagon className="w-12 h-12 text-[#333] mb-4" strokeWidth={1} />
                <p className="text-sm text-[#666]">System Ready</p>
                <p className="text-xs text-[#444] mt-1">Autonomous operations enabled</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "cyrus" && (
                      <div className="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
                        <Hexagon className="w-4 h-4 text-black" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className={`max-w-[70%] ${
                      msg.role === "user"
                        ? "bg-[#0066ff] text-white"
                        : "bg-[#1a1a1a] border border-[#333] text-white"
                    } px-4 py-3`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[10px] mt-2 opacity-50 font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-[#888]" />
                      </div>
                    )}
                  </div>
                ))}
                {sendMessage.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 bg-white flex items-center justify-center">
                      <Hexagon className="w-4 h-4 text-black" strokeWidth={1.5} />
                    </div>
                    <div className="bg-[#1a1a1a] border border-[#333] px-4 py-3">
                      <Loader2 className="w-4 h-4 text-[#666] animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-[#1f1f1f]">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={handleChatFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                className="p-2.5 text-[#666] hover:text-white transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMicActive(!micActive)}
                className={`p-2.5 transition-colors ${micActive ? 'bg-[#0066ff] text-white' : 'text-[#666] hover:text-white'}`}
              >
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className={`p-2.5 transition-colors ${cameraActive ? 'bg-[#0066ff] text-white' : 'text-[#666] hover:text-white'}`}
              >
                {cameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter command..."
                className="flex-1 bg-[#0a0a0a] border border-[#333] px-4 py-2.5 text-sm text-white placeholder-[#444] focus:border-[#0066ff] focus:outline-none"
                disabled={sendMessage.isPending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMessage.isPending}
                className="p-2.5 bg-[#0066ff] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0052cc] transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="bg-black flex flex-col border-l border-[#1f1f1f]">
          <div className="border-b border-[#1f1f1f]">
            <div className="px-4 py-3 border-b border-[#1f1f1f]">
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Research</span>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  placeholder="Query..."
                  className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-sm text-white placeholder-[#444] focus:border-[#0066ff] focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                />
                <button
                  onClick={handleResearch}
                  className="p-2 bg-[#1a1a1a] border border-[#333] text-[#666] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-32 overflow-auto space-y-1">
                {researchResults.length === 0 ? (
                  <p className="text-[11px] text-[#444] text-center py-4">No queries</p>
                ) : (
                  researchResults.map((result, i) => (
                    <div key={i} className="text-[11px] text-[#666] font-mono py-1 border-b border-[#1f1f1f] last:border-0">
                      {result}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Files</span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-[#666] hover:text-white"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {uploadedFiles.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-[#333]">
                  <Upload className="w-6 h-6 text-[#333] mx-auto mb-2" />
                  <p className="text-[10px] text-[#444]">Drop files</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-[#0a0a0a] border border-[#1f1f1f]">
                      <FileText className="w-3 h-3 text-[#666]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[#888] truncate">{file.name}</p>
                        <p className="text-[9px] text-[#444]">{file.size}</p>
                      </div>
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="p-1 text-[#444] hover:text-[#ff1744]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
