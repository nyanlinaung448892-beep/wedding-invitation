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
    ERROR_LOGS  : 'error_logs',
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
        reportSystemError({
            severity: 'error',
            source: 'partner',
            message: `Partner Login RPC Failed: ${error.message}`,
            details: { code: error.code, details: error.details, partnerCode, email: email ? `${email.slice(0, 3)}***` : null }
        });
        throw new Error(error.message);
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
        reportSystemError({
            severity: 'error',
            source: 'partner',
            message: `Fetch Partner Invitations RPC Failed: ${error.message}`,
            details: { code: error.code, details: error.details, partnerCode }
        });
        throw new Error(error.message);
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

// ─── 8-Character Random Partner Code Generator Utilities ──────────────────────

/**
 * Safe uppercase alphanumeric character set excluding visually ambiguous
 * characters like '0', 'O', '1', 'I', and 'L'.
 * Character count: 32 (Entropy: 32^8 = 1.0995 × 10^12 combinations).
 */
export const SAFE_PARTNER_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically random, human-friendly 8-character partner code.
 * @param {number} [length=8]
 * @returns {string} e.g. "K7M9P2X4"
 */
export function generatePartnerCode(length = 8) {
    const chars = SAFE_PARTNER_CODE_CHARS;
    const charsLen = chars.length;
    let result = '';

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const randomValues = new Uint8Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += chars[randomValues[i] % charsLen];
        }
    } else {
        // Fallback for non-crypto environments
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * charsLen)];
        }
    }
    return result;
}

/**
 * Checks whether a given partner code is currently unused in the database.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function isPartnerCodeAvailable(code) {
    if (!code || typeof code !== 'string') return false;
    const cleanCode = code.trim().toUpperCase();
    try {
        const sb = await getSupabaseClient();
        const { data, error } = await sb
            .from(TABLES.PARTNERS)
            .select('id')
            .eq('partner_code', cleanCode)
            .limit(1);

        if (error) {
            console.warn('[supabase-config] isPartnerCodeAvailable check error:', error.message);
            return true;
        }
        return !data || data.length === 0;
    } catch (err) {
        console.warn('[supabase-config] isPartnerCodeAvailable exception:', err);
        return true;
    }
}

/**
 * Generates an 8-character partner code verified to be unique in the database.
 * @param {number} [length=8]
 * @param {number} [maxAttempts=5]
 * @returns {Promise<string>}
 */
export async function generateUniquePartnerCode(length = 8, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = generatePartnerCode(length);
        const available = await isPartnerCodeAvailable(candidate);
        if (available) {
            return candidate;
        }
    }
    return generatePartnerCode(length);
}

// ─── Base URL & Custom Domain Foundation (Single Source of Truth) ─────────────
// Digital Wedding Invitation URL & QR Link Resolver
// When a custom domain is connected in the future, setting CUSTOM_DOMAIN here
// (e.g. 'https://mingalarwedding.com') will immediately route all QR codes and
// invitation links to the new domain across the entire platform.

export const CUSTOM_DOMAIN = null; // e.g. 'https://mingalarwedding.com' or null for auto-detect

/**
 * Returns the base URL for the invitation platform.
 * Automatically resolves current host & directory (e.g. GitHub Pages or Localhost),
 * or falls back to CUSTOM_DOMAIN if configured.
 * @param {string} [customDomainOverride] - Optional override
 * @returns {string} - e.g. "https://username.github.io/repo/" or "http://localhost:3000/"
 */
export function getBaseUrl(customDomainOverride = null) {
    if (customDomainOverride && typeof customDomainOverride === 'string' && customDomainOverride.trim()) {
        let base = customDomainOverride.trim();
        if (!base.endsWith('/')) base += '/';
        return base;
    }
    if (CUSTOM_DOMAIN && typeof CUSTOM_DOMAIN === 'string' && CUSTOM_DOMAIN.trim()) {
        let base = CUSTOM_DOMAIN.trim();
        if (!base.endsWith('/')) base += '/';
        return base;
    }
    if (typeof window !== 'undefined' && window.location) {
        const pathname = window.location.pathname;
        const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1) || '/';
        return `${window.location.origin}${dir}`;
    }
    return '/';
}

