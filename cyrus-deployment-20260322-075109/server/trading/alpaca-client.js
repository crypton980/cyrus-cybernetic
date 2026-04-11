// Alpaca Markets API v2 Client for CYRUS Trading Module
export class AlpacaClient {
    apiKey;
    secretKey;
    baseUrl;
    dataUrl;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.secretKey = config.secretKey;
        if (config.paper) {
            this.baseUrl = 'https://paper-api.alpaca.markets';
        }
        else {
            this.baseUrl = 'https://api.alpaca.markets';
        }
        this.dataUrl = 'https://data.alpaca.markets';
    }
    getHeaders() {
        return {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.secretKey,
            'Content-Type': 'application/json'
        };
    }
    async request(endpoint, options = {}, useDataUrl = false) {
        const baseUrl = useDataUrl ? this.dataUrl : this.baseUrl;
        const url = `${baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Alpaca API Error: ${errorData.message || response.statusText}`);
        }
        return response.json();
    }
    // Account Endpoints
    async getAccount() {
        return this.request('/v2/account');
    }
    // Position Endpoints
    async getPositions() {
        return this.request('/v2/positions');
    }
    async getPosition(symbol) {
        return this.request(`/v2/positions/${symbol}`);
    }
    async closePosition(symbol, qty, percentage) {
        const params = new URLSearchParams();
        if (qty)
            params.append('qty', qty.toString());
        if (percentage)
            params.append('percentage', percentage.toString());
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/v2/positions/${symbol}${query}`, { method: 'DELETE' });
    }
    async closeAllPositions(cancel_orders = true) {
        return this.request(`/v2/positions?cancel_orders=${cancel_orders}`, { method: 'DELETE' });
    }
    // Order Endpoints
    async getOrders(options = {}) {
        const params = new URLSearchParams();
        if (options.status)
            params.append('status', options.status);
        if (options.limit)
            params.append('limit', options.limit.toString());
        if (options.after)
            params.append('after', options.after);
        if (options.until)
            params.append('until', options.until);
        if (options.direction)
            params.append('direction', options.direction);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/v2/orders${query}`);
    }
    async getOrder(orderId) {
        return this.request(`/v2/orders/${orderId}`);
    }
    async createOrder(order) {
        return this.request('/v2/orders', {
            method: 'POST',
            body: JSON.stringify(order)
        });
    }
    async cancelOrder(orderId) {
        await this.request(`/v2/orders/${orderId}`, { method: 'DELETE' });
    }
    async cancelAllOrders() {
        return this.request('/v2/orders', { method: 'DELETE' });
    }
    // Market Data - Stocks
    async getStockBars(symbol, options = {}) {
        const params = new URLSearchParams();
        params.append('symbols', symbol);
        params.append('timeframe', options.timeframe || '1Hour');
        if (options.start)
            params.append('start', options.start);
        if (options.end)
            params.append('end', options.end);
        if (options.limit)
            params.append('limit', options.limit.toString());
        return this.request(`/v2/stocks/bars?${params.toString()}`, {}, true);
    }
    async getStockQuotes(symbols) {
        const params = new URLSearchParams();
        params.append('symbols', symbols.join(','));
        return this.request(`/v2/stocks/quotes/latest?${params.toString()}`, {}, true);
    }
    async getStockTrades(symbol, options = {}) {
        const params = new URLSearchParams();
        params.append('symbols', symbol);
        if (options.start)
            params.append('start', options.start);
        if (options.end)
            params.append('end', options.end);
        if (options.limit)
            params.append('limit', options.limit.toString());
        return this.request(`/v2/stocks/trades?${params.toString()}`, {}, true);
    }
    // Market Data - Crypto
    async getCryptoBars(symbol, options = {}) {
        const params = new URLSearchParams();
        params.append('symbols', symbol);
        params.append('timeframe', options.timeframe || '1Hour');
        if (options.start)
            params.append('start', options.start);
        if (options.end)
            params.append('end', options.end);
        if (options.limit)
            params.append('limit', options.limit.toString());
        return this.request(`/v1beta3/crypto/us/bars?${params.toString()}`, {}, true);
    }
    async getCryptoQuotes(symbols) {
        const params = new URLSearchParams();
        params.append('symbols', symbols.join(','));
        return this.request(`/v1beta3/crypto/us/latest/quotes?${params.toString()}`, {}, true);
    }
    // Assets
    async getAssets(options = {}) {
        const params = new URLSearchParams();
        if (options.status)
            params.append('status', options.status);
        if (options.asset_class)
            params.append('asset_class', options.asset_class);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/v2/assets${query}`);
    }
    async getAsset(symbol) {
        return this.request(`/v2/assets/${symbol}`);
    }
    // Utility Methods
    signalToOrder(signal) {
        const order = {
            symbol: signal.symbol,
            qty: signal.quantity,
            side: signal.action,
            type: 'market',
            time_in_force: 'gtc'
        };
        if (signal.stopLoss && signal.takeProfit) {
            order.order_class = 'bracket';
            order.take_profit = { limit_price: signal.takeProfit };
            order.stop_loss = { stop_price: signal.stopLoss };
        }
        return order;
    }
}
// Factory function to create Alpaca client
export function createAlpacaClient() {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    const paper = (process.env.ALPACA_ENVIRONMENT || 'paper') === 'paper';
    if (!apiKey || !secretKey) {
        console.warn('[Alpaca] Missing API credentials. Set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables.');
        return null;
    }
    return new AlpacaClient({
        apiKey,
        secretKey,
        paper
    });
}
