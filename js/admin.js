import {
  getSupabaseClient,
  TABLES,
  STORAGE_BUCKET,
  fetchAllPartners,
  resolveDisplayTitle,
  generatePartnerCode,
  isPartnerCodeAvailable,
  generateUniquePartnerCode,
  resolveInvitationUrl,
  fetchSystemErrorLogs,
  resolveSystemErrorLog,
  clearResolvedErrorLogs,
  fetchPlatformSponsor,
  savePlatformSponsor
} from './supabase-config.js';
import {
  renderQrToCanvas,
  downloadQrFile
} from './qr-generator.js';

const supabase = await getSupabaseClient();

const state = { invitations: [], partners: [], templates: [], errorLogs: [], errorFilter: 'all', severityFilter: 'all', currentErrorItem: null };
const photoRemovals = { cover: false, couple: false, partner: false };
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
const customerFields = [
  'title', 'groom_name', 'bride_name', 'groom_name_en', 'bride_name_en',
  'celebrant_name', 'turning_age', 'company_name', 'tagline', 'website_url',
  'wedding_date', 'wedding_time', 'venue_name', 'venue_address',
  'map_url', 'rsvp_phone', 'message'
];

function updateCategoryFieldVisibility(category = 'wedding') {
  const weddingFields = $('#wedding-fields');
  const birthdayFields = $('#birthday-fields');
  const businessFields = $('#business-fields');

  if (weddingFields) weddingFields.hidden = category !== 'wedding';
  if (birthdayFields) birthdayFields.hidden = category !== 'birthday';
  if (businessFields) businessFields.hidden = category !== 'business';
}

function setView(isAuthenticated) { 
  $('#login-view').hidden = isAuthenticated; 
  $('#dashboard-view').hidden = !isAuthenticated; 
}

function kyat(value) { 
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0)); 
}

function showAlert(selector, message) { 
  const element = $(selector); 
  element.textContent = message; 
  element.hidden = false; 
  element.focus(); 
}

function setStatus(selector, message) { 
  $(selector).textContent = message; 
}

function slugify(value) { 
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); 
}

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

  if (copied && buttonEl) {
    const originalHtml = buttonEl.innerHTML;
    buttonEl.classList.add('is-copied');
    buttonEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
    setTimeout(() => {
      buttonEl.classList.remove('is-copied');
      buttonEl.innerHTML = originalHtml;
    }, 1800);
  }
  return copied;
}

function renderPartnerOptions() {
  $('#partner-code').innerHTML = '<option value="">Partner မသတ်မှတ်ပါ</option>' + state.partners.map(partner => 
    `<option value="${escapeHTML(partner.partner_code)}">${escapeHTML(partner.shop_name)} (${escapeHTML(partner.partner_code)})</option>`
  ).join('');
}

async function loadMetadata() {
  const [templateResponse, partners] = await Promise.all([fetch('templates/registry.json?v=10'), fetchAllPartners()]);
  if (!templateResponse.ok) throw new Error('Template registry ကို ဖတ်၍မရပါ။');
  state.templates = (await templateResponse.json()).filter(template => template.available);
  state.partners = partners;
  $('#template-id').innerHTML = state.templates.map(template => `<option value="${escapeHTML(template.id)}">${escapeHTML(template.name)}</option>`).join('');
  renderPartnerOptions();
}

