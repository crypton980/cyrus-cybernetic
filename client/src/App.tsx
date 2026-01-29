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
  { path: "/", label: "Command", sublabel: "Primary Interface", icon: MessageSquare },
  { path: "/scan", label: "Vision", sublabel: "Optical Analysis", icon: Scan },
  { path: "/files", label: "Documents", sublabel: "File Processing", icon: FileText },
  { path: "/nav", label: "Navigation", sublabel: "Geospatial", icon: MapPin },
  { path: "/comms", label: "Communications", sublabel: "Secure Channels", icon: Phone },
  { path: "/device", label: "Systems", sublabel: "Hardware Control", icon: Monitor },
  { path: "/drone", label: "Aerospace", sublabel: "UAV Operations", icon: Plane },
  { path: "/trading", label: "Markets", sublabel: "Financial Intel", icon: TrendingUp },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar - Apple Settings Style */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#1c1c1e] transform transition-transform duration-300 ease-out lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">CYRUS</h1>
                <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-0.5">Quantum AI System</p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="lg:hidden p-2 -mr-2 text-[rgba(235,235,245,0.6)] hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Status Badge */}
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[rgba(48,209,88,0.15)] rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#30d158]" />
              <span className="text-[13px] font-medium text-[#30d158]">Operational</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 overflow-y-auto">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-[#0a84ff] text-white"
                        : "text-white hover:bg-[rgba(120,120,128,0.24)]"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-white/20" : "bg-[rgba(120,120,128,0.24)]"
                    }`}>
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium">{item.label}</p>
                      <p className={`text-[12px] ${isActive ? "text-white/70" : "text-[rgba(235,235,245,0.4)]"}`}>
                        {item.sublabel}
                      </p>
                    </div>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 text-white/60" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer - System Stats */}
          <div className="p-4 border-t border-[rgba(84,84,88,0.65)]">
            <div className="bg-[#2c2c2e] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] text-[rgba(235,235,245,0.6)]">Core Status</span>
                <span className="text-[11px] text-[#30d158] font-medium">ACTIVE</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[20px] font-semibold">86</p>
                  <p className="text-[11px] text-[rgba(235,235,245,0.4)]">Branches</p>
                </div>
                <div className="text-center">
                  <p className="text-[20px] font-semibold">3.6K</p>
                  <p className="text-[11px] text-[rgba(235,235,245,0.4)]">Paths</p>
                </div>
                <div className="text-center">
                  <p className="text-[20px] font-semibold text-[#30d158]">99%</p>
                  <p className="text-[11px] text-[rgba(235,235,245,0.4)]">Uptime</p>
                </div>
              </div>
            </div>
            <p className="text-center text-[11px] text-[rgba(235,235,245,0.3)] mt-3">
              Architect: Obakeng Kaelo
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[#1c1c1e]/95 backdrop-blur-xl border-b border-[rgba(84,84,88,0.65)] px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-2 text-[rgba(235,235,245,0.6)] hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-semibold">CYRUS</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#30d158]" />
            <span className="text-[13px] text-[rgba(235,235,245,0.6)]">Online</span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-black">
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
