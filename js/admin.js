import { getSupabaseClient, TABLES, STORAGE_BUCKET, fetchAllPartners, resolveDisplayTitle } from './supabase-config.js';

const supabase = await getSupabaseClient();

const state = { invitations: [], partners: [], templates: [] };
const photoRemovals = { cover: false, couple: false };
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
    const guestUrl = `${basePath}index.html?id=${encodeURIComponent(invitation.slug)}`;
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
          <a class="table-button" href="index.html?id=${encodeURIComponent(invitation.slug)}" target="_blank" rel="noopener">ဖွင့်ကြည့်ရန် ↗</a>
          <button type="button" class="copy-icon-btn" data-copy-link="${escapeHTML(guestUrl)}" title="Link ကို Copy ကူးမည်" aria-label="Link ကို Copy ကူးမည်">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
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
    return `<tr>
      <td><strong>${escapeHTML(partner.shop_name)}</strong></td>
      <td><code>${escapeHTML(partner.partner_code)}</code></td>
      <td><a href="mailto:${escapeHTML(partner.email || '')}" style="color: var(--color-light); text-decoration: underline;">${escapeHTML(partner.email || '—')}</a></td>
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
  }).join('') : '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Partner မရှိသေးပါ။ “Partner အသစ်” ကိုနှိပ်၍ စတင်ပါ။</td></tr>';
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

function openPartnerModal(partner = null) {
  closeInvitationModal();
  const el = $('#partner-modal');
  const form = $('#partner-form');
  form.reset();
  $('#partner-form-error').hidden = true;
  $('#partner-form-title').textContent = partner ? 'Partner ပြင်ဆင်ရန်' : 'Partner အသစ်';
  $('#passcode-optional').hidden = !partner;
  form.elements.partner_code.disabled = Boolean(partner);
  form.elements.passcode.required = !partner;
  if (partner) {
    form.elements.id.value = partner.id;
    form.elements.shop_name.value = partner.shop_name;
    form.elements.partner_code.value = partner.partner_code;
    form.elements.email.value = partner.email || '';
    form.elements.phone.value = partner.phone || '';
    form.elements.default_bonus.value = partner.default_bonus || 0;
  } else {
    form.elements.id.value = '';
    form.elements.email.value = '';
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
  const record = { 
    shop_name: String(formData.get('shop_name')).trim(), 
    partner_code: existing?.partner_code || String(formData.get('partner_code')).trim().toUpperCase(), 
    email: email,
    phone: String(formData.get('phone') || '').trim() || null, 
    default_bonus: Number(formData.get('default_bonus') || 0) 
  };
  const passcode = String(formData.get('passcode') || '').trim(); 
  if (passcode) record.passcode = passcode;
  
  const button = $('#save-partner-button'); 
  button.disabled = true; 
  button.textContent = 'သိမ်းနေပါသည်…'; 

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

function activateTab(tabName) { 
  const invitations = tabName === 'invitations'; 
  $('#invitations-tab').classList.toggle('is-active', invitations); 
  $('#invitations-tab').setAttribute('aria-selected', String(invitations)); 
  $('#invitations-panel').hidden = !invitations; 
  $('#partners-tab').classList.toggle('is-active', !invitations); 
  $('#partners-tab').setAttribute('aria-selected', String(!invitations)); 
  $('#partners-panel').hidden = invitations; 
}

async function initialiseDashboard() { 
  try { 
    await loadMetadata(); 
    await Promise.all([loadInvitations(), refreshPartners()]); 
  } catch (error) { 
    setStatus('#invitation-status', `Dashboard data ဖွင့်၍မရပါ — ${error.message}`); 
  } 
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
$('#new-invitation-button').addEventListener('click', () => openInvitationModal()); 
$('#close-modal-button').addEventListener('click', closeInvitationModal); 
$('#cancel-modal-button').addEventListener('click', closeInvitationModal); 
$('#invitation-modal').addEventListener('click', event => { if (event.target === event.currentTarget) closeInvitationModal(); });
$('#new-partner-button').addEventListener('click', () => openPartnerModal());
$('#close-partner-modal-button').addEventListener('click', closePartnerModal);
$('#cancel-partner-modal-button').addEventListener('click', closePartnerModal);
$('#partner-modal').addEventListener('click', event => { if (event.target === event.currentTarget) closePartnerModal(); });

document.addEventListener('keydown', event => { 
  if (event.key === 'Escape') { 
    closeInvitationModal(); 
    closePartnerModal(); 
  } 
});

$('#invitation-form').addEventListener('submit', saveInvitation); 
$('#partner-form').addEventListener('submit', savePartner);

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

// Partner select change - auto-fill or reset default bonus
$('#partner-code').addEventListener('change', event => { 
  const partner = state.partners.find(item => item.partner_code === event.target.value); 
  if (partner) {
    $('#bonus-amount').value = partner.default_bonus; 
  } else {
    $('#bonus-amount').value = 0;
  }
});

// Invitation list event delegation (Edit, Toggle, Delete)
$('#invitation-list').addEventListener('click', event => { 
  const button = event.target.closest('[data-invitation-action]'); 
  if (!button) return; 
  const invitation = state.invitations.find(item => item.id === button.dataset.id); 
  if (button.dataset.invitationAction === 'edit') openInvitationModal(invitation); 
  if (button.dataset.invitationAction === 'toggle') toggleInvitation(button.dataset.id); 
  if (button.dataset.invitationAction === 'delete') deleteInvitation(button.dataset.id);
});

// Partner list event delegation (Edit, Delete)
$('#partner-list').addEventListener('click', event => { 
  const button = event.target.closest('[data-partner-action]'); 
  if (!button) return; 
  if (button.dataset.partnerAction === 'edit') openPartnerModal(state.partners.find(item => item.id === button.dataset.id)); 
  if (button.dataset.partnerAction === 'delete') deletePartner(button.dataset.id); 
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
