import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Menu,
  X,
  MessageSquare,
  QrCode,
  FileText,
  MapPin,
  Phone,
  Monitor,
  TrendingUp,
} from "lucide-react";

import { ScanPage } from "./pages/ScanPage";
import { FileAnalysisPage } from "./pages/FileAnalysisPage";
import { NavigationPage } from "./pages/NavigationPage";
import { CommsPage } from "./pages/CommsPage";
import { DeviceControlPage } from "./pages/DeviceControlPage";
import { TradingPage } from "./pages/TradingPage";

interface Message {
  id: string;
  role: "user" | "cyrus";
  content: string;
  createdAt: string;
}

function ChatPage() {
  const [input, setInput] = useState("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !sendMessage.isPending) {
      sendMessage.mutate(input.trim());
    }
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CYRUS</h1>
            <p className="text-xs text-gray-400">Quantum Artificial Intelligence</p>
          </div>
        </div>
        <button
          onClick={() => clearHistory.mutate()}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Clear chat history"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <Bot className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Hello! I'm CYRUS.</p>
            <p className="text-sm">Your Quantum Artificial Intelligence companion.</p>
            <p className="text-xs mt-2 text-gray-600">Created by Obakeng Kaelo</p>
          </div>
        ) : (
          sortedMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "cyrus" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/50 backdrop-blur-sm border border-gray-700"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        {sendMessage.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message CYRUS..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-6 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            disabled={sendMessage.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full p-3 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}

const navItems = [
  { path: "/", label: "Chat", icon: MessageSquare },
  { path: "/scan", label: "Scan", icon: QrCode },
  { path: "/files", label: "Files", icon: FileText },
  { path: "/nav", label: "Navigation", icon: MapPin },
  { path: "/comms", label: "Comms", icon: Phone },
  { path: "/device", label: "Device", icon: Monitor },
  { path: "/trading", label: "Trading", icon: TrendingUp },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <span className="font-bold">CYRUS v3.0</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <a
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            Created by <span className="text-blue-400">Obakeng Kaelo</span>
          </p>
          <p className="text-xs text-gray-600 text-center">
            Quantum Artificial Intelligence
          </p>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden border-b border-gray-800 p-4 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold">CYRUS</span>
        </header>

        <Switch>
          <Route path="/" component={ChatPage} />
          <Route path="/scan" component={ScanPage} />
          <Route path="/files" component={FileAnalysisPage} />
          <Route path="/nav" component={NavigationPage} />
          <Route path="/comms" component={CommsPage} />
          <Route path="/device" component={DeviceControlPage} />
          <Route path="/trading" component={TradingPage} />
        </Switch>
      </div>
    </div>
  );
}
