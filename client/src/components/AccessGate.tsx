import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

interface AccessGateProps {
  onAuthenticated: () => void;
}

export function AccessGate({ onAuthenticated }: AccessGateProps) {
  const [accessCode, setAccessCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    const formatted = now.toISOString().split("T")[0];
    setCurrentDate(formatted);
  }, []);

  const handleInitialize = async () => {
    if (!accessCode.trim()) {
      setError("Access code required");
      return;
    }

    setIsInitializing(true);
    setError("");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (accessCode === "71580019") {
      localStorage.setItem("cyrus_authenticated", "true");
      onAuthenticated();
    } else {
      setError("ACCESS DENIED - Invalid authorization code");
      setIsInitializing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleInitialize();
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&q=80')`,
          filter: "brightness(0.3) saturate(1.2)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,255,0.05)_0%,_transparent_70%)]" />

      <div className="relative z-10 flex-1 flex flex-col px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#30d158] animate-pulse" />
            <span className="text-[#30d158] text-xs font-mono tracking-widest">
              SYSTEM ACTIVE
            </span>
          </div>
          <span className="text-cyan-400/70 text-xs font-mono">{currentDate}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
          <div className="relative mb-8">
            <div className="w-52 h-52 relative">
              <img 
                src="/images/cyrus-logo.png" 
                alt="CYRUS" 
                className="w-full h-full object-cover drop-shadow-[0_0_30px_rgba(34,211,238,0.7)] scale-125"
                style={{ clipPath: 'circle(42% at center)' }}
              />
              <div className="absolute -left-8 top-1/2 -translate-y-1/2">
                <div className="w-12 h-14 border-l-2 border-t-2 border-b-2 border-cyan-500/70 rounded-l-lg" />
              </div>
              <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                <div className="w-12 h-14 border-r-2 border-t-2 border-b-2 border-cyan-500/70 rounded-r-lg" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-bold tracking-wider mb-2">
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text text-transparent">
              CYRUS
            </span>
            <span className="text-cyan-400/60 text-lg align-top ml-1">™</span>
          </h1>

          <p className="text-cyan-400/80 text-xs tracking-[0.3em] font-light mb-1 text-center">
            COMMAND YOUR RESPONSIVE
          </p>
          <p className="text-cyan-400/80 text-xs tracking-[0.3em] font-light mb-3 text-center">
            UNIFIED SYSTEM
          </p>

          <p className="text-gray-500 text-[10px] tracking-[0.2em] mb-8">
            MILITARY GRADE AI
          </p>

          <div className="w-full max-w-xs space-y-4 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-cyan-400/10 to-cyan-500/20 rounded-lg blur-sm" />
              <div className="relative bg-slate-900/80 border border-cyan-500/30 rounded-lg overflow-hidden">
                <input
                  type={showCode ? "text" : "password"}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ENTER ACCESS CODE"
                  className="w-full bg-transparent px-4 py-4 text-center text-cyan-400 placeholder-cyan-600/50 text-sm tracking-widest font-mono focus:outline-none"
                />
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                >
                  {showCode ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center font-mono">{error}</p>
            )}

            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-lg blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-gradient-to-r from-cyan-600 to-cyan-500 py-4 rounded-lg text-white font-bold tracking-[0.3em] text-sm transition-all hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50">
                {isInitializing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    INITIALIZING...
                  </span>
                ) : (
                  "INITIALIZE"
                )}
              </div>
            </button>
          </div>

          <div className="text-center space-y-3">
            <p className="text-gray-600 text-[10px] tracking-[0.15em] font-mono">
              TOP SECRET // SI // ORCON // NOFORN
            </p>

            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
                <span className="text-[10px] text-gray-500 tracking-wider">SECURE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-gray-500 tracking-wider">ENCRYPTED</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-gray-500 tracking-wider">MILITARY</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pb-4">
          <p className="text-gray-600 text-[10px] tracking-wider">
            Designed by Obakeng Kaelo - Botswana
          </p>
        </div>
      </div>
    </div>
  );
}
