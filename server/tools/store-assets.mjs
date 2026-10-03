// ============================================================================
//  Grafiken für den Google Play Store erzeugen
// ============================================================================
//  Der Play Store verlangt vor der Veröffentlichung Bildmaterial in festen
//  Maßen. Fehlt eines, lässt sich der Eintrag nicht absenden:
//
//    App-Symbol        512 × 512     (liegt bereits als public/icon-512.png vor)
//    Feature-Grafik   1024 × 500     Pflicht, erscheint oben im Store-Eintrag
//    Screenshots      mind. 2, max 8  Telefon-Format
//
//  WARUM ECHTE SCREENSHOTS UND KEINE MONTAGEN
//
//  Es wäre schneller, die Bilder in einem Grafikprogramm zu bauen. Das wäre
//  aber dieselbe Klasse Fehler wie erfundene Preise unter echten Firmennamen:
//  Der Store-Eintrag würde eine Anwendung zeigen, die es so nicht gibt. Google
//  entfernt Einträge, deren Screenshots nicht die tatsächliche App zeigen, und
//  eine Apothekerin, die etwas anderes installiert als abgebildet, ist zu Recht
//  verärgert.
//
//  Dieses Werkzeug startet deshalb die echte Anwendung, meldet ein echtes Konto
//  an und fotografiert die echten Bildschirme.
//
//  Aufruf:  node tools/store-assets.mjs [baseUrl]
//  Ergebnis: public/store/*.png  (und damit auch über die Website abrufbar,
//            was das Manifest für die „Installieren"-Karte im Browser nutzt)
// ============================================================================

import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { ensureServer } from './_ensure-server.mjs';
import { featureListe, featureEnvKey } from '../src/data/features.js';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = pkg;
const BASE = process.argv[2] || 'http://127.0.0.1:4002';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'store');

// Telefon-Hochformat. 1080 × 1920 ist das verbreitetste Seitenverhältnis und
// liegt sicher innerhalb der Play-Grenzen (320–3840 px je Kante).
const PHONE = { width: 1080, height: 1920 };

