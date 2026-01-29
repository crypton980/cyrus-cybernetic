import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [instructionExpanded, setInstructionExpanded] = useState(true);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const shareOptions = [
    { name: "WhatsApp", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg", color: "bg-green-500", url: "https://wa.me/?text=" },
    { name: "Facebook", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/facebook.svg", color: "bg-blue-600", url: "https://www.facebook.com/sharer/sharer.php?u=" },
    { name: "Twitter", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/x.svg", color: "bg-black", url: "https://twitter.com/intent/tweet?text=" },
    { name: "Instagram", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg", color: "bg-gradient-to-br from-purple-600 to-pink-500", url: "" },
    { name: "Email", icon: null, color: "bg-gray-600", url: "mailto:?subject=CYRUS Chat&body=" },
    { name: "Copy Link", icon: null, color: "bg-gray-700", url: "" },
  ];

  const systemModules: SystemStatus[] = [
    { name: "Quantum Core", status: "online", load: 87 },
    { name: "Neural Network", status: "online", load: 92 },
    { name: "Vision System", status: micActive ? "online" : "standby", load: micActive ? 65 : 0 },
    { name: "Voice Engine", status: cameraActive ? "online" : "standby", load: cameraActive ? 72 : 0 },
    { name: "Security", status: "online", load: 45 },
    { name: "Memory Bank", status: "online", load: 68 },
  ];

  const instructions = [
    "Type commands or questions in the input field below",
    "Use voice input by clicking the microphone button",
    "Enable camera for visual analysis tasks",
    "Upload files for analysis using the File Workspace",
    "Access specialized modules via the sidebar navigation",
  ];

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

  const handleShare = (option: typeof shareOptions[0]) => {
    const chatText = sortedMessages.map(m => 
      `${m.role === 'user' ? 'You' : 'CYRUS'}: ${m.content}`
    ).join('\n\n');
    
    if (option.name === 'Copy Link') {
      navigator.clipboard.writeText(chatText);
      setShareMenuOpen(false);
      return;
    }
    
    if (option.url) {
      const encodedText = encodeURIComponent(chatText.slice(0, 500) + (chatText.length > 500 ? '...' : ''));
      window.open(option.url + encodedText, '_blank');
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
        "Results will appear in the Research Viewer",
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
      case "online": return "bg-green-500";
      case "standby": return "bg-yellow-500";
      default: return "bg-red-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online": return <CheckCircle className="w-3 h-3" />;
      case "standby": return <Clock className="w-3 h-3" />;
      default: return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const renderChatPanel = () => (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/30 rounded-xl border border-gray-800/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-sm">Command Interface</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => clearHistory.mutate()}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Clear history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain className="w-12 h-12 text-blue-400/50 mb-3" />
            <p className="text-gray-400 text-sm">Ready for commands</p>
            <p className="text-gray-600 text-xs mt-1">Created by Obakeng Kaelo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "cyrus" && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800/60 border border-gray-700/50 text-gray-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-blue-200" : "text-gray-500"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
            {sendMessage.isPending && (
              <div className="flex gap-2 justify-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-gray-400 text-xs">Processing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderResearchPanel = () => (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/30 rounded-xl border border-gray-800/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-sm">Research & Results Viewer</h3>
        </div>
        <span className="text-xs text-gray-500">{researchResults.length} results</span>
      </div>
      
      <div className="p-3 border-b border-gray-800/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            placeholder="Enter research query..."
            className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
          />
          <button
            onClick={handleResearch}
            className="px-3 py-2 bg-purple-600/80 hover:bg-purple-600 rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-3">
        {researchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Target className="w-10 h-10 text-purple-400/50 mb-3" />
            <p className="text-gray-400 text-sm">No research results yet</p>
            <p className="text-gray-600 text-xs mt-1">Enter a query to begin analysis</p>
          </div>
        ) : (
          <div className="space-y-2">
            {researchResults.map((result, i) => (
              <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/30 rounded-lg">
                <p className="text-sm text-gray-300">{result}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderFilePanel = () => (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/30 rounded-xl border border-gray-800/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-sm">File Interaction Workspace</h3>
        </div>
        <span className="text-xs text-gray-500">{uploadedFiles.length} files</span>
      </div>
      
      <div className="p-3 border-b border-gray-800/50">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-700/50 hover:border-cyan-500/50 rounded-lg text-gray-400 hover:text-cyan-400 transition-colors"
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm">Upload files for analysis</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-3">
        {uploadedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="w-10 h-10 text-cyan-400/50 mb-3" />
            <p className="text-gray-400 text-sm">No files uploaded</p>
            <p className="text-gray-600 text-xs mt-1">Upload documents, images, or data files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploadedFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-800/40 border border-gray-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-sm text-gray-200">{file.name}</p>
                    <p className="text-xs text-gray-500">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all">
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-800/50">
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 p-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm transition-colors">
            <Sparkles className="w-4 h-4" />
            Analyze All
          </button>
          <button className="flex items-center justify-center gap-2 p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors">
            <Download className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <header className="border-b border-gray-800/50 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                CYRUS v3.0
              </h1>
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-500" />
                OMEGA-TIER Quantum Artificial Intelligence
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-gray-800/40 border border-gray-700/30 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Cpu className="w-3 h-3" />
                <span>86 Branches</span>
              </div>
              <div className="w-px h-4 bg-gray-700" />
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Brain className="w-3 h-3" />
                <span>3655 Paths</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400 font-medium">OPERATIONAL</span>
            </div>

            <div className="flex items-center gap-1 bg-gray-800/40 border border-gray-700/30 rounded-lg p-1">
              <button
                onClick={() => setPanelView("compact")}
                className={`p-1.5 rounded-md transition-all ${panelView === "compact" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                title="Compact view"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPanelView("split")}
                className={`p-1.5 rounded-md transition-all ${panelView === "split" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                title="Split view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPanelView("full")}
                className={`p-1.5 rounded-md transition-all ${panelView === "full" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                title="Full view"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 p-4 gap-4">
          <div
            className={`bg-gray-900/30 rounded-xl border border-gray-800/50 overflow-hidden transition-all ${
              instructionExpanded ? "p-4" : "p-3"
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setInstructionExpanded(!instructionExpanded)}
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-sm">Instructional Panel</h3>
                <span className="text-xs text-gray-500">Real-time guidance</span>
              </div>
              <button className="p-1 text-gray-500 hover:text-white transition-colors">
                {instructionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {instructionExpanded && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                {instructions.map((instruction, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-800/30 border border-gray-700/20 rounded-lg">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-400 flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-xs text-gray-400">{instruction}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {panelView === "compact" && (
            <div className="flex gap-2 mb-2">
              {["chat", "research", "files"].map((panel) => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activePanel === panel
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800/40 text-gray-400 hover:text-white"
                  }`}
                >
                  {panel === "chat" ? "Commands" : panel === "research" ? "Research" : "Files"}
                </button>
              ))}
            </div>
          )}

          <div className={`flex-1 flex gap-4 overflow-hidden ${panelView === "full" ? "flex-col" : ""}`}>
            {panelView === "compact" ? (
              activePanel === "chat" ? renderChatPanel() :
              activePanel === "research" ? renderResearchPanel() :
              renderFilePanel()
            ) : panelView === "split" ? (
              <>
                <div className="flex-1 flex flex-col overflow-hidden">
                  {renderChatPanel()}
                </div>
                <div className="hidden lg:flex flex-col w-80 gap-4 overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    {renderResearchPanel()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {renderFilePanel()}
                  </div>
                </div>
              </>
            ) : (
              <>
                {renderChatPanel()}
                {renderResearchPanel()}
                {renderFilePanel()}
              </>
            )}
          </div>

          <footer className="border-t border-gray-800/50 bg-black/40 backdrop-blur-xl rounded-xl p-4">
            <input
              type="file"
              ref={chatFileInputRef}
              onChange={handleChatFileUpload}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            />
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMicActive(!micActive)}
                    className={`p-3 rounded-xl transition-all ${
                      micActive
                        ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
                        : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 border border-gray-700/50"
                    }`}
                    title={micActive ? "Stop listening" : "Start listening"}
                  >
                    {micActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    className="p-3 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 border border-gray-700/50 transition-all"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraActive(!cameraActive)}
                    className={`p-3 rounded-xl transition-all ${
                      cameraActive
                        ? "bg-green-500/20 text-green-400 border border-green-500/50"
                        : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 border border-gray-700/50"
                    }`}
                    title={cameraActive ? "Stop camera" : "Start camera"}
                  >
                    {cameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter command or message..."
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-5 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    disabled={sendMessage.isPending}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="submit"
                    disabled={!input.trim() || sendMessage.isPending}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl p-3.5 transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShareMenuOpen(!shareMenuOpen)}
                      className="p-3 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 border border-gray-700/50 transition-all"
                      title="Share chat"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    
                    {shareMenuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 border border-gray-700/50 rounded-xl shadow-xl overflow-hidden z-50">
                        <div className="p-2 border-b border-gray-800">
                          <p className="text-xs text-gray-400 font-medium">Share chat via</p>
                        </div>
                        <div className="p-2 space-y-1">
                          {shareOptions.map((option, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleShare(option)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors text-left"
                            >
                              <div className={`w-8 h-8 rounded-lg ${option.color} flex items-center justify-center`}>
                                {option.name === 'Email' ? (
                                  <Mail className="w-4 h-4 text-white" />
                                ) : option.name === 'Copy Link' ? (
                                  <Copy className="w-4 h-4 text-white" />
                                ) : (
                                  <MessageCircle className="w-4 h-4 text-white" />
                                )}
                              </div>
                              <span className="text-sm text-gray-300">{option.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => clearHistory.mutate()}
                    className="p-3 rounded-xl bg-gray-800/50 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-gray-700/50 transition-all"
                    title="Clear chat"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-green-400" /> System Active
                </span>
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-purple-400" /> Nova Voice Ready
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-400" /> Secure Mode
                </span>
              </div>
            </form>
          </footer>
        </main>

        <aside className="hidden xl:block w-72 border-l border-gray-800/50 bg-black/20 backdrop-blur-xl overflow-auto">
          <div className="p-4 border-b border-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              System Status
            </h3>
          </div>
          
          <div className="p-4 space-y-3">
            {systemModules.map((module, i) => (
              <div
                key={i}
                className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">{module.name}</span>
                  <div className={`flex items-center gap-1 text-xs ${
                    module.status === "online" ? "text-green-400" :
                    module.status === "standby" ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {getStatusIcon(module.status)}
                    <span className="capitalize">{module.status}</span>
                  </div>
                </div>
                {module.status === "online" && (
                  <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        module.load > 80 ? "bg-gradient-to-r from-yellow-500 to-orange-500" :
                        module.load > 50 ? "bg-gradient-to-r from-blue-500 to-cyan-500" :
                        "bg-gradient-to-r from-green-500 to-emerald-500"
                      }`}
                      style={{ width: `${module.load}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/30 hover:bg-blue-500/10 border border-gray-700/30 hover:border-blue-500/30 rounded-lg text-sm text-gray-300 hover:text-blue-400 transition-all">
                <FileText className="w-4 h-4" />
                Generate Report
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/30 hover:bg-purple-500/10 border border-gray-700/30 hover:border-purple-500/30 rounded-lg text-sm text-gray-300 hover:text-purple-400 transition-all">
                <Activity className="w-4 h-4" />
                Start Analysis
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/30 hover:bg-red-500/10 border border-gray-700/30 hover:border-red-500/30 rounded-lg text-sm text-gray-300 hover:text-red-400 transition-all">
                <AlertTriangle className="w-4 h-4" />
                Emergency Mode
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800/50">
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Created by <span className="font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Obakeng Kaelo</span>
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                Quantum Artificial Intelligence
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
