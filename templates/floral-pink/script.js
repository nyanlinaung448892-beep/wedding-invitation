// =============================================================================
// templates/floral-pink/script.js
// Sweet Pink Romance — Template Interactive Controller & UX Plugin
// Encapsulates all theme-specific animations, interactions, music & guestbook.
// =============================================================================

let pinkAudioCtx = null;
let pinkMusicTimer = null;
let pinkMusicPlaying = false;
let countdownTimerId = null;
let heartIntervalId = null;

const HEART_SYMBOLS = ['❤️', '🌹', '✨', '💕', '🌸', '♥', '💖', '🌷', '🕊️'];

/**
 * Spawns falling hearts into #hearts-container (dynamically created if missing)
 */
function spawnHeart() {
  let container = document.getElementById('hearts-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hearts-container';
    container.setAttribute('aria-hidden', 'true');
    container.setAttribute('role', 'presentation');
    document.body.appendChild(container);
  }

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
  setTimeout(() => el.remove(), (duration + delay + 0.6) * 1000);
}

function startHeartAnimation() {
  if (heartIntervalId) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heartIntervalId = setInterval(spawnHeart, 800);
}

function stopHeartAnimation() {
  if (!heartIntervalId) return;
  clearInterval(heartIntervalId);
  heartIntervalId = null;
}

/**
 * Romantic Melody Synthesizer (Web Audio API)
 */
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
    console.warn('[floral-pink] Audio error:', err);
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

/**
 * Main Template Plugin Initializer
 * @param {Object} options
 * @param {HTMLElement} options.container - Root template DOM element
 * @param {Object} options.data - Customer data
 * @param {Object} options.helpers - Shared utilities from engine
 * @param {string} options.slug - Active URL slug
 */
