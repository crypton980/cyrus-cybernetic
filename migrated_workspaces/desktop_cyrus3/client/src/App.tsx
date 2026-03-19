import { useState, useEffect, useCallback } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { PasswordGate } from "@/components/password-gate";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import DroneControl from "@/pages/drone-control";
import AIDashboard from "@/pages/ai-dashboard";
import AIAssistant from "@/pages/ai-assistant";
import TradingDashboard from "@/pages/trading-dashboard";
import DesignAutomation from "@/pages/design-automation";

const AUTH_KEY = "cyrus_auth_session";
const AUTH_TIMESTAMP_KEY = "cyrus_auth_timestamp";
const SESSION_TOKEN_KEY = "cyrus_session_token";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Export session token getter for use in API requests
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function checkAuthValidity(): boolean {
  try {
    const auth = localStorage.getItem(AUTH_KEY);
    const timestamp = localStorage.getItem(AUTH_TIMESTAMP_KEY);
    
    if (auth !== "valid" || !timestamp) {
      return false;
    }
    
    const authTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    // Check if session has expired
    if (now - authTime > SESSION_DURATION) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_TIMESTAMP_KEY);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/drone-control" component={DroneControl} />
      <Route path="/ai-dashboard" component={AIDashboard} />
      <Route path="/ai-assistant" component={AIAssistant} />
      <Route path="/trading" component={TradingDashboard} />
      <Route path="/design" component={DesignAutomation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Check auth synchronously on initial render for security
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkAuthValidity());
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Double-check authentication on mount
    const valid = checkAuthValidity();
    setIsAuthenticated(valid);
    setIsChecking(false);
  }, []);

  const handleAuthenticated = useCallback((sessionToken: string) => {
    try {
      localStorage.setItem(AUTH_KEY, "valid");
      localStorage.setItem(AUTH_TIMESTAMP_KEY, Date.now().toString());
      if (sessionToken) {
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      }
      setIsAuthenticated(true);
    } catch {
      // If localStorage fails, still allow session but warn
      console.warn("Could not persist auth to storage");
      setIsAuthenticated(true);
    }
  }, []);

  // Always show password gate first until we confirm auth
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center tactical-grid">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <div className="text-cyan-400 font-mono tracking-wider animate-pulse">VERIFYING ACCESS...</div>
        </div>
      </div>
    );
  }

  // SECURITY: Always require password if not authenticated
  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <PasswordGate onAuthenticated={handleAuthenticated} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