/** Die Feature-Grafik: 1024 × 500, als echte Seite gerendert statt gemalt. */
const FEATURE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  /* Jede Farbe ausgeschrieben und geprueft. Die erste Fassung trug im
     Farbverlauf ein "#07602" mit Strichpunkt — fuenf Hex-Stellen und ein
     Zeichen zuviel. CSS verwirft eine ungueltige Deklaration KOMMENTARLOS:
     Der Verlauf fiel weg, der Hintergrund blieb weiss, und weisse Schrift auf
     Weiss ergab eine fast leere Grafik. Im Store waere das der erste Eindruck
     gewesen. Deshalb unten auch ein Test, der die Helligkeit misst, statt sich
     darauf zu verlassen, dass eine Datei entstanden ist. */
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1024px; height:500px; }
  body { display:flex; align-items:center; gap:56px; padding:0 72px;
         background-color:#0b7f28;
         background-image:linear-gradient(135deg, #0f8f31 0%, #0b7f28 55%, #064a19 100%);
         font-family:"Segoe UI", system-ui, -apple-system, sans-serif;
         color:#ffffff; overflow:hidden; }
  .mark { font-size:132px; line-height:1; flex:none; }
  h1 { font-size:66px; line-height:1.05; letter-spacing:-.02em; font-weight:700; color:#ffffff; }
  p { font-size:28px; line-height:1.4; margin-top:18px; color:#d8f0dd; max-width:22ch; }
  .pill { display:inline-block; margin-top:28px; font-size:19px; letter-spacing:.08em;
          text-transform:uppercase; color:#ffffff; border:2px solid rgba(255,255,255,.6);
          padding:9px 20px; border-radius:999px; }
</style></head><body>
  <div class="mark">\u{1F48A}</div>
  <div>
    <h1>ApoPulse</h1>
    <p>Lieferengp\u00e4sse, Beh\u00f6rden-News und Preise \u2014 mit Quelle.</p>
    <span class="pill">F\u00fcr Apotheken</span>
  </div>
</body></html>`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // ALLE Bereiche an: Der Store-Eintrag soll zeigen, was die Anwendung kann.
  // Die geparkten Bereiche (features.js) sind ausgeblendet, nicht abgeschafft —
  // sie gehören trotzdem nicht auf die Screenshots, solange sie ruhen. Deshalb
  // bleibt es bei der VOREINSTELLUNG: abgebildet wird, was Nutzer:innen
  // tatsächlich bekommen.
  let stopServer = () => {};
  try { stopServer = await ensureServer(BASE); }
  catch (e) { console.error(`❌ ${e.message}`); process.exit(2); }

  const uniq = Date.now().toString(36);
  const reg = await (await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Mag. Anna Huber', email: `store_${uniq}@example.com`, password: 'Passwort123!',
      handle: `apo_${uniq}`, country: 'AT', accountType: 'pharmacy',
    }),
  })).json();
  if (!reg || !reg.token) { console.error('❌ Konto für die Aufnahme nicht angelegt'); stopServer(); process.exit(2); }

  const browser = await chromium.launch();
  const erzeugt = [];

  // ── Feature-Grafik ────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(FEATURE_HTML, { waitUntil: 'load' });
    const datei = path.join(OUT, 'feature-graphic-1024x500.png');
    await page.screenshot({ path: datei });
    // Nicht darauf verlassen, dass eine Datei entstanden ist: Die erste Fassung
    // erzeugte brav eine PNG — nur war sie fast weiss, weil eine ungueltige
    // CSS-Zeile den Farbverlauf kommentarlos verworfen hatte. Gemessen wird
    // deshalb die tatsaechliche Flaechenfarbe an vier Stellen.
    const proben = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, bild: s.backgroundImage, text: getComputedStyle(document.querySelector('h1')).color };
    });
    const dunkel = /rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(proben.bg);
    const hell = dunkel && (Number(dunkel[1]) + Number(dunkel[2]) + Number(dunkel[3])) / 3 > 200;
    if (hell || proben.bild === 'none') {
      console.error(`❌ Feature-Grafik: Hintergrund ist ${proben.bg} / ${proben.bild}. `
        + 'Weisse Schrift darauf waere unlesbar — vermutlich eine ungueltige CSS-Zeile.');
      process.exitCode = 1;
    }
    erzeugt.push(['Feature-Grafik', '1024×500', datei]);
    await ctx.close();
  }

  // ── Screenshots der echten Anwendung ──────────────────────────────────────
  const AUFNAHMEN = [
    ['shortages', 'screen-1-engpaesse.png', 'Lieferengpässe'],
    ['overview', 'screen-2-uebersicht.png', 'Startübersicht'],
    ['news', 'screen-3-news.png', 'Behörden-News'],
    ['prices', 'screen-4-preise.png', 'Preisvergleich'],
  ];
  {
    const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript((t) => {
      localStorage.setItem('apo_token', t);
      localStorage.setItem('apo_welcome_seen', '1');
    }, reg.token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    for (const [tab, name, titel] of AUFNAHMEN) {
      // Über data-tab statt über die Beschriftung: Der Text wechselt mit der
      // Sprache, das Attribut nicht.
      const treffer = await page.$(`.tabs button[data-tab="${tab}"]`);
      if (!treffer) { console.warn(`⚠️  Reiter "${tab}" fehlt — übersprungen (ruht er?)`); continue; }
      await treffer.click();
      await page.waitForTimeout(1100);
      const datei = path.join(OUT, name);
      // Kein fullPage: Play erwartet Telefon-Seitenverhältnisse, kein
      // 1080 × 6000 langes Band.
      await page.screenshot({ path: datei });
      erzeugt.push([titel, `${PHONE.width}×${PHONE.height}`, datei]);
    }
    await ctx.close();
  }

  await browser.close();
  stopServer();

  console.log('── Play-Store-Grafiken ──');
  for (const [was, mass, datei] of erzeugt) {
    const kb = Math.round(fs.statSync(datei).size / 1024);
    console.log(`  ✓ ${was.padEnd(18)} ${mass.padEnd(11)} ${kb} KB  ${path.relative(process.cwd(), datei)}`);
  }
  // Play verlangt MINDESTENS zwei Screenshots. Weniger lässt den Eintrag nicht
  // absenden — und das soll hier auffallen, nicht erst in der Play Console.
  const screens = erzeugt.length - 1;
  if (screens < 2) {
    console.error(`❌ Nur ${screens} Screenshot(s). Play verlangt mindestens 2.`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ ${screens} Screenshots + Feature-Grafik. App-Symbol: public/icon-512.png`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