export function init({ container, data, helpers, slug }) {
  if (!container) return;

  const toMyanmarDigits = helpers?.toMyanmarNumerals || ((v) => String(v));

  // 1. Start ambient falling hearts
  startHeartAnimation();

  // 2. Envelope opening interaction
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

  // 3. Countdown Timer
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

        daysEl.textContent = toMyanmarDigits(String(d).padStart(2, '0'));
        hoursEl.textContent = toMyanmarDigits(String(h).padStart(2, '0'));
        minutesEl.textContent = toMyanmarDigits(String(m).padStart(2, '0'));
        secondsEl.textContent = toMyanmarDigits(String(s).padStart(2, '0'));
        if (statusEl) statusEl.textContent = 'မင်္ဂလာဆောင်မည့်အချိန်အထိ စောင့်မျှော်ရေတွက်မှု 💕';
      } else {
        const elapsed = Math.abs(diff);
        const d = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        const h = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
        const m = Math.floor((elapsed / 1000 / 60) % 60);
        const s = Math.floor((elapsed / 1000) % 60);

        daysEl.textContent = toMyanmarDigits(String(d).padStart(2, '0'));
        hoursEl.textContent = toMyanmarDigits(String(h).padStart(2, '0'));
        minutesEl.textContent = toMyanmarDigits(String(m).padStart(2, '0'));
        secondsEl.textContent = toMyanmarDigits(String(s).padStart(2, '0'));
        if (statusEl) statusEl.textContent = 'မင်္ဂလာဆောင်ခဲ့သည့်နေ့မှ ယနေ့အထိ အမှတ်တရကြာချိန် 💕';
      }
    };
    updateTimer();
    countdownTimerId = setInterval(updateTimer, 1000);
  }

  // 4. Heart love counter & burst
  const heartKey = `pink_heart_count_${slug || 'default'}`;
  let heartCount = parseInt(localStorage.getItem(heartKey) || '139', 10);
  const heartDisplay = container.querySelector('#love-heart-count');
  const loveHeartBtn = container.querySelector('#btn-send-love-heart');

  if (heartDisplay) heartDisplay.textContent = heartCount;

  if (loveHeartBtn) {
    loveHeartBtn.addEventListener('click', () => {
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

  // 5. Guest Wishes (Live Supabase Sync & Persistence)
  const wishesKey = `pink_wishes_${slug || 'default'}`;
  const wishForm = container.querySelector('#pink-guest-wish-form');
  const wishListEl = container.querySelector('#pink-wishes-list');
  const nameInput = container.querySelector('#guest-name-input');
  const msgInput = container.querySelector('#guest-message-input');
  const submitBtn = container.querySelector('#btn-submit-wish');

  const formatWishDate = (val) => {
    if (!val) return 'အခုလေးတင်';
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return String(val);
    const day = toMyanmarDigits(d.getDate());
    const month = (helpers?.mmMonths && helpers.mmMonths[d.getMonth()]) || `${d.getMonth() + 1}`;
    const year = toMyanmarDigits(d.getFullYear());
    return `${day} ${month} ${year}`;
  };

  let wishes = [];
  try {
    const raw = localStorage.getItem(wishesKey);
    wishes = raw ? JSON.parse(raw) : [];
  } catch (_) {
    wishes = [];
  }

  const renderWishes = () => {
    if (!wishListEl) return;
    const esc = (t = '') => String(t).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[c]);

    if (!wishes || wishes.length === 0) {
      wishListEl.innerHTML = `
        <div class="wish-empty-state" style="text-align: center; padding: 1.5rem 1rem; color: var(--pink-text-muted, #8b6b7a); font-size: 0.95rem;">
          <span style="font-size: 1.8rem; display: block; margin-bottom: 0.4rem;">💌</span>
          <p style="margin: 0;">မင်္ဂလာဆုမွန်ကောင်း ဦးဆုံး ပေးပို့လိုက်ပါ 💕</p>
        </div>
      `;
      return;
    }

    wishListEl.innerHTML = wishes.map(w => {
      let displayTime = w.date || w.time;
      if (!displayTime || displayTime === 'မကြာသေးမီက' || displayTime === 'အခုလေးတင်') {
        displayTime = formatWishDate(w.created_at || new Date());
      }
      return `
      <div class="wish-bubble">
        <div class="wish-author">
          <span>💖 ${esc(w.name)}</span>
          <span class="wish-time">${esc(displayTime)}</span>
        </div>
        <p class="wish-message-text">${esc(w.message)}</p>
      </div>
    `;
    }).join('');
  };

  renderWishes();

  // Load live stored wishes from Supabase
  if (helpers?.wishes?.fetchWishesBySlug) {
    helpers.wishes.fetchWishesBySlug(slug).then(remoteWishes => {
      if (Array.isArray(remoteWishes)) {
        wishes = remoteWishes;
        try {
          localStorage.setItem(wishesKey, JSON.stringify(wishes.slice(0, 50)));
        } catch (_) {}
        renderWishes();
      }
    }).catch(err => {
      console.warn('[floral-pink] Fetch wishes notice:', err);
    });
  }

  wishForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput?.value.trim();
    const message = msgInput?.value.trim();

    if (!name || !message) {
      alert('ကျေးဇူးပြု၍ အမည်နှင့် ဆုမွန်ကောင်း စာသားကို ဖြည့်စွက်ပေးပါ။');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>ပေးပို့နေပါသည်… ⏳</span>';
    }

    const now = new Date();
    const formattedDate = formatWishDate(now);
    const newWish = { 
      name, 
      message, 
      date: formattedDate, 
      time: formattedDate, 
      created_at: now.toISOString() 
    };

    // Save to Supabase
    if (helpers?.wishes?.submitGuestWish) {
      try {
        const result = await helpers.wishes.submitGuestWish({ slug, name, message });
        if (result?.data?.id) {
          newWish.id = result.data.id;
        }
      } catch (err) {
        console.warn('[floral-pink] Save wish to Supabase warning:', err);
      }
    }

    wishes.unshift(newWish);
    try {
      localStorage.setItem(wishesKey, JSON.stringify(wishes.slice(0, 50)));
    } catch (_) {}

    renderWishes();
    if (nameInput) nameInput.value = '';
    if (msgInput) msgInput.value = '';

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>ဆုမွန်ကောင်း ပေးပို့မည် ✨</span>';
    }

    for (let i = 0; i < 4; i++) {
      setTimeout(() => spawnPinkBurstHeart(window.innerWidth / 2, window.innerHeight * 0.7), i * 110);
    }
  });

  // 6. Back to top button
  container.querySelector('#btn-pink-back-to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 7. Music Toggle Button
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

  // 8. Calendar & Reminder integration (using backend helpers)
  if (helpers?.calendar) {
    initCalendar(container, data, helpers.calendar);
  }
}

/**
 * Calendar and Reminder Section wiring
 */
