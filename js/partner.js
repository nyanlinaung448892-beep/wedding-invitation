import {
  authenticatePartner,
  fetchPartnerInvitations,
  resolveDisplayTitle,
  resolveInvitationUrl,
  reportSystemError
} from './supabase-config.js';
import {
  renderQrToCanvas,
  downloadQrFile
} from './qr-generator.js';

const SESSION_KEY = 'weddingPartnerSession';
const $ = (selector) => document.querySelector(selector);
const kyat = (amount) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(amount || 0))} MMK`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);

// ─── Partner QR Code Modal Management ─────────────────────────────────────────
let currentPartnerQr = null;

function openPartnerQrModal({ slug, title }) {
  if (!slug) return;
  currentPartnerQr = { slug, title };
  const guestUrl = resolveInvitationUrl(slug);

  $('#qr-modal-title-text').textContent = title || slug;
  $('#qr-modal-url-input').value = guestUrl;
  $('#qr-open-link-btn').href = guestUrl;

  const canvas = $('#qr-modal-canvas');
  if (canvas) {
    renderQrToCanvas(canvas, guestUrl, {
      size: 400,
      margin: 4,
      darkColor: '#1A0A2E',
      lightColor: '#FFFFFF',
      ecc: 'M'
    });
  }

  // Reset resolution radio pills
  const sizeInputs = document.querySelectorAll('input[name="qr-size-select"]');
  sizeInputs.forEach(input => {
    input.checked = input.value === '1024';
    input.closest('.qr-size-pill')?.classList.toggle('is-active', input.value === '1024');
  });

  const modal = $('#qr-modal');
  modal.hidden = false;
  modal.classList.add('is-open');
}

function closePartnerQrModal() {
  const modal = $('#qr-modal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.hidden = true;
  }
  currentPartnerQr = null;
}

function showLoginError(message) { 
  const element = $('#partner-login-error'); 
  element.textContent = message; 
  element.hidden = false; 
  element.focus(); 
}

function setView(isLoggedIn) { 
  $('#partner-login-view').hidden = isLoggedIn; 
  $('#partner-dashboard').hidden = !isLoggedIn; 
}

function displayDate(value) { 
  if (!value) return '—'; 
  const date = new Date(value); 
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date); 
}

function safePartner(partner, passcode) { 
  return { 
    id: partner.id, 
    partner_code: partner.partner_code, 
    shop_name: partner.shop_name, 
    email: partner.email || '',
    phone: partner.phone, 
    default_bonus: partner.default_bonus,
    passcode: passcode
  }; 
}

async function loadPartnerDashboard(session) {
  const statusEl = $('#partner-status');
  statusEl.innerHTML = '<span>Referral စာရင်း ဖွင့်နေပါသည်…</span>';
  
  try {
    const invitations = await fetchPartnerInvitations(session.email, session.partner_code, session.passcode);
    
    const paidList = invitations.filter(inv => inv.bonus_status === 'paid');
    const unpaidList = invitations.filter(inv => inv.bonus_status === 'unpaid');
    
    const totalBonus = invitations.reduce((sum, inv) => sum + Number(inv.bonus_amount || 0), 0);
    const paidBonus = paidList.reduce((sum, inv) => sum + Number(inv.bonus_amount || 0), 0);
    const unpaidBonus = unpaidList.reduce((sum, inv) => sum + Number(inv.bonus_amount || 0), 0);

    $('#partner-shop-name').textContent = session.shop_name;
    $('#partner-code-display').textContent = session.partner_code;
    $('#default-bonus-value').textContent = kyat(session.default_bonus);
    $('#unpaid-bonus-value').textContent = kyat(unpaidBonus);
    $('#paid-bonus-value').textContent = kyat(paidBonus);
    $('#referral-count').textContent = `${invitations.length} ခု (စုစုပေါင်း Bonus: ${kyat(totalBonus)})`;

    $('#referral-list').innerHTML = invitations.length ? invitations.map(invitation => {
      const title = resolveDisplayTitle(invitation);
      const guestUrl = resolveInvitationUrl(invitation.slug);
      const linkHtml = invitation.is_active 
        ? `<div class="link-cell">
            <button type="button" class="copy-icon-btn qr-table-btn" data-referral-qr data-slug="${escapeHTML(invitation.slug)}" data-title="${escapeHTML(title)}" title="QR Code ရယူ / ဒေါင်းလုဒ်ဆွဲမည်">📱 QR</button>
            <a class="invitation-link" href="${escapeHTML(guestUrl)}" target="_blank" rel="noopener">ဖွင့် ↗</a>
           </div>`
        : `<span style="color: #ffd0d0; font-size: 0.85rem;" title="Admin မှ ပိတ်ထားသည်">ပိတ်ထားသည်</span>`;
      return `<tr>
        <td><strong>${escapeHTML(title)}</strong></td>
        <td>${linkHtml}</td>
        <td>${escapeHTML(invitation.template_id)}</td>
        <td>${displayDate(invitation.created_at)}</td>
        <td>${kyat(invitation.bonus_amount)}</td>
        <td><span class="bonus-status ${invitation.bonus_status}">${invitation.bonus_status === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Referral စာရင်း မရှိသေးပါ။</td></tr>';

    $('#paid-history').innerHTML = paidList.length ? paidList.map(invitation => {
      const title = resolveDisplayTitle(invitation);
      return `<article class="paid-item">
        <div>
          <strong>${escapeHTML(title)}</strong>
          <p>${displayDate(invitation.created_at)}</p>
        </div>
        <strong>${kyat(invitation.bonus_amount)}</strong>
      </article>`;
    }).join('') : '<p class="empty-state">ပေးချေပြီး Paid history မရှိသေးပါ။</p>';

    statusEl.textContent = '';
  } catch (err) {
    reportSystemError({
      severity: 'error',
      source: 'partner',
      message: `Partner Dashboard Load Failed: ${err.message}`,
      details: { stack: err.stack, partnerCode: session?.partner_code, email: session?.email }
    });
    statusEl.innerHTML = `<span style="color: #ffd4db;">အချက်အလက်များ ခေတ္တရယူ၍မရသေးပါ — ခေတ္တစောင့်ဆိုင်းပြီး ပြန်လည်ကြိုးစားပေးပါ။ </span> <button type="button" id="partner-retry-btn" class="invitation-link" style="margin-left: 0.5rem; background: none; border: none; cursor: pointer;">ပြန်လည်ကြိုးစားမည်</button>`;
    $('#partner-retry-btn')?.addEventListener('click', () => loadPartnerDashboard(session));
  }
}

