/**
 * Lynch Fast Grower Screener - Cloudflare Worker
 * Yahoo Finance + 린치 8기준 스코어링 + KV 주간 스냅샷 + 매도시그널
 * 
 * KV Namespace: LYNCH_DATA (wrangler.toml에서 바인딩)
 * Cron: 매주 일요일 09:00 UTC
 */

const ALLOWED_ORIGINS = [
  'https://kangcrypee-eng.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
];

const YF_BASE = 'https://query2.finance.yahoo.com';

// Yahoo Finance crumb/cookie 인증
let cachedAuth = null;
let authExpiry = 0;

async function getYahooAuth() {
  const now = Date.now();
  if (cachedAuth && now < authExpiry) return cachedAuth;

  // Step 1: 쿠키 획득
  const cookieRes = await fetch('https://fc.yahoo.com', {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  const setCookie = cookieRes.headers.get('set-cookie') || '';
  const cookies = setCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');

  // Step 2: crumb 획득
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookies,
    },
  });

  if (!crumbRes.ok) {
    // crumb 없이 시도하는 fallback
    cachedAuth = { cookies: '', crumb: '' };
    authExpiry = now + 60000; // 1분만 캐시
    return cachedAuth;
  }

  const crumb = await crumbRes.text();
  cachedAuth = { cookies, crumb };
  authExpiry = now + 3600000; // 1시간 캐시
  return cachedAuth;
}

