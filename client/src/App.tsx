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
  Cpu,
  Activity,
  Zap,
  Shield,
  Microscope,
  Droplets,
} from "lucide-react";

import { AccessGate } from "./components/AccessGate";
import { IntroSequence } from "./components/IntroSequence";
import { Dashboard } from "./components/Dashboard";
import { ScanPage } from "./pages/ScanPage";
import { FileAnalysisPage } from "./pages/FileAnalysisPage";
import { NavigationPage } from "./pages/NavigationPage";
import { CommsPage } from "./pages/CommsPage";
import { DeviceControlPage } from "./pages/DeviceControlPage";
import { TradingPage } from "./pages/TradingPage";
import { DronePage } from "./pages/DronePage";
import { ModulesPage } from "./pages/ModulesPage";
import { MedicalPage } from "./pages/MedicalPage";
import { QuantumPage } from "./pages/QuantumPage";
import { SecurityPage } from "./pages/SecurityPage";
import { BiologyPage } from "./pages/BiologyPage";
import { BloodSamplingPage } from "./pages/BloodSamplingPage";

const navItems = [
  { path: "/", label: "Command", sublabel: "Primary Interface", icon: MessageSquare },
  { path: "/modules", label: "Modules", sublabel: "AI Orchestrator", icon: Cpu },
  { path: "/scan", label: "Vision", sublabel: "Optical Analysis", icon: Scan },
  { path: "/files", label: "Documents", sublabel: "File Processing", icon: FileText },
  { path: "/nav", label: "Navigation", sublabel: "Geospatial", icon: MapPin },
  { path: "/comms", label: "Communications", sublabel: "Secure Channels", icon: Phone },
  { path: "/device", label: "Systems", sublabel: "Hardware Control", icon: Monitor },
  { path: "/drone", label: "Aerospace", sublabel: "UAV Operations", icon: Plane },
  { path: "/trading", label: "Markets", sublabel: "Financial Intel", icon: TrendingUp },
];

const moduleItems = [
  { path: "/medical", label: "Medical", sublabel: "Diagnostics", icon: Activity },
  { path: "/quantum", label: "Quantum", sublabel: "Neural Net", icon: Zap },
  { path: "/security", label: "Security", sublabel: "Encryption", icon: Shield },
  { path: "/biology", label: "Biology", sublabel: "Lab Analysis", icon: Microscope },
  { path: "/blood", label: "Blood", sublabel: "Sampling", icon: Droplets },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const authenticated = localStorage.getItem("cyrus_authenticated");
    const introWatched = sessionStorage.getItem("cyrus_intro_watched");
    if (authenticated === "true") {
      setIsAuthenticated(true);
      if (introWatched === "true") {
        setIntroComplete(true);
      }
    }
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setShowIntro(true);
  };

  const handleIntroComplete = () => {
    sessionStorage.setItem("cyrus_intro_watched", "true");
    setShowIntro(false);
    setIntroComplete(true);
  };

  if (!isAuthenticated) {
    return <AccessGate onAuthenticated={handleAuthenticated} />;
  }

  if (showIntro || (!introComplete && isAuthenticated)) {
    return <IntroSequence onComplete={handleIntroComplete} />;
  }

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1c1c1e] border-r border-[rgba(84,84,88,0.65)] transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0a84ff] rounded-xl flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">CYRUS</h1>
                  <p className="text-xs text-[rgba(235,235,245,0.5)]">Quantum AI System</p>
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="lg:hidden p-2 text-[rgba(235,235,245,0.5)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Status */}
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-[rgba(48,209,88,0.1)] rounded-lg">
              <div className="w-2 h-2 rounded-full bg-[#30d158]" />
              <span className="text-xs font-semibold text-[#30d158]">OPERATIONAL</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 overflow-y-auto space-y-6 py-4">
            <div>
              <p className="px-3 text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest mb-2">Main</p>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? "bg-[#0a84ff] text-white"
                          : "text-[rgba(235,235,245,0.8)] hover:bg-[rgba(120,120,128,0.2)]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isActive ? "bg-white/20" : "bg-[rgba(120,120,128,0.2)]"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className={`text-[10px] ${isActive ? "text-white/60" : "text-[rgba(235,235,245,0.4)]"}`}>
                          {item.sublabel}
                        </p>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest mb-2">Advanced Modules</p>
              <div className="space-y-1">
                {moduleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? "bg-[#0a84ff] text-white"
                          : "text-[rgba(235,235,245,0.8)] hover:bg-[rgba(120,120,128,0.2)]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isActive ? "bg-white/20" : "bg-[rgba(120,120,128,0.2)]"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className={`text-[10px] ${isActive ? "text-white/60" : "text-[rgba(235,235,245,0.4)]"}`}>
                          {item.sublabel}
                        </p>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Footer Stats */}
          <div className="p-4 border-t border-[rgba(84,84,88,0.65)]">
            <div className="bg-[#2c2c2e] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[rgba(235,235,245,0.5)]">Core Status</span>
                <span className="text-[10px] font-semibold text-[#30d158]">ACTIVE</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold">86</p>
                  <p className="text-[10px] text-[rgba(235,235,245,0.4)]">Branches</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">3.6K</p>
                  <p className="text-[10px] text-[rgba(235,235,245,0.4)]">Paths</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-[#30d158]">99%</p>
                  <p className="text-[10px] text-[rgba(235,235,245,0.4)]">Uptime</p>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-[rgba(235,235,245,0.3)] mt-3">
              Architect: Obakeng Kaelo
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[#1c1c1e] border-b border-[rgba(84,84,88,0.65)] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2">
            <Menu className="w-5 h-5 text-[rgba(235,235,245,0.6)]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#0a84ff] rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">CYRUS</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#30d158]" />
            <span className="text-xs text-[rgba(235,235,245,0.5)]">Online</span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-black">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/modules" component={ModulesPage} />
            <Route path="/scan" component={ScanPage} />
            <Route path="/files" component={FileAnalysisPage} />
            <Route path="/nav" component={NavigationPage} />
            <Route path="/comms" component={CommsPage} />
            <Route path="/device" component={DeviceControlPage} />
            <Route path="/drone" component={DronePage} />
            <Route path="/trading" component={TradingPage} />
            <Route path="/medical" component={MedicalPage} />
            <Route path="/quantum" component={QuantumPage} />
            <Route path="/security" component={SecurityPage} />
            <Route path="/biology" component={BiologyPage} />
            <Route path="/blood" component={BloodSamplingPage} />
          </Switch>
        </main>
      </div>
    </div>
  );
}