$('#partner-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#partner-login-error').hidden = true;
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    showLoginError('Email၊ Partner code နှင့် Password ကို အပြည့်အစုံ ဖြည့်ပေးပါ။');
    form.reportValidity();
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'ဝင်ရောက်နေပါသည်…';
  try {
    const code = form.partner_code.value.trim().toUpperCase();
    const email = form.email.value.trim().toLowerCase();
    const pass = form.passcode.value.trim();
    const partner = await authenticatePartner(email, code, pass);
    if (!partner) {
      showLoginError('Email၊ Partner code သို့မဟုတ် Password မမှန်ပါ။ သေချာစစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။');
      return;
    }
    const session = safePartner(partner, pass);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setView(true);
    await loadPartnerDashboard(session);
  } catch (err) {
    reportSystemError({
      severity: 'error',
      source: 'partner',
      message: `Partner Authentication Exception: ${err.message}`,
      details: { stack: err.stack }
    });
    showLoginError('ဆာဗာချိတ်ဆက်မှု ခေတ္တအဆင်မပြေဖြစ်နေပါသည်။ ခေတ္တစောင့်ဆိုင်းပြီး ထပ်မံကြိုးစားပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'ဝင်ရောက်မည်';
  }
});

$('#partner-logout-button').addEventListener('click', () => { 
  sessionStorage.removeItem(SESSION_KEY); 
  setView(false); 
  $('#partner-login-form').reset(); 
});

