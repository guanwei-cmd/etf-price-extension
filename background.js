const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_TICKER = '0050.TW';

// Chinese name lookup for common TW stocks/ETFs
const ZH_NAMES = {
  '0050.TW': '元大台灣50',
  '0051.TW': '元大中型100',
  '0052.TW': '富邦科技',
  '0053.TW': '元大電子',
  '0054.TW': '元大台商50',
  '0055.TW': '元大MSCI金融',
  '0056.TW': '元大高股息',
  '0057.TW': '富邦摩台',
  '0058.TW': '富邦發達',
  '0059.TW': '富邦金融',
  '006201.TW': '元大富櫃50',
  '006203.TW': '元大MSCI台灣',
  '006204.TW': '永豐臺灣加權',
  '006208.TW': '富邦台50',
  '00631L.TW': '元大台灣50正2',
  '00632R.TW': '元大台灣50反1',
  '00636.TW': '國泰臺灣加權',
  '00637L.TW': '元大滬深300正2',
  '00643.TW': '群益深証中小',
  '00655L.TW': '國泰臺灣加權正2',
  '00656.TW': '國泰臺灣加權反1',
  '00657.TW': '國泰臺灣科技指數',
  '00662.TW': '富邦NASDAQ',
  '00663L.TW': '國泰臺灣加權正2',
  '00664R.TW': '國泰臺灣加權反1',
  '00680L.TW': '富邦NASDAQ正2',
  '00681R.TW': '富邦NASDAQ反1',
  '00692.TW': '富邦公司治理',
  '00701.TW': '國泰臺灣ESG永續',
  '00713.TW': '元大台灣高息低波',
  '00720B.TW': '元大投資等級公司債',
  '00728.TW': '第一金工業30',
  '00730.TW': '富邦臺灣優質高息',
  '00731.TW': 'FT臺灣Smart',
  '00733.TW': '富邦臺灣中小',
  '00737.TW': '國泰AI+Robo',
  '00739.TW': '元大MSCI金融',
  '00748.TW': '第一金小型精選',
  '00757.TW': '統一FANG+',
  '00762.TW': '元大全球AI',
  '00770.TW': '國泰北美科技',
  '00773B.TW': '中信優先金融債',
  '00781.TW': '新光內需收益',
  '00783.TW': '富邦臺灣半導體',
  '00850.TW': '元大臺灣ESG永續',
  '00851.TW': '台新臺灣ESG優選',
  '00858.TW': '野村臺灣ESG',
  '00861.TW': '元大全球AI',
  '00875.TW': '國泰智能電動車',
  '00878.TW': '國泰永續高股息',
  '00881.TW': '國泰台灣5G+',
  '00882.TW': '中信中國高股息',
  '00891.TW': '中信關鍵半導體',
  '00892.TW': '富邦台灣半導體',
  '00893.TW': '國泰智能電動車',
  '00894.TW': '中信小台灣ESG',
  '00895.TW': '富邦未來車',
  '00896.TW': '中信綠能及電動車',
  '00898.TW': '國泰基因免疫',
  '00900.TW': '富邦特選高股息30',
  '00905.TW': 'FT臺灣Smart高股息',
  '00907.TW': '永豐優息存股',
  '00908.TW': '富邦入息REITs',
  '00909.TW': '國泰數位支付',
  '00912.TW': '中信臺灣智慧50',
  '00913.TW': '兆豐台灣晶圓製造',
  '00914.TW': '中信成長高股息',
  '00915.TW': '凱基優選高股息30',
  '00916.TW': '國泰全球品牌50',
  '00918.TW': '大華優利高填息30',
  '00919.TW': '群益台灣精選高息',
  '00921.TW': '兆豐龍頭等權重',
  '00922.TW': '國泰A級以上金融債',
  '00923.TW': '群益台ESG低碳55',
  '00929.TW': '復華台灣科技優息',
  '00930.TW': '永豐ESG低碳高息',
  '00932.TW': '兆豐永續高息等權',
  '00933B.TW': '國泰10Y+金融債',
  '00934.TW': '中信成長高股息',
  '00935.TW': '野村臺灣新科技50',
  '00936.TW': '台新臺灣IC設計',
  '00937B.TW': '群益ESG投等債20+',
  '00938.TW': '永豐台灣ESG',
  '00939.TW': '統一台灣高息動能',
  '00940.TW': '元大台灣價值高息',
  '00941.TW': '台新臺灣高息動能',
  '00942B.TW': '台新美國短期公債',
  '00943.TW': '兆豐台灣晶圓鏈',
  '00944.TW': '元大台灣重電及5G',
  '00945B.TW': '兆豐北美ESG',
  '2330.TW': '台積電',
  '2317.TW': '鴻海',
  '2454.TW': '聯發科',
  '2308.TW': '台達電',
  '2382.TW': '廣達',
  '2357.TW': '華碩',
  '2303.TW': '聯電',
  '3711.TW': '日月光投控',
  '2412.TW': '中華電信',
  '2881.TW': '富邦金',
  '2882.TW': '國泰金',
  '2886.TW': '兆豐金',
  '2891.TW': '中信金',
  '2892.TW': '第一金',
};