async function loadInvitations() {
  setStatus('#invitation-status', 'ဖိတ်ကြားလွှာများ ဖွင့်နေပါသည်…');
  const { data, error } = await supabase.from(TABLES.INVITATIONS).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  state.invitations = data || [];
  const basePath = window.location.href.split('admin.html')[0];

  $('#invitation-list').innerHTML = state.invitations.length ? state.invitations.map(invitation => {
    const title = resolveDisplayTitle(invitation);
    const category = invitation.category || 'wedding';
    const guestUrl = resolveInvitationUrl(invitation.slug);
    return `<tr>
      <td><strong>${escapeHTML(title)}</strong></td>
      <td><span class="category-badge ${escapeHTML(category)}">${escapeHTML(category)}</span></td>
      <td><code>${escapeHTML(invitation.slug)}</code></td>
      <td>${escapeHTML(invitation.template_id)}</td>
      <td>${escapeHTML(invitation.partner_code || '—')}</td>
      <td>${kyat(invitation.bonus_amount)}</td>
      <td><span class="bonus-status ${invitation.bonus_status}">${invitation.bonus_status === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
      <td><span class="status-pill ${invitation.is_active ? 'active' : 'inactive'}">${invitation.is_active ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}</span></td>
      <td>
        <div class="link-cell">
          <button type="button" class="copy-icon-btn qr-table-btn" data-invitation-action="qr" data-id="${invitation.id}" title="QR Code ရယူ / ဒေါင်းလုဒ်ဆွဲမည်" aria-label="QR Code">
            📱 QR
          </button>
          <button type="button" class="copy-icon-btn" data-copy-link="${escapeHTML(guestUrl)}" title="Link ကို Copy ကူးမည်" aria-label="Link ကို Copy ကူးမည်">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
          <a class="table-button" href="${escapeHTML(guestUrl)}" target="_blank" rel="noopener" title="ဖိတ်စာအား ဖွင့်ကြည့်ရန်">ဖွင့် ↗</a>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button type="button" class="table-button" data-invitation-action="edit" data-id="${invitation.id}">ပြင်မည်</button>
          <button type="button" class="table-button" data-invitation-action="toggle" data-id="${invitation.id}">${invitation.is_active ? 'ပိတ်မည်' : 'ဖွင့်မည်'}</button>
          <button type="button" class="table-button" style="color: #ffd4db;" data-invitation-action="delete" data-id="${invitation.id}">ဖျက်မည်</button>
        </div>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="10" style="text-align: center; padding: 2rem;">ဖိတ်ကြားလွှာ / Profile မရှိသေးပါ။ “ဖိတ်စာအသစ်” ကိုနှိပ်၍ စတင်ပါ။</td></tr>';
  setStatus('#invitation-status', `${state.invitations.length} ခု ရှိပါသည်။`);
}

function renderPartners() {
  const basePath = window.location.href.split('admin.html')[0];
  $('#partner-list').innerHTML = state.partners.length ? state.partners.map(partner => {
    const partnerUrl = `${basePath}partner.html?code=${encodeURIComponent(partner.partner_code)}`;
    const avatarHtml = partner.profile_url
      ? `<img class="partner-table-avatar" src="${escapeHTML(partner.profile_url)}" alt="${escapeHTML(partner.shop_name)}" loading="lazy">`
      : `<div class="partner-table-avatar-placeholder" title="No photo">🏪</div>`;
    return `<tr>
      <td>
        <div class="partner-shop-cell">
          ${avatarHtml}
          <strong>${escapeHTML(partner.shop_name)}</strong>
        </div>
      </td>
      <td><code>${escapeHTML(partner.partner_code)}</code></td>
      <td><a href="mailto:${escapeHTML(partner.email || '')}" style="color: var(--color-light); text-decoration: underline;">${escapeHTML(partner.email || '—')}</a></td>
      <td>${escapeHTML(partner.city || '—')}</td>
      <td>${escapeHTML(partner.phone || '—')}</td>
      <td>${kyat(partner.default_bonus)}</td>
      <td>
        <div class="link-cell">
          <a class="table-button" href="partner.html?code=${encodeURIComponent(partner.partner_code)}" target="_blank" rel="noopener">ဝင်ရန် ↗</a>
          <button type="button" class="copy-icon-btn" data-copy-link="${escapeHTML(partnerUrl)}" title="Partner Login Link ကို Copy ကူးမည်" aria-label="Partner Login Link Copy ကူးမည်">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button type="button" class="table-button" data-partner-action="edit" data-id="${partner.id}">ပြင်မည်</button>
          <button type="button" class="table-button" style="color: #ffd4db;" data-partner-action="delete" data-id="${partner.id}">ဖျက်မည်</button>
        </div>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Partner မရှိသေးပါ။ “Partner အသစ်” ကိုနှိပ်၍ စတင်ပါ။</td></tr>';
}

async function refreshPartners() { 
  state.partners = await fetchAllPartners(); 
  renderPartnerOptions(); 
  renderPartners(); 
  setStatus('#partner-status', `${state.partners.length} ခု ရှိပါသည်။`); 
}

function setPhotoPreview(previewId, imageUrl = '') { 
  const preview = $(previewId); 
  preview.hidden = !imageUrl; 
  preview.src = imageUrl || ''; 
}

function openInvitationModal(invitation = null) {
  closePartnerModal();
  const el = $('#invitation-modal');
  const form = $('#invitation-form');
  form.reset();
  photoRemovals.cover = false;
  photoRemovals.couple = false;

  $('#form-error-summary').hidden = true;
  $('#invitation-form-title').textContent = invitation ? 'ဖိတ်စာ ပြင်ဆင်ရန်' : 'ဖိတ်စာအသစ်';
  
  if (invitation) {
    const customer = invitation.customer_data || {};
    $('#invitation-id').value = invitation.id;
    customerFields.forEach(key => { 
      if (form.elements[key]) form.elements[key].value = customer[key] || ''; 
    });
    form.elements.title.value = invitation.title || customer.display_title || resolveDisplayTitle(invitation);
    form.elements.category.value = invitation.category || customer.category || 'wedding';
    updateCategoryFieldVisibility(form.elements.category.value);

    form.elements.slug.value = invitation.slug;
    form.elements.slug.dataset.auto = 'false';
    form.elements.template_id.value = invitation.template_id;
    form.elements.partner_code.value = invitation.partner_code || '';
    form.elements.bonus_amount.value = invitation.bonus_amount || 0;
    form.elements.bonus_status.value = invitation.bonus_status || 'unpaid';
    form.elements.is_active.checked = invitation.is_active;

    setPhotoPreview('#cover-preview', customer.cover_photo_url);
    setPhotoPreview('#couple-preview', customer.couple_photo_url);
    $('#remove-cover-photo').hidden = !customer.cover_photo_url;
    $('#remove-couple-photo').hidden = !customer.couple_photo_url;
  } else {
    $('#invitation-id').value = '';
    form.elements.title.value = '';
    form.elements.slug.dataset.auto = 'true';
    const initialTpl = state.templates[0];
    form.elements.template_id.value = initialTpl?.id || '';
    form.elements.category.value = initialTpl?.category || 'wedding';
    updateCategoryFieldVisibility(form.elements.category.value);
    form.elements.bonus_amount.value = 0;
    form.elements.bonus_status.value = 'unpaid';
    form.elements.is_active.checked = true;

    setPhotoPreview('#cover-preview');
    setPhotoPreview('#couple-preview');
    $('#remove-cover-photo').hidden = true;
    $('#remove-couple-photo').hidden = true;
  }
  el.hidden = false;
  el.classList.add('is-open');
  $('#invitation-title').focus();
}

function closeInvitationModal() {
  const el = $('#invitation-modal');
  if (el) {
    el.classList.remove('is-open');
    el.hidden = true;
  }
}

async function openPartnerModal(partner = null) {
  closeInvitationModal();
  const el = $('#partner-modal');
  const form = $('#partner-form');
  form.reset();
  photoRemovals.partner = false;
  $('#partner-form-error').hidden = true;
  const alertBox = $('#partner-code-alert');
  if (alertBox) {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }
  $('#partner-form-title').textContent = partner ? 'Partner ပြင်ဆင်ရန်' : 'Partner အသစ်';
  $('#passcode-optional').hidden = !partner;
  form.elements.passcode.required = !partner;

  const regenBtn = $('#regenerate-partner-code-btn');
  const copyBtn = $('#copy-partner-modal-code-btn');
  if (copyBtn) {
    copyBtn.classList.remove('is-copied');
    copyBtn.innerHTML = '📋 Copy';
  }

  const previewImg = $('#partner-profile-preview');
  const previewPlaceholder = $('#partner-avatar-preview-placeholder');
  const removePhotoBtn = $('#remove-partner-profile-photo');
  const photoInput = $('#partner-profile-photo');
  if (photoInput) photoInput.value = '';

  if (partner) {
    form.elements.id.value = partner.id;
    form.elements.shop_name.value = partner.shop_name;
    form.elements.partner_code.value = partner.partner_code;
    form.elements.partner_code.dataset.originalCode = partner.partner_code;
    form.elements.email.value = partner.email || '';
    form.elements.city.value = partner.city || '';
    form.elements.phone.value = partner.phone || '';
    form.elements.default_bonus.value = partner.default_bonus || 0;
    if (regenBtn) regenBtn.textContent = '🔄 Code အသစ်ပြောင်းမည်';

    if (partner.profile_url) {
      if (previewImg) { previewImg.src = partner.profile_url; previewImg.hidden = false; }
      if (previewPlaceholder) previewPlaceholder.hidden = true;
      if (removePhotoBtn) removePhotoBtn.hidden = false;
    } else {
      if (previewImg) { previewImg.src = ''; previewImg.hidden = true; }
      if (previewPlaceholder) previewPlaceholder.hidden = false;
      if (removePhotoBtn) removePhotoBtn.hidden = true;
    }
  } else {
    form.elements.id.value = '';
    form.elements.email.value = '';
    form.elements.city.value = '';
    form.elements.partner_code.dataset.originalCode = '';
    if (regenBtn) regenBtn.textContent = '🔄 အသစ်ထုတ်မည်';
    form.elements.partner_code.value = '…';
    const newCode = await generateUniquePartnerCode(8);
    form.elements.partner_code.value = newCode;

    if (previewImg) { previewImg.src = ''; previewImg.hidden = true; }
    if (previewPlaceholder) previewPlaceholder.hidden = false;
    if (removePhotoBtn) removePhotoBtn.hidden = true;
  }
  el.hidden = false;
  el.classList.add('is-open');
  $('#shop-name').focus();
}

function closePartnerModal() {
  const el = $('#partner-modal');
  if (el) {
    el.classList.remove('is-open');
    el.hidden = true;
  }
}

// ─── QR Code Modal Management ────────────────────────────────────────────────
let currentQrInvitation = null;

function openQrModal(invitation) {
  if (!invitation) return;
  currentQrInvitation = invitation;
  closeInvitationModal();
  closePartnerModal();

  const title = resolveDisplayTitle(invitation);
  const guestUrl = resolveInvitationUrl(invitation.slug);

  $('#qr-modal-title-text').textContent = title;
  $('#qr-modal-url-input').value = guestUrl;
  $('#qr-open-link-btn').href = guestUrl;

  const canvas = $('#qr-modal-canvas');
  if (canvas) {
    renderQrToCanvas(canvas, guestUrl, {
      size: 400,
      margin: 4,
      darkColor: '#000000',
      lightColor: '#FFFFFF',
      ecc: 'Q'
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

function closeQrModal() {
  const modal = $('#qr-modal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.hidden = true;
  }
  currentQrInvitation = null;
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); 
    reader.onerror = () => reject(new Error('ဓာတ်ပုံဖိုင်ကို ဖတ်၍မရပါ။'));
    reader.onload = () => { 
      const image = new Image(); 
      image.onerror = () => reject(new Error('ရွေးထားသောဖိုင်သည် မှန်ကန်သော ဓာတ်ပုံမဟုတ်ပါ။'));
      image.onload = () => { 
        // 1080px is optimal for mobile retina display while reducing bandwidth by ~75%
        const maxDimension = 1080; 
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height)); 
        const canvas = document.createElement('canvas'); 
        canvas.width = Math.round(image.width * scale); 
        canvas.height = Math.round(image.height * scale); 
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height); 

        // Detect if browser supports WebP canvas export
        const isWebpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const targetType = isWebpSupported ? 'image/webp' : 'image/jpeg';
        const targetExt  = isWebpSupported ? 'webp' : 'jpg';
        const quality    = 0.82;

        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('ဓာတ်ပုံအရွယ်အစားလျှော့၍မရပါ။'));
          resolve({ blob, contentType: targetType, extension: targetExt });
        }, targetType, quality);
      }; 
      image.src = reader.result; 
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(file, slug, kind) {
  if (!file) return ''; 
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG သို့မဟုတ် WebP ဓာတ်ပုံကိုသာ ရွေးပါ။');
  const { blob, contentType, extension } = await resizeImage(file); 
  const path = `invitations/${slug}/${kind}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { 
    contentType: contentType, 
    cacheControl: '31536000',
    upsert: false 
  }); 
  if (error) throw new Error(`ဓာတ်ပုံ upload မအောင်မြင်ပါ — ${error.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadPartnerPhoto(file, partnerCode) {
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG သို့မဟုတ် WebP ဓာတ်ပုံကိုသာ ရွေးပါ။');
  const { blob, contentType, extension } = await resizeImage(file);
  const path = `partners/${partnerCode}/profile-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: contentType,
    cacheControl: '31536000',
    upsert: false
  });
  if (error) throw new Error(`Partner profile photo upload မအောင်မြင်ပါ — ${error.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function saveInvitation(event) {
  event.preventDefault(); 
  const form = event.currentTarget; 
  $('#form-error-summary').hidden = true;
  if (!form.checkValidity()) { 
    showAlert('#form-error-summary', 'လိုအပ်သော အချက်အလက်များကို မှန်ကန်စွာ ဖြည့်ပေးပါ။'); 
    form.reportValidity(); 
    return; 
  }
  const formData = new FormData(form); 
  const id = formData.get('id'); 
  const slug = String(formData.get('slug')).trim(); 
  const customerData = Object.fromEntries(customerFields.map(key => [key, String(formData.get(key) || '').trim()])); 
  const existing = state.invitations.find(item => item.id === id)?.customer_data || {};
  
  let coverPhotoUrl = photoRemovals.cover ? '' : (existing.cover_photo_url || '');
  let couplePhotoUrl = photoRemovals.couple ? '' : (existing.couple_photo_url || '');

  const button = $('#save-invitation-button'); 
  button.disabled = true; 
  button.textContent = 'သိမ်းနေပါသည်…';

  try {
    const [uploadedCover, uploadedCouple] = await Promise.all([
      uploadPhoto(form.elements.cover_photo.files[0], slug, 'cover'),
      uploadPhoto(form.elements.couple_photo.files[0], slug, 'couple')
    ]);

    if (uploadedCover) coverPhotoUrl = uploadedCover;
    if (uploadedCouple) couplePhotoUrl = uploadedCouple;

    customerData.cover_photo_url = coverPhotoUrl;
    customerData.couple_photo_url = couplePhotoUrl;

    const title = String(formData.get('title') || '').trim() || resolveDisplayTitle({ customer_data: customerData });
    const category = String(formData.get('category') || 'wedding').trim();
    customerData.display_title = title;
    customerData.category = category;

    const record = { 
      slug, 
      template_id: formData.get('template_id'), 
      customer_data: customerData, 
      partner_code: formData.get('partner_code') || null, 
      bonus_amount: Number(formData.get('bonus_amount') || 0), 
      bonus_status: formData.get('bonus_status'), 
      is_active: formData.get('is_active') === 'on' 
    };

    const { error } = await (id ? supabase.from(TABLES.INVITATIONS).update(record).eq('id', id) : supabase.from(TABLES.INVITATIONS).insert(record)); 
    if (error) throw error;

    closeInvitationModal(); 
    await loadInvitations(); 
    try {
      localStorage.removeItem(`wedding_inv_cache_${slug}`);
    } catch (_) {}
    setStatus('#invitation-status', id ? 'ဖိတ်စာကို ပြင်ဆင်ပြီးပါပြီ။' : 'ဖိတ်စာအသစ် ဖန်တီးပြီးပါပြီ။');
  } catch (error) { 
    showAlert('#form-error-summary', error.code === '23505' ? 'ဤ Slug ကို အသုံးပြုထားပြီးဖြစ်သည်။' : error.message || 'သိမ်း၍မရပါ။'); 
  } finally { 
    button.disabled = false; 
    button.textContent = 'သိမ်းမည်'; 
  }
}

async function savePartner(event) {
  event.preventDefault(); 
  const form = event.currentTarget; 
  $('#partner-form-error').hidden = true;
  if (!form.checkValidity()) { 
    showAlert('#partner-form-error', 'လိုအပ်သော အချက်အလက်များကို မှန်ကန်စွာ ဖြည့်ပေးပါ။'); 
    form.reportValidity(); 
    return; 
  }
  const formData = new FormData(form); 
  const id = formData.get('id'); 
  const existing = state.partners.find(item => item.id === id); 
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) {
    showAlert('#partner-form-error', 'Email ဖြည့်သွင်းရန် လိုအပ်ပါသည်။');
    return;
  }
  const partnerCode = String(form.elements.partner_code.value || formData.get('partner_code') || '').trim().toUpperCase();
  if (!partnerCode || !/^[A-Z0-9]{8}$/.test(partnerCode)) {
    showAlert('#partner-form-error', 'Partner Code သည် အင်္ဂလိပ်စာလုံးကြီးနှင့် ဂဏန်း ၈ လုံး ဖြစ်ရပါမည် (ဥပမာ K7M9P2X4)။');
    return;
  }

  // Check code availability if new partner or if code was changed
  if (!existing || existing.partner_code !== partnerCode) {
    const isAvailable = await isPartnerCodeAvailable(partnerCode);
    if (!isAvailable) {
      showAlert('#partner-form-error', `Partner Code "${partnerCode}" ကို အခြား Partner မှ သုံးစွဲထားပြီးဖြစ်သည်။ ကုဒ်အသစ် ပြန်လည်ထုတ်ယူပေးပါ။`);
      return;
    }
  }

  const city = String(formData.get('city') || '').trim();
  if (!city) {
    showAlert('#partner-form-error', 'ဆိုင်တည်ရှိရာ မြို့နယ် (City) ဖြည့်သွင်းရန် လိုအပ်ပါသည်။');
    return;
  }

  let profileUrl = photoRemovals.partner ? '' : (existing?.profile_url || '');

  const button = $('#save-partner-button'); 
  button.disabled = true; 
  button.textContent = 'သိမ်းနေပါသည်…'; 

  const photoFile = form.elements.profile_photo?.files?.[0];
  if (photoFile) {
    try {
      const uploadedUrl = await uploadPartnerPhoto(photoFile, partnerCode);
      if (uploadedUrl) profileUrl = uploadedUrl;
    } catch (uploadErr) {
      button.disabled = false;
      button.textContent = 'သိမ်းမည်';
      showAlert('#partner-form-error', uploadErr.message);
      return;
    }
  }

  const record = { 
    shop_name: String(formData.get('shop_name')).trim(), 
    partner_code: partnerCode, 
    email: email,
    city: city,
    profile_url: profileUrl,
    phone: String(formData.get('phone') || '').trim() || null, 
    default_bonus: Number(formData.get('default_bonus') || 0) 
  };
  const passcode = String(formData.get('passcode') || '').trim(); 
  if (passcode) record.passcode = passcode; 

  const { error } = await (id ? supabase.from(TABLES.PARTNERS).update(record).eq('id', id) : supabase.from(TABLES.PARTNERS).insert(record)); 
  button.disabled = false; 
  button.textContent = 'သိမ်းမည်';

  if (error) { 
    const msg = error.code === '23505'
      ? (error.message?.includes('email') ? 'ဤ Email ကို အသုံးပြုထားပြီးဖြစ်သည်။' : 'ဤ Partner code ကို အသုံးပြုထားပြီးဖြစ်သည်။')
      : `သိမ်း၍မရပါ — ${error.message}`;
    showAlert('#partner-form-error', msg); 
    return; 
  }
  closePartnerModal(); 
  await refreshPartners(); 
  await loadInvitations();
  setStatus('#partner-status', id ? 'Partner ကို ပြင်ဆင်ပြီးပါပြီ။' : 'Partner အသစ် ဖန်တီးပြီးပါပြီ။');
}

async function toggleInvitation(id) { 
  const invitation = state.invitations.find(item => item.id === id); 
  if (!invitation) return; 
  const { error } = await supabase.from(TABLES.INVITATIONS).update({ is_active: !invitation.is_active }).eq('id', id); 
  if (error) { 
    setStatus('#invitation-status', `အခြေအနေပြောင်း၍မရပါ — ${error.message}`); 
    return; 
  } 
  await loadInvitations(); 
}

async function deleteInvitation(id) {
  const invitation = state.invitations.find(item => item.id === id);
  if (!invitation) return;
  const couple = [invitation.customer_data?.groom_name, invitation.customer_data?.bride_name].filter(Boolean).join(' & ') || invitation.slug;
  if (!window.confirm(`“${couple}” ၏ ဖိတ်စာ (${invitation.slug}) ကို အပြီးဖျက်မည်မှာ သေချာပါသလား?`)) return;

  setStatus('#invitation-status', 'ဖိတ်စာကို ဖျက်နေပါသည်…');
  const { error } = await supabase.from(TABLES.INVITATIONS).delete().eq('id', id);
  if (error) {
    setStatus('#invitation-status', `ဖျက်၍မရပါ — ${error.message}`);
    return;
  }
  await loadInvitations();
  setStatus('#invitation-status', 'ဖိတ်စာကို ဖျက်ပြီးပါပြီ။');
}

async function deletePartner(id) { 
  const partner = state.partners.find(item => item.id === id); 
  if (!partner) return; 
  const referrals = state.invitations.filter(invitation => invitation.partner_code === partner.partner_code); 
  if (referrals.length) { 
    setStatus('#partner-status', 'ဤ Partner ကို ဖိတ်စာများက အသုံးပြုထားသောကြောင့် ဖျက်၍မရပါ။ Partner အချက်အလက်ကို ပြင်ဆင်နိုင်ပါသည်။'); 
    return; 
  } 
  if (!window.confirm(`Partner ဆိုင် “${partner.shop_name}” ကို ဖျက်မည်မှာ သေချာပါသလား?`)) return; 
  const { error } = await supabase.from(TABLES.PARTNERS).delete().eq('id', id); 
  if (error) { 
    setStatus('#partner-status', `ဖျက်၍မရပါ — ${error.message}`); 
    return; 
  } 
  await refreshPartners(); 
  setStatus('#partner-status', 'Partner ကို ဖျက်ပြီးပါပြီ။'); 
}

function previewSelectedPhoto(inputId, previewId, removeBtnId, kind) { 
  $(inputId).addEventListener('change', event => { 
    const file = event.target.files[0]; 
    if (!file) return; 
    if (!file.type.startsWith('image/')) { 
      showAlert('#form-error-summary', 'ဓာတ်ပုံဖိုင်ကိုသာ ရွေးပါ။'); 
      event.target.value = ''; 
      return; 
    } 
    photoRemovals[kind] = false;
    const reader = new FileReader(); 
    reader.onload = () => {
      setPhotoPreview(previewId, reader.result);
      if ($(removeBtnId)) $(removeBtnId).hidden = false;
    }; 
    reader.readAsDataURL(file); 
  }); 
}

function displayDateWithTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function activateTab(tabName) { 
  const invitations = tabName === 'invitations'; 
  const partners = tabName === 'partners';
  const errors = tabName === 'errors';
  const sponsor = tabName === 'sponsor';

  $('#invitations-tab').classList.toggle('is-active', invitations); 
  $('#invitations-tab').setAttribute('aria-selected', String(invitations)); 
  $('#invitations-panel').hidden = !invitations; 

  $('#partners-tab').classList.toggle('is-active', partners); 
  $('#partners-tab').setAttribute('aria-selected', String(partners)); 
  $('#partners-panel').hidden = !partners; 

  $('#errors-tab')?.classList.toggle('is-active', errors);
  $('#errors-tab')?.setAttribute('aria-selected', String(errors));
  $('#errors-panel').hidden = !errors;

  $('#sponsor-tab')?.classList.toggle('is-active', sponsor);
  $('#sponsor-tab')?.setAttribute('aria-selected', String(sponsor));
  $('#sponsor-panel').hidden = !sponsor;

  if (errors) {
    loadErrorLogs();
  } else if (sponsor) {
    loadSponsorForm();
  }
} 

async function loadSponsorForm() {
  setStatus('#sponsor-status', 'Sponsor အချက်အလက်များ ရယူနေပါသည်…');
  try {
    const sponsor = await fetchPlatformSponsor();
    if (sponsor) {
      $('#sponsor-brand-name').value = sponsor.brand_name || '';
      $('#sponsor-tagline').value = sponsor.tagline || '';
      $('#sponsor-services-text').value = sponsor.services_text || '';
      $('#sponsor-phone').value = sponsor.phone || '';
      $('#sponsor-messenger-url').value = sponsor.messenger_url || '';
      $('#sponsor-facebook-url').value = sponsor.facebook_url || '';
      $('#sponsor-tiktok-url').value = sponsor.tiktok_url || '';
      $('#sponsor-viber-url').value = sponsor.viber_url || '';
      $('#sponsor-telegram-url').value = sponsor.telegram_url || '';
      $('#sponsor-is-visible').checked = sponsor.is_visible !== false;
    }
    setStatus('#sponsor-status', '');
  } catch (err) {
    setStatus('#sponsor-status', '');
    showAlert('#sponsor-alert', `Sponsor data ရယူရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်သည် — ${err.message}`);
  }
} 

async function initialiseDashboard() { 
  try { 
    await loadMetadata(); 
    await Promise.all([loadInvitations(), refreshPartners(), loadErrorLogs()]); 
  } catch (error) { 
    setStatus('#invitation-status', `Dashboard data ဖွင့်၍မရပါ — ${error.message}`); 
  } 
} 

// ─── Error Management Functions (Phase 8) ────────────────────────────────────

async function loadErrorLogs() {
  setStatus('#error-status', 'Error logs များကို ရယူနေပါသည်…');
  try {
    const logs = await fetchSystemErrorLogs({ limit: 150 });
    state.errorLogs = logs;
    updateErrorStats();
    renderErrorLogs();
    setStatus('#error-status', '');
  } catch (err) {
    setStatus('#error-status', `Error logs ဖွင့်၍မရပါ — ${err.message}`);
  }
}

function updateErrorStats() {
  const allCount = state.errorLogs.length;
  const unresolvedCount = state.errorLogs.filter(l => !l.is_resolved).length;
  const resolvedCount = state.errorLogs.filter(l => l.is_resolved).length;

  if ($('#count-all-errors')) $('#count-all-errors').textContent = allCount;
  if ($('#count-unresolved-errors')) $('#count-unresolved-errors').textContent = unresolvedCount;
  if ($('#count-resolved-errors')) $('#count-resolved-errors').textContent = resolvedCount;

  const badge = $('#error-badge');
  if (badge) {
    if (unresolvedCount > 0) {
      badge.textContent = unresolvedCount > 99 ? '99+' : unresolvedCount;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

function renderErrorLogs() {
  const container = $('#error-list');
  if (!container) return;

  let filtered = [...state.errorLogs];
  if (state.errorFilter === 'unresolved') {
    filtered = filtered.filter(item => !item.is_resolved);
  } else if (state.errorFilter === 'resolved') {
    filtered = filtered.filter(item => item.is_resolved);
  }

  if (state.severityFilter && state.severityFilter !== 'all') {
    filtered = filtered.filter(item => item.severity === state.severityFilter);
  }

  if (!filtered.length) {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--color-primary-light);">
      ${state.errorLogs.length ? 'ရွေးချယ်ထားသော filter နှင့် ကိုက်ညီသည့် Error မရှိပါ။' : '🎉 ချို့ယွင်းချက် Error log များ မရှိပါ။ စနစ်ကောင်းမွန်စွာ လည်ပတ်နေပါသည်။'}
    </td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const sevIcon = item.severity === 'critical' ? '🔴' : item.severity === 'error' ? '🟠' : item.severity === 'warning' ? '🟡' : '🔵';
    const cleanRoute = item.url ? item.url.replace(/^https?:\/\/[^/]+/i, '') : '—';
    const timeStr = displayDateWithTime(item.created_at);

    return `<tr>
      <td><span class="severity-badge ${escapeHTML(item.severity)}">${sevIcon} ${escapeHTML(item.severity)}</span></td>
      <td><span class="source-tag">${escapeHTML(item.source)}</span></td>
      <td><div class="error-msg-cell" title="${escapeHTML(item.message)}">${escapeHTML(item.message)}</div></td>
      <td><code class="code-pill">${escapeHTML(cleanRoute || '/')}</code></td>
      <td style="font-size: 0.85rem; white-space: nowrap;">${escapeHTML(timeStr)}</td>
      <td><span class="status-tag ${item.is_resolved ? 'resolved' : 'open'}">${item.is_resolved ? '✓ ဖြေရှင်းပြီး' : '🔴 Open'}</span></td>
      <td style="white-space: nowrap;">
        <button type="button" class="table-button" data-view-error="${escapeHTML(item.id)}">🔍 အသေးစိတ်</button>
        <button type="button" class="table-button" data-toggle-error-id="${escapeHTML(item.id)}" style="color: ${item.is_resolved ? '#ffd0d0' : '#b9ffd1'}; margin-left: 0.35rem;">
          ${item.is_resolved ? '↺ Reopen' : '✓ ဖြေရှင်းပြီး'}
        </button>
      </td>
    </tr>`;
  }).join('');
}

function openErrorModal(errorItem) {
  if (!errorItem) return;
  state.currentErrorItem = errorItem;

  const sevIcon = errorItem.severity === 'critical' ? '🔴' : errorItem.severity === 'error' ? '🟠' : errorItem.severity === 'warning' ? '🟡' : '🔵';
  $('#error-modal-severity').className = `severity-badge ${errorItem.severity}`;
  $('#error-modal-severity').textContent = `${sevIcon} ${errorItem.severity.toUpperCase()}`;
  $('#error-modal-source').textContent = errorItem.source;
  $('#error-modal-status').className = `status-tag ${errorItem.is_resolved ? 'resolved' : 'open'}`;
  $('#error-modal-status').textContent = errorItem.is_resolved ? '✓ ဖြေရှင်းပြီး' : '🔴 Open (မဖြေရှင်းရသေး)';
  $('#error-modal-time').textContent = displayDateWithTime(errorItem.created_at);
  $('#error-modal-url').textContent = errorItem.url || '—';
  $('#error-modal-message').textContent = errorItem.message;

  const stack = errorItem.details?.stack || (typeof errorItem.details === 'string' ? errorItem.details : null);
  $('#error-modal-stack').textContent = stack || 'Stack trace မရှိပါ';

  const detailsObj = { ...errorItem.details };
  delete detailsObj.stack;
  $('#error-modal-details').textContent = Object.keys(detailsObj).length ? JSON.stringify(detailsObj, null, 2) : 'Context details မရှိပါ';

  $('#error-modal-ua').textContent = errorItem.user_agent || 'User agent မရှိပါ';

  const toggleBtn = $('#toggle-resolve-btn');
  if (toggleBtn) {
    toggleBtn.textContent = errorItem.is_resolved ? '↺ ပြန်လည်ဖွင့်မည် (Reopen)' : '✓ ဖြေရှင်းပြီးအဖြစ် မှတ်သားမည်';
    toggleBtn.className = errorItem.is_resolved ? 'button button-quiet' : 'button button-primary';
  }

  const modal = $('#error-detail-modal');
  modal.hidden = false;
  modal.classList.add('is-open');
}

function closeErrorModal() {
  const modal = $('#error-detail-modal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.hidden = true;
  }
  state.currentErrorItem = null;
}

// ─── Auto-Slug Generator ──────────────────────────────────────────────────────
function updateAutoSlug() {
  const slugInput = $('#invitation-slug');
  if (!slugInput.value || slugInput.dataset.auto === 'true') {
    const titleVal = $('#invitation-title')?.value.trim() || '';
    const groomEn = $('#groom-name-en')?.value.trim() || '';
    const brideEn = $('#bride-name-en')?.value.trim() || '';
    const groomMm = $('#groom-name')?.value.trim() || '';
    const brideMm = $('#bride-name')?.value.trim() || '';
    const celebrant = $('#celebrant-name')?.value.trim() || '';
    const company = $('#company-name')?.value.trim() || '';

    let base = '';
    if (groomEn || brideEn) {
      base = slugify(`${groomEn}-${brideEn}`);
    } else if (titleVal) {
      base = slugify(titleVal);
    } else if (celebrant) {
      base = slugify(celebrant);
    } else if (company) {
      base = slugify(company);
    } else if (groomMm || brideMm) {
      base = slugify(`${groomMm}-${brideMm}`);
    }

    if (!base) {
      const cat = $('#invitation-category')?.value || 'event';
      base = `${cat}-${Date.now().toString(36).slice(-5)}`;
    }

    slugInput.value = base;
    slugInput.dataset.auto = 'true';
  }
}

// ─── Login Form Submission ────────────────────────────────────────────────────
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-error').hidden = true;
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    showAlert('#login-error', 'Email နှင့် password ကို ဖြည့်ပေးပါ။');
    form.reportValidity();
    return;
  }
  const submitBtn = $('#login-submit-button');
  submitBtn.disabled = true;
  submitBtn.textContent = 'ဝင်ရောက်နေပါသည်…';

  try {
    const email = form.email.value.trim();
    const password = form.password.value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAlert('#login-error', `ဝင်ရောက်၍မရပါ — ${error.message === 'Invalid login credentials' ? 'Email သို့မဟုတ် Password မမှန်ပါ။' : error.message}`);
      return;
    }
    setView(true);
    await initialiseDashboard();
  } catch (err) {
    showAlert('#login-error', `ချိတ်ဆက်မှု မအောင်မြင်ပါ — ${err.message || 'Error ဖြစ်ပေါ်နေပါသည်'}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'ဝင်ရောက်မည်';
  }
});

$('#logout-button').addEventListener('click', async () => { 
  await supabase.auth.signOut(); 
  setView(false); 
});

$('#invitations-tab').addEventListener('click', () => activateTab('invitations')); 
$('#partners-tab').addEventListener('click', () => activateTab('partners'));
$('#errors-tab')?.addEventListener('click', () => activateTab('errors'));
$('#sponsor-tab')?.addEventListener('click', () => activateTab('sponsor'));
$('#new-invitation-button').addEventListener('click', () => openInvitationModal()); 
$('#close-modal-button').addEventListener('click', closeInvitationModal); 
$('#cancel-modal-button').addEventListener('click', closeInvitationModal); 
$('#invitation-modal').addEventListener('click', event => { if (event.target === event.currentTarget) closeInvitationModal(); });
$('#new-partner-button').addEventListener('click', () => openPartnerModal());
$('#close-partner-modal-button').addEventListener('click', closePartnerModal);
$('#cancel-partner-modal-button').addEventListener('click', closePartnerModal);
$('#partner-modal').addEventListener('click', event => { if (event.target === event.currentTarget) closePartnerModal(); });

// QR Modal listeners
$('#close-qr-modal-button')?.addEventListener('click', closeQrModal);
$('#qr-modal')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeQrModal(); });

// QR Download PNG Handler (Direct Mobile Gallery & Desktop Download)
$('#qr-download-png-btn')?.addEventListener('click', () => {
  if (!currentQrInvitation) return;
  const guestUrl = resolveInvitationUrl(currentQrInvitation.slug);
  const selectedSize = Number(document.querySelector('input[name="qr-size-select"]:checked')?.value || 1024);
  const filename = `QR-${currentQrInvitation.slug}-${selectedSize}px.png`;

  downloadQrFile({
    text: guestUrl,
    filename,
    size: selectedSize,
    format: 'png',
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    ecc: 'Q'
  });
});

// QR Download Vector SVG Handler
$('#qr-download-svg-btn')?.addEventListener('click', () => {
  if (!currentQrInvitation) return;
  const guestUrl = resolveInvitationUrl(currentQrInvitation.slug);
  const filename = `QR-${currentQrInvitation.slug}.svg`;

  downloadQrFile({
    text: guestUrl,
    filename,
    format: 'svg',
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    ecc: 'Q'
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

document.addEventListener('keydown', event => { 
  if (event.key === 'Escape') { 
    closeInvitationModal(); 
    closePartnerModal(); 
    closeQrModal();
    closeErrorModal();
  } 
});

$('#invitation-form').addEventListener('submit', saveInvitation); 
$('#partner-form').addEventListener('submit', savePartner);

// Sponsor Form Submission Handler
$('#sponsor-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const alertEl = $('#sponsor-alert');
  if (alertEl) alertEl.hidden = true;

  const form = event.currentTarget;
  if (!form.checkValidity()) {
    showAlert('#sponsor-alert', 'Brand အမည်ကို မဖြစ်မနေ ဖြည့်သွင်းပေးပါ။');
    form.reportValidity();
    return;
  }

  const submitBtn = $('#save-sponsor-button');
  submitBtn.disabled = true;
  submitBtn.textContent = 'သိမ်းဆည်းနေပါသည်…';
  setStatus('#sponsor-status', 'Sponsor အချက်အလက်များကို သိမ်းဆည်းနေပါသည်…');

  try {
    const payload = {
      brand_name: $('#sponsor-brand-name').value.trim(),
      tagline: $('#sponsor-tagline').value.trim(),
      services_text: $('#sponsor-services-text').value.trim(),
      phone: $('#sponsor-phone').value.trim(),
      messenger_url: $('#sponsor-messenger-url').value.trim(),
      facebook_url: $('#sponsor-facebook-url').value.trim(),
      tiktok_url: $('#sponsor-tiktok-url').value.trim(),
      viber_url: $('#sponsor-viber-url').value.trim(),
      telegram_url: $('#sponsor-telegram-url').value.trim(),
      is_visible: $('#sponsor-is-visible').checked
    };

    await savePlatformSponsor(payload);
    setStatus('#sponsor-status', '✓ Platform Sponsor အချက်အလက်များ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။ Landing page များတွင် ချက်ချင်း အကျိုးသက်ရောက်ပါမည်။');
    setTimeout(() => setStatus('#sponsor-status', ''), 4000);
  } catch (err) {
    showAlert('#sponsor-alert', `သိမ်းဆည်း၍ မရပါ — ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sponsor အချက်အလက် သိမ်းမည်';
  }
});

// Partner code input sanitization (uppercase, max 8 alphanumeric)
$('#partner-code-input')?.addEventListener('input', event => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
});

// Regenerate partner code button handler
$('#regenerate-partner-code-btn')?.addEventListener('click', async () => {
  const form = $('#partner-form');
  const codeInput = form.elements.partner_code;
  const isEdit = Boolean(form.elements.id.value);
  const currentCode = codeInput.value.trim();

  if (isEdit) {
    const confirmed = window.confirm(
      `Partner code အသစ် လဲလှယ်ရန် သေချာပါသလား?\n\nလက်ရှိ Code: ${currentCode}\n\nကုဒ်အသစ် ပြောင်းလဲပါက Partner ဝင်ရောက်ရန် Login URL အသစ် သို့မဟုတ် ကုဒ်အသစ် အသုံးပြုရပါမည်။`
    );
    if (!confirmed) return;
  }

  const regenBtn = $('#regenerate-partner-code-btn');
  regenBtn.disabled = true;
  const origBtnText = regenBtn.textContent;
  regenBtn.textContent = 'ထုတ်နေပါသည်…';

  try {
    const newCode = await generateUniquePartnerCode(8);
    codeInput.value = newCode;
    const alertBox = $('#partner-code-alert');
    if (alertBox) {
      alertBox.textContent = `⚠️ Code အသစ် (${newCode}) သို့ ပြောင်းလဲထားပါသည်။ အတည်ပြုရန် 'သိမ်းမည်' ကို နှိပ်ပါ။`;
      alertBox.hidden = false;
    }
  } finally {
    regenBtn.disabled = false;
    regenBtn.textContent = origBtnText;
  }
});

// Copy code from partner modal handler
$('#copy-partner-modal-code-btn')?.addEventListener('click', async () => {
  const codeInput = $('#partner-code-input');
  const code = codeInput ? codeInput.value.trim() : '';
  if (!code) return;
  const copyBtn = $('#copy-partner-modal-code-btn');
  const success = await copyToClipboard(code, copyBtn);
  if (success) {
    copyBtn.classList.add('is-copied');
    copyBtn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.innerHTML = '📋 Copy';
    }, 1800);
  }
});