// Auto-fill partner code from URL query parameter (e.g. ?code=SHOP-001)
try {
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  if (codeParam && $('#login-partner-code')) {
    $('#login-partner-code').value = codeParam.trim().toUpperCase();
  }
} catch (_) {}

// ─── Clipboard Helper ────────────────────────────────────────────────────────
async function copyToClipboard(text, buttonEl) {
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-999999px';
      ta.style.top = '-999999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      copied = document.execCommand('copy');
      ta.remove();
    }
  } catch (_) {
    copied = false;
  }
  return copied;
}

// ─── Referral Table Event Delegation (QR Modal trigger) ──────────────────────
$('#referral-list')?.addEventListener('click', event => {
  const btn = event.target.closest('[data-referral-qr]');
  if (!btn) return;
  const slug = btn.dataset.slug;
  const title = btn.dataset.title;
  if (slug) {
    openPartnerQrModal({ slug, title });
  }
});

// ─── QR Modal Event Listeners ────────────────────────────────────────────────
$('#close-qr-modal-button')?.addEventListener('click', closePartnerQrModal);
$('#qr-modal')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) closePartnerQrModal();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closePartnerQrModal();
});

// QR Download PNG Handler (Mobile Gallery / Print-Ready)
$('#qr-download-png-btn')?.addEventListener('click', () => {
  if (!currentPartnerQr) return;
  const guestUrl = resolveInvitationUrl(currentPartnerQr.slug);
  const selectedSize = Number(document.querySelector('input[name="qr-size-select"]:checked')?.value || 1024);
  const filename = `QR-${currentPartnerQr.slug}-${selectedSize}px.png`;

  downloadQrFile({
    text: guestUrl,
    filename,
    size: selectedSize,
    format: 'png',
    darkColor: '#1A0A2E',
    lightColor: '#FFFFFF'
  });
});

// QR Download Vector SVG Handler
$('#qr-download-svg-btn')?.addEventListener('click', () => {
  if (!currentPartnerQr) return;
  const guestUrl = resolveInvitationUrl(currentPartnerQr.slug);
  const filename = `QR-${currentPartnerQr.slug}.svg`;

  downloadQrFile({
    text: guestUrl,
    filename,
    format: 'svg',
    darkColor: '#1A0A2E',
    lightColor: '#FFFFFF'
  });
});

// QR Copy URL Handler
$('#qr-modal-copy-btn')?.addEventListener('click', async () => {
  const urlInput = $('#qr-modal-url-input');
  if (!urlInput || !urlInput.value) return;
  const copyBtn = $('#qr-modal-copy-btn');
  const success = await copyToClipboard(urlInput.value, copyBtn);
  if (success) {
    copyBtn.classList.add('is-copied');
    copyBtn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.innerHTML = '📋 Copy';
    }, 1800);
  }
});

// Size selection pill UI update
$('#qr-size-options')?.addEventListener('change', event => {
  const radio = event.target.closest('input[type="radio"]');
  if (!radio) return;
  document.querySelectorAll('#qr-size-options .qr-size-pill').forEach(pill => {
    pill.classList.toggle('is-active', pill.querySelector('input') === radio);
  });
});

try { 
  const saved = sessionStorage.getItem(SESSION_KEY); 
  if (saved) { 
    const session = JSON.parse(saved); 
    if (session?.partner_code && session?.passcode) { 
      setView(true); 
      loadPartnerDashboard(session); 
    } else { 
      setView(false); 
    } 
  } else { 
    setView(false); 
  } 
} catch (_) { 
  sessionStorage.removeItem(SESSION_KEY); 
  setView(false); 
}