function initCalendar(container, data, calendarHelper) {
  const saveBtn     = container.querySelector('#btn-save-to-calendar');
  const gcalLink    = container.querySelector('#btn-google-calendar');
  const reminderBtn = container.querySelector('#btn-set-reminder');
  const statusEl    = container.querySelector('#calendar-status');
  const reminderLbl = container.querySelector('#btn-reminder-label');

  if (!saveBtn) return;

  const calOpts = {
    groomName   : data.groom_name    || '',
    brideName   : data.bride_name    || '',
    weddingDate : data.wedding_date  || '',
    weddingTime : data.wedding_time  || '',
    venueName   : data.venue_name    || '',
    venueAddress: data.venue_address || '',
    mapUrl      : data.map_url       || '',
  };

  function showStatus(message, type = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className   = `calendar-status-msg is-${type}`;
    statusEl.hidden      = false;
    setTimeout(() => {
      statusEl.hidden = true;
      statusEl.className = 'calendar-status-msg';
    }, 6000);
  }

  // 1. Google Calendar link
  if (gcalLink && calOpts.weddingDate) {
    try {
      gcalLink.href = calendarHelper.getGoogleCalendarUrl(calOpts);
    } catch (_) {
      gcalLink.style.display = 'none';
    }
  } else if (gcalLink) {
    gcalLink.style.display = 'none';
  }

  // 2. ICS Download
  saveBtn.addEventListener('click', () => {
    if (!calOpts.weddingDate) {
      showStatus('⚠️ မင်္ဂလာနေ့ရက် သတ်မှတ်မထားသောကြောင့် Calendar ထဲ သိမ်း၍ မရသေးပါ။', 'warning');
      return;
    }

    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;

    setTimeout(() => {
      calendarHelper.saveToCalendar(
        calOpts,
        ({ platform }) => {
          saveBtn.classList.remove('is-loading');
          saveBtn.disabled = false;
          if (platform === 'ios') {
            showStatus('📅 Calendar ဖိုင် ဒေါင်းလုပ် ဆင်းနေပါသည်။ "Files" app မှ .ics ဖိုင်ကို ဖွင့်ပြီး "Add All" ကိုနှိပ်ပါ — ✅ Reminder ပါ အလိုအလျောက် ထည့်ပေးပါလိမ့်မည်။', 'success');
          } else {
            showStatus('📅 .ics ဖိုင် ဒေါင်းလုပ် ဆင်းပြီးပါပြီ — Calendar app တွင် ဖွင့်၍ အလွယ်တကူ သိမ်းဆည်းနိုင်ပါသည်။', 'success');
          }
        },
        (err) => {
          saveBtn.classList.remove('is-loading');
          saveBtn.disabled = false;
          showStatus('❌ Calendar ဖိုင် ထုတ်ယူ၍ မရပါ။ Google Calendar ခလုတ်ကို အသုံးပြုပါ။', 'error');
          console.error('[floral-pink] ICS failed:', err);
        }
      );
    }, 80);
  });

  // 3. Notification Reminder
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

  if (!('Notification' in window)) {
    if (reminderBtn) reminderBtn.style.display = 'none';
  }

  reminderBtn?.addEventListener('click', async () => {
    if (!calOpts.weddingDate) {
      showStatus('⚠️ မင်္ဂလာနေ့ရက် မသတ်မှတ်ရသေးသောကြောင့် Reminder မဖွင့်နိုင်ပါ။', 'warning');
      return;
    }

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
    const result = await calendarHelper.scheduleWeddingReminder({
      ...calOpts,
      venueName: calOpts.venueName,
    });
    reminderBtn.disabled = false;

    if (result === 'granted') {
      reminderSet = true;
      updateReminderBtnState(true);
      showStatus('🔔 Reminder ဖွင့်ပြီးပါပြီ! မင်္ဂလာနေ့ နံနက် ၈ နာရီတွင် Notification ပေးပို့မည်ဖြစ်ပါသည်။', 'success');
    } else if (result === 'denied') {
      showStatus('🚫 Notification ခွင့်ပြုချက် မပေးသောကြောင့် Reminder မဖွင့်နိုင်ပါ။', 'error');
    } else {
      showStatus('⚠️ Reminder မဖွင့်နိုင်ပါ။ Calendar ဖိုင် သိမ်းမည် ခလုတ်ကို အသုံးပြုပါ။', 'warning');
    }
  });
}

/**
 * Cleanup lifecycle hook
 */
export function destroy() {
  stopRomanticTune();
  stopHeartAnimation();
  const container = document.getElementById('hearts-container');
  if (container) container.remove();
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
}
