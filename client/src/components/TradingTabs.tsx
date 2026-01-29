import { useState } from "react";
import { useTrading } from "../hooks/useTrading";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Clock,
  DollarSign,
  RefreshCw,
  X,
} from "lucide-react";

type TabType = "account" | "positions" | "orders" | "trade";

export function TradingTabs() {
  const [activeTab, setActiveTab] = useState<TabType>("account");
  const [orderForm, setOrderForm] = useState({
    symbol: "AAPL",
    qty: 1,
    side: "buy" as "buy" | "sell",
    type: "market" as "market" | "limit" | "stop",
    limitPrice: "",
  });

  const {
    account,
    positions,
    orders,
    quote,
    selectedSymbol,
    setSelectedSymbol,
    isLoading,
    placeOrder,
    cancelOrder,
    closePosition,
    refreshAll,
  } = useTrading();

  const tabs = [
    { id: "account", label: "Account", icon: Wallet },
    { id: "positions", label: "Positions", icon: BarChart3 },
    { id: "orders", label: "Orders", icon: Clock },
    { id: "trade", label: "Trade", icon: DollarSign },
  ];

  const handlePlaceOrder = () => {
    placeOrder.mutate({
      symbol: orderForm.symbol,
      qty: orderForm.qty,
      side: orderForm.side,
      type: orderForm.type,
      limitPrice: orderForm.limitPrice ? parseFloat(orderForm.limitPrice) : undefined,
    });
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        <button
          onClick={refreshAll}
          className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Refresh all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}

        {!isLoading && activeTab === "account" && account && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Balance</p>
                <p className="text-2xl font-bold text-white">
                  ${account.balance.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Buying Power</p>
                <p className="text-2xl font-bold text-green-400">
                  ${account.buyingPower.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Equity</p>
                <p className="text-2xl font-bold text-white">
                  ${account.equity.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Status</p>
                <p className="text-lg font-medium text-blue-400">{account.status}</p>
              </div>
            </div>
          </div>
        )}

        {!isLoading && activeTab === "positions" && (
          <div className="space-y-2">
            {positions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No open positions</p>
            ) : (
              positions.map((pos) => (
                <div
                  key={pos.symbol}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-white">{pos.symbol}</p>
                    <p className="text-sm text-gray-400">
                      {pos.qty} shares @ ${pos.avgEntryPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        pos.unrealizedPl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {pos.unrealizedPl >= 0 ? "+" : ""}${pos.unrealizedPl.toFixed(2)}
                    </p>
                    <button
                      onClick={() => closePosition.mutate(pos.symbol)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!isLoading && activeTab === "orders" && (
          <div className="space-y-2">
            {orders.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No pending orders</p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-white">
                      {order.side.toUpperCase()} {order.symbol}
                    </p>
                    <p className="text-sm text-gray-400">
                      {order.qty} shares • {order.type}
                      {order.limitPrice && ` @ $${order.limitPrice}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        order.status === "filled"
                          ? "bg-green-600"
                          : order.status === "cancelled"
                          ? "bg-red-600"
                          : "bg-yellow-600"
                      }`}
                    >
                      {order.status}
                    </span>
                    {order.status === "pending" && (
                      <button
                        onClick={() => cancelOrder.mutate(order.id)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!isLoading && activeTab === "trade" && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={orderForm.symbol}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })
                  }
                  placeholder="Symbol"
                  className="bg-gray-700 text-white px-3 py-2 rounded-lg w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setSelectedSymbol(orderForm.symbol)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Get Quote
                </button>
              </div>

              {quote && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                  <p className="text-lg font-bold text-white">{quote.symbol}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">Bid: ${quote.bid}</span>
                    <span className="text-red-400">Ask: ${quote.ask}</span>
                    <span className="text-gray-400">Last: ${quote.last}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={orderForm.qty}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, qty: parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Type</label>
                  <select
                    value={orderForm.type}
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        type: e.target.value as "market" | "limit" | "stop",
                      })
                    }
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="market">Market</option>
                    <option value="limit">Limit</option>
                    <option value="stop">Stop</option>
                  </select>
                </div>
              </div>

              {(orderForm.type === "limit" || orderForm.type === "stop") && (
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-1">
                    {orderForm.type === "limit" ? "Limit" : "Stop"} Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={orderForm.limitPrice}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, limitPrice: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setOrderForm({ ...orderForm, side: "buy" });
                    handlePlaceOrder();
                  }}
                  disabled={placeOrder.isPending}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <TrendingUp className="w-4 h-4" />
                  Buy
                </button>
                <button
                  onClick={() => {
                    setOrderForm({ ...orderForm, side: "sell" });
                    handlePlaceOrder();
                  }}
                  disabled={placeOrder.isPending}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <TrendingDown className="w-4 h-4" />
                  Sell
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
