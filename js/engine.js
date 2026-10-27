// =============================================================================
// js/engine.js
// Template Engine — Micro-Kernel Host & Decoupled Architecture
// Reads ?id=<slug>, resolves invitation data, injects template HTML + CSS,
// performs declarative data-binding, and mounts the template's interactive plugin.
// 100% Zero-Downtime Architecture — never shows error screen to guests.
// Digital Wedding & Event Invitation Platform
// =============================================================================

import { fetchInvitationBySlug, fetchLatestActiveInvitation, fetchWishesBySlug, submitGuestWish, reportSystemError, fetchPlatformSponsor } from './supabase-config.js';
import { saveToCalendar, getGoogleCalendarUrl, scheduleWeddingReminder } from './calendar.js';

// Unified Asset & Shell Cache Version
const ASSET_CACHE_VERSION = '23';

// ─── Static Fallback JSON cache (loaded once) ─────────────────────────────────
let _fallbackJSON = null;

async function loadFallbackJSON() {
  if (_fallbackJSON) return _fallbackJSON;
  try {
    const res = await fetch(`data/fallback-invitations.json?v=${ASSET_CACHE_VERSION}`);
    if (res.ok) {
      _fallbackJSON = await res.json();
    }
  } catch (_) {
    // If JSON fetch fails, fallback stays null
  }
  return _fallbackJSON;
}

// ─── Multi-Tier Invitation Resolver (Strict Zero-Default-Fallback) ─────────────
/**
 * Resolves invitation data strictly for the requested slug or tenant.
 * Zero-Stranger-Data Policy: NEVER falls back to any generic default card.
 * If data cannot be retrieved, throws NETWORK_OR_NOT_FOUND to show clear Retry UI.
 *
 * Tier 0 — Direct entry (no slug): dynamically fetch latest active invitation from Supabase
 * Tier 1 — Supabase live fetch
 * Tier 2 — localStorage cache (Stale-while-revalidate for 0ms load)
 * Tier 3 — Static pre-cached fallback JSON (ONLY matching the exact cleanSlug)
 *
 * @param {string|null} slug
 * @param {Function|null} onLiveUpdate
 * @param {Function|null} onNetworkProgress
 * @returns {Promise<Object>}
 */
