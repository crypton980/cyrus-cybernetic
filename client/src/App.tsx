import { useState, useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import {
  Menu,
  X,
  MessageSquare,
  Scan,
  FileText,
  MapPin,
  Phone,
  Monitor,
  TrendingUp,
  Plane,
  ChevronRight,
  Activity,
  Cpu,
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
  { path: "/", label: "Command", icon: MessageSquare },
  { path: "/scan", label: "Vision", icon: Scan },
  { path: "/files", label: "Documents", icon: FileText },
  { path: "/nav", label: "Navigation", icon: MapPin },
  { path: "/comms", label: "Comms", icon: Phone },
  { path: "/device", label: "Systems", icon: Monitor },
  { path: "/drone", label: "Aerospace", icon: Plane },
  { path: "/trading", label: "Markets", icon: TrendingUp },
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

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-[#0a0a0a] border-r border-[#1f1f1f] transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-[#1f1f1f]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-black" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-wide">CYRUS</div>
                  <div className="text-[10px] text-[#666] tracking-wider">AUTONOMOUS SYSTEM</div>
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="lg:hidden p-1.5 text-[#666] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#0d0d0d] border border-[#1f1f1f] rounded">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00c853]" />
              <span className="text-[10px] text-[#00c853] font-medium tracking-wider uppercase">OPERATIONAL</span>
              <span className="ml-auto text-[10px] text-[#666] font-mono">{formatTime(currentTime)}</span>
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors ${
                    isActive
                      ? "bg-[#1a1a1a] text-white"
                      : "text-[#888] hover:text-white hover:bg-[#111]"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto text-[#444]" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-[#1f1f1f]">
            <div className="px-3 py-2 bg-[#0d0d0d] border border-[#1f1f1f] rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#666] uppercase tracking-wider">Core Status</span>
                <Activity className="w-3 h-3 text-[#666]" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-mono text-white">86</div>
                  <div className="text-[8px] text-[#444] uppercase">Branches</div>
                </div>
                <div>
                  <div className="text-sm font-mono text-white">3.6K</div>
                  <div className="text-[8px] text-[#444] uppercase">Paths</div>
                </div>
                <div>
                  <div className="text-sm font-mono text-[#00c853]">99%</div>
                  <div className="text-[8px] text-[#444] uppercase">Uptime</div>
                </div>
              </div>
            </div>
            <div className="mt-2 px-3 py-1.5 text-center">
              <span className="text-[10px] text-[#444]">Architect: </span>
              <span className="text-[10px] text-[#666]">Obakeng Kaelo</span>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden border-b border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 text-[#666] hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white flex items-center justify-center">
              <Cpu className="w-4 h-4 text-black" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold">CYRUS</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00c853]" />
            <span className="text-[10px] text-[#666] font-mono">{formatTime(currentTime)}</span>
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
