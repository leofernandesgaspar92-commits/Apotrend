// ============================================================================
//  Play-Store-Screenshots für Afrika — Englisch, Französisch, Portugiesisch, Arabisch
// ============================================================================
//  Ergänzt tools/store-assets.mjs (deutsche Bilder, Österreich). Die Play
//  Console nimmt Screenshots JE SPRACHE; wer in Dakar die französische
//  Beschreibung liest, soll auch die französische App sehen.
//
//  Wie store-assets.mjs: die ECHTE Anwendung, echte Bildschirme, keine Montage.
//  Weil ein frischer Server keine Engpässe kennt, werden Apotheken-Meldungen
//  angelegt — auf einem eigenen Wegwerf-Server mit eigener Datendatei, nie auf
//  einem laufenden. Jedes Bild trägt deshalb oben das Band „Beispieldaten":
//  Ein Engpass auf einem Store-Bild darf nicht wie eine echte Meldung wirken
//  (Engpass-Aussagen nur mit Quelle — CLAUDE.md).
//
//  Gestartet wird mit ?src=twa: abgebildet wird die Play-App, also ohne
//  Kaufknopf (siehe istPlayApp in public/app.js).
//
//  Aufruf:   node tools/store-screens-afrika.mjs
//  Ergebnis: android/store-screenshots/<sprache>/1-…4-….png  (1080 × 1920)
// ============================================================================

import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HIER = path.dirname(new URL(import.meta.url).pathname);
const SERVER = path.join(HIER, '..');
const ZIEL = path.join(SERVER, '..', 'android', 'store-screenshots');

const SPRACHEN = [
  { sp: 'en', land: 'GH', locale: 'en-GH', zone: 'Africa/Accra', band: 'Example data',
    leute: ['Adwoa Mensah', 'Kofi Boateng', 'Ama Owusu'],
    w: ['Oxytocin', 'Amoxicillin', 'Artemether/Lumefantrine'],
    b: ['Oxytocin 10 IU/ml injection', 'Amoxicillin 500 mg capsules', 'Artemether/Lumefantrine 20/120 mg tablets'],
    g: ['Wholesaler out of stock', 'Supplier delayed', 'Only small packs available'],
    neu: ['Ceftriaxone', 'Ceftriaxone 1 g injection', 'Wholesaler out of stock'] },
  { sp: 'fr', land: 'SN', locale: 'fr-SN', zone: 'Africa/Dakar', band: 'Données d’exemple',
    leute: ['Awa Diop', 'Moussa Ndiaye', 'Fatou Sarr'],
    w: ['Ocytocine', 'Amoxicilline', 'Artéméther/Luméfantrine'],
    b: ['Ocytocine 10 UI/ml injectable', 'Amoxicilline 500 mg gélules', 'Artéméther/Luméfantrine 20/120 mg comprimés'],
    g: ['Rupture chez le grossiste', 'Livraison retardée', 'Seulement de petits conditionnements'],
    neu: ['Ceftriaxone', 'Ceftriaxone 1 g injectable', 'Rupture chez le grossiste'] },
  { sp: 'pt', land: 'MZ', locale: 'pt-MZ', zone: 'Africa/Maputo', band: 'Dados de exemplo',
    leute: ['Ana Machava', 'João Cossa', 'Luísa Sitoe'],
    w: ['Oxitocina', 'Amoxicilina', 'Arteméter/Lumefantrina'],
    b: ['Oxitocina 10 UI/ml injetável', 'Amoxicilina 500 mg cápsulas', 'Arteméter/Lumefantrina 20/120 mg comprimidos'],
    g: ['Esgotado no grossista', 'Fornecimento atrasado', 'Só embalagens pequenas'],
    neu: ['Ceftriaxona', 'Ceftriaxona 1 g injetável', 'Esgotado no grossista'] },
  { sp: 'ar', land: 'EG', locale: 'ar-EG', zone: 'Africa/Cairo', band: 'بيانات توضيحية',
    leute: ['Mona Hassan', 'Ahmed Farouk', 'Sara Mahmoud'],
    // Wirkstoff und Präparat lateinisch — so schreibt man sie in Ägypten (und nur so greift
    // die INN-Zuordnung, siehe lateinHinweis in app.js); der Grund auf Arabisch.
    w: ['Oxytocin', 'Amoxicillin', 'Artemether/Lumefantrine'],
    b: ['Oxytocin 10 IU/ml injection', 'Amoxicillin 500 mg capsules', 'Artemether/Lumefantrine 20/120 mg tablets'],
    g: ['نفد لدى تاجر الجملة', 'تأخر المورّد', 'عبوات صغيرة فقط'],
    neu: ['Ceftriaxone', 'Ceftriaxone 1 g injection', 'نفد لدى تاجر الجملة'] },
];

async function server() {
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'apo-store-')), 'daten.json');
  const proc = spawn(process.execPath, ['src/http/server.js'], { cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', APOPULSE_DATA_FILE: datei, APOPULSE_TOKEN_SECRET: 'store-aufnahme-' + Date.now(), APOPULSE_PRESSE: 'aus' } });
  const base = await new Promise((ok, nein) => {
    let l = '';
    proc.stdout.on('data', (x) => { l += x; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) ok('http://localhost:' + m[1]); });
    proc.on('exit', (c) => nein(new Error('Server beendet: ' + c)));
  });
  return { base, stop: () => proc.kill() };
}