// Auto-slug bindings
$('#invitation-title')?.addEventListener('input', updateAutoSlug);
$('#groom-name-en')?.addEventListener('input', updateAutoSlug);
$('#bride-name-en')?.addEventListener('input', updateAutoSlug);
$('#groom-name')?.addEventListener('input', updateAutoSlug);
$('#bride-name')?.addEventListener('input', updateAutoSlug);
$('#celebrant-name')?.addEventListener('input', updateAutoSlug);
$('#company-name')?.addEventListener('input', updateAutoSlug);
$('#invitation-slug')?.addEventListener('input', () => { 
  $('#invitation-slug').dataset.auto = 'false'; 
});

// Category & Template sync listeners
$('#template-id')?.addEventListener('change', event => {
  const chosenTpl = state.templates.find(t => t.id === event.target.value);
  if (chosenTpl?.category && $('#invitation-category')) {
    $('#invitation-category').value = chosenTpl.category;
    updateCategoryFieldVisibility(chosenTpl.category);
  }
});

$('#invitation-category')?.addEventListener('change', event => {
  updateCategoryFieldVisibility(event.target.value);
});

// Photo remove buttons
$('#remove-cover-photo').addEventListener('click', () => {
  photoRemovals.cover = true;
  setPhotoPreview('#cover-preview', '');
  $('#remove-cover-photo').hidden = true;
  $('#cover-photo').value = '';
});

