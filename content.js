(() => {
  'use strict';

  const PRICE_SELECTORS = [
    '[class*="price"]:not([class*="price-label"]):not([class*="price-title"])',
    '[class*="Price"]:not([class*="PriceLabel"]):not([class*="PriceTitle"])',
    '[class*="amount"]:not([class*="amount-label"])',
    '[class*="Amount"]:not([class*="AmountLabel"])',
    '[data-price]', '[itemprop="price"]',
    '.price', '.special-price', '.regular-price',
    '.pricebox', '.goodsPrice',
    '._3_ISdg', '.shopee-price',
    '[class*="prod-price"]',
    '.sale-price', '.item-price', '.price-info',
    // Apple
    '[data-autom*="price"]', '[data-autom*="Price"]',
    '[class*="rc-price"]', '[class*="purchaseprice"]',
    '[class*="current-price"]', '[class*="currentprice"]',
  ].join(',');

  // For text-node scanning: require explicit currency prefix to avoid false positives
  const TEXTNODE_PRICE_RE = /^(?:NT\$?|NTD|HK\$?|\$|USD|EUR|JPY¥?|¥)\s*[\d,]{2,}(?:\.\d{1,2})?$/i;

  const PROCESSED_ATTR = 'data-etf-done';
  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT']);
  const PRICE_TEXT_RE = /^(?:NT\$?|NTD|\$|USD)?\s*([\d,]{1,10}(?:\.\d{1,2})?)\s*(?:元|円|TWD)?$/i;
  const ORIGINAL_PRICE_RE = /origin|original|old[\-_]?price|list[\-_]?price|market[\-_]?price|was[\-_]?price|strike|del[\-_]?price|定價|原價/i;
  const TOOLTIP_W = 260;
  const TOOLTIP_GAP = 8;
  const DEFAULT_TICKER = '0050.TW';

  let etfData = null;
  let loadingData = false;
  let currentTicker = DEFAULT_TICKER;

  // --- Global tooltip (mounted on body, position:fixed) ---
  const globalTip = document.createElement('div');
  globalTip.id = 'etf-global-tooltip';
  document.body.appendChild(globalTip);
  let hideTimer = null;

  function showTooltip(badge, price, data) {
    clearTimeout(hideTimer);
    const { displayName, ticker, currency, currentPrice, annualReturn, updatedAt, isFallback, exchangeRate } = data;
    const isUSD = currency === 'USD';
    const effectivePrice = isUSD ? currentPrice * (exchangeRate || 32.5) : currentPrice;

    const fmt = n => 'NT$ ' + Math.round(n).toLocaleString();
    const shares = price / effectivePrice;
    const r3m = price * (Math.pow(1 + annualReturn, 3 / 12) - 1);
    const r1y = price * annualReturn;
    const pct = (annualReturn * 100).toFixed(1);
    const s = n => n >= 0 ? '+' : '';
    const cls = n => n >= 0 ? 'pos' : 'neg';
    const updatedStr = updatedAt
      ? new Date(updatedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
    const code = ticker.replace('.TW', '');
    const priceStr = isUSD
      ? `$${currentPrice.toFixed(2)} (約 NT$${effectivePrice.toFixed(1)})`
      : `NT$${currentPrice.toFixed(1)}`;

    globalTip.innerHTML = `
      <div class="etf-tip-header">
        <div class="etf-tip-name">
          <span class="etf-tip-zhname">${displayName || code}</span>
          <span class="etf-tip-code">${code}</span>
        </div>
        <span class="etf-tip-price">${priceStr}</span>
      </div>
      <div class="etf-tip-body">
        <div class="etf-tip-row">
          <span class="etf-tip-label">近1年年化報酬</span>
          <span class="etf-tip-value ${cls(annualReturn)}">${s(annualReturn)}${pct}%</span>
        </div>
        <div class="etf-tip-row">
          <span class="etf-tip-label">等值股數</span>
          <span class="etf-tip-value">${shares.toFixed(3)} 股</span>
        </div>
        <div class="etf-tip-divider"></div>
        <div class="etf-tip-row future">
          <span class="etf-tip-label">3 個月後約</span>
          <span class="etf-tip-value">${fmt(price + r3m)}<small class="${cls(r3m)}">${s(r3m)}${fmt(r3m)}</small></span>
        </div>
        <div class="etf-tip-row future">
          <span class="etf-tip-label">1 年後約</span>
          <span class="etf-tip-value">${fmt(price + r1y)}<small class="${cls(r1y)}">${s(r1y)}${fmt(r1y)}</small></span>
        </div>
      </div>
      <div class="etf-tip-footer">
        ${isUSD && exchangeRate ? `匯率：${exchangeRate.toFixed(2)} | ` : ''}
        ${isFallback ? '⚠️ 使用預設數值' : `更新：${updatedStr}`}
      </div>
    `;

    globalTip.style.visibility = 'hidden';
    globalTip.style.display = 'block';
    const rect = badge.getBoundingClientRect();
    const tipH = globalTip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    if (left + TOOLTIP_W > vw - 8) left = vw - TOOLTIP_W - 8;
    if (left < 8) left = 8;
    const top = rect.bottom + TOOLTIP_GAP + tipH <= vh - 8
      ? rect.bottom + TOOLTIP_GAP
      : Math.max(8, rect.top - TOOLTIP_GAP - tipH);
    globalTip.style.left = left + 'px';
    globalTip.style.top = top + 'px';
    globalTip.style.visibility = 'visible';
  }

  function hideTooltip(delay = 120) {
    hideTimer = setTimeout(() => { globalTip.style.display = 'none'; }, delay);
  }

  globalTip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  globalTip.addEventListener('mouseleave', () => hideTooltip());

  // --- Price helpers ---
  function parsePrice(text) {
    const m = PRICE_TEXT_RE.exec(text.trim().replace(/\s+/g, ''));
    if (!m) return null;
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(val) || val < 50 || val > 5_000_000) return null;
    return val;
  }

  // --- Data loading ---
  async function ensureData() {
    if (etfData) return etfData;
    if (loadingData) return null;
    loadingData = true;
    try {
      etfData = await chrome.runtime.sendMessage({ type: 'GET_STOCK_DATA', ticker: currentTicker });
    } catch (_) { etfData = null; }
    loadingData = false;
    return etfData;
  }

  // --- DOM eligibility ---
  function isStrikethrough(el) {
    const check = n => { const td = getComputedStyle(n).textDecorationLine; return td === 'line-through' || td.includes('line-through'); };
    if (check(el)) return true;
    if (el.querySelector('del, s')) return true;
    let cur = el.parentElement;
    for (let i = 0; i < 3 && cur; i++, cur = cur.parentElement) {
      if (cur.tagName === 'DEL' || cur.tagName === 'S') return true;
      if (check(cur) && cur.children.length <= 2) return true;
    }
    return false;
  }

  function isEligible(el) {
    if (IGNORED_TAGS.has(el.tagName)) return false;
    if (el.hasAttribute(PROCESSED_ATTR)) return false;
    if (el.querySelector('[' + PROCESSED_ATTR + ']')) return false;
    if (isStrikethrough(el)) return false;
    if (ORIGINAL_PRICE_RE.test((el.className || '') + ' ' + (el.id || ''))) return false;
    return true;
  }

  function filterDeepestOnly(elements) {
    return elements.filter(el => !elements.some(other => other !== el && el.contains(other)));
  }

  // --- Badge ---
  function markAncestors(el) {
    let cur = el.parentElement;
    for (let i = 0; i < 6 && cur && cur !== document.body; i++, cur = cur.parentElement) {
      if (cur.hasAttribute(PROCESSED_ATTR)) break;
      cur.setAttribute(PROCESSED_ATTR, 'ancestor');
    }
  }

  function injectBadge(el, price, data) {
    if (el.hasAttribute(PROCESSED_ATTR)) return;
    el.setAttribute(PROCESSED_ATTR, '1');
    markAncestors(el);

    const { currency, currentPrice, exchangeRate } = data;
    const effectivePrice = currency === 'USD' ? currentPrice * (exchangeRate || 32.5) : currentPrice;

    const badge = document.createElement('span');
    badge.className = 'etf-badge';
    badge.textContent = `≈${(price / effectivePrice).toFixed(2)}股`;
    badge.addEventListener('mouseenter', () => showTooltip(badge, price, data));
    badge.addEventListener('mouseleave', () => hideTooltip());

    const wrap = document.createElement('span');
    wrap.className = 'etf-wrap';
    wrap.appendChild(badge);
    el.appendChild(wrap);
  }

  // --- Scan ---
  async function scanDOM() {
    const data = await ensureData();
    if (!data) return;

    const raw = Array.from(document.querySelectorAll(PRICE_SELECTORS)).filter(el => {
      if (!isEligible(el)) return false;
      return parsePrice(el.textContent) !== null;
    });

    filterDeepestOnly(raw).forEach(el => {
      const price = parsePrice(el.textContent);
      if (price) injectBadge(el, price, data);
    });

    if (pendingElements.length) {
      const pending = filterDeepestOnly(
        pendingElements.splice(0).filter(el => isEligible(el) && parsePrice(el.textContent) !== null)
      );
      pending.forEach(el => { const p = parsePrice(el.textContent); if (p) injectBadge(el, p, data); });
    }

    // Secondary pass: catch prices on sites that don't use standard price class names
    scanTextNodes(data);
  }

  let pendingElements = [];

  // --- TextNode fallback: catch price text not covered by CSS selectors ---
  // Wraps the matching text node's parent <span>/<div>/etc. as the badge anchor.
  function scanTextNodes(data) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (IGNORED_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          // Skip anything inside our own UI or already-processed elements
          if (p.closest('#etf-global-tooltip, .etf-wrap')) return NodeFilter.FILTER_REJECT;
          if (p.hasAttribute(PROCESSED_ATTR)) return NodeFilter.FILTER_REJECT;
          const text = node.textContent.trim();
          return TEXTNODE_PRICE_RE.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    const hits = [];
    let node;
    while ((node = walker.nextNode())) hits.push(node);

    hits.forEach(textNode => {
      const parent = textNode.parentElement;
      if (!parent || parent.hasAttribute(PROCESSED_ATTR)) return;
      // Only proceed if the parent is a "leaf-level" price container:
      // it should not have many child elements (avoid injecting into large containers)
      const childElCount = parent.children.length;
      if (childElCount > 3) return;

      const price = parsePrice(textNode.textContent);
      if (!price) return;
      injectBadge(parent, price, data);
    });
  }

  // --- Refresh all badges when ticker changes ---
  function resetAndRescan() {
    globalTip.style.display = 'none';
    document.querySelectorAll('[' + PROCESSED_ATTR + ']').forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
      el.querySelector('.etf-wrap')?.remove();
    });
    etfData = null;
    scanDOM();
  }

  // --- Enabled/disabled state ---
  function applyEnabled(enabled) {
    document.body.classList.toggle('etf-disabled', !enabled);
  }

  // --- Init: read saved ticker + enabled state ---
  chrome.storage.sync.get(['selected_ticker', 'extension_enabled'], r => {
    currentTicker = r.selected_ticker || DEFAULT_TICKER;
    const enabled = r.extension_enabled !== false; // default true
    applyEnabled(enabled);
    if (enabled) scanDOM();
  });

  // Listen for changes from popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.selected_ticker) {
      currentTicker = changes.selected_ticker.newValue || DEFAULT_TICKER;
      resetAndRescan();
    }
    if (changes.extension_enabled) {
      const enabled = changes.extension_enabled.newValue !== false;
      applyEnabled(enabled);
      if (enabled) scanDOM(); // inject badges if turning on
    }
  });

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  const observer = new MutationObserver(mutations => {
    const hasNew = mutations.some(m =>
      [...m.addedNodes].some(n => n.nodeType === 1 && !n.closest('#etf-global-tooltip'))
    );
    if (hasNew) debounce(scanDOM, 400)();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
