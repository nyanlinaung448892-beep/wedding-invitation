// =============================================================================
// js/supabase-config.js
// Supabase Client + CDN-Independent Guest REST Fetch
// Digital Wedding Invitation Platform
// =============================================================================
//
// ⚠️  IMPORTANT: Replace the placeholder values below with your actual
//     Supabase Project URL and Anon Key from:
//     Supabase Dashboard → Project Settings → API
//
// GitHub Pages ဖြင့် Host မလုပ်မချင်း ဒီဖိုင်ကို .gitignore မထည့်ပါနှင့်။
// Anon Key သည် public ဖြစ်သည် — RLS Policies မှ လုံခြုံမှုကို ကာကွယ်သည်။
// =============================================================================

// ─── Configuration (exported for use in engine.js) ───────────────────────────

export const SUPABASE_URL     = 'https://kweylhqnzqnxnopqwrhj.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_kb9dPHYc_1SgGGsTKQG3-g_CdBFPUmz';

// ─── Storage Bucket Name ──────────────────────────────────────────────────────

export const STORAGE_BUCKET = 'wedding-media';

// ─── Table Names (centralised — easy to rename later) ────────────────────────

export const TABLES = {
    INVITATIONS : 'invitations',
    PARTNERS    : 'partners',
    WISHES      : 'wishes',
};

// ─── CDN-Independent Supabase Client (lazy loaded — Admin/Partner only) ───────
// Guest page (engine.js) does NOT use createClient to avoid jsdelivr CDN dependency.
// Admin/Partner pages import this and then call getSupabaseClient().

let _supabaseClient = null;

/**
 * Lazily initialises and returns the Supabase JS SDK client.
 * Uses a dynamic import so that if the CDN is unreachable, only admin/partner
 * pages are affected — NOT the guest invitation page.
 * @returns {Promise<import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').SupabaseClient>}
 */
export async function getSupabaseClient() {
    if (_supabaseClient) return _supabaseClient;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession    : true,
            autoRefreshToken  : true,
            detectSessionInUrl: true,
        },
    });
    return _supabaseClient;
}

// ─── Convenience alias: supabase (used by admin.js / partner.js) ──────────────
// These files do: import { supabase } from './supabase-config.js'
// Lazy-loading facade — the real Supabase SDK client is loaded on first use.
// Maintains full backward-compat with admin.js / partner.js method-chain style:
//   const { data } = await supabase.from('table').select('*');

function _makeChainProxy(promiseFn) {
    return new Proxy({}, {
        get(_t, prop) {
            if (prop === 'then' || prop === 'catch' || prop === 'finally') {
                const p = promiseFn();
                return p[prop].bind(p);
            }
            return (...args) => _makeChainProxy(() => promiseFn().then(r => r[prop](...args)));
        }
    });
}

export const supabase = new Proxy({}, {
    get(_target, topProp) {
        const targetPromise = getSupabaseClient().then(client => client[topProp]);
        return new Proxy((...args) => _makeChainProxy(() => getSupabaseClient().then(c => c[topProp](...args))), {
            get(_t, subProp) {
                if (subProp === 'then' || subProp === 'catch' || subProp === 'finally') {
                    return targetPromise[subProp].bind(targetPromise);
                }
                return (...subArgs) => _makeChainProxy(() => getSupabaseClient().then(c => c[topProp][subProp](...subArgs)));
            }
        });
    }
});

// ─── CDN-Safe Guest Fetch: Native fetch() + AbortController ──────────────────
// This function deliberately avoids the @supabase/supabase-js SDK so that
// guest invitations load even when cdn.jsdelivr.net is blocked.

/**
 * Fetches a single active invitation by its URL slug using native fetch().
 * Falls back gracefully if Supabase is unreachable or times out.
 *
 * @param {string} slug       - e.g. 'ko-aung-ma-thandar-2025'
 * @param {number} timeoutMs  - Abort timeout in ms (default 5000)
 * @returns {Promise<Object|null>}
 */