$('#remove-couple-photo').addEventListener('click', () => {
  photoRemovals.couple = true;
  setPhotoPreview('#couple-preview', '');
  $('#remove-couple-photo').hidden = true;
  $('#couple-photo').value = '';
});

$('#remove-partner-profile-photo')?.addEventListener('click', () => {
  photoRemovals.partner = true;
  const preview = $('#partner-profile-preview');
  if (preview) { preview.src = ''; preview.hidden = true; }
  const placeholder = $('#partner-avatar-preview-placeholder');
  if (placeholder) placeholder.hidden = false;
  $('#remove-partner-profile-photo').hidden = true;
  const input = $('#partner-profile-photo');
  if (input) input.value = '';
});

$('#partner-profile-photo')?.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showAlert('#partner-form-error', 'ဓာတ်ပုံဖိုင်ကိုသာ ရွေးပါ။');
    event.target.value = '';
    return;
  }
  photoRemovals.partner = false;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = $('#partner-profile-preview');
    if (preview) {
      preview.src = e.target.result;
      preview.hidden = false;
    }
    const placeholder = $('#partner-avatar-preview-placeholder');
    if (placeholder) placeholder.hidden = true;
    const removeBtn = $('#remove-partner-profile-photo');
    if (removeBtn) removeBtn.hidden = false;
  };
  reader.readAsDataURL(file);
});