async function resolveInvitationData(slug, onLiveUpdate = null, onNetworkProgress = null) {
  if (!slug) {
    console.info('[engine.js] No slug in URL — fetching latest active invitation from Supabase.');
    try {
      const latest = await fetchLatestActiveInvitation([4500, 5000, 5500], 2, onNetworkProgress);
      if (latest && latest.customer_data) {
        return latest;
      }
    } catch (_) {}
    const notFoundErr = new Error('No active invitation found or network offline');
    notFoundErr.code = 'NETWORK_OR_NOT_FOUND';
    throw notFoundErr;
  }

  const cleanSlug = String(slug).trim().toLowerCase();
  const cacheKey  = `inv_cache_${cleanSlug}`;
  const legacyKey = `wedding_inv_cache_${cleanSlug}`;

  // Check local cache first for INSTANT 0ms load (Returning Visitors)
  let cachedData = null;
  try {
    const raw = localStorage.getItem(cacheKey) || localStorage.getItem(legacyKey);
    if (raw) cachedData = JSON.parse(raw);
  } catch (_) {}

  if (cachedData) {
    console.info('[engine.js] Instant 0ms Load: serving cached data for slug:', cleanSlug);

    // Asynchronously revalidate in background if online (Silent Background Revalidation)
    if (navigator.onLine && typeof onLiveUpdate === 'function') {
      fetchInvitationBySlug(cleanSlug, [4500, 5000, 5500], 2)
        .then(remoteData => {
          if (remoteData) {
            try { localStorage.setItem(cacheKey, JSON.stringify(remoteData)); } catch (_) {}
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

  // Tier 1: Supabase live fetch with Fast Adaptive Timeouts (4.5s ➔ 5.0s ➔ 5.5s)
  try {
    const remoteData = await fetchInvitationBySlug(cleanSlug, [4500, 5000, 5500], 2, onNetworkProgress);
    if (remoteData) {
      try { localStorage.setItem(cacheKey, JSON.stringify(remoteData)); } catch (_) {}
      return remoteData;
    }
  } catch (_) {
    // Network failure — continue to fallback tiers
  }

  // Tier 3: Static fallback-invitations.json (ONLY if matches cleanSlug)
  const fb = await loadFallbackJSON();
  if (fb?.invitations?.[cleanSlug]) {
    console.warn('[engine.js] Supabase unavailable — using fallback JSON for slug:', cleanSlug);
    return fb.invitations[cleanSlug];
  }

  // Slug was specifically requested by guest/QR, but not found or network timed out.
  // NEVER silently swap to a stranger's wedding card or any default fallback!
  console.warn('[engine.js] Slug not found in Supabase or fallback:', cleanSlug);
  const notFoundErr = new Error(`Invitation not found or network timeout: ${cleanSlug}`);
  notFoundErr.code = 'NETWORK_OR_NOT_FOUND';
  throw notFoundErr;
}

// ─── Myanmar Localization & Formatting Utilities ──────────────────────────────

const MM_MONTHS = [
  'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်',      'ဧပြီ',
  'မေ',        'ဇွန်',        'ဇူလိုင်', 'သြဂုတ်',
  'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ',
];

const MM_DIGITS = ['၀','၁','၂','၃','၄','၅','၆','၇','၈','၉'];
const MM_DAYS   = ['တနင်္ဂနွေနေ့', 'တနင်္လာနေ့', 'အင်္ဂါနေ့', 'ဗုဒ္ဓဟူးနေ့', 'ကြာသပတေးနေ့', 'သောကြာနေ့', 'စနေနေ့'];

export function toMyanmarNumerals(value) {
  return String(value ?? '').replace(/[0-9]/g, d => MM_DIGITS[parseInt(d, 10)]);
}

export function toAsciiNumerals(value) {
  const mmMap = { '၀':'0', '၁':'1', '၂':'2', '၃':'3', '၄':'4', '၅':'5', '၆':'6', '၇':'7', '၈':'8', '၉':'9' };
  return String(value ?? '').replace(/[၀-၉]/g, ch => mmMap[ch] || ch);
}

export function formatWeddingDateDots(isoDateStr) {
  if (!isoDateStr) return '';
  const date = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(date.getTime())) return isoDateStr;

  const day   = toMyanmarNumerals(String(date.getDate()).padStart(2, '0'));
  const month = toMyanmarNumerals(String(date.getMonth() + 1).padStart(2, '0'));
  const year  = toMyanmarNumerals(String(date.getFullYear()));

  return `${day} . ${month} . ${year}`;
}

export function formatWeddingDate(isoDateStr) {
  if (!isoDateStr) return '';
  const date = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(date.getTime())) return isoDateStr;

  const year  = toMyanmarNumerals(date.getFullYear());
  const month = MM_MONTHS[date.getMonth()];
  const day   = toMyanmarNumerals(date.getDate());

  return `${year} ခုနှစ် ${month}လ ${day} ရက်`;
}

// ─── Intersection Observer — Scroll Entrance Animations ──────────────────────

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

// ─── Photo CacheStorage Management (100% Offline Photo Reliability) ───────────

const PHOTO_CACHE_NAME = 'wedding-invitation-photos-v2';

async function loadAndCachePhoto(imgEl, wrapperEl, rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    imgEl.setAttribute('data-no-photo', 'true');
    if (wrapperEl) wrapperEl.setAttribute('data-no-photo', 'true');
    return;
  }

  const cleanUrl = rawUrl.trim();

  // Try CacheStorage
  if ('caches' in window) {
    try {
      const cache = await caches.open(PHOTO_CACHE_NAME);
      const cachedResponse = await cache.match(cleanUrl);

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          imgEl.src = blobUrl;
          imgEl.removeAttribute('data-no-photo');
          if (wrapperEl) wrapperEl.removeAttribute('data-no-photo');

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

  // Direct Fallback
  imgEl.src = cleanUrl;
  imgEl.removeAttribute('data-no-photo');
  if (wrapperEl) wrapperEl.removeAttribute('data-no-photo');
  imgEl.onerror = () => {
    imgEl.setAttribute('data-no-photo', 'true');
    if (wrapperEl) wrapperEl.setAttribute('data-no-photo', 'true');
  };
}

// ─── Declarative Data Binding Engine ──────────────────────────────────────────

/**
 * Binds customer_data values to the template DOM using standard data-* attributes.
 *
 * - [data-bind="key"]       → el.textContent = data[key]
 * - [data-bind-src="key"]   → el.src = data[key] (img with offline cache)
 * - [data-bind-href="key"]  → el.href = data[key] (anchor)
 * - [data-bind-class]       → conditionally adds a CSS class
 *
 * @param {HTMLElement} root
 * @param {Object}      data
 */
function bindData(root, data) {
  const isFallback = data._isFallbackDefault === true;

  // data-bind → textContent
  root.querySelectorAll('[data-bind]').forEach(el => {
    const key   = el.dataset.bind;
    const value = data[key];

    if (isFallback && el.textContent.trim() !== '' && (value === undefined || value === null || String(value).trim() === '')) {
      return;
    }

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      el.textContent = value;
    } else {
      if (['wedding_date_formatted', 'wedding_time'].includes(key)) {
        el.textContent = '—';
      } else if (!isFallback) {
        el.textContent = '';
      }
    }
  });

  // data-bind-src → img src with offline CacheStorage
  root.querySelectorAll('[data-bind-src]').forEach(el => {
    const key   = el.dataset.bindSrc;
    const value = data[key];
    const wrapper = el.closest('[data-photo-wrapper]');
    loadAndCachePhoto(el, wrapper, value);
  });

  // data-bind-href → anchor href
  root.querySelectorAll('[data-bind-href]').forEach(el => {
    const key   = el.dataset.bindHref;
    const value = data[key];

    if (value && String(value).trim() !== '' && String(value).trim() !== 'tel:') {
      let cleanHref = String(value).trim();
      if ((key === 'map_url' || key === 'website_url') && !/^https?:\/\//i.test(cleanHref)) {
        cleanHref = `https://${cleanHref}`;
      }
      el.href = cleanHref;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });

  // data-bind-class → conditional class
  root.querySelectorAll('[data-bind-class]').forEach(el => {
    try {
      const config = JSON.parse(el.dataset.bindClass);
      if (data[config.key] === config.value) {
        el.classList.add(config.class);
      }
    } catch (_) {}
  });
}

// ─── Dynamic Meta & Open Graph Updater ────────────────────────────────────────

function updatePageMeta(data) {
  const displayTitle = data.display_title || data.company_name || data.celebrant_name || data.couple_names || [data.groom_name, data.bride_name].filter(Boolean).join(' & ') || 'ဒစ်ဂျစ်တယ် ဖိတ်ကြားလွှာ & Profile';
  const date = data.wedding_date_formatted || '';

  const pageTitle = date ? `${displayTitle} — ${date}` : displayTitle;
  document.title = pageTitle;

  const setMeta = (selector, content) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };

  const metaDesc = data.tagline || data.industry_tagline || (data.venue_name ? `${displayTitle} — ${data.venue_name}` : displayTitle);

  setMeta('meta[property="og:title"]', pageTitle);
  setMeta('meta[property="og:description"]', metaDesc);
  if (data.cover_photo_url) {
    setMeta('meta[property="og:image"]', data.cover_photo_url);
  }
}

// ─── CSS Dynamic Link Injector ────────────────────────────────────────────────

function loadTemplateCSS(templateId) {
  return new Promise((resolve) => {
    const existing = document.getElementById('template-style');
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.id   = 'template-style';
    link.rel  = 'stylesheet';
    link.href = `templates/${templateId}/style.css?v=${ASSET_CACHE_VERSION}`;

    link.onload  = () => resolve();
    link.onerror = () => {
      console.warn(`[engine.js] Failed to load CSS for template: ${templateId}`);
      resolve();
    };

    document.head.appendChild(link);
  });
}

// ─── Multi-Template Loading Theme Engine ──────────────────────────────────────
const LOADING_THEMES = {
  'biz-card-gold': {
    badge: '✦ APEX BUSINESS CARD ✦',
    title: 'Business Card & Profile',
    subText: 'လုပ်ငန်းအချက်အလက်များ ဖွင့်နေပါသည်...',
    slowNet1: 'လုပ်ငန်းကွန်ရက် စစ်ဆေးနေပါသည်...',
    slowNet2: 'လုပ်ငန်းအချက်အလက်များ ဆွဲယူနေဆဲဖြစ်ပါသည်၊ ခေတ္တစောင့်ဆိုင်းပေးပါ...',
    icon: '💼',
    themeClass: 'loading-theme-biz-card-gold'
  },
  'neon-birthday': {
    badge: '🎉 BIRTHDAY CELEBRATION 🎉',
    title: 'Neon Birthday Party',
    subText: 'မွေးနေ့ဖိတ်ကြားလွှာ ဖွင့်နေပါသည်...',
    slowNet1: 'မွေးနေ့အခမ်းအနား အင်တာနက် စစ်ဆေးနေပါသည်...',
    slowNet2: 'ဒေတာများ ဆွဲယူနေဆဲဖြစ်ပါသည်၊ ခေတ္တစောင့်ဆိုင်းပေးပါ...',
    icon: '🎂',
    themeClass: 'loading-theme-neon-birthday'
  },
  'floral-pink': {
    badge: '💍 WEDDING INVITATION 💍',
    title: 'Sweet Pink Romance',
    subText: 'မင်္ဂလာဖိတ်ကြားလွှာ ဖွင့်နေပါသည်...',
    slowNet1: 'မင်္ဂလာအစီအစဉ် အင်တာနက် စစ်ဆေးနေပါသည်...',
    slowNet2: 'ဒေတာများ ဆွဲယူနေဆဲဖြစ်ပါသည်၊ ခေတ္တစောင့်ဆိုင်းပေးပါ...',
    icon: '❤',
    themeClass: 'loading-theme-floral-pink'
  },
  'default': {
    badge: '✦ DIGITAL INVITATION ✦',
    title: 'Digital Invitation & Profile',
    subText: 'စာမျက်နှာ ဖွင့်နေပါသည်...',
    slowNet1: 'အင်တာနက်လိုင်း စစ်ဆေးနေပါသည်...',
    slowNet2: 'ဒေတာများ ဆွဲယူနေဆဲဖြစ်ပါသည်၊ ခေတ္တစောင့်ဆိုင်းပေးပါ...',
    icon: '✦',
    themeClass: 'loading-theme-default'
  }
};

let currentAppliedLoadingTemplate = null;

export function applyTemplateLoadingTheme(templateId) {
  const loadScreen = document.getElementById('loading-screen');
  if (!loadScreen) return;

  const config = LOADING_THEMES[templateId] || LOADING_THEMES['default'];
  currentAppliedLoadingTemplate = templateId;

  // Swap theme classes
  loadScreen.classList.remove(
    'loading-theme-default',
    'loading-theme-biz-card-gold',
    'loading-theme-floral-pink',
    'loading-theme-neon-birthday'
  );
  if (config.themeClass) {
    loadScreen.classList.add(config.themeClass);
  }

  // Update DOM elements if present
  const badgeEl = document.getElementById('loading-badge');
  if (badgeEl) badgeEl.textContent = config.badge;

  const titleEl = document.getElementById('loading-title');
  if (titleEl) titleEl.textContent = config.title;

  const subEl = document.getElementById('loading-sub-text') || loadScreen.querySelector('.loading-sub');
  if (subEl) subEl.textContent = config.subText;

  const iconEl = document.getElementById('loading-center-icon');
  if (iconEl) iconEl.textContent = config.icon;
}

// ─── Error Screen Display ─────────────────────────────────────────────────────

const ERROR_MESSAGES = {
  'not-found': {
    icon: '🔍',
    title:   'ဖိတ်ကြားလွှာ ရှာမတွေ့ပါ',
    message: 'ဖိတ်ကြားလွှာ URL မှားယွင်းနေပါသည် သို့မဟုတ် ဖိတ်ကြားလွှာ ပိတ်ထားခြင်း ဖြစ်နိုင်ပါသည်။',
    guidance: 'ကျေးဇူးပြု၍ ဖိတ်ကြားသူထံမှ Link သို့မဟုတ် QR Code အသစ်ကို ပြန်လည်စစ်ဆေး ရယူပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။',
    canRetry: false,
  },
  'network-error': {
    icon: '📡',
    title:   'အင်တာနက်လိုင်း ချိတ်ဆက်မှု ခေတ္တနှေးနေပါသည်',
    message: 'အချက်အလက်များကို ဆွဲယူဖွင့်လှစ်ရန် ကြိုးစားနေဆဲဖြစ်ပါသည်။',
    guidance: 'Wi-Fi သို့မဟုတ် Mobile Data ဖွင့်ထားခြင်း ရှိမရှိ စစ်ဆေးပြီး အောက်ပါ ခလုတ်ကို နှိပ်၍ ပြန်လည်ဖွင့်နိုင်ပါသည်။',
    canRetry: true,
  },
  'template-error': {
    icon: '⚡',
    title:   'စာမျက်နှာ ဖွင့်ရန် ခေတ္တစောင့်ဆိုင်းပါ',
    message: 'ကွန်ရက်ချိတ်ဆက်မှု မတည်ငြိမ်သဖြင့် စာမျက်နှာဖွင့်ရန် နှောင့်နှေးနေပါသည်။',
    guidance: 'အင်တာနက်လိုင်း ကောင်းမွန်ပါက အောက်ပါခလုတ်ကို နှိပ်၍ ချက်ချင်း ပြန်လည်ဖွင့်လှစ်နိုင်ပါသည်။',
    canRetry: true,
  },
};

function showError(type) {
  const errScreen   = document.getElementById('error-screen');
  const errIcon     = errScreen ? errScreen.querySelector('.error-icon') : null;
  const errTitle    = document.getElementById('error-title');
  const errMsg      = document.getElementById('error-message');
  const errGuidance = document.getElementById('error-guidance');

  const config = ERROR_MESSAGES[type] ?? ERROR_MESSAGES['network-error'];

  if (errIcon && config.icon) errIcon.textContent = config.icon;
  if (errTitle)    errTitle.textContent    = config.title;
  if (errMsg)      errMsg.textContent      = config.message;
  if (errGuidance) errGuidance.textContent = config.guidance;

  let retryBtn = document.getElementById('error-retry-button');
  if (config.canRetry) {
    if (!retryBtn) {
      retryBtn = document.createElement('button');
      retryBtn.id = 'error-retry-button';
      retryBtn.className = 'error-retry-btn';
      retryBtn.type = 'button';
      const card = errScreen?.querySelector('.error-card') || errScreen;
      card?.appendChild(retryBtn);
    }
    retryBtn.textContent = '🔄 ပြန်လည်ကြိုးစားမည်';
    retryBtn.onclick = () => {
      if (errScreen) errScreen.classList.remove('visible');
      const loadScreen = document.getElementById('loading-screen');
      if (loadScreen) {
        loadScreen.classList.remove('hidden');
        if (currentAppliedLoadingTemplate) {
          applyTemplateLoadingTheme(currentAppliedLoadingTemplate);
        } else {
          const sub = loadScreen.querySelector('.loading-sub');
          if (sub) sub.textContent = 'စာမျက်နှာ ဖွင့်နေပါသည်...';
        }
      }
      initEngine();
    };
    retryBtn.hidden = false;
    retryBtn.style.display = 'inline-flex';
  } else if (retryBtn) {
    retryBtn.hidden = true;
    retryBtn.style.display = 'none';
  }

  if (errScreen) errScreen.classList.add('visible');

  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) loadScreen.classList.add('hidden');
}

function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('hidden');
}

// ─── Customer Data Normalization & Enrichment ─────────────────────────────────

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

  if (data.map_url) {
    const rawMap = String(data.map_url).trim();
    if (rawMap && !/^https?:\/\//i.test(rawMap)) {
      data.map_url = `https://${rawMap}`;
    } else {
      data.map_url = rawMap;
    }
  }

  if (data.website_url) {
    const rawWeb = String(data.website_url).trim();
    if (rawWeb && !/^https?:\/\//i.test(rawWeb)) {
      data.website_url = `https://${rawWeb}`;
    } else {
      data.website_url = rawWeb;
    }
  }

  data.couple_names = [data.groom_name, data.bride_name].filter(Boolean).join(' & ');
  return data;
}