export async function fetchInvitationBySlug(slug, timeoutMs = 5000) {
    if (!slug) return null;
    const cleanSlug = String(slug).trim().toLowerCase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLES.INVITATIONS}` +
                    `?select=*&slug=ilike.${encodeURIComponent(cleanSlug)}&is_active=eq.true&limit=1`;

        const res = await fetch(url, {
            method : 'GET',
            headers: {
                'apikey'       : SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept'       : 'application/json',
            },
            signal: controller.signal,
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

/**
 * Fetches the most recently created active invitation using native fetch().
 * Used when user enters root landing page without slug parameter.
 * @param {number} timeoutMs
 * @returns {Promise<Object|null>}
 */
export async function fetchLatestActiveInvitation(timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLES.INVITATIONS}` +
                    `?select=*&is_active=eq.true&order=created_at.desc&limit=1`;

        const res = await fetch(url, {
            method : 'GET',
            headers: {
                'apikey'       : SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept'       : 'application/json',
            },
            signal: controller.signal,
        });

        if (!res.ok) {
            throw new Error(`Supabase HTTP ${res.status}`);
        }

        const rows = await res.json();
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    } catch (err) {
        console.warn('[supabase-config] fetchLatestActiveInvitation failed or timed out:', err.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ─── Guest Wishes Helpers (Native fetch — Zero-Downtime CDN Safe) ─────────────

/**
 * Fetches all approved/recent guest wishes for a given invitation slug from Supabase.
 * @param {string} slug
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function fetchWishesBySlug(slug, limit = 50) {
    if (!slug) return [];
    const cleanSlug = String(slug).trim().toLowerCase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLES.WISHES}` +
                    `?select=id,invitation_slug,name,message,created_at` +
                    `&invitation_slug=eq.${encodeURIComponent(cleanSlug)}` +
                    `&order=created_at.desc&limit=${limit}`;

        const res = await fetch(url, {
            method : 'GET',
            headers: {
                'apikey'       : SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept'       : 'application/json',
            },
            signal: controller.signal,
        });

        if (!res.ok) {
            return [];
        }

        const rows = await res.json();
        return Array.isArray(rows) ? rows : [];

    } catch (err) {
        console.warn('[supabase-config] fetchWishesBySlug failed or timed out:', err.message);
        return [];
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Submits a new guest blessing/wish to Supabase.
 * @param {Object} param0
 * @param {string} param0.slug
 * @param {string} param0.name
 * @param {string} param0.message
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function submitGuestWish({ slug, name, message }) {
    if (!slug || !name || !message) {
        return { success: false, error: 'အမည်နှင့် ဆုမွန်ကောင်းစာသား ဖြည့်စွက်ပေးပါ။' };
    }

    const cleanSlug = String(slug).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanMsg  = String(message).trim();

    const payload = {
        invitation_slug: cleanSlug,
        name           : cleanName,
        message        : cleanMsg
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLES.WISHES}`;
        const res = await fetch(url, {
            method : 'POST',
            headers: {
                'apikey'       : SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type' : 'application/json',
                'Prefer'       : 'return=representation'
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP ${res.status}`);
        }

        const rows = await res.json();
        const createdWish = Array.isArray(rows) && rows.length > 0 ? rows[0] : payload;
        return { success: true, data: createdWish };

    } catch (err) {
        console.warn('[supabase-config] submitGuestWish error:', err.message);
        return { success: false, error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

// ─── Admin/Partner Helpers (use SDK via getSupabaseClient) ───────────────────

/**
 * Fetches all partner records. (Admin use only — requires authenticated session)
 * @returns {Promise<Array>}
 */
export async function fetchAllPartners() {
    const sb = await getSupabaseClient();
    const { data, error } = await sb
        .from(TABLES.PARTNERS)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[supabase-config] fetchAllPartners error:', error.message);
        return [];
    }
    return data ?? [];
}

// ─── Helper: Get public CDN URL for a storage file ───────────────────────────

/**
 * Returns the public CDN URL for a file in the wedding-media bucket.
 * @param {string} filePath  - Path inside the bucket, e.g. 'couples/photo.jpg'
 * @returns {Promise<string>} - Full public URL
 */
export async function getPublicUrl(filePath) {
    if (!filePath) return '';
    const sb = await getSupabaseClient();
    const { data } = sb.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
    return data?.publicUrl ?? '';
}

// ─── Helper: Authenticate partner via Supabase RPC ───────────────────────────

/**
 * Validates partner login credentials via secure RPC.
 * Supports (email, partnerCode, passcode) or legacy (partnerCode, passcode).
 * Does not expose the partners table or passcodes to anon SELECT.
 * @param {string} [emailOrCode]
 * @param {string} [codeOrPass]
 * @param {string} [passcode]
 * @returns {Promise<Object|null>}
 */
export async function authenticatePartner(arg1, arg2, arg3) {
    let email = null;
    let partnerCode = '';
    let passcode = '';

    if (arg3 !== undefined) {
        email = String(arg1 || '').trim().toLowerCase();
        partnerCode = String(arg2 || '').trim().toUpperCase();
        passcode = String(arg3 || '').trim();
    } else {
        partnerCode = String(arg1 || '').trim().toUpperCase();
        passcode = String(arg2 || '').trim();
    }

    if (!partnerCode || !passcode) return null;
    const sb = await getSupabaseClient();
    const params = email
        ? { p_email: email, p_partner_code: partnerCode, p_passcode: passcode }
        : { p_partner_code: partnerCode, p_passcode: passcode };

    const { data, error } = await sb.rpc('verify_partner_login', params);

    if (error) {
        console.warn('[supabase-config] authenticatePartner error:', error.message);
        return null;
    }
    return data;
}

// ─── Helper: Fetch partner invitations via secure RPC ────────────────────────

/**
 * Securely fetches all referral invitations for a verified partner.
 * Supports (email, partnerCode, passcode) or legacy (partnerCode, passcode).
 * Includes both active and inactive invitations so partner stats remain accurate.
 * @param {string} [emailOrCode]
 * @param {string} [codeOrPass]
 * @param {string} [passcode]
 * @returns {Promise<Array>}
 */
export async function fetchPartnerInvitations(arg1, arg2, arg3) {
    let email = null;
    let partnerCode = '';
    let passcode = '';

    if (arg3 !== undefined) {
        email = String(arg1 || '').trim().toLowerCase();
        partnerCode = String(arg2 || '').trim().toUpperCase();
        passcode = String(arg3 || '').trim();
    } else {
        partnerCode = String(arg1 || '').trim().toUpperCase();
        passcode = String(arg2 || '').trim();
    }

    if (!partnerCode || !passcode) return [];
    const sb = await getSupabaseClient();
    const params = email
        ? { p_email: email, p_partner_code: partnerCode, p_passcode: passcode }
        : { p_partner_code: partnerCode, p_passcode: passcode };

    const { data, error } = await sb.rpc('get_partner_invitations', params);

    if (error) {
        console.error('[supabase-config] fetchPartnerInvitations error:', error.message);
        return [];
    }
    return Array.isArray(data) ? data : [];
}

// ─── Multi-Category Helper Utilities ──────────────────────────────────────────

/**
 * Derives a human-readable title for any invitation or profile across categories.
 * Fallback order: record.title -> customer_data.display_title ->
 * Wedding couple names -> Birthday celebrant -> Business company name -> slug
 * @param {Object} record - Invitation row
 * @returns {string}
 */
export function resolveDisplayTitle(record = {}) {
    if (record.title && String(record.title).trim()) {
        return String(record.title).trim();
    }
    const customer = record.customer_data || {};
    if (customer.display_title && String(customer.display_title).trim()) {
        return String(customer.display_title).trim();
    }
    const couple = [customer.groom_name, customer.bride_name].filter(Boolean).join(' & ');
    if (couple) return couple;
    if (customer.celebrant_name) return `${customer.celebrant_name}${customer.turning_age ? ` (${customer.turning_age} နှစ်ပြည့် မွေးနေ့)` : ' ၏ မွေးနေ့'}`;
    if (customer.company_name) return customer.company_name;
    if (customer.donor_name) return `${customer.donor_name} အလှူတော်မင်္ဂလာ`;
    return record.slug || 'အမည်မသတ်မှတ်ရသေးပါ';
}

/**
 * Fetches invitations filtered by category (e.g. 'wedding', 'birthday', 'business').
 * @param {string} category
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
export async function fetchInvitationsByCategory(category, limit = 100) {
    const sb = await getSupabaseClient();
    let query = sb
        .from(TABLES.INVITATIONS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (category && category !== 'all') {
        query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
        console.error('[supabase-config] fetchInvitationsByCategory error:', error.message);
        return [];
    }
    return data ?? [];
}

