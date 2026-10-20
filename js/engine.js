// =============================================================================
// js/engine.js
// Template Engine — reads ?id=<slug>, fetches invitation from Supabase,
// dynamically loads template HTML + CSS, and binds data attributes.
// 100% Zero-Downtime Architecture — never shows error screen to guests.
// Digital Wedding Invitation Platform
// =============================================================================

import { fetchInvitationBySlug } from './supabase-config.js';
import { saveToCalendar, getGoogleCalendarUrl, scheduleWeddingReminder } from './calendar.js';

// ─── Default Invitation (In-Memory Fallback) ──────────────────────────────────
// Shown when: no ?id= in URL, Supabase offline, or slug not found anywhere.
// Matches the default data in templates/floral-pink/layout.html.

const DEFAULT_INVITATION = {
  slug        : 'default',
  template_id : 'floral-pink',
  is_active   : true,
  _isFallbackDefault: true,
  customer_data: {
    groom_name      : 'ဟိန်းသူအောင်',
    bride_name      : 'ပန်းအိဖြူ',
    groom_name_en   : '',
    bride_name_en   : '',
    wedding_date    : '2026-09-13',
    wedding_day     : 'တနင်္ဂနွေနေ့',
    wedding_time    : 'နံနက် ၉:၃၀ နာရီ မှ နေ့လယ် ၁၂:၃၀ နာရီ ထိ',
    venue_name      : 'ဟုတ်ဝမ်မင်္ဂလာခန်းမ',
    venue_address   : 'ကန်လမ်း၊ တောင်ငူမြို့။',
    map_url         : '',
    rsvp_phone      : '',
    cover_photo_url : 'assets/images/wedding-memory-default.jpg',
    couple_photo_url: 'assets/images/couple-portrait-default.jpg',
    message         : '',
  },
};

// ─── Static Fallback JSON cache (loaded once) ─────────────────────────────────
let _fallbackJSON = null;

async function loadFallbackJSON() {
  if (_fallbackJSON) return _fallbackJSON;
  try {
    const res = await fetch('data/fallback-invitations.json?v=6', { cache: 'no-store' });
    if (res.ok) {
      _fallbackJSON = await res.json();
    }
  } catch (_) {
    // If even the JSON can't be fetched, _fallbackJSON stays null
  }
  return _fallbackJSON;
}

// ─── Multi-Tier Invitation Resolver ──────────────────────────────────────────
/**
 * Resolves invitation data using a 5-tier fallback chain.
 * NEVER throws — always returns an invitation object.
 *
 * Tier 0 — Direct entry (no slug): return fallback default immediately
 * Tier 1 — Supabase live fetch (5s timeout)
 * Tier 2 — localStorage cache
 * Tier 3 — Static fallback-invitations.json
 * Tier 4 — In-memory DEFAULT_INVITATION
 *
 * @param {string|null} slug
 * @returns {Promise<Object>}
 */
async function resolveInvitationData(slug, onLiveUpdate = null) {
  // Tier 0: No slug → show default immediately, no network call
  if (!slug) {
    console.info('[engine.js] No slug in URL — loading default invitation.');
    const fb = await loadFallbackJSON();
    if (fb?.default) return fb.default;
    return DEFAULT_INVITATION;
  }

  const cleanSlug = String(slug).trim().toLowerCase();
  const cacheKey  = `wedding_inv_cache_${cleanSlug}`;

  // STALE-WHILE-REVALIDATE: Check local cache first for INSTANT 0ms load!
  let cachedData = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cachedData = JSON.parse(raw);
  } catch (_) {}

  // If cached data is available, return immediately for instant guest presentation!
  if (cachedData) {
    console.info('[engine.js] Instant Load: serving cached invitation data for slug:', cleanSlug);

    // Asynchronously revalidate in background if online
    if (navigator.onLine && typeof onLiveUpdate === 'function') {
      fetchInvitationBySlug(cleanSlug, 4000)
        .then(remoteData => {
          if (remoteData) {
            try { localStorage.setItem(cacheKey, JSON.stringify(remoteData)); } catch (_) {}
            // If data changed, notify UI to live update
            if (JSON.stringify(remoteData.customer_data) !== JSON.stringify(cachedData.customer_data) ||
                remoteData.template_id !== cachedData.template_id) {
              console.info('[engine.js] Background revalidation found updates — refreshing UI.');
              onLiveUpdate(remoteData);
            }
          }
        })
        .catch(() => {});
    }

    return { ...cachedData, _isCached: true };
  }

  // Tier 1: Supabase live fetch (for first-time visitors)
  try {
    const remoteData = await fetchInvitationBySlug(cleanSlug);
    if (remoteData) {
      try { localStorage.setItem(cacheKey, JSON.stringify(remoteData)); } catch (_) {}
      return remoteData;
    }
  } catch (_) {
    // Network failure — continue to next tier
  }

  // Tier 3: Static fallback-invitations.json
  const fb = await loadFallbackJSON();
  if (fb?.invitations?.[cleanSlug]) {
    console.warn('[engine.js] Supabase unavailable — using fallback JSON for slug:', cleanSlug);
    return fb.invitations[cleanSlug];
  }

  // Tier 4: Ultimate default fallback — never show an error screen
  console.warn('[engine.js] Slug not found anywhere — showing default invitation.');
  if (fb?.default) return { ...fb.default, _isFallbackDefault: true };
  return DEFAULT_INVITATION;
}

