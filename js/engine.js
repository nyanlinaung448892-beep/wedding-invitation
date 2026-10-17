// =============================================================================
// js/engine.js
// Template Engine — reads ?id=<slug>, fetches invitation from Supabase,
// dynamically loads template HTML + CSS, and binds data attributes.
// Digital Wedding Invitation Platform
// =============================================================================

import { fetchInvitationBySlug } from './supabase-config.js';

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

  // ── data-bind → textContent ───────────────────────────────────────────────
  root.querySelectorAll('[data-bind]').forEach(el => {
    const key   = el.dataset.bind;
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      el.textContent = value;
    } else {
      // Clear placeholder dummy text from template fragment if no data provided
      if (['wedding_date_formatted', 'wedding_time'].includes(key)) {
        el.textContent = '—';
      } else {
        el.textContent = '';
      }
    }
  });

  // ── data-bind-src → img src ───────────────────────────────────────────────
  root.querySelectorAll('[data-bind-src]').forEach(el => {
    const key   = el.dataset.bindSrc;
    const value = data[key];
    const wrapper = el.closest('[data-photo-wrapper]');

    if (value && String(value).trim() !== '') {
      el.src = value;
      el.removeAttribute('data-no-photo');
      if (wrapper) wrapper.removeAttribute('data-no-photo');

      // Gracefully switch to fallback icon if image fails to load (404/offline)
      el.onerror = () => {
        el.setAttribute('data-no-photo', 'true');
        if (wrapper) wrapper.setAttribute('data-no-photo', 'true');
      };
    } else {
      el.setAttribute('data-no-photo', 'true');
      if (wrapper) wrapper.setAttribute('data-no-photo', 'true');
    }
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
    if (prev) prev.remove();

    const link = document.createElement('link');
    link.id   = 'template-stylesheet';
    link.rel  = 'stylesheet';
    link.href = `templates/${templateId}/style.css?v=3`;
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

/**
 * Orchestrates the full template loading pipeline
 */
async function initEngine() {

  // Step 1: Read URL slug
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get('id')?.trim();

  if (!slug) {
    showError('no-slug');
    return;
  }

  // Pre-check network state
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    showError('network-error');
    return;
  }

  try {
    // Step 2: Fetch invitation from Supabase (anon key, RLS: is_active=true only)
    const invitation = await fetchInvitationBySlug(slug);
    if (!invitation) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        showError('network-error');
      } else {
        showError('not-found');
      }
      return;
    }

    // Step 3: Enrich customer_data
    const data = { ...invitation.customer_data };

    // Format date to Myanmar dotted format & traditional format
    data.wedding_date_formatted = formatWeddingDateDots(data.wedding_date) || formatWeddingDate(data.wedding_date);
    data.wedding_date_traditional = formatWeddingDate(data.wedding_date);

    // Compute day of week in Myanmar if not set
    if (data.wedding_date && !data.wedding_day) {
      const d = new Date(`${data.wedding_date}T00:00:00`);
      if (!isNaN(d.getTime())) {
        data.wedding_day = MM_DAYS[d.getDay()];
      }
    }

    // Build tel: href for RSVP button with Myanmar numerals properly converted
    if (data.rsvp_phone) {
      const cleanPhone = toAsciiNumerals(data.rsvp_phone).replace(/[^0-9+]/g, '');
      data.rsvp_phone_href = cleanPhone ? `tel:${cleanPhone}` : '';
    }

    // Build couple display name
    data.couple_names = [data.groom_name, data.bride_name].filter(Boolean).join(' & ');

    // Step 4: Fetch template registry
    const registryRes = await fetch('templates/registry.json?v=3');
    if (!registryRes.ok) throw new Error('Failed to fetch templates/registry.json');

    const registry     = await registryRes.json();
    const templateMeta = registry.find(
      t => t.id === invitation.template_id && t.available === true
    );

    if (!templateMeta) {
      console.error(`[engine.js] Template "${invitation.template_id}" not found or unavailable in registry.`);
      showError('template-error');
      return;
    }

    // Step 5: Fetch template layout HTML fragment
    const layoutRes = await fetch(`templates/${invitation.template_id}/layout.html?v=3`);
    if (!layoutRes.ok) throw new Error(`Failed to fetch templates/${invitation.template_id}/layout.html`);

    const layoutHTML = await layoutRes.text();

    // Step 6: Inject HTML into template container
    const container = document.getElementById('template-container');
    container.innerHTML = layoutHTML;

    // Step 7: Load template-specific CSS
    await loadTemplateCSS(invitation.template_id);

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

    if (invitation.template_id === 'floral-pink') {
      initFloralPinkTheme(container, data, slug);
    }

  } catch (err) {
    console.error('[engine.js] Unexpected error:', err);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showError('network-error');
    } else {
      showError('template-error');
    }
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

// ─── Bootstrap ────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngine);
} else {
  initEngine();
}
