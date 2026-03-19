import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import cyrusEmblem from "@assets/generated_images/cyrus_military_eagle_emblem.png";
import commandCenterBg from "@assets/generated_images/command_center_background.png";

interface PasswordGateProps {
  onAuthenticated: (sessionToken: string) => void;
}

export function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        onAuthenticated(data.sessionToken || "");
      } else {
        setError(true);
        setPassword("");
      }
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `url(${commandCenterBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-3xl" />
        
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-500/80 font-mono tracking-wider">SYSTEM ACTIVE</span>
        </div>
        <div className="absolute top-4 right-4 text-xs text-white/30 font-mono">
          {new Date().toISOString().split('T')[0]}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="relative inline-block mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-transparent to-orange-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -inset-8 border border-cyan-500/10 rounded-full" />
            <div className="absolute -inset-12 border border-orange-500/5 rounded-full" />
            <img 
              src={cyrusEmblem} 
              alt="CYRUS" 
              className="relative w-36 h-36 mx-auto"
              style={{ filter: "drop-shadow(0 0 30px rgba(6, 182, 212, 0.4))" }}
            />
          </div>
          
          <h1 className="text-5xl font-black mb-3 tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">CYRUS</span>
            <span className="text-white/60 text-lg ml-1 align-super">™</span>
          </h1>
          <p className="text-cyan-400/90 text-sm font-semibold tracking-[0.3em] uppercase mb-1">
            Command Your Responsive Unified System
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-cyan-500/50" />
            <span className="text-white/30 text-xs tracking-widest font-mono">MILITARY GRADE AI</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-cyan-500/50" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <div className="absolute -inset-px bg-gradient-to-r from-cyan-500/50 via-transparent to-orange-500/50 rounded-lg opacity-0 group-focus-within:opacity-100 blur-sm transition-all duration-500" />
            <div className="absolute inset-0 border border-white/10 rounded-lg group-focus-within:border-cyan-500/30 transition-colors" />
            <div className="relative bg-black/40 backdrop-blur-xl rounded-lg">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="ENTER ACCESS CODE"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`h-16 bg-transparent border-0 text-white text-center text-xl tracking-[0.5em] placeholder:text-white/20 placeholder:tracking-[0.2em] focus-visible:ring-0 font-mono ${error ? "text-red-400" : ""}`}
                data-testid="input-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-red-400">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-mono tracking-wider">ACCESS DENIED</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-16 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-600 hover:from-cyan-500 hover:via-cyan-400 hover:to-cyan-500 text-white font-bold text-lg tracking-[0.2em] rounded-lg shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-500/40 hover:scale-[1.02] border border-cyan-400/20"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            disabled={!password || isLoading}
            data-testid="button-submit-password"
          >
            {isLoading ? (
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AUTHENTICATING
              </span>
            ) : (
              "INITIALIZE"
            )}
          </Button>
        </form>

        <div className="mt-12 text-center space-y-3">
          <p className="text-xs text-white/20 tracking-[0.3em] font-mono">
            TOP SECRET // SI // ORCON // NOFORN
          </p>
          <div className="flex justify-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-white/30 tracking-wider">SECURE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-white/30 tracking-wider">ENCRYPTED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="text-[10px] text-white/30 tracking-wider">MILITARY</span>
            </div>
          </div>
          <p className="text-[10px] text-white/15 tracking-wide mt-4">
            Designed by Obakeng Kaelo · Botswana
          </p>
        </div>
      </div>
    </div>
  );
}
