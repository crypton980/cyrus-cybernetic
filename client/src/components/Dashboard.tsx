import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Send,
  Bot,
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
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  Volume2,
  Upload,
  Search,
  BookOpen,
  Lightbulb,
  Target,
  LayoutGrid,
  Maximize2,
  Minimize2,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Sparkles,
  Paperclip,
  Share2,
  Mail,
  MessageCircle,
  Radio,
  Hexagon,
  Satellite,
  Eye,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "cyrus";
  content: string;
  createdAt: string;
}

interface SystemStatus {
  name: string;
  status: "online" | "standby" | "offline";
  load: number;
  icon: LucideIcon;
}

type PanelView = "full" | "split" | "compact";

export function Dashboard() {
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>("split");
  const [activePanel, setActivePanel] = useState<"chat" | "research" | "files">("chat");
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, size: string, type: string}[]>([]);
  const [instructionExpanded, setInstructionExpanded] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMessage.isPending]);

  const systemModules: SystemStatus[] = [
    { name: "Quantum Core", status: "online", load: 87, icon: Hexagon },
    { name: "Neural Fusion", status: "online", load: 92, icon: Brain },
    { name: "Vision Array", status: cameraActive ? "online" : "standby", load: cameraActive ? 65 : 0, icon: Eye },
    { name: "Audio Engine", status: micActive ? "online" : "standby", load: micActive ? 72 : 0, icon: Volume2 },
    { name: "Security Grid", status: "online", load: 45, icon: Shield },
    { name: "Memory Bank", status: "online", load: 68, icon: Cpu },
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
        type: file.type || 'unknown'
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setInput(prev => prev + (prev ? ' ' : '') + `[Attached: ${file.name}]`);
      const newFiles = Array.from(files).map(f => ({
        name: f.name,
        size: formatFileSize(f.size),
        type: f.type || 'unknown'
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const handleShare = (platform: string) => {
    const chatText = sortedMessages.map(m => 
      `${m.role === 'user' ? 'You' : 'CYRUS'}: ${m.content}`
    ).join('\n\n');
    
    if (platform === 'copy') {
      navigator.clipboard.writeText(chatText);
      setShareMenuOpen(false);
      return;
    }
    
    const encodedText = encodeURIComponent(chatText.slice(0, 500));
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      email: `mailto:?subject=CYRUS Chat&body=${encodedText}`,
    };
    
    if (urls[platform]) {
      window.open(urls[platform], '_blank');
    }
    setShareMenuOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleResearch = () => {
    if (researchQuery.trim()) {
      setResearchResults(prev => [
        `Analyzing: "${researchQuery}"`,
        "Processing through 86 cognitive branches...",
        "Cross-referencing quantum knowledge base...",
        ...prev
      ]);
      setResearchQuery("");
    }
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-emerald-500";
      case "standby": return "bg-amber-500";
      default: return "bg-red-500";
    }
  };

  const getStatusGlow = (status: string) => {
    switch (status) {
      case "online": return "shadow-emerald-500/50";
      case "standby": return "shadow-amber-500/50";
      default: return "shadow-red-500/50";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 overflow-hidden">
        <div className="lg:col-span-3 flex flex-col overflow-hidden gap-4 lg:gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {systemModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.name}
                  className="p-3 rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-all group"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.8) 0%, rgba(12, 12, 18, 0.8) 100%)',
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(module.status)} shadow-lg ${getStatusGlow(module.status)}`}>
                      {module.status === 'online' && (
                        <div className={`absolute inset-0 rounded-full ${getStatusColor(module.status)} animate-ping opacity-75`} />
                      )}
                    </div>
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                  </div>
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider truncate">{module.name}</p>
                  <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        module.status === 'online' ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' :
                        module.status === 'standby' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                        'bg-gradient-to-r from-red-500 to-rose-500'
                      }`}
                      style={{ width: `${module.load}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-white/30 mt-1 font-mono">{module.load}% UTIL</p>
                </div>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl blur-lg opacity-40" />
                  <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white/90">Command Interface</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Neural Link Active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShareMenuOpen(!shareMenuOpen)}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"
                    title="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  {shareMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl border border-white/[0.08] shadow-2xl z-50" style={{ background: 'rgba(18, 18, 26, 0.98)', backdropFilter: 'blur(20px)' }}>
                      {['whatsapp', 'facebook', 'twitter', 'email', 'copy'].map((platform) => (
                        <button
                          key={platform}
                          onClick={() => handleShare(platform)}
                          className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:text-white hover:bg-white/[0.05] transition-all flex items-center gap-3 capitalize"
                        >
                          {platform === 'copy' ? <Copy className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                          {platform === 'copy' ? 'Copy to Clipboard' : platform}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => clearHistory.mutate()}
                  className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-5">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                    <div className="absolute inset-0 animate-ping opacity-30">
                      <Loader2 className="w-10 h-10 text-cyan-500" />
                    </div>
                  </div>
                </div>
              ) : sortedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-3xl blur-2xl opacity-20" />
                    <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-white/[0.1] flex items-center justify-center">
                      <Hexagon className="w-10 h-10 text-cyan-400" strokeWidth={1} />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white/90 mb-2">CYRUS Ready</h3>
                  <p className="text-white/40 text-sm max-w-md">
                    Quantum Intelligence System initialized. 86 cognitive branches online.
                  </p>
                  <p className="text-white/20 text-xs mt-4">
                    Architect: Obakeng Kaelo
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedMessages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {msg.role === "cyrus" && (
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl blur-lg opacity-40" />
                          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                            <Hexagon className="w-5 h-5 text-white" strokeWidth={1.5} />
                          </div>
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                            : "bg-white/[0.03] border border-white/[0.08] text-white/90"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        <p className={`text-[10px] mt-2 font-mono ${msg.role === "user" ? "text-cyan-200/70" : "text-white/30"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                        </p>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-white/60" />
                        </div>
                      )}
                    </div>
                  ))}
                  {sendMessage.isPending && (
                    <div className="flex gap-3 justify-start">
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl blur-lg opacity-40 animate-pulse" />
                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                          <Hexagon className="w-5 h-5 text-white animate-pulse" strokeWidth={1.5} />
                        </div>
                      </div>
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-white/40 text-xs">Processing quantum inference...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={chatFileInputRef}
                  onChange={handleChatFileUpload}
                  className="hidden"
                  accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-3 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMicActive(!micActive)}
                  className={`p-3 rounded-xl transition-all ${
                    micActive 
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30" 
                      : "text-white/40 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`p-3 rounded-xl transition-all ${
                    cameraActive 
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30" 
                      : "text-white/40 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {cameraActive ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter command or query..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    disabled={sendMessage.isPending}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || sendMessage.isPending}
                  className="relative group p-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 rounded-xl overflow-hidden" />
                  <Send className="w-5 h-5 relative" />
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-4 lg:space-y-6 overflow-auto">
          <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
                <Search className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-white/90">Research Portal</h3>
            </div>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="Query knowledge base..."
                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
              />
              <button
                onClick={handleResearch}
                className="p-2.5 bg-gradient-to-r from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 border border-violet-500/30 rounded-lg text-violet-400 transition-all"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-auto">
              {researchResults.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-4">No queries yet</p>
              ) : (
                researchResults.map((result, i) => (
                  <div key={i} className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg text-xs text-white/60">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
                  <FileText className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">File Workspace</h3>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-white/50 hover:text-white transition-all"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-auto">
              {uploadedFiles.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-white/[0.06] rounded-xl">
                  <Upload className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/30">Drop files here</p>
                </div>
              ) : (
                uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{file.name}</p>
                      <p className="text-[10px] text-white/30">{file.size}</p>
                    </div>
                    <button
                      onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1 text-white/30 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <button
              onClick={() => setInstructionExpanded(!instructionExpanded)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">Quick Guide</h3>
              </div>
              {instructionExpanded ? (
                <ChevronUp className="w-4 h-4 text-white/40" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/40" />
              )}
            </button>
            
            {instructionExpanded && (
              <div className="mt-4 space-y-2">
                {[
                  { text: "Natural language commands", icon: MessageCircle },
                  { text: "Voice input available", icon: Mic },
                  { text: "Camera for vision tasks", icon: Camera },
                  { text: "File upload & analysis", icon: FileText },
                  { text: "Sidebar for modules", icon: LayoutGrid },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-lg">
                    <item.icon className="w-3.5 h-3.5 text-amber-400/70" />
                    <span className="text-xs text-white/50">{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
