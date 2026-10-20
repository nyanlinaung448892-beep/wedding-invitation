// =============================================================================
// js/calendar.js
// One-Click Save to Calendar — Smart Device-Aware Calendar Integration
// Supports: iOS Safari, Android Chrome, Desktop browsers
// Features: ICS download, Google Calendar fallback, browser notification reminder
// =============================================================================

/**
 * Escapes special characters for ICS (RFC 5545) text fields.
 */
function escapeICS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Folds long ICS lines at 75 octets per RFC 5545.
 */
function foldICSLine(str) {
  const MAX = 75;
  if (str.length <= MAX) return str;
  let result = '';
  let pos = 0;
  while (pos < str.length) {
    if (pos === 0) {
      result += str.slice(0, MAX);
      pos = MAX;
    } else {
      result += '\r\n ' + str.slice(pos, pos + MAX - 1);
      pos += MAX - 1;
    }
  }
  return result;
}

/**
 * Formats a JS Date to ICS local datetime string YYYYMMDDTHHMMSS
 */
function toICSDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Generates an ICS file content string for the wedding event.
 */
export function generateICS(opts) {
  const {
    groomName    = '',
    brideName    = '',
    weddingDate  = '',
    weddingTime  = '',
    venueName    = '',
    venueAddress = '',
    mapUrl       = '',
  } = opts;

  const baseDate = new Date(`${weddingDate}T09:30:00`);
  const endDate  = new Date(`${weddingDate}T12:30:00`);

  if (isNaN(baseDate.getTime())) {
    throw new Error(`[calendar.js] Invalid wedding date: ${weddingDate}`);
  }

  const dtStart = toICSDate(baseDate);
  const dtEnd   = toICSDate(endDate);
  const uid     = `wedding-${(groomName + brideName + weddingDate).replace(/[^a-zA-Z0-9]/g, '')}@digitalwedding`;

  const summary     = escapeICS(`${groomName} & ${brideName} မင်္ဂလာပွဲ 💍`);
  const location    = escapeICS(venueAddress ? `${venueName}, ${venueAddress}` : venueName);
  const description = escapeICS(
    `${groomName} & ${brideName} တို့၏ မင်္ဂလာဆောင်ပွဲ\n` +
    `နေ့ရက် : ${weddingDate}\n` +
    `အချိန်  : ${weddingTime}\n` +
    `နေရာ  : ${venueName}${venueAddress ? ', ' + venueAddress : ''}\n` +
    (mapUrl ? `Google Map : ${mapUrl}` : '')
  );

  const now = toICSDate(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Digital Wedding Invitation//MM',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    foldICSLine(`UID:${uid}`),
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldICSLine(`SUMMARY:${summary}`),
    foldICSLine(`LOCATION:${location}`),
    foldICSLine(`DESCRIPTION:${description}`),
    // Alarm 1: 1 day before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    foldICSLine(`DESCRIPTION:မနက်ဖြန် ${groomName} & ${brideName} မင်္ဂလာပွဲ ရှိသည်! 💍`),
    'END:VALARM',
    // Alarm 2: 1 hour before
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    foldICSLine(`DESCRIPTION:${groomName} & ${brideName} မင်္ဂလာပွဲ ၁ နာရီ အတွင်း ရှိပြီ! 💒`),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Detects the user platform.
 */
function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Builds a Google Calendar "Add Event" URL.
 */
export function getGoogleCalendarUrl(opts) {
  const {
    groomName    = '',
    brideName    = '',
    weddingDate  = '',
    weddingTime  = '',
    venueName    = '',
    venueAddress = '',
  } = opts;

  const startDate = new Date(`${weddingDate}T09:30:00`);
  const endDate   = new Date(`${weddingDate}T12:30:00`);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const params = new URLSearchParams({
    action  : 'TEMPLATE',
    text    : `${groomName} & ${brideName} မင်္ဂလာပွဲ 💍`,
    dates   : `${fmt(startDate)}/${fmt(endDate)}`,
    details : `${groomName} & ${brideName} တို့၏ မင်္ဂလာဆောင်ပွဲ\nအချိန် : ${weddingTime}\nနေရာ : ${venueName}${venueAddress ? ', ' + venueAddress : ''}`,
    location: `${venueName}${venueAddress ? ', ' + venueAddress : ''}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Downloads the ICS file for Desktop / Android.
 */
function downloadICS(icsContent, filename) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Saves wedding event to calendar using the best available method:
 *   iOS      -> data:text/calendar URI (Safari native sheet)
 *   Android  -> Blob ICS download
 *   Desktop  -> Blob ICS download
 *
 * @param {Object}   opts
 * @param {Function} onSuccess  -- called with { platform, googleUrl }
 * @param {Function} onError    -- called with Error
 */
export function saveToCalendar(opts, onSuccess, onError) {
  const platform = detectPlatform();
  try {
    const icsContent = generateICS(opts);
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9\u1000-\u109F\uAA60-\uAA7F]/g, '-');
    const filename   = `${safe(opts.groomName)}-${safe(opts.brideName)}-mingalar.ics`;

    if (platform === 'ios') {
      // iOS Safari: data URI triggers native "Add to Calendar" action sheet
      const dataUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);
      const a = document.createElement('a');
      a.href     = dataUri;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch (_) {} }, 600);
    } else {
      downloadICS(icsContent, filename);
    }

    onSuccess?.({ platform, googleUrl: getGoogleCalendarUrl(opts) });
  } catch (err) {
    console.error('[calendar.js] saveToCalendar error:', err);
    onError?.(err);
  }
}

/**
 * Requests Notification permission and schedules a browser reminder
 * for the wedding day (08:00 AM, using setTimeout for same-day events,
 * and localStorage flag for Service Worker).
 *
 * @param {Object} opts  -- groomName, brideName, weddingDate, venueName
 * @returns {Promise<'granted'|'denied'|'unsupported'|'past'>}
 */
export async function scheduleWeddingReminder(opts) {
  if (!('Notification' in window)) return 'unsupported';

  const { groomName = '', brideName = '', weddingDate = '' } = opts;
  const reminderTime = new Date(`${weddingDate}T08:00:00`).getTime();
  if (isNaN(reminderTime) || reminderTime <= Date.now()) return 'past';

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return 'denied';

  // Persist reminder for Service Worker to pick up
  const reminderKey  = `wedding_reminder_${weddingDate}`;
  const reminderData = { groomName, brideName, weddingDate, reminderTime, fired: false };
  try { localStorage.setItem(reminderKey, JSON.stringify(reminderData)); } catch (_) {}

  // Notify Service Worker if available
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SCHEDULE_WEDDING_REMINDER', reminderData });
  }

  // Best-effort setTimeout fallback (works only while page stays open)
  const msUntilReminder = reminderTime - Date.now();
  if (msUntilReminder > 0 && msUntilReminder < 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      try {
        new Notification(`${groomName} & ${brideName} မင်္ဂလာပွဲ 💍`, {
          body : `ယနေ့ မင်္ဂလာပွဲ ရှိသည်! ၀၉:၃၀ ကြွရောက်ပါ — ${opts.venueName || ''}`,
          icon : 'assets/images/wedding-memory-default.jpg',
          tag  : `wedding-reminder-${weddingDate}`,
          badge: 'assets/images/wedding-memory-default.jpg',
        });
      } catch (_) {}
    }, msUntilReminder);
  }

  return 'granted';
}