// Partner select change - auto-fill or reset default bonus
$('#partner-code').addEventListener('change', event => { 
  const partner = state.partners.find(item => item.partner_code === event.target.value); 
  if (partner) {
    $('#bonus-amount').value = partner.default_bonus; 
  } else {
    $('#bonus-amount').value = 0;
  }
});

// Invitation list event delegation (Edit, Toggle, Delete, QR)
$('#invitation-list').addEventListener('click', event => { 
  const button = event.target.closest('[data-invitation-action]'); 
  if (!button) return; 
  const invitation = state.invitations.find(item => item.id === button.dataset.id); 
  if (!invitation) return;
  if (button.dataset.invitationAction === 'edit') openInvitationModal(invitation); 
  if (button.dataset.invitationAction === 'toggle') toggleInvitation(button.dataset.id); 
  if (button.dataset.invitationAction === 'delete') deleteInvitation(button.dataset.id);
  if (button.dataset.invitationAction === 'qr') openQrModal(invitation);
});

// Partner list event delegation (Edit, Delete)
$('#partner-list').addEventListener('click', event => { 
  const button = event.target.closest('[data-partner-action]'); 
  if (!button) return; 
  if (button.dataset.partnerAction === 'edit') openPartnerModal(state.partners.find(item => item.id === button.dataset.id)); 
  if (button.dataset.partnerAction === 'delete') deletePartner(button.dataset.id); 
});

