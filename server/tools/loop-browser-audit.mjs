// ApoPulse Loop — GATHER (Browser-Teil). Automatisiert die manuellen Mobil-Checks:
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
      // A11y (nur einmal — DOM-Struktur ist themen-unabhängig): Formularelemente ohne
      // zugänglichen Namen (aria-label/Placeholder/title/<label>) + Bilder ohne alt.
      // Fängt die Klasse aus Cycle #39 (unbenannte Selects, Vorschau-Bilder ohne alt).
      if (theme === 'hell') {
        const a11y = await page.evaluate(() => {
          const bad = { controls: 0, imgs: 0 };
          document.querySelectorAll('input,textarea,select').forEach((el) => {
            if (el.type === 'hidden') return;
            const id = el.id;
            const named = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title')
              || (id && document.querySelector(`label[for="${id}"]`)) || el.closest('label');
            if (!named) bad.controls++;
          });
          document.querySelectorAll('img').forEach((el) => { if (el.getAttribute('alt') === null) bad.imgs++; });
          // Anklickbare Nicht-Button-Elemente (.clickable) müssen per Tastatur bedienbar sein
          // (tabindex + role), sonst sind sie für Tastatur-/Screenreader-Nutzer:innen unerreichbar.
          bad.clickables = 0;
          const NATIVE = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
          document.querySelectorAll('.clickable').forEach((el) => {
            if (NATIVE.has(el.tagName)) return;
            if (!el.hasAttribute('tabindex') || el.getAttribute('role') === null) bad.clickables++;
          });
          // Verschachtelte Klick-Elemente (Button im Button) sind ungültiges ARIA.
          bad.nested = document.querySelectorAll('.clickable .clickable').length;
          // Umfassender: JEDES Nicht-Button-Element mit onclick-Handler muss tastaturbedienbar
          // sein (tabindex+role) — fängt auch interaktive Elemente, die nicht .clickable sind.
          bad.onclickKbd = 0;
          const NATIVE2 = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']);
          document.querySelectorAll('*').forEach((el) => {
            if (typeof el.onclick !== 'function' || NATIVE2.has(el.tagName)) return;
            if (!el.hasAttribute('tabindex') || el.getAttribute('role') === null) bad.onclickKbd++;
          });
          return bad;
        });
        if (a11y.controls) findings.push(`A11y: ${a11y.controls} Formularelement(e) ohne Namen [${name}]`);
        if (a11y.imgs) findings.push(`A11y: ${a11y.imgs} Bild(er) ohne alt [${name}]`);
        if (a11y.clickables) findings.push(`A11y: ${a11y.clickables} anklickbare(s) Element(e) nicht tastaturbedienbar [${name}]`);
        if (a11y.nested) findings.push(`A11y: ${a11y.nested} verschachtelte(s) Klick-Element(e) (Button im Button) [${name}]`);
        if (a11y.onclickKbd) findings.push(`A11y: ${a11y.onclickKbd} onclick-Element(e) ohne Tastaturzugang [${name}]`);
      }
    }
    if (errors.length) findings.push(`JS-Fehler [${theme}]: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  // Querscroll auch bei mittleren & Desktop-Breiten prüfen (Tablet, kleines/geteiltes
  // Fenster, Laptop). Der Mobil-390-Check allein übersieht Overflow in diesem Bereich —
  // genau dort versteckte sich einmal ein Kopfzeilen-Overflow (561–1170px). Ein Theme
  // genügt: horizontaler Overflow ist Layout, weitgehend themen-unabhängig.
  const SWEEP_WIDTHS = [768, 1024, 1280, 1440];
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    for (const w of SWEEP_WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(200);
      for (const [name, label] of TABS) {
        await page.getByText(label, { exact: false }).first().click().catch(() => {});
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) findings.push(`Querscroll: ${name} [${w}px]`);
      }
    }
    await ctx.close();
  }

  // Große Schrift (a11y-Umschalter Stufe „sehr groß" = 22px) darf das Layout nicht
  // sprengen. Prüft Querscroll auf Handy (390) und Desktop (1280) — genau die Klasse,
  // die einmal Kopf-Beschriftungen & Reiter-Raster überlaufen ließ. Der Standard-Check
  // testet nur 16px und übersieht das.
  for (const w of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_fontscale', '2'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    for (const [name, label] of TABS) {
      await page.getByText(label, { exact: false }).first().click().catch(() => {});
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) findings.push(`Querscroll: ${name} [${w}px · große Schrift]`);
    }
    await ctx.close();
  }

  // Wirkstoff-Detailseite (Hub) separat prüfen — sie ist KEIN Reiter und entging daher
  // dem Tab-Sweep. Genau hier versteckte sich ein Kopf-Button-Überlauf bei 390px (die
  // Aktions-Buttons brachen nicht um). Seed-Wirkstoff „Amoxicillin" ist immer vorhanden.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE + '/?wirkstoff=' + encodeURIComponent('Amoxicillin'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) findings.push('Querscroll: Wirkstoff-Detail [390px]');
    await ctx.close();
  }

  // Sprache folgt dem Land. Bisher stand diese Zusage nur im Code — geprüft
  // wurde sie nirgends, und eine Zusage ohne Prüfung ist eine Hoffnung.
  // Getestet wird die Wirkung, nicht die Zuweisung: Steht nach der Länderwahl
  // tatsächlich englischer bzw. portugiesischer Text auf dem Schirm?
  {
    // ABGEMELDET: Die Länderwahl ist Schritt 1 des Anmeldeflusses. Mit
    // eingespieltem Token landet man direkt im Feed und sieht sie nie —
    // deshalb hier ausdrücklich KEIN Token.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
    const page = await ctx.newPage();

    for (const [land, sprache] of [['GB', 'en'], ['BR', 'pt'], ['AT', 'de']]) {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(() => { localStorage.removeItem('apo_country'); localStorage.removeItem('apo_locale'); });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      const knopf = page.locator(`.country-pick[data-country="${land}"]`).first();
      if (!(await knopf.count())) { findings.push(`Länderwahl: ${land} nicht anklickbar`); continue; }
      await knopf.click();
      await page.waitForTimeout(400);

      const gesetzt = await page.evaluate(() => localStorage.getItem('apo_locale'));
      if (gesetzt !== sprache) {
        findings.push(`Sprache folgt Land nicht: ${land} -> "${gesetzt}" statt "${sprache}"`);
        continue;
      }
      // Und der Text muss sich wirklich geändert haben — sonst wäre nur eine
      // Variable gesetzt und die Oberfläche stünde weiter auf Deutsch.
      const html = await page.evaluate(() => document.body.innerText.slice(0, 4000));
      const erwartet = { en: /Shortages|Prices|Discounts|For you/i, pt: /Ruturas|Preços|Descontos|Para si/i, de: /Engpässe|Preise|Rabatte/i };
      if (!erwartet[sprache].test(html)) {
        findings.push(`Oberfläche nicht in "${sprache}" nach Wahl von ${land}`);
      }
    }
    await ctx.close();
  }

  // Landesübliche Schreibweise und Amtsbegriffe. Beides hängt am LAND, nicht
  // nur an der Sprache — geprüft wird im angemeldeten Betrieb über den
  // Länder-Umschalter im Kopf.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });

    const wechsle = async (cc) => {
      await page.selectOption('#countrySwitch', cc).catch(() => {});
      await page.waitForTimeout(500);
    };

    // 1. Amtsbegriff: dieselbe Sprache, anderer Begriff.
    await wechsle('AT');
    const at = await page.locator('[data-tab="shortages"]').innerText();
    await wechsle('DE');
    const de = await page.locator('[data-tab="shortages"]').innerText();
    if (!/Vertriebseinschränkung/i.test(at)) findings.push(`AT-Begriff fehlt im Reiter: "${at}"`);
    if (!/Lieferengpass|Lieferengpässe/i.test(de)) findings.push(`DE-Begriff fehlt im Reiter: "${de}"`);
    if (at === de) findings.push('AT und DE zeigen denselben Begriff — die Übersteuerung greift nicht');

    // 2. Datumsformat: 03/04 heißt in den USA März, in Grossbritannien April.
    //    Ein Engpass-Meldedatum falsch zu lesen ist keine Kosmetik.
    const probe = async (cc) => {
      await wechsle(cc);
      return page.evaluate(() => {
        // Über die Seitenfunktion selbst, nicht über eine Nachbildung —
        // sonst prüfte der Test seine eigene Kopie statt der Anwendung.
        const f = window.__fmtDateDe || null;
        return f ? f('2026-04-03') : null;
      });
    };
    const us = await probe('US');
    const gb = await probe('GB');
    if (us && gb) {
      if (!/^04\/03\/2026$/.test(us)) findings.push(`US-Datumsformat falsch: "${us}" (erwartet 04/03/2026)`);
      if (!/^03\/04\/2026$/.test(gb)) findings.push(`GB-Datumsformat falsch: "${gb}" (erwartet 03/04/2026)`);
    } else {
      findings.push('Datumsformat nicht prüfbar — window.__fmtDateDe fehlt');
    }
    await ctx.close();
  }

  // ── Warnung vor nicht dauerhafter Speicherung ─────────────────────────────
  //  Eigener Kontext OHNE Anmeldung: Die übrige Prüfung meldet sich mit einem
  //  Token an und bekommt den Registrierungs-Bildschirm deshalb nie zu sehen —
  //  genau den Bildschirm, um den es hier geht.
  //
  //  Anlass ist ein echter Beinahe-Schaden: Am 05.09.2026 beantwortete ein
  //  Render-Dienst OHNE Datenbank die Kundendomain. Im Server-Protokoll stand
  //  die Warnung, auf dem Anmeldebildschirm stand nichts — ausgerechnet die
  //  Person, die ihr Passwort verliert, war die einzige ohne Vorwarnung.
  //
  //  Diese Prüfumgebung läuft ohne DATABASE_URL. Die Warnung MUSS hier also
  //  erscheinen; täte sie es nicht, wäre sie auch im Ernstfall stumm.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // Bis zum Registrierungs-Formular durchklicken (Schritt 1 ist die Länderwahl).
    await page.getByText('Österreich', { exact: false }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    const box = page.locator('#rg_durability');
    const sichtbar = await box.isVisible().catch(() => false);
    const text = sichtbar ? (await box.innerText()).trim() : '';
    const stufe = await page.evaluate(() => fetch('/api/health').then((r) => r.json()).then((h) => h.durability));
    if (stufe === 'sicher') {
      findings.push('Prüfumgebung hat eine Datenbank — die Warnung ist so nicht prüfbar');
    } else if (!sichtbar) {
      findings.push(`Keine Warnung vor flüchtiger Speicherung (Stufe: ${stufe})`);
    } else if (!/dauerhaft|Passwort/i.test(text)) {
      findings.push(`Warnung steht, nennt aber weder Dauerhaftigkeit noch Passwort: "${text}"`);
    } else {
      console.log(`✓ Warnung vor flüchtiger Speicherung steht am Registrierungs-Formular — ${text.slice(0, 60)}…`);
    }
    await ctx.close();
  }

  await browser.close();
  stopServer();

  console.log('── ApoPulse Loop · GATHER (Browser) · 390 + 768/1024/1280/1440 + große Schrift + Wirkstoff-Detail ──');
  if (findings.length === 0) {
    console.log('✓ Kein Querscroll (Mobil + Tablet/Laptop-Breiten + große Schrift + Detailseite), keine JS-Fehler, keine a11y-Lücken auf 8 Reitern (hell + dunkel).');
  } else {
    console.log(`⚠️ ${findings.length} Befund(e):`);
    findings.forEach((f) => console.log('  - ' + f));
    process.exitCode = 1;
  }
}
main();
