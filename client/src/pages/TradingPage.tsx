import { TradingTabs } from "../components/TradingTabs";
import { CyrusAssistant } from "../components/CyrusAssistant";
import { TrendingUp } from "lucide-react";

export function TradingPage() {
  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <header>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                Trading Dashboard
              </h1>
              <p className="text-gray-400">
                Manage your portfolio, positions, and orders
              </p>
            </header>

            <TradingTabs />

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-semibold mb-3">Trading Information</h3>
              <div className="text-sm text-gray-400 space-y-2">
                <p>
                  This trading dashboard is powered by the <strong>Alpaca Markets</strong> integration.
                  Ensure your API keys are configured to access live trading functionality.
                </p>
                <p>
                  <strong>Supported features:</strong> Account info, positions management, 
                  order placement (market, limit, stop), real-time quotes.
                </p>
                <p className="text-yellow-400">
                  Trading involves risk. Always verify orders before execution.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="font-semibold mb-3 text-green-400">CYRUS Trading AI</h3>
              <p className="text-xs text-gray-400 mb-3">
                Ask about market analysis, trading strategies, risk management, technical indicators, and more.
              </p>
              <CyrusAssistant 
                module="trading" 
                context="User is viewing the trading dashboard with portfolio, positions, and order management capabilities."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