async function yfFetch(path) {
  const auth = await getYahooAuth();
  const sep = path.includes('?') ? '&' : '?';
  const crumbParam = auth.crumb ? `${sep}crumb=${encodeURIComponent(auth.crumb)}` : '';
  const url = path.startsWith('http') ? `${path}${crumbParam}` : `${YF_BASE}${path}${crumbParam}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
      'Cookie': auth.cookies,
    },
  });

  if (!res.ok) {
    // 인증 만료 시 리셋 후 1회 재시도
    if (res.status === 401 || res.status === 403) {
      cachedAuth = null;
      authExpiry = 0;
      const auth2 = await getYahooAuth();
      const crumbParam2 = auth2.crumb ? `${sep}crumb=${encodeURIComponent(auth2.crumb)}` : '';
      const url2 = path.startsWith('http') ? `${path}${crumbParam2}` : `${YF_BASE}${path}${crumbParam2}`;
      const res2 = await fetch(url2, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Cookie': auth2.cookies,
        },
      });
      if (!res2.ok) throw new Error(`Yahoo ${res2.status}`);
      return res2.json();
    }
    throw new Error(`Yahoo ${res.status}`);
  }
  return res.json();
}

// ─── 후보 종목 수집 ───

async function fetchCandidates(sector) {
  const body = {
    size: 100, offset: 0,
    sortField: 'epsgrowth.lasttwelvemonths', sortType: 'DESC',
    quoteType: 'EQUITY',
    query: { operator: 'AND', operands: [
      { operator: 'or', operands: [
        { operator: 'EQ', operands: ['exchange', 'NMS'] },
        { operator: 'EQ', operands: ['exchange', 'NYQ'] },
        { operator: 'EQ', operands: ['exchange', 'NGM'] },
        { operator: 'EQ', operands: ['exchange', 'NCM'] },
      ]},
      { operator: 'GT', operands: ['intradaymarketcap', 300000000] },
      { operator: 'GT', operands: ['epsgrowth.lasttwelvemonths', 0.15] },
      { operator: 'BTWN', operands: ['peratio.lasttwelvemonths', 3, 60] },
    ]},
  };
  if (sector && sector !== 'All Sectors') {
    body.query.operands.push({ operator: 'EQ', operands: ['sector', sector] });
  }
  try {
    const auth = await getYahooAuth();
    const crumbParam = auth.crumb ? `?crumb=${encodeURIComponent(auth.crumb)}` : '';
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/screener${crumbParam}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
        'Cookie': auth.cookies,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const q = data?.finance?.result?.[0]?.quotes || [];
      const syms = q.map(x => x.symbol).filter(s => s && !s.includes('.'));
      if (syms.length > 10) return syms;
    }
  } catch {}
  return getFallbackList();
}

function getFallbackList() {
  return [
    'NVDA','AVGO','AMD','SMCI','CRWD','PANW','DDOG','NET','SNOW','MDB',
    'PLTR','TTD','SHOP','MELI','NU','DUOL','CELH','ONON','DECK','AXON',
    'HUBS','WDAY','NOW','ABNB','UBER','DASH','RBLX','APP','TOST','CAVA',
    'AFRM','SOFI','COIN','HOOD','MNDY','ZS','FTNT','IOT','GRAB','SE',
    'ARM','CART','VRT','CEG','VST','GWRE','FIX','EME','HWM','TDG',
    'WING','ELF','BROS','RXRX','SOUN','IONQ','RKLB','LUNR','ASTS',
    'DKNG','LMND','ROOT','OKLO','SMR','LEU',
  ];
}

// ─── 종목 상세 ───

async function fetchStockDetails(symbol) {
  const modules = [
    'defaultKeyStatistics','financialData','earningsTrend',
    'incomeStatementHistory','balanceSheetHistory',
    'institutionOwnership','insiderTransactions',
    'summaryDetail','price','summaryProfile',
  ].join(',');
  const data = await yfFetch(`/v10/finance/quoteSummary/${symbol}?modules=${modules}`);
  return data?.quoteSummary?.result?.[0] || null;
}

// ─── 린치 스코어링 (8기준, 100점) ───

function calculateLynchScore(details) {
  if (!details) return null;
  const stats = details.defaultKeyStatistics || {};
  const fin = details.financialData || {};
  const sum = details.summaryDetail || {};
  const pr = details.price || {};
  const prof = details.summaryProfile || {};
  const incH = details.incomeStatementHistory?.incomeStatementHistory || [];
  const insTx = details.insiderTransactions?.transactions || [];

  let score = 0;
  const b = {};

  // 1. EPS Growth (20점)
  let epsPct = null;
  if (incH.length >= 2) {
    const c = incH[0]?.netIncome?.raw, p = incH[1]?.netIncome?.raw;
    if (c && p && p > 0) epsPct = ((c - p) / Math.abs(p)) * 100;
  }
  if (epsPct === null) {
    const t = details.earningsTrend?.trend || [];
    const y5 = t.find(x => x.period === '+5y');
    if (y5?.growth?.raw) epsPct = y5.growth.raw * 100;
  }
  if (epsPct === null && stats.earningsQuarterlyGrowth?.raw != null) {
    epsPct = stats.earningsQuarterlyGrowth.raw * 100;
  }
  if (epsPct !== null) {
    b.epsGrowth = `${epsPct.toFixed(1)}%`;
    b.epsGrowthRaw = epsPct;
    if (epsPct >= 20 && epsPct <= 50) { score += 20; b.epsGrowthStatus = 'optimal'; }
    else if (epsPct > 50 && epsPct <= 80) { score += 12; b.epsGrowthStatus = 'high'; }
    else if (epsPct >= 15 && epsPct < 20) { score += 8; b.epsGrowthStatus = 'moderate'; }
    else if (epsPct > 0) { score += 3; b.epsGrowthStatus = 'low'; }
    else { b.epsGrowthStatus = 'negative'; }
  } else { b.epsGrowth = 'N/A'; b.epsGrowthStatus = 'unknown'; }

  // 2. PEG (20점)
  let pegVal = stats.pegRatio?.raw;
  if (!pegVal && epsPct && epsPct > 0) {
    const pe = sum.trailingPE?.raw || sum.forwardPE?.raw;
    if (pe) pegVal = pe / epsPct;
  }
  if (pegVal != null && pegVal > 0) {
    b.peg = pegVal.toFixed(2); b.pegRaw = pegVal;
    if (pegVal < 0.5) { score += 20; b.pegStatus = 'excellent'; }
    else if (pegVal < 1.0) { score += 16; b.pegStatus = 'good'; }
    else if (pegVal < 1.5) { score += 8; b.pegStatus = 'fair'; }
    else { b.pegStatus = 'expensive'; }
  } else { b.peg = 'N/A'; b.pegStatus = 'unknown'; }

  // 3. D/E (13점)
  const rawDE = fin.debtToEquity?.raw;
  if (rawDE != null) {
    const de = rawDE / 100;
    b.debtEquity = de.toFixed(2); b.debtEquityRaw = de;
    if (de < 0.3) { score += 13; b.debtStatus = 'excellent'; }
    else if (de < 0.5) { score += 10; b.debtStatus = 'good'; }
    else if (de < 1.0) { score += 5; b.debtStatus = 'moderate'; }
    else { b.debtStatus = 'high'; }
  } else { b.debtEquity = 'N/A'; b.debtStatus = 'unknown'; }

  // 4. 연속 성장 (13점)
  let streak = 0;
  for (let i = 0; i < incH.length - 1; i++) {
    const c = incH[i]?.netIncome?.raw, p = incH[i+1]?.netIncome?.raw;
    if (c && p && c > p) streak++; else break;
  }
  b.consecutiveGrowth = `${streak}년`;
  if (streak >= 4) { score += 13; b.consistencyStatus = 'excellent'; }
  else if (streak >= 3) { score += 10; b.consistencyStatus = 'good'; }
  else if (streak >= 2) { score += 5; b.consistencyStatus = 'moderate'; }
  else { b.consistencyStatus = 'weak'; }

  // 5. 매출 성장 (10점)
  const rg = fin.revenueGrowth?.raw;
  if (rg != null) {
    b.revenueGrowth = `${(rg*100).toFixed(1)}%`; b.revenueGrowthRaw = rg*100;
    if (rg >= 0.20) { score += 10; b.revenueStatus = 'excellent'; }
    else if (rg >= 0.10) { score += 7; b.revenueStatus = 'good'; }
    else if (rg >= 0.05) { score += 3; b.revenueStatus = 'moderate'; }
    else { b.revenueStatus = 'low'; }
  } else { b.revenueGrowth = 'N/A'; b.revenueStatus = 'unknown'; }

  // 6. 기관 보유율 (10점)
  const ip = stats.heldPercentInstitutions?.raw;
  if (ip != null) {
    b.institutionPct = `${(ip*100).toFixed(1)}%`; b.institutionPctRaw = ip*100;
    if (ip < 0.30) { score += 10; b.institutionStatus = 'undiscovered'; }
    else if (ip < 0.50) { score += 7; b.institutionStatus = 'moderate'; }
    else if (ip < 0.70) { score += 4; b.institutionStatus = 'watched'; }
    else { score += 1; b.institutionStatus = 'crowded'; }
  } else { b.institutionPct = 'N/A'; b.institutionStatus = 'unknown'; }

  // 7. 내부자 매수 (8점)
  let buys = 0, sells = 0;
  insTx.slice(0, 12).forEach(tx => {
    const t = (tx.transactionText || '').toLowerCase();
    if (t.includes('purchase') || t.includes('buy') || t.includes('acquisition')) buys++;
    if (t.includes('sale') || t.includes('sell') || t.includes('disposition')) sells++;
  });
  b.insiderBuys = buys; b.insiderSells = sells;
  if (buys > 0 && buys >= sells) { score += 8; b.insiderStatus = 'buying'; }
  else if (buys > 0) { score += 4; b.insiderStatus = 'mixed'; }
  else if (sells > 3) { b.insiderStatus = 'selling'; }
  else { score += 2; b.insiderStatus = 'neutral'; }

  // 8. 시장 확장성 (6점)
  const sector = prof.sector || pr.sector || '';
  const industry = prof.industry || '';
  b.sector = sector; b.industry = industry;
  const hiInd = ['software','semiconductor','cloud','artificial intelligence','cybersecurity','biotech','fintech','e-commerce','saas','electric vehicle','renewable','genomic','data','platform'];
  const hiSec = ['Technology','Healthcare','Communication Services'];
  if (hiInd.some(k => industry.toLowerCase().includes(k))) { score += 6; b.marketStatus = 'high_growth'; }
  else if (hiSec.includes(sector)) { score += 4; b.marketStatus = 'growth_sector'; }
  else { score += 2; b.marketStatus = 'other'; }

  return {
    score, stars: Math.min(5, Math.max(1, Math.round((score/100)*5))),
    breakdown: b,
    price: pr.regularMarketPrice?.raw,
    marketCap: pr.marketCap?.raw,
    companyName: pr.shortName || pr.longName,
    pe: sum.trailingPE?.raw, forwardPE: sum.forwardPE?.raw,
    sector, industry,
    yearHigh: sum.fiftyTwoWeekHigh?.raw, yearLow: sum.fiftyTwoWeekLow?.raw,
  };
}

// ─── 매도 시그널 판단 ───

function checkSellSignals(current, previousWeeks) {
  const signals = [];
  const b = current.breakdown || {};

  // 1. PEG > 2.0 → 과대평가
  if (b.pegRaw && b.pegRaw > 2.0) {
    signals.push({ type: 'sell', reason: `PEG ${b.peg}로 과대평가`, severity: 'high' });
  }

  // 2. EPS 성장 음전환
  if (b.epsGrowthRaw != null && b.epsGrowthRaw < 0) {
    signals.push({ type: 'sell', reason: `EPS 성장률 ${b.epsGrowth}로 음전환`, severity: 'high' });
  }

  // 3. 부채 급증 (D/E > 1.5)
  if (b.debtEquityRaw && b.debtEquityRaw > 1.5) {
    signals.push({ type: 'sell', reason: `부채비율 ${b.debtEquity}로 급증`, severity: 'high' });
  }

  // 4. 내부자 순매도
  if (b.insiderSells > 5 && b.insiderBuys === 0) {
    signals.push({ type: 'warning', reason: `내부자 매도 ${b.insiderSells}건, 매수 0건`, severity: 'medium' });
  }

  // 5. 스코어 하락 추이 (3주 연속 하락)
  if (previousWeeks.length >= 3) {
    const scores = previousWeeks.slice(0, 3).map(w => w.score);
    if (scores.every((s, i) => i === 0 || s < scores[i-1])) {
      signals.push({ type: 'warning', reason: `3주 연속 스코어 하락 (${scores.join(' → ')})`, severity: 'medium' });
    }
  }

  // 6. 매출 역성장
  if (b.revenueGrowthRaw != null && b.revenueGrowthRaw < 0) {
    signals.push({ type: 'warning', reason: `매출 역성장 ${b.revenueGrowth}`, severity: 'medium' });
  }

  // 7. 기관 과밀 (80% 이상)
  if (b.institutionPctRaw && b.institutionPctRaw > 80) {
    signals.push({ type: 'info', reason: `기관 보유율 ${b.institutionPct} - 과밀`, severity: 'low' });
  }

  return signals;
}

// ─── KV 저장/조회 ───

function getWeekKey(date) {
  const d = date || new Date();
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - jan1) / 86400000) + jan1.getUTCDay() + 1) / 7);
  return `snapshot:${year}-W${String(week).padStart(2, '0')}`;
}

async function saveSnapshot(kv, stocks) {
  const key = getWeekKey();
  const data = {
    timestamp: new Date().toISOString(),
    weekKey: key,
    stocks: stocks.map(s => ({
      symbol: s.symbol, score: s.score, stars: s.stars,
      price: s.price, breakdown: s.breakdown,
      companyName: s.companyName, sector: s.sector,
    })),
  };
  await kv.put(key, JSON.stringify(data), { expirationTtl: 86400 * 365 }); // 1년 보관
  
  // 최신 스냅샷 키 목록 관리
  let keys = [];
  try {
    const raw = await kv.get('snapshot:keys');
    if (raw) keys = JSON.parse(raw);
  } catch {}
  if (!keys.includes(key)) keys.push(key);
  if (keys.length > 52) keys = keys.slice(-52); // 최근 52주 유지
  await kv.put('snapshot:keys', JSON.stringify(keys));
  
  return data;
}

async function getSnapshot(kv, weekKey) {
  const raw = await kv.get(weekKey);
  return raw ? JSON.parse(raw) : null;
}

async function getAllSnapshots(kv) {
  let keys = [];
  try {
    const raw = await kv.get('snapshot:keys');
    if (raw) keys = JSON.parse(raw);
  } catch {}
  
  const snapshots = [];
  for (const key of keys.slice(-12)) { // 최근 12주
    const snap = await getSnapshot(kv, key);
    if (snap) snapshots.push(snap);
  }
  return snapshots;
}

// ─── 포트폴리오 관리 ───

async function getPortfolio(kv) {
  const raw = await kv.get('portfolio');
  return raw ? JSON.parse(raw) : { holdings: [], transactions: [] };
}

async function savePortfolio(kv, portfolio) {
  await kv.put('portfolio', JSON.stringify(portfolio));
}

// ─── Route Handlers ───

async function handleScreener(request, kv) {
  const url = new URL(request.url);
  const sector = url.searchParams.get('sector') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 25, 40);
  const save = url.searchParams.get('save') === 'true';

  let candidates;
  try { candidates = await fetchCandidates(sector); } catch { candidates = getFallbackList(); }

  const toAnalyze = candidates.slice(0, limit);
  const results = [];

  for (let i = 0; i < toAnalyze.length; i += 5) {
    const batch = toAnalyze.slice(i, i + 5);
    const settled = await Promise.allSettled(
      batch.map(async sym => {
        const det = await fetchStockDetails(sym);
        const lynch = calculateLynchScore(det);
        return lynch && lynch.score >= 20 ? { symbol: sym, ...lynch } : null;
      })
    );
    settled.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 15);

  // 이전 스냅샷과 비교
  let comparison = null;
  if (kv) {
    const snapshots = await getAllSnapshots(kv);
    if (snapshots.length > 0) {
      const lastSnap = snapshots[snapshots.length - 1];
      const lastSymbols = new Set(lastSnap.stocks.map(s => s.symbol));
      const currentSymbols = new Set(top.map(s => s.symbol));
      
      comparison = {
        newEntries: top.filter(s => !lastSymbols.has(s.symbol)).map(s => s.symbol),
        dropped: lastSnap.stocks.filter(s => !currentSymbols.has(s.symbol)).map(s => s.symbol),
        maintained: top.filter(s => lastSymbols.has(s.symbol)).map(s => s.symbol),
        previousDate: lastSnap.timestamp,
      };
    }

    // 보유 종목의 매도 시그널 체크
    const portfolio = await getPortfolio(kv);
    const sellSignals = {};
    for (const holding of portfolio.holdings) {
      const stockData = results.find(r => r.symbol === holding.symbol);
      if (stockData) {
        // 과거 주간 스코어 추출
        const prevWeeks = snapshots
          .map(snap => snap.stocks.find(s => s.symbol === holding.symbol))
          .filter(Boolean)
          .reverse();
        const signals = checkSellSignals(stockData, prevWeeks);
        if (signals.length > 0) sellSignals[holding.symbol] = signals;
      }
    }
    comparison = { ...comparison, sellSignals };

    if (save) await saveSnapshot(kv, top);
  }

  return json({ stocks: top, analyzed: toAnalyze.length, totalCandidates: candidates.length, comparison, timestamp: new Date().toISOString() });
}

async function handleAnalyze(request, kv) {
  const sym = new URL(request.url).searchParams.get('symbol');
  if (!sym) return json({ error: 'symbol required' }, 400);
  const det = await fetchStockDetails(sym);
  const lynch = calculateLynchScore(det);

  // 히스토리 데이터
  let history = [];
  if (kv) {
    const snaps = await getAllSnapshots(kv);
    history = snaps.map(snap => {
      const s = snap.stocks.find(x => x.symbol === sym.toUpperCase());
      return s ? { date: snap.timestamp, score: s.score, price: s.price } : null;
    }).filter(Boolean);
  }

  return json({ symbol: sym.toUpperCase(), ...lynch, history });
}

async function handleSnapshots(request, kv) {
  if (!kv) return json({ error: 'KV not configured' }, 500);
  const snaps = await getAllSnapshots(kv);
  return json({ snapshots: snaps });
}

async function handlePortfolio(request, kv) {
  if (!kv) return json({ error: 'KV not configured' }, 500);
  
  if (request.method === 'GET') {
    const portfolio = await getPortfolio(kv);
    
    // 보유 종목의 현재 매도 시그널 체크
    const snaps = await getAllSnapshots(kv);
    const signalsMap = {};
    
    for (const h of portfolio.holdings) {
      try {
        const det = await fetchStockDetails(h.symbol);
        const lynch = calculateLynchScore(det);
        if (lynch) {
          h.currentScore = lynch.score;
          h.currentPrice = lynch.price;
          h.currentBreakdown = lynch.breakdown;
          
          const prevWeeks = snaps.map(s => s.stocks.find(x => x.symbol === h.symbol)).filter(Boolean).reverse();
          signalsMap[h.symbol] = checkSellSignals(lynch, prevWeeks);
        }
      } catch {}
    }
    
    portfolio.sellSignals = signalsMap;
    return json(portfolio);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const portfolio = await getPortfolio(kv);

    if (body.action === 'buy') {
      const { symbol, shares, price, date } = body;
      const existing = portfolio.holdings.find(h => h.symbol === symbol);
      if (existing) {
        const totalCost = (existing.avgPrice * existing.shares) + (price * shares);
        existing.shares += shares;
        existing.avgPrice = totalCost / existing.shares;
      } else {
        portfolio.holdings.push({ symbol, shares, avgPrice: price, buyDate: date || new Date().toISOString() });
      }
      portfolio.transactions.push({ type: 'buy', symbol, shares, price, date: date || new Date().toISOString() });
    }

    if (body.action === 'sell') {
      const { symbol, shares, price, date } = body;
      const existing = portfolio.holdings.find(h => h.symbol === symbol);
      if (existing) {
        existing.shares -= shares;
        if (existing.shares <= 0) {
          portfolio.holdings = portfolio.holdings.filter(h => h.symbol !== symbol);
        }
      }
      portfolio.transactions.push({ type: 'sell', symbol, shares, price, date: date || new Date().toISOString() });
    }

    await savePortfolio(kv, portfolio);
    return json({ ok: true, portfolio });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── Cron Handler (매주 자동 실행) ───

async function handleCron(kv) {
  let candidates;
  try { candidates = await fetchCandidates(''); } catch { candidates = getFallbackList(); }

  const toAnalyze = candidates.slice(0, 30);
  const results = [];

  for (let i = 0; i < toAnalyze.length; i += 5) {
    const batch = toAnalyze.slice(i, i + 5);
    const settled = await Promise.allSettled(
      batch.map(async sym => {
        const det = await fetchStockDetails(sym);
        const lynch = calculateLynchScore(det);
        return lynch && lynch.score >= 20 ? { symbol: sym, ...lynch } : null;
      })
    );
    settled.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
  }

  results.sort((a, b) => b.score - a.score);
  await saveSnapshot(kv, results.slice(0, 15));
  return results.length;
}

// ─── Main ───

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const path = new URL(request.url).pathname;
    const kv = env.LYNCH_DATA || null;

    try {
      let res;
      if (path === '/' || path === '/health') res = json({ status: 'ok' });
      else if (path === '/api/screener') res = await handleScreener(request, kv);
      else if (path === '/api/analyze') res = await handleAnalyze(request, kv);
      else if (path === '/api/snapshots') res = await handleSnapshots(request, kv);
      else if (path === '/api/portfolio') res = await handlePortfolio(request, kv);
      else res = json({ error: 'Not found' }, 404);

      const h = new Headers(res.headers);
      Object.entries(cors(request)).forEach(([k,v]) => h.set(k,v));
      h.set('Cache-Control', 'public, max-age=300');
      return new Response(res.body, { status: res.status, headers: h });
    } catch (err) {
      return json({ error: err.message }, 500, request);
    }
  },

  async scheduled(event, env) {
    const kv = env.LYNCH_DATA;
    if (!kv) return;
    const count = await handleCron(kv);
    console.log(`Cron: analyzed and saved ${count} stocks`);
  },
};

function json(data, status = 200, request = null) {
  const h = { 'Content-Type': 'application/json' };
  if (request) Object.assign(h, cors(request));
  return new Response(JSON.stringify(data), { status, headers: h });
}

function cors(req) {
  const o = req?.headers?.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(o) ? o : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}