// ─── Myanmar Date Formatting ──────────────────────────────────────────────────

const MM_MONTHS = [
  'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်',      'ဧပြီ',
  'မေ',        'ဇွန်',        'ဇူလိုင်', 'သြဂုတ်',
  'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ',
];

const MM_DIGITS = ['၀','၁','၂','၃','၄','၅','၆','၇','၈','၉'];

/**
 * Converts ASCII digits in a string to Myanmar numeral characters.
 * @param {string|number} value
 * @returns {string}
 */
function toMyanmarNumerals(value) {
  return String(value).replace(/[0-9]/g, d => MM_DIGITS[parseInt(d, 10)]);
}

/**
 * Converts Myanmar numeral characters in a string to standard ASCII digits.
 * @param {string|number} value
 * @returns {string}
 */
function toAsciiNumerals(value) {
  const mmMap = { '၀':'0', '၁':'1', '၂':'2', '၃':'3', '၄':'4', '၅':'5', '၆':'6', '၇':'7', '၈':'8', '၉':'9' };
  return String(value ?? '').replace(/[၀-၉]/g, ch => mmMap[ch] || ch);
}

const MM_DAYS = ['တနင်္ဂနွေနေ့', 'တနင်္လာနေ့', 'အင်္ဂါနေ့', 'ဗုဒ္ဓဟူးနေ့', 'ကြာသပတေးနေ့', 'သောကြာနေ့', 'စနေနေ့'];

/**
 * Formats an ISO date string (YYYY-MM-DD) to dotted Myanmar numerals: DD . MM . YYYY
 * e.g. '2026-09-13' → '၁၃ . ၀၉ . ၂၀၂၆'
 * @param {string} isoDateStr
 * @returns {string}
 */
