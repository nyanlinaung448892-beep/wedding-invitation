// =============================================================================
// js/engine.js
// Template Engine — Micro-Kernel Host & Decoupled Architecture
// Reads ?id=<slug>, resolves invitation data, injects template HTML + CSS,
// performs declarative data-binding, and mounts the template's interactive plugin.
// 100% Zero-Downtime Architecture — never shows error screen to guests.
// Digital Wedding & Event Invitation Platform
// =============================================================================

import { fetchInvitationBySlug, fetchLatestActiveInvitation, fetchWishesBySlug, submitGuestWish } from './supabase-config.js';
import { saveToCalendar, getGoogleCalendarUrl, scheduleWeddingReminder } from './calendar.js';

// ─── Default Invitation (In-Memory Fallback) ──────────────────────────────────
const DEFAULT_INVITATION = {
  slug        : 'heinthu-aung-pan-ei-phyu-2026',
  template_id : 'floral-pink',
  is_active   : true,
  _isFallbackDefault: true,
  customer_data: {
    groom_name      : 'ဟိန်းသူအောင်',
    bride_name      : 'ပန်းအိဖြူ',
    groom_name_en   : 'Hein Thu Aung',
    bride_name_en   : 'Pann Ei Phyu',
    wedding_date    : '2026-09-13',
    wedding_day     : 'တနင်္ဂနွေနေ့',
    wedding_time    : 'နံနက် ၉:၃၀ နာရီ မှ နေ့လယ် ၁၂:၃၀ နာရီ ထိ',
    venue_name      : 'ဟုတ်ဝမ်မင်္ဂလာခန်းမ',
    venue_address   : 'ကန်လမ်း၊ တောင်ငူမြို့။',
    map_url         : 'https://maps.app.goo.gl/9F1rMzPbByDxeGmh9',
    rsvp_phone      : '09950351292',
    cover_photo_url : 'https://kweylhqnzqnxnopqwrhj.supabase.co/storage/v1/object/public/wedding-media/invitations/heinthu-aung-pan-ei-phyu-2026/cover-1792470392282.webp',
    couple_photo_url: 'https://kweylhqnzqnxnopqwrhj.supabase.co/storage/v1/object/public/wedding-media/invitations/heinthu-aung-pan-ei-phyu-2026/couple-1792470392372.webp',
    message         : '',
  },
};

// ─── Static Fallback JSON cache (loaded once) ─────────────────────────────────
let _fallbackJSON = null;

async function loadFallbackJSON() {
  if (_fallbackJSON) return _fallbackJSON;
  try {
    const res = await fetch('data/fallback-invitations.json?v=10', { cache: 'no-store' });
    if (res.ok) {
      _fallbackJSON = await res.json();
    }
  } catch (_) {
    // If JSON fetch fails, fallback stays null
  }
  return _fallbackJSON;
}

// ─── Multi-Tier Invitation Resolver ──────────────────────────────────────────
/**
 * Resolves invitation data using a 5-tier fallback chain.
 * NEVER throws — always returns an invitation object.
 *
 * Tier 0 — Direct entry (no slug): dynamically fetch latest active invitation from Supabase,
 *          then fall back to fallback JSON / DEFAULT_INVITATION
 * Tier 1 — Supabase live fetch
 * Tier 2 — localStorage cache (Stale-while-revalidate for 0ms load)
 * Tier 3 — Static fallback-invitations.json
 * Tier 4 — In-memory DEFAULT_INVITATION
 *
 * @param {string|null} slug
 * @param {Function|null} onLiveUpdate
 * @returns {Promise<Object>}
 */
async function resolveInvitationData(slug, onLiveUpdate = null) {
  if (!slug) {
    console.info('[engine.js] No slug in URL — fetching latest active invitation from Supabase.');
    try {
      const latest = await fetchLatestActiveInvitation(4000);
      if (latest && latest.customer_data) {
        return latest;
      }
    } catch (_) {}
    const fb = await loadFallbackJSON();
    if (fb?.default) return fb.default;
    return DEFAULT_INVITATION;
  }

  const cleanSlug = String(slug).trim().toLowerCase();
  const cacheKey  = `wedding_inv_cache_${cleanSlug}`;

  // Check local cache first for INSTANT 0ms load
  let cachedData = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cachedData = JSON.parse(raw);
  } catch (_) {}

  if (cachedData) {
    console.info('[engine.js] Instant Load: serving cached data for slug:', cleanSlug);

    // Asynchronously revalidate in background if online
    if (navigator.onLine && typeof onLiveUpdate === 'function') {
      fetchInvitationBySlug(cleanSlug, 4000)
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

  // Tier 1: Supabase live fetch
  try {
    const remoteData = await fetchInvitationBySlug(cleanSlug);
    if (remoteData) {
      try { localStorage.setItem(cacheKey, JSON.stringify(remoteData)); } catch (_) {}
      return remoteData;
    }
  } catch (_) {
    // Network failure — continue to fallback tiers
  }

  // Tier 3: Static fallback-invitations.json
  const fb = await loadFallbackJSON();
  if (fb?.invitations?.[cleanSlug]) {
    console.warn('[engine.js] Supabase unavailable — using fallback JSON for slug:', cleanSlug);
    return fb.invitations[cleanSlug];
  }

  // Tier 4: Ultimate default fallback
  console.warn('[engine.js] Slug not found anywhere — showing default invitation.');
  if (fb?.default) return { ...fb.default, _isFallbackDefault: true };
  return DEFAULT_INVITATION;
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

const PHOTO_CACHE_NAME = 'wedding-invitation-photos-v1';

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
  const displayTitle = data.display_title || data.couple_names || [data.groom_name, data.bride_name].filter(Boolean).join(' & ') || 'ထိမ်းမြားမင်္ဂလာ ဖိတ်ကြားလွှာ';
  const date = data.wedding_date_formatted || '';

  const pageTitle = date ? `${displayTitle} — ${date}` : displayTitle;
  document.title = pageTitle;

  const setMeta = (selector, content) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };

  setMeta('meta[property="og:title"]', pageTitle);
  setMeta('meta[property="og:description"]', data.venue_name ? `${displayTitle} — ${data.venue_name}` : displayTitle);
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
    link.href = `templates/${templateId}/style.css?v=10`;

    link.onload  = () => resolve();
    link.onerror = () => {
      console.warn(`[engine.js] Failed to load CSS for template: ${templateId}`);
      resolve();
    };

    document.head.appendChild(link);
  });
}

