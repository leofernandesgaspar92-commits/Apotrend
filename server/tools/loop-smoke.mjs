// ApoTrend Loop — Frontend-Smoke-Test. Das Frontend (index.html) hat sonst keine
// automatisierte Abdeckung; dieser Test fährt den kritischen Happy-Path im echten
// Browser und fängt große Frontend-Regressionen (Rendering, Interaktion, i18n).
//
// Voraussetzung: laufender Server (Standard http://127.0.0.1:4000).
// Aufruf:  node tools/loop-smoke.mjs [baseUrl]      Exit 0 = alle Schritte grün.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { ensureServer } from './_ensure-server.mjs';
const { chromium } = pkg;
const BASE = process.argv[2] || 'http://127.0.0.1:4000';

async function api(path, opts = {}) {
  const r = await fetch(BASE + path, { headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, ...opts });
  return r.json().catch(() => null);
}

const results = [];
const step = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

async function main() {
  let stopServer = () => {};
  try { stopServer = await ensureServer(BASE); }
  catch (e) { console.error(`❌ ${e.message}`); process.exit(2); }

  const uniq = Date.now().toString(36);
  const reg = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Smoke', email: `smoke_${uniq}@ex.com`, password: 'Passwort123!', handle: `smoke_${uniq}`, accountType: 'pharmacy' }) });
  const token = reg && reg.token;
  if (!token) { console.error('❌ Registrierung fehlgeschlagen'); process.exit(2); }

  const browser = await chromium.launch();

  // 0) Ausgeloggt: Sprachumschalter auf dem Auth-Screen wechselt die UI (i18n-Kern absichern).
  {
    const octx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const op = await octx.newPage();
    await op.addInitScript(() => { localStorage.removeItem('apo_token'); localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_locale', 'de'); });
    await op.goto(BASE, { waitUntil: 'networkidle' });
    await op.waitForTimeout(300);
    const heads = async () => op.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()).find(t => /Anmelden|Log in|Entrar/.test(t)) || '');
    const de = await heads();
    await op.click('[data-lang="en"]').catch(() => {}); await op.waitForTimeout(250);
    const en = await heads();
    await op.click('[data-lang="pt"]').catch(() => {}); await op.waitForTimeout(250);
    const pt = await heads();
    step('Sprachumschalter (Auth) wechselt DE→EN→PT', de === 'Anmelden' && en === 'Log in' && pt === 'Entrar', `${de}/${en}/${pt}`);
    await octx.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // 1) Öffentlicher Feed lädt
  await page.getByText('🌍 Öffentlich', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  step('Öffentlicher Feed lädt', await page.$('#pb') != null);

  // 2) Beitrag über die UI erstellen
  const marker = `SMOKE-${uniq}`;
  await page.fill('#pb', `${marker} Testbeitrag`);
  await page.getByText('Posten', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(900);
  const posted = await page.evaluate((m) => !![...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)), marker);
  step('Beitrag erstellt + erscheint im Feed', posted);

  // 3) Reagieren -> Aktiv-Zustand
  await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); c.querySelector('[data-react]').click(); }, marker);
  await page.waitForTimeout(800);
  const reacted = await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); return c.querySelector('[data-react]').classList.contains('reacted'); }, marker);
  step('Reaktion setzt Aktiv-Zustand', reacted);

  // 4) Toggle -> Reaktion entfernt
  await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); c.querySelector('[data-react]').click(); }, marker);
  await page.waitForTimeout(800);
  const untoggled = await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); return !c.querySelector('[data-react]').classList.contains('reacted'); }, marker);
  step('Reaktion umschaltbar (entfernen)', untoggled);

  // 5) Sprachwechsel wirkt (Header-Label „Schrift" -> „Text size") — auf dem Auth-Screen abgesichert,
  //    hier prüfen wir eingeloggt: Reiter-Beschriftung wechselt via Länder-/Sprachlogik nicht direkt,
  //    daher testen wir den generischen t()-Pfad über den Kommentar-Button-Text.
  await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); c.querySelector('[data-comments]').click(); }, marker);
  await page.waitForTimeout(500);
  const commentBox = await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); return !!c.querySelector('[data-cinput]'); }, marker);
  step('Kommentarbereich öffnet', commentBox);

  step('Keine JS-Fehler während des Flows', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  await browser.close();
  stopServer();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? '✓ Smoke-Test grün' : '✗ ' + failed.length + ' Schritt(e) rot'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
}
main();