function formatWeddingDateDots(isoDateStr) {
  if (!isoDateStr) return '';
  const date = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(date.getTime())) return isoDateStr;

  const day   = toMyanmarNumerals(String(date.getDate()).padStart(2, '0'));
  const month = toMyanmarNumerals(String(date.getMonth() + 1).padStart(2, '0'));
  const year  = toMyanmarNumerals(String(date.getFullYear()));

  return `${day} . ${month} . ${year}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) to a Myanmar-friendly date.
 * e.g. '2025-12-12' → '၂၀၂၅ ခုနှစ် ဒီဇင်ဘာ ၁၂ ရက်'
 * @param {string} isoDateStr
 * @returns {string}
 */
function formatWeddingDate(isoDateStr) {
  if (!isoDateStr) return '';
  // Append time to avoid timezone shift on date parsing
  const date = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(date.getTime())) return isoDateStr;

  const year  = toMyanmarNumerals(date.getFullYear());
  const month = MM_MONTHS[date.getMonth()];
  const day   = toMyanmarNumerals(date.getDate());

  return `${year} ခုနှစ် ${month}လ ${day} ရက်`;
}

// ─── Heart Fall Animation ─────────────────────────────────────────────────────

const HEART_SYMBOLS = ['❤️', '🌹', '✨', '💕', '🌸', '♥', '💖', '🌷', '🕊️'];
let heartIntervalId = null;

/**
 * Spawns a single falling heart element into #hearts-container.
 */
function spawnHeart() {
  const container = document.getElementById('hearts-container');
  if (!container) return;

  const el = document.createElement('span');
  el.className = 'falling-heart';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = HEART_SYMBOLS[Math.floor(Math.random() * HEART_SYMBOLS.length)];

  const size     = Math.random() * 13 + 10;    // 10px – 23px
  const duration = Math.random() * 4.5 + 5;    // 5s  – 9.5s
  const delay    = Math.random() * 1.5;         // 0s  – 1.5s
  const leftPos  = Math.random() * 100;         // 0vw – 100vw

  el.style.cssText = `
    left: ${leftPos}vw;
    font-size: ${size}px;
    animation-duration: ${duration}s;
    animation-delay: ${delay}s;
  `;

  container.appendChild(el);

  // Remove from DOM after animation to prevent memory/DOM bloat
  setTimeout(() => el.remove(), (duration + delay + 0.6) * 1000);
}

/**
 * Starts the heart fall interval.
 * Respects prefers-reduced-motion.
 */
function startHeartAnimation() {
  if (heartIntervalId) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heartIntervalId = setInterval(spawnHeart, 800);
}

/**
 * Stops the heart fall interval (e.g., when tab is hidden).
 */
function stopHeartAnimation() {
  if (!heartIntervalId) return;
  clearInterval(heartIntervalId);
  heartIntervalId = null;
}

// ─── Intersection Observer — Scroll Entrance Animations ──────────────────────

/**
 * Watches all .animate-on-scroll elements and adds .animated class
 * when they enter the viewport. Each element animates only once.
 */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.animate-on-scroll');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
  );

  elements.forEach(el => observer.observe(el));
}

// ─── Photo CacheStorage Management (100% Offline Photo Reliability) ─────────
const PHOTO_CACHE_NAME = 'wedding-invitation-photos-v1';

/**
 * Loads and caches couple/memory photos using the Browser CacheStorage API.
 * - When online: Displays image and saves response into CacheStorage.
 * - When offline: Retrieves cached image Blob from CacheStorage and displays it via objectURL.
 * - Graceful fallback: If photo fails or doesn't exist, displays the romantic placeholder.
 *
 * @param {HTMLImageElement} imgEl
 * @param {HTMLElement|null} wrapperEl
 * @param {string} rawUrl
 */
async function loadAndCachePhoto(imgEl, wrapperEl, rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    imgEl.setAttribute('data-no-photo', 'true');
    if (wrapperEl) wrapperEl.setAttribute('data-no-photo', 'true');
    return;
  }

  const cleanUrl = rawUrl.trim();

  // 1. Try CacheStorage (Primary Offline Storage)
  if ('caches' in window) {
    try {
      const cache = await caches.open(PHOTO_CACHE_NAME);
      const cachedResponse = await cache.match(cleanUrl);

      if (cachedResponse) {
        // Cached version available — render immediately from offline cache!
        const blob = await cachedResponse.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          imgEl.src = blobUrl;
          imgEl.removeAttribute('data-no-photo');
          if (wrapperEl) wrapperEl.removeAttribute('data-no-photo');

          // If online, background refresh in case customer updated their photo
          if (navigator.onLine) {
            fetch(cleanUrl, { mode: 'cors' })
              .then(res => {
                if (res && res.ok) cache.put(cleanUrl, res.clone());
              })
              .catch(() => {});
          }
          return;
        }
      }

      // Not cached in CacheStorage yet: set src directly so browser loads natively.
      // The Service Worker (sw.js) automatically caches the photo in PHOTO_CACHE_NAME without double fetching!
      imgEl.src = cleanUrl;
      imgEl.removeAttribute('data-no-photo');
      if (wrapperEl) wrapperEl.removeAttribute('data-no-photo');

      imgEl.onerror = () => {
        imgEl.setAttribute('data-no-photo', 'true');
        if (wrapperEl) wrapperEl.setAttribute('data-no-photo', 'true');
      };
      return;
    } catch (err) {
      console.warn('[engine.js] CacheStorage read error:', err);
    }
  }

  // 2. Direct Fallback if CacheStorage is unsupported
  imgEl.src = cleanUrl;
  imgEl.removeAttribute('data-no-photo');
  if (wrapperEl) wrapperEl.removeAttribute('data-no-photo');
  imgEl.onerror = () => {
    imgEl.setAttribute('data-no-photo', 'true');
    if (wrapperEl) wrapperEl.setAttribute('data-no-photo', 'true');
  };
}

// ─── Data Binding ─────────────────────────────────────────────────────────────

/**
 * Binds customer_data values to the template DOM using data-* attributes.
 *
 * - [data-bind="key"]       → el.textContent = data[key]
 * - [data-bind-src="key"]   → el.src = data[key]  (img)
 * - [data-bind-href="key"]  → el.href = data[key] (a)
 * - [data-bind-class]       → conditionally adds a CSS class
 *
 * @param {HTMLElement} root   - The injected template root element
 * @param {Object}      data   - Enriched customer_data object
 */
function bindData(root, data) {
  const isFallback = data._isFallbackDefault === true;

  // ── data-bind → textContent ───────────────────────────────────────────────
  root.querySelectorAll('[data-bind]').forEach(el => {
    const key   = el.dataset.bind;
    const value = data[key];

    // For the fallback default invitation, preserve the existing text in the
    // template HTML if the element already has meaningful content (e.g. the
    // hero heading 'ကိုဟိန်းသူအောင်' already includes the 'ကို' prefix, so
    // we must not overwrite it with just 'ဟိန်းသူအောင်' — which would lose
    // the prefix — and the Card 1 'မောင်' prefix span sits outside the
    // data-bind span so no duplication occurs there either).
    if (isFallback && el.textContent.trim() !== '' && (value === undefined || value === null || String(value).trim() === '')) {
      // No value → keep placeholder
      return;
    }

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      el.textContent = value;
    } else {
      // Clear placeholder dummy text from template fragment if no data provided
      if (['wedding_date_formatted', 'wedding_time'].includes(key)) {
        el.textContent = '—';
      } else if (!isFallback) {
        el.textContent = '';
      }
      // If isFallback and element already has text, leave it as-is
    }
  });

  // ── data-bind-src → img src with Offline CacheStorage ─────────────────────
  root.querySelectorAll('[data-bind-src]').forEach(el => {
    const key   = el.dataset.bindSrc;
    const value = data[key];
    const wrapper = el.closest('[data-photo-wrapper]');
    loadAndCachePhoto(el, wrapper, value);
  });

  // ── data-bind-href → anchor href ──────────────────────────────────────────
  root.querySelectorAll('[data-bind-href]').forEach(el => {
    const key   = el.dataset.bindHref;
    const value = data[key];

    if (value && String(value).trim() !== '' && String(value).trim() !== 'tel:') {
      el.href = value;
      el.style.display = '';
    } else {
      // Hide anchor if no valid URL available (e.g., no map_url or empty phone)
      el.style.display = 'none';
    }
  });

  // ── data-bind-class → conditional class ───────────────────────────────────
  root.querySelectorAll('[data-bind-class]').forEach(el => {
    try {
      // Expected JSON: {"key":"someField","value":"someValue","class":"css-class"}
      const config = JSON.parse(el.dataset.bindClass);
      if (data[config.key] === config.value) {
        el.classList.add(config.class);
      }
    } catch (_) {
      // Malformed JSON — ignore silently
    }
  });
}

// ─── Page Meta Update (SEO & Social Share) ────────────────────────────────────

/**
 * Dynamically updates <title> and Open Graph meta tags
 * with couple's names and wedding details.
 *
 * @param {Object} data - Enriched customer_data
 */
function updatePageMeta(data) {
  const groom = data.groom_name || '';
  const bride = data.bride_name || '';
  const date  = data.wedding_date_formatted || '';
  const venue = data.venue_name || '';

  const title = `${groom} ❤ ${bride} — ထိမ်းမြားမင်္ဂလာ ဖိတ်ကြားလွှာ`;
  document.title = title;

  // Helper: upsert a <meta property="..."> tag
  const setOgMeta = (property, content) => {
    if (!content) return;
    let tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };

  setOgMeta('og:title',       title);
  setOgMeta('og:description', `${date} — ${venue}`);
  if (data.cover_photo_url)  setOgMeta('og:image', data.cover_photo_url);
  if (data.couple_photo_url) setOgMeta('og:image', data.couple_photo_url);
}

// ─── Dynamic Template CSS Loader ──────────────────────────────────────────────

/**
 * Injects a <link> for the template's style.css into <head>.
 * Removes any previously loaded template stylesheet first.
 * Appends cache-busting version query string.
 *
 * @param {string} templateId - e.g. 'royal-gold'
 * @returns {Promise<void>}
 */
function loadTemplateCSS(templateId) {
  return new Promise((resolve, reject) => {
    const prev = document.getElementById('template-stylesheet');
    if (prev && prev.getAttribute('data-template-id') === templateId) {
      return resolve();
    }
    if (prev) prev.remove();

    const link = document.createElement('link');
    link.id   = 'template-stylesheet';
    link.rel  = 'stylesheet';
    link.setAttribute('data-template-id', templateId);
    link.href = `templates/${templateId}/style.css?v=6`;
    link.onload  = resolve;
    link.onerror = () => reject(new Error(`Failed to load: templates/${templateId}/style.css`));

    document.head.appendChild(link);
  });
}

// ─── Error Display ────────────────────────────────────────────────────────────

const ERROR_MESSAGES = {
  'no-slug': {
    title:   'ဖိတ်ကြားလွှာ မတွေ့ပါ',
    message: 'URL ထဲတွင် ?id= မပါဝင်ပါ။\nမင်္ဂလာဆောင်မိသားစုထံမှ မှန်ကန်သော link ကို ရယူပါ။',
    canRetry: false,
  },
  'network-error': {
    title:   'ချိတ်ဆက်မှု မအောင်မြင်ပါ',
    message: 'အင်တာနက်လိုင်း ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ပြန်လည်ကြိုးစားပါ။',
    canRetry: true,
  },
  'not-found': {
    title:   'ဖိတ်ကြားလွှာ မရှိတော့ပါ',
    message: 'ဤ URL ကို ရှာမတွေ့ပါ သို့မဟုတ် ဖိတ်ကြားလွှာ ပိတ်ထားသည်။\nမင်္ဂလာဆောင်မိသားစုနှင့် ဆက်သွယ်ပြီး မှန်ကန်သော link ကို ပြန်ရယူပါ။',
    canRetry: false,
  },
  'template-error': {
    title:   'Template ဖွင့်၍ မရပါ',
    message: 'ဖိတ်ကြားလွှာ ဖိုင် ပျောက်ဆုံးနေသည်။\nကျေးဇူးပြု၍ website ပိုင်ရှင်ကို အကြောင်းကြားပါ။',
    canRetry: true,
  },
};

/**
 * Shows the error screen with the appropriate message, retry button, and hides the loader.
 * @param {string} type - One of the keys in ERROR_MESSAGES
 */
function showError(type) {
  const errScreen = document.getElementById('error-screen');
  const errTitle  = document.getElementById('error-title');
  const errMsg    = document.getElementById('error-message');

  const config = ERROR_MESSAGES[type] ?? ERROR_MESSAGES['not-found'];

  if (errTitle)  errTitle.textContent  = config.title;
  if (errMsg)    errMsg.textContent    = config.message;

  // Render retry button if error is recoverable
  let retryBtn = document.getElementById('error-retry-button');
  if (config.canRetry) {
    if (!retryBtn) {
      retryBtn = document.createElement('button');
      retryBtn.id = 'error-retry-button';
      retryBtn.className = 'error-retry-btn';
      retryBtn.textContent = 'ပြန်လည်ကြိုးစားမည်';
      retryBtn.addEventListener('click', () => {
        errScreen.classList.remove('visible');
        const loadScreen = document.getElementById('loading-screen');
        if (loadScreen) loadScreen.classList.remove('hidden');
        initEngine();
      });
      errScreen.appendChild(retryBtn);
    }
    retryBtn.hidden = false;
  } else if (retryBtn) {
    retryBtn.hidden = true;
  }

  if (errScreen) errScreen.classList.add('visible');

  // Hide loading screen
  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) loadScreen.classList.add('hidden');
}

// ─── Loading Screen Dismiss ───────────────────────────────────────────────────

/**
 * Fades out and removes the loading screen from the DOM.
 */
function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 750);
}

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

function enrichCustomerData(raw = {}) {
  const data = { ...raw };
  data.wedding_date_formatted = formatWeddingDateDots(data.wedding_date) || formatWeddingDate(data.wedding_date);
  data.wedding_date_traditional = formatWeddingDate(data.wedding_date);

  if (data.wedding_date && !data.wedding_day) {
    const d = new Date(`${data.wedding_date}T00:00:00`);
    if (!isNaN(d.getTime())) {
      data.wedding_day = MM_DAYS[d.getDay()];
    }
  }

  if (data.rsvp_phone) {
    const cleanPhone = toAsciiNumerals(data.rsvp_phone).replace(/[^0-9+]/g, '');
    data.rsvp_phone_href = cleanPhone ? `tel:${cleanPhone}` : '';
  }

  data.couple_names = [data.groom_name, data.bride_name].filter(Boolean).join(' & ');
  return data;
}

/**
 * Orchestrates the full template loading pipeline with Parallel Execution & Instant Load
 */
async function initEngine() {

  // Step 1: Read URL slug — accept ?id=, ?slug=, or #hash
  const params  = new URLSearchParams(window.location.search);
  const rawSlug = (params.get('id') || params.get('slug') || window.location.hash.replace(/^#/, '') || '').trim().toLowerCase() || null;

  try {
    // Callback for Stale-While-Revalidate live background updates
    const onLiveUpdate = (remoteData) => {
      const container = document.getElementById('template-container');
      if (!container || !container.classList.contains('visible')) return;
      const freshData = enrichCustomerData(remoteData.customer_data);
      bindData(container, freshData);
      updatePageMeta(freshData);
    };

    // Step 2: Multi-tier resolve with Instant Cache-First return
    const invitation = await resolveInvitationData(rawSlug, onLiveUpdate);

    // Step 3: Enrich customer_data
    const data = enrichCustomerData(invitation.customer_data);

    // Step 4: Resolve template ID
    const templateId = (invitation.template_id && invitation.template_id.trim()) ? invitation.template_id.trim() : 'floral-pink';

    // Step 5 & 6 (PARALLEL PIPELINE): Concurrently fetch layout fragment & inject template CSS
    const [layoutHTML] = await Promise.all([
      fetch(`templates/${templateId}/layout.html?v=6`).then(res => {
        if (!res.ok) throw new Error(`Failed to fetch templates/${templateId}/layout.html`);
        return res.text();
      }),
      loadTemplateCSS(templateId)
    ]);

    // Step 7: Inject HTML into template container
    const container = document.getElementById('template-container');
    container.innerHTML = layoutHTML;

    // Step 8: Bind all data-* attributes
    bindData(container, data);

    // Step 9: Update page title and Open Graph meta
    updatePageMeta(data);

    // Step 10: Reveal template and dismiss loading screen
    hideLoadingScreen();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.add('visible');
      });
    });

    // Step 11: Start animations & theme interactive controller
    startHeartAnimation();
    initScrollAnimations();

    if (templateId === 'floral-pink') {
      initFloralPinkTheme(container, data, rawSlug || 'default');
    }

  } catch (err) {
    console.error('[engine.js] Unexpected error — attempting emergency render:', err);
    // Emergency Fallback: render default floral-pink template rather than showing an error
    try {
      const emergencyLayout = await fetch('templates/floral-pink/layout.html?v=6');
      if (emergencyLayout.ok) {
        const container = document.getElementById('template-container');
        container.innerHTML = await emergencyLayout.text();
        await loadTemplateCSS('floral-pink');
        const data = enrichCustomerData(DEFAULT_INVITATION.customer_data);
        bindData(container, data);
        updatePageMeta(data);
        hideLoadingScreen();
        requestAnimationFrame(() => requestAnimationFrame(() => container.classList.add('visible')));
        startHeartAnimation();
        initScrollAnimations();
        initFloralPinkTheme(container, data, 'default');
        return;
      }
    } catch (emergencyErr) {
      console.error('[engine.js] Emergency render also failed:', emergencyErr);
    }
    // Last resort: only show error screen if emergency render also fails
    showError('template-error');
  }
}

// ─── Lifecycle: Pause/Resume Hearts on Tab Visibility ─────────────────────────

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopHeartAnimation();
  } else {
    // Only resume if template is already loaded (container is visible)
    const container = document.getElementById('template-container');
    if (container?.classList.contains('visible')) {
      startHeartAnimation();
    }
  }
});

// ─── Floral Pink Theme Interactive Controller ────────────────────────────────
let pinkAudioCtx = null;
let pinkMusicTimer = null;
let pinkMusicPlaying = false;

function playRomanticTune() {
  if (pinkAudioCtx) {
    if (pinkAudioCtx.state === 'suspended') pinkAudioCtx.resume();
    return;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    pinkAudioCtx = new AudioContext();

    const notes = [
      293.66, 440.00, 369.99, 440.00, // D
      220.00, 329.63, 440.00, 554.37, // A
      246.94, 369.99, 440.00, 493.88, // Bm
      185.00, 277.18, 369.99, 440.00, // F#m
      196.00, 293.66, 392.00, 493.88, // G
      293.66, 369.99, 440.00, 587.33, // D
      196.00, 293.66, 392.00, 440.00, // G
      220.00, 329.63, 440.00, 554.37  // A
    ];
    let noteIndex = 0;

    const playNext = () => {
      if (!pinkMusicPlaying || !pinkAudioCtx) return;
      const osc = pinkAudioCtx.createOscillator();
      const gain = pinkAudioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[noteIndex % notes.length], pinkAudioCtx.currentTime);

      gain.gain.setValueAtTime(0, pinkAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, pinkAudioCtx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, pinkAudioCtx.currentTime + 0.95);

      osc.connect(gain);
      gain.connect(pinkAudioCtx.destination);

      osc.start();
      osc.stop(pinkAudioCtx.currentTime + 1.0);

      noteIndex++;
      pinkMusicTimer = setTimeout(playNext, 620);
    };

    playNext();
  } catch (err) {
    console.warn('[pink-music] Audio error:', err);
  }
}

function stopRomanticTune() {
  if (pinkMusicTimer) {
    clearTimeout(pinkMusicTimer);
    pinkMusicTimer = null;
  }
  if (pinkAudioCtx && pinkAudioCtx.state === 'running') {
    pinkAudioCtx.suspend();
  }
}

function spawnPinkBurstHeart(originX, originY) {
  const heart = document.createElement('span');
  heart.className = 'pink-burst-heart';
  const symbols = ['❤️', '💖', '💕', '🌹', '✨', '♥'];
  heart.textContent = symbols[Math.floor(Math.random() * symbols.length)];

  const startX = originX || (window.innerWidth / 2);
  const startY = originY || (window.innerHeight / 2);
  const dx = (Math.random() - 0.5) * 160;
  const dx2 = (Math.random() - 0.5) * 260;
  const rot = (Math.random() - 0.5) * 60;
  const rot2 = (Math.random() - 0.5) * 120;

  heart.style.left = `${startX}px`;
  heart.style.top = `${startY}px`;
  heart.style.setProperty('--dx', `${dx}px`);
  heart.style.setProperty('--dx2', `${dx2}px`);
  heart.style.setProperty('--rot', `${rot}deg`);
  heart.style.setProperty('--rot2', `${rot2}deg`);

  document.body.appendChild(heart);
  setTimeout(() => heart.remove(), 1600);
}

function initFloralPinkTheme(container, data, slug) {
  // 1. Envelope opening interaction
  const envelopeBox = container.querySelector('#envelope-box');
  const openBtn = container.querySelector('#btn-open-envelope');
  const waxSeal = container.querySelector('#wax-seal');
  const mainCards = container.querySelector('#invitation-main-cards');

  const openEnvelope = () => {
    if (envelopeBox) envelopeBox.classList.add('is-opened');
    setTimeout(() => {
      mainCards?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 450);
  };

  envelopeBox?.addEventListener('click', openEnvelope);
  openBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    openEnvelope();
  });
  waxSeal?.addEventListener('click', (e) => {
    e.stopPropagation();
    openEnvelope();
  });

  // 2. Countdown Timer
  const daysEl = container.querySelector('#timer-days');
  const hoursEl = container.querySelector('#timer-hours');
  const minutesEl = container.querySelector('#timer-minutes');
  const secondsEl = container.querySelector('#timer-seconds');
  const statusEl = container.querySelector('#countdown-status-text');

  if (daysEl) {
    const targetDateStr = data.wedding_date || '2026-09-13';
    const targetTimeStr = '09:30:00';
    const targetDate = new Date(`${targetDateStr}T${targetTimeStr}`);

    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff > 0) {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);

        daysEl.textContent = toMyanmarNumerals(String(d).padStart(2, '0'));
        hoursEl.textContent = toMyanmarNumerals(String(h).padStart(2, '0'));
        minutesEl.textContent = toMyanmarNumerals(String(m).padStart(2, '0'));
        secondsEl.textContent = toMyanmarNumerals(String(s).padStart(2, '0'));
        if (statusEl) statusEl.textContent = 'မင်္ဂလာဆောင်မည့်အချိန်အထိ စောင့်မျှော်ရေတွက်မှု 💕';
      } else {
        const elapsed = Math.abs(diff);
        const d = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        const h = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
        const m = Math.floor((elapsed / 1000 / 60) % 60);
        const s = Math.floor((elapsed / 1000) % 60);

        daysEl.textContent = toMyanmarNumerals(String(d).padStart(2, '0'));
        hoursEl.textContent = toMyanmarNumerals(String(h).padStart(2, '0'));
        minutesEl.textContent = toMyanmarNumerals(String(m).padStart(2, '0'));
        secondsEl.textContent = toMyanmarNumerals(String(s).padStart(2, '0'));
        if (statusEl) statusEl.textContent = 'မင်္ဂလာဆောင်ခဲ့သည့်နေ့မှ ယနေ့အထိ အမှတ်တရကြာချိန် 💕';
      }
    };
    updateTimer();
    setInterval(updateTimer, 1000);
  }

  // 3. Heart love counter & burst
  const heartKey = `pink_heart_count_${slug || 'default'}`;
  let heartCount = parseInt(localStorage.getItem(heartKey) || '139', 10);
  const heartDisplay = container.querySelector('#love-heart-count');
  const loveHeartBtn = container.querySelector('#btn-send-love-heart');

  if (heartDisplay) heartDisplay.textContent = heartCount;

  if (loveHeartBtn) {
    loveHeartBtn.addEventListener('click', (e) => {
      heartCount++;
      localStorage.setItem(heartKey, heartCount);
      if (heartDisplay) heartDisplay.textContent = heartCount;
      const rect = loveHeartBtn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => spawnPinkBurstHeart(x, y), i * 110);
      }
    });
  }

  // 4. Guest Wishes
  const wishesKey = `pink_wishes_${slug || 'default'}`;
  const wishForm = container.querySelector('#pink-guest-wish-form');
  const wishListEl = container.querySelector('#pink-wishes-list');
  const nameInput = container.querySelector('#guest-name-input');
  const msgInput = container.querySelector('#guest-message-input');

  const defaultWishes = [
    { name: 'ကိုအောင်သူ & မစန္ဒာ', message: 'သတို့သားနှင့် သတို့သမီးတို့ ဘဝတစ်သက်တာ လက်တွဲမြဲပြီး ချစ်ခြင်းမေတ္တာ အပြည့်ဖြင့် ပျော်ရွှင်ချမ်းမြေ့ပါစေခင်ဗျာ။', time: 'မကြာသေးမီက' },
    { name: 'မသီတာ (Sedona)', message: 'မင်္ဂလာပါရှင်။ ချစ်စဖွယ် အိမ်ထောင်ရှင်ဘဝကို သာယာအေးချမ်းစွာ တည်ဆောက်နိုင်ပါစေရှင်။ ရာသက်ပန် ပျော်ရွှင်ပါစေ။', time: 'မကြာသေးမီက' }
  ];

  let wishes = [];
  try {
    const raw = localStorage.getItem(wishesKey);
    wishes = raw ? JSON.parse(raw) : defaultWishes;
  } catch (_) {
    wishes = defaultWishes;
  }

  const renderWishes = () => {
    if (!wishListEl) return;
    const esc = (t = '') => String(t).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[c]);
    wishListEl.innerHTML = wishes.map(w => `
      <div class="wish-bubble">
        <div class="wish-author">
          <span>💖 ${esc(w.name)}</span>
          <span class="wish-time">${esc(w.time || 'အခုလေးတင်')}</span>
        </div>
        <p class="wish-message-text">${esc(w.message)}</p>
      </div>
    `).join('');
  };

  renderWishes();

  wishForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput?.value.trim();
    const message = msgInput?.value.trim();

    if (!name || !message) {
      alert('ကျေးဇူးပြု၍ အမည်နှင့် ဆုမွန်ကောင်း စာသားကို ဖြည့်စွက်ပေးပါ။');
      return;
    }

    wishes.unshift({ name, message, time: 'အခုလေးတင်' });
    try {
      localStorage.setItem(wishesKey, JSON.stringify(wishes.slice(0, 50)));
    } catch (_) {}

    renderWishes();
    if (nameInput) nameInput.value = '';
    if (msgInput) msgInput.value = '';

    for (let i = 0; i < 4; i++) {
      setTimeout(() => spawnPinkBurstHeart(window.innerWidth / 2, window.innerHeight * 0.7), i * 110);
    }
  });

  // 5. Back to top
  container.querySelector('#btn-pink-back-to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 7. Save to Calendar
  initCalendarSection(container, data);

  // 6. Music Toggle
  const musicBtn = container.querySelector('#pink-music-btn');
  musicBtn?.addEventListener('click', () => {
    pinkMusicPlaying = !pinkMusicPlaying;
    if (pinkMusicPlaying) {
      musicBtn.classList.add('is-playing');
      playRomanticTune();
    } else {
      musicBtn.classList.remove('is-playing');
      stopRomanticTune();
    }
  });
}

// ─── Calendar Section Controller ────────────────────────────────────────────

/**
 * Initialises the Save-to-Calendar card (#card-calendar).
 * Wires up:
 *   1. #btn-save-to-calendar  → downloads .ics file
 *   2. #btn-google-calendar   → sets correct Google Calendar URL
 *   3. #btn-set-reminder      → requests Notification permission & schedules alert
 *
 * @param {HTMLElement} container
 * @param {Object}      data       — enriched customer_data
 */
function initCalendarSection(container, data) {
  const saveBtn     = container.querySelector('#btn-save-to-calendar');
  const gcalLink    = container.querySelector('#btn-google-calendar');
  const reminderBtn = container.querySelector('#btn-set-reminder');
  const statusEl    = container.querySelector('#calendar-status');
  const reminderLbl = container.querySelector('#btn-reminder-label');

  if (!saveBtn) return; // card not present in this template

  // Build calendar options from invitation data
  const calOpts = {
    groomName   : data.groom_name    || '',
    brideName   : data.bride_name    || '',
    weddingDate : data.wedding_date  || '',
    weddingTime : data.wedding_time  || '',
    venueName   : data.venue_name    || '',
    venueAddress: data.venue_address || '',
    mapUrl      : data.map_url       || '',
  };

  // ── Helper: show status message ───────────────────────────────────────────
  function showStatus(message, type = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className   = `calendar-status-msg is-${type}`;
    statusEl.hidden      = false;
    // Auto-hide after 6 seconds
    setTimeout(() => {
      statusEl.hidden = true;
      statusEl.className = 'calendar-status-msg';
    }, 6000);
  }

  // ── 1. Prefill Google Calendar link ──────────────────────────────────────
  if (gcalLink && calOpts.weddingDate) {
    try {
      gcalLink.href = getGoogleCalendarUrl(calOpts);
    } catch (_) {
      gcalLink.style.display = 'none';
    }
  } else if (gcalLink) {
    gcalLink.style.display = 'none';
  }

  // ── 2. ICS Download button ────────────────────────────────────────────────
  saveBtn.addEventListener('click', () => {
    if (!calOpts.weddingDate) {
      showStatus('⚠️ မင်္ဂလာနေ့ရက် သတ်မှတ်မထားသောကြောင့် Calendar ထဲ သိမ်း၍ မရသေးပါ။', 'warning');
      return;
    }

    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;

    // Small delay so loading shimmer is visible before file dialog
    setTimeout(() => {
      saveToCalendar(
        calOpts,
        ({ platform, googleUrl }) => {
          saveBtn.classList.remove('is-loading');
          saveBtn.disabled = false;

          if (platform === 'ios') {
            showStatus(
              '📅 Calendar ဖိုင် ဒေါင်းလုပ် ဆင်းနေပါသည်။ "Files" app မှ .ics ဖိုင်ကို ဖွင့်ပြီး "Add All" ကိုနှိပ်ပါ — ✅ Reminder ပါ အလိုအလျောက် ထည့်ပေးပါလိမ့်မည်။',
              'success'
            );
          } else if (platform === 'android') {
            showStatus(
              '📅 .ics ဖိုင် ဒေါင်းလုပ် ဆင်းပြီးပါပြီ — Calendar app မှ ဖွင့်ပါ သို့မဟုတ် Google Calendar ခလုတ်ကို နှိပ်၍ တိုက်ရိုက် ထည့်နိုင်ပါသည်။',
              'success'
            );
          } else {
            showStatus(
              '📅 .ics ဖိုင် ဒေါင်းလုပ် ဆင်းပြီးပါပြီ — ဖိုင်ကို Double-click နှိပ်ပါ။ Outlook, Apple Calendar, Google Calendar, Thunderbird စသည်တို့တွင် အလိုအလျောက် ပွင့်ပါလိမ့်မည်။',
              'success'
            );
          }
        },
        (err) => {
          saveBtn.classList.remove('is-loading');
          saveBtn.disabled = false;
          showStatus('❌ Calendar ဖိုင် ထုတ်ယူ၍ မရပါ။ Google Calendar ခလုတ်ကို အသုံးပြုပါ သို့မဟုတ် ထပ်မံ ကြိုးစားပါ။', 'error');
          console.error('[calendar] ICS download failed:', err);
        }
      );
    }, 80);
  });

  // ── 3. Reminder (Browser Notification) button ──────────────────────────────
  // Check if already granted and reminder is set
  const existingReminderKey = calOpts.weddingDate ? `wedding_reminder_${calOpts.weddingDate}` : null;
  let reminderSet = false;

  try {
    if (existingReminderKey && localStorage.getItem(existingReminderKey)) {
      const stored = JSON.parse(localStorage.getItem(existingReminderKey));
      if (stored && !stored.fired && stored.reminderTime > Date.now()) {
        reminderSet = true;
      }
    }
  } catch (_) {}

  function updateReminderBtnState(active) {
    if (!reminderBtn || !reminderLbl) return;
    if (active) {
      reminderBtn.classList.add('is-active');
      reminderLbl.textContent = 'Reminder ဖွင့်ထားပြီး ✓';
    } else {
      reminderBtn.classList.remove('is-active');
      reminderLbl.textContent = 'မင်္ဂလာနေ့ Reminder ဖွင့်မည်';
    }
  }

  if (reminderSet) updateReminderBtnState(true);

  // Hide reminder button if Notifications not supported
  if (!('Notification' in window)) {
    if (reminderBtn) reminderBtn.style.display = 'none';
  }

  reminderBtn?.addEventListener('click', async () => {
    if (!calOpts.weddingDate) {
      showStatus('⚠️ မင်္ဂလာနေ့ရက် မသတ်မှတ်ရသေးသောကြောင့် Reminder မဖွင့်နိုင်ပါ။', 'warning');
      return;
    }

    // Toggle off if already active
    if (reminderSet) {
      try {
        if (existingReminderKey) localStorage.removeItem(existingReminderKey);
      } catch (_) {}
      reminderSet = false;
      updateReminderBtnState(false);
      showStatus('🔕 Reminder ပိတ်ပြီးပါပြီ။', 'info');
      return;
    }

    reminderBtn.disabled = true;
    const result = await scheduleWeddingReminder({
      ...calOpts,
      venueName: calOpts.venueName,
    });
    reminderBtn.disabled = false;

    if (result === 'granted') {
      reminderSet = true;
      updateReminderBtnState(true);
      showStatus(
        '🔔 Reminder ဖွင့်ပြီးပါပြီ! မင်္ဂလာနေ့ နံနက် ၈ နာရီတွင် Notification ပေးပို့မည်ဖြစ်ပါသည် — Browser / PWA ကိုမပိတ်ပါနှင့်။',
        'success'
      );
    } else if (result === 'denied') {
      showStatus(
        '🚫 Notification ခွင့်ပြုချက် မပေးသောကြောင့် Reminder မဖွင့်နိုင်ပါ။ Browser Setting မှ Notification ကို "Allow" လုပ်ပြီး ပြန်လာကြိုးစားပါ။',
        'error'
      );
    } else if (result === 'past') {
      showStatus(
        '📅 မင်္ဂလာနေ့ ကျော်လွန်သွားသောကြောင့် Reminder မဖွင့်နိုင်ပါ။ Calendar ဖိုင် သိမ်းမည် ခလုတ်ကို နှိပ်ပါ။',
        'warning'
      );
    } else {
      showStatus(
        '⚠️ ဤ Browser တွင် Notification Feature မပံ့ပိုးပါ။ Calendar ဖိုင် သိမ်းမည် ခလုတ်ကို အသုံးပြု၍ .ics ဖိုင်ထဲ Reminder ပါ ထည့်ပါ။',
        'warning'
      );
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngine);
} else {
  initEngine();
}
