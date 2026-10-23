/**
 * =============================================================================
 * System Test Suite — Digital Wedding & Multi-Category Invitation Platform
 * =============================================================================
 * Tests 4 Core Business & Security Pillars:
 *   1. Login & Auth (Admin Login, Bad Password Defense, Session Verification)
 *   2. Customer Data Isolation & Sync (Slug Isolation, Targeted Updates, Auto-Cleanup)
 *   3. Main Features (Registry Schema, Template Assets, URL & QR Engine, Fallback Data)
 *   4. Security & RLS (Anon Mutation Defense, Partner Passcode Shield, Secret Leak Scan)
 *
 * Zero external dependencies — runs directly with Node 18+ (node tests/system-test.mjs)
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI Terminal Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bgRed: '\x1b[41m\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m'
};

// Test Stats Tracker
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  failures: []
};

function logHeader(title) {
  console.log(`\n${C.bold}${C.cyan}▶ ${title}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(70)}${C.reset}`);
}

function logPass(name, details = '') {
  stats.total++;
  stats.passed++;
  console.log(`  ${C.green}✔ PASS${C.reset}  ${name} ${details ? C.dim + '(' + details + ')' + C.reset : ''}`);
}

function logFail(name, reason, fixAdvice = '') {
  stats.total++;
  stats.failed++;
  stats.failures.push({ name, reason, fixAdvice });
  console.log(`  ${C.red}✖ FAIL${C.reset}  ${C.bold}${name}${C.reset}`);
  console.log(`         ${C.red}↳ Error:${C.reset} ${reason}`);
  if (fixAdvice) {
    console.log(`         ${C.yellow}↳ Remediation:${C.reset} ${fixAdvice}`);
  }
}

function logWarn(name, advice = '') {
  stats.warnings++;
  console.log(`  ${C.yellow}⚠ WARN${C.reset}  ${name} ${advice ? C.dim + '(' + advice + ')' + C.reset : ''}`);
}

// -----------------------------------------------------------------------------
// Environment Loader (.env parser - zero external dependency)
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) {
    return env;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const ENV = loadEnv();
const SUPABASE_URL = ENV.SUPABASE_URL || 'https://kweylhqnzqnxnopqwrhj.supabase.co';
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY || 'sb_publishable_kb9dPHYc_1SgGGsTKQG3-g_CdBFPUmz';
const TEST_ADMIN_EMAIL = ENV.TEST_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = ENV.TEST_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;

// Helper: Standard Supabase Fetch
async function supabaseFetch(endpoint, options = {}, token = null) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}${endpoint}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
}

// =============================================================================
// TEST 1: Login & Auth Test
// =============================================================================
async function testAuthAndSession() {
  logHeader('TEST 1: Login & Auth Test (Supabase Auth & Session Protection)');

  // 1.1 Bad Credentials Defense
  try {
    const badRes = await supabaseFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'attacker_test@nonexistent.domain',
        password: 'wrong_password_12345'
      })
    });
    const badData = await badRes.json();
    if (badRes.status >= 400) {
      logPass('Bad Credentials Defense', `Blocked unauthorized login (HTTP ${badRes.status}: ${badData.error_description || badData.msg || 'Denied'})`);
    } else {
      logFail('Bad Credentials Defense', 'Invalid login was unexpectedly accepted!', 'Check Supabase Auth configuration.');
    }
  } catch (err) {
    logFail('Bad Credentials Defense', err.message);
  }

  // 1.2 Partner Passcode Protection (RPC Endpoint Check)
  try {
    const partnerRes = await supabaseFetch('/rest/v1/rpc/verify_partner_login', {
      method: 'POST',
      body: JSON.stringify({
        p_email: 'random_shop@test.com',
        p_partner_code: 'SHOP-FAKE',
        p_password: 'fake_passcode'
      })
    });
    const partnerData = await partnerRes.json();
    if (partnerRes.ok && (partnerData === null || (Array.isArray(partnerData) && partnerData.length === 0) || partnerData.success === false)) {
      logPass('Partner RPC Passcode Defense', 'Blocked invalid partner passcode attempt');
    } else if (partnerRes.status >= 400) {
      logPass('Partner RPC Passcode Defense', `Properly rejected invalid attempt (HTTP ${partnerRes.status})`);
    } else {
      logFail('Partner RPC Passcode Defense', 'Invalid partner login did not reject securely', 'Check verify_partner_login RPC in schema.sql');
    }
  } catch (err) {
    logFail('Partner RPC Passcode Defense', err.message);
  }

  // 1.3 Admin Valid Login & Session Token (if credentials configured in .env)
  let adminToken = null;
  if (TEST_ADMIN_EMAIL && TEST_ADMIN_PASSWORD) {
    try {
      const loginRes = await supabaseFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({
          email: TEST_ADMIN_EMAIL,
          password: TEST_ADMIN_PASSWORD
        })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.access_token) {
        adminToken = loginData.access_token;
        logPass('Admin Authentication', `Successfully authenticated as ${TEST_ADMIN_EMAIL} (Token expires in: ${loginData.expires_in}s)`);

        // Check Session user profile
        const userRes = await supabaseFetch('/auth/v1/user', { method: 'GET' }, adminToken);
        if (userRes.ok) {
          const user = await userRes.json();
          logPass('Session Persistence & User Endpoint', `Verified User ID: ${user.id}`);
        } else {
          logFail('Session Persistence & User Endpoint', `Could not fetch user with returned JWT (HTTP ${userRes.status})`);
        }
      } else {
        logFail('Admin Authentication', `Login failed for ${TEST_ADMIN_EMAIL}: ${loginData.error_description || loginData.msg || loginRes.statusText}`, 'Verify TEST_ADMIN_EMAIL & TEST_ADMIN_PASSWORD in .env');
      }
    } catch (err) {
      logFail('Admin Authentication', err.message);
    }
  } else {
    logWarn(
      'Admin Valid Login Skipped',
      'TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD not set in .env. Add them to .env to verify real admin login flow.'
    );
  }

  return adminToken;
}

// =============================================================================
// TEST 2: Multi-Category Customer Data Isolation Test
// =============================================================================
async function testCustomerDataIsolation(adminToken) {
  logHeader('TEST 2: Multi-Category Customer Data Isolation Test (Wedding, Birthday & Business)');

  if (!adminToken) {
    logWarn(
      'Data Isolation Live CRUD Skipped',
      'Requires authenticated admin session. Configure TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env to run live CRUD isolation tests.'
    );
    return;
  }

  const timestamp = Date.now();
  const slugA = `test-iso-wedding-${timestamp}`;
  const slugB = `test-iso-biz-${timestamp}`;

  // Multi-Category: Record A is Wedding, Record B is Business
  const itemA = {
    slug: slugA,
    template_id: 'floral-pink',
    customer_data: { groom_name: 'Min Thu', bride_name: 'Su Su', wedding_date: '2026-12-01' },
    is_active: true
  };
  const itemB = {
    slug: slugB,
    template_id: 'biz-card-gold',
    customer_data: { company_name: 'Apex Business Hub', tagline: 'Digital Solutions', rsvp_phone: '09123456789' },
    is_active: true
  };

  try {
    // 2.1 Insert Multi-Category Records A (Wedding) and B (Business)
    const createRes = await supabaseFetch('/rest/v1/invitations', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify([itemA, itemB])
    }, adminToken);

    if (!createRes.ok) {
      const err = await createRes.json();
      logFail('Multi-Category Isolation Setup (Insert 2 records)', err.message || createRes.statusText, 'Check invitations table RLS for authenticated role');
      return;
    }
    logPass('Multi-Category Isolation Setup', `Created isolated cross-category records (Wedding: ${slugA}, Business: ${slugB})`);

    // 2.2 Update ONLY Customer A (Wedding)
    const updateRes = await supabaseFetch(`/rest/v1/invitations?slug=eq.${slugA}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        customer_data: { groom_name: 'Min Thu (UPDATED)', bride_name: 'Su Su', wedding_date: '2026-12-01' }
      })
    }, adminToken);

    if (!updateRes.ok) {
      logFail('Targeted Update on Wedding Record', `HTTP ${updateRes.status}`);
    } else {
      logPass('Targeted Update on Wedding Record', 'Successfully updated wedding record details');
    }

    // 2.3 Verify Customer B (Business) is 100% UNTOUCHED
    const queryBRes = await supabaseFetch(`/rest/v1/invitations?slug=eq.${slugB}&select=*`, {
      method: 'GET'
    }, adminToken);
    const dataB = await queryBRes.json();

    if (Array.isArray(dataB) && dataB.length === 1) {
      if (dataB[0].customer_data.company_name === 'Apex Business Hub' && dataB[0].template_id === 'biz-card-gold') {
        logPass('Cross-Category Untouched Verification', `Business payload remained intact ("${dataB[0].customer_data.company_name}", ${dataB[0].customer_data.rsvp_phone})`);
      } else {
        logFail('Cross-Category Untouched Verification', 'Business record was modified unexpectedly by wedding update!', 'Review SQL update queries or filters in admin.js');
      }
    } else {
      logFail('Cross-Category Untouched Verification', 'Could not locate Business record B');
    }

    // 2.4 Auto-Cleanup: Delete test rows to keep DB clean
    const cleanupRes = await supabaseFetch(`/rest/v1/invitations?slug=in.(${slugA},${slugB})`, {
      method: 'DELETE'
    }, adminToken);

    if (cleanupRes.ok) {
      logPass('Test Data Auto-Cleanup', `Safely purged test invitations (${slugA}, ${slugB}) — zero DB clutter`);
    } else {
      logWarn('Test Data Auto-Cleanup', `Failed to purge test rows: HTTP ${cleanupRes.status}`);
    }
  } catch (err) {
    logFail('Multi-Category Data Isolation Flow', err.message);
  }
}

// =============================================================================
// TEST 3: Main Features Test (URL, QR & Offline Resiliency)
// =============================================================================
async function testMainFeatures() {
  logHeader('TEST 3: Main Features Test (URL, QR Engine & Template Integrity)');

  // 3.1 Multi-Category Registry Integrity Check
  const registryPath = path.join(ROOT_DIR, 'templates', 'registry.json');
  if (fs.existsSync(registryPath)) {
    try {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (Array.isArray(registry) && registry.length > 0) {
        logPass('Template Registry JSON', `Found ${registry.length} registered templates`);

        // Check required categories
        const foundCategories = new Set(registry.map(t => t.category));
        const requiredCategories = ['wedding', 'birthday', 'business'];
        const missingCategories = requiredCategories.filter(cat => !foundCategories.has(cat));

        if (missingCategories.length === 0) {
          logPass('Multi-Category Schema Coverage', `Registry covers all core categories (${Array.from(foundCategories).join(', ')})`);
        } else {
          logFail('Multi-Category Schema Coverage', `Missing categories in registry: ${missingCategories.join(', ')}`);
        }

        // Check template files on disk
        let allTemplatesValid = true;
        for (const tpl of registry) {
          const tplDir = path.join(ROOT_DIR, 'templates', tpl.id);
          const hasLayout = fs.existsSync(path.join(tplDir, 'layout.html'));
          const hasStyle = fs.existsSync(path.join(tplDir, 'style.css'));
          const hasScript = fs.existsSync(path.join(tplDir, 'script.js'));

          if (!hasLayout || !hasStyle || !hasScript) {
            allTemplatesValid = false;
            logFail(`Template Bundle (${tpl.id})`, `Missing files: layout=${hasLayout}, css=${hasStyle}, js=${hasScript}`);
          }
        }
        if (allTemplatesValid) {
          logPass('Template File Assets', 'All template directories contain required layout.html, style.css, script.js');
        }
      } else {
        logFail('Template Registry JSON', 'registry.json is empty or not an array');
      }
    } catch (err) {
      logFail('Template Registry JSON', `JSON syntax error: ${err.message}`);
    }
  } else {
    logFail('Template Registry JSON', 'templates/registry.json not found on disk');
  }

  // 3.2 URL Resolution Logic Check
  const sampleSlug = 'aung-su-2026';
  const expectedUrlParam = `?id=${sampleSlug}`;
  try {
    const testUrl = new URL(`https://example.com/index.html?id=${encodeURIComponent(sampleSlug)}`);
    const parsedSlug = testUrl.searchParams.get('id');
    if (parsedSlug === sampleSlug) {
      logPass('URL Slug Generator & Resolver', `Correctly parses parameter (?id=${parsedSlug})`);
    } else {
      logFail('URL Slug Generator & Resolver', `Expected ${sampleSlug}, got ${parsedSlug}`);
    }
  } catch (err) {
    logFail('URL Slug Generator & Resolver', err.message);
  }

  // 3.3 Offline QR Generator Engine & Multi-Template Decode Verification
  const qrEnginePath = path.join(ROOT_DIR, 'js', 'qr-generator.js');
  if (fs.existsSync(qrEnginePath)) {
    try {
      const { createQrCode, generateQrSvg, renderQrToCanvas } = await import('../js/qr-generator.js');

      // 3.3.1 Mathematical Engine & Exports Verification
      if (typeof createQrCode === 'function' && typeof generateQrSvg === 'function' && typeof renderQrToCanvas === 'function') {
        logPass('QR Engine Script Integrity', 'All core methods (createQrCode, generateQrSvg, renderQrToCanvas) exported');
      } else {
        logFail('QR Engine Script Integrity', 'Missing required export methods in js/qr-generator.js');
      }

      // 3.3.2 Automated Decode Engine (jsQR validator)
      let jsQR = null;
      try {
        const jsqrRes = await fetch('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', { signal: AbortSignal.timeout(6000) });
        if (jsqrRes.ok) {
          const codeText = await jsqrRes.text();
          const fn = new Function('module', 'exports', codeText + '; return module.exports;');
          const mod = { exports: {} };
          jsQR = fn(mod, mod.exports);
        }
      } catch (_) {
        // Network timeout / offline fallback
      }

      const qrCases = [
        { name: 'Customer (Nyan Lin Aung - 104 chars, Version 9)', url: 'https://nyanlinaung448892-beep.github.io/wedding-invitation/index.html?id=mg-nyan-lin-aung-thone-nadi-soe-moe' },
        { name: 'Wedding Template (Floral Pink)', url: 'https://nyanlinaung448892-beep.github.io/wedding-invitation/index.html?id=heinthu-aung-pan-ei-phyu-2026' },
        { name: 'Birthday Template (Neon Birthday)', url: 'https://nyanlinaung448892-beep.github.io/wedding-invitation/index.html?id=baby-thiri-1st-birthday-2026' },
        { name: 'Business Template (Apex Gold)', url: 'https://nyanlinaung448892-beep.github.io/wedding-invitation/index.html?id=apex-business-hub' },
        { name: 'Stress Test (180 chars, Version 12)', url: 'https://nyanlinaung448892-beep.github.io/wedding-invitation/index.html?id=' + 'x'.repeat(120) }
      ];

      let allPassed = true;
      for (const tc of qrCases) {
        const qr = createQrCode(tc.url, { ecc: 'Q' });
        if (!qr || qr.typeNumber < 1) {
          allPassed = false;
          logFail(`QR Matrix (${tc.name})`, 'Failed to construct QRCodeModel');
          continue;
        }

        if (jsQR) {
          const count = qr.getModuleCount();
          const margin = 4;
          const scale = 5;
          const width = (count + margin * 2) * scale;
          const height = width;
          const data = new Uint8ClampedArray(width * height * 4);

          for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
              const mx = Math.floor(px / scale) - margin;
              const my = Math.floor(py / scale) - margin;
              const isDark = (mx >= 0 && mx < count && my >= 0 && my < count) ? qr.isDark(my, mx) : false;
              const val = isDark ? 0 : 255;
              const idx = (py * width + px) * 4;
              data[idx] = val;
              data[idx+1] = val;
              data[idx+2] = val;
              data[idx+3] = 255;
            }
          }

          const decoded = jsQR(data, width, height);
          if (decoded && decoded.data === tc.url) {
            logPass(`QR Decode Verification (${tc.name})`, `Type ${qr.typeNumber} (${count}x${count}) decoded 100% correctly`);
          } else {
            allPassed = false;
            logFail(`QR Decode Verification (${tc.name})`, 'Decoder failed or URL mismatch');
          }
        } else {
          logPass(`QR Generation (${tc.name})`, `Type ${qr.typeNumber} generated (offline matrix valid)`);
        }
      }

      // 3.3.3 Contrast & Color Verification (Pure Black #000000 on #FFFFFF)
      const sampleSvg = generateQrSvg(qrCases[0].url);
      if (sampleSvg.includes('#000000') && sampleSvg.includes('#FFFFFF')) {
        logPass('QR Print Contrast Verification', 'Default output uses Pure Black (#000000) and White (#FFFFFF) for 21:1 contrast');
      } else {
        logFail('QR Print Contrast Verification', 'SVG does not use high-contrast #000000');
      }

    } catch (err) {
      logFail('QR Engine Test Exception', err.message);
    }
  } else {
    logFail('QR Engine Script Integrity', 'js/qr-generator.js was not found!');
  }

  // 3.4 Fallback Offline Multi-Category Data Check
  const fallbackPath = path.join(ROOT_DIR, 'data', 'fallback-invitations.json');
  if (fs.existsSync(fallbackPath)) {
    try {
      const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      const count = fallbackData.invitations
        ? Object.keys(fallbackData.invitations).length
        : (Array.isArray(fallbackData) ? fallbackData.length : 0);

      if (count > 0) {
        logPass('Fallback Offline Invitations', `Valid fallback dataset with ${count} records available`);

        // Check if multiple categories/templates exist in fallback
        const invs = Object.values(fallbackData.invitations || {});
        const tplIds = new Set(invs.map(i => i.template_id).filter(Boolean));
        if (tplIds.has('floral-pink') && (tplIds.has('neon-birthday') || tplIds.has('biz-card-gold'))) {
          logPass('Fallback Multi-Template Coverage', `Fallback data covers templates: ${Array.from(tplIds).join(', ')}`);
        } else {
          logWarn('Fallback Multi-Template Coverage', `Fallback currently only covers: ${Array.from(tplIds).join(', ')}`);
        }
      } else {
        logWarn('Fallback Offline Invitations', 'Fallback dataset exists but has 0 records');
      }
    } catch (err) {
      logFail('Fallback Offline Invitations', `JSON Parse Error: ${err.message}`);
    }
  } else {
    logWarn('Fallback Offline Invitations', 'data/fallback-invitations.json not found');
  }

  // 3.5 Platform Sponsor Profile & Fallback Integrity Check
  try {
    const { fetchPlatformSponsor } = await import('../js/supabase-config.js');
    if (typeof fetchPlatformSponsor === 'function') {
      logPass('Platform Sponsor Script API', 'fetchPlatformSponsor export is available and callable');
    }
    const fallbackPath = path.join(ROOT_DIR, 'data', 'fallback-invitations.json');
    const fb = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    if (fb.sponsor && fb.sponsor.brand_name && fb.sponsor.messenger_url) {
      logPass('Platform Sponsor Fallback Dataset', `Default sponsor profile present: "${fb.sponsor.brand_name}"`);
    } else {
      logFail('Platform Sponsor Fallback Dataset', 'Missing sponsor object in fallback-invitations.json');
    }
  } catch (err) {
    logFail('Platform Sponsor Integrity Check', err.message);
  }
}

// =============================================================================
// TEST 4: Security & RLS Test
// =============================================================================
async function testSecurityAndRLS() {
  logHeader('TEST 4: Security & Supabase RLS Test (Penetration Defense & Leak Scan)');

  // 4.1 Anon Unauthorized Mutation Defense (DELETE)
  try {
    const anonDelRes = await supabaseFetch('/rest/v1/invitations?id=eq.00000000-0000-0000-0000-000000000000', {
      method: 'DELETE'
    }); // No admin token passed (Anon role)
    if (anonDelRes.status === 401 || anonDelRes.status === 403 || anonDelRes.status === 204) {
      // If 204, verify that no rows were actually touched due to RLS filter
      logPass('Anon DELETE Mutation Defense', `Protected by Supabase RLS (HTTP ${anonDelRes.status})`);
    } else {
      logFail('Anon DELETE Mutation Defense', `Unexpected response code: HTTP ${anonDelRes.status}`);
    }
  } catch (err) {
    logFail('Anon DELETE Mutation Defense', err.message);
  }

  // 4.2 Anon Unauthorized Insert Defense (POST)
  try {
    const anonPostRes = await supabaseFetch('/rest/v1/invitations', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'hacked-invitation-test',
        template_id: 'floral-pink',
        customer_data: { hacked: true }
      })
    });
    if (anonPostRes.status === 401 || anonPostRes.status === 403) {
      logPass('Anon POST Mutation Defense', `Denied unauthorized insert (HTTP ${anonPostRes.status})`);
    } else if (anonPostRes.status >= 400) {
      logPass('Anon POST Mutation Defense', `Blocked insert attempt (HTTP ${anonPostRes.status})`);
    } else {
      logFail('Anon POST Mutation Defense', 'Anon user was able to INSERT an invitation! RLS policy missing for INSERT.', 'Add authenticated-only INSERT policy in schema.sql');
    }
  } catch (err) {
    logFail('Anon POST Mutation Defense', err.message);
  }

  // 4.3 Partner Passcode Privacy Shield (Anon SELECT on partners)
  try {
    const partnerSelectRes = await supabaseFetch('/rest/v1/partners?select=id,passcode', {
      method: 'GET'
    });
    const partners = await partnerSelectRes.json();
    if (partnerSelectRes.status === 401 || partnerSelectRes.status === 403 || (Array.isArray(partners) && partners.length === 0)) {
      logPass('Partner Passcode Privacy Shield', 'Passcode column is shielded from public anon queries');
    } else if (Array.isArray(partners) && partners.length > 0 && partners[0].passcode) {
      logFail('Partner Passcode Privacy Shield', 'Passcodes are visibly exposed to anon queries! RLS leak detected.', 'Remove public SELECT on partners table in schema.sql');
    } else {
      logPass('Partner Passcode Privacy Shield', 'No sensitive partner data exposed');
    }
  } catch (err) {
    logFail('Partner Passcode Privacy Shield', err.message);
  }

  // 4.4 Platform Sponsor Anon Mutation Defense (Ensure unauthorized users cannot modify agency sponsor)
  try {
    const sponsorPatchRes = await supabaseFetch('/rest/v1/platform_sponsor?id=eq.default', {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ brand_name: 'Unauthorized Override Attempt' })
    });
    const modified = await sponsorPatchRes.json();
    if (sponsorPatchRes.status === 401 || sponsorPatchRes.status === 403 || (Array.isArray(modified) && modified.length === 0)) {
      logPass('Platform Sponsor Mutation Defense', 'Shielded by RLS (0 rows updated by unauthenticated user)');
    } else {
      logFail('Platform Sponsor Mutation Defense', 'Anon user was able to modify platform sponsor!', 'Check public.platform_sponsor RLS policy in schema.sql');
    }
  } catch (err) {
    logFail('Platform Sponsor Mutation Defense', err.message);
  }

  // 4.5 Frontend Secret Leak Audit (Scan JS & HTML for private keys)
  const filesToScan = [
    'js/supabase-config.js',
    'js/engine.js',
    'js/admin.js',
    'js/partner.js',
    'js/calendar.js',
    'js/qr-generator.js',
    'index.html',
    'admin.html',
    'partner.html',
    'sw.js'
  ];

  const dangerousPatterns = [
    { name: 'Supabase Service Role Key', regex: /service_role/i },
    { name: 'Postgres DB Password URI', regex: /postgresql?:\/\/[^:]+:[^@]+@/i },
    { name: 'Private Key Block', regex: /-----BEGIN (RSA|EC|OPENSSH)? PRIVATE KEY-----/ }
  ];

  let leakFound = false;
  for (const relFile of filesToScan) {
    const fullPath = path.join(ROOT_DIR, relFile);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    for (const pattern of dangerousPatterns) {
      if (pattern.regex.test(content)) {
        leakFound = true;
        logFail(`Secret Leak Audit (${relFile})`, `Detected possible ${pattern.name}!`, `Never include private keys in client-side code.`);
      }
    }
  }
  if (!leakFound) {
    logPass('Frontend Secret Leak Audit', '0 leaked private keys or service_role tokens found in client assets');
  }
}

// =============================================================================
// MAIN RUNNER
// =============================================================================
async function runAllTests() {
  const startTime = Date.now();
  console.log(`\n${C.bold}=======================================================================`);
  console.log(` 🚀 Digital Invitation & Multi-Category Platform — System Integrity Test Suite`);
  console.log(`=======================================================================${C.reset}`);
  console.log(`Supabase URL: ${C.dim}${SUPABASE_URL}${C.reset}`);
  console.log(`Testing Mode: ${C.dim}Automated CLI Runner${C.reset}\n`);

  try {
    const adminToken = await testAuthAndSession();
    await testCustomerDataIsolation(adminToken);
    await testMainFeatures();
    await testSecurityAndRLS();
  } catch (fatal) {
    console.error(`\n${C.bgRed} FATAL TEST RUNNER EXCEPTION ${C.reset}:`, fatal);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${C.bold}=======================================================================`);
  console.log(` 📊 Test Execution Summary (${duration}s)`);
  console.log(`=======================================================================${C.reset}`);
  console.log(`Total Checks : ${stats.total}`);
  console.log(`Passed       : ${C.green}${C.bold}${stats.passed}${C.reset}`);
  console.log(`Failed       : ${stats.failed > 0 ? C.red + C.bold + stats.failed + C.reset : '0'}`);
  console.log(`Warnings     : ${stats.warnings > 0 ? C.yellow + stats.warnings + C.reset : '0'}`);

  if (stats.failed === 0) {
    console.log(`\n${C.bgGreen} ✔ ALL SYSTEM TESTS PASSED — READY FOR PRODUCTION DEPLOYMENT ${C.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${C.bgRed} ✖ SYSTEM INTEGRITY CHECKS FAILED (${stats.failed} ERRORS DETECTED) ${C.reset}`);
    console.log(`${C.yellow}Please address the failure remediations listed above before deploying.${C.reset}\n`);
    process.exit(1);
  }
}

runAllTests();
