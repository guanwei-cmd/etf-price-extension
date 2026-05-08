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
    '.prdPrice', '.prd-price', '.productPrice',
    '._3_ISdg', '.shopee-price',
    '[class*="prod-price"]',
    '[class*="prdPrice"]', '[class*="goodsPrice"]',
    '[class*="salePrice"]', '[class*="SalePrice"]',
    '.sale-price', '.item-price', '.price-info',
    // Apple
    '[data-autom*="price"]', '[data-autom*="Price"]',
    '[class*="rc-price"]', '[class*="purchaseprice"]',
    '[class*="current-price"]', '[class*="currentprice"]',
  ].join(',');

  // For text-node scanning: require explicit currency prefix except on known TW shopping sites.
  const TEXTNODE_PRICE_RE = /^(?:NT\$?|NTD|HK\$?|US\$|\$|USD|EUR|JPY¥?|¥)\s*[\d,]{2,}(?:\.\d{1,2})?$|^[\d,]{2,}(?:\.\d{1,2})?\s*(?:元)$/i;
  const TW_SHOP_HOST_RE = /(^|\.)((momo|momoshop|pchome|ruten|books|rakuten|yahoo|etmall|friday|costco|watsons|cosmed)\.com\.tw|shopee\.tw)$/i;

  const PROCESSED_ATTR = 'data-etf-done';
  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT']);
  const PRICE_TEXT_RE = /^(NT\$?|NTD|TWD|US\$|USD|\$)?\s*([\d,]{1,10}(?:\.\d{1,2})?)\s*(元|円|TWD|USD)?$/i;
  const PRICE_LABEL_RE = /^(特價標|特價|優惠價|促銷價|售價|網路價|會員價|折扣價)[:：]?/;
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

  function showTooltip(badge, priceInfo, data) {
    clearTimeout(hideTimer);
    const { displayName, ticker, currency, currentPrice, annualReturn, updatedAt, isFallback } = data;
    const priceCurrency = priceInfo.currency || inferPageCurrency(priceInfo.rawText);
    const quotePrice = convertQuotePrice(data, priceCurrency);
    const fmt = n => formatMoney(n, priceCurrency);
    const shares = quotePrice ? priceInfo.amount / quotePrice : 0;
    const r3m = priceInfo.amount * (Math.pow(1 + annualReturn, 3 / 12) - 1);
    const r1y = priceInfo.amount * annualReturn;
    const pct = (annualReturn * 100).toFixed(1);
    const s = n => n >= 0 ? '+' : '';
    const cls = n => n >= 0 ? 'pos' : 'neg';
    const updatedStr = updatedAt
      ? new Date(updatedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
    const code = ticker.replace('.TW', '');
    const priceStr = quotePrice
      ? `${formatMoney(quotePrice, priceCurrency)} / 股`
      : `${formatMoney(currentPrice, currency)} / 股`;
    const fxNote = currency !== priceCurrency && data.fxToTWD
      ? `，已用 USD/TWD ${data.fxToTWD.toFixed(2)} 換算`
      : '';

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
          <span class="etf-tip-value">${fmt(priceInfo.amount + r3m)}<small class="${cls(r3m)}">${s(r3m)}${fmt(r3m)}</small></span>
        </div>
        <div class="etf-tip-row future">
          <span class="etf-tip-label">1 年後約</span>
          <span class="etf-tip-value">${fmt(priceInfo.amount + r1y)}<small class="${cls(r1y)}">${s(r1y)}${fmt(r1y)}</small></span>
        </div>
      </div>
      <div class="etf-tip-footer">${isFallback ? '⚠️ 使用預設數值' : `更新：${updatedStr}${fxNote}`}</div>
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
  function inferPageCurrency(text = '') {
    const normalized = text.toUpperCase();
    if (/US\$|USD/.test(normalized)) return 'USD';
    if (/NT\$?|NTD|TWD|元/.test(normalized)) return 'TWD';
    if (TW_SHOP_HOST_RE.test(location.hostname)) return 'TWD';
    return normalized.includes('$') ? 'USD' : 'TWD';
  }

  function normalizeCurrency(prefix, suffix, rawText) {
    const token = `${prefix || ''} ${suffix || ''}`.toUpperCase();
    if (/US\$|USD/.test(token)) return 'USD';
    if (/NT\$?|NTD|TWD|元/.test(token)) return 'TWD';
    return inferPageCurrency(rawText);
  }

  function parsePrice(text) {
    const rawText = text.trim();
    const normalizedText = rawText.replace(/\s+/g, '').replace(PRICE_LABEL_RE, '');
    const m = PRICE_TEXT_RE.exec(normalizedText);
    if (!m) return null;
    const val = parseFloat(m[2].replace(/,/g, ''));
    if (isNaN(val) || val < 50 || val > 5_000_000) return null;
    return { amount: val, currency: normalizeCurrency(m[1], m[3], rawText), rawText };
  }

  function isTextNodePrice(text) {
    if (TEXTNODE_PRICE_RE.test(text)) return true;
    if (!TW_SHOP_HOST_RE.test(location.hostname)) return false;
    const normalizedText = text.replace(/\s+/g, '').replace(PRICE_LABEL_RE, '');
    return /^\$?[\d,]{2,}(?:\.\d{1,2})?(?:元)?$/.test(normalizedText);
  }

  function fxToTWD(currency, data) {
    const normalized = (currency || 'TWD').toUpperCase();
    if (normalized === 'TWD') return 1;
    if (normalized === 'USD') return data.fxToTWD || null;
    return null;
  }

  function convertAmount(amount, fromCurrency, toCurrency, data) {
    const from = (fromCurrency || 'TWD').toUpperCase();
    const to = (toCurrency || 'TWD').toUpperCase();
    if (from === to) return amount;
    const fromRate = fxToTWD(from, data);
    const toRate = fxToTWD(to, data);
    if (!fromRate || !toRate) return null;
    return amount * fromRate / toRate;
  }

  function convertQuotePrice(data, targetCurrency) {
    return convertAmount(data.currentPrice, data.currency, targetCurrency, data);
  }

  function formatMoney(n, currency) {
    const symbol = currency === 'TWD' ? 'NT$ ' : '$ ';
    return symbol + Math.round(n).toLocaleString();
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
    if (el.closest('#etf-global-tooltip, .etf-wrap')) return false;
    if (isStrikethrough(el)) return false;
    if (ORIGINAL_PRICE_RE.test((el.className || '') + ' ' + (el.id || ''))) return false;
    return true;
  }

  function filterDeepestOnly(elements) {
    return elements.filter(el => !elements.some(other => other !== el && el.contains(other)));
  }

  // --- Badge ---
  function injectBadge(el, priceInfo, data) {
    if (el.hasAttribute(PROCESSED_ATTR)) return;
    const quotePrice = convertQuotePrice(data, priceInfo.currency);
    if (!quotePrice) return;
    el.setAttribute(PROCESSED_ATTR, '1');

    const badge = document.createElement('span');
    badge.className = 'etf-badge';
    badge.textContent = `≈${(priceInfo.amount / quotePrice).toFixed(2)}股`;
    badge.addEventListener('mouseenter', () => showTooltip(badge, priceInfo, data));
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
          return isTextNodePrice(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
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