// ─── Error Screen Display ─────────────────────────────────────────────────────

const ERROR_MESSAGES = {
  'not-found': {
    title:   'ဖိတ်ကြားလွှာ မရှိတော့ပါ',
    message: 'ဤ URL ကို ရှာမတွေ့ပါ သို့မဟုတ် ဖိတ်ကြားလွှာ ပိတ်ထားသည်။',
    canRetry: false,
  },
  'template-error': {
    title:   'Template ဖွင့်၍ မရပါ',
    message: 'ဖိတ်ကြားလွှာ ဖိုင် ပျောက်ဆုံးနေသည်။',
    canRetry: true,
  },
};

function showError(type) {
  const errScreen = document.getElementById('error-screen');
  const errTitle  = document.getElementById('error-title');
  const errMsg    = document.getElementById('error-message');

  const config = ERROR_MESSAGES[type] ?? ERROR_MESSAGES['not-found'];

  if (errTitle)  errTitle.textContent  = config.title;
  if (errMsg)    errMsg.textContent    = config.message;

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

  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) loadScreen.classList.add('hidden');
}

function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 750);
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

// ─── Active Template Module State ─────────────────────────────────────────────
let activeTemplateModule = null;

// ─── Main Engine Orchestrator ─────────────────────────────────────────────────

async function initEngine() {
  const params  = new URLSearchParams(window.location.search);
  const rawSlug = (params.get('id') || params.get('slug') || window.location.hash.replace(/^#/, '') || '').trim().toLowerCase() || null;

  try {
    const onLiveUpdate = (remoteData) => {
      const container = document.getElementById('template-container');
      if (!container || !container.classList.contains('visible')) return;
      const freshData = enrichCustomerData(remoteData.customer_data);
      bindData(container, freshData);
      updatePageMeta(freshData);
    };

    // Step 1: Multi-tier resolve
    const invitation = await resolveInvitationData(rawSlug, onLiveUpdate);

    // Step 2: Enrich customer_data
    const data = enrichCustomerData(invitation.customer_data);

    // Step 3: Resolve template ID
    const templateId = (invitation.template_id && invitation.template_id.trim()) ? invitation.template_id.trim() : 'floral-pink';

    // Step 4 & 5: Parallel fetch layout HTML fragment & load template CSS
    const [layoutHTML] = await Promise.all([
      fetch(`templates/${templateId}/layout.html?v=10`).then(res => {
        if (!res.ok) throw new Error(`Failed to fetch templates/${templateId}/layout.html`);
        return res.text();
      }),
      loadTemplateCSS(templateId)
    ]);

    // Step 6: Inject HTML into template container
    const container = document.getElementById('template-container');
    container.innerHTML = layoutHTML;

    // Step 7: Declarative data binding
    bindData(container, data);

    // Step 8: Update page metadata & Open Graph
    updatePageMeta(data);

    // Step 9: Reveal template and dismiss loading screen
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
      const templateScriptUrl = `../templates/${templateId}/script.js?v=10`;
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
    console.error('[engine.js] Unexpected error — attempting emergency fallback render:', err);
    try {
      const emergencyLayout = await fetch('templates/floral-pink/layout.html?v=10');
      if (emergencyLayout.ok) {
        const container = document.getElementById('template-container');
        container.innerHTML = await emergencyLayout.text();
        await loadTemplateCSS('floral-pink');
        const data = enrichCustomerData(DEFAULT_INVITATION.customer_data);
        bindData(container, data);
        updatePageMeta(data);
        hideLoadingScreen();
        requestAnimationFrame(() => requestAnimationFrame(() => container.classList.add('visible')));
        initScrollAnimations();

        try {
          const emergencyModule = await import('../templates/floral-pink/script.js?v=10');
          if (emergencyModule && typeof emergencyModule.init === 'function') {
            emergencyModule.init({
              container,
              data,
              helpers: sharedHelpers,
              slug: 'default'
            });
          }
        } catch (_) {}
        return;
      }
    } catch (emergencyErr) {
      console.error('[engine.js] Emergency render failed:', emergencyErr);
    }
    showError('template-error');
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