// ─── Error Management Event Listeners (Phase 8) ──────────────────────────────

// Filter pills
document.querySelectorAll('[data-error-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-error-filter]').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.errorFilter = btn.dataset.errorFilter;
    renderErrorLogs();
  });
});

// Severity filter select
$('#error-severity-select')?.addEventListener('change', event => {
  state.severityFilter = event.target.value;
  renderErrorLogs();
});

// Refresh button
$('#refresh-errors-btn')?.addEventListener('click', loadErrorLogs);

// Clear resolved button
$('#clear-resolved-errors-btn')?.addEventListener('click', async () => {
  const resolvedCount = state.errorLogs.filter(l => l.is_resolved).length;
  if (!resolvedCount) {
    alert('ရှင်းထုတ်ရန် ဖြေရှင်းပြီးသား error မရှိသေးပါ။');
    return;
  }
  if (!confirm(`ဖြေရှင်းပြီးသား Error log (${resolvedCount}) ခုကို အပြီးဖျက်ထုတ်မည်မှာ သေချာပါသလား?`)) return;
  try {
    setStatus('#error-status', 'ရှင်းလင်းနေပါသည်…');
    await clearResolvedErrorLogs();
    await loadErrorLogs();
    setStatus('#error-status', 'ဖြေရှင်းပြီးသား Error log များကို ရှင်းထုတ်ပြီးပါပြီ။');
  } catch (err) {
    setStatus('#error-status', `ရှင်းထုတ်၍မရပါ — ${err.message}`);
  }
});

