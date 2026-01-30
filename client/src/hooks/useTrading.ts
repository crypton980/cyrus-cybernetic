import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TradingStatus {
  isRunning: boolean;
  autoTrade: boolean;
  marketsMonitored: number;
  openPositions: number;
  totalBalance: number;
  unrealizedPnl: number;
  alpacaConnected: boolean;
  alpacaEnvironment?: string;
}

export interface TradingAccount {
  id: string;
  currency: string;
  balance: number;
  buyingPower: number;
  equity: number;
  status: string;
}

export interface Position {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPl: number;
  side: "long" | "short";
}

export interface Order {
  id: string;
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  status: string;
  filledQty: number;
  limitPrice?: number;
  createdAt: string;
}

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: string;
}

export function useTrading() {
  const queryClient = useQueryClient();
  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");

  // Trading status with Alpaca connection info
  const statusQuery = useQuery<TradingStatus>({
    queryKey: ["/api/trading/status"],
    queryFn: async () => {
      const res = await fetch("/api/trading/status", {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const accountQuery = useQuery<TradingAccount>({
    queryKey: ["/api/trading/account"],
    queryFn: async () => {
      const res = await fetch("/api/trading/account");
      if (!res.ok) throw new Error("Failed to fetch account");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const positionsQuery = useQuery<Position[]>({
    queryKey: ["/api/trading/positions"],
    queryFn: async () => {
      const res = await fetch("/api/trading/positions");
      if (!res.ok) throw new Error("Failed to fetch positions");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const ordersQuery = useQuery<Order[]>({
    queryKey: ["/api/trading/orders"],
    queryFn: async () => {
      const res = await fetch("/api/trading/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const quoteQuery = useQuery<MarketQuote>({
    queryKey: ["/api/trading/quote", selectedSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/trading/quote/${selectedSymbol}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      return res.json();
    },
    enabled: !!selectedSymbol,
    refetchInterval: 5000,
  });

  const placeOrder = useMutation({
    mutationFn: async (order: {
      symbol: string;
      qty: number;
      side: "buy" | "sell";
      type: "market" | "limit" | "stop";
      limitPrice?: number;
    }) => {
      const res = await fetch("/api/trading/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (!res.ok) throw new Error("Failed to place order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/account"] });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/trading/orders/${orderId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/orders"] });
    },
  });

  const closePosition = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await fetch(`/api/trading/positions/${symbol}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to close position");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/account"] });
    },
  });

  // Start autonomous trading
  const startAutonomous = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/trading/autonomous/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to start autonomous trading");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/decisions"] });
    },
  });

  // Stop autonomous trading
  const stopAutonomous = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/trading/autonomous/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to stop autonomous trading");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
    },
  });

  // Execute AI decision
  const executeDecision = useMutation({
    mutationFn: async (decisionId: string) => {
      const res = await fetch("/api/trading/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
      });
      if (!res.ok) throw new Error("Failed to execute trade");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/decisions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
    },
  });

  return {
    status: statusQuery.data,
    account: accountQuery.data,
    positions: positionsQuery.data || [],
    orders: ordersQuery.data || [],
    quote: quoteQuery.data,
    selectedSymbol,
    setSelectedSymbol,
    isLoading: accountQuery.isLoading || positionsQuery.isLoading || statusQuery.isLoading,
    alpacaConnected: statusQuery.data?.alpacaConnected || false,
    alpacaEnvironment: statusQuery.data?.alpacaEnvironment || 'paper',
    placeOrder,
    cancelOrder,
    closePosition,
    startAutonomous,
    stopAutonomous,
    executeDecision,
    refreshAll: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading"] });
    }, [queryClient]),
  };
}
