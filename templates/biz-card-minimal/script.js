// =============================================================================
// templates/biz-card-minimal/script.js
// Business Card Template Controller & Interactive Plugin
// Features: vCard (.vcf) contact card generation, Native share/clipboard copy
// =============================================================================

function generateVCard(data) {
  const company = data.company_name || data.display_title || 'Business Contact';
  const phone = data.rsvp_phone || '';
  const address = data.venue_address || '';
  const note = data.industry_tagline || data.message || '';

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${company}`,
    `ORG:${company}`,
    `TITLE:${data.industry_tagline || ''}`,
    phone ? `TEL;TYPE=WORK,VOICE:${phone}` : '',
    address ? `ADR;TYPE=WORK:;;${address};;;;` : '',
    note ? `NOTE:${note}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');
}

/**
 * Main Template Plugin Initializer
 */
export function init({ container, data, helpers, slug }) {
  if (!container) return;

  // 1. Save Contact as vCard
  const vcardBtn = container.querySelector('#btn-save-vcard');
  vcardBtn?.addEventListener('click', () => {
    try {
      const vcardContent = generateVCard(data);
      const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `${(data.company_name || 'contact').toLowerCase().replace(/\s+/g, '_')}.vcf`;

      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[biz-card-minimal] vCard generation error:', err);
    }
  });

  // 2. Share Profile Link
  const shareBtn = container.querySelector('#btn-share-card');
  const toastEl = container.querySelector('#share-toast');

  shareBtn?.addEventListener('click', async () => {
    const shareData = {
      title: data.company_name || data.display_title || 'Digital Business Card',
      text: `${data.company_name || 'Business'} Digital Profile:`,
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

    // Fallback: Copy link to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (toastEl) {
        toastEl.hidden = false;
        toastEl.textContent = '✅ Profile Link ကို ကူးယူပြီးပါပြီ!';
        setTimeout(() => { toastEl.hidden = true; }, 3000);
      }
    } catch (_) {
      if (toastEl) {
        toastEl.hidden = false;
        toastEl.textContent = '📋 Link: ' + window.location.href;
      }
    }
  });
}

/**
 * Cleanup lifecycle hook
 */
export function destroy() {
  // Stateless clean up
}