// ─── Shared Utility Box (SDK) for Templates ───────────────────────────────────

const sharedHelpers = {
  toMyanmarNumerals,
  toAsciiNumerals,
  formatWeddingDate,
  formatWeddingDateDots,
  mmMonths: MM_MONTHS,
  mmDays: MM_DAYS,
  calendar: {
    saveToCalendar,
    getGoogleCalendarUrl,
    scheduleWeddingReminder
  },
  wishes: {
    fetchWishesBySlug,
    submitGuestWish
  },
  loadAndCachePhoto
};

// ─── Platform Sponsor & Agency Services Binder ─────────────────────────────────

async function bindPlatformSponsor(container) {
  const cardSponsor = container.querySelector('#card-sponsor');
  if (!cardSponsor) return;

  try {
    let sponsor = await fetchPlatformSponsor(3500);
    if (!sponsor) {
      const fb = await loadFallbackJSON();
      sponsor = fb?.sponsor || null;
    }

    if (!sponsor || sponsor.is_visible === false) {
      cardSponsor.hidden = true;
      cardSponsor.style.display = 'none';
      return;
    }

    // Brand name & tagline
    const brandEl = cardSponsor.querySelector('#sponsor-display-brand');
    const taglineEl = cardSponsor.querySelector('#sponsor-display-tagline');
    if (brandEl) brandEl.textContent = sponsor.brand_name || 'မင်္ဂလာ ဒစ်ဂျစ်တယ် မီဒီယာ စတူဒီယို';
    if (taglineEl) {
      taglineEl.textContent = sponsor.tagline || '';
      taglineEl.style.display = sponsor.tagline ? '' : 'none';
    }

    // Services Offered
    const servicesContainer = cardSponsor.querySelector('#sponsor-services-container');
    if (servicesContainer) {
      if (sponsor.services_text && sponsor.services_text.trim()) {
        const services = sponsor.services_text
          .split(/[•\n\r,]+/)
          .map(s => s.trim())
          .filter(Boolean);

        servicesContainer.innerHTML = services.map(s => `<span class="sponsor-service-pill">✓ ${s}</span>`).join('');
        servicesContainer.style.display = '';
      } else {
        servicesContainer.innerHTML = '';
        servicesContainer.style.display = 'none';
      }
    }

    // Facebook Messenger Primary CTA (Instant Tap-to-Messenger)
    const messengerWrap = cardSponsor.querySelector('#sponsor-messenger-wrapper');
    const messengerBtn = cardSponsor.querySelector('#sponsor-btn-messenger');
    if (messengerWrap && messengerBtn) {
      let mUrl = (sponsor.messenger_url || '').trim();
      if (mUrl) {
        if (!mUrl.startsWith('http')) {
          mUrl = `https://m.me/${mUrl.replace(/^@/, '')}`;
        }
        messengerBtn.href = mUrl;
        messengerWrap.hidden = false;
        messengerWrap.style.display = '';
      } else {
        messengerWrap.hidden = true;
        messengerWrap.style.display = 'none';
      }
    }

    // Social Channels Dynamic Binding (Only show channels filled by Admin)
    const bindLink = (selector, url, prefix = '') => {
      const el = cardSponsor.querySelector(selector);
      if (!el) return;
      const clean = (url || '').trim();
      if (clean) {
        el.href = prefix ? `${prefix}${clean}` : (clean.startsWith('http') ? clean : `https://${clean}`);
        el.hidden = false;
        el.style.display = 'inline-flex';
      } else {
        el.hidden = true;
        el.style.display = 'none';
      }
    };

    // Phone (Tap-to-call)
    const phoneEl = cardSponsor.querySelector('#sponsor-link-phone');
    const phoneLabel = cardSponsor.querySelector('#sponsor-label-phone');
    if (phoneEl) {
      if (sponsor.phone && sponsor.phone.trim()) {
        const rawPhone = sponsor.phone.trim();
        phoneEl.href = `tel:${rawPhone.replace(/[^0-9+]/g, '')}`;
        if (phoneLabel) phoneLabel.textContent = rawPhone;
        phoneEl.hidden = false;
        phoneEl.style.display = 'inline-flex';
      } else {
        phoneEl.hidden = true;
        phoneEl.style.display = 'none';
      }
    }

    bindLink('#sponsor-link-facebook', sponsor.facebook_url);
    bindLink('#sponsor-link-tiktok', sponsor.tiktok_url);
    bindLink('#sponsor-link-viber', sponsor.viber_url, (sponsor.viber_url || '').startsWith('http') || (sponsor.viber_url || '').startsWith('viber:') ? '' : 'viber://chat?number=');
    bindLink('#sponsor-link-telegram', sponsor.telegram_url, (sponsor.telegram_url || '').startsWith('http') || (sponsor.telegram_url || '').startsWith('tg:') ? '' : 'https://t.me/');

    cardSponsor.hidden = false;
    cardSponsor.style.display = '';
  } catch (err) {
    console.warn('[engine.js] Failed to bind platform sponsor:', err);
    cardSponsor.hidden = true;
  }
}

