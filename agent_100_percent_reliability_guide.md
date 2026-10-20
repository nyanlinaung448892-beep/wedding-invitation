# AI Agent လမ်းညွှန်ချက် — 100% Reliability & Zero-Downtime Wedding Invitation Architecture

> **အသုံးပြုပုံ**: အောက်ပါ Prompt နှင့် Technical Specification တစ်ခုလုံးကို Copy ကူးပြီး သင်အသုံးပြုနေသော AI Agent (Cursor / Windsurf / Antigravity) ထဲသို့ တိုက်ရိုက် Paste ချပေးလိုက်ပါ။ `AGENTS.md` ၏ Rule 0.1 အရ Agent က ထပ်မံမေးမြန်းမနေဘဲ တိုက်ရိုက် Code ပြင်ဆင်နိုင်အောင် Explicit Execution Command ထည့်သွင်းပေးထားပါသည်။

## ၁။ Agent သို့ တိုက်ရိုက်ပေးပို့ရမည့် အမိန့်ပေးချက် (Explicit Execution Prompt)

**အမိန့်ပေးချက် (Explicit Authorization — লုပ်ပါ / ပြင်လိုက်ပါ)**:
ဤ Project (`Digital Wedding Invitation`) တွင် ဧည့်သည်များ QR Code သို့မဟုတ် Link မှတစ်ဆင့် ဝင်ရောက်သည့်အခါ မည်သည့်အခြေအနေတွင်မဆို (URL တွင် `?id=` မပါလျှင်ဖြစ်စေ၊ Supabase Project ခေတ္တ Pause ဖြစ်နေလျှင်ဖြစ်စေ၊ Database/Network ပြတ်တောက်နေလျှင်ဖြစ်စေ၊ External CDN ပိတ်ဆို့ခံရလျှင်ဖြစ်စေ) Error Screen လုံးဝမပြဘဲ ၁၀၀% တိုက်ရိုက်ပွင့်လာစေမည့် **100% Reliability (Zero-Downtime) Architecture** ကို အောက်ပါ သတ်မှတ်ချက်များအတိုင်း ချက်ချင်း အပြည့်အစုံ ပြင်ဆင်ရေးသားပေးပါ။ ဆွေးနွေးမေးမြန်းရန် မလိုပါ — ဖိုင်များကို တိုက်ရိုက်ပြင်ဆင်ပေးပါ။

## ၂။ ပြင်ဆင်ရမည့် အဓိက စနစ် (Core Architecture Requirements)

| အဆင့် | ပြင်ဆင်ရမည့် ကဏ္ဍ | လုပ်ဆောင်ရမည့် တိကျသော သတ်မှတ်ချက် |
| :--- | :--- | :--- |
| **Tier 1** | **Direct Entry (`?id=` မပါလျှင် တိုက်ရိုက်ပွင့်ရန်)** | Link တွင် `?id=` (သို့မဟုတ် `?slug=`) မပါဘဲ `index.html` သို့ တိုက်ရိုက်ဝင်လာသည့်အခါ `showError('no-slug')` လုံးဝ မခေါ်ရ။ လက်ရှိ `templates/floral-pink/layout.html` ထဲတွင် ရေးထားသော **"ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ"** Default ဖိတ်စာကို တိုက်ရိုက် ချက်ချင်း ဆွဲတင်ဖွင့်ပေးရမည်။ |
| **Tier 2** | **CDN-Independent Supabase REST Fetch** | Guest page (`index.html` / `js/engine.js`) သည် `cdn.jsdelivr.net` ပေါ်မှ `@supabase/supabase-js` ကို static import လုပ်ခြင်းကြောင့် မြန်မာနိုင်ငံရှိ အချို့ဖုန်းလိုင်းများတွင် Loading Screen ရပ်နေတတ်သည်။ ထို့ကြောင့် Guest ဖိတ်စာ ဖတ်ရှုရာတွင် Browser ပါ `fetch()` နှင့် `AbortController` (5-second timeout) ကို သုံး၍ Supabase REST API (`/rest/v1/invitations`) သို့ တိုက်ရိုက် လှမ်းခေါ်ရမည်။ |
| **Tier 3** | **Offline / Static Fallback JSON ခံစစ်စနစ်** | အကယ်၍ Supabase Project ခေတ္တ Pause ဖြစ်သွားခြင်း၊ Database ချိတ်ဆက်မှု ပြတ်တောက်ခြင်း သို့မဟုတ် Slug ရှာမတွေ့ခြင်း ဖြစ်ပေါ်ပါက Error Screen မပြဘဲ `localStorage` cache → `data/fallback-invitations.json` → Template ပါ Default ဖိတ်စာ (`ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ`) အစဉ်လိုက် အလိုအလျောက် ဆွဲတင်ပေးရမည်။ |
| **Tier 4** | **Auto Template Fallback & Safe Data Binding** | Database မှ ပြန်လာသော `template_id` (ဥပမာ `'royal-gold'`) သည် `templates/registry.json` တွင် မရှိပါက Error မပြဘဲ လက်ရှိအသုံးပြုနိုင်သော `'floral-pink'` သို့ အလိုအလျောက် ပြောင်းဖွင့်ပေးရမည်။ |

