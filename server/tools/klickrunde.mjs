// Klickrunde vor einem Release: jede Hauptansicht und jeden Menüpunkt öffnen — je Kontoart und
// Sprache, Handy-Breite 360 px — und Skriptfehler, Konsolenfehler, Server-5xx und Fehlerberichte sammeln.
//   node tools/klickrunde.mjs              Stufe 1 (~2 min)
//   TIEF=1 N=8 node tools/klickrunde.mjs   Stufe 2: in jeder Ansicht bis zu N harmlose Knöpfe (~40 min)
// Harmlos = nichts Löschendes, Zahlendes, Sendendes, Abmeldendes (GEFAHR unten). Nicht Teil von verify.
// Erster Lauf 29.10.2026: Stufe 1 ohne Fund; Stufe 2 fand die Hilfe, die ausgeschaltete Bereiche
// erklärte, und eine unnötige Anfrage bei leerem Beitrag (test/klickrunde-funde.test.js).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let pkg;
try { pkg = require('playwright'); } catch { pkg = require('/opt/node22/lib/node_modules/playwright'); }
const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIEF = process.env.TIEF === '1', N = Number(process.env.N || 8);
const proc = spawn(process.execPath, ['src/http/server.js'], { cwd: SERVER_DIR, stdio: ['ignore','pipe','pipe'], env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'kr-geheim-1234567', APOPULSE_PRESSE: 'aus', APOPULSE_DATA_FILE: '', APOPULSE_ADMIN_EMAIL: 'red@kr.test', APOPULSE_ADMIN_PASSWORD: 'kr-test-PW-123' } });
let slog = ''; proc.stderr.on('data', (d) => { slog += d; });
const B = await new Promise((ok) => { let l=''; proc.stdout.on('data', (x) => { l+=x; const m=l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) ok('http://localhost:'+m[1]); }); });
const H = { 'content-type': 'application/json' };
const post = async (p, b, tok) => (await fetch(B + p, { method: 'POST', headers: { ...H, ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) })).json();
const PERSONEN = [
  ['Apotheke en-GH', 'en-GH', { country: 'GH', locale: 'en', accountType: 'pharmacy' }],
  ['Großhandel fr-SN', 'fr-SN', { country: 'SN', locale: 'fr', accountType: 'wholesale' }],
  ['Klinik ar-EG', 'ar-EG', { country: 'EG', locale: 'ar', accountType: 'clinic' }],
  ['Privat pt-AO', 'pt-AO', { country: 'AO', locale: 'pt', accountType: 'private' }],
  ['Apotheke de-AT', 'de-AT', { country: 'AT', locale: 'de', accountType: 'pharmacy' }],
  ['Moderation de-AT', 'de-AT', null],
];
const GEFAHR = /abmeld|log ?out|sign out|déconnex|sair|terminar|خروج|lösch|delete|supprim|elimin|apag|حذف|entfern|remove|retir|kauf|buy|achet|compr|zahl|pay|paie|pag|دفع|install|teilen|share|partag|partilh|whatsapp|drucken|print|imprim|export|herunterlad|download|télécharg|transfer|abonn|subscri|ablehn|reject|rejet|recus|sperr|block|sende|send|envoy|envi|publi|veröffentl|melden|report|signal|comunic|bestätig|confirm|aprov|freigeb|approve/i;
const br = await pkg.chromium.launch();
const funde = [];
let i = 0;
for (const [name, locale, reg] of PERSONEN) {
  let token;
  if (reg) token = (await post('/api/register', { name: 'Test ' + name, email: `p${i++}@kr.test`, password: 'Passwort-1234', ...reg })).token;
  else token = (await post('/api/login', { email: 'red@kr.test', password: 'kr-test-PW-123' })).token;
  const ctx = await br.newContext({ viewport: { width: 360, height: 740 }, locale, serviceWorkers: 'block' });
  await ctx.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_install', 'fertig'); }, token);
  const p = await ctx.newPage();
  let wo = 'Start';
  const merk = (art, text) => { const k = `${name}|${wo}|${art}|${text}`; if (!funde.some((f) => f.k === k)) funde.push({ k, name, wo, art, text }); };
  p.on('pageerror', (e) => merk('Skriptfehler', e.message + ' @ ' + String(e.stack || '').split('\n')[1]?.trim()));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of (401|403|404)/.test(m.text())) merk('Konsole', m.text().slice(0, 160)); });
  p.on('response', (r) => { if (r.status() >= 500) merk('Server ' + r.status(), r.url().replace(B, '')); });
  p.on('request', (r) => { if (r.url().endsWith('/api/fehlerbericht')) merk('Fehlerbericht', r.postData()?.slice(0, 160)); });
  p.on('dialog', (d) => d.dismiss());
  const start = async () => { await p.goto(B); await p.waitForSelector('#hauptnav', { timeout: 20000 }); await p.waitForTimeout(600); };
  await start();
  // Ziele sammeln
  const tabs = await p.$$eval('#hauptnav [data-tab]', (xs) => xs.map((x) => x.dataset.tab));
  await p.click('#btnMenue'); await p.waitForTimeout(300);
  const menue = await p.$$eval('#kopfMenue .km-liste button', (xs) => xs.filter((x) => x.offsetParent && !['btnLogout','btnTheme','btnFont','btnSprache'].includes(x.id)).map((x, n) => ({ id: x.id, idx: n, text: x.innerText.split('\n')[0].trim() })));
  const ziele = [...tabs.map((t) => ({ art: 'tab', t })), ...menue.map((m) => ({ art: 'menue', ...m })), { art: 'notif' }];
  for (const z of ziele) {
    wo = z.art === 'tab' ? 'Reiter ' + z.t : z.art === 'notif' ? 'Benachrichtigungen' : 'Menü ' + (z.text || z.id);
    try {
      await start();
      const oeffne = async () => {
        if (z.art === 'tab') await p.evaluate((t) => goTab(t), z.t);
        else if (z.art === 'notif') await p.click('#btnNotif');
        else { await p.click('#btnMenue'); await p.waitForTimeout(250); const xs = await p.$$('#kopfMenue .km-liste button'); const vis = []; for (const x of xs) if (await x.isVisible()) { const id = await x.getAttribute('id'); if (!['btnLogout','btnTheme','btnFont','btnSprache'].includes(id)) vis.push(x); } await vis[z.idx].click(); }
        await p.waitForTimeout(1200);
      };
      await oeffne();
      const leer = await p.evaluate(() => (document.getElementById('app')?.innerText || '').trim().length < 20);
      if (leer) merk('Leere Ansicht', '');
      if (TIEF) {
        const knoepfe = await p.$$eval('#app button, #app [role=button]', (xs, g) => xs.filter((x) => x.offsetParent && !x.disabled).map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 40)).filter((t) => t && !new RegExp(g, 'i').test(t)), GEFAHR.source);
        const einzeln = [...new Set(knoepfe)].slice(0, N);
        for (const text of einzeln) {
          const vorher = wo; wo = vorher + ' › ' + text;
          try {
            await start(); await oeffne();
            const k = p.locator('#app button, #app [role=button]').filter({ hasText: text }).first();
            if (await k.isVisible({ timeout: 500 }).catch(() => false)) { await k.click({ timeout: 2000 }); await p.waitForTimeout(900); }
          } catch (e) { merk('Klick', e.message.split('\n')[0]); }
          wo = vorher;
        }
      }
    } catch (e) { merk('Ablauf', e.message.split('\n')[0]); }
  }
  console.log(`${name}: ${ziele.length} Ziele geprüft`);
  await ctx.close();
}
await br.close(); proc.kill();
console.log('\nFUNDE: ' + funde.length);
for (const f of funde) console.log(`- [${f.name}] ${f.wo} — ${f.art}: ${f.text}`);
if (/Error|TypeError/.test(slog)) console.log('\nServer-Protokoll:\n' + slog.split('\n').filter((l) => /Error/.test(l)).slice(0, 10).join('\n'));
