import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import {
  Bot,
  Menu,
  X,
  MessageSquare,
  QrCode,
  FileText,
  MapPin,
  Phone,
  Monitor,
  TrendingUp,
  Zap,
  Activity,
  Plane,
} from "lucide-react";

import { Dashboard } from "./components/Dashboard";
import { ScanPage } from "./pages/ScanPage";
import { FileAnalysisPage } from "./pages/FileAnalysisPage";
import { NavigationPage } from "./pages/NavigationPage";
import { CommsPage } from "./pages/CommsPage";
import { DeviceControlPage } from "./pages/DeviceControlPage";
import { TradingPage } from "./pages/TradingPage";
import { DronePage } from "./pages/DronePage";

const navItems = [
  { path: "/", label: "Control Panel", icon: MessageSquare, description: "Main Interface" },
  { path: "/scan", label: "Vision & Scan", icon: QrCode, description: "QR/OCR/Analysis" },
  { path: "/files", label: "File Analysis", icon: FileText, description: "Reports & Docs" },
  { path: "/nav", label: "Navigation", icon: MapPin, description: "GPS & Routes" },
  { path: "/comms", label: "Communications", icon: Phone, description: "Calls & Messages" },
  { path: "/device", label: "Device Control", icon: Monitor, description: "System Actions" },
  { path: "/drone", label: "Drone Control", icon: Plane, description: "UAV Operations" },
  { path: "/trading", label: "Trading Intel", icon: TrendingUp, description: "Markets & Analysis" },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-black/80 backdrop-blur-xl border-r border-gray-800/50 transform transition-transform duration-300 ease-out lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">CYRUS</span>
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-yellow-500" />
                v3.0 OMEGA-TIER
              </p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-medium">SYSTEM OPERATIONAL</span>
          </div>
        </div>

        <nav className="px-3 pb-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600/90 to-purple-600/90 text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                <div className={`p-2 rounded-lg ${isActive ? "bg-white/20" : "bg-gray-800/50"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? "text-white" : ""}`}>{item.label}</p>
                  <p className={`text-[10px] truncate ${isActive ? "text-blue-200" : "text-gray-600"}`}>{item.description}</p>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800/50 bg-black/40">
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

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden border-b border-gray-800/50 bg-black/40 backdrop-blur-xl p-4 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">CYRUS</span>
              <p className="text-[9px] text-gray-500">OMEGA-TIER QAI</p>
            </div>
          </div>
        </header>

        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/scan" component={ScanPage} />
          <Route path="/files" component={FileAnalysisPage} />
          <Route path="/nav" component={NavigationPage} />
          <Route path="/comms" component={CommsPage} />
          <Route path="/device" component={DeviceControlPage} />
          <Route path="/drone" component={DronePage} />
          <Route path="/trading" component={TradingPage} />
        </Switch>
      </div>
    </div>
  );
}