// Error list delegation
$('#error-list')?.addEventListener('click', async event => {
  const viewBtn = event.target.closest('[data-view-error]');
  if (viewBtn) {
    const errorItem = state.errorLogs.find(l => l.id === viewBtn.dataset.viewError);
    if (errorItem) openErrorModal(errorItem);
    return;
  }
  const toggleBtn = event.target.closest('[data-toggle-error-id]');
  if (toggleBtn) {
    const errorItem = state.errorLogs.find(l => l.id === toggleBtn.dataset.toggleErrorId);
    if (!errorItem) return;
    try {
      toggleBtn.disabled = true;
      await resolveSystemErrorLog(errorItem.id, !errorItem.is_resolved);
      await loadErrorLogs();
    } catch (err) {
      alert(`အခြေအနေ ပြောင်း၍မရပါ — ${err.message}`);
    }
  }
});

// Error modal controls
$('#close-error-modal-btn')?.addEventListener('click', closeErrorModal);
$('#close-error-modal-footer-btn')?.addEventListener('click', closeErrorModal);
$('#error-detail-modal')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) closeErrorModal();
});

$('#toggle-resolve-btn')?.addEventListener('click', async () => {
  if (!state.currentErrorItem) return;
  const item = state.currentErrorItem;
  const newStatus = !item.is_resolved;
  try {
    $('#toggle-resolve-btn').disabled = true;
    await resolveSystemErrorLog(item.id, newStatus);
    await loadErrorLogs();
    const updated = state.errorLogs.find(l => l.id === item.id);
    if (updated) openErrorModal(updated);
  } catch (err) {
    alert(`အခြေအနေ ပြောင်း၍မရပါ — ${err.message}`);
  } finally {
    $('#toggle-resolve-btn').disabled = false;
  }
});

