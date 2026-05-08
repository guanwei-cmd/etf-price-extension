const DEFAULT_TICKER = '0050.TW';

const mainEl      = document.getElementById('main');
const refreshBtn  = document.getElementById('refreshBtn');
const presetsEl   = document.getElementById('presets');
const customInput = document.getElementById('customInput');
const applyBtn    = document.getElementById('applyBtn');
const tickerHint  = document.getElementById('tickerHint');
const headerTitle = document.getElementById('headerTitle');
const enableToggle = document.getElementById('enableToggle');
const toggleSub    = document.getElementById('toggleSub');

let currentTicker = DEFAULT_TICKER;

// --- Ticker normalization (mirrors background.js) ---
function normalizeTicker(input) {
  const t = input.trim().toUpperCase();
  if (!t) return DEFAULT_TICKER;
  if (t.includes('.')) return t;
  if (/^\d/.test(t)) return t + '.TW';
  return t;
}

function displayTicker(ticker) {
  return ticker.replace('.TW', '');
}

// --- Preset buttons ---
function updatePresetUI(ticker) {
  presetsEl.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ticker === ticker);
  });
  // If it's a custom ticker not in presets, clear all active states
}

presetsEl.addEventListener('click', e => {
  const btn = e.target.closest('.preset-btn');
  if (!btn) return;
  selectTicker(btn.dataset.ticker);
  customInput.value = '';
  tickerHint.textContent = '輸入台股代號自動加上 .TW，美股直接輸入英文代號';
  tickerHint.className = 'ticker-hint';
});

// --- Custom input ---
customInput.addEventListener('input', () => {
  const val = customInput.value.trim();
  if (!val) {
    tickerHint.textContent = '輸入台股代號自動加上 .TW，美股直接輸入英文代號';
    tickerHint.className = 'ticker-hint';
    return;
  }
  const normalized = normalizeTicker(val);
  tickerHint.textContent = `將使用代號：${normalized}`;
  tickerHint.className = 'ticker-hint';
});

customInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') applyBtn.click();
});

applyBtn.addEventListener('click', () => {
  const val = customInput.value.trim();
  if (!val) return;
  const normalized = normalizeTicker(val);
  selectTicker(normalized);
});

// --- Core: select ticker, save, reload ---
async function selectTicker(ticker) {
  currentTicker = ticker;
  updatePresetUI(ticker);
  headerTitle.textContent = `📈 ${displayTicker(ticker)} 價值換算`;
  await chrome.storage.sync.set({ selected_ticker: ticker });
  loadData(false);
}

// --- Render data ---
function renderData(data) {
  if (!data || data.error) {
    mainEl.innerHTML = `<div class="section" style="color:#c00;font-size:13px;padding:14px 16px;">
      ⚠️ 無法取得「${displayTicker(currentTicker)}」的資料<br>
      <span style="color:#999;font-size:11px;margin-top:4px;display:block;">${data?.error || '請確認代號是否正確，或稍後再試'}</span>
    </div>`;
    return;
  }

  const { displayName, currency, currentPrice, annualReturn, updatedAt, isFallback, exchangeRate } = data;
  const isUSD = currency === 'USD';
  const effectivePrice = isUSD ? currentPrice * (exchangeRate || 32.5) : currentPrice;

  const fmt = n => 'NT$' + Math.round(n).toLocaleString();
  const pct = (annualReturn * 100).toFixed(1);
  const sign = annualReturn >= 0 ? '+' : '';
  const cls  = annualReturn >= 0 ? 'pos' : 'neg';
  const updatedStr = updatedAt
    ? new Date(updatedAt).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const priceLabel = isUSD
    ? `$ ${currentPrice.toFixed(2)} <small style="display:block;color:#999;font-weight:400;margin-top:2px;">(約 NT$ ${effectivePrice.toFixed(1)})</small>`
    : `NT$ ${currentPrice.toFixed(2)}`;

  // Example: 1000 TWD
  const example = 1000;
  const exampleLabel = 'NT$1,000';
  const shares = (example / effectivePrice).toFixed(3);
  const val3m  = example * Math.pow(1 + annualReturn, 3 / 12);
  const val1y  = example * (1 + annualReturn);

  mainEl.innerHTML = `
    <div class="section">
      <div class="row" style="align-items: flex-start;">
        <span class="label">${displayName || displayTicker(currentTicker)}<small style="color:#bbb;font-size:11px;margin-left:5px;font-weight:400">${displayTicker(currentTicker)}</small></span>
        <span class="value" style="text-align: right;">${priceLabel}</span>
      </div>
      ${isUSD && exchangeRate ? `
      <div class="row">
        <span class="label muted">USD/TWD 匯率</span>
        <span class="muted">${exchangeRate.toFixed(2)}</span>
      </div>` : ''}
      <div class="row">
        <span class="label">近 1 年年化報酬</span>
        <span class="value ${cls}">${sign}${pct}%</span>
      </div>
      <div class="row">
        <span class="label muted">資料更新</span>
        <span class="muted">${updatedStr}</span>
      </div>
      ${isFallback ? '<div class="fallback-warn">⚠️ 無法連線 Yahoo Finance，顯示預設數值</div>' : ''}
    </div>
    <div class="section">
      <div class="section-title">試算：花 ${exampleLabel} 改買 ${displayTicker(currentTicker)}</div>
      <div class="row">
        <span class="label">可買股數</span>
        <span class="value">${shares} 股</span>
      </div>
      <div class="row">
        <span class="label">3 個月後約</span>
        <span class="value ${cls}">${fmt(val3m)}</span>
      </div>
      <div class="row">
        <span class="label">1 年後約</span>
        <span class="value ${cls}">${fmt(val1y)}</span>
      </div>
    </div>
  `;
}

async function loadData(forceRefresh = false) {
  mainEl.innerHTML = '<div class="loading">資料載入中…</div>';
  refreshBtn.disabled = true;
  applyBtn.disabled = true;
  try {
    const type = forceRefresh ? 'FORCE_REFRESH' : 'GET_STOCK_DATA';
    const data = await chrome.runtime.sendMessage({ type, ticker: currentTicker });
    renderData(data);
  } catch (e) {
    mainEl.innerHTML = `<div class="section" style="color:#c00;font-size:13px;padding:14px 16px;">連線失敗：${e.message}</div>`;
  }
  refreshBtn.disabled = false;
  applyBtn.disabled = false;
}

refreshBtn.addEventListener('click', () => loadData(true));

// --- Toggle: enable / disable badges ---
function applyToggleUI(enabled) {
  enableToggle.checked = enabled;
  toggleSub.textContent = enabled ? '已開啟，標籤顯示中' : '已關閉，所有標籤已隱藏';
  document.body.classList.toggle('etf-off', !enabled);
}

enableToggle.addEventListener('change', () => {
  const enabled = enableToggle.checked;
  applyToggleUI(enabled);
  chrome.storage.sync.set({ extension_enabled: enabled });
});

// --- Init: read saved ticker + enabled state ---
chrome.storage.sync.get(['selected_ticker', 'extension_enabled'], r => {
  currentTicker = r.selected_ticker || DEFAULT_TICKER;
  updatePresetUI(currentTicker);
  headerTitle.textContent = `📈 ${displayTicker(currentTicker)} 價值換算`;

  const enabled = r.extension_enabled !== false; // default true
  applyToggleUI(enabled);

  loadData(false);
});
