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
        return (...topArgs) => _makeChainProxy(
            () => getSupabaseClient().then(client => client[topProp](...topArgs))
        );
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
 * Does not expose the partners table or passcodes to anon SELECT.
 * @param {string} partnerCode  - e.g. 'SHOP-001'
 * @param {string} passcode     - Partner's passcode
 * @returns {Promise<Object|null>}  - Safe partner row or null if not found/wrong credentials
 */
export async function authenticatePartner(partnerCode, passcode) {
    if (!partnerCode || !passcode) return null;
    const sb = await getSupabaseClient();
    const { data, error } = await sb.rpc('verify_partner_login', {
        p_partner_code: partnerCode.trim(),
        p_passcode    : passcode.trim(),
    });

    if (error) {
        console.warn('[supabase-config] authenticatePartner error:', error.message);
        return null;
    }
    return data;
}

// ─── Helper: Fetch partner invitations via secure RPC ────────────────────────

/**
 * Securely fetches all referral invitations for a verified partner.
 * Includes both active and inactive invitations so partner stats remain accurate.
 * @param {string} partnerCode
 * @param {string} passcode
 * @returns {Promise<Array>}
 */
export async function fetchPartnerInvitations(partnerCode, passcode) {
    if (!partnerCode || !passcode) return [];
    const sb = await getSupabaseClient();
    const { data, error } = await sb.rpc('get_partner_invitations', {
        p_partner_code: partnerCode.trim(),
        p_passcode    : passcode.trim(),
    });

    if (error) {
        console.error('[supabase-config] fetchPartnerInvitations error:', error.message);
        return [];
    }
    return Array.isArray(data) ? data : [];
}
