import { useState, useEffect } from "react";
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
  ChevronRight,
  Hexagon,
  Radio,
  Shield,
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
  { path: "/", label: "Command Center", icon: MessageSquare, description: "Primary Interface", color: "from-cyan-500 to-blue-600" },
  { path: "/scan", label: "Vision Systems", icon: QrCode, description: "Optical Analysis", color: "from-violet-500 to-purple-600" },
  { path: "/files", label: "Intelligence", icon: FileText, description: "Document Processing", color: "from-emerald-500 to-teal-600" },
  { path: "/nav", label: "Navigation", icon: MapPin, description: "Geospatial Systems", color: "from-orange-500 to-red-600" },
  { path: "/comms", label: "Communications", icon: Phone, description: "Secure Channels", color: "from-pink-500 to-rose-600" },
  { path: "/device", label: "Systems Control", icon: Monitor, description: "Hardware Interface", color: "from-indigo-500 to-blue-600" },
  { path: "/drone", label: "Aerospace", icon: Plane, description: "UAV Operations", color: "from-amber-500 to-orange-600" },
  { path: "/trading", label: "Markets Intel", icon: TrendingUp, description: "Financial Analysis", color: "from-green-500 to-emerald-600" },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen text-white flex overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 50%, #0a0a0f 100%)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-cyan-500/[0.02] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-all duration-500 ease-out lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(12, 12, 18, 0.98) 0%, rgba(8, 8, 12, 0.98) 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(40px)',
        }}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
                  <Hexagon className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0c0c12] shadow-lg shadow-emerald-500/50">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gradient-premium">CYRUS</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">OMEGA-TIER ASI</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="lg:hidden p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <div className="absolute inset-0 animate-ping">
                    <Activity className="w-4 h-4 text-emerald-400 opacity-50" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-400 tracking-wide uppercase">Operational</span>
                    <span className="text-[10px] font-mono text-emerald-400/70">{formatTime(currentTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-emerald-900/30 rounded-full overflow-hidden">
                      <div className="h-full w-[86%] bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
                    </div>
                    <span className="text-[9px] font-mono text-white/40">86 CORES</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 mb-2">
            <span className="px-3 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Modules</span>
          </div>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-white/[0.08]"
                      : "hover:bg-white/[0.04]"
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-cyan-400 to-purple-500" />
                  )}
                  <div className={`relative p-2.5 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? `bg-gradient-to-br ${item.color} shadow-lg` 
                      : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                  }`}>
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-white" : "text-white/50 group-hover:text-white/70"}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium transition-colors ${isActive ? "text-white" : "text-white/60 group-hover:text-white/80"}`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] transition-colors ${isActive ? "text-white/50" : "text-white/30"}`}>
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-all duration-300 ${
                    isActive ? "text-white/50 translate-x-0 opacity-100" : "text-white/20 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                  }`} />
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/[0.06]">
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.04]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/70">Architect</p>
                  <p className="text-[10px] text-white/40">Obakeng Kaelo</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-lg font-bold text-gradient-premium">86</p>
                  <p className="text-[8px] text-white/30 uppercase tracking-wider">Branches</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-lg font-bold text-gradient-premium">3.6K</p>
                  <p className="text-[8px] text-white/30 uppercase tracking-wider">Paths</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-lg font-bold text-emerald-400">99%</p>
                  <p className="text-[8px] text-white/30 uppercase tracking-wider">Uptime</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="lg:hidden sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
          style={{
            background: 'linear-gradient(180deg, rgba(10, 10, 15, 0.95) 0%, rgba(10, 10, 15, 0.85) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2.5 text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Hexagon className="w-4 h-4 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <span className="font-bold text-gradient-premium">CYRUS</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] text-white/40 font-medium">OMEGA-TIER</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className="text-xs font-mono text-white/50">{formatTime(currentTime)}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
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
        </main>
      </div>
    </div>
  );
}
