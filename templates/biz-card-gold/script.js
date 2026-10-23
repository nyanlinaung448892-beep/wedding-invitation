// =============================================================================
// templates/biz-card-gold/script.js
// Apex Business Card (Gold Luxury Hub) — Controller & Interactive Plugin
// Features: 
//   - Tab Switcher (Services, Channels, About)
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
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function generateVCard(data) {
  const company = data.company_name || data.display_title || 'Apex Business Hub';
  const tagline = data.tagline || '';
  const phone = data.rsvp_phone || '';
  const bio = data.message || '';
  const website = data.facebook_url || window.location.href;

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${company}`,
    `ORG:${company}`,
    tagline ? `TITLE:${tagline}` : '',
    phone ? `TEL;TYPE=WORK,VOICE:${phone}` : '',
    website ? `URL:${website}` : '',
    bio ? `NOTE:${bio.replace(/\n/g, ' ')}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');
}

export function init({ container, data }) {
  if (!container) return;

  const bizData = data || {};

  // 1. Setup Tab Switching Logic
  const tabs = container.querySelectorAll('.biz-tab-btn');
  const panels = container.querySelectorAll('.biz-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      tabs.forEach(t => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', String(isActive));
      });
      panels.forEach(p => {
        const isTarget = p.id === `biz-panel-${target}`;
        p.classList.toggle('is-active', isTarget);
        p.hidden = !isTarget;
      });
    });
  });

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
      URL.revokeObjectURL(url);
      showToast(container, '✅ Contact Card (.vcf) ကို ဖုန်းထဲသို့ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!');
    } catch (err) {
      console.warn('[biz-card-gold] vCard generation error:', err);
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
        iconSymbol: '📘'
      },
      {
        key: 'messenger_url',
        name: 'Chat on Messenger',
        subtext: 'သိလိုသည်များကို တိုက်ရိုက်စာပို့ မေးမြန်းရန်',
        iconClass: 'messenger',
        iconSymbol: '💬'
      },
      {
        key: 'telegram_url',
        name: 'Business Tools & Invoice Channel',
        subtext: 'Telegram Channel သို့ တိုက်ရိုက်ဝင်ရောက်ရန်',
        iconClass: 'telegram',
        iconSymbol: '✈️'
      },
      {
        key: 'telegram_group_url',
        name: 'Telegram Discussion Group',
        subtext: 'အဖွဲ့ဝင်များနှင့် တိုက်ရိုက်ဆွေးနွေးမေးမြန်းရန်',
        iconClass: 'telegram',
        iconSymbol: '👥'
      },
      {
        key: 'facebook_group_url',
        name: 'Facebook Community Group',
        subtext: 'လုပ်ငန်းရှင်များ အချင်းချင်း ချိတ်ဆက်ဆွေးနွေးရန်',
        iconClass: 'community',
        iconSymbol: '🤝'
      },
      {
        key: 'tiktok_url',
        name: 'Official TikTok',
        subtext: 'အသုံးဝင်သော Business Tips ဗီဒီယိုတိုများ',
        iconClass: 'tiktok',
        iconSymbol: '🎵'
      }
    ];

    let renderedCount = 0;
    channelsContainer.innerHTML = '';

    channelConfigs.forEach(cfg => {
      let rawUrl = (bizData[cfg.key] || '').trim();
      if (!rawUrl) return;

      // Handle raw usernames or phone numbers for messenger/telegram
      let finalUrl = rawUrl;
      if (cfg.key === 'messenger_url' && !rawUrl.startsWith('http')) {
        finalUrl = `https://m.me/${rawUrl.replace(/^@/, '')}`;
      } else if ((cfg.key === 'telegram_url' || cfg.key === 'telegram_group_url') && !rawUrl.startsWith('http')) {
        finalUrl = `https://t.me/${rawUrl.replace(/^@/, '')}`;
      }

      renderedCount++;
      const item = document.createElement('a');
      item.className = 'biz-channel-item';
      item.href = finalUrl;
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
      item.innerHTML = `
        <div class="channel-logo ${cfg.iconClass}">
          <span>${cfg.iconSymbol}</span>
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
      channelsContainer.innerHTML = `
        <div style="text-align:center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.88rem;">
          <p style="font-size: 1.8rem; margin: 0 0 0.5rem;">🌐</p>
          <p style="margin: 0;">မကြာမီ ဆက်သွယ်ရန် Official Channels များ ထည့်သွင်းပေးပါမည်။</p>
        </div>
      `;
    }
  }

  // 4. Render Dynamic Services
  const servicesContainer = container.querySelector('#biz-services-grid');
  if (servicesContainer) {
    const services = Array.isArray(bizData.services) && bizData.services.length
      ? bizData.services
      : [
          { icon: '🌐', title: 'Web & App Development', desc: 'Modern responsive websites and powerful web applications' },
          { icon: '🎨', title: 'Brand Identity & Design', desc: 'Unique logos, digital business cards, and marketing materials' },
          { icon: '📈', title: 'Digital Marketing & Growth', desc: 'Targeted outreach and online business optimization' }
        ];

    servicesContainer.innerHTML = services.map(s => `
      <div class="biz-service-card">
        <div class="service-icon-box">${escapeHTML(s.icon || '💼')}</div>
        <div class="service-info">
          <h3>${escapeHTML(s.title || '')}</h3>
          <p>${escapeHTML(s.desc || '')}</p>
        </div>
      </div>
    `).join('');
  }

  // 5. Populate HOW WE WORK (3 Steps)
  const hww = Array.isArray(bizData.how_we_work) && bizData.how_we_work.length
    ? bizData.how_we_work
    : [
        { title: 'ဆွေးနွေးခြင်း', desc: 'လုပ်ငန်းလိုအပ်ချက်ကို အသေးစိတ်မေးမြန်းခြင်း' },
        { title: 'တည်ဆောက်ခြင်း', desc: 'စိတ်ကြိုက် ဒီဇိုင်းနှင့် စနစ်များ ရေးဆွဲပေးခြင်း' },
        { title: 'လွှဲပြောင်းခြင်း', desc: 'စမ်းသပ်စစ်ဆေးပြီး အသင့်သုံးနိုင်အောင် ပေးအပ်ခြင်း' }
      ];

  if (container.querySelector('#biz-step1-title')) {
    container.querySelector('#biz-step1-title').textContent = hww[0]?.title || 'ဆွေးနွေးခြင်း';
    container.querySelector('#biz-step1-desc').textContent = hww[0]?.desc || 'လုပ်ငန်းလိုအပ်ချက်ကို အသေးစိတ်မေးမြန်းခြင်း';
    container.querySelector('#biz-step2-title').textContent = hww[1]?.title || 'တည်ဆောက်ခြင်း';
    container.querySelector('#biz-step2-desc').textContent = hww[1]?.desc || 'စိတ်ကြိုက် ဒီဇိုင်းနှင့် စနစ်များ ရေးဆွဲပေးခြင်း';
    container.querySelector('#biz-step3-title').textContent = hww[2]?.title || 'လွှဲပြောင်းခြင်း';
    container.querySelector('#biz-step3-desc').textContent = hww[2]?.desc || 'စမ်းသပ်စစ်ဆေးပြီး အသင့်သုံးနိုင်အောင် ပေးအပ်ခြင်း';
  }

  // 6. Render Dynamic Client Reviews
  const reviewsContainer = container.querySelector('#biz-reviews-list');
  if (reviewsContainer) {
    const reviews = Array.isArray(bizData.reviews) && bizData.reviews.length
      ? bizData.reviews
      : [
          {
            name: 'ကိုအောင်မင်း',
            role: 'Online Shop Owner',
            rating: 5,
            text: 'လုပ်ငန်းရှင်တွေအတွက် ဘောင်ချာနဲ့ စာရင်းဇယား စနစ်တွေ တကယ်ပဲ အဆင်ပြေပြေ သုံးလို့ရပါတယ်။ အထူး ကျေးဇူးတင်ပါတယ်။'
          }
        ];

    reviewsContainer.innerHTML = reviews.map(r => {
      const starCount = Math.min(5, Math.max(1, Number(r.rating) || 5));
      const stars = '★'.repeat(starCount);
      return `
        <div class="biz-review-card">
          <div class="review-header">
            <div>
              <span class="reviewer-name">${escapeHTML(r.name || 'Anonymous Client')}</span>
              ${r.role ? `<span class="reviewer-role"> (${escapeHTML(r.role)})</span>` : ''}
            </div>
            <span class="review-stars">${stars}</span>
          </div>
          <p class="review-body">${escapeHTML(r.text || '')}</p>
        </div>
      `;
    }).join('');
  }

  // 7. Render Dynamic Question & Answer Accordions
  const faqContainer = container.querySelector('#biz-faq-list');
  if (faqContainer) {
    const faqs = Array.isArray(bizData.faq) && bizData.faq.length
      ? bizData.faq
      : [
          {
            question: 'ဝန်ဆောင်မှုများကို မည်သို့ ဆက်သွယ်ရယူနိုင်ပါသလဲ?',
            answer: 'အထက်ပါ Official Channels များမှတစ်ဆင့် Messenger သို့မဟုတ် Telegram သို့ တိုက်ရိုက် စာပို့မေးမြန်း၍ ရယူနိုင်ပါသည်။'
          },
          {
            question: 'ငွေပေးချေမှုပုံစံ မည်သို့ရှိပါသလဲ?',
            answer: 'KBZPay, WavePay, AYA Pay စသည့် Mobile Banking စနစ်များဖြင့် လွယ်ကူလျင်မြန်စွာ ပေးချေနိုင်ပါသည်။'
          }
        ];

    faqContainer.innerHTML = faqs.map(f => `
      <div class="biz-faq-item">
        <button type="button" class="faq-trigger" aria-expanded="false">
          <span>${escapeHTML(f.question || '')}</span>
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
        <div class="faq-answer">
          <p style="margin:0;">${escapeHTML(f.answer || '')}</p>
        </div>
      </div>
    `).join('');

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
      await navigator.clipboard.writeText(window.location.href);
      showToast(container, '✅ Link ကို Clipboard ထဲသို့ ကူးယူပြီးပါပြီ!');
    } catch (_) {
      showToast(container, `Link: ${window.location.href}`);
    }
  });

  const catalogBtn = container.querySelector('#btn-catalog-grid');
  catalogBtn?.addEventListener('click', () => {
    const channelsTab = container.querySelector('#biz-tab-channels');
    channelsTab?.click();
  });

  const themeBtn = container.querySelector('#btn-theme-palette');
  themeBtn?.addEventListener('click', () => {
    showToast(container, '✨ Luxury Amber/Gold Theme Activated');
  });
}

export function destroy() {
  // Stateless clean up
}