## ၃။ ဖိုင်အလိုက် တိကျစွာ ပြင်ဆင်ရမည့် လမ်းညွှန်ချက်များ (File-by-File Implementation Guide)

### Step 1: `data/fallback-invitations.json` ဖိုင်အသစ် တည်ဆောက်ရန်

Project root အောက်တွင် `data/fallback-invitations.json` ဖိုင်အသစ် ဖန်တီးပြီး Default ဖိတ်စာ (`"ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ"`) နှင့် လက်ရှိ Sample Invitations များကို Static Backup အဖြစ် သိမ်းဆည်းပါ-

```json
{
  "default": {
    "slug": "default",
    "template_id": "floral-pink",
    "is_active": true,
    "customer_data": {
      "groom_name": "ဟိန်းသူအောင်",
      "bride_name": "ပန်းအိဖြူ",
      "groom_name_en": "",
      "bride_name_en": "",
      "wedding_date": "2026-09-13",
      "wedding_day": "တနင်္ဂနွေနေ့",
      "wedding_time": "နံနက် ၉:၃၀ နာရီ မှ နေ့လယ် ၁၂:၃၀ နာရီ ထိ",
      "venue_name": "ဟုတ်ဝမ်မင်္ဂလာခန်းမ",
      "venue_address": "ကန်လမ်း၊ တောင်ငူမြို့။",
      "map_url": "",
      "rsvp_phone": "",
      "cover_photo_url": "",
      "couple_photo_url": "",
      "message": ""
    }
  },
  "invitations": {
    "ko-zaw-ma-aye-2025": {
      "slug": "ko-zaw-ma-aye-2025",
      "template_id": "floral-pink",
      "is_active": true,
      "customer_data": {
        "groom_name": "ကိုဇော်",
        "bride_name": "မအေး",
        "groom_name_en": "Ko Zaw",
        "bride_name_en": "Ma Aye",
        "wedding_date": "2025-11-22",
        "wedding_day": "စနေနေ့",
        "wedding_time": "၁၁:၀၀ နံနက်",
        "venue_name": "Novotel Yangon Max",
        "venue_address": "459/461 Pyay Road, Kamayut, Yangon",
        "map_url": "",
        "rsvp_phone": "09-444-555-666",
        "cover_photo_url": "",
        "couple_photo_url": "",
        "message": "ချစ်မြတ်နိုးသော ညာတိမိတ်ဆွေများကို ဖိတ်ကြားအပ်ပါသည်"
      }
    },
    "ko-aung-ma-thandar-2025": {
      "slug": "ko-aung-ma-thandar-2025",
      "template_id": "floral-pink",
      "is_active": true,
      "customer_data": {
        "groom_name": "ကိုအောင်",
        "bride_name": "မသန်းဒါး",
        "groom_name_en": "Ko Aung",
        "bride_name_en": "Ma Thandar",
        "wedding_date": "2025-12-12",
        "wedding_day": "သောကြာနေ့",
        "wedding_time": "၁၀:၀၀ နံနက်",
        "venue_name": "Sedona Hotel, Yangon",
        "venue_address": "No.1 Kaba Aye Pagoda Road, Yankin, Yangon",
        "map_url": "",
        "rsvp_phone": "09-111-222-333",
        "cover_photo_url": "",
        "couple_photo_url": "",
        "message": "ကျွန်တော်တို့ရဲ့ ထိမ်းမြားမင်္ဂလာပွဲသို့ ကြိုဆိုပါသည်"
      }
    }
  }
}
```

