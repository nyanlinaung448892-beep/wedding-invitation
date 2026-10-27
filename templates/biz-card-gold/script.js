// =============================================================================
// templates/biz-card-gold/script.js
// Business Card Mobile Web App — Controller & Interactive Plugin
// Features:
//   - Mobile navigation (Contact, Services, Payments, About)
//   - Strict Conditional Social Channel Rendering (Only display configured URLs)
//   - Interactive FAQ Accordions
//   - vCard (.vcf) Contact Generator & Downloader
//   - Native Web Share & Fallback Clipboard Toast
// =============================================================================

function escapeHTML(str = '') {
  return String(str).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[char]);
}

function showToast(container, message) {
  const toast = container.querySelector('#biz-toast');
  if (!toast) return;
  clearTimeout(toast._hideTimer);
  toast.textContent = message;
  toast.hidden = false;
  toast._hideTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function showEmptyState(element, message) {
  if (!element) return;
  const state = document.createElement('p');
  state.className = 'biz-empty-state';
  state.textContent = message;
  if (typeof element.replaceChildren === 'function') {
    element.replaceChildren(state);
  } else {
    element.innerHTML = '';
    element.appendChild(state);
  }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (_) {}
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

export function generateVCard(data) {
  const escapeVCard = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const company = data.company_name || data.display_title || 'Apex Business Hub';
  const tagline = data.tagline || '';
  const phone = data.rsvp_phone || '';
  const bio = data.message || '';
  const website = data.facebook_url || (typeof window !== 'undefined' ? window.location.href : '');

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(company)}`,
    `ORG:${escapeVCard(company)}`,
    tagline ? `TITLE:${escapeVCard(tagline)}` : '',
    phone ? `TEL;TYPE=WORK,VOICE:${escapeVCard(phone)}` : '',
    website ? `URL:${escapeVCard(website)}` : '',
    bio ? `NOTE:${escapeVCard(bio)}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');
}

export function init({ container, data, helpers, slug }) {
  if (!container) return;

  const bizData = data || {};
  const currentSlug = String(slug || '').trim().toLowerCase() || 'default';

  const aboutCopy = container.querySelector('.biz-about-copy');
  if (aboutCopy && !String(bizData.message || '').trim()) {
    aboutCopy.textContent = 'လုပ်ငန်းမိတ်ဆက် အချက်အလက် မထည့်သွင်းရသေးပါ။';
  }
  const callButton = container.querySelector('#btn-call-hotline');
  if (callButton?.style.display === 'none') {
    container.querySelector('.biz-cta-group')?.classList.add('is-single');
  }
  container.querySelectorAll('[data-bind="stat_rating"], [data-bind="stat_support"]').forEach(value => {
    const stat = value.closest('.biz-stat-item');
    if (stat) stat.hidden = !String(bizData[value.dataset.bind] || '').trim();
  });
  const statLabels = {
    stat_users_label: 'သုံးသပ်ချက်များ',
    stat_rating_label: 'အဆင့်သတ်မှတ်ချက်',
    stat_support_label: 'အကူအညီ'
  };
  Object.entries(statLabels).forEach(([key, fallback]) => {
    const label = container.querySelector(`[data-bind="${key}"]`);
    if (label && !String(bizData[key] || '').trim()) label.textContent = fallback;
  });

  // 1. Setup mobile navigation and keyboard tab behavior
  const tabs = container.querySelectorAll('.biz-tab-btn');
  const panels = container.querySelectorAll('.biz-panel');

  function activateTab(tab, moveFocus = false) {
    const target = tab?.dataset.target;
    if (!target) return;

    tabs.forEach(item => {
      const isActive = item === tab;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach(panel => {
      const isActive = panel.id === `biz-panel-${target}`;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
    if (moveFocus) tab.focus();
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      const index = Array.from(tabs).indexOf(tab);
      let nextIndex = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[nextIndex], true);
    });
  });
  activateTab(container.querySelector('#biz-tab-channels') || tabs[0]);

  // 2. Setup vCard (.vcf) Download
  const vcardBtn = container.querySelector('#btn-save-vcard');
  vcardBtn?.addEventListener('click', () => {
    try {
      const vcardContent = generateVCard(bizData);
      const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `${(bizData.company_name || 'business_contact').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.vcf`;

      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(container, '✅ Contact Card (.vcf) ကို ဖုန်းထဲသို့ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!');
    } catch (err) {
      console.warn('[biz-card-gold] vCard generation error:', err);
      showToast(container, 'ဖုန်းစာအုပ်ထဲ သိမ်းရန် မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။');
    }
  });

  // 3. Strict Conditional Social Channels Rendering (Image 2 Match)
  const channelsContainer = container.querySelector('#biz-channels-list');
  if (channelsContainer) {
    const channelConfigs = [
      {
        key: 'facebook_url',
        name: 'Official Facebook Page',
        subtext: 'နောက်ဆုံးရ ဝန်ဆောင်မှုနှင့် သတင်းများ ကြည့်ရှုရန်',
        iconClass: 'facebook',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 13.5h2.5l1-4H14v-2c0-1.03.54-1.5 1.75-1.5H17.5V2.31C16.88 2.23 15.68 2 14.34 2 11.38 2 9.5 3.77 9.5 7.15v2.35H6v4h3.5V22h4.5v-8.5z"/></svg>'
      },
      {
        key: 'messenger_url',
        name: 'Chat on Messenger',
        subtext: 'သိလိုသည်များကို တိုက်ရိုက်စာပို့ မေးမြန်းရန်',
        iconClass: 'messenger',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.517 3.735 7.188-.184.973-.666 2.502-1.895 3.324-.132.088-.13.284.004.364.55.33 2.158.825 4.305-.333 1.206.335 2.504.52 3.851.52 5.523 0 10-4.146 10-9.258S17.523 2 12 2zm1.096 12.443l-2.616-2.79-5.105 2.79 5.612-5.961 2.684 2.79 5.037-2.79-5.612 5.961z"/></svg>'
      },
      {
        key: 'telegram_url',
        name: 'Business Tools & Invoice Channel',
        subtext: 'Telegram Channel သို့ တိုက်ရိုက်ဝင်ရောက်ရန်',
        iconClass: 'telegram',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.313 4.693c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.281-1.434z"/></svg>'
      },
      {
        key: 'telegram_group_url',
        name: 'Telegram Discussion Group',
        subtext: 'အဖွဲ့ဝင်များနှင့် တိုက်ရိုက်ဆွေးနွေးမေးမြန်းရန်',
        iconClass: 'telegram',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.313 4.693c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.281-1.434z"/></svg>'
      },
      {
        key: 'facebook_group_url',
        name: 'Facebook Community Group',
        subtext: 'လုပ်ငန်းရှင်များ အချင်းချင်း ချိတ်ဆက်ဆွေးနွေးရန်',
        iconClass: 'community',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>'
      },
      {
        key: 'tiktok_url',
        name: 'Official TikTok',
        subtext: 'အသုံးဝင်သော Business Tips ဗီဒီယိုတိုများ',
        iconClass: 'tiktok',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.89 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.32 0 .62.05.91.13V9.41a6.33 6.33 0 0 0-.91-.07A6.34 6.34 0 0 0 3 15.68 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.34-6.32V8.92a8.28 8.28 0 0 0 4.84 1.55v-3.5a4.85 4.85 0 0 1-.93-.28z"/></svg>'
      },
      {
        key: 'viber_url',
        name: 'Viber Direct Contact',
        subtext: 'Viber မှတစ်ဆင့် တိုက်ရိုက် စာပို့ ဆက်သွယ်ရန်',
        iconClass: 'viber',
        iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.8 17.2c-.6 1.7-2.4 2.8-4.2 2.8-1.5 0-3-.5-4.4-1.4-2.6-1.7-4.8-3.9-6.5-6.5C3.8 10.7 3.3 9.2 3.3 7.7c0-1.8 1.1-3.6 2.8-4.2.4-.1.8 0 1.1.2l3 2.5c.3.2.4.6.4.9-.1.6-.5 1.1-.9 1.5-.4.4-.7.9-.7 1.4 0 1 .8 2.3 1.8 3.3 1 1 2.3 1.8 3.3 1.8.5 0 1-.3 1.4-.7.4-.4.9-.8 1.5-.9.3 0 .7.1.9.4l2.5 3c.3.3.4.7.3 1.1zm.2-8.2c-.3 0-.5-.2-.5-.5 0-2.8-2.2-5-5-5-.3 0-.5-.2-.5-.5s.2-.5.5-.5c3.3 0 6 2.7 6 6 0 .3-.2.5-.5.5zm-2.5 0c-.3 0-.5-.2-.5-.5 0-1.4-1.1-2.5-2.5-2.5-.3 0-.5-.2-.5-.5s.2-.5.5-.5c1.9 0 3.5 1.6 3.5 3.5 0 .3-.2.5-.5.5z"/></svg>'
      }
    ];

    let renderedCount = 0;
    channelsContainer.innerHTML = '';

    channelConfigs.forEach(cfg => {
      let rawUrl = String(bizData[cfg.key] || '').trim();
    if (!rawUrl) return;

      // Keep configured links only; convert supported handles to their canonical URLs.
      let finalUrl = rawUrl;
      if (cfg.key === 'messenger_url' && !/^https?:/i.test(rawUrl)) {
        finalUrl = `https://m.me/${rawUrl.replace(/^@/, '')}`;
      } else if ((cfg.key === 'telegram_url' || cfg.key === 'telegram_group_url') && !/^https?:/i.test(rawUrl)) {
        finalUrl = `https://t.me/${rawUrl.replace(/^@/, '')}`;
      } else if (cfg.key === 'viber_url' && !/^viber:/i.test(rawUrl) && !/^https?:/i.test(rawUrl)) {
        const cleanDigits = rawUrl.replace(/[^0-9+]/g, '');
        finalUrl = `viber://chat?number=${cleanDigits}`;
      }

      if (!/^(https?:|viber:)/i.test(finalUrl)) return;

      renderedCount++;
      const item = document.createElement('a');
      item.className = 'biz-channel-item';
      item.href = finalUrl;
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
      item.innerHTML = `
        <div class="channel-logo ${cfg.iconClass}">
          ${cfg.iconSvg}
        </div>
        <div class="channel-details">
          <p class="channel-name">${escapeHTML(cfg.name)}</p>
          <p class="channel-subtext">${escapeHTML(cfg.subtext)}</p>
        </div>
        <span class="channel-arrow" aria-hidden="true">›</span>
      `;
      channelsContainer.appendChild(item);
    });

    if (renderedCount === 0) {
      showEmptyState(channelsContainer, 'ဆက်သွယ်ရန် လမ်းကြောင်းများ မထည့်သွင်းရသေးပါ။ ဖုန်းခေါ်ရန် သို့မဟုတ် ဆက်လက်ကြည့်ရှုရန် လုပ်ငန်းရှင်ထံ တိုက်ရိုက်ဆက်သွယ်ပါ။');
    }
  }

  // 4. Render Dynamic Services
  const servicesContainer = container.querySelector('#biz-services-grid');
  if (servicesContainer) {
    const services = Array.isArray(bizData.services) ? bizData.services.filter(service => service && (service.title || service.desc)) : [];

    if (!services.length) {
      showEmptyState(servicesContainer, 'ဝန်ဆောင်မှုအချက်အလက်များကို မကြာမီ ထည့်သွင်းပေးပါမည်။');
    } else {
      servicesContainer.innerHTML = services.map(s => `
        <article class="biz-service-card">
          <div class="service-icon-box" aria-hidden="true">${escapeHTML(s.icon || '•')}</div>
          <div class="service-info">
            <h3>${escapeHTML(s.title || '')}</h3>
            ${s.desc ? `<p>${escapeHTML(s.desc)}</p>` : ''}
          </div>
        </article>
      `).join('');
    }
  }

  // 5. Active Users Counter & Live Public Reviews System
  const statUsersEl = container.querySelector('#biz-stat-users-val');

  // Parse initial base value from bizData.stat_users (e.g., "500+", "1,200+", "250")
  const rawUsersStr = String(bizData.stat_users || '').trim();
  const rawDigitsMatch = rawUsersStr.replace(/,/g, '').match(/\d+/);
  const baseUsersNum = rawDigitsMatch ? parseInt(rawDigitsMatch[0], 10) : 0;
  const usersSuffix = rawUsersStr.includes('+') ? '+' : '';

  let additionalUsersCount = 0;

  function updateActiveUsersDisplay() {
    if (!statUsersEl) return;
    const totalUsers = baseUsersNum + additionalUsersCount;
    statUsersEl.textContent = totalUsers ? `${totalUsers.toLocaleString()}${usersSuffix}` : '—';
  }

  // Reviews Elements
  const reviewsContainer = container.querySelector('#biz-reviews-list');
  const toggleFormBtn = container.querySelector('#btn-toggle-review-form');
  const formContainer = container.querySelector('#biz-review-form-container');
  const reviewForm = container.querySelector('#biz-review-form');
  const closeFormBtn = container.querySelector('#btn-close-review-form');
  const cancelReviewBtn = container.querySelector('#btn-cancel-review');
  const nameInput = container.querySelector('#biz-reviewer-name');
  const roleInput = container.querySelector('#biz-reviewer-role');
  const msgInput = container.querySelector('#biz-reviewer-msg');
  const errorEl = container.querySelector('#biz-review-form-error');
  const submitBtn = container.querySelector('#btn-submit-review');
  const starsRow = container.querySelector('#biz-rating-stars-row');
  const ratingFeedback = container.querySelector('#biz-rating-text-feedback');

  const reviewsCacheKey = `biz_public_reviews_${currentSlug}`;

  const defaultAdminReviews = Array.isArray(bizData.reviews) ? bizData.reviews : [];

  // Helper to normalize any review (whether admin, cached, or remote from Supabase wishes)
  function normalizeReview(r) {
    let name = String(r.name || 'Anonymous Client').trim();
    let role = String(r.role || '').trim();
    let rating = Number(r.rating) || 5;
    let text = String(r.text || r.message || '').trim();
    let time = String(r.time || r.date || '').trim();

    // Parse JSON payload if stored in message column
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.rating) rating = Math.min(5, Math.max(1, Number(parsed.rating) || 5));
        if (parsed.role) role = String(parsed.role).trim();
        if (parsed.text) text = String(parsed.text).trim();
      } catch (_) {}
    }

    // Parse "(Role)" from name if role not explicit
    if (!role && name.includes('(') && name.endsWith(')')) {
      const match = name.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        name = match[1].trim();
        role = match[2].trim();
      }
    }

    if (!time && r.created_at) {
      try {
        const d = new Date(r.created_at);
        if (!isNaN(d.getTime())) {
          time = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        }
      } catch (_) {}
    }

    return {
      id: String(r.id || `${name}_${text.slice(0, 32)}`),
      name: name || 'Anonymous Client',
      role,
      rating: Math.min(5, Math.max(1, rating)),
      text,
      time: time || 'အခုလေးတင်'
    };
  }

  // Load cached public reviews
  let publicReviews = [];
  try {
    const rawCache = localStorage.getItem(reviewsCacheKey);
    publicReviews = rawCache ? JSON.parse(rawCache).map(normalizeReview) : [];
  } catch (_) {
    publicReviews = [];
  }

  // All combined reviews: public reviews first, followed by admin reviews
  const adminReviews = defaultAdminReviews.map(normalizeReview);
  let allReviews = [...publicReviews, ...adminReviews];
  additionalUsersCount = publicReviews.length;
  updateActiveUsersDisplay();

  function renderReviews() {
    if (!reviewsContainer) return;

    if (!allReviews || allReviews.length === 0) {
      reviewsContainer.innerHTML = '<div class="biz-review-empty"><p>သုံးသပ်ချက် မရှိသေးပါ။ ပထမဆုံး သုံးသပ်ချက်ကို မျှဝေနိုင်ပါသည်။</p></div>';
      return;
    }

    reviewsContainer.innerHTML = allReviews.map(r => {
      const starCount = Math.min(5, Math.max(1, Number(r.rating) || 5));
      const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
      const initial = (r.name || 'C').trim().charAt(0).toUpperCase();

      return `
        <div class="biz-review-card">
          <div class="review-header">
            <div class="reviewer-meta">
              <div class="reviewer-avatar">${escapeHTML(initial)}</div>
              <div class="reviewer-name-role">
                <span class="reviewer-name">${escapeHTML(r.name)}</span>
                ${r.role ? `<span class="reviewer-role">${escapeHTML(r.role)}</span>` : ''}
              </div>
            </div>
            <div class="review-rating-time">
              <span class="review-stars">${stars}</span>
              ${r.time ? `<span class="review-time">${escapeHTML(r.time)}</span>` : ''}
            </div>
          </div>
          <p class="review-body">${escapeHTML(r.text)}</p>
        </div>
      `;
    }).join('');
  }

  renderReviews();

  // Fetch live public reviews from Supabase wishes table
  if (helpers?.wishes?.fetchWishesBySlug) {
    helpers.wishes.fetchWishesBySlug(currentSlug).then(remoteWishes => {
      if (Array.isArray(remoteWishes) && remoteWishes.length > 0) {
        const normalizedRemote = remoteWishes.map(normalizeReview);
        const remoteIds = new Set(normalizedRemote.map(review => review.id));
        const locallyCached = publicReviews.filter(review => !remoteIds.has(review.id));
        publicReviews = [...normalizedRemote, ...locallyCached].slice(0, 50);
        try {
          localStorage.setItem(reviewsCacheKey, JSON.stringify(publicReviews.slice(0, 50)));
        } catch (_) {}

        allReviews = [...publicReviews, ...adminReviews];
        additionalUsersCount = publicReviews.length;
        updateActiveUsersDisplay();
        renderReviews();
      }
    }).catch(err => {
      console.warn('[biz-card-gold] Fetch reviews notice:', err);
    });
  }

  // Star Rating Interaction
  let currentRating = 5;
  const ratingLabels = {
    1: '၁ ကြယ် (တိုးတက်ရန်လို)',
    2: '၂ ကြယ် (သင့်တင့်)',
    3: '၃ ကြယ် (ကောင်းမွန်)',
    4: '၄ ကြယ် (အလွန်ကောင်း)',
    5: '၅ ကြယ် (အထူးကောင်းမွန်)'
  };

  if (starsRow) {
    const starBtns = starsRow.querySelectorAll('.star-btn');
    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10) || 5;
        currentRating = val;
        starBtns.forEach(b => {
          const bVal = parseInt(b.dataset.val, 10);
          b.classList.toggle('is-active', bVal <= val);
          b.setAttribute('aria-pressed', String(bVal <= val));
        });
        if (ratingFeedback) {
          ratingFeedback.textContent = ratingLabels[val] || `${val} ကြယ်`;
        }
      });
    });
  }

  // Toggle Form Visibility
  function openReviewForm() {
    if (!formContainer) return;
    formContainer.hidden = false;
    if (toggleFormBtn) toggleFormBtn.hidden = true;
    if (errorEl) errorEl.hidden = true;
    setTimeout(() => nameInput?.focus(), 80);
  }

  function closeReviewForm() {
    if (!formContainer) return;
    formContainer.hidden = true;
    if (toggleFormBtn) toggleFormBtn.hidden = false;
    if (errorEl) errorEl.hidden = true;
    reviewForm?.reset();
    currentRating = 5;
    if (starsRow) {
      starsRow.querySelectorAll('.star-btn').forEach(b => {
        b.classList.add('is-active');
        b.setAttribute('aria-pressed', 'true');
      });
    }
    if (ratingFeedback) {
      ratingFeedback.textContent = ratingLabels[5];
    }
    toggleFormBtn?.focus();
  }

  toggleFormBtn?.addEventListener('click', openReviewForm);
  closeFormBtn?.addEventListener('click', closeReviewForm);
  cancelReviewBtn?.addEventListener('click', closeReviewForm);

  // Keyboard accessibility: Escape closes form
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && formContainer && !formContainer.hidden) {
      closeReviewForm();
    }
  });

  // Submit Review Form
  reviewForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const nameVal = String(nameInput?.value || '').trim();
    const roleVal = String(roleInput?.value || '').trim();
    const msgVal = String(msgInput?.value || '').trim();

    if (!nameVal) {
      if (errorEl) {
        errorEl.textContent = 'ကျေးဇူးပြု၍ သင့်အမည် သို့မဟုတ် ဆိုင်အမည်ကို ဖြည့်စွက်ပေးပါ။';
        errorEl.hidden = false;
      }
      nameInput?.focus();
      return;
    }

    if (!msgVal) {
      if (errorEl) {
        errorEl.textContent = 'ကျေးဇူးပြု၍ သုံးသပ်ချက် မှတ်ချက်စာသားကို ရေးသားပေးပါ။';
        errorEl.hidden = false;
      }
      msgInput?.focus();
      return;
    }

    const now = new Date();
    const timeFormatted = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    const newReview = {
      id: `local_${Date.now()}`,
      name: nameVal,
      role: roleVal,
      rating: currentRating,
      text: msgVal,
      time: timeFormatted
    };

    // Prepare payload for Supabase wishes table
    const remotePayloadMessage = JSON.stringify({
      rating: currentRating,
      role: roleVal,
      text: msgVal
    });
    const remoteFullName = roleVal ? `${nameVal} (${roleVal})` : nameVal;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'ပေးပို့နေပါသည်…';
    }

    try {
      if (!helpers?.wishes?.submitGuestWish) throw new Error('connection unavailable');
      const result = await helpers.wishes.submitGuestWish({
        slug: currentSlug,
        name: remoteFullName,
        message: remotePayloadMessage
      });
      if (!result?.success) throw new Error(result?.error || 'save failed');
      if (result?.data?.id) newReview.id = String(result.data.id);

      publicReviews = [newReview, ...publicReviews.filter(review => review.id !== newReview.id)].slice(0, 50);
      try {
        localStorage.setItem(reviewsCacheKey, JSON.stringify(publicReviews));
      } catch (_) {}

      allReviews = [...publicReviews, ...adminReviews];
      additionalUsersCount = publicReviews.length;
      updateActiveUsersDisplay();
      renderReviews();
      closeReviewForm();
      showToast(container, 'ကျေးဇူးတင်ပါသည်။ သင့်သုံးသပ်ချက်ကို အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ။');
    } catch (err) {
      console.warn('[biz-card-gold] Save review warning:', err);
      if (errorEl) {
        errorEl.textContent = 'သုံးသပ်ချက်ကို ယခု ပေးပို့၍ မရသေးပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။';
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'သုံးသပ်ချက်ပေးပို့ရန်';
      }
    }
  });

  // 7. Render Dynamic Question & Answer Accordions
  const faqContainer = container.querySelector('#biz-faq-list');
  if (faqContainer) {
    const faqs = Array.isArray(bizData.faq) ? bizData.faq.filter(item => item?.question && item?.answer) : [];

    if (!faqs.length) {
      showEmptyState(faqContainer, 'မေးလေ့ရှိသော မေးခွန်းများ မထည့်သွင်းရသေးပါ။');
    } else {
      faqContainer.innerHTML = faqs.map((f, index) => `
        <div class="biz-faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="biz-faq-answer-${index}" id="biz-faq-trigger-${index}">
            <span>${escapeHTML(f.question)}</span><span class="faq-icon" aria-hidden="true">+</span>
          </button>
          <div class="faq-answer" id="biz-faq-answer-${index}" role="region" aria-labelledby="biz-faq-trigger-${index}">
            <p>${escapeHTML(f.answer)}</p>
          </div>
        </div>
      `).join('');
    }

    // Accordion toggle click listeners
    faqContainer.querySelectorAll('.faq-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.biz-faq-item');
        const isOpen = item.classList.contains('is-open');
        item.classList.toggle('is-open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  // 7. Setup Dynamic Payment Methods
  const paymentsContainer = container.querySelector('#biz-payments-list');
  if (paymentsContainer) {
    const rawPayments = Array.isArray(bizData.biz_payments)
      ? bizData.biz_payments.filter(payment => payment && (payment.bank_name || payment.account_number || payment.account_name))
      : [];

    if (!Array.isArray(rawPayments) || rawPayments.length === 0) {
      showEmptyState(paymentsContainer, 'ငွေပေးချေမှုအချက်အလက်များ မထည့်သွင်းရသေးပါ။ ငွေလွှဲခြင်းမပြုမီ ဆက်သွယ်ရန် tab မှ အတည်ပြုမေးမြန်းပါ။');
    } else {
      paymentsContainer.innerHTML = rawPayments.map(p => {
        const bank = escapeHTML(p.bank_name || 'Payment');
        const rawNumber = String(p.account_number || '').trim();
        const num = escapeHTML(rawNumber || '—');
        const holder = escapeHTML(p.account_name || '—');

        return `
          <div class="biz-payment-card">
            <div class="biz-payment-header">
              <span class="biz-payment-bank">${bank}</span>
              <span class="biz-payment-badge">ငွေလွှဲအကောင့်</span>
            </div>
            <div class="biz-payment-number-row">
              <span class="biz-payment-number">${num}</span>
              <button type="button" class="biz-copy-btn" data-copy-val="${num}" title="အကောင့်နံပါတ် ကူးယူမည်" aria-label="${bank} အကောင့်နံပါတ် ကူးယူရန်" ${rawNumber ? '' : 'disabled'}>
                ကူးယူရန်
              </button>
            </div>
            <div class="biz-payment-holder">
              <span>အကောင့်ပိုင်ရှင်</span>
              <strong>${holder}</strong>
            </div>
          </div>
        `;
      }).join('');

      // 1-Click Clipboard Copy Handler with feedback toast
      paymentsContainer.querySelectorAll('.biz-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const val = btn.dataset.copyVal;
          if (!val || val === '—') return;
          try {
            await copyText(val);
            showToast(container, 'အကောင့်နံပါတ်ကို ကူးယူပြီးပါပြီ။');
          } catch (_) {
            showToast(container, `အကောင့်နံပါတ်: ${val}`);
          }
        });
      });
    }
  }

  // 8. Top Action Buttons
  const shareBtn = container.querySelector('#btn-share-profile');
  shareBtn?.addEventListener('click', async () => {
    const shareData = {
      title: bizData.company_name || 'Apex Business Hub',
      text: `${bizData.company_name || 'Apex Business Hub'} • Digital Profile`,
      url: window.location.href
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share error:', err);
      }
    }

    try {
      await copyText(window.location.href);
      showToast(container, 'ပရိုဖိုင်လင့်ခ်ကို ကူးယူပြီးပါပြီ။');
    } catch (_) {
      showToast(container, `Link: ${window.location.href}`);
    }
  });

}

export function destroy() {
  // Stateless clean up
}
