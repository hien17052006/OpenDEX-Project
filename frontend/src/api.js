const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const request = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body;
};

export const getConfig = () => request('/config');
export const getOrderBook = () => request('/orderbook');
export const getTrades = () => request('/trades');
export const getOrders = (trader) => request(`/orders?trader=${trader}`);

export const postOrder = (order, signature) =>
  request('/orders', { method: 'POST', body: JSON.stringify({ order, signature }) });

export const confirmCancel = (hash) =>
  request(`/orders/${hash}/cancel`, { method: 'POST' });