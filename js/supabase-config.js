// =============================================================================
// js/supabase-config.js
// Supabase Client Initialization
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

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── Configuration ────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://kweylhqnzqnxnopqwrhj.supabase.co';   // ← သင့် Project URL ထည့်ပါ
const SUPABASE_ANON_KEY = 'sb_publishable_kb9dPHYc_1SgGGsTKQG3-g_CdBFPUmz';                // ← သင့် Anon Key ထည့်ပါ

// ─── Storage Bucket Name ──────────────────────────────────────────────────────

export const STORAGE_BUCKET = 'wedding-media';

// ─── Table Names (centralised — easy to rename later) ────────────────────────

export const TABLES = {
    INVITATIONS : 'invitations',
    PARTNERS    : 'partners',
};

// ─── Supabase Client ──────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Admin dashboard uses Supabase email/password auth
        persistSession    : true,
        autoRefreshToken  : true,
        detectSessionInUrl: true,
    },
});

// ─── Helper: Get public CDN URL for a storage file ───────────────────────────

/**
 * Returns the public CDN URL for a file in the wedding-media bucket.
 * @param {string} filePath  - Path inside the bucket, e.g. 'couples/photo.jpg'
 * @returns {string}         - Full public URL
 */
export function getPublicUrl(filePath) {
    if (!filePath) return '';
    const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
    return data?.publicUrl ?? '';
}

// ─── Helper: Fetch invitation record by slug (used by engine.js) ─────────────

/**
 * Fetches a single active invitation by its URL slug.
 * Uses the anon key — RLS ensures only is_active=true rows are returned.
 * @param {string} slug  - e.g. 'ko-aung-ma-thandar-2025'
 * @returns {Promise<Object|null>}
 */
export async function fetchInvitationBySlug(slug) {
    const { data, error } = await supabase
        .from(TABLES.INVITATIONS)
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error) {
        console.error('[supabase-config] fetchInvitationBySlug error:', error.message);
        return null;
    }
    return data;
}

// ─── Helper: Fetch all partners (used by admin.js & partner.js) ──────────────

/**
 * Fetches all partner records.
 * @returns {Promise<Array>}
 */
export async function fetchAllPartners() {
    const { data, error } = await supabase
        .from(TABLES.PARTNERS)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[supabase-config] fetchAllPartners error:', error.message);
        return [];
    }
    return data ?? [];
}

// ─── Helper: Fetch partner by partner_code + passcode (Partner login) ─────────

/**
 * Validates partner login credentials via secure RPC.
 * Does not expose the partners table or passcodes to anon SELECT.
 * @param {string} partnerCode  - e.g. 'SHOP-001'
 * @param {string} passcode     - Partner's passcode
 * @returns {Promise<Object|null>}  - Safe partner row or null if not found/wrong credentials
 */
export async function authenticatePartner(partnerCode, passcode) {
    if (!partnerCode || !passcode) return null;
    const { data, error } = await supabase.rpc('verify_partner_login', {
        p_partner_code: partnerCode.trim(),
        p_passcode: passcode.trim(),
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
    const { data, error } = await supabase.rpc('get_partner_invitations', {
        p_partner_code: partnerCode.trim(),
        p_passcode: passcode.trim(),
    });

    if (error) {
        console.error('[supabase-config] fetchPartnerInvitations error:', error.message);
        return [];
    }
    return Array.isArray(data) ? data : [];
}