// ─── Active Template Module State ─────────────────────────────────────────────
let activeTemplateModule = null;

// ─── Automated Local Storage Cache Purge & Eviction ──────────────────────────

function checkAndPurgeStaleLocalCaches() {
  try {
    const storedVersion = localStorage.getItem('app_cache_version');
    if (storedVersion !== ASSET_CACHE_VERSION) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('inv_cache_') || key.startsWith('wedding_inv_cache_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('app_cache_version', ASSET_CACHE_VERSION);
      if (keysToRemove.length > 0) {
        console.info(`[engine.js] Purged ${keysToRemove.length} stale invitation cache entries for v${ASSET_CACHE_VERSION}`);
      }
    }
  } catch (_) {}
}

// ─── Main Engine Orchestrator ─────────────────────────────────────────────────

async function initEngine() {
  checkAndPurgeStaleLocalCaches();

  const params  = new URLSearchParams(window.location.search);
  const rawSlug = (params.get('id') || params.get('slug') || window.location.hash.replace(/^#/, '') || '').trim().toLowerCase() || null;
  const urlTemplate = (params.get('t') || params.get('tpl') || params.get('template') || window.__PRE_RESOLVED_TEMPLATE__ || '').trim().toLowerCase() || null;

  // Determine earliest possible template hint (URL param > localStorage cache > fallback match)
  let initialTemplateId = urlTemplate;
  if (!initialTemplateId && rawSlug) {
    try {
      const cached = localStorage.getItem('inv_cache_' + rawSlug) || localStorage.getItem('wedding_inv_cache_' + rawSlug);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.template_id) initialTemplateId = parsed.template_id;
      }
    } catch (_) {}
  }

  if (initialTemplateId) {
    applyTemplateLoadingTheme(initialTemplateId);
  }

  // Progressive loading notifications for slow mobile networks
  const loadingSub = document.getElementById('loading-sub-text') || document.querySelector('.loading-sub');
  const timer1 = setTimeout(() => {
    const activeCfg = LOADING_THEMES[currentAppliedLoadingTemplate] || LOADING_THEMES['default'];
    if (loadingSub) loadingSub.textContent = activeCfg.slowNet1;
  }, 3500);
  const timer2 = setTimeout(() => {
    const activeCfg = LOADING_THEMES[currentAppliedLoadingTemplate] || LOADING_THEMES['default'];
    if (loadingSub) loadingSub.textContent = activeCfg.slowNet2;
  }, 7500);

  // Manual retry button on loading screen if network stalls past 8s
  const timerRetry = setTimeout(() => {
    const loadScreen = document.getElementById('loading-screen');
    if (!loadScreen || loadScreen.classList.contains('hidden')) return;
    let manualRetryBtn = document.getElementById('loading-manual-retry-btn');
    if (!manualRetryBtn) {
      manualRetryBtn = document.createElement('button');
      manualRetryBtn.id = 'loading-manual-retry-btn';
      manualRetryBtn.className = 'error-retry-btn';
      manualRetryBtn.style.marginTop = '1rem';
      manualRetryBtn.type = 'button';
      manualRetryBtn.textContent = '🔄 ပြန်လည်ကြိုးစားမည်';
      manualRetryBtn.addEventListener('click', () => {
        initEngine();
      });
      loadScreen.appendChild(manualRetryBtn);
    }
    manualRetryBtn.style.display = 'inline-block';
  }, 8000);

  const clearLoadingTimers = () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timerRetry);
    const manualBtn = document.getElementById('loading-manual-retry-btn');
    if (manualBtn) manualBtn.remove();
  };

  try {
    const onLiveUpdate = (remoteData) => {
      const container = document.getElementById('template-container');
      if (!container || !container.classList.contains('visible')) return;
      const freshData = enrichCustomerData(remoteData.customer_data);
      bindData(container, freshData);
      updatePageMeta(freshData);
    };

    const onNetworkProgress = ({ attempt }) => {
      if (!loadingSub) return;
      if (attempt === 1) {
        loadingSub.textContent = 'စာမျက်နှာ ဖွင့်နေပါသည်...';
      } else if (attempt === 2) {
        loadingSub.textContent = 'အင်တာနက်လိုင်း စစ်ဆေးနေပါသည် (၁ ကြိမ် ပြန်လည်ကြိုးစားနေပါသည်)...';
      } else if (attempt === 3) {
        loadingSub.textContent = 'ဒေတာများ ဆွဲယူနေဆဲဖြစ်ပါသည်၊ ခေတ္တစောင့်ဆိုင်းပေးပါ...';
      }
    };

    // Parallel preloading: if template was pre-resolved, start loading layout & CSS immediately
    let prefetchPromise = null;
    if (initialTemplateId) {
      prefetchPromise = Promise.all([
        fetch(`templates/${initialTemplateId}/layout.html?v=${ASSET_CACHE_VERSION}`).then(res => res.ok ? res.text() : null).catch(() => null),
        loadTemplateCSS(initialTemplateId)
      ]);
    }

    // Step 1: Multi-tier resolve (Returning visitor returns 0ms instant)
    const invitation = await resolveInvitationData(rawSlug, onLiveUpdate, onNetworkProgress);

    // Step 2: Enrich customer_data
    const data = enrichCustomerData(invitation.customer_data);

    // Step 3: Resolve template ID
    const templateId = (invitation.template_id && invitation.template_id.trim()) ? invitation.template_id.trim() : 'floral-pink';

    // Step 3.1: Synchronize loading screen to exact template theme
    applyTemplateLoadingTheme(templateId);

    // Step 4 & 5: Fetch layout HTML fragment & load template CSS (reuse prefetch if matched)
    let layoutHTML = null;
    if (prefetchPromise && templateId === initialTemplateId) {
      const [prefetchedHTML] = await prefetchPromise;
      layoutHTML = prefetchedHTML;
    }
    if (!layoutHTML) {
      const [fetchedHTML] = await Promise.all([
        fetch(`templates/${templateId}/layout.html?v=${ASSET_CACHE_VERSION}`).then(res => {
          if (!res.ok) throw new Error(`Failed to fetch templates/${templateId}/layout.html`);
          return res.text();
        }),
        loadTemplateCSS(templateId)
      ]);
      layoutHTML = fetchedHTML;
    }

    // Step 6: Inject HTML into template container
    const container = document.getElementById('template-container');
    container.innerHTML = layoutHTML;

    // Step 7: Declarative data binding
    bindData(container, data);

    // Step 7.1: Bind platform sponsor & agency showcase
    await bindPlatformSponsor(container);

    // Step 8: Update page metadata & Open Graph
    updatePageMeta(data);

    // Step 9: Reveal template and dismiss loading screen
    clearLoadingTimers();
    hideLoadingScreen();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.add('visible');
      });
    });

    // Step 10: Global scroll animations
    initScrollAnimations();

    // Step 11: Decoupled Plugin Execution — Dynamically mount template's script.js if present
    try {
      const templateScriptUrl = `../templates/${templateId}/script.js?v=${ASSET_CACHE_VERSION}`;
      const templateModule = await import(templateScriptUrl);

      if (templateModule && typeof templateModule.init === 'function') {
        if (activeTemplateModule && typeof activeTemplateModule.destroy === 'function') {
          activeTemplateModule.destroy();
        }
        activeTemplateModule = templateModule;
        templateModule.init({
          container,
          data,
          helpers: sharedHelpers,
          slug: rawSlug || 'default'
        });
      }
    } catch (pluginErr) {
      // Templates without script.js are fully valid (pure HTML/CSS presentation)
      console.info(`[engine.js] No interactive plugin script for '${templateId}':`, pluginErr.message);
    }

  } catch (err) {
    clearLoadingTimers();
    console.error('[engine.js] Invitation loading exception:', err);

    if (err.code === 'NETWORK_OR_NOT_FOUND') {
      showError('network-error');
      return;
    }

    reportSystemError({
      severity: 'error',
      source: 'engine',
      message: `Engine render failure (${rawSlug || 'default'}): ${err.message || 'Unknown error'}`,
      details: { stack: err.stack, slug: rawSlug, url: window.location.href }
    });

    showError('network-error');
  }
}

// ─── Lifecycle: Handle Tab Visibility ─────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  // If active template has destroy/resume or lifecycle, it can hook into document events
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngine);
} else {
  initEngine();
}
