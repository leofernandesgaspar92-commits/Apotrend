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
    await op.addInitScript(() => { localStorage.clear(); localStorage.setItem('apo_welcome_seen', '1'); });
    await op.goto(BASE, { waitUntil: 'networkidle' });
    await op.waitForTimeout(300);
    // Schritt 1: Länderauswahl erscheint zuerst (kein Token, kein Land).
    // Erwartete Anzahl kommt aus dem Register (API) — neue Länder brechen den Smoke-Test nicht.
    const expectedCountries = ((await api('/api/countries')) || {}).countries?.length || 0;
    const countryCount = await op.evaluate(() => document.querySelectorAll('[data-country]').length);
    step('Länderauswahl erscheint als erster Schritt', countryCount === expectedCountries && countryCount >= 16, `${countryCount}/${expectedCountries} Länder`);
    // Land bestimmt Sprache: AT -> „Anmelden", GB -> „Log in".
    const loginHead = async () => op.evaluate(() => [...document.querySelectorAll('h1')].map(h => h.textContent.trim()).find(t => /Anmelden|Log in|Entrar/.test(t)) || '');
    await op.click('[data-country="AT"]').catch(() => {}); await op.waitForTimeout(300);
    const de = await loginHead();
    await op.click('#changeCountry').catch(() => {}); await op.waitForTimeout(250);
    await op.click('[data-country="GB"]').catch(() => {}); await op.waitForTimeout(300);
    const en = await loginHead();
    step('Land bestimmt Sprache (AT→Anmelden, GB→Log in)', de === 'Anmelden' && en === 'Log in', `${de}/${en}`);
    // <html lang> folgt der Sprache (a11y — Screenreader-Aussprache).
    const htmlLang = await op.evaluate(() => document.documentElement.lang);
    step('<html lang> folgt der Sprache (GB→en)', htmlLang === 'en', `lang=${htmlLang}`);
    // Logo (grüner Punkt) führt ausgeloggt zurück zur Länderauswahl.
    await op.click('#logoHome').catch(() => {}); await op.waitForTimeout(300);
    const backToCountry = await op.evaluate(() => document.querySelectorAll('[data-country]').length);
    step('Logo führt ausgeloggt zurück zur Länderauswahl', backToCountry === expectedCountries, `${backToCountry} Länder`);
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

  // 4a2) Tastatur-Aktivierung: ein .clickable-Element muss bei EINMAL Enter GENAU EINMAL
  //      auslösen (Regression: zwei überlappende keydown-Mechanismen lösten doppelt aus).
  await page.waitForTimeout(200); // makeClickableAccessible (debounced) versorgt .clickable
  const kbdClicks = await page.evaluate(async () => {
    const elx = document.querySelector('.clickable[data-openprofile]');
    if (!elx) return -1;
    let n = 0; elx.onclick = () => { n++; }; // Navigation durch Zähler ersetzen
    elx.focus();
    elx.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return n;
  });
  step('Tastatur: Enter auf .clickable löst genau einmal aus', kbdClicks === 1, `${kbdClicks} Klick(s)`);

  // 4b) Umfrage über den Composer erstellen + abstimmen (Roadmap Phase 2, „Facebook für Apotheker").
  const pollMarker = `POLL-${uniq}`;
  await page.check('#ppoll').catch(() => {});
  await page.waitForTimeout(200);
  const composerOk = await page.evaluate(() => {
    const box = document.getElementById('pollBox');
    return !!box && box.style.display !== 'none' && document.querySelectorAll('input.poll-opt-in').length >= 2;
  });
  await page.fill('#pb', `${pollMarker} Welcher Wirkstoff fehlt?`);
  const optIns = await page.$$('input.poll-opt-in');
  if (optIns[0]) await optIns[0].fill('Amoxicillin');
  if (optIns[1]) await optIns[1].fill('Cefuroxim');
  await page.click('#pollAdd').catch(() => {});
  await page.waitForTimeout(150);
  const optIns2 = await page.$$('input.poll-opt-in');
  if (optIns2[2]) await optIns2[2].fill('Ibuprofen');
  await page.getByText('Posten', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(900);
  const pollShown = await page.evaluate((m) => {
    const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m));
    return !!(c && c.querySelector('.poll') && c.querySelectorAll('.poll-opt').length === 3);
  }, pollMarker);
  step('Umfrage über den Composer erstellt (3 Optionen)', composerOk && pollShown);
  await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); c.querySelectorAll('.poll-opt')[1].click(); }, pollMarker);
  await page.waitForTimeout(600);
  const pollVoted = await page.evaluate((m) => {
    const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m));
    return !!(c && c.querySelector('.poll-opt[aria-pressed="true"]'));
  }, pollMarker);
  step('Umfrage-Abstimmung markiert die eigene Stimme', pollVoted);

  // 4c) Repost: einen fremden Beitrag (z. B. Redaktions-Beitrag) im eigenen Feed teilen.
  const embedsBefore = await page.evaluate(() => document.querySelectorAll('.repost-embed').length);
  const didRepost = await page.evaluate(() => {
    const btn = document.querySelector('[data-repost]'); // erster fremder Beitrag
    if (btn) { btn.click(); return true; } return false;
  });
  await page.waitForTimeout(900);
  const embedsAfter = await page.evaluate(() => document.querySelectorAll('.repost-embed').length);
  step('Beitrag im Feed teilen (Repost bettet Original ein)', didRepost && embedsAfter > embedsBefore);

  // 4d) Übergreifende Suche: ein Wirkstoff liefert gebündelte Treffer (Beiträge/Engpässe/Preise …).
  await page.fill('#sq', 'Amoxicillin');
  await page.click('#sgo');
  await page.waitForTimeout(700);
  const searchOk = await page.evaluate(() => {
    const feed = document.getElementById('feed');
    if (!feed) return false;
    const hasHeader = /Suchergebnisse|Search results|Resultados/.test(feed.textContent);
    const hasResults = feed.querySelectorAll('.card').length >= 2; // Kopf + mind. 1 Treffer
    const hasWkChip = !!feed.querySelector('[data-wchips] button');
    return hasHeader && hasResults && hasWkChip;
  });
  step('Übergreifende Suche liefert gebündelte Treffer', searchOk);
  // Zurück in den Feed für die folgenden Schritte
  await page.evaluate(() => { const b = document.querySelector('#feed [data-back]'); if (b) b.click(); });
  await page.waitForTimeout(400);

  // 5) Sprachwechsel wirkt (Header-Label „Schrift" -> „Text size") — auf dem Auth-Screen abgesichert,
  //    hier prüfen wir eingeloggt: Reiter-Beschriftung wechselt via Länder-/Sprachlogik nicht direkt,
  //    daher testen wir den generischen t()-Pfad über den Kommentar-Button-Text.
  await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); c.querySelector('[data-comments]').click(); }, marker);
  await page.waitForTimeout(500);
  const commentBox = await page.evaluate((m) => { const c = [...document.querySelectorAll('.card')].find(c => c.textContent.includes(m)); return !!c.querySelector('[data-cinput]'); }, marker);
  step('Kommentarbereich öffnet', commentBox);

  // 6) Logo (grüner Punkt) führt eingeloggt zurück zur Übersicht (Startseite) + scrollt nach oben.
  await page.getByText('Preise', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.click('#logoHome').catch(() => {});
  await page.waitForTimeout(500);
  const homeOk = await page.evaluate(() => /Für dich|For you|Para si/.test(document.body.textContent) && window.scrollY === 0);
  step('Logo führt eingeloggt zur Übersicht + scrollt nach oben', homeOk);

  // 7) Nicht-destruktiver Länder-Switcher („Land = Sicht"): ein fremdes Land besuchen zeigt
  //    den Besuchs-Kontext, das Heimatland bleibt; „Zurück" beendet den Besuch.
  await page.selectOption('#countrySwitch', 'GB').catch(() => {});
  await page.waitForTimeout(700);
  const visiting = await page.evaluate(() => {
    const b = document.getElementById('viewCtx');
    return { shown: !!b, hint: b ? b.textContent : '', sel: (document.getElementById('countrySwitch') || {}).value };
  });
  step('Länder-Switcher öffnet Besuchs-Ansicht (Heimat bleibt)', visiting.shown && visiting.sel === 'GB', visiting.hint.slice(0, 40));
  await page.click('#vcBack').catch(() => {});
  await page.waitForTimeout(500);
  const backHome = await page.evaluate(() => !document.getElementById('viewCtx'));
  step('„Zurück zu meinem Land" beendet den Besuch', backHome);

  // 8) Direktnachricht: Enter sendet GENAU EINE Nachricht (Regression — früher doppelt
  //    durch zwei keydown-Handler). Empfänger + Thread per API, Senden im echten Browser.
  const rcp = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'SmokeB', email: `smokeb_${uniq}@ex.com`, password: 'Passwort123!', handle: `smokeb_${uniq}`, accountType: 'pharmacy' }) });
  const startRes = await api('/api/dm/start', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify({ handle: rcp.profile.handle }) });
  const threadId = startRes && (startRes.thread_id || startRes.id || (startRes.thread && startRes.thread.id));
  let dmOk = false;
  if (threadId) {
    await page.evaluate((id) => window.openDmThread && window.openDmThread(id), threadId);
    await page.waitForTimeout(500);
    await page.fill('#dmbody', 'SMOKE-DM').catch(() => {});
    await page.locator('#dmbody').press('Enter').catch(() => {});
    await page.waitForTimeout(800);
    const conv = await api('/api/dm/' + encodeURIComponent(threadId), { headers: { authorization: 'Bearer ' + token } });
    dmOk = (conv.messages || []).filter(m => m.body === 'SMOKE-DM').length === 1;
  }
  step('Direktnachricht: Enter sendet genau eine Nachricht (kein Duplikat)', dmOk);

  step('Keine JS-Fehler während des Flows', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  await browser.close();
  stopServer();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? '✓ Smoke-Test grün' : '✗ ' + failed.length + ' Schritt(e) rot'} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
}
main();