// Best display name: ZH lookup > longName (if has CJK) > title-cased shortName
function resolveName(ticker, shortName, longName) {
  if (ZH_NAMES[ticker]) return ZH_NAMES[ticker];
  // Use longName if it contains CJK characters
  if (longName && /[一-鿿]/.test(longName)) return longName;
  // Title-case the English name (e.g. "CATHAY SECS INV TRUST" → "Cathay Secs Inv Trust")
  const base = (longName || shortName || ticker);
  return base.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bEtf\b/g, 'ETF');
}

// Normalize user input to a Yahoo Finance symbol
function normalizeTicker(input) {
  const t = input.trim().toUpperCase();
  if (!t) return DEFAULT_TICKER;
  // Already has exchange suffix (e.g. 0050.TW, 9984.T)
  if (t.includes('.')) return t;
  // Pure digits or starts with digit → Taiwan stock
  if (/^\d/.test(t)) return t + '.TW';
  return t; // US/other (SPY, QQQ, AAPL …)
}

async function fetchStockData(rawTicker, forceRefresh = false) {
  const ticker = normalizeTicker(rawTicker);
  const cacheKey = `stock_data_${ticker}`;

  if (!forceRefresh) {
    const stored = await chrome.storage.local.get(cacheKey);
    const cached = stored[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached;
  }

  let staleCache = null;
  try {
    const stored = await chrome.storage.local.get(cacheKey);
    staleCache = stored[cacheKey] || null;
  } catch (_) {}

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();

    const result = json.chart.result?.[0];
    if (!result) throw new Error('No data returned');

    const closes = result.indicators.quote[0].close.filter(v => v != null);
    if (closes.length < 2) throw new Error('Not enough data points');

    const currentPrice = closes[closes.length - 1];
    const yearAgoPrice = closes[0];
    const annualReturn = (currentPrice / yearAgoPrice) - 1;
    const meta = result.meta || {};
    const currency = meta.currency || (ticker.endsWith('.TW') ? 'TWD' : 'USD');
    const displayName = resolveName(ticker, meta.shortName, meta.longName);

    const data = { ticker, displayName, currency, currentPrice, annualReturn, updatedAt: Date.now(), timestamp: Date.now() };
    await chrome.storage.local.set({ [cacheKey]: data });
    return data;
  } catch (e) {
    if (staleCache) return staleCache;
    // Hardcoded fallback only for default ticker
    if (ticker === DEFAULT_TICKER) {
      return { ticker, displayName: '元大台灣50', currency: 'TWD', currentPrice: 165, annualReturn: 0.15, updatedAt: 0, timestamp: Date.now(), isFallback: true };
    }
    throw e;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STOCK_DATA') {
    fetchStockData(msg.ticker || DEFAULT_TICKER, false)
      .then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === 'FORCE_REFRESH') {
    fetchStockData(msg.ticker || DEFAULT_TICKER, true)
      .then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === 'NORMALIZE_TICKER') {
    sendResponse({ normalized: normalizeTicker(msg.ticker) });
  }
});
