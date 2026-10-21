// =============================================================================
// templates/neon-birthday/script.js
// Neon Birthday Celebration — Template Controller & Interactive Plugin
// Encapsulates candle blowing, confetti blast, chime sounds, and guest wishes.
// =============================================================================

let birthdayAudioCtx = null;

function playCelebrationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!birthdayAudioCtx) birthdayAudioCtx = new AudioContext();
    if (birthdayAudioCtx.state === 'suspended') birthdayAudioCtx.resume();

    // Cheerful arpeggio: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = birthdayAudioCtx.createOscillator();
      const gain = birthdayAudioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, birthdayAudioCtx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0, birthdayAudioCtx.currentTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.08, birthdayAudioCtx.currentTime + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, birthdayAudioCtx.currentTime + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(birthdayAudioCtx.destination);

      osc.start(birthdayAudioCtx.currentTime + idx * 0.12);
      osc.stop(birthdayAudioCtx.currentTime + idx * 0.12 + 0.85);
    });
  } catch (err) {
    console.warn('[neon-birthday] Audio error:', err);
  }
}

function spawnConfettiBlast(originX, originY) {
  const symbols = ['🎉', '✨', '🎈', '⭐', '🎊', '💖', '🎂'];
  const count = 18;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'birthday-confetti-particle';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];

    const startX = originX || window.innerWidth / 2;
    const startY = originY || window.innerHeight / 2;

    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * 220 + 80;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 80;
    const rot = (Math.random() - 0.5) * 360;

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.style.setProperty('--rot', `${rot}deg`);

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }
}

/**
 * Main Template Plugin Initializer
 */
export function init({ container, data, helpers, slug }) {
  if (!container) return;

  const toMyanmarDigits = helpers?.toMyanmarNumerals || ((v) => String(v));

  // 1. Blow Candles Interaction
  const blowBtn = container.querySelector('#btn-blow-candles');
  const candleFlames = container.querySelector('#candle-flames');
  const cakeStatus = container.querySelector('#cake-status');

  let candlesBlown = false;

  blowBtn?.addEventListener('click', (e) => {
    candlesBlown = !candlesBlown;
    if (candlesBlown) {
      if (candleFlames) candleFlames.classList.add('blown-out');
      if (cakeStatus) {
        cakeStatus.hidden = false;
        cakeStatus.textContent = 'ဆုမွန်ကောင်းများ အပြည့်အဝ ပြည့်စုံပါစေ! 🥳🎉';
      }
      blowBtn.textContent = '🕯️ ဖယောင်းတိုင် ပြန်ထွန်းမည် ✨';

      const rect = blowBtn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      spawnConfettiBlast(x, y);
      playCelebrationChime();
    } else {
      if (candleFlames) candleFlames.classList.remove('blown-out');
      if (cakeStatus) cakeStatus.hidden = true;
      blowBtn.textContent = '🎂 ဖယောင်းတိုင်မှုတ်မည် & ဆုတောင်းမည် ✨';
    }
  });

  // 2. Calendar Section (Using Backend Helpers)
  if (helpers?.calendar) {
    const saveBtn = container.querySelector('#btn-save-to-calendar');
    const gcalBtn = container.querySelector('#btn-google-calendar');
    const statusEl = container.querySelector('#calendar-status');

    const calOpts = {
      groomName   : data.celebrant_name || data.display_title || 'Birthday Celebration',
      brideName   : '',
      weddingDate : data.wedding_date || data.birth_date || '',
      weddingTime : data.wedding_time || '',
      venueName   : data.venue_name   || '',
      venueAddress: data.venue_address || '',
      mapUrl      : data.map_url      || '',
    };

    if (gcalBtn && calOpts.weddingDate) {
      try {
        gcalBtn.href = helpers.calendar.getGoogleCalendarUrl(calOpts);
      } catch (_) {
        gcalBtn.style.display = 'none';
      }
    } else if (gcalBtn) {
      gcalBtn.style.display = 'none';
    }

    saveBtn?.addEventListener('click', () => {
      if (!calOpts.weddingDate) {
        if (statusEl) {
          statusEl.textContent = '⚠️ မွေးနေ့ရက်စွဲ မသတ်မှတ်ရသေးပါ။';
          statusEl.hidden = false;
        }
        return;
      }
      helpers.calendar.saveToCalendar(
        calOpts,
        () => {
          if (statusEl) {
            statusEl.textContent = '📅 Calendar ဖိုင် ဒေါင်းလုပ် ဆင်းပြီးပါပြီ ✓';
            statusEl.hidden = false;
          }
        },
        () => {
          if (statusEl) {
            statusEl.textContent = '❌ ဒေါင်းလုပ် မအောင်မြင်ပါ။ Google Calendar ကို သုံးပါ။';
            statusEl.hidden = false;
          }
        }
      );
    });
  }

  // 3. Guest Wishes
  const wishesKey = `birthday_wishes_${slug || 'default'}`;
  const wishForm = container.querySelector('#birthday-wish-form');
  const wishListEl = container.querySelector('#birthday-wishes-list');
  const nameInput = container.querySelector('#guest-name-input');
  const msgInput = container.querySelector('#guest-message-input');

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
        <div style="text-align: center; padding: 1.2rem 1rem; color: #a1a1aa; font-size: 0.9rem;">
          <span style="font-size: 1.6rem; display: block; margin-bottom: 0.3rem;">🎉</span>
          <p style="margin: 0;">မွေးနေ့ဆုမွန်ကောင်း ဦးဆုံး ပေးပို့လိုက်ပါ!</p>
        </div>
      `;
      return;
    }

    wishListEl.innerHTML = wishes.map(w => `
      <div class="wish-bubble">
        <div class="wish-author">
          <span>🎈 ${esc(w.name)}</span>
          <span style="opacity:0.7; font-weight:normal;">${esc(w.time || 'အခုလေးတင်')}</span>
        </div>
        <p class="wish-message-text">${esc(w.message)}</p>
      </div>
    `).join('');
  };

  renderWishes();

  if (helpers?.wishes?.fetchWishesBySlug) {
    helpers.wishes.fetchWishesBySlug(slug).then(remoteWishes => {
      if (Array.isArray(remoteWishes)) {
        wishes = remoteWishes;
        try {
          localStorage.setItem(wishesKey, JSON.stringify(wishes.slice(0, 50)));
        } catch (_) {}
        renderWishes();
      }
    }).catch(() => {});
  }

  wishForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput?.value.trim();
    const message = msgInput?.value.trim();
    if (!name || !message) return;

    const newWish = { name, message, time: 'အခုလေးတင်', created_at: new Date().toISOString() };

    if (helpers?.wishes?.submitGuestWish) {
      try {
        const res = await helpers.wishes.submitGuestWish({ slug, name, message });
        if (res?.data?.id) newWish.id = res.data.id;
      } catch (_) {}
    }

    wishes.unshift(newWish);
    try {
      localStorage.setItem(wishesKey, JSON.stringify(wishes.slice(0, 40)));
    } catch (_) {}

    renderWishes();
    if (nameInput) nameInput.value = '';
    if (msgInput) msgInput.value = '';

    const rect = wishForm.getBoundingClientRect();
    spawnConfettiBlast(rect.left + rect.width / 2, rect.top + rect.height / 2);
    playCelebrationChime();
  });
}

/**
 * Cleanup lifecycle hook
 */
export function destroy() {
  if (birthdayAudioCtx && birthdayAudioCtx.state === 'running') {
    birthdayAudioCtx.suspend();
  }
}
