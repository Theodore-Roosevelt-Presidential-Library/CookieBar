#!/usr/bin/env node
/**
 * Termly API helper for CookieBar. No dependencies (Node 18+).
 *
 *   node scripts/termly.mjs auth              Check the API keys in .env
 *   node scripts/termly.mjs website           Show the website record and its embed snippet
 *   node scripts/termly.mjs banner            Show banner settings for every region
 *   node scripts/termly.mjs theme             Preview the TRPL brand theme (no changes)
 *   node scripts/termly.mjs theme --apply     Save the brand theme and set it on the live banner
 *
 * Keys come from .env (copy .env.example). Never commit .env; never put the
 * private key in any file served by GitHub Pages.
 *
 * Auth follows https://docs.termly.io/other/signature/
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- .env ----------
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv(path.join(ROOT, '.env'));

const env = (k, required = true) => {
  const v = process.env[k];
  if (required && !v) { console.error(`Missing ${k} in .env (see .env.example).`); process.exit(1); }
  return v;
};

const API = new URL(process.env.TERMLY_API_BASE || 'https://api.termly.io');

// ---------- signing ----------
const pad = (n) => String(n).padStart(2, '0');
function termlyTimestamp(d = new Date()) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
const hmac = (key, msg) => crypto.createHmac('sha256', key).update(msg).digest();

export function sign({ method, host, pathName, query = '', body = '', timestamp, publicKey, privateKey }) {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonical = [method, host, pathName, query, timestamp, bodyHash].join('\n');
  let key = hmac(privateKey, timestamp);
  key = hmac(key, 'default');
  key = hmac(key, 'termly');
  const signature = crypto.createHmac('sha256', key).update(canonical).digest('hex');
  return `TermlyV1, PublicKey=${publicKey}, Signature=${signature}`;
}

async function call(method, pathName, { query, body } = {}) {
  const publicKey = env('TERMLY_PUBLIC_KEY');
  const privateKey = env('TERMLY_PRIVATE_KEY');
  const timestamp = termlyTimestamp();
  const q = query ? encodeURIComponent(JSON.stringify(query)) : '';
  const b = body ? JSON.stringify(body) : '';
  const auth = sign({ method, host: API.hostname, pathName, query: q, body: b, timestamp, publicKey, privateKey });
  const url = `${API.origin}${pathName}${q ? `?query=${q}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: auth,
      'X-Termly-Timestamp': timestamp,
      ...(b ? { 'Content-Type': 'application/json' } : {})
    },
    body: b || undefined
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok && res.status !== 207) {
    console.error(`${method} ${pathName} → HTTP ${res.status}`);
    console.error(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    process.exit(1);
  }
  if (res.status === 207) console.warn(`Partial success (207) on ${method} ${pathName}; check errors below.`);
  return data;
}

// ---------- brand theme (from brand.labs.trlibrary.com tokens) ----------
const BRAND_THEME = {
  font_family: 'Georgia, "Times New Roman", serif',
  font_size: '16px',
  color: '#FFFFFF',          // White on Dark Gray: 14.8 AAA
  background: '#25282A',     // Dark Gray
  btn_background: '#E7805D', // Deep Orange = "act"
  btn_text_color: '#25282A'  // Dark Gray on Deep Orange: 5.4 AA
};

// ---------- commands ----------
const account_id = () => env('TERMLY_ACCOUNT_ID');
const website_id = () => env('TERMLY_WEBSITE_ID');

async function cmdAuth() {
  const data = await call('GET', '/v1/authn');
  console.log('Termly API keys work.');
  console.log(JSON.stringify(data, null, 2));
}

async function cmdWebsite() {
  const data = await call('GET', '/v1/websites', { query: [{ account_id: account_id(), ids: [website_id()] }] });
  const w = (data.results || [])[0];
  if (!w) { console.log(JSON.stringify(data, null, 2)); return; }
  console.log(`Website: ${w.name} (${w.url})`);
  console.log(`Website UUID (for the embed snippet, TERMLY_WEBSITE_UUID): ${w.uuid}`);
  if (w.code_snippet) {
    console.log('\nTermly embed snippet:\n' + (w.code_snippet.banner || ''));
    if (w.code_snippet.cookie_preference_button) console.log('\nPreference button snippet:\n' + w.code_snippet.cookie_preference_button);
  }
}

async function getBanner() {
  const data = await call('GET', '/v1/websites/banners', { query: [{ account_id: account_id(), ids: [website_id()] }] });
  return (data.results || [])[0];
}

async function cmdBanner() {
  const b = await getBanner();
  if (!b) { console.log('No banner found.'); return; }
  console.log(`Style: ${b.display_style} · position ${b.position} · size ${b.size} · theme ${b.theme_id || b.default_theme}`);
  for (const [region, r] of Object.entries(b.regions || {})) {
    console.log(`\n[${region}] banner ${r.enable_banner ? 'ON' : 'off'} · ${r.consent_mode} · decline button ${r.enable_decline_button ? 'yes' : 'no'} · consent by scroll ${r.enable_consent_by_scroll ? 'YES (turn off)' : 'no'} · Google Consent Mode ${r.enable_google_consent_mode ? 'on' : 'off'}`);
    if (r.google_consent_mode_settings) {
      const g = r.google_consent_mode_settings;
      console.log(`  defaults: analytics_storage=${g.analytics_storage} ad_storage=${g.ad_storage} ad_user_data=${g.ad_user_data} ad_personalization=${g.ad_personalization}`);
    }
  }
}

async function cmdTheme(apply) {
  const base = { account_id: account_id(), website_id: website_id() };
  console.log('TRPL brand theme:\n' + JSON.stringify(BRAND_THEME, null, 2));
  if (!apply) {
    console.log('\nPreview only. Run with --apply to save it and set it on the live banner (bottom bar).');
    return;
  }
  const existing = await call('GET', '/v1/websites/custom_consent_themes', { query: [base] });
  const current = (existing.results || [])[0];
  let themeId;
  if (current) {
    const r = await call('PUT', '/v1/websites/custom_consent_themes', { body: [{ id: current.id, ...base, ...BRAND_THEME }] });
    themeId = (Array.isArray(r) ? r[0] : (r.results || [])[0])?.id || current.id;
    console.log(`Updated theme ${themeId}.`);
  } else {
    const r = await call('POST', '/v1/websites/custom_consent_themes', { body: [{ ...base, ...BRAND_THEME }] });
    themeId = (Array.isArray(r) ? r[0] : (r.results || [])[0])?.id;
    console.log(`Created theme ${themeId}.`);
  }
  const banner = await getBanner();
  if (!banner) { console.error('No banner to apply the theme to.'); process.exit(1); }
  const body = [{
    ...banner,
    id: banner.id || website_id(),
    account_id: account_id(),
    theme_id: themeId,
    display_style: 'banner',
    position: 'bottom'
  }];
  await call('PUT', '/v1/websites/banners', { body });
  console.log('Brand theme is now on the live banner (bottom bar).');
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = {
  auth: cmdAuth,
  website: cmdWebsite,
  banner: cmdBanner,
  theme: () => cmdTheme(rest.includes('--apply'))
};
if (!commands[cmd]) {
  console.log('Usage: node scripts/termly.mjs <auth|website|banner|theme [--apply]>');
  process.exit(cmd ? 1 : 0);
}
await commands[cmd]();
