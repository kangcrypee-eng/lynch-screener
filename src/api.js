const API = import.meta.env.VITE_API_URL || 'https://lynch-screener-api.YOUR_SUBDOMAIN.workers.dev';

async function get(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

export const api = {
  screener: (sector, save) => get(`/api/screener?sector=${encodeURIComponent(sector || '')}&limit=25&save=${save ? 'true' : 'false'}`),
  analyze: (sym) => get(`/api/analyze?symbol=${encodeURIComponent(sym)}`),
  snapshots: () => get('/api/snapshots'),
  getPortfolio: () => get('/api/portfolio'),
  buy: (symbol, shares, price) => post('/api/portfolio', { action: 'buy', symbol, shares, price }),
  sell: (symbol, shares, price) => post('/api/portfolio', { action: 'sell', symbol, shares, price }),
};
