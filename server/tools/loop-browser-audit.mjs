// ApoTrend Loop — GATHER (Browser-Teil). Automatisiert die manuellen Mobil-Checks:
// Querscroll (horizontaler Overflow) und JS-Fehler pro Reiter, Hell+Dunkel, Mobil 390.
// Fängt genau die Layout-/Laufzeit-Regressionen, die die statische Analyse nicht sieht.
//
// Voraussetzung: ein laufender Server (Standard http://127.0.0.1:4000).
// Aufruf:  node tools/loop-browser-audit.mjs [baseUrl]
//
// Playwright ist ein Dev-Werkzeug (nicht ausgeliefert) — der „Built-ins only"-Constraint
// gilt für den Server-Code, nicht für die Loop-Werkzeuge.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { ensureServer } from './_ensure-server.mjs';
const { chromium } = pkg;

const BASE = process.argv[2] || 'http://127.0.0.1:4000';
const TABS = [
  ['Für dich', '✨ Für dich'], ['Öffentlich', '🌍 Öffentlich'], ['Mein Feed', '🏠 Mein Feed'],
  ['Engpässe', '📦 Engpässe'], ['Preise', '💶 Preise'], ['Rabatte', '🏷️ Top-Rabatte'],
  ['Biete', '🔄 Biete/Suche'], ['News', '📰 News'],
];

async function api(path, opts = {}) {
  const r = await fetch(BASE + path, { headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, ...opts });
  return r.json().catch(() => null);
}

async function main() {
  // Server sicherstellen (nutzt laufenden ODER startet einen und beendet ihn am Ende).
  let stopServer = () => {};
  try { stopServer = await ensureServer(BASE); }
  catch (e) { console.error(`❌ ${e.message}`); process.exit(2); }

  const uniq = Date.now().toString(36);
  const reg = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Audit', email: `audit_${uniq}@ex.com`, password: 'Passwort123!', handle: `audit_${uniq}`, accountType: 'pharmacy' }) });
  const token = reg && reg.token;
  if (!token) { console.error('❌ Registrierung fehlgeschlagen'); process.exit(2); }
  // Pathologischer Inhalt: langer ununterbrochener Token + lange URL — der klassische
  // Auslöser für Mobil-Querscroll. So prüft der Audit auch die overflow-wrap-Behandlung.
  await api('/api/posts', { method: 'POST', headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ body: `AUDIT-LONG ${'X'.repeat(200)} https://example.com/${'a'.repeat(180)}`, kind: 'post', visibility: 'public' }) });

  const browser = await chromium.launch();
  const findings = [];
  for (const [theme, scheme] of [['hell', 'light'], ['dunkel', 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 80)); });
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    for (const [name, label] of TABS) {
      await page.getByText(label, { exact: false }).first().click().catch(() => {});
      await page.waitForTimeout(450);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) findings.push(`Querscroll: ${name} [${theme}]`);
    }
    if (errors.length) findings.push(`JS-Fehler [${theme}]: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  stopServer();

  console.log('── ApoTrend Loop · GATHER (Browser) · Mobil 390 ──');
  if (findings.length === 0) {
    console.log('✓ Kein Querscroll, keine JS-Fehler auf 8 Reitern (hell + dunkel).');
  } else {
    console.log(`⚠️ ${findings.length} Befund(e):`);
    findings.forEach((f) => console.log('  - ' + f));
    process.exitCode = 1;
  }
}
main();