### Step 2: `js/supabase-config.js` တွင် CDN-Safe Guest Fetch ပြင်ဆင်ရန်

1. `SUPABASE_URL` နှင့် `SUPABASE_ANON_KEY` တို့ကို `export` လုပ်ပေးပါ။
2. `fetchInvitationBySlug(slug)` ကို `@supabase/supabase-js` SDK အပေါ် မမှီခိုစေဘဲ Native `fetch()` + `AbortController` (5000ms timeout) ဖြင့် Supabase REST API မှ တိုက်ရိုက် ဆွဲယူနိုင်အောင် ရေးသားပါ။
3. Slug ကို `.trim().toLowerCase()` ပြောင်းပြီး Case-Insensitive (`ilike`) ဖြင့် ရှာဖွေပါ-

```javascript
export const SUPABASE_URL = 'https://kweylhqnzqnxnopqwrhj.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_kb9dPHYc_1SgGGsTKQG3-g_CdBFPUmz';

export async function fetchInvitationBySlug(slug, timeoutMs = 5000) {
    if (!slug) return null;
    const cleanSlug = String(slug).trim().toLowerCase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLES.INVITATIONS}?select=*&slug=ilike.${encodeURIComponent(cleanSlug)}&is_active=eq.true&limit=1`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        if (!res.ok) {
            throw new Error(`Supabase HTTP ${res.status}`);
        }

        const rows = await res.json();
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch (err) {
        console.warn('[supabase-config] Direct REST fetch failed or timed out:', err.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}
```

> **အရေးကြီးချက်**: `js/engine.js` သည် `js/supabase-config.js` ကို import လုပ်သည့်အခါ Top-level `import { createClient } from 'https://cdn.jsdelivr.net/...'` ကြောင့် `jsdelivr` ပိတ်ဆို့ခံရလျှင် `engine.js` ပါ ရပ်မသွားစေရန် Guest REST helper ကို `engine.js` ထဲတွင် တိုက်ရိုက်ထားရှိရမည် (သို့မဟုတ် `supabase-config.js` တွင် `createClient` ကို dynamic `import()` ဖြင့်သာ ခေါ်ရမည်)။

### Step 3: `js/engine.js` ကို 100% Zero-Downtime Engine အဖြစ် ပြင်ဆင်ရန်

`js/engine.js` တွင် အောက်ပါ ပြင်ဆင်ချက် (၅) ခုကို တိကျစွာ ထည့်သွင်းပါ-

#### (က) In-Memory Default Invitation သတ်မှတ်ချက်ထည့်ရန်
`templates/floral-pink/layout.html` ထဲရှိ မူလဖိတ်စာအချက်အလက် (`"ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ"`) ကို `DEFAULT_INVITATION` constant အဖြစ် `js/engine.js` ထိပ်ဆုံးတွင် သတ်မှတ်ထားပါ-

```javascript
const DEFAULT_INVITATION = {
  slug: 'default',
  template_id: 'floral-pink',
  is_active: true,
  _isFallbackDefault: true,
  customer_data: {
    groom_name: 'ဟိန်းသူအောင်',
    bride_name: 'ပန်းအိဖြူ',
    groom_name_en: '',
    bride_name_en: '',
    wedding_date: '2026-09-13',
    wedding_day: 'တနင်္ဂနွေနေ့',
    wedding_time: 'နံနက် ၉:၃၀ နာရီ မှ နေ့လယ် ၁၂:၃၀ နာရီ ထိ',
    venue_name: 'ဟုတ်ဝမ်မင်္ဂလာခန်းမ',
    venue_address: 'ကန်လမ်း၊ တောင်ငူမြို့။',
    map_url: '',
    rsvp_phone: '',
    cover_photo_url: '',
    couple_photo_url: '',
    message: ''
  }
};
```

#### (ခ) Multi-Tier Fallback Resolver (`resolveInvitationData(slug)`) ရေးသားရန်
URL မှ `slug` ကို ရယူရာတွင် `?id=`၊ `?slug=` သို့မဟုတ် `window.location.hash` (`#slug`) အားလုံးကို လက်ခံပြီး `.trim().toLowerCase()` ပြုလုပ်ပါ။ ထို့နောက် အောက်ပါ အစဉ်အတိုင်း ဆွဲတင်ပါ-

1. **Direct Entry (`!slug`)**: URL တွင် `?id=` မပါလာပါက Supabase သို့ လှမ်းခေါ်မနေဘဲ `data/fallback-invitations.json` မှ `default` (မရပါက `DEFAULT_INVITATION`) ကို ချက်ချင်း ပြန်ပေးပါ။
2. **Tier 1 — Supabase Live Fetch**: `slug` ပါလာပါက Supabase REST API မှ 5-second timeout ဖြင့် ရှာဖွေပါ။ အောင်မြင်ပါက `localStorage.setItem('wedding_inv_cache_' + slug, JSON.stringify(remoteData))` ဖြင့် သိမ်းဆည်းပြီး ပြန်ပေးပါ။
3. **Tier 2 — LocalStorage Cache Fallback**: Supabase ချိတ်ဆက်မှု ပြတ်တောက်နေပါက သို့မဟုတ် Project Pause ဖြစ်နေပါက ယခင်ပွင့်ဖူးသော `localStorage` cache ထဲမှ ဆွဲထုတ်ပေးပါ။
4. **Tier 3 — Static JSON Fallback (`data/fallback-invitations.json`)**: `data/fallback-invitations.json` ထဲရှိ `invitations[slug]` တွင် ရှိမရှိ စစ်ဆေးပြီး ရှိပါက ဆွဲတင်ပေးပါ။
5. **Tier 4 — Ultimate Default Fallback**: အထက်ပါ အဆင့်အားလုံးတွင် မတွေ့ပါက Error Screen (`showError`) လုံးဝ မပြဘဲ `DEFAULT_INVITATION` (`"ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ"`) ကိုသာ အလိုအလျောက် ဆွဲတင်ပေးပါ။

#### (ဂ) Hero Section သတို့သား/သတို့သမီး ရှေ့ဆက်နာမည် (`ကို` / `မောင်` / `မ`) မှန်ကန်စေရန်
`templates/floral-pink/layout.html` ကို ကြည့်ပါက-
- Line 26 (Envelope Hero Header): `<span data-bind="groom_name" class="name-part">ကိုဟိန်းသူအောင်</span>` နှင့် Line 28: `<span data-bind="bride_name" class="name-part">မပန်းအိဖြူ</span>` ဟု ရှေ့ဆက် (`ကို` / `မ`) မပါဘဲ `data-bind` တိုက်ရိုက်ချိတ်ထားပြီး၊
- Line 112–113 (Card 1) နှင့် Line 150 (Card 2): `<span class="title-prefix">မောင်</span><span class="name-main" data-bind="groom_name">ဟိန်းသူအောင်</span>` ဟု ရှေ့ဆက် `မောင်` နှင့် `မ` ကို အပြင်မှ ခံထားပါသည်။
- ထို့ကြောင့် Default ဖိတ်စာ (`_isFallbackDefault: true`) ဖွင့်သည့်အခါ `layout.html` ထဲရှိ မူလစာသားအတိုင်း (`ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ` နှင့် Card ထဲတွင် `မောင်ဟိန်းသူအောင် / မပန်းအိဖြူ`) လုံးဝမပျက်စီးဘဲ ပေါ်စေရန် `bindData(root, data)` တွင် အောက်ပါအတိုင်း ထိန်းသိမ်းပါ-
  - အကယ်၍ `data._isFallbackDefault === true` ဖြစ်ပြီး Element တွင် မူလ HTML text ရှိနေပြီးသားဆိုလျှင် (`el.textContent.trim() !== ''`), မူလ HTML text ကို ဆက်လက်ထားရှိပါ (သို့မဟုတ် `templates/floral-pink/layout.html` ၏ Line 26–28 နှင့် Line 44 ကို စစ်ဆေးပြီး နာမည်နှစ်ထပ် `မောင်ကိုဟိန်းသူအောင်` မဖြစ်စေရန် ညှိပေးပါ)။

#### (ဃ) Automatic Template Fallback (`royal-gold` မရှိလျှင် `floral-pink` သုံးရန်)
`js/engine.js` ၏ Step 4 (Registry Check) တွင် `invitation.template_id` ကို `registry.json` ထဲ၌ ရှာမတွေ့ပါက `showError('template-error')` မခေါ်ဘဲ `registry.find(t => t.available === true)` (ဥပမာ `'floral-pink'`) သို့ အလိုအလျောက် ပြောင်းလဲဖွင့်ပေးပါ-

```javascript
let templateMeta = registry.find(
  t => t.id === invitation.template_id && t.available === true
);

if (!templateMeta) {
  console.warn(`[engine.js] Template "${invitation.template_id}" unavailable. Falling back to default available template.`);
  templateMeta = registry.find(t => t.available === true) || { id: 'floral-pink', available: true };
  invitation.template_id = templateMeta.id;
}
```

#### (င) Top-Level Try/Catch တွင်လည်း Emergency Render ထားရှိရန်
`initEngine()` ၏ `catch (err)` block တွင် မမျှော်လင့်ထားသော Error တစ်ခုခု ဖြစ်ပေါ်ခဲ့လျှင်ပင် `showError()` မပြမီ `templates/floral-pink/layout.html` ကို Emergency Fallback အဖြစ် ဆွဲတင်ပေးရန် ရေးသားပါ။

### Step 4: `supabase/schema.sql` နှင့် Cache Version (`?v=4`) အဆင့်မြှင့်ရန်

1. `supabase/schema.sql` ရှိ Sample Invitation 1 (`ko-aung-ma-thandar-2025`) ၏ `template_id` ကို `'royal-gold'` အစား `'floral-pink'` သို့ ပြောင်းလဲပါ။
2. `supabase/schema.sql` တွင် Default စုံတွဲ (`heinthu-aung-pan-ei-phyu-2026`, `template_id: 'floral-pink'`) ကိုလည်း Seed Data အဖြစ် ထပ်ဖြည့်ပေးပါ။
3. `AGENTS.md` Rule 0.4.2 အရ `index.html`၊ `admin.html`၊ `partner.html` နှင့် `js/engine.js` တို့ရှိ CSS/JS/JSON/HTML asset URL များအားလုံးကို `?v=3` မှ `?v=4` သို့ အဆင့်မြှင့်တင်ပါ။

## ၄။ Agent ကိုယ်တိုင် စစ်ဆေးရမည့် အတည်ပြုချက်များ (Self-Verification Checklist)

Code ပြင်ဆင်ပြီးနောက် Agent သည် အောက်ပါ အခြေအနေ (၄) ရပ်လုံး အောင်မြင်ကြောင်း စစ်ဆေးအတည်ပြုပေးရမည်-

1. **Direct URL Test (`index.html`)**: `?id=` လုံးဝ မပါဘဲ `index.html` ကို တိုက်ရိုက်ဖွင့်သည့်အခါ Error Screen လုံးဝမပေါ်ဘဲ `"ကိုဟိန်းသူအောင် ♥ မပန်းအိဖြူ"` ၏ `floral-pink` ဖိတ်စာ (စာအိတ်ဖွင့်သည့် Animation၊ သီချင်းခလုတ်၊ Countdown Timer၊ ဆုမွန်ကောင်း ফর্ম အပါအဝင်) တိုက်ရိုက် ပွင့်လာရမည်။
2. **Supabase Paused / Offline Test**: Internet ပိတ်ထားချိန် သို့မဟုတ် Supabase URL မှားနေချိန်တွင် `index.html` သို့မဟုတ် `index.html?id=ko-zaw-ma-aye-2025` ကို ဖွင့်ပါက Error Screen မပြဘဲ `data/fallback-invitations.json` သို့မဟုတ် Default ဖိတ်စာမှတစ်ဆင့် ချက်ချင်း ပွင့်လာရမည်။
3. **CDN Blocked Test**: `cdn.jsdelivr.net` ကို ပိတ်ထားသည့်တိုင် Guest Page (`index.html`) သည် Loading Screen တွင် ရပ်မနေဘဲ ၂ စက္ကန့်အတွင်း ပွင့်လာရမည်။
4. **Missing Template Test (`?id=ko-aung-ma-thandar-2025`)**: Database ထဲတွင် `template_id: 'royal-gold'` ဖြစ်နေသော်လည်း Template Error မတက်ဘဲ `floral-pink` template သို့ အလိုအလျောက် ပြောင်းလဲပွင့်လာရမည်။