/**
 * Resolves the full URL for a digital invitation given its slug.
 * @param {string} slug - The invitation slug (e.g. "min-and-su")
 * @param {string} [customDomain] - Optional custom domain override
 * @returns {string} - Full digital invitation landing page URL
 */
export function resolveInvitationUrl(slug, customDomain = null) {
    if (!slug || typeof slug !== 'string') return '';
    const base = getBaseUrl(customDomain);
    return `${base}index.html?id=${encodeURIComponent(slug.trim())}`;
}

// ─── Centralized Error Management & Logging Engine (Phase 8) ──────────────────

/**
 * Asynchronously logs an error report to Supabase public.error_logs without blocking the UI.
 * Pure native fetch (Zero-dependency, works seamlessly in Landing, Partner, Engine, Admin).
 * Fail-safe: if Supabase is unreachable, logs to console and returns false without breaking caller flow.
 * @param {Object} options
 * @param {'info'|'warning'|'error'|'critical'} [options.severity='error']
 * @param {'landing'|'partner'|'admin'|'engine'|'network'} [options.source='landing']
 * @param {string} options.message
 * @param {Object} [options.details={}]
 * @param {string} [options.url]
 * @returns {Promise<boolean>}
 */
export async function reportSystemError({ severity = 'error', source = 'landing', message, details = {}, url = null } = {}) {
    try {
        const payload = {
            severity   : ['info', 'warning', 'error', 'critical'].includes(severity) ? severity : 'error',
            source     : ['landing', 'partner', 'admin', 'engine', 'network'].includes(source) ? source : 'landing',
            message    : String(message || 'Unknown system anomaly').slice(0, 2000),
            details    : typeof details === 'object' && details !== null ? details : { raw: String(details) },
            url        : String(url || (typeof window !== 'undefined' ? window.location.href : '')).slice(0, 1000),
            user_agent : typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.ERROR_LOGS}`, {
            method : 'POST',
            headers: {
                'apikey'       : SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type' : 'application/json',
                'Prefer'       : 'return=minimal',
            },
            body: JSON.stringify(payload)
        });

        return res.ok;
    } catch (err) {
        console.warn('[supabase-config] Failed to dispatch error log:', err?.message);
        return false;
    }
}

/**
 * Fetches system error logs for Admin Dashboard.
 * Protected by Supabase Auth (authenticated role).
 * @param {Object} [options]
 * @param {'all'|'unresolved'|'resolved'} [options.statusFilter='all']
 * @param {string} [options.severityFilter='all']
 * @param {number} [options.limit=100]
 * @returns {Promise<Array>}
 */
export async function fetchSystemErrorLogs({ statusFilter = 'all', severityFilter = 'all', limit = 100 } = {}) {
    const sb = await getSupabaseClient();
    let query = sb.from(TABLES.ERROR_LOGS).select('*').order('created_at', { ascending: false }).limit(limit);

    if (statusFilter === 'unresolved') {
        query = query.eq('is_resolved', false);
    } else if (statusFilter === 'resolved') {
        query = query.eq('is_resolved', true);
    }

    if (severityFilter && severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
    }

    const { data, error } = await query;
    if (error) {
        console.error('[supabase-config] fetchSystemErrorLogs error:', error.message);
        throw error;
    }
    return Array.isArray(data) ? data : [];
}

/**
 * Updates an error log resolution status.
 * @param {string} id
 * @param {boolean} isResolved
 * @returns {Promise<boolean>}
 */
export async function resolveSystemErrorLog(id, isResolved = true) {
    if (!id) return false;
    const sb = await getSupabaseClient();
    const { error } = await sb.from(TABLES.ERROR_LOGS).update({ is_resolved: isResolved }).eq('id', id);
    if (error) {
        console.error('[supabase-config] resolveSystemErrorLog error:', error.message);
        throw error;
    }
    return true;
}

/**
 * Clears/deletes all resolved error logs.
 * @returns {Promise<boolean>}
 */
export async function clearResolvedErrorLogs() {
    const sb = await getSupabaseClient();
    const { error } = await sb.from(TABLES.ERROR_LOGS).delete().eq('is_resolved', true);
    if (error) {
        console.error('[supabase-config] clearResolvedErrorLogs error:', error.message);
        throw error;
    }
    return true;
}