$('#copy-stack-btn')?.addEventListener('click', async () => {
  const stackText = $('#error-modal-stack')?.textContent || '';
  if (!stackText) return;
  const btn = $('#copy-stack-btn');
  const success = await copyToClipboard(stackText, btn);
  if (success) {
    btn.classList.add('is-copied');
    btn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.innerHTML = '📋 Copy Stack';
    }, 1800);
  }
});

// Copy link button handler for both invitations and partners
document.addEventListener('click', async event => {
  const copyBtn = event.target.closest('[data-copy-link]');
  if (!copyBtn) return;
  const link = copyBtn.dataset.copyLink;
  if (!link) return;
  const success = await copyToClipboard(link, copyBtn);
  if (success) {
    const isPartner = copyBtn.closest('#partner-list');
    setStatus(isPartner ? '#partner-status' : '#invitation-status', 'Link ကို ကူးယူပြီးပါပြီ ✓');
  }
});

previewSelectedPhoto('#cover-photo', '#cover-preview', '#remove-cover-photo', 'cover'); 
previewSelectedPhoto('#couple-photo', '#couple-preview', '#remove-couple-photo', 'couple');

// Auth state reactive listener & Initial session check
supabase.auth.onAuthStateChange((event, session) => {
  setView(Boolean(session));
  if (session && !state.invitations.length) {
    initialiseDashboard();
  }
});

supabase.auth.getSession().then(({ data: { session } }) => { 
  setView(Boolean(session)); 
  if (session) initialiseDashboard(); 
});