async function main() {
  const { base, stop } = await server();
  const api = async (pfad, body, token) => (await fetch(base + pfad, { method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined })).json();
  const browser = await pkg.chromium.launch();
  const fehler = [];
  const erzeugt = [];
  try {
    for (const S of SPRACHEN) {
      const konto = (name) => api('/api/register', { name, email: `${S.sp}.${name.toLowerCase().replace(/\W+/g, '.')}@beispiel.test`,
        password: 'Beispiel-Passwort-1', country: S.land, locale: S.sp, accountType: 'pharmacy' });
      const [ich, k2, k3] = [await konto(S.leute[0]), await konto(S.leute[1]), await konto(S.leute[2])];
      const melde = (k, i, status) => api('/api/shortages/report', { wirkstoff: S.w[i], bezeichnung: S.b[i], status, grund: S.g[i] }, k.token);
      const m1 = await melde(k2, 0, 'kritisch');
      await api(`/api/shortages/${m1.id}/confirm`, {}, k3.token);
      await melde(k3, 1, 'kritisch');
      await melde(k2, 2, 'eingeschraenkt');
      await api('/api/watchlist/bulk', { wirkstoffe: S.w }, ich.token);

      const ordner = path.join(ZIEL, S.sp);
      fs.mkdirSync(ordner, { recursive: true });
      const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3,
        serviceWorkers: 'block', locale: S.locale, timezoneId: S.zone });
      await ctx.addInitScript(([t, land]) => {
        localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1');
        localStorage.setItem('apo_country', land); localStorage.setItem('apo_install', 'fertig');
      }, [ich.token, S.land]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => fehler.push(`${S.sp}: ${e.message}`));
      const foto = async (name) => {
        await page.waitForTimeout(600);
        await page.evaluate((band) => {
          // Vorübergehende Hinweise (Datenabruf, Codes-/App-Karte) gehören nicht zur Aussage.
          document.querySelectorAll('[data-datenstand],[data-rckarte],[data-installkarte],.backtotop,#store-band').forEach((e) => e.remove());
          const d = document.createElement('div');
          d.id = 'store-band'; d.textContent = band;
          // Schmales Band GANZ OBEN, über dem Kopf — verdeckt weder Inhalt noch Leiste.
          // Alles, was oben klebt (Kopfzeile), rückt um die Bandhöhe nach unten.
          const H = 26;
          if (!document.body.dataset.bandPlatz) {
            document.body.dataset.bandPlatz = '1';
            document.body.style.paddingTop = (parseFloat(getComputedStyle(document.body).paddingTop) + H) + 'px';
          }
          for (const e of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(e);
            if ((cs.position === 'fixed' || cs.position === 'sticky') && parseFloat(cs.top) === 0 && !e.dataset.bandVersetzt) { e.dataset.bandVersetzt = '1'; e.style.top = H + 'px'; }
          }
          d.style.cssText = `position:fixed;top:0;left:0;right:0;height:${H}px;line-height:${H}px;text-align:center;z-index:99999;background:#1f2937;color:#fff;font:600 13px system-ui,sans-serif`;
          document.body.appendChild(d);
        }, S.band);
        const datei = path.join(ordner, name);
        await page.screenshot({ path: datei });
        erzeugt.push(datei);
      };

      await page.goto(base + '/?src=twa', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await page.click('.tabs button[data-tab="shortages"]');
      await page.waitForTimeout(1400);
      // Die Liste selbst zeigen, nicht nur Kopf und Meldeformular.
      await page.evaluate(() => { const l = document.querySelector('[data-shortlist]'); l.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); });
      await foto('1-shortages.png');

      await page.click('[data-meldekarte] [data-toggle]');
      await page.waitForTimeout(400);
      await page.fill('[data-meldekarte] [data-w]', S.neu[0]);
      await page.fill('[data-meldekarte] [data-b]', S.neu[1]);
      await page.fill('[data-meldekarte] [data-g]', S.neu[2]);
      await page.evaluate(() => { document.querySelector('[data-meldekarte]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await foto('2-report.png');

      await page.evaluate((w) => openWirkstoff(w), S.w[1]);
      await page.waitForTimeout(1600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await foto('3-medicine.png');

      await page.click('.tabs button[data-tab="overview"]').catch(() => {});
      await page.waitForTimeout(1400);
      await page.evaluate(() => window.scrollTo(0, 0));
      await foto('4-overview.png');
      await ctx.close();
    }
  } finally {
    await browser.close();
    stop();
  }
  for (const d of erzeugt) console.log(`  ✓ ${path.relative(process.cwd(), d)}  ${Math.round(fs.statSync(d).size / 1024)} KB`);
  if (fehler.length) { console.error('❌ Fehler in der Seite:', fehler); process.exitCode = 1; }
  else console.log(`✓ ${erzeugt.length} Screenshots (1080 × 1920), 4 Sprachen.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
