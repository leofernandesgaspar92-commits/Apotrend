// Klickrunde vor einem Release: jede Hauptansicht und jeden Menüpunkt öffnen — je Kontoart und
// Sprache, Handy-Breite 360 px — und Skriptfehler, Konsolenfehler, Server-5xx und Fehlerberichte sammeln.
//   node tools/klickrunde.mjs              Stufe 1 (~2 min)
//   TIEF=1 N=8 node tools/klickrunde.mjs   Stufe 2: in jeder Ansicht bis zu N harmlose Knöpfe (~40 min)
//   NUR="Klinik ar-EG" …                   nur eine Person
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
// NUR="Apotheke en-GH" prüft nur Personen, deren Name den Text enthält.
for (const [name, locale, reg] of PERSONEN.filter(([n]) => !process.env.NUR || n.includes(process.env.NUR))) {
  let token;
  if (reg) token = (await post('/api/register', { name: 'Test ' + name, email: `p${i++}@kr.test`, password: 'Passwort-1234', ...reg })).token;
  else token = (await post('/api/login', { email: 'red@kr.test', password: 'kr-test-PW-123' })).token;
  // Inhalt, damit Beitrags-Karten (Reaktionen, Merken, Umfrage) mitgeprüft werden.
  await post('/api/posts', { body: 'Amoxicillin knapp? ' + name, visibility: 'public', kind: 'poll', pollOptions: ['Ja', 'Nein'] }, token);
  await post('/api/posts', { body: 'Hinweis von ' + name, visibility: 'public' }, token);
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
  // Sprachlecks: rohe Text-Schlüssel (wc_s8_t) oder deutsche Wörter in einer anderen Sprache.
  const sprache = locale.slice(0, 2);
  const DEUTSCH = /\b(und|oder|nicht|bitte|Bitte|noch|keine|deine|dein|Ihre|wird|werden|wurde|gemeldet|Engpass|Engpässe|Lieferengpass|Apotheke|Wirkstoff|anzeigen|Meldung|Benachrichtigung|einloggen|anmelden|Konto|zurück|Zurück|Speichern|speichern|Suchen|über|für|Für|mit)\b/;
  const sprachpruefung = async () => {
    const zeilen = await p.evaluate(() => {
      const raus = [];
      const sicht = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.textContent.trim(); const el = n.parentElement;
        if (!t || !el || !sicht(el) || el.closest('script,style,[data-nutzerinhalt],.post-body,.c-body,[lang="de"]')) continue;
        raus.push(t);
      }
      for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) if (sicht(el)) for (const a of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute(a); if (v) raus.push(v); }
      return raus;
    });
    for (const z of zeilen) {
      const k = z.match(/\b[a-z]{2,4}_[a-z0-9]+(?:_[a-z0-9]+)*\b/);
      if (k && !/[@.\/]/.test(z) && !/^[a-z0-9_]+$/.test(z.trim()) === false) merk('Roher Schlüssel', z.slice(0, 100));
      else if (k && /^[a-z]{2,4}_[a-z0-9_]+$/.test(z.trim())) merk('Roher Schlüssel', z.slice(0, 100));
      if (sprache !== 'de' && DEUTSCH.test(z) && !/Test |ApoPulse/.test(z)) merk('Deutsch in ' + sprache, z.slice(0, 120));
    }
  };
  const start = async () => { await p.goto(B); await p.waitForSelector('#hauptnav', { timeout: 20000 }); await p.waitForTimeout(600); };
  await start();
  wo = 'Start'; await sprachpruefung();
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
      await sprachpruefung();
      if (TIEF) {
        // Offenes Fenster (z. B. Hilfe): dessen Knöpfe prüfen — die Seite dahinter ist bewusst gesperrt.
        const BEREICH = (await p.$('[role=dialog][aria-modal=true]')) ? '[role=dialog][aria-modal=true]' : '#app';
        const knoepfe = await p.$$eval(`${BEREICH} button, ${BEREICH} [role=button]`, (xs, g) => xs.filter((x) => x.offsetParent && !x.disabled).map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 40)).filter((t) => t && !new RegExp(g, 'i').test(t)), GEFAHR.source);
        const einzeln = [...new Set(knoepfe)].slice(0, N);
        for (const text of einzeln) {
          const vorher = wo; wo = vorher + ' › ' + text;
          try {
            await start(); await oeffne();
            const k = p.locator(`${BEREICH} button, ${BEREICH} [role=button]`).filter({ hasText: text }).first();
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
