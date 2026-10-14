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
import { spawn } from 'node:child_process';
import path from 'node:path';
const SERVER_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { chromium } = pkg;

const BASE = process.argv[2] || 'http://127.0.0.1:4000';
// ── Die Reiter werden GELESEN, nicht aufgezaehlt ────────────────────────────
//  Vorher stand hier eine feste Liste aus deutschen Beschriftungen. Zwei
//  Fehler in einem:
//
//   1. Ein NEUER Reiter wurde nie geprueft. Genau das passierte beim Reiter
//      „Live-Warnungen": Die Ansicht war fertig, der Audit kannte sie nicht,
//      und der Querscroll-Durchlauf lief gruen an ihr vorbei.
//   2. Geklickt wurde ueber den SICHTBAREN TEXT. In einem Land mit englischer
//      Oberflaeche (Kenia, Nigeria, …) trifft „📦 Engpässe" nichts — der
//      Klick scheiterte still und der Pruefpunkt war wertlos, ohne rot zu
//      werden.
//
//  Jetzt kommt die Liste aus der Reiterleiste selbst, und geklickt wird ueber
//  `data-tab`. Die Untergrenze unten ist der Riegel gegen die leise Variante
//  desselben Fehlers: Wenn der Selektor einmal nichts mehr findet, laeuft der
//  Durchlauf nicht ueber null Reiter durch, sondern meldet es.
const REITER_MINDESTENS = 8;

async function reiterLesen(page, findings, wo) {
  const reiter = await page.$$eval('.tabs button[data-tab]', (els) => els.map((e) => ({
    tab: e.dataset.tab, label: (e.innerText || '').trim(),
  }))).catch(() => []);
  if (reiter.length < REITER_MINDESTENS) {
    findings.push(`Reiterleiste nicht gelesen (${reiter.length} Reiter) [${wo}] — `
      + 'der Querscroll-Durchlauf prueft damit nichts.');
  }
  return reiter;
}

/** Einen Reiter oeffnen. Ueber data-tab, damit die Sprache keine Rolle spielt. */
async function reiterOeffnen(page, tab) {
  // Am Handy stehen seltene Reiter im „Mehr"-Blatt (Design v2). Ohne diesen
  // Schritt wartete der Klick auf ein unsichtbares Element, lief in die
  // Zeitüberschreitung und wurde still verschluckt — der Reiter blieb ungeprüft.
  const knopf = page.locator(`.tabs button[data-tab="${tab}"]`);
  if (!(await knopf.isVisible().catch(() => false))) await page.click('.tabs .tab-mehr', { timeout: 2000 }).catch(() => {});
  await knopf.click({ timeout: 5000 }).catch(() => {});
}

async function api(path, opts = {}) {
  const r = await fetch(BASE + path, { headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, ...opts });
  return r.json().catch(() => null);
}

async function main() {
  // Server sicherstellen (nutzt laufenden ODER startet einen und beendet ihn am Ende).
  let stopServer = () => {};
  // Rechnungssteller gesetzt: sonst gäbe es weder Rechnungen noch „Per Rechnung zahlen" zu prüfen.
  // APOPULSE_BESTAETIGUNG_AB_STUNDEN 0: Die Prüfungen bestätigen mit frisch angelegten Konten.
  // Die 24-Stunden-Regel selbst prüft test/schein-konten.test.js (mit Uhr).
  try { stopServer = await ensureServer(BASE, { APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0', APOPULSE_FIRMA_NAME: 'Prüfbetrieb GmbH', APOPULSE_FIRMA_ANSCHRIFT: 'Prüfweg 1, 1010 Wien', APOPULSE_BANK_IBAN: 'AT00 0000 0000 0000 0000', APOPULSE_UST_SATZ: '20' }); }
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
  // Service Worker standardmäßig AUS: Viele Prüfungen bilden API-Antworten mit
  // page.route nach — Anfragen aus dem Service Worker umgehen das (seit er
  // Lese-Antworten für offline speichert). Wo der Service Worker selbst geprüft
  // wird (Push, Offline), steht ausdrücklich serviceWorkers: 'allow'.
  { const neu = browser.newContext.bind(browser); browser.newContext = (opt = {}) => neu({ serviceWorkers: 'block', ...opt }); }
  const findings = [];
  for (const [theme, scheme] of [['hell', 'light'], ['dunkel', 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 80)); });
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const reiter = await reiterLesen(page, findings, theme);
    for (const { tab, label } of reiter) {
      await reiterOeffnen(page, tab);
      await page.waitForTimeout(450);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) findings.push(`Querscroll: ${label || tab} [${theme}]`);
      // ── Kontrast (WCAG AA), in BEIDEN Themen ──────────────────────────────
      //  Vorher prüfte dieses Audit Beschriftungen und Tastatur, aber keinen
      //  Kontrast — und meldete „keine a11y-Lücken (hell + dunkel)", während
      //  im dunklen Modus weiße Schrift auf hellgrünen Knöpfen bei 2,1:1 lag.
      //  Gemessen wird jede sichtbare Textstelle gegen ihren TATSÄCHLICHEN
      //  Hintergrund (durchsichtige Ebenen werden verrechnet); Hintergrund-
      //  bilder gelten als nicht messbar und werden übersprungen.
      const kontrast = await page.evaluate(() => {
        const rgba = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const ueber = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
        const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        const hintergrund = (el) => {
          const ebenen = [];
          for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // nicht messbar
            const c = rgba(cs.backgroundColor);
            if (c && c.a > 0) { ebenen.push(c); if (c.a >= 0.99) break; }
          }
          let basis = { r: 255, g: 255, b: 255, a: 1 };
          for (let i = ebenen.length - 1; i >= 0; i--) basis = ueber(ebenen[i], basis);
          return basis;
        };
        const schlecht = [];
        let geprueft = 0;
        for (const el of document.querySelectorAll('body *')) {
          if (!el.getClientRects().length || el.closest('[aria-hidden="true"],.hidden,script,style,noscript')) continue;
          const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
          if (!/[\p{L}\p{N}]/u.test(text)) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1 || el.disabled) continue;
          const bg = hintergrund(el); const fg0 = rgba(cs.color);
          if (!bg || !fg0) continue;
          const fg = ueber(fg0, bg);
          const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
          const r = (l1 + 0.05) / (l2 + 0.05);
          const groesse = parseFloat(cs.fontSize); const fett = parseInt(cs.fontWeight, 10) >= 700;
          const grenze = (groesse >= 24 || (fett && groesse >= 18.66)) ? 3 : 4.5;
          geprueft++;
          if (r < grenze) schlecht.push({ text: text.slice(0, 28), r: Math.round(r * 10) / 10, fg: hex(fg), bg: hex(bg) });
        }
        return { geprueft, schlecht };
      });
      if (kontrast.schlecht.length) {
        const bsp = kontrast.schlecht.slice(0, 3).map((x) => `„${x.text}" ${x.r}:1 (${x.fg} auf ${x.bg})`).join(' · ');
        findings.push(`Kontrast: ${kontrast.schlecht.length} Textstelle(n) unter WCAG AA [${label || tab} · ${theme}] — z. B. ${bsp}`);
      }
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
    const reiter = await reiterLesen(page, findings, 'Breiten-Sweep');
    for (const w of SWEEP_WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(200);
      for (const { tab, label } of reiter) {
        await reiterOeffnen(page, tab);
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) findings.push(`Querscroll: ${label || tab} [${w}px]`);
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
    const reiter = await reiterLesen(page, findings, `${w}px · große Schrift`);
    for (const { tab, label } of reiter) {
      await reiterOeffnen(page, tab);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) findings.push(`Querscroll: ${label || tab} [${w}px · große Schrift]`);
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

    // 1. Amtsbegriff: dieselbe Sprache, anderer Begriff. Er steht als
    //    Überschrift der Engpass-Seite und als Tooltip am Reiter; der Reiter
    //    selbst trägt das kurze Alltagswort (der 24-Zeichen-Amtsbegriff
    //    zerbrach auf dem Handy mitten im Wort).
    const amt = async (cc) => {
      await wechsle(cc);
      await page.click('[data-tab="shortages"]');
      await page.waitForSelector('[data-shead]', { timeout: 5000 }).catch(() => {});
      return {
        kopf: (await page.locator('[data-shead]').first().innerText().catch(() => '')) || '',
        tip: (await page.locator('[data-tab="shortages"]').getAttribute('title')) || '',
        reiter: await page.locator('[data-tab="shortages"]').innerText(),
      };
    };
    const at = await amt('AT');
    const de = await amt('DE');
    if (!/Vertriebseinschränkung/i.test(at.kopf)) findings.push(`AT-Begriff fehlt als Überschrift der Engpass-Seite: "${at.kopf}"`);
    if (!/Vertriebseinschränkung/i.test(at.tip)) findings.push(`AT-Begriff fehlt im Tooltip des Reiters: "${at.tip}"`);
    if (!/Lieferengpass|Lieferengpässe/i.test(de.kopf)) findings.push(`DE-Begriff fehlt als Überschrift: "${de.kopf}"`);
    if (at.kopf === de.kopf) findings.push('AT und DE zeigen denselben Begriff — die Übersteuerung greift nicht');
    if (!/^\S*\s*Engpässe$/.test(at.reiter.replace(/\s+/g, ' ').trim())) findings.push(`Reiter trägt nicht das kurze Alltagswort: "${at.reiter}"`);

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

  // ── Navigation lesbar: kein Wort zerbrochen, kein Wort abgeschnitten ─────
  //  Vorher am Handy: „Vertriebse|inschränk|ungen", „Live-Warnung|en", und im
  //  Kopf nur 🌙 A ❓ 🔔 🚪 ohne Wort. Der Querscroll-Check sah davon nichts —
  //  ein mitten im Wort umbrochenes Label ragt nirgends hinaus. Geprüft wird
  //  jedes Wort einzeln: liegt es auf mehr als einer Zeile, ist es zerbrochen
  //  (Bindestrich und Schrägstrich sind erlaubte Trennstellen). Dazu die
  //  Kopf-Werkzeuge in der Moderations-Ausstattung (acht statt fünf Knöpfe).
  {
    for (const w of [360, 390, 1024]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: 'light' });
      const page = await ctx.newPage();
      await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
      await page.goto(BASE, { waitUntil: 'networkidle' });
      for (const cc of ['AT', 'GB', 'PT']) {
        await page.selectOption('#countrySwitch', cc).catch(() => {});
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
          ['btnMod', 'btnCart', 'btnDm', 'btnNotif', 'btnHelp', 'btnLogout'].forEach((id) => document.getElementById(id)?.classList.remove('hidden'));
          // Design v2: Werkzeuge im Kopf-Menü, seltene Reiter im „Mehr"-Blatt —
          // beides aufklappen, sonst wären ihre Wörter hier unsichtbar und ungeprüft.
          const menue = document.getElementById('kopfMenue'); if (menue) menue.hidden = false;
          document.querySelector('.tabs')?.classList.add('mehr-offen');
          const f = [];
          const els = [...document.querySelectorAll('.tabs button, header button')].filter((el) => el.offsetParent);
          for (const el of els) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = walker.nextNode())) {
              const re = /[^\s\-\/]+/gu; let m;
              while ((m = re.exec(n.data))) {
                const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
                if (new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size > 1) f.push(`zerbrochen „${m[0]}"`);
              }
            }
          }
          document.querySelectorAll('header .hlabel').forEach((el) => {
            if (!el.offsetParent) f.push(`Kopf-Werkzeug ohne sichtbares Wort: „${el.textContent}"`);
            else if (el.scrollWidth > el.clientWidth + 1) f.push(`abgeschnitten „${el.textContent}"`);
          });
          return f;
        });
        for (const x of r) findings.push(`Navigation ${w}px ${cc}: ${x}`);
      }
      await ctx.close();
    }
  }

  // ── Design v2: Navigation wie in sozialen Apps ───────────────────────────
  //  Handy: Leiste unten, fünf Ziele, Rest im „Mehr"-Blatt. Desktop: Leiste
  //  links, rechte Spalte ab 1280px. Kopf: Meldungen + Menü. Keine Emojis in
  //  Navigation, Kopf und Startseiten-Liste. Geprüft wird das VERHALTEN
  //  (öffnen, schließen, Markierung), nicht nur das Aussehen.
  {
    const EMOJI = /\p{Extended_Pictographic}/u;
    for (const w of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 860 } });
      const page = await ctx.newPage();
      const fehler = [];
      page.on('pageerror', (e) => fehler.push(e.message));
      await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const lage = await page.evaluate(() => {
        const r = document.querySelector('.tabs').getBoundingClientRect();
        const app = document.getElementById('app').getBoundingClientRect();
        const rs = document.getElementById('rechteSpalte');
        const texte = [...document.querySelectorAll('.tabs button, header button, .ov-links')].map((e) => e.textContent).join(' ');
        // Beschriftungen der Startseite: kein Emoji am Anfang (zentral in
        // ohneEmojiAnfang entfernt — dieser Teil fällt auf, wenn das wegfällt).
        const anfang = [...document.querySelectorAll('#app h1, #app h2, #app h3, #app button, #app b')]
          .filter((e) => e.offsetParent && !e.closest('.reacts')).map((e) => e.textContent.trim())
          .filter((x) => /^\p{Extended_Pictographic}/u.test(x));
        return { anfang, unten: Math.round(innerHeight - r.bottom), links: r.right <= app.left + 20, rechts: !!(rs && rs.getClientRects().length && getComputedStyle(rs).display !== 'none'), texte,
          sichtbar: [...document.querySelectorAll('.tabs button')].filter((b) => b.offsetParent).length };
      });
      if (EMOJI.test(lage.texte)) findings.push(`Design v2 ${w}px: Emoji in Navigation/Kopf/Startseiten-Liste: ${lage.texte.match(/\p{Extended_Pictographic}/gu).join(' ')}`);
      if (lage.anfang.length) findings.push(`Design v2 ${w}px: Beschriftung beginnt mit Emoji: ${lage.anfang.slice(0, 4).join(' | ')}`);
      if (w < 1000) {
        if (lage.unten > 2) findings.push(`Design v2 ${w}px: Reiterleiste steht nicht unten (Abstand ${lage.unten}px)`);
        if (lage.sichtbar !== 5) findings.push(`Design v2 ${w}px: ${lage.sichtbar} statt 5 Ziele in der unteren Leiste`);
        // „Mehr" öffnen, Preise wählen: Blatt zu, „Mehr" als aktiv markiert.
        await page.click('.tabs .tab-mehr');
        const offen = await page.locator('.tabs button[data-tab="prices"]').isVisible();
        await reiterOeffnen(page, 'prices');
        await page.waitForTimeout(400);
        const nachher = await page.evaluate(() => ({ zu: !document.querySelector('.tabs.mehr-offen'), aktiv: document.querySelector('.tabs .tab-mehr').classList.contains('active') }));
        if (!offen) findings.push(`Design v2 ${w}px: „Mehr" zeigt die übrigen Reiter nicht`);
        if (!nachher.zu) findings.push(`Design v2 ${w}px: „Mehr"-Blatt bleibt nach der Wahl offen`);
        if (!nachher.aktiv) findings.push(`Design v2 ${w}px: aktiver Reiter liegt im „Mehr"-Blatt, „Mehr" ist aber nicht markiert`);
      } else {
        if (!lage.links) findings.push(`Design v2 ${w}px: Navigation steht nicht links neben dem Inhalt`);
        if (!lage.rechts) findings.push(`Design v2 ${w}px: rechte Spalte (News) fehlt`);
      }
      // Premium-Seite ohne Querscroll (der Laufzeit-Knopf ragte am Handy 65px hinaus).
      await page.evaluate(() => openPremium()); await page.waitForTimeout(1200);
      const prBreit = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (prBreit > 1) findings.push(`Design v2 ${w}px: Premium-Seite ${prBreit}px breiter als der Bildschirm`);
      await page.click('.tabs button[data-tab="overview"]').catch(() => {}); await page.waitForTimeout(800);
      // Kopf-Menü: auf, Escape zu, Fokus zurück auf den Knopf.
      await page.click('#btnMenue');
      const auf = await page.evaluate(() => !document.getElementById('kopfMenue').hidden && document.getElementById('btnMenue').getAttribute('aria-expanded') === 'true');
      await page.keyboard.press('Escape');
      const zu = await page.evaluate(() => document.getElementById('kopfMenue').hidden && document.activeElement && document.activeElement.id === 'btnMenue');
      if (!auf) findings.push(`Design v2 ${w}px: Menü öffnet nicht (oder aria-expanded fehlt)`);
      if (!zu) findings.push(`Design v2 ${w}px: Escape schließt das Menü nicht oder Fokus geht verloren`);
      // Navigation bleibt auf Unterseiten: Meldungen leeren #app. Vorher
      // verschwand die Leiste mit, und ein Klick aufs Logo lief in null.innerHTML.
      await page.click('#btnNotif'); await page.waitForTimeout(600);
      const navDa = await page.locator('.tabs button[data-tab="shortages"]').isVisible().catch(() => false);
      if (!navDa) findings.push(`Design v2 ${w}px: Navigation verschwindet auf der Meldungen-Seite`);
      else {
        await page.click('.tabs button[data-tab="shortages"]'); await page.waitForTimeout(1200);
        const ok = await page.evaluate(() => !!document.getElementById('feed') && document.querySelector('.tabs button.active')?.dataset.tab === 'shortages');
        if (!ok) findings.push(`Design v2 ${w}px: Reiter-Klick von der Meldungen-Seite baut die Ansicht nicht auf`);
      }
      await page.click('#btnNotif'); await page.waitForTimeout(600);
      await page.click('#logoHome'); await page.waitForTimeout(1200);
      if (!(await page.evaluate(() => !!document.getElementById('feed')))) findings.push(`Design v2 ${w}px: Logo führt von der Meldungen-Seite nicht zurück`);
      for (const f of fehler) findings.push(`Design v2 ${w}px: JS-Fehler ${f}`);
      await ctx.close();
    }
    // Ausgeloggt: keine Knöpfe, die eine Anmeldung brauchen.
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => { localStorage.setItem('apo_country', 'AT'); });
      await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
      for (const id of ['btnNotif', 'btnLogout', 'btnHelp']) {
        if (await page.locator('#' + id).isVisible().catch(() => false)) findings.push(`Design v2: „${id}" sichtbar, obwohl niemand angemeldet ist`);
      }
      if (await page.locator('.tabs').count()) findings.push('Design v2: Navigation steht auf der Anmeldeseite');
      await ctx.close();
    }
    console.log('✓ Design v2: Leiste unten (Handy) / links + rechte Spalte (Desktop), Menü und „Mehr" bedienbar, keine Emojis in der Navigation');
  }

  // ── Ruhende Bereiche haben keine Bedienelemente ───────────────────────────
  //  Nach dem Audit vom 06.09.2026 ruhen mehrere Bereiche (src/data/features.js).
  //  Ein Reiter, der beim Klick 404 liefert, ist schlimmer als kein Reiter: Er
  //  sieht aus wie ein Fehler der Plattform, und die Nutzerin sucht den Fehler
  //  bei sich. Diese Prüfung fährt bewusst in der VOREINSTELLUNG — sie prüft,
  //  was tatsächlich ausgeliefert wird, nicht was der Code könnte.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    const zustand = await page.evaluate(() => fetch('/api/features').then((r) => r.json()));
    const ruht = new Set((zustand.features || []).filter((f) => f.zustand === 'ruht').map((f) => f.id));

    const erwartet = [
      ['tauschboerse', '.tabs button[data-tab="exchange"]', 'Reiter „Biete/Suche"'],
      ['direktnachrichten', '#btnDm', 'Nachrichten-Knopf'],
      ['bestellung', '#btnCart', 'Warenkorb-Knopf'],
      // Startseite: Bereichs-Liste und Rechner (bis Design v2 standen sie
      // dort auch bei ruhendem Bereich — Klick führte zu 404).
      ['social', '#ov_bm', 'Startseiten-Link „Lesezeichen"'],
      ['werbung', '#ov_promos', 'Startseiten-Link „Angebote"'],
      ['termine', '#ov_live', 'Startseiten-Link „Live"'],
      ['verzeichnis', '#ov_dir', 'Startseiten-Link „Verzeichnis"'],
      ['zusammenarbeit', '#ov_team', 'Startseiten-Link „Team"'],
      ['waehrungsrechner', '[data-cc-toggle]', 'Währungsrechner'],
    ];
    let geprueft = 0;
    for (const [id, sel, name] of erwartet) {
      if (!ruht.has(id)) continue;
      geprueft++;
      const da = await page.locator(sel).count();
      if (da > 0) findings.push(`${name} ist sichtbar, obwohl "${id}" ruht`);
    }
    // Warenkorb-Knöpfe in Preisen und Rabatten: „In die Einkaufsliste" rief bei
    // ruhender Bestellung /api/cart und lief in 404 — bis Design v2 gefunden.
    //  Die Prüfumgebung hat ohne Referenzdaten keine Rabatte — ohne Eintrag gäbe
    //  es keinen Knopf, und die Prüfung wäre grün, ohne etwas zu prüfen (so
    //  geschehen in der ersten Gegenprobe). Darum ein nachgebildeter Eintrag,
    //  und ohne gerenderte Karte gilt die Prüfung als nicht erbracht.
    if (ruht.has('bestellung')) {
      geprueft++;
      await page.route('**/api/rabatte?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rabatte: [{
        id: 'r1', rank: 1, bezeichnung: 'Pruefpraeparat 10 mg', wirkstoff: 'Pruefwirkstoff', supplier: 'Grosshandel A', rabatt_pct: 20,
        listenpreis: 10, aktionspreis: 8, ersparnis: 2, min_menge: 1, gueltig_bis: '2099-12-31', post_count: 0 }] }) }));
      for (const tab of ['overview', 'prices', 'rabatte']) {
        await reiterOeffnen(page, tab);
        await page.waitForTimeout(800);
        const n = await page.locator('#app [data-addcart], #app [data-actcart], #app [data-cart], #app [data-addall]').count();
        if (n) findings.push(`${n} Warenkorb-Knopf/Knöpfe auf „${tab}", obwohl "bestellung" ruht`);
      }
      if (await page.locator('#app [data-pp]').count() === 0) findings.push('Warenkorb-Prüfung leer: keine Rabatt-Karte gerendert — die Prüfung belegt nichts');
      await page.unroute('**/api/rabatte?*');
      await reiterOeffnen(page, 'overview');
      await page.waitForTimeout(700);
    }
    // Systematisch statt Einzelfall: JEDE Kachel und JEDER Schnellzugriff, der
    // auf einen ruhenden Reiter zeigt, ist ein Klick ins Leere. Die
    // Einzelabfragen oben fanden nur, was ich vorher gewusst habe — diese
    // Schleife findet auch, woran ich nicht gedacht habe. Genau so kamen die
    // Tauschboersen-Kacheln der Startuebersicht ans Licht.
    const RUHENDE_TABS = { exchange: 'tauschboerse', live: 'termine' };
    const zeiger = await page.$$eval('[data-go]', (els) => els.map((e) => e.dataset.go).filter(Boolean));
    for (const ziel of new Set(zeiger)) {
      const bereich = RUHENDE_TABS[ziel];
      if (bereich && ruht.has(bereich)) {
        findings.push(`Ein Bedienelement zeigt auf "${ziel}", obwohl "${bereich}" ruht`);
      }
    }

    // Gegenprobe: Der Kern MUSS bedienbar bleiben, sonst hat die Schaltung zu
    // viel entfernt und der Test bemerkte es nicht.
    for (const [sel, name] of [['.tabs button[data-tab="shortages"]', 'Engpässe'],
      ['.tabs button[data-tab="news"]', 'News']]) {
      if (await page.locator(sel).count() === 0) findings.push(`Reiter „${name}" fehlt — die Schaltung greift zu weit`);
    }
    if (!geprueft) findings.push('Kein ruhender Bereich prüfbar — läuft dieser Audit versehentlich mit allen Bereichen an?');
    else console.log(`✓ Ruhende Bereiche zeigen keine Bedienelemente (${geprueft} geprüft), Kern-Reiter vorhanden`);
    await ctx.close();
  }

  // ── Leere Ansichten erklären sich ─────────────────────────────────────────
  //  Eine leere Liste ohne Erklärung ist das teuerste Signal der Plattform:
  //  Sie sieht aus wie ein Defekt, und die Nutzerin sucht den Fehler bei sich.
  //  In dieser Prüfumgebung ist noch kein Abruf gelaufen — die Ansicht muss
  //  also sagen „der erste Abruf läuft gerade" und nicht schweigen.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Auf ein Land umschalten, fuer das nachweislich nichts vorliegt. Vorher
    // hing die Pruefung davon ab, dass zufaellig eine Ansicht leer ist — und
    // in der Pruefumgebung sind Engpaesse und News gefuellt. Sie lief damit
    // ins Leere und belegte nichts. Kenia hat eine eingetragene Quelle, aber
    // keine Referenzdaten: genau der Fall, um den es geht.
    await page.selectOption('#countrySwitch', 'KE').catch(() => {});
    await page.waitForTimeout(600);

    let geprueft = 0;
    // Je Ansicht der Container, der die Liste WIRKLICH traegt. Beide ueber
    // #feed zu lesen sah in der Gegenprobe so aus, als pruefe die
    // Engpass-Ansicht — tatsaechlich las sie zweimal den News-Text. Eine
    // Pruefung, die zweimal dasselbe misst und zwei Haken meldet, ist
    // schlimmer als eine, die es gar nicht erst versucht.
    // Ueber data-tab statt ueber den Beschriftungstext: Kenia laeuft auf
    // Englisch, und „📦 Engpaesse" gibt es dort nicht. Der News-Reiter traf
    // vorher nur zufaellig, weil „News" in beiden Sprachen gleich heisst —
    // die Engpass-Pruefung lief still ins Leere und meldete trotzdem nichts.
    for (const [tab, name, sel] of [
      ['news', 'News', '#newslist'],
      ['shortages', 'Engpässe', '[data-shortlist]'],
    ]) {
      await reiterOeffnen(page, tab);
      await page.waitForTimeout(900);
      const text = await page.locator(sel).innerText().catch(() => '');
      if (!text) { findings.push(`${name}: Ansicht nicht lesbar (${sel} fehlt) — die Pruefung belegt hier nichts`); continue; }
      // Nur prüfen, wenn die Ansicht tatsächlich leer ist — mit Inhalt gibt es
      // nichts zu erklären, und eine Karte wäre dort sogar falsch.
      // Kenia laeuft auf Englisch — beide Sprachfassungen pruefen.
      if (!/Keine Engpässe|Keine News|Noch keine News|No shortages|No news/i.test(text)) {
        // Nicht stillschweigend ueberspringen: Eine Ansicht, die hier Inhalt
        // zeigt, obwohl fuer das Land keine Quelle liefert, ist selbst ein
        // Befund — dann stammen die Zeilen aus laenderunabhaengigen
        // Referenzdaten. Sichtbar machen, nicht verschlucken.
        console.log(`  · ${name}: nicht leer (${text.trim().slice(0, 60).replace(/\s+/g, ' ')}…) — hier nichts zu erklaeren`);
        continue;
      }
      geprueft++;
      if (!/erste Abruf|Behördendaten|amtliche Quelle|first fetch|official data|official source/i.test(text)) {
        findings.push(`${name}: leere Ansicht ohne Erklärung — genau das Signal, das wie ein Defekt aussieht. `
          + `Gesehen: "${text.slice(0, 120).replace(/\s+/g, ' ')}"`);
      } else {
        console.log(`✓ ${name}: leere Ansicht erklärt sich`);
      }
    }
    // Eine Prüfung, die still nichts tut, ist schlimmer als keine: Sie sieht im
    // Protokoll aus wie ein bestandener Test. Findet sich keine leere Ansicht,
    // muss das auffallen — dann stimmt die Annahme dieser Prüfung nicht mehr.
    if (!geprueft) findings.push('Keine leere Ansicht gefunden — diese Prüfung lief ins Leere und belegt nichts');
    await ctx.close();
  }

  // ── Signal-Karte: zeigt sie, was sie zeigen soll? ─────────────────────────
  //  Diese Ansicht lebt von sechs Angaben je Zeile (Titel, Zusammenfassung,
  //  Wirkstoff, Handelsname, Herkunft mit Link, Schweregrad und Vertrauenswert).
  //  Ob der Code sie ZUSAMMENSETZT, sagt kein Unit-Test — das sieht man erst
  //  auf der Seite. In der Pruefumgebung ist noch kein Abruf gelaufen und
  //  keine KI konfiguriert, es gibt also kein echtes Signal; deshalb wird die
  //  Antwort des Servers hier ABGEFANGEN und ein gebautes Signal eingespeist.
  //
  //  Das prueft genau das, was zu pruefen ist: die Darstellung. Die Herkunft
  //  selbst ist serverseitig Pflichtfeld und hat eigene Tests.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    const SIGNAL = {
      dedupeKey: 'bfarm_news:https://www.bfarm.de/pruef/1',
      // Der Titel nennt WEDER den Wirkstoff NOCH das Wort „Lieferengpass".
      //
      // Das ist der Kern dieser Vorgabe, und er stammt aus einer Gegenprobe:
      // Mit dem ersten Titel („Lieferengpass Amoxicillin 1000 mg") waren zwei
      // Pruefpunkte VAKUANT. Ich habe die Wirkstoff-Zeile aus der Karte
      // entfernt — und der Audit blieb gruen, weil /amoxicillin/i im Titel
      // traf. Dasselbe fuer die Kategorie. Zwei Haken, die nichts belegten.
      //
      // Jeder Wert unten kommt deshalb GENAU EINMAL auf der Karte vor, aus
      // genau einem Feld. Wer hier etwas „realistischer" formuliert, macht die
      // Pruefung wieder wertlos.
      title: 'Versorgungshinweis zur PRUEF-Charge 42',
      summary: 'Kurzfassung der Behoerde.',
      summaryDe: 'Der Hersteller meldet eine Unterbrechung der Belieferung bis auf Weiteres.',
      originalUrl: 'https://www.bfarm.de/pruef/1',
      sourceName: 'BfArM', sourceId: 'bfarm_news',
      country: 'DE', language: 'de', category: 'SHORTAGE',
      wirkstoff: 'pruefomycin', handelsname: 'Amoxi-PRUEF',
      schweregrad: 'kritisch', ursache: 'Produktionsausfall-PRUEF',
      gueltigVon: '2026-10-01', gueltigBis: '2026-11-15',
      confidenceScore: 0.82,
      verifiedAt: new Date().toISOString(), publishedAt: null,
    };
    await page.route('**/api/signals*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ signale: [SIGNAL], stand: { land: 'DE', signale: 1, letzte: SIGNAL.verifiedAt }, ki: 'aktiv' }),
    }));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'signals');
    await page.waitForTimeout(900);

    const text = await page.locator('[data-siglist]').innerText().catch(() => '');
    if (!text) {
      findings.push('Live-Warnungen: Liste nicht lesbar ([data-siglist] fehlt) — diese Pruefung belegt nichts');
    } else {
      // Jede Angabe einzeln. Ein gesammeltes „enthaelt irgendwas" waere die
      // vakuante Variante: Sie wuerde auch gruen bleiben, wenn nur der Titel
      // ankommt und alles andere fehlt.
      for (const [was, muster] of [
        ['Titel', /PRUEF-Charge 42/],
        ['KI-Zusammenfassung', /Unterbrechung der Belieferung/],
        ['Wirkstoff', /pruefomycin/i],
        ['Handelsname', /Amoxi-PRUEF/],
        ['Grund', /Produktionsausfall-PRUEF/],
        ['Zeitraum', /2026/],
        ['Schweregrad', /kritisch/i],
        ['Kategorie in Klartext', /Lieferengpass/i],
        ['Land', /Deutschland|Germany|Alemanha/i],
        ['Vertrauenswert', /82\s*%/],
        ['Quellenname', /BfArM/],
      ]) {
        if (!muster.test(text)) findings.push(`Live-Warnungen: ${was} fehlt auf der Karte`);
      }
      // Der Herkunfts-Link ist der Kern: eine Behoerdenmeldung ohne
      // Rueckverweis ist ein Geruecht mit Amtsanstrich. rel="noopener" ist
      // Pflicht, nicht Kosmetik.
      const link = page.locator('[data-siglist] a[href="https://www.bfarm.de/pruef/1"]');
      if (await link.count() === 0) {
        findings.push('Live-Warnungen: kein Direktlink zur behoerdlichen Originalquelle');
      } else {
        const rel = (await link.first().getAttribute('rel')) || '';
        const ziel = (await link.first().getAttribute('target')) || '';
        if (!/noopener/.test(rel)) findings.push(`Herkunfts-Link ohne rel="noopener" (rel="${rel}")`);
        if (ziel !== '_blank') findings.push(`Herkunfts-Link oeffnet nicht in neuem Tab (target="${ziel}")`);
      }
      // Laenderfilter: Das Land MUSS in der Abfrage stehen, sonst zeigt die
      // Ansicht beim Laenderwechsel weiter dieselben Zeilen.
      const abfragen = [];
      await page.route('**/api/signals*', (route) => { abfragen.push(route.request().url()); return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ signale: [], stand: { land: 'KE', signale: 0, letzte: null }, ki: 'aktiv' }),
      }); });
      await page.selectOption('#countrySwitch', 'KE').catch(() => {});
      await page.waitForTimeout(400);
      await reiterOeffnen(page, 'signals');
      await page.waitForTimeout(800);
      if (!abfragen.length) findings.push('Live-Warnungen: nach dem Laenderwechsel wurde nichts neu abgefragt');
      else if (!abfragen.some((u) => /country=KE/.test(u))) {
        findings.push(`Live-Warnungen: Laenderfilter kommt nicht in der Abfrage an (${abfragen[0]})`);
      } else {
        console.log('✓ Live-Warnungen: Karte vollstaendig, Herkunfts-Link gesetzt, Laenderfilter greift');
      }
    }
    if (errors.length) findings.push(`Live-Warnungen: JS-Fehler — ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // ── Uebersetzen-Knopf: tut er, was er soll — und laesst er die Herkunft? ──
  //  Der Knopf ist die einzige Stelle, an der ein Behoerdentext im Frontend
  //  ERSETZT wird. Drei Dinge muessen dabei stimmen, und keines davon sagt ein
  //  Unit-Test:
  //
  //   1. Ohne KI-Schluessel erscheint KEIN Knopf. In dieser Pruefumgebung ist
  //      keiner gesetzt — der Knopf darf also nicht da sein. Ein Knopf, der
  //      mit einer Fehlermeldung endet, ist schlechter als keiner.
  //   2. Mit Schluessel ersetzt er den TEXT und nichts sonst: Quellenname und
  //      Herkunfts-Link bleiben unveraendert stehen.
  //   3. Das Original bleibt erreichbar. Bei einer Engpassmeldung will man im
  //      Zweifel selbst nachlesen.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    const SIGNAL = {
      dedupeKey: 'bfarm_news:https://www.bfarm.de/tr/1',
      title: 'Versorgungshinweis zur TRPRUEF-Charge',
      summary: 'ORIGINALTEXT-TRPRUEF',
      summaryDe: 'ORIGINALTEXT-TRPRUEF',
      originalUrl: 'https://www.bfarm.de/tr/1', sourceName: 'BfArM', sourceId: 'bfarm_news',
      country: 'DE', language: 'en', category: 'NEWS',
      wirkstoff: null, handelsname: null, schweregrad: null, ursache: null,
      gueltigVon: null, gueltigBis: null, confidenceScore: 0,
      verifiedAt: new Date().toISOString(), publishedAt: null,
    };
    await page.route('**/api/signals*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ signale: [SIGNAL], stand: { land: 'DE', signale: 1, letzte: SIGNAL.verifiedAt }, ki: 'aktiv' }),
    }));

    // ── 1. Ohne Schluessel: kein Knopf ──
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'signals');
    await page.waitForTimeout(800);
    const ohne = await page.locator('[data-siglist] [data-translate]').count();
    if (ohne !== 0) {
      findings.push(`Uebersetzen-Knopf erscheint OHNE KI-Schluessel (${ohne}×) — er wuerde nur eine Fehlermeldung erzeugen`);
    } else {
      console.log('✓ Uebersetzen: ohne KI-Schluessel kein Knopf');
    }
    await ctx.close();

    // ── 2./3. Mit abgefangenem Status + abgefangener Uebersetzung ──
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page2 = await ctx2.newPage();
    page2.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    const anfragen = [];
    await page2.route('**/api/translate/status', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ available: true, languages: ['de', 'en', 'pt'], max_chars: 4000 }),
    }));
    await page2.route('**/api/translate', (route) => {
      anfragen.push(route.request().postData() || '');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ text: 'UEBERSETZT-TRPRUEF', cached: false, ziel: 'de' }),
      });
    });
    await page2.route('**/api/signals*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ signale: [SIGNAL], stand: { land: 'DE', signale: 1, letzte: SIGNAL.verifiedAt }, ki: 'aktiv' }),
    }));
    await page2.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page2.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page2, 'signals');
    await page2.waitForTimeout(800);

    const knopf = page2.locator('[data-siglist] [data-translate]').first();
    if (await knopf.count() === 0) {
      findings.push('Uebersetzen-Knopf fehlt, obwohl die KI als verfuegbar gemeldet wird');
    } else {
      await knopf.click();
      await page2.waitForTimeout(500);
      const text = await page2.locator('[data-siglist]').innerText();
      if (!/UEBERSETZT-TRPRUEF/.test(text)) findings.push('Uebersetzen: die Uebersetzung erscheint nicht auf der Karte');
      if (/ORIGINALTEXT-TRPRUEF/.test(text)) findings.push('Uebersetzen: der Originaltext steht noch da — der Knopf hat nichts ersetzt');

      // DIE ZUSICHERUNG, auf die es ankommt: Quellenname und Link unangetastet.
      if (!/BfArM/.test(text)) findings.push('Uebersetzen: der Quellenname ist verschwunden');
      const link = page2.locator('[data-siglist] a[href="https://www.bfarm.de/tr/1"]');
      if (await link.count() === 0) findings.push('Uebersetzen: der Herkunfts-Link ist verschwunden');

      // Und es darf NUR Text hinausgegangen sein — keine Adresse, keine Quelle.
      const gesendet = anfragen.join(' ');
      if (!gesendet) findings.push('Uebersetzen: keine Anfrage gesehen — diese Pruefung belegt nichts');
      if (/bfarm\.de/i.test(gesendet)) findings.push(`Uebersetzen: die Herkunfts-Adresse wurde mitgeschickt (${gesendet.slice(0, 120)})`);
      if (/sourceName|BfArM/.test(gesendet)) findings.push('Uebersetzen: der Quellenname wurde mitgeschickt');

      // Zurueckschalten muss das Original wiederbringen.
      await knopf.click();
      await page2.waitForTimeout(300);
      const zurueck = await page2.locator('[data-siglist]').innerText();
      if (!/ORIGINALTEXT-TRPRUEF/.test(zurueck)) {
        findings.push('Uebersetzen: das Original ist nach dem Zurueckschalten nicht wieder da');
      } else {
        console.log('✓ Uebersetzen: ersetzt nur den Text, Herkunft bleibt, Original erreichbar');
      }
    }
    if (errors.length) findings.push(`Uebersetzen: JS-Fehler — ${errors.slice(0, 2).join(' | ')}`);
    await ctx2.close();
  }

  // ── Säule 3: Ausweich-Suche, Logistik, Sicherheitsmeldungen ──────────────
  //  Drei Ansichten, drei Zusicherungen, die kein Unit-Test sagt:
  //
  //   1. AUSWEICH-SUCHE: Der einschraenkende Hinweis („keine Aussage ueber
  //      Austauschbarkeit") muss VOR der Liste stehen, nicht als Fussnote.
  //      Wer die Liste liest, muss die Einordnung schon gelesen haben.
  //   2. LOGISTIK: „gesperrt" darf nicht wie „leer" aussehen.
  //   3. SICHERHEITSMELDUNGEN: Der Knopf muss den anderen Endpunkt abfragen.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    // Ausnahme, genau eine Meldung: Playwright setzt die Service-Worker-Sperre
    // (serviceWorkers: 'block') als Startskript in JEDEN Frame — auch in die
    // rechtlose Wochenbericht-Vorschau (sandbox=""), wo schon der Zugriff auf
    // navigator.serviceWorker wirft. Die App läuft dort nicht (keine Skripte im
    // sandbox-Frame); ihre eigenen Zugriffe sind über swVerfuegbar() abgesichert.
    page.on('pageerror', (e) => { if (!/Service worker is disabled because the context is sandboxed/.test(e.message)) errors.push('pageerror: ' + e.message); });

    const HINWEIS = 'Gleicher Wirkstoff laut RxNorm (US-Vokabular der National Library of Medicine). '
      + 'Das ist KEINE Aussage über Austauschbarkeit: Sie hängt an Darreichungsform, Stärke, Hilfsstoffen und '
      + 'nationaler Zulassung und ist hier nicht geprüft. Die Abgabeentscheidung bleibt bei der Apotheke.';
    await page.route('**/api/alternativen*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        available: true, begriff: 'Amoxicillin', rxcui: '723',
        wirkstoffe: [{ name: 'AWPRUEF-WIRKSTOFF', tty: 'IN', rxcui: '723', quelle: 'https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=723' }],
        praeparate: [{ name: 'AWPRUEF-PRAEPARAT', tty: 'SBD', rxcui: '9', quelle: 'https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=9' }],
        grund: null, hinweis: HINWEIS, eigene_engpaesse: [],
      }),
    }));
    // try: Das Startskript läuft in JEDEM Frame — auch in der rechtlosen
    // Wochenbericht-Vorschau (sandbox=""), in der localStorage gesperrt ist.
    // Dort darf es scheitern; das ist die Abschottung, kein Fehler der App.
    await page.addInitScript((t) => { try { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); } catch { /* rechtloser Frame */ } }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // ── 1. Ausweich-Suche auf der Wirkstoff-Seite ──
    await page.evaluate(() => window.openWirkstoff && window.openWirkstoff('Amoxicillin'));
    await page.waitForTimeout(900);
    const awKnopf = page.locator('[data-open]:has-text("Ausweichpräparate")').first();
    if (await awKnopf.count() === 0) {
      findings.push('Ausweich-Suche: Karte fehlt auf der Wirkstoff-Seite');
    } else {
      // Eingeklappt: NOCH KEINE Abfrage. Ein Netzaufruf, den niemand
      // angefordert hat, belastet eine fremde Schnittstelle.
      const vorKlick = await page.locator('[data-awbody]').innerText().catch(() => '');
      if (/AWPRUEF/.test(vorKlick)) findings.push('Ausweich-Suche: fragt RxNav schon vor dem Aufklappen ab');

      await awKnopf.click();
      await page.waitForTimeout(600);
      const text = await page.locator('[data-awbody]').innerText().catch(() => '');
      if (!/KEINE Aussage über Austauschbarkeit/.test(text)) {
        findings.push('Ausweich-Suche: der einschraenkende Hinweis fehlt');
      }
      if (!/AWPRUEF-WIRKSTOFF/.test(text)) findings.push('Ausweich-Suche: der Wirkstoff fehlt');
      if (!/AWPRUEF-PRAEPARAT/.test(text)) findings.push('Ausweich-Suche: die Praeparate fehlen');
      // Der Hinweis muss VOR der Liste stehen.
      if (text.indexOf('Austauschbarkeit') > text.indexOf('AWPRUEF-PRAEPARAT')) {
        findings.push('Ausweich-Suche: der Hinweis steht NACH der Liste — wer die Liste liest, hat die Einordnung dann nicht gelesen');
      } else {
        console.log('✓ Ausweich-Suche: Hinweis vor der Liste, Wirkstoff und Praeparate da, keine Abfrage vor dem Klick');
      }
    }

    // ── 2. Logistik: gesperrt ist nicht leer ──
    await page.route('**/api/logistik*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ meldungen: [], erlaubt: false, grund: 'unverifiziert' }),
    }));
    await page.evaluate(() => window.openLogistik && window.openLogistik());
    await page.waitForTimeout(700);
    const lgText = await page.locator('#app').innerText().catch(() => '');
    // Auf die SPERRKARTE pruefen, nicht auf das Wort „verifiziert" irgendwo im
    // Text: Der Untertitel der Seite („von verifizierten Betrieben gemeldet")
    // enthaelt es ohnehin, in EN/PT sogar wortgleich zur Sperrmeldung. Ein
    // Textfund haette die Pruefung also auch dann bestanden, wenn die
    // Sperrkarte fehlt — sie waere nur auf Deutsch zufaellig scharf gewesen.
    const lgSperre = await page.locator('[data-lglocked]').count();
    if (!lgSperre) {
      findings.push(`Logistik: „gesperrt" wird nicht benannt — sieht aus wie ein leerer Bereich (${lgText.slice(0, 120).replace(/\s+/g, ' ')})`);
    } else if (!/verifizierte Betriebe|Verified businesses|estabelecimentos verificados/i.test(lgText)) {
      findings.push('Logistik: Sperrkarte da, benennt aber die geforderte Stufe nicht');
    } else {
      console.log('✓ Logistik: gesperrt wird als gesperrt benannt, nicht als leer');
    }

    // ── 3. Sicherheitsmeldungen: eigener Endpunkt ──
    const sichAufrufe = [];
    await page.route('**/api/sicherheitsmeldungen*', (route) => {
      sichAufrufe.push(route.request().url());
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          signale: [{
            dedupeKey: 'bfarm:1', title: 'SICHPRUEF Rueckruf', summary: null, summaryDe: null,
            originalUrl: 'https://www.bfarm.de/s/1', sourceName: 'BfArM', sourceId: 'bfarm_news',
            country: 'AT', language: 'de', category: 'RECALL', wirkstoff: null, handelsname: null,
            schweregrad: 'kritisch', ursache: null, gueltigVon: null, gueltigBis: null,
            confidenceScore: 0, verifiedAt: new Date().toISOString(), publishedAt: null,
          }],
          stand: { land: 'AT', signale: 1, letzte: new Date().toISOString() },
          ki: 'aktiv', kategorien: ['RECALL', 'REGULATORY'],
        }),
      });
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'signals');
    await page.waitForTimeout(700);
    const sichKnopf = page.locator('[data-sigkat] button:has-text("Sicherheitsmeldungen")').first();
    if (await sichKnopf.count() === 0) {
      findings.push('Sicherheitsmeldungen: Knopf fehlt in der Kategorie-Leiste');
    } else {
      await sichKnopf.click();
      await page.waitForTimeout(700);
      if (!sichAufrufe.length) {
        findings.push('Sicherheitsmeldungen: der eigene Endpunkt wurde nicht abgefragt — der Knopf filtert nur lokal');
      } else if (!/SICHPRUEF/.test(await page.locator('[data-siglist]').innerText().catch(() => ''))) {
        findings.push('Sicherheitsmeldungen: die Meldung erscheint nicht');
      } else {
        console.log('✓ Sicherheitsmeldungen: eigener Endpunkt, Meldung erscheint');
      }
    }
    // ── 4. Tauschbörse: „passende anzeigen" sucht mit dem Server-Schlüssel ──
    //  Vorher riet das Frontend den Suchbegriff selbst (erstes Wort, nur
    //  deutsches Muster, ohne Formwort-Filter) — hier wäre das „lösung"
    //  gewesen, und die Liste hätte jede Lösung gezeigt statt der zwei
    //  gezählten Gegenstücke. Geprüft wird die TATSÄCHLICHE Anfrage.
    //  Die Tauschbörse RUHT in der Voreinstellung (src/data/features.js) —
    //  ohne Reiter gäbe es nichts zu prüfen. Für DIESE Seite wird sie in der
    //  echten /api/features-Antwort eingeschaltet; die Börse selbst ist unten
    //  ohnehin nachgebildet, der Server bleibt unverändert.
    await page.route('**/api/features', async (route) => {
      const echt = await (await route.fetch()).json();
      for (const f of (echt.features || [])) if (f.id === 'tauschboerse') f.zustand = 'aktiv';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(echt) });
    });
    const exAufrufe = [];
    await page.route('**/api/exchange?*', (route) => {
      const url = new URL(route.request().url());
      exAufrufe.push(url.searchParams.get('q'));
      const gefiltert = url.searchParams.has('q');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          entries: gefiltert ? [] : [{
            id: 'kp1', kind: 'suche', status: 'offen', reserved: false, rx: false, country: 'AT',
            bezeichnung: 'Lösung zum Einnehmen Keypruefwort', created_at: new Date().toISOString(),
            author: { handle: 'jemand', display_name: 'Jemand', verified: true },
            match_count: 2, match_key: 'Keypruefwort', days_until_expiry: null,
          }],
          rx_hidden: 0, rx_reason: null,
        }),
      });
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'exchange');
    await page.waitForTimeout(700);
    const passendKnopf = page.locator('[data-match]').first();
    if (await passendKnopf.count() === 0) {
      findings.push('Tauschbörse: „passende anzeigen" fehlt trotz match_count 2');
    } else {
      await passendKnopf.click();
      await page.waitForTimeout(700);
      const q = exAufrufe.filter(Boolean).pop();
      if (q !== 'Keypruefwort') {
        findings.push(`Tauschbörse: „passende anzeigen" sucht nach „${q}" statt nach dem Server-Schlüssel „Keypruefwort"`);
      } else {
        console.log('✓ Tauschbörse: „passende anzeigen" sucht mit dem Schlüssel des Servers, nicht mit einem geratenen Wort');
      }
    }

    // ── 5. Länder-Umschalter: die Startseite folgt ──────────────────────────
    //  Die Listen-Reiter folgten dem Umschalter, die Startseite nicht: Sie
    //  fragte ohne Land ab und zeigte nach „Portugal" weiter österreichische
    //  Engpässe als kritisch. Geprüft wird die tatsächliche Anfrage.
    const ovLaender = [];
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.pathname === '/api/overview') ovLaender.push(u.searchParams.get('country'));
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'overview');
    await page.waitForTimeout(500);
    await page.selectOption('#countrySwitch', 'PT').catch(() => {});
    await page.waitForTimeout(900);
    if (!ovLaender.length) {
      findings.push('Länder-Umschalter: die Startseite wurde gar nicht abgefragt — Prüfung nicht aussagekräftig');
    } else if (ovLaender[ovLaender.length - 1] !== 'PT') {
      findings.push(`Länder-Umschalter: Startseite fragt nach dem Wechsel auf Portugal mit country=${ovLaender[ovLaender.length - 1]} ab`);
    } else {
      console.log('✓ Länder-Umschalter: die Startseite fragt nach dem Wechsel das gewählte Land ab');
    }

    // ── 6. Lagebild + Presse im News-Reiter ─────────────────────────────────
    //  Zusicherungen: Hinweis VOR den Punkten; jeder Punkt mit Quellen-Links
    //  samt Herkunft; ein `javascript:`-Link aus einer Quelle wird NIE
    //  klickbar; Presse ist als Presse gekennzeichnet; ohne KI keine Karte.
    let lbAntwort = {
      land: 'NG', sprache: 'de', verfuegbar: true, grund: null, quellen_gesamt: 3,
      hinweis: 'KI-Zusammenfassung der verlinkten Meldungen. LBHINWEIS',
      punkte: [{ text: 'LBPUNKT Naira-Verfall verteuert Importe.', quellen: [
        { nr: 1, herkunft: 'behoerde', titel: 'NAFDAC', url: 'https://nafdac.gov.ng/1', quelle: 'NAFDAC' },
        { nr: 2, herkunft: 'presse', titel: 'Punch', url: 'javascript:alert(1)', quelle: 'punchng.com' },
      ] }],
    };
    await page.route('**/api/lagebild*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lbAntwort) }));
    await page.route('**/api/presse*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ land: 'NG', quelle: 'GDELT', grund: null, artikel: [
        { herkunft: 'presse', titel: 'PRARTIKEL Drug prices soar', url: 'https://punchng.com/x', quelle: 'punchng.com', datum: '2026-10-10T00:00:00.000Z' },
      ] }),
    }));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'news');
    await page.waitForTimeout(900);
    const lbKarte = page.locator('[data-lagebild]').first();
    if (await lbKarte.count() === 0) {
      findings.push('Lagebild: Karte fehlt im News-Reiter');
    } else {
      const lbText = await lbKarte.innerText();
      const hrefs = await lbKarte.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      if (lbText.indexOf('LBHINWEIS') === -1 || lbText.indexOf('LBHINWEIS') > lbText.indexOf('LBPUNKT')) {
        findings.push('Lagebild: der Hinweis steht nicht VOR den Punkten');
      } else if (!hrefs.includes('https://nafdac.gov.ng/1')) {
        findings.push('Lagebild: der Punkt verlinkt seine Quelle nicht');
      } else if (hrefs.some((h) => /^javascript:/i.test(String(h)))) {
        findings.push('Lagebild: ein javascript:-Link aus einer Quelle ist klickbar');
      } else if (!/Behörde/.test(lbText)) {
        findings.push('Lagebild: die Herkunft der Quelle (Behörde/Presse) steht nicht dran');
      } else {
        console.log('✓ Lagebild: Hinweis vor den Punkten, Quellen verlinkt mit Herkunft, kein javascript:-Link');
      }
    }
    const prText = await page.locator('[data-presse]').first().innerText().catch(() => '');
    if (!/PRARTIKEL/.test(prText) || !/keine Behördenmeldungen/.test(prText)) {
      findings.push('Presse: Artikel fehlt oder ist nicht als Presse (keine Behördenmeldung) gekennzeichnet');
    } else {
      console.log('✓ Presse: Artikel aus dem Land, als Presse gekennzeichnet');
    }
    lbAntwort = { land: 'NG', verfuegbar: false, grund: 'ki_aus', punkte: [], quellen_gesamt: 0 };
    await reiterOeffnen(page, 'overview');
    await reiterOeffnen(page, 'news');
    await page.waitForTimeout(800);
    if (await page.locator('[data-lagebild]').count() > 0) {
      findings.push('Lagebild: ohne KI-Schlüssel erscheint trotzdem eine Karte');
    } else {
      console.log('✓ Lagebild: ohne KI keine Karte');
    }

    // ── 7. Krypto-Prüfung: Moderations-Karte + Prüfstand der Kundin ─────────
    //  Vorher gab es keine Prüfliste in der App: Die Kundin meldete ihre
    //  Transaktion, und niemand sah sie. Zusicherungen: Prüfanleitung VOR dem
    //  Bestätigen-Knopf; Explorer-Link nur aus geprüfter ID; Ablehnen ohne Grund
    //  schickt nichts ab; die Premium-Seite sagt „wird geprüft".
    const kpAntwort = { payments: [
      { id: 'kp1', status: 'pending_review', coin: 'bitcoin', amount_cents: 999, currency: 'EUR', product_name: 'ApoPulse Premium (Monat)',
        network: 'Bitcoin (Mainnet)', address: 'bc1qtest', provider_ref: 'a'.repeat(64), expected_crypto: 0.0002,
        created_at: new Date().toISOString(), claimed_at: new Date().toISOString(), tx_format_ok: true,
        explorer_url: 'https://mempool.space/tx/' + 'a'.repeat(64), kunde: { handle: 'apo_lagos', display_name: 'KPKUNDIN Lagos', country: 'NG' } },
      { id: 'kp2', status: 'pending_review', coin: 'solana', amount_cents: 999, currency: 'EUR', product_name: 'ApoPulse Premium (Monat)',
        network: 'Solana (Mainnet)', address: 'Sol111', provider_ref: 'kaputt', expected_crypto: null,
        created_at: new Date().toISOString(), claimed_at: new Date().toISOString(), tx_format_ok: false,
        explorer_url: 'javascript:alert(1)', kunde: { handle: 'apo_x', display_name: 'X', country: 'KE' } },
    ] };
    const kpAblehnungen = [];
    await page.route('**/api/payments/pending', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kpAntwort) }));
    await page.route('**/api/reports', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reports: [] }) }));
    await page.route('**/api/verify/requests', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requests: [] }) }));
    await page.route('**/api/payments/*/reject', (route) => { kpAblehnungen.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.showModeration && window.showModeration());
    await page.waitForTimeout(800);
    const kp1 = page.locator('[data-kp="kp1"]');
    if (await kp1.count() === 0) {
      findings.push('Krypto-Prüfung: Karte fehlt in der Moderation');
    } else {
      const reihenfolge = await kp1.evaluate((k) => {
        const h = k.querySelector('[data-kphint]'), b = k.querySelector('[data-kpok]');
        return !!(h && b && (h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      });
      const href = await kp1.locator('[data-kpexplorer]').getAttribute('href').catch(() => null);
      const kp2Links = await page.locator('[data-kp="kp2"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      const kp2Text = await page.locator('[data-kp="kp2"]').innerText();
      await kp1.locator('[data-kpno]').click();
      await kp1.locator('[data-kpsend]').click();
      await page.waitForTimeout(300);
      const ohneGrund = kpAblehnungen.length;
      // Nur weiter, wenn ohne Grund NICHTS abging. Sonst hat die Liste schon
      // neu gezeichnet, das Eingabefeld ist weg — und der nächste Schritt liefe
      // in eine Zeitüberschreitung statt in den eigentlichen Befund.
      if (ohneGrund === 0) {
        await kp1.locator('[data-kpgrundin]').fill('KPGRUND Betrag zu niedrig');
        await kp1.locator('[data-kpsend]').click();
        await page.waitForTimeout(500);
      }
      if (!reihenfolge) findings.push('Krypto-Prüfung: die Prüfanleitung steht nicht VOR dem Bestätigen-Knopf');
      else if (href !== 'https://mempool.space/tx/' + 'a'.repeat(64)) findings.push(`Krypto-Prüfung: Explorer-Link fehlt oder falsch (${href})`);
      else if (kp2Links.some((h) => /^javascript:/i.test(String(h)))) findings.push('Krypto-Prüfung: ein javascript:-Link ist klickbar');
      else if (!/Format/.test(kp2Text)) findings.push('Krypto-Prüfung: eine ID im falschen Format wird nicht als verdächtig benannt');
      else if (ohneGrund !== 0) findings.push('Krypto-Prüfung: Ablehnen ohne Grund wurde abgeschickt');
      else if (!kpAblehnungen.some((b) => /KPGRUND/.test(String(b)))) findings.push('Krypto-Prüfung: der Ablehnungsgrund kommt nicht beim Server an');
      else console.log('✓ Krypto-Prüfung: Anleitung vor dem Knopf, Explorer-Link nur aus geprüfter ID, Ablehnen nur mit Grund');
    }
    await page.route('**/api/payments/mine', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ payments: [{ id: 'kp9', method: 'crypto_direct', status: 'pending_review', created_at: new Date().toISOString(), claimed_at: new Date().toISOString() }] }) }));
    await page.evaluate(() => window.openPremium && window.openPremium());
    await page.waitForTimeout(900);
    if (await page.locator('[data-prstand="review"]').count() === 0) {
      findings.push('Premium-Seite: eine gemeldete Zahlung wird nicht als „wird geprüft" angezeigt — Kundin könnte doppelt zahlen');
    } else {
      console.log('✓ Premium-Seite: gemeldete Zahlung erscheint als „wird geprüft — nicht erneut zahlen"');
    }

    // ── 8. Datenquellen-Seite (Redaktion) ──────────────────────────────────
    //  Zusicherungen: Fehlerhafte Quellen stehen ZUERST, ihr Fehlertext ist
    //  sichtbar, und der kopierte Bericht enthält ihn im Klartext.
    const jetztIso = new Date().toISOString();
    await page.route('**/api/live/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      jobs: [{ name: 'news', intervalMs: 300000, lastRunAt: jetztIso, lastOk: true }, { name: 'shortages', intervalMs: 14400000, lastRunAt: jetztIso, lastOk: true }],
      sources: [
        { id: 'basg_news', kind: 'news', country: 'AT', label: 'BASG News', url: 'https://www.basg.gv.at/rss' },
        { id: 'nafdac_news', kind: 'news', country: 'NG', label: 'NAFDAC News', url: 'https://nafdac.gov.ng/feed/' },
        { id: 'ppb_news', kind: 'news', country: 'KE', label: 'PPB Kenya', url: 'https://ppb.example/feed/' },
      ],
      coverage: { gemessen: {
        'news:AT': { ok: true, stand: jetztIso, quellen: [{ id: 'basg_news', ok: true, fehler: null, meldungen: 7 }] },
        'news:NG': { ok: false, stand: jetztIso, quellen: [{ id: 'nafdac_news', ok: false, fehler: 'DQFEHLER HTTP 404', meldungen: 0 }] },
      } },
      signals: { ki: 'aus' }, database: null,
    }) }));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__kopie = null;
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__kopie = t; } }, configurable: true }); } catch { /* bleibt beim Textfeld-Rückfall */ }
    });
    await page.evaluate(() => window.openDatenquellen && window.openDatenquellen());
    await page.waitForTimeout(800);
    const dqReihenfolge = await page.locator('[data-dqquelle]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dqquelle')));
    const dqText = await page.locator('#app').innerText().catch(() => '');
    await page.locator('[data-dqcopy]').click().catch(() => {});
    await page.waitForTimeout(300);
    const kopie = await page.evaluate(() => window.__kopie || (document.querySelector('textarea[readonly]') || {}).value || '');
    if (!dqReihenfolge.length) findings.push('Datenquellen: Seite zeigt keine Quellen');
    else if (dqReihenfolge[0] !== 'nafdac_news') findings.push(`Datenquellen: die fehlerhafte Quelle steht nicht zuerst (${dqReihenfolge.join(', ')})`);
    else if (!/DQFEHLER HTTP 404/.test(dqText)) findings.push('Datenquellen: der Fehlertext der Quelle ist nicht sichtbar');
    else if (!/✗ nafdac_news .*DQFEHLER HTTP 404/.test(kopie)) findings.push('Datenquellen: der kopierte Bericht enthält den Fehler nicht');
    else console.log('✓ Datenquellen: Fehler zuerst, mit Grund, und im kopierten Bericht als Klartext');

    // ── 8b. Quellen testen und eintragen ──────────────────────────────────
    //  „Jetzt testen" nur bei Engpass-Quellen; das Ergebnis zeigt erkannte
    //  Zeilen bzw. Gründe UND die gefundenen Spalten (sonst kann niemand eine
    //  abweichende Benennung zuordnen). „Entfernen" nur bei eigenen Quellen.
    await page.unroute('**/api/live/status').catch(() => {});
    await page.route('**/api/live/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      jobs: [], coverage: { gemessen: {} }, signals: { ki: 'aus' }, database: null,
      sources: [
        { id: 'bfarm_shortages', kind: 'shortages', country: 'DE', label: 'BfArM', url: 'https://anwendungen.pharmnet-bund.de/x' },
        { id: 'eigen_au_1', kind: 'shortages', country: 'AU', label: 'TGA', url: 'https://www.tga.gov.au/x.csv', eigen: true },
        { id: 'basg_news', kind: 'news', country: 'AT', label: 'BASG News', url: 'https://www.basg.gv.at/rss' },
      ],
    }) }));
    await page.route('**/api/quellen/probe', (route) => {
      const b = JSON.parse(route.request().postData() || '{}');
      const antwort = b.id
        ? { ok: true, id: b.id, ms: 812, zeilen: 2, verworfen: 0, gruende: [], spalten: ['PZN', 'Wirkstoffe'], beispiele: [{ wirkstoff: 'PRUEFWIRKSTOFF', bezeichnung: 'Pruef 500 mg', status: 'eingeschraenkt', gemeldet_am: '2026-09-01' }] }
        : { ok: false, id: 'entwurf', ms: 300, zeilen: 0, verworfen: 1, gruende: ['Zeile 2: Bezeichnung fehlt'], spalten: ['Active ingredients', 'Trade name'], beispiele: [] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) });
    });
    await page.evaluate(() => window.openDatenquellen && window.openDatenquellen());
    await page.waitForSelector('[data-dqprobe]', { timeout: 6000 }).catch(() => {});
    const probeKnoepfe = await page.locator('[data-dqprobe]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dqprobe')).sort());
    const wegKnoepfe = await page.locator('[data-dqweg]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dqweg')));
    await page.click('[data-dqprobe="bfarm_shortages"]').catch(() => {});
    await page.waitForSelector('[data-dqquelle="bfarm_shortages"] [data-dqprobeok]', { timeout: 6000 }).catch(() => {});
    const probeText = await page.locator('[data-dqquelle="bfarm_shortages"] [data-dqprobeerg]').innerText().catch(() => '');
    await page.fill('[data-dqneu] [data-dqurl]', 'https://www.tga.gov.au/export.csv').catch(() => {});
    await page.click('[data-dqneu] [data-dqtest]').catch(() => {});
    await page.waitForSelector('[data-dqneu] [data-dqprobeok]', { timeout: 6000 }).catch(() => {});
    const neuText = await page.locator('[data-dqneu] [data-dqneuerg]').innerText().catch(() => '');
    await page.unroute('**/api/quellen/probe').catch(() => {});
    await page.unroute('**/api/live/status').catch(() => {});
    if (JSON.stringify(probeKnoepfe) !== JSON.stringify(['bfarm_shortages', 'eigen_au_1'])) findings.push(`Quellen-Test: Knöpfe falsch verteilt (${probeKnoepfe.join(', ')})`);
    else if (JSON.stringify(wegKnoepfe) !== JSON.stringify(['eigen_au_1'])) findings.push(`Quellen-Test: „Entfernen" bei eingebauten Quellen (${wegKnoepfe.join(', ')})`);
    else if (!/2 Zeilen erkannt/.test(probeText) || !/PRUEFWIRKSTOFF/.test(probeText) || !/01\.09\.2026/.test(probeText)) findings.push(`Quellen-Test: Ergebnis unvollständig (${probeText})`);
    else if (!/Bezeichnung fehlt/.test(neuText) || !/Active ingredients \| Trade name/.test(neuText)) findings.push(`Quellen-Test: Entwurf ohne Gründe oder Spalten (${neuText})`);
    else console.log('✓ Quellen testen: nur Engpass-Quellen, Ergebnis mit Beispielen, Gründen und Spalten; Entfernen nur bei eigenen');

    // ── 9. Aktualitäts-Zeile: frisch und alt sehen verschieden aus ──────────
    const standFuer = async (antwort) => {
      await page.unroute('**/api/coverage/**').catch(() => {});
      await page.route('**/api/coverage/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) }));
      await page.goto(BASE, { waitUntil: 'networkidle' }); // neu laden: frischer Zwischenspeicher
      await reiterOeffnen(page, 'news');
      await page.waitForTimeout(900);
      const z = page.locator('[data-datenstand]').first();
      return (await z.count()) ? { ton: await z.getAttribute('data-datenstand'), text: await z.innerText() } : null;
    };
    const frisch = await standFuer({ land: 'AT', zustand: 'liefert', quellen: 1, abruf: { zuletzt: new Date(Date.now() - 3 * 60000).toISOString(), intervall_ms: 300000, aktuell: true } });
    const alt = await standFuer({ land: 'AT', zustand: 'liefert', quellen: 1, abruf: { zuletzt: new Date(Date.now() - 3 * 3600000).toISOString(), intervall_ms: 300000, aktuell: false } });
    if (!frisch || frisch.ton !== 'ok' || !/Live/.test(frisch.text)) findings.push(`Aktualität: frische Daten werden nicht als „Live" gezeigt (${frisch && frisch.text})`);
    else if (!alt || alt.ton !== 'warn' || /Live/.test(alt.text)) findings.push(`Aktualität: alte Daten sehen aus wie frische (${alt && alt.text})`);
    else console.log('✓ Aktualität: „Live, vor 3 Min." bei frischen Daten, Warnung bei altem Abruf');
    await page.unroute('**/api/coverage/**').catch(() => {});

    // ── 10. Engpass-Chronik: Zahlen mit Zeitraum, nie ohne Grundlage ─────────
    //  Die Chronik ist das, was ApoPulse über die Behördenliste hinaus weiß.
    //  Geprüft wird, was kein Unit-Test sagt: Steht die Zahl IMMER mit dem
    //  Aufzeichnungsbeginn da? Kommt der Hinweis „wiederkehrend" nur ab zwei
    //  Episoden? Und schweigt die Seite, wenn das Land nie abgerufen wurde,
    //  statt „0× knapp" zu behaupten?
    {
      const seit = '2026-09-01';
      const ep = (beginn, ende, tage, art = 'gemeldet') => ({ land: 'AT', wirkstoff: 'Amoxicillin', beginn, beginn_art: art, ende, dauer_tage: tage, schwerster_status: 'kritisch', praeparate: ['Amoxicillin 1000 mg'], quelle: 'BASG' });
      const voll = { land: 'AT', aufzeichnung_seit: seit, anzahl: 3, durchschnitt_tage: 20, laengste_tage: 30,
        offen: ep('2026-10-05', null, 7), episoden: [ep('2026-10-05', null, 7), ep('2026-09-20', '2026-09-30', 10, 'beobachtet'), ep('2026-09-01', '2026-10-01', 30)] };
      const zeile = (wk, ch) => ({ id: 'ch-' + wk, wirkstoff: wk, bezeichnung: wk + ' 500 mg', status: 'kritisch', provenance: 'verified', quelle: 'BASG', history: [], chronik: ch });
      await page.route('**/api/shortages?*', async (route) => {
        const r = await route.fetch(); const j = await r.json();
        j.shortages = [zeile('Amoxicillin', { anzahl: 3, durchschnitt_tage: 20, aufzeichnung_seit: seit, offen_seit_tagen: 7 }), zeile('Ibuprofen', { anzahl: 1, durchschnitt_tage: null, aufzeichnung_seit: seit, offen_seit_tagen: 4 })];
        return route.fulfill({ response: r, json: j });
      });
      let chronikAntwort = voll;
      await page.route('**/api/wirkstoff/**', async (route) => {
        const r = await route.fetch(); const j = await r.json();
        j.chronik = chronikAntwort;
        return route.fulfill({ response: r, json: j });
      });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await reiterOeffnen(page, 'shortages');
      await page.waitForSelector('[data-wirkstoff="Amoxicillin"]', { timeout: 6000 }).catch(() => {});
      const zeilen = await page.locator('[data-chronikzeile]').allInnerTexts();
      const wkSeite = async (antwort) => {
        chronikAntwort = antwort;
        await page.evaluate(() => { const b = document.querySelector('.tabs button[data-tab="shortages"]'); if (b) b.click(); });
        await page.waitForSelector('[data-wirkstoff="Amoxicillin"]', { timeout: 6000 }).catch(() => {});
        await page.click('[data-wirkstoff="Amoxicillin"]').catch(() => {});
        await page.waitForTimeout(900);
        const k = page.locator('[data-chronik]');
        return (await k.count()) ? await k.first().innerText() : null;
      };
      const mit = await wkSeite(voll);
      const nie = await wkSeite(null);
      const null0 = await wkSeite({ land: 'AT', aufzeichnung_seit: seit, anzahl: 0, offen: null, durchschnitt_tage: null, laengste_tage: null, episoden: [] });
      if (zeilen.length !== 1 || !/3×/.test(zeilen[0]) || !/01\.09\.2026/.test(zeilen[0])) findings.push(`Chronik: „wiederkehrend" fehlt, steht ohne Zeitraum oder schon bei einer Episode (${JSON.stringify(zeilen)})`);
      else if (!mit) findings.push('Chronik: keine Verlaufskarte auf der Wirkstoff-Seite');
      else if (!/3× knapp in .* seit 01\.09\.2026/.test(mit)) findings.push(`Chronik: Zahl ohne Aufzeichnungsbeginn (${mit.slice(0, 120)})`);
      else if (!/im Schnitt 20 Tage/.test(mit) || !/läuft noch/.test(mit) || !/spätestens 30\.09\.2026/.test(mit)) findings.push(`Chronik: Durchschnitt, laufende oder beendete Episode fehlt (${mit.slice(0, 200)})`);
      else if (!/Beginn laut Behörde/.test(mit) || !/erstmals auf der Liste gesehen/.test(mit)) findings.push('Chronik: Herkunft des Beginns (Behörde/beobachtet) nicht benannt');
      else if (!/Nur Behördendaten/.test(mit)) findings.push('Chronik: Hinweis auf die Grundlage fehlt');
      else if (nie !== null) findings.push('Chronik: Karte erscheint für ein nie abgerufenes Land');
      else if (!null0 || !/nicht auf der Engpassliste/.test(null0) || !/01\.09\.2026/.test(null0)) findings.push(`Chronik: „nie knapp" ohne Zeitraum (${null0})`);
      else console.log('✓ Chronik: Zahl immer mit Aufzeichnungsbeginn, „wiederkehrend" erst ab zwei Episoden, Schweigen ohne Grundlage');
      // Premium-Schnitt in der Oberfläche: gesperrt -> Hinweis mit Knopf,
      // keine Episodenzeilen, kein Export; frei -> Export-Knopf.
      const gesperrt = await wkSeite({ ...voll, episoden: [], episoden_gesperrt: true });
      const sperrHinweis = await page.locator('[data-chroniksperre] [data-gopremium]').count();
      const exportGesperrt = await page.locator('[data-chronikcsv]').count();
      await wkSeite(voll);
      const exportFrei = await page.locator('[data-chronikcsv]').count();
      if (!gesperrt || !/3× knapp/.test(gesperrt) || sperrHinweis !== 1 || exportGesperrt !== 0 || /spätestens 30\.09/.test(gesperrt)) findings.push(`Chronik: gesperrte Ansicht falsch (Hinweis ${sperrHinweis}, Export ${exportGesperrt}): ${String(gesperrt).slice(0, 160)}`);
      else if (exportFrei !== 1) findings.push('Chronik: Premium sieht keinen Export-Knopf');
      else console.log('✓ Chronik: ohne Premium Zusammenfassung + Hinweis, mit Premium Episoden + Export');

      // CSV-Formel-Schutz (alle Exporte): „=HYPERLINK(…)" aus einer
      // Community-Meldung darf in Excel nichts ausführen; Zahlen bleiben Zahlen.
      const csv = await page.evaluate(() => window.__csvZeilen ? window.__csvZeilen(['a'], [['=HYPERLINK("http://x","y")'], ['@SUM(A1)'], ['+1+1'], ['-1,50'], ['-A1'], ['Amoxicillin']]) : null);
      if (!csv) findings.push('CSV-Schutz nicht prüfbar — window.__csvZeilen fehlt');
      else {
        const z = csv.replace(/^\ufeff/, '').split('\r\n');
        const roh = z.map((x) => x.replace(/^"|"$/g, ''));
        if (!roh[1].startsWith("'=") || !roh[2].startsWith("'@") || !roh[3].startsWith("'+") || !roh[5].startsWith("'-")) findings.push(`CSV: Formel nicht entschärft (${JSON.stringify(roh.slice(1, 6))})`);
        else if (roh[4] !== '-1,50' || roh[6] !== 'Amoxicillin') findings.push(`CSV: normale Werte verändert (${roh[4]}, ${roh[6]})`);
        else console.log('✓ CSV-Export: Formeln entschärft, Zahlen und Text unverändert');
      }

      // ── Frühwarnung aus dem Ausland ──────────────────────────────────────
      //  Tatsache mit Land, Dauer und Quelle — und der Satz „keine Prognose".
      //  Ohne Premium: Hinweis auf die Sofort-Benachrichtigung; leer: keine Karte.
      const fwEintrag = [{ wirkstoff: 'Cefuroxim', laender: [{ land: 'US', beginn: '2026-10-08', beginn_art: 'beobachtet', dauer_tage: 4, schwerster_status: 'kritisch', quelle: 'FDA' }] }];
      const uebersicht = async (fw, premium) => {
        await page.unroute('**/api/overview*').catch(() => {});
        await page.route('**/api/overview*', async (route) => { const r = await route.fetch(); const j = await r.json(); j.fruehwarnung = fw; j.premium = premium; return route.fulfill({ response: r, json: j }); });
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        const k = page.locator('[data-fruehwarnung]');
        return (await k.count()) ? { text: await k.first().innerText(), knopf: await k.locator('[data-gopremium]').count() } : null;
      };
      const fwFrei = await uebersicht(fwEintrag, false);
      const fwPrem = await uebersicht(fwEintrag, true);
      const fwLeer = await uebersicht([], false);
      await page.unroute('**/api/overview*').catch(() => {});
      chronikAntwort = voll;
      await page.unroute('**/api/wirkstoff/**').catch(() => {});
      await page.route('**/api/wirkstoff/**', async (route) => { const r = await route.fetch(); const j = await r.json(); j.chronik = voll; j.ausland = fwEintrag[0].laender; return route.fulfill({ response: r, json: j }); });
      const wkAusland = await (async () => { await wkSeite(voll); const a = page.locator('[data-ausland]'); return (await a.count()) ? await a.innerText() : null; })();
      if (!fwFrei || !/Cefuroxim/.test(fwFrei.text) || !/seit 4 Tagen/.test(fwFrei.text) || !/FDA/.test(fwFrei.text) || !/\(noch\) nicht/.test(fwFrei.text)) findings.push(`Frühwarnung: Karte unvollständig (${fwFrei && fwFrei.text.slice(0, 160)})`);
      else if (/ US /.test(' ' + fwFrei.text + ' ') && !/USA|Vereinigte Staaten|United States/.test(fwFrei.text)) findings.push('Frühwarnung: Land als Kürzel statt Name');
      else if (fwFrei.knopf !== 1 || !fwPrem || fwPrem.knopf !== 0 || !/sofort benachrichtigt/.test(fwPrem.text)) findings.push(`Frühwarnung: Premium-Hinweis falsch (frei ${fwFrei.knopf}, premium ${fwPrem && fwPrem.knopf})`);
      else if (fwLeer !== null) findings.push('Frühwarnung: leere Karte erscheint');
      else if (!wkAusland || !/seit 4 Tagen/.test(wkAusland) || !/keine Prognose/.test(wkAusland)) findings.push(`Frühwarnung: Wirkstoff-Seite ohne „im Ausland knapp" (${wkAusland})`);
      else console.log('✓ Frühwarnung: Land, Dauer, Quelle, „keine Prognose"; Premium-Hinweis nur ohne Premium; keine leere Karte');

      // Benachrichtigung: Text, Landesname statt Kürzel, Klick öffnet den Wirkstoff.
      await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notifications: [
        { id: 'n1', type: 'shortage_abroad', label: 'Cefuroxim · US', read: true, created_at: new Date().toISOString(), actor: null },
      ] }) }));
      await page.click('#btnNotif').catch(() => {});
      await page.waitForTimeout(700);
      const nText = await page.locator('.comment.clickable').filter({ hasText: 'Cefuroxim' }).first().innerText().catch(() => '');
      await page.locator('.comment.clickable').filter({ hasText: 'Cefuroxim' }).first().click().catch(() => {});
      await page.waitForTimeout(900);
      const nZiel = await page.locator('[data-ausland], [data-chronik]').count();
      await page.unroute('**/api/notifications').catch(() => {});
      if (!/Frühwarnung/.test(nText) || /· US"/.test(nText) || /Jemand/.test(nText)) findings.push(`Frühwarnung: Benachrichtigungstext falsch („${nText}")`);
      else if (!nZiel) findings.push('Frühwarnung: Klick auf die Benachrichtigung öffnet den Wirkstoff nicht');
      else console.log('✓ Frühwarnung: Benachrichtigung mit Landesname, Klick öffnet den Wirkstoff');

      await page.unroute('**/api/shortages?*').catch(() => {});
      await page.unroute('**/api/wirkstoff/**').catch(() => {});
    }

    // ── 11. Premium verspricht nur, was läuft; Wochenbericht-Vorschau ───────
    //  Bis 10/2026 warb die Seite mit Werbung, Videosprechstunden und Live-
    //  Sessions — alle drei in ruhenden Bereichen. Und die Vorschau zeigt eine
    //  Mail mit Behördentexten: Sie gehört in eine Box OHNE Rechte.
    {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(() => openPremium());
      await page.waitForSelector('[data-wbkarte]', { timeout: 6000 }).catch(() => {});
      const prText = await page.locator('#prBody').innerText().catch(() => '');
      // VOR dem Seitenwechsel unten lesen — danach ist die Tabelle weg und die
      // Prüfung läse leeren Text (so in der ersten Gegenprobe geschehen).
      const pvText = await page.locator('[data-pvtabelle]').innerText().catch(() => '');
      const mailAn = await page.evaluate(() => fetch('/api/abdeckung').then((r) => r.json()).then((a) => a.mail)).catch(() => null);
      await page.click('[data-wbvorschau]').catch(() => {});
      await page.waitForSelector('[data-wbframe] iframe', { timeout: 6000 }).catch(() => {});
      const fr = page.locator('[data-wbframe] iframe');
      const sandbox = (await fr.count()) ? await fr.getAttribute('sandbox') : null;
      const srcdoc = (await fr.count()) ? await fr.getAttribute('srcdoc') : '';
      const stand = await page.locator('[data-wbstand]').innerText().catch(() => '');
      await page.goto(BASE + '/?wb_abmelden=abc.def', { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-wbabgemeldet]', { timeout: 6000 }).catch(() => {});
      const banner = await page.locator('[data-wbabgemeldet]').innerText().catch(() => '');
      const url = page.url();
      if (/Eigene Angebote bewerben|Videosprechstunden anbieten|Live-Sessions hosten/.test(prText)) findings.push('Premium: wirbt mit Funktionen aus ruhenden Bereichen');
      else if (!/Engpass-Verlauf/.test(prText) || !/Sortiments-Check/.test(prText) || !/Vorrats-Radar/.test(prText)) findings.push(`Premium: Informationsvorteile fehlen (${prText.slice(0, 160)})`);
      // Wochenbericht nur im Vergleich, wenn der E-Mail-Versand läuft (hier: nicht eingerichtet).
      else if (!pvText) findings.push('Premium: Vergleichstabelle fehlt');
      else if (mailAn === false && /Wochenbericht per E-Mail/.test(pvText)) findings.push('Premium: Wochenbericht im Vergleich, obwohl kein E-Mail-Versand eingerichtet ist');
      else if (sandbox !== '') findings.push(`Wochenbericht: Vorschau nicht abgeschottet (sandbox=${sandbox})`);
      else if (!/ApoPulse/.test(srcdoc || '') || !/wb_abmelden=/.test(srcdoc || '')) findings.push('Wochenbericht: Vorschau leer oder ohne Abmelde-Link');
      else if (!/Premium/.test(stand)) findings.push(`Wochenbericht: Stand ohne Premium-Hinweis (${stand})`);
      else if (!/ungültig/.test(banner) || /wb_abmelden/.test(url)) findings.push(`Wochenbericht: gefälschter Abmelde-Link nicht abgewiesen oder Token bleibt in der Adresse (${banner} · ${url})`);
      else console.log('✓ Premium: nur laufende Vorteile; Wochenbericht-Vorschau abgeschottet; gefälschter Abmelde-Link abgewiesen');
    }

    // ── 12. Premium mit Ablaufdatum: Stand + Verlängern; unbefristet: nur Stand
    {
      const premiumSeite = async (antwort) => {
        await page.unroute('**/api/me/premium').catch(() => {});
        await page.route('**/api/me/premium', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) }));
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.evaluate(() => openPremium());
        await page.waitForSelector('[data-prbis]', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(600);
        return page.locator('#prBody').innerText().catch(() => '');
      };
      const befristet = await premiumSeite({ premium: true, features: ['premium'], bis: '2026-11-13T10:00:00.000Z' });
      const unbefristet = await premiumSeite({ premium: true, features: ['premium'], bis: null });
      await page.unroute('**/api/me/premium').catch(() => {});
      if (!/Aktiv bis 13\.11\.2026/.test(befristet) || !/keinen Tag/.test(befristet)) findings.push(`Premium: Ablaufdatum fehlt (${befristet.slice(0, 160)})`);
      else if (!/Premium \(Monat\)/.test(befristet)) findings.push('Premium: mit Ablaufdatum kein Weg zum Verlängern');
      else if (/Aktiv bis|Premium \(Monat\)/.test(unbefristet)) findings.push('Premium: unbefristetes Premium soll weder Datum noch Kaufangebot zeigen');
      else console.log('✓ Premium: Ablaufdatum mit Verlängern; unbefristet ohne Kaufangebot');
    }

    // ── 13. Laufzeit wählen: Monat UND Jahr, Ersparnis gerechnet, gewähltes
    //  Produkt kommt beim Kauf an (vorher war das Jahr nirgends erreichbar).
    {
      await page.unroute('**/api/payments/mine').catch(() => {});
      let gestartet = null;
      await page.route('**/api/payments/crypto/start', (route) => { gestartet = JSON.parse(route.request().postData() || '{}'); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Prüfabbruch', code: 'pruef' }) }); });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(() => openPremium());
      await page.waitForSelector('[data-prplan]', { timeout: 6000 }).catch(() => {});
      const plaene = await page.locator('[data-plan]').evaluateAll((els) => els.map((e) => e.dataset.plan));
      await page.click('[data-plan="premium_yearly"]').catch(() => {});
      await page.waitForTimeout(900);
      const preis = await page.locator('[data-prpreis]').innerText().catch(() => '');
      const wahlText = await page.locator('[data-prplan]').innerText().catch(() => '');
      const coin = page.locator('.crypto-pay').first();
      if (await coin.count()) {
        await coin.locator('.tx-in').fill('abc');
        await coin.locator('[data-report]').click();
        await page.waitForTimeout(500);
      }
      await page.unroute('**/api/payments/crypto/start').catch(() => {});
      if (JSON.stringify(plaene) !== JSON.stringify(['premium_monthly', 'premium_yearly'])) findings.push(`Premium: Laufzeiten fehlen (${plaene.join(', ')})`);
      else if (!/Jahr/.test(preis) || !/99,00/.test(preis)) findings.push(`Premium: Jahr gewählt, aber Preis zeigt ${preis}`);
      else if (!/spart € ?20,88/.test(wahlText.replace(/\s+/g, ' '))) findings.push(`Premium: Ersparnis falsch oder fehlt (${wahlText})`);
      else if (!gestartet || gestartet.productId !== 'premium_yearly') findings.push(`Premium: gewähltes Jahr kam beim Kauf nicht an (${JSON.stringify(gestartet)})`);
      else console.log('✓ Premium: Monat und Jahr wählbar, Ersparnis gerechnet, gewähltes Produkt kommt beim Kauf an');
    }

    // ── 14. Betriebs-Cockpit und Quellen-Hinweis (Redaktion) ────────────────
    {
      const betrieb = {
        konten: { gesamt: 128, neu_7: 9 }, premium: { aktiv: 14, unbefristet: 1, laeuft_ab_7: 2, abgelaufen_30: 1 },
        einnahmen: { tage: 30, anzahl: 6, summen: [{ currency: 'EUR', cents: 15894 }], offen_pruefung: 1 },
        quellen: { gesamt: 3, liefern: 2, offen: 0, fehler: 1, fehlerhaft: [{ id: 'openfda_shortages', land: 'US', label: 'FDA', fehler: 'HTTP 403' }] },
        abruf: { zuletzt: new Date(Date.now() - 3600000).toISOString(), ok: true }, mail: { aktiv: false, grund: 'kein_anbieter' }, ki: 'aus',
      };
      const leer = (pfad, body) => page.route(pfad, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
      await leer('**/api/betrieb', betrieb);
      await leer('**/api/reports', { reports: [] });
      await leer('**/api/verify/requests', { requests: [] });
      await leer('**/api/payments/pending', { payments: [] });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(() => { iAmModerator = true; return loadOverview(); });
      await page.waitForSelector('[data-quellenhinweis]', { timeout: 6000 }).catch(() => {});
      const hinweis = await page.locator('[data-quellenhinweis]').innerText().catch(() => '');
      await page.evaluate(() => showModeration());
      await page.waitForSelector('[data-betrieb]', { timeout: 6000 }).catch(() => {});
      const cockpit = await page.locator('[data-betrieb]').innerText().catch(() => '');
      await page.click('[data-btquellen]').catch(() => {});
      await page.waitForTimeout(600);
      const aufDq = await page.locator('[data-dqneu]').count();
      for (const p of ['**/api/betrieb', '**/api/reports', '**/api/verify/requests', '**/api/payments/pending']) await page.unroute(p).catch(() => {});
      await page.evaluate(() => { iAmModerator = false; });
      if (!/1 Engpass-Quelle liefert nicht/.test(hinweis) || !/FDA \(HTTP 403\)/.test(hinweis)) findings.push(`Redaktion: Quellen-Hinweis fehlt oder ohne Grund (${hinweis})`);
      else if (!/128/.test(cockpit) || !/9 neu in 7 Tagen/.test(cockpit) || !/14/.test(cockpit) || !/2 laufen in 7 Tagen ab/.test(cockpit) || !/158,94/.test(cockpit) || !/2\/3/.test(cockpit)) findings.push(`Cockpit: Zahlen fehlen (${cockpit.replace(/\s+/g, ' ').slice(0, 200)})`);
      else if (!aufDq) findings.push('Cockpit: Klick auf „Quellen" öffnet die Datenquellen-Seite nicht');
      else console.log('✓ Redaktion: Quellen-Hinweis mit Grund; Cockpit mit Konten, Premium, Einnahmen, Quellen — Klick führt zu den Datenquellen');
    }

    if (errors.length) findings.push(`Säule 3: JS-Fehler — ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // ── Startseite: „Lage jetzt" nur mit echten Zahlen; keine ruhenden Versprechen
  {
    const startseite = async (lage) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => { try { localStorage.setItem('apo_country', 'AT'); } catch { /* */ } });
      await page.route('**/api/lage/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lage) }));
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      const r = { box: await page.locator('[data-lagebox]').innerText().catch(() => null), liste: await page.locator('[data-herolist]').innerText().catch(() => '') };
      await ctx.close();
      return r;
    };
    const mit = await startseite({ land: 'AT', daten: true, offen: 37, neu: 5, beendet: 2, quellen: ['BASG'], stand: new Date(Date.now() - 2 * 3600000).toISOString() });
    const ohne = await startseite({ land: 'AT', daten: false });
    if (!mit.box || !/37 Wirkstoffe auf der Engpassliste/.test(mit.box) || !/Österreich/.test(mit.box) || !/5 neu in 7 Tagen/.test(mit.box) || !/Quelle: BASG/.test(mit.box)) findings.push(`Startseite: „Lage jetzt" fehlt oder ohne Quelle (${mit.box})`);
    else if (ohne.box !== null) findings.push('Startseite: „Lage jetzt" erscheint ohne Behördendaten');
    else if (/Bestände tauschen|Fachnetzwerk/.test(mit.liste)) findings.push('Startseite: verspricht ruhende Bereiche (Tauschbörse/Fachnetzwerk)');
    else if (!/Frühwarnung/.test(mit.liste)) findings.push('Startseite: Informationsvorteile fehlen in der Liste');
    else console.log('✓ Startseite: „Lage jetzt" mit Zahl, Quelle, Stand — ohne Daten nichts; nur laufende Versprechen');
  }

  // ── Sortiments-Check: Liste einfügen, Einstufung je Zeile ───────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    if (!(await page.locator('#ov_sortiment').isVisible().catch(() => false))) findings.push('Sortiments-Check: Eintrag auf „Für dich" fehlt');
    else {
      await page.click('#ov_sortiment'); await page.waitForTimeout(300);
      await page.fill('#srtText', 'Amoxicillin 1000 mg\nIbuprofen 400 mg\nXyzabc Tropfen\n' + Array.from({ length: 20 }, (_, i) => 'Zeile' + i).join('\n'));
      await page.click('#srtGo'); await page.waitForTimeout(1200);
      const r = await page.evaluate(() => ({
        kacheln: document.querySelectorAll('[data-srtergebnis] .ovtile').length,
        zeilen: document.querySelectorAll('.srt-zeile').length,
        sperre: !!document.querySelector('.srt-sperre'),
        unbekannt: [...document.querySelectorAll('.srt-zeile')].some((z) => /Xyzabc/.test(z.textContent)),
      }));
      if (r.kacheln !== 5) findings.push(`Sortiments-Check: ${r.kacheln} statt 5 Zusammenfassungs-Kacheln`);
      if (r.zeilen !== 15) findings.push(`Sortiments-Check: ${r.zeilen} Zeilen geprüft, gratis erwartet 15`);
      if (!r.sperre) findings.push('Sortiments-Check: Hinweis auf nicht geprüfte Zeilen (Premium) fehlt');
      if (!r.unbekannt) findings.push('Sortiments-Check: unbekannte Zeile verschwindet statt „keine Meldung"');
      if (!findings.some((f) => f.startsWith('Sortiments-Check'))) console.log('✓ Sortiments-Check: 5 Kacheln, 15 Gratis-Zeilen, Premium-Hinweis, unbekannte Zeile sichtbar');
    }
    for (const f of fehler) findings.push('Sortiments-Check: JS-Fehler ' + f);
    await ctx.close();
  }

  // ── Anzeigen: gekennzeichnet, erklärbar — und nie bei Engpass/Rückruf ────
  //  Nachgebildete Anzeige (die Prüfumgebung hat keine gebuchte). Geprüft
  //  wird die Kennzeichnung UND, dass auf Engpass-, Live-Warnungs- und
  //  Wirkstoff-Seiten keine Anzeige auch nur angefragt wird.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    const anfragen = [];
    await page.route('**/api/anzeigen/platz/**', (route) => {
      anfragen.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ anzeige: {
        id: 'kprobe', platz: 'start', titel: 'PRUEFANZEIGE Kühllogistik', text: 'Temperaturgeführte Zustellung.', bild: null, cta: null, firma: 'Prüf GmbH',
        pflichtangaben: null, art: 'unternehmen', rx: null, klick: '/api/anzeigen/kprobe/klick?z=abc',
        warum: { firma: 'Prüf GmbH', bezahlt_von: 'Prüf GmbH', laender: ['AT'], zielgruppen: ['pharmacy'], nur_fachkreise: false } } }) });
    });
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    const karte = page.locator('.anz-karte').first();
    if (!(await karte.count())) findings.push('Anzeigen: Startseite zeigt die (nachgebildete) Anzeige nicht');
    else {
      const txt = await karte.innerText();
      if (!/anzeige/i.test(txt) || !/Prüf GmbH/.test(txt)) findings.push(`Anzeigen: Kennzeichnung oder Firma fehlt (${txt.slice(0, 80)})`);
      const a = karte.locator('a.btn-link');
      const rel = (await a.count()) ? await a.getAttribute('rel') : '';
      if (!/sponsored/.test(rel || '')) findings.push('Anzeigen: Ziel-Link ohne rel="sponsored"');
      await karte.locator('[data-anzwarum]').click();
      const warum = await karte.locator('[data-anzwarumtext]').innerText().catch(() => '');
      if (!/bezahlt/.test(warum) || !/Österreich/.test(warum)) findings.push(`Anzeigen: „Warum sehe ich das?" nennt Zahler oder Merkmale nicht (${warum.slice(0, 80)})`);
    }
    // Sicherheitsrelevante Seiten: keine Anfrage.
    const vorher = anfragen.length;
    for (const tab of ['shortages', 'signals']) { await reiterOeffnen(page, tab); await page.waitForTimeout(800); }
    await page.evaluate(() => openWirkstoff('Amoxicillin')); await page.waitForTimeout(900);
    const seitVorher = anfragen.slice(vorher).filter((p) => !p.endsWith('/seite'));
    if (seitVorher.length) findings.push(`Anzeigen: auf Engpass-/Warnungs-/Wirkstoff-Seiten angefragt (${seitVorher.join(', ')})`);
    // Mediadaten und Buchung öffnen ohne Fehler.
    await page.evaluate(() => openWerbung()); await page.waitForTimeout(900);
    if (!(await page.locator('[data-mediadaten]').count())) findings.push('Anzeigen: Mediadaten-Seite fehlt');
    for (const f of fehler) findings.push('Anzeigen: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Anzeigen'))) console.log('✓ Anzeigen: gekennzeichnet mit Firma, rel=sponsored, „Warum?" nennt Zahler und Merkmale; nie auf Engpass/Warnungen/Wirkstoff; Mediadaten öffnen');
    await ctx.close();
  }

  // ── Teilen mit Vorschau: Link → Konto → Wirkstoff wird beobachtet ───────
  //  Ein geteilter Link soll in Messengern eine Vorschau mit Quelle zeigen und
  //  Neue ohne Umweg zum Nutzen bringen: Konto anlegen, und der Wirkstoff aus
  //  dem Link steht schon auf der Beobachtungsliste.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); delete Navigator.prototype.share; }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const knopf = page.locator('[data-lageteilen]');
    if (!(await knopf.count())) findings.push('Teilen: „Lage teilen" fehlt auf „Für dich"');
    else {
      await knopf.click(); await page.waitForTimeout(300);
      const wa = await page.locator('#teilBlatt a[href^="https://wa.me/"]').getAttribute('href').catch(() => null);
      if (!wa) findings.push('Teilen: Teilen-Blatt ohne WhatsApp-Weg');
      else {
        const link = decodeURIComponent(wa).match(/https?:\/\/\S+\/teilen\/lage\/[A-Z]{2}/);
        if (!link) findings.push(`Teilen: WhatsApp-Text ohne Link auf die Teilseite (${decodeURIComponent(wa).slice(0, 100)})`);
        else {
          const html = await (await fetch(BASE + new URL(link[0]).pathname)).text();
          if (!/<meta property="og:title" content="[^"]+"/.test(html) || !/og-bild\.png/.test(html)) findings.push('Teilen: Teilseite ohne Vorschau-Angaben (og:title/og:image)');
        }
      }
      await page.keyboard.press('Escape');
      if (await page.locator('#teilBlatt').count()) findings.push('Teilen: Blatt schließt nicht mit Esc');
    }
    for (const f of fehler) findings.push('Teilen: JS-Fehler ' + f);
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const neu = await ctx2.newPage();
    const fehler2 = []; neu.on('pageerror', (e) => fehler2.push(e.message));
    await neu.goto(BASE + '/?land=AT&beobachten=Amoxicillin', { waitUntil: 'networkidle' }); await neu.waitForTimeout(500);
    const banner = await neu.locator('[data-absicht]').innerText().catch(() => '');
    if (!/Amoxicillin/.test(banner)) findings.push('Teilen: Anmeldeseite nennt den Wirkstoff aus dem Link nicht');
    if (/beobachten=/.test(neu.url())) findings.push('Teilen: Absicht bleibt in der Adresse stehen');
    await neu.fill('#rg_name', 'Link Test'); await neu.fill('#rg_email', `teil_${Date.now().toString(36)}@reg.test`); await neu.fill('#rg_pw', 'Passwort123!');
    await neu.click('#rg_go'); await neu.waitForTimeout(1200);
    if (await neu.locator('#rc_done').count()) { await neu.click('#rc_done'); await neu.waitForTimeout(1200); }
    const liste = await neu.evaluate(() => fetch('/api/watchlist', { headers: { authorization: 'Bearer ' + localStorage.getItem('apo_token') } }).then((r) => r.json()).catch(() => ({})));
    if (!(liste.items || []).some((i) => /amoxicillin/i.test(JSON.stringify(i)))) findings.push('Teilen: nach dem Konto-Anlegen steht der Wirkstoff aus dem Link nicht auf der Beobachtungsliste');
    if (await neu.evaluate(() => localStorage.getItem('apo_absicht'))) findings.push('Teilen: Absicht bleibt nach der Verarbeitung liegen (würde bei jedem Start erneut greifen)');
    for (const f of fehler2) findings.push('Teilen: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Teilen'))) console.log('✓ Teilen: Blatt mit WhatsApp-Link auf Teilseite mit Vorschau; Link → Banner → Konto → Wirkstoff beobachtet');
    await ctx2.close();
  }

  // ── Daten-Schnittstelle (Business): verständlich, Schlüssel nur einmal ────
  //  Ohne Business: Preis und Buchen-Knopf, der auf die Zahlung mit dem
  //  Business-Tarif führt. Mit Business (nachgebildet): neuer Schlüssel
  //  einmal sichtbar und in der Excel-Adresse eingesetzt. Kein Querscrollen
  //  am Handy trotz langer Adressen.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const quer = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (!(await page.locator('#btnDatenApi').count())) findings.push('Daten-Schnittstelle: Menüeintrag fehlt');
    await page.evaluate(() => openDatenApi()); await page.waitForTimeout(800);
    const buchen = page.locator('[data-dabuchen]');
    if (!(await buchen.count())) findings.push('Daten-Schnittstelle: ohne Business kein Preis/Buchen-Knopf');
    else {
      const txt = await buchen.innerText();
      if (!/990/.test(txt)) findings.push(`Daten-Schnittstelle: Preis fehlt (${txt.slice(0, 80)})`);
      if ((await quer()) > 0) findings.push(`Daten-Schnittstelle: ${await quer()} px Querscrollen am Handy`);
      await buchen.locator('[data-dago]').click();
      // Gezielt warten statt fester Pause: Die Premium-Seite lädt Kurse und Zahlwege (war ein Ausreißer bei 1,2 s).
      await page.waitForSelector('[data-prpreis]', { timeout: 8000 }).catch(() => {});
      await page.waitForSelector('.crypto-pay', { timeout: 8000 }).catch(() => {});
      const preis = await page.locator('[data-prpreis]').innerText().catch(() => '');
      if (!/Business/.test(preis)) findings.push(`Daten-Schnittstelle: Buchen führt nicht zur Business-Zahlung (${preis.slice(0, 80)})`);
      const krypto = await page.locator('.crypto-pay').count();
      if (!krypto) findings.push('Daten-Schnittstelle: Business ohne Krypto-Zahlung');
    }
    // Mit Business (nachgebildet): Schlüssel anlegen.
    const roh = 'apk_PRUEF' + 'x'.repeat(27);
    let liste = [];
    await page.route('**/api/daten-api/schluessel', (route) => {
      if (route.request().method() === 'POST') {
        liste = [{ id: 'abc123', name: 'Excel', anzeige: 'apk_PRUE…xxxx', angelegt: new Date().toISOString(), zuletzt: null, anfragen: 0 }];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schluessel: { ...liste[0], schluessel: roh } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ berechtigt: true, bis: '2027-10-14T00:00:00.000Z', schluessel: liste }) });
    });
    await page.evaluate(() => openDatenApi()); await page.waitForTimeout(600);
    await page.fill('#daName', 'Excel'); await page.click('#daNeu'); await page.waitForTimeout(800);
    const gezeigt = await page.locator('[data-daschluessel]').innerText().catch(() => '');
    if (gezeigt !== roh) findings.push('Daten-Schnittstelle: neuer Schlüssel wird nicht angezeigt');
    const excel = await page.locator('[data-daexcel]').innerText().catch(() => '');
    if (!excel.includes('key=' + roh) || !/format=csv/.test(excel)) findings.push(`Daten-Schnittstelle: Excel-Adresse ohne Schlüssel (${excel.slice(0, 90)})`);
    if ((await quer()) > 0) findings.push(`Daten-Schnittstelle: ${await quer()} px Querscrollen mit Schlüssel`);
    // Nach dem Verlassen ist der Klartext weg.
    await page.locator('[data-back]').first().click(); await page.waitForTimeout(500);
    await page.evaluate(() => openDatenApi()); await page.waitForTimeout(600);
    if (await page.locator('[data-daschluessel]').count()) findings.push('Daten-Schnittstelle: Klartext-Schlüssel bleibt nach dem Verlassen sichtbar');
    for (const f of fehler) findings.push('Daten-Schnittstelle: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Daten-Schnittstelle'))) console.log('✓ Daten-Schnittstelle: Preis + Buchen → Business-Zahlung mit Krypto; Schlüssel einmal sichtbar und in der Excel-Adresse; kein Querscrollen');
    await ctx.close();
  }

  // ── Rechnungen: per Rechnung zahlen, Rechnung lesbar und druckbar ───────
  //  Firmen zahlen oft nur per Überweisung und brauchen immer eine Rechnung.
  //  Ablauf am Handy: Knopf → Rechnungsangaben → Rechnung mit Nummer, IBAN,
  //  Verwendungszweck; danach in „Ihre Rechnungen" als offen.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    const neu = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Rechnung Audit', email: `rg_${Date.now().toString(36)}@ex.com`, password: 'Passwort123!', accountType: 'wholesale', country: 'AT' }) });
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, neu && neu.token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.evaluate(() => { prPlan = 'business_yearly'; openPremium(); }); await page.waitForTimeout(1200);
    const quer = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (!(await page.locator('[data-rgueberweisung]').count())) findings.push('Rechnungen: „Per Rechnung zahlen" fehlt trotz eingerichteter Bankverbindung');
    else {
      await page.click('[data-rgbestellen]'); await page.waitForTimeout(300);
      if (!(await page.locator('[data-rgangaben]').count())) findings.push('Rechnungen: ohne Angaben kein Formular');
      else {
        const werte = { firma: 'Audit Großhandel GmbH', strasse: 'Hafen 2', plz: '1020', ort: 'Wien', email: 'rechnung@audit.example' };
        for (const [k, v] of Object.entries(werte)) await page.fill(`[data-rg="${k}"]`, v);
        await page.click('[data-rgspeichern]'); await page.waitForTimeout(1200);
        const txt = await page.locator('[data-rgrechnung]').innerText().catch(() => '');
        if (!/AP-\d{4}-\d{4}/.test(txt)) findings.push(`Rechnungen: keine Rechnung mit Nummer nach dem Anfordern (${txt.slice(0, 80)})`);
        if (!/AT00 0000/.test(txt) || !/Audit Großhandel GmbH/.test(txt)) findings.push('Rechnungen: IBAN oder Empfänger fehlen auf der Rechnung');
        if (!/990/.test(txt) || !/165/.test(txt)) findings.push('Rechnungen: Betrag oder enthaltene Umsatzsteuer fehlen');
        if ((await quer()) > 0) findings.push(`Rechnungen: ${await quer()} px Querscrollen auf der Rechnung`);
        if (!(await page.locator('[data-rgrechnung] [data-drucken]').count())) findings.push('Rechnungen: kein Drucken-Knopf');
        await page.click('[data-rgrechnung] [data-zurueck]'); await page.waitForTimeout(1200);
        const liste = await page.locator('[data-rgliste]').innerText().catch(() => '');
        if (!/AP-\d{4}-\d{4}/.test(liste) || !/Offen/.test(liste)) findings.push(`Rechnungen: „Ihre Rechnungen" zeigt die offene Rechnung nicht (${liste.slice(0, 80)})`);
      }
    }
    // Prüfliste der Redaktion: Überweisung ohne Krypto-Felder, klarer Knopf.
    const karte = await page.evaluate(() => {
      const k = kryptoPruefKarte({ id: 'x', method: 'invoice', amount_cents: 99000, currency: 'EUR', bezeichnung: 'Rechnung AP-2026-0001', product_name: 'Business', kunde: {}, created_at: new Date().toISOString() });
      return { ueberweisung: !!k.querySelector('[data-kpueberweisung]'), tx: !!k.querySelector('[data-kptx]'), knopf: k.querySelector('[data-kpok]').textContent, hinweis: (k.querySelector('[data-kphint]') || {}).textContent || '' };
    });
    if (!karte.ueberweisung || karte.tx) findings.push('Rechnungen: Prüfliste zeigt Überweisung wie eine Krypto-Zahlung');
    if (!/Zahlungseingang/.test(karte.knopf) || !/AP-2026-0001/.test(karte.hinweis)) findings.push(`Rechnungen: Prüfkarte ohne klaren Knopf/Verwendungszweck (${karte.knopf})`);
    for (const f of fehler) findings.push('Rechnungen: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Rechnungen'))) console.log('✓ Rechnungen: per Rechnung zahlen → Angaben → Rechnung mit Nummer, IBAN, USt; in „Ihre Rechnungen" offen; Prüfkarte für Überweisung');
    await ctx.close();
  }

  // ── Sofort-Alarm aufs Handy (Web-Push) ────────────────────────────────────
  //  Ein echtes Abo legt der Prüf-Browser nicht an (kein Push-Dienst) — die
  //  Browser-Schnittstelle wird nachgebildet, der Server prüft das Abo echt.
  //  Dazu: iPhone ohne Home-Bildschirm-App bekommt die Anleitung statt eines
  //  Knopfs, der nichts tut.
  {
    const { createECDH, randomBytes } = await import('node:crypto');
    const ua = createECDH('prime256v1'); ua.generateKeys();
    const abo = { endpoint: 'https://fcm.googleapis.com/fcm/send/audit-' + Date.now(), keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
    const neu = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Push Audit', email: `push_${Date.now().toString(36)}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'AT' }) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(([t, a]) => {
      localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1');
      let erlaubnis = 'default'; let aktiv = null;
      Object.defineProperty(Notification, 'permission', { get: () => erlaubnis, configurable: true });
      Notification.requestPermission = async () => { erlaubnis = 'granted'; return erlaubnis; };
      PushManager.prototype.subscribe = async function () { aktiv = { ...a, toJSON: () => a, unsubscribe: async () => { aktiv = null; return true; } }; return aktiv; };
      PushManager.prototype.getSubscription = async function () { return aktiv; };
    }, [neu && neu.token, abo]);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    if (!(await page.locator('#feed [data-pushkarte] [data-pushan-knopf]').count())) findings.push('Push: Startseite bietet den Sofort-Alarm nicht an');
    await page.evaluate(() => showNotifications()); await page.waitForTimeout(800);
    const knopf = page.locator('[data-pushkarte] [data-pushan-knopf]');
    if (!(await knopf.count())) findings.push('Push: Meldungen-Seite ohne Einschalten-Knopf');
    else {
      await knopf.click(); await page.waitForTimeout(800);
      if (!(await page.locator('[data-pushkarte] [data-pushan]').count())) findings.push('Push: nach dem Einschalten kein „Eingeschaltet"');
      const st = await page.evaluate(() => fetch('/api/push', { headers: { authorization: 'Bearer ' + localStorage.getItem('apo_token') } }).then((r) => r.json()));
      if (st.geraete !== 1) findings.push(`Push: Server kennt das Gerät nicht (${st.geraete})`);
      await page.click('[data-pushkarte] [data-pushaus]'); await page.waitForTimeout(800);
      const st2 = await page.evaluate(() => fetch('/api/push', { headers: { authorization: 'Bearer ' + localStorage.getItem('apo_token') } }).then((r) => r.json()));
      if (st2.geraete !== 0) findings.push('Push: Ausschalten meldet das Gerät nicht ab');
    }
    // „Nicht jetzt" auf der Startseite wirkt dauerhaft.
    await page.evaluate(() => mainScreen()); await page.waitForTimeout(900);
    const spaeter = page.locator('#feed [data-pushspaeter]');
    if (await spaeter.count()) {
      await spaeter.click(); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
      if (await page.locator('#feed [data-pushkarte]').count()) findings.push('Push: „Nicht jetzt" wirkt nicht — Karte kommt wieder');
    } else findings.push('Push: „Nicht jetzt" fehlt auf der Startseite');
    for (const f of fehler) findings.push('Push: JS-Fehler ' + f);
    await ctx.close();

    const iphone = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
    const ip = await iphone.newPage();
    await ip.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); delete window.PushManager; }, neu && neu.token);
    await ip.goto(BASE, { waitUntil: 'networkidle' }); await ip.waitForTimeout(600);
    await ip.evaluate(() => showNotifications()); await ip.waitForTimeout(700);
    const hinweis = await ip.locator('[data-pushkarte] [data-pushiphone]').innerText().catch(() => '');
    if (!/Home-Bildschirm/.test(hinweis)) findings.push(`Push: iPhone ohne App bekommt keine Anleitung (${hinweis.slice(0, 60)})`);
    if (await ip.locator('[data-pushkarte] [data-pushan-knopf]').count()) findings.push('Push: iPhone ohne App sieht einen Knopf, der nicht gehen kann');
    await iphone.close();
    if (!findings.some((f) => f.startsWith('Push'))) console.log('✓ Push: Startseite bietet an, Einschalten → Server kennt Gerät → Ausschalten meldet ab; „Nicht jetzt" bleibt; iPhone bekommt Anleitung');
  }

  // ── Öffentliche Engpass-Seiten: ohne Konto erreichbar, lesbar ohne JS ────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('apo_country', 'AT'); localStorage.setItem('apo_welcome_seen', '1'); });
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    const href = await page.locator('[data-oeffentlich]').getAttribute('href').catch(() => null);
    if (href !== '/engpaesse') findings.push('Öffentliche Seiten: Startseite ohne Konto verlinkt die Engpasslisten nicht');
    const ohneJs = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const p2 = await ohneJs.newPage();
    const antwort = await p2.goto(BASE + '/engpaesse');
    const h1 = await p2.locator('h1').innerText().catch(() => '');
    if (!antwort || antwort.status() !== 200 || !/Lieferengpässe/.test(h1)) findings.push(`Öffentliche Seiten: /engpaesse ohne JavaScript nicht lesbar (${antwort && antwort.status()} ${h1.slice(0, 40)})`);
    const quer = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (quer > 0) findings.push(`Öffentliche Seiten: ${quer} px Querscrollen am Handy`);
    const robots = await (await fetch(BASE + '/robots.txt')).text();
    if (!/Sitemap:/.test(robots)) findings.push('Öffentliche Seiten: robots.txt ohne Sitemap');
    if ((await fetch(BASE + '/engpaesse/zz')).status !== 404) findings.push('Öffentliche Seiten: unbekanntes Land liefert kein 404');
    for (const f of fehler) findings.push('Öffentliche Seiten: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Öffentliche Seiten'))) console.log('✓ Öffentliche Seiten: Startseite verlinkt, /engpaesse ohne JavaScript lesbar, kein Querscrollen, robots.txt mit Sitemap, 404 für Unbekanntes');
    await ohneJs.close(); await ctx.close();
  }

  // ── Moderation: Apotheken-Meldungen prüfen (Signale in Klartext, Entfernen ohne „wieder verfügbar") ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    const MP = { meldungen: [{ id: 'mp1', wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', land: 'UG', status: 'kritisch', apotheken: 3, bestaetigt: false,
      signale: [{ art: 'neue_konten', n: 2 }, { art: 'eingeladen', n: 2 }, { art: 'kurz_nacheinander', n: 2 }],
      beteiligte: [{ rolle: 'meldet', handle: 'kampala_apo', alter_stunden: 400, verifiziert: true }, { rolle: 'bestaetigt', handle: 'schein_eins', alter_stunden: 2, eingeladen_von_meldender: true }, { rolle: 'bestaetigt', handle: 'schein_zwei', alter_stunden: 2, eingeladen_von_meldender: true }] }] };
    const posts = [];
    await page.route('**/api/mod/meldungen', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MP) }));
    await page.route('**/api/mod/meldungen/*/*', (r) => { posts.push(new URL(r.request().url()).pathname); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    // Eigenes Konto aus Uganda: Die geprüften Texte sind die englischen.
    const regUG = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Mod UG', email: `mpug_${Date.now().toString(36)}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'UG' }) });
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, regUG.token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
    await page.evaluate(() => { app.innerHTML = ''; return meldungsPruefung(app); }); await page.waitForTimeout(400);
    const k = page.locator('[data-mpkarte="mp1"]');
    if (!(await k.count())) findings.push('Meldungsprüfung: Karte erscheint nicht');
    else {
      const text = await k.innerText();
      for (const s of ['younger than 24 hours', 'the reporter invited', 'within one hour', 'invited by the reporter', 'account 2 h old', 'account 16 days old'])
        if (!text.includes(s)) findings.push(`Meldungsprüfung: „${s}" fehlt`);
      for (const b of await k.locator('button').all()) if ((await b.boundingBox()).height < 44) findings.push('Meldungsprüfung: Knopf kleiner als 44 px');
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) findings.push('Meldungsprüfung: Querscrollen');
      page.once('dialog', (d) => d.accept());
      await k.locator('[data-mpbest="schein_eins"]').click(); await page.waitForTimeout(500);
      page.once('dialog', (d) => { if (!/Watchers do NOT get/.test(d.message())) findings.push('Meldungsprüfung: Rückfrage erklärt die Folgen nicht'); d.accept(); });
      await page.locator('[data-mpkarte="mp1"] [data-mpentfernen]').click(); await page.waitForTimeout(500);
      if (!posts.includes('/api/mod/meldungen/mp1/bestaetigung-entfernen') || !posts.includes('/api/mod/meldungen/mp1/entfernen')) findings.push(`Meldungsprüfung: Aktionen kommen nicht an (${posts.join(', ')})`);
    }
    for (const f of fehler) findings.push('Meldungsprüfung: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Meldungsprüfung'))) console.log('✓ Meldungsprüfung: Signale und Kontoalter in Klartext, Bestätigung entfernen und „als falsch entfernen" mit erklärender Rückfrage');
    await ctx.close();
  }

  // ── Startklar-Check (Redaktion): offene Punkte oben, aufklappbar, Handy ───
  {
    const { startklar } = await import('../src/services/startklar.js');
    const daten = startklar({ env: { APOPULSE_TOKEN_SECRET: 'x' }, wallets: [{ id: 'btc' }] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    const r = await page.evaluate((d) => {
      app.innerHTML = ''; const k = startklarKarte(d); app.appendChild(k);
      const punkte = [...k.querySelectorAll('[data-skpunkt]')];
      return { titel: k.querySelector('b').textContent, erste: punkte[0] && punkte[0].dataset.stufe, offenErste: punkte[0] && punkte[0].open,
        mitAnleitung: punkte.filter((p) => p.dataset.stufe !== 'ok').every((p) => /So geht/.test(p.textContent)),
        quer: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, daten);
    if (!/von \d+ erledigt/.test(r.titel)) findings.push(`Startklar: Titel ohne Fortschritt (${r.titel})`);
    if (r.erste !== 'fehlt' || !r.offenErste) findings.push('Startklar: „fehlt" steht nicht aufgeklappt oben');
    if (!r.mitAnleitung) findings.push('Startklar: offener Punkt ohne „So geht\'s"');
    if (r.quer > 0) findings.push(`Startklar: ${r.quer} px Querscrollen am Handy`);
    for (const f of fehler) findings.push('Startklar: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Startklar'))) console.log(`✓ Startklar: ${r.titel}; „fehlt" aufgeklappt oben, jeder offene Punkt mit Anleitung, kein Querscrollen`);
    await ctx.close();
  }

  // ── Erste Schritte: Neukunde in drei Handgriffen zum ersten Alarm ───────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(() => { if (!sessionStorage.getItem('es')) { localStorage.clear(); sessionStorage.setItem('es', '1'); localStorage.setItem('apo_country', 'AT'); } });
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.fill('#rg_name', 'Neu Kunde'); await page.fill('#rg_email', `es_${Date.now().toString(36)}@reg.test`); await page.fill('#rg_pw', 'Passwort123!');
    await page.click('#rg_go'); await page.waitForTimeout(1200);
    if (await page.locator('#rc_done').count()) { await page.click('#rc_done'); await page.waitForTimeout(1200); }
    if (!(await page.locator('[data-erste-schritte]').count())) findings.push('Erste Schritte: Neukunde landet nicht in den ersten Schritten');
    else {
      const chips = page.locator('[data-eschip]');
      const n = await chips.count();
      if (n < 6) findings.push(`Erste Schritte: nur ${n} Vorschläge zum Antippen`);
      const knopf = page.locator('[data-esweiter]');
      if (!(await knopf.isDisabled())) findings.push('Erste Schritte: Weiter-Knopf ohne Auswahl aktiv');
      await chips.nth(0).click(); await chips.nth(1).click();
      await page.fill('#esEigene', 'Pantoprazol');
      const text = await knopf.innerText();
      if (!/3/.test(text)) findings.push(`Erste Schritte: Knopf zählt nicht mit (${text})`);
      const groesse = await chips.nth(0).evaluate((e) => e.getBoundingClientRect().height);
      if (groesse < 44) findings.push(`Erste Schritte: Auswahl-Knöpfe zu klein (${groesse}px)`);
      const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (quer > 0) findings.push(`Erste Schritte: ${quer} px Querscrollen`);
      await knopf.click(); await page.waitForTimeout(900);
      if (!(await page.locator('[data-es2] ~ [data-pushkarte], [data-pushkarte]').count())) findings.push('Erste Schritte: Schritt 2 ohne Handy-Alarm');
      await page.click('[data-es2weiter]'); await page.waitForTimeout(400);
      const fertig = await page.locator('[data-es3]').innerText().catch(() => '');
      if (!/3 Wirkstoffen/.test(fertig)) findings.push(`Erste Schritte: Abschluss nennt die Anzahl nicht (${fertig.slice(0, 80)})`);
      const liste = await page.evaluate(() => fetch('/api/watchlist', { headers: { authorization: 'Bearer ' + localStorage.getItem('apo_token') } }).then((r) => r.json()));
      const namen = (liste.items || []).map((i) => JSON.stringify(i)).join(' ');
      if ((liste.items || []).length !== 3 || !/Pantoprazol/.test(namen)) findings.push(`Erste Schritte: Beobachtungsliste stimmt nicht (${(liste.items || []).length})`);
      await page.click('[data-es3go]'); await page.waitForTimeout(800);
      await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
      if (await page.locator('[data-erste-schritte]').count()) findings.push('Erste Schritte: kommen nach dem Abschluss wieder');
    }
    for (const f of fehler) findings.push('Erste Schritte: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Erste Schritte'))) console.log('✓ Erste Schritte: Neukunde → Vorschläge antippen + eigener Wirkstoff → Handy-Alarm → fertig; Liste hat 3 Wirkstoffe; kommt nicht wieder');
    await ctx.close();
  }

  // ── Afrika-Start: Uganda auf Englisch, drei Ebenen Land / Afrika / Welt ──
  {
    const neu = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Kampala Pharmacy', email: `ug_${Date.now().toString(36)}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'UG' }) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.removeItem('apo_ebene_news'); localStorage.removeItem('apo_ebene_engpaesse'); }, neu && neu.token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const quer = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const optionen = await page.$$eval('#countrySwitch option', (os) => os.map((o) => o.value)).catch(() => []);
    for (const cc of ['UG', 'TZ', 'ZM', 'ZW', 'RW', 'ET']) if (!optionen.includes(cc)) findings.push(`Afrika: ${cc} fehlt in der Länderwahl`);
    const lang = await page.evaluate(() => LOCALE);
    if (lang !== 'en') findings.push(`Afrika: Uganda nicht auf Englisch (${lang})`);
    await reiterOeffnen(page, 'news'); await page.waitForTimeout(900);
    const knoepfe = await page.$$eval('[data-ebenen="news"] [data-ebene]', (bs) => bs.map((b) => b.textContent.trim()));
    if (knoepfe.length !== 3 || !/Uganda/.test(knoepfe[0]) || !/Africa/.test(knoepfe[1]) || !/World/.test(knoepfe[2])) findings.push(`Afrika: News-Umschalter nicht „Uganda / Africa / World" (${knoepfe.join(' | ')})`);
    else {
      await page.click('[data-ebenen="news"] [data-ebene="region"]'); await page.waitForTimeout(900);
      const aktiv = await page.$eval('[data-ebenen="news"] [aria-selected="true"]', (b) => b.dataset.ebene).catch(() => null);
      if (aktiv !== 'region') findings.push('Afrika: Umschalter wechselt nicht auf Afrika');
      if (!(await page.locator('#newslist [data-ebeneleer], #newslist .card').count())) findings.push('Afrika: Afrika-Ebene ohne Inhalt oder Leer-Hinweis');
      if ((await quer()) > 0) findings.push(`Afrika: ${await quer()} px Querscrollen im News-Umschalter`);
    }
    await reiterOeffnen(page, 'shortages'); await page.waitForTimeout(900);
    const sk = page.locator('[data-ebenen="engpaesse"] [data-ebene="region"]');
    if (!(await sk.count())) findings.push('Afrika: Engpässe ohne Ebenen-Umschalter');
    else {
      await sk.click(); await page.waitForTimeout(900);
      const zeilen = await page.locator('[data-jeland] [data-elland]').count();
      if (zeilen < 18) findings.push(`Afrika: Engpasslage Afrika zeigt nur ${zeilen} Länder`);
      const ug = await page.locator('[data-elland="UG"]').innerText().catch(() => '');
      if (!/No official shortage list/.test(ug)) findings.push(`Afrika: fehlende Behördenliste nicht ehrlich benannt (${ug.slice(0, 60)})`);
      if ((await quer()) > 0) findings.push(`Afrika: ${await quer()} px Querscrollen in der Engpasslage`);
      await page.click('[data-elland="KE"]'); await page.waitForTimeout(1200);
      const ansicht = await page.evaluate(() => viewCountry());
      if (ansicht !== 'KE') findings.push(`Afrika: Antippen eines Landes öffnet es nicht (${ansicht})`);
    }
    for (const f of fehler) findings.push('Afrika: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Afrika'))) console.log('✓ Afrika: Uganda auf Englisch; neue Länder wählbar; News „Uganda / Africa / World"; Engpasslage Afrika mit 18 Ländern, „keine Liste" ehrlich, Land antippen öffnet es');
    await ctx.close();
  }

  // ── Vertrauensstufen: Apotheken-Meldung „noch nicht bestätigt" / „bestätigt" ──
  {
    const u = Date.now().toString(36);
    const reg = async (n) => (await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'VT ' + n, email: `vt${n}_${u}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'TZ' }) })).token;
    const [a, b2, c2] = [await reg('a'), await reg('b'), await reg('c')];
    const auth = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t }); // api() ersetzt headers ganz
    const m1 = await api('/api/shortages/report', { method: 'POST', headers: auth(a), body: JSON.stringify({ wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: 'TZ' }) });
    const m2 = await api('/api/shortages/report', { method: 'POST', headers: auth(a), body: JSON.stringify({ wirkstoff: 'Artemether', bezeichnung: 'Artemether/Lumefantrin', status: 'eingeschraenkt', country: 'TZ' }) });
    for (const t of [b2, c2]) await api(`/api/shortages/${m2.id}/confirm`, { method: 'POST', headers: auth(t) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_ebene_engpaesse', 'land'); }, b2);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    await reiterOeffnen(page, 'shortages'); await page.waitForTimeout(1000);
    const einzeln = await page.locator('[data-vertrauen="einzeln"]').first().innerText().catch(() => '');
    const best = await page.locator('[data-vertrauen="bestaetigt"]').first().innerText().catch(() => '');
    if (!m1 || !/not yet confirmed/.test(einzeln)) findings.push(`Vertrauen: einzelne Meldung ohne „not yet confirmed" (${einzeln})`);
    if (!m2 || !/Confirmed by 3 pharmacies/.test(best)) findings.push(`Vertrauen: bestätigte Meldung ohne „Confirmed by 3 pharmacies" (${best})`);
    for (const f of fehler) findings.push('Vertrauen: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Vertrauen'))) console.log('✓ Vertrauen: „1 pharmacy reports — not yet confirmed" und „Confirmed by 3 pharmacies (not official)" sichtbar');
    await ctx.close();
  }

  // ── Aktualität: „noch aktuell?" sichtbar, „Wieder lieferbar" wirkt ────────
  {
    const u = Date.now().toString(36);
    const tok = (await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'AK Apo', email: `ak_${u}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'ZM' }) })).token;
    const auth = { 'content-type': 'application/json', authorization: 'Bearer ' + tok };
    const m = await api('/api/shortages/report', { method: 'POST', headers: auth, body: JSON.stringify({ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 500 mg', status: 'kritisch', country: 'ZM' }) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_ebene_engpaesse', 'land'); }, tok);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    // Zustand „noch aktuell?" (Server-Uhr lässt sich hier nicht vorspulen): Karte direkt zeichnen.
    const k = await page.evaluate(() => { const c = shortageCard({ id: 'x', wirkstoff: 'Salbutamol', bezeichnung: 'Inhaler', status: 'kritisch', provenance: 'community', apotheken: 1, bestaetigt: false, aktualitaet: 'pruefen', tage_ohne_bestaetigung: 16, confirm_count: 0, country: 'ZM' }); return { text: (c.querySelector('[data-aktualitaet]') || {}).textContent || '', knopf: !!c.querySelector('[data-nochaktuell]') }; });
    if (!/16 days ago — still short\?/.test(k.text) || !k.knopf) findings.push(`Meldungs-Aktualität: „still short?" oder Knopf fehlt (${k.text})`);
    await reiterOeffnen(page, 'shortages'); await page.waitForTimeout(900);
    const wb = page.locator('[data-wiederlieferbar]').first();
    if (!m || !(await wb.count())) findings.push('Meldungs-Aktualität: Meldende sieht „Available again" nicht');
    else {
      await wb.click(); await page.waitForTimeout(900);
      const st = await page.evaluate(async (id) => { const r = await fetch('/api/shortages?country=ZM', { headers: { authorization: 'Bearer ' + localStorage.getItem('apo_token') } }); const d = await r.json(); return (d.shortages.find((s) => s.id === id) || {}).status; }, m.id);
      if (st !== 'verfuegbar') findings.push(`Meldungs-Aktualität: „Available again" setzt den Status nicht (${st})`);
    }
    for (const f of fehler) findings.push('Meldungs-Aktualität: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Meldungs-Aktualität'))) console.log('✓ Meldungs-Aktualität: „Last confirmed 16 days ago — still short?" mit Knopf; „Available again" der Meldenden setzt den Status');
    await ctx.close();
  }

  // ── Warnungen: Filter „Nur Warnungen" schaltet und erklärt leere Ergebnisse ──
  {
    const neu = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Warn Apo', email: `wn_${Date.now().toString(36)}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'NG' }) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.removeItem('apo_news_warnungen'); }, neu && neu.token);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    await reiterOeffnen(page, 'news'); await page.waitForTimeout(800);
    const f = page.locator('[data-nurwarnungen]');
    if (!(await f.count())) findings.push('Warnungen: Filter-Knopf fehlt');
    else {
      if (!/falsified medicines and recalls/.test(await f.innerText())) findings.push('Warnungen: Filter nicht in Klartext');
      await f.click(); await page.waitForTimeout(900);
      const an = await page.locator('[data-nurwarnungen]').getAttribute('aria-pressed');
      if (an !== 'true') findings.push('Warnungen: Filter schaltet nicht ein');
      if (!(await page.locator('[data-warnleer], [data-warnung]').count())) findings.push('Warnungen: weder Treffer noch erklärender Leer-Hinweis');
    }
    for (const e of fehler) findings.push('Warnungen: JS-Fehler ' + e);
    if (!findings.some((x) => x.startsWith('Warnungen'))) console.log('✓ Warnungen: Filter „Warnings only" in Klartext, schaltet, erklärt leere Ergebnisse');
    await ctx.close();
  }

  // ── Offline lesbar: letzter Stand mit Zeitpunkt, je Konto getrennt, Abmelden löscht ──
  //  Eigener Server, der danach BEENDET wird: Das ist ein echter Netzausfall.
  //  setOffline/route aus Playwright erreichen die Anfragen des Service
  //  Workers nicht — damit lief die erste Fassung dieser Prüfung gegen das
  //  laufende Netz und bewies nichts.
  {
    const proc = spawn(process.execPath, ['src/http/server.js'], { cwd: SERVER_ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '0', APOPULSE_DATA_FILE: '', APOPULSE_TOKEN_SECRET: 'offline-audit', APOPULSE_PRESSE: 'aus' } });
    let log = '';
    const OB = await new Promise((ok) => {
      const zeit = setTimeout(() => ok(null), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(`http://localhost:${m[1]}`); } };
      proc.stdout.on('data', lies); proc.stderr.on('data', lies);
    });
    const ende = () => new Promise((ok) => { if (proc.exitCode !== null) return ok(); proc.once('exit', ok); proc.kill(); });
    if (!OB) { findings.push('Offline: eigener Prüfserver startet nicht'); await ende(); }
    else {
      const oapi = async (pfad, opt = {}) => (await fetch(OB + pfad, { ...opt, headers: { 'content-type': 'application/json', ...(opt.headers || {}) } })).json().catch(() => null);
      const u = Date.now().toString(36);
      const regA = await oapi('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Off A', email: `offa_${u}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'ZM' }) });
      const regB = await oapi('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Off B', email: `offb_${u}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'ZM' }) });
      await oapi('/api/shortages/report', { method: 'POST', headers: { authorization: 'Bearer ' + regA.token }, body: JSON.stringify({ wirkstoff: 'Ceftriaxone', bezeichnung: 'Ceftriaxone 1 g', status: 'kritisch', country: 'ZM' }) });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
      const page = await ctx.newPage();
      const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
      await page.addInitScript(() => { localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_ebene_engpaesse', 'land'); });
      await page.goto(OB, { waitUntil: 'networkidle' });
      await page.evaluate((t) => localStorage.setItem('apo_token', t), regA.token);
      await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
      await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
      const kontrolliert = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
      if (!kontrolliert) findings.push('Offline: Service Worker übernimmt die Seite nicht');
      await reiterOeffnen(page, 'shortages'); await page.waitForTimeout(1500);
      const online = await page.locator('[data-shortlist]').innerText().catch(() => '');
      if (!/Ceftriaxone/.test(online)) findings.push('Offline: Vorbedingung — Meldung online nicht sichtbar');
      if (await page.locator('#offlineBanner').isVisible()) findings.push('Offline: Hinweis steht schon, obwohl online');
      const schluessel = await page.evaluate(async () => (await (await caches.open('apopulse-api-v1')).keys()).map((r) => r.url));
      if (!schluessel.length || schluessel.some((k) => !/__konto=[0-9a-f]{64}/.test(k))) findings.push('Offline: Speicher-Schlüssel ohne Konto-Hash');
      if (schluessel.some((k) => k.includes(regA.token))) findings.push('Offline: Anmelde-Token steht im Speicher-Schlüssel');
      await ende(); // Netz weg.
      await page.evaluate(() => goTab('shortages')); await page.waitForTimeout(1500);
      const liste = await page.locator('[data-shortlist]').innerText().catch(() => '');
      const banner = await page.locator('#offlineBanner').innerText().catch(() => '');
      if (!/Ceftriaxone/.test(liste)) findings.push('Offline: gespeicherte Engpassliste wird nicht gezeigt');
      if (!/Offline — saved data from/.test(banner) || !(await page.locator('#offlineBanner').isVisible())) findings.push(`Offline: Hinweis mit Zeitpunkt fehlt (${banner.slice(0, 60)})`);
      // Anderes Konto auf demselben Gerät: sieht NICHT den Stand von A.
      await page.evaluate((t) => localStorage.setItem('apo_token', t), regB.token);
      await page.evaluate(() => goTab('shortages')); await page.waitForTimeout(1200);
      if (/Ceftriaxone/.test(await page.locator('#feed').innerText().catch(() => ''))) findings.push('Offline: zweites Konto sieht den gespeicherten Stand des ersten');
      // Abmelden löscht den Speicher (derselbe Weg wie der Abmelde-Knopf).
      await page.evaluate(() => offlineSpeicherLeeren());
      if (await page.evaluate(() => caches.has('apopulse-api-v1'))) findings.push('Offline: Abmelden löscht den gespeicherten Stand nicht');
      for (const f of fehler) findings.push('Offline: JS-Fehler ' + f);
      if (!findings.some((f) => f.startsWith('Offline'))) console.log('✓ Offline: echter Netzausfall → Liste aus gespeichertem Stand mit „Offline — saved data from …"; Schlüssel je Konto gehasht; anderes Konto sieht nichts; Abmelden löscht');
      await ctx.close();
    }
  }

  // ── Bilder per Adresse: Feed ohne eingebettete Bilder, Bilder werden trotzdem angezeigt ──
  //  Vorher stand jedes Bild (und das Profilbild in JEDEM Beitrag) als base64 in
  //  der Antwort. Geprüft wird, dass der Browser die Adresse wirklich lädt.
  {
    const { readFileSync } = await import('node:fs');
    const png = 'data:image/png;base64,' + readFileSync(path.join(SERVER_ROOT, 'public', 'icon-192.png')).toString('base64');
    const u = Date.now().toString(36);
    const reg = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Bild Apo', email: `bild_${u}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'UG' }) });
    const H = { 'content-type': 'application/json', authorization: 'Bearer ' + reg.token };
    await api('/api/profile', { method: 'POST', headers: H, body: JSON.stringify({ avatarUrl: png }) });
    await api('/api/posts', { method: 'POST', headers: H, body: JSON.stringify({ body: `BILDPRUEF ${u}`, visibility: 'public', image: png }) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    let feedRoh = '';
    page.on('response', async (r) => { if (/\/api\/feed\//.test(r.url())) feedRoh += await r.text().catch(() => ''); });
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, reg.token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'public'); await page.waitForTimeout(1500);
    // Die Karte des Prüfbeitrags: der nächste .card um seinen Text.
    const karte = page.locator('[data-body]', { hasText: `BILDPRUEF ${u}` }).first().locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " card ")][1]');
    if (!(await karte.count())) findings.push('Bilder: Prüfbeitrag erscheint nicht im Feed');
    else {
      await karte.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
      // img[src]: die versteckte Vorschau für Kommentarbilder hat noch kein Bild.
      const bilder = await karte.locator('img[src]').evaluateAll((els) => els.map((e) => ({ src: e.getAttribute('src') || '', ok: e.complete && e.naturalWidth > 0, lazy: e.getAttribute('loading') })));
      if (bilder.length < 2) findings.push(`Bilder: Beitragsbild oder Profilbild fehlt (${bilder.length} Bilder)`);
      for (const b of bilder) {
        if (!/^\/api\/bild\/[0-9a-f]{64}$/.test(b.src)) findings.push(`Bilder: Bild nicht per Adresse (${b.src.slice(0, 30)})`);
        if (!b.ok) findings.push(`Bilder: Bild wird nicht angezeigt (${b.src.slice(0, 40)})`);
      }
      if (!bilder.some((b) => b.lazy === 'lazy')) findings.push('Bilder: Beitragsbild lädt nicht erst beim Hinscrollen');
    }
    if (!feedRoh) findings.push('Bilder: Feed-Antwort nicht mitgelesen');
    else if (feedRoh.includes('data:image')) findings.push('Bilder: Feed-Antwort enthält eingebettete Bilder');
    for (const f of fehler) findings.push('Bilder: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Bilder'))) console.log('✓ Bilder: Feed ohne eingebettete Bilder; Beitragsbild und Profilbild per Adresse geladen und sichtbar, erst beim Hinscrollen');
    await ctx.close();
  }

  // ── Einladen & um Bestätigung bitten: Meldung → WhatsApp-Link → neue Kollegin → „Bestätigen" ──
  //  Ohne Behördenliste (große Teile Afrikas) zählt jede Apotheke. Geprüft wird
  //  der ganze Weg, den eine einzelne Meldung bis zur Bestätigung braucht.
  {
    const u = Date.now().toString(36);
    const W = `Oxytocin ${u}`;
    const regA = await api('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Kampala Apo', email: `eia_${u}@ex.com`, password: 'Passwort123!', accountType: 'pharmacy', country: 'UG' }) });
    await api('/api/shortages/report', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + regA.token }, body: JSON.stringify({ wirkstoff: W, bezeichnung: W + ' 10 IU', status: 'kritisch', country: 'UG' }) });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); localStorage.setItem('apo_ebene_engpaesse', 'land'); }, regA.token);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await reiterOeffnen(page, 'shortages'); await page.waitForTimeout(1500);
    const knopf = page.locator('[data-bestaetigenbitten]').first();
    let link = '';
    if (!(await knopf.count())) findings.push('Einladen: Meldende sieht keinen Knopf „Ask colleagues to confirm"');
    else {
      if (!/Ask colleagues to confirm/.test(await knopf.innerText())) findings.push('Einladen: Knopf nicht in Klartext');
      if ((await knopf.boundingBox()).height < 44) findings.push('Einladen: Knopf kleiner als 44 px');
      await knopf.click(); await page.waitForTimeout(700);
      const wa = await page.locator('#teilBlatt a[href^="https://wa.me/"]').getAttribute('href').catch(() => null);
      if (!wa) findings.push('Einladen: kein WhatsApp-Weg im Teilen-Blatt');
      else {
        const text = decodeURIComponent(wa.split('text=')[1] || '');
        if (!/confirm it on ApoPulse/.test(text)) findings.push('Einladen: Nachricht bittet nicht um Bestätigung');
        link = (text.match(/https?:\/\/\S+/) || [''])[0];
        if (!/\/teilen\/w\/UG\/.+[?&]e=[A-Za-z0-9_-]{8}$/.test(link)) findings.push(`Einladen: Link ohne Einladungs-Code (${link.slice(0, 80)})`);
      }
    }
    // Menüpunkt mit Zähler
    await page.evaluate(() => openEinladen()); await page.waitForTimeout(800);
    if (!/Nobody has joined through your link yet/.test(await page.locator('[data-einladen]').innerText().catch(() => ''))) findings.push('Einladen: Seite zeigt den Zähler nicht');
    await ctx.close();
    if (link) {
      // Die Kollegin öffnet den Link aus WhatsApp: Teilseite → Knopf → App → Konto anlegen.
      const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const pb = await ctxB.newPage();
      pb.on('pageerror', (e) => fehler.push('B: ' + e.message));
      await pb.addInitScript(() => { localStorage.setItem('apo_welcome_seen', '1'); });
      await pb.goto(link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'networkidle' });
      const cta = pb.locator('a.b');
      if (!/Confirm .* in ApoPulse/.test(await cta.innerText().catch(() => ''))) findings.push('Einladen: Teilseite bittet nicht um Bestätigung');
      await cta.click(); await pb.waitForLoadState('networkidle'); await pb.waitForTimeout(600);
      if (!(await pb.evaluate(() => localStorage.getItem('apo_einladung')))) findings.push('Einladen: App merkt sich den Einladungs-Code nicht');
      await pb.fill('#rg_name', 'Entebbe Pharmacy'); await pb.fill('#rg_email', `eib_${u}@ex.com`); await pb.fill('#rg_pw', 'Passwort123!');
      await pb.click('#rg_go'); await pb.waitForTimeout(1400);
      if (await pb.locator('#rc_done').count()) { await pb.click('#rc_done'); await pb.waitForTimeout(1500); }
      const karte = pb.locator('[data-shortlist] .card', { hasText: W }).first();
      if (!(await karte.count())) findings.push('Einladen: Nach der Registrierung nicht bei der Meldung gelandet');
      else if (!(await karte.locator('[data-confirm]').count())) findings.push('Einladen: Bei der Meldung fehlt „Bestätigen"');
      else {
        await karte.locator('[data-confirm]').click(); await pb.waitForTimeout(900);
        const st = await api('/api/shortages?country=UG', { headers: { authorization: 'Bearer ' + regA.token } });
        const m = ((st && st.shortages) || []).find((x) => x.wirkstoff === W);
        if (!m || m.apotheken !== 2) findings.push(`Einladen: Bestätigung kam nicht an (${m && m.apotheken} Apotheken)`);
      }
      const ei = await api('/api/einladung', { headers: { authorization: 'Bearer ' + regA.token } });
      if (!ei || ei.beigetreten !== 1) findings.push(`Einladen: Konto nicht der Einladenden zugeordnet (${ei && ei.beigetreten})`);
      const nf = await api('/api/notifications', { headers: { authorization: 'Bearer ' + regA.token } });
      if (!((nf && nf.notifications) || []).some((n) => n.type === 'einladung')) findings.push('Einladen: Einladende wird nicht benachrichtigt');
      await ctxB.close();
    }
    for (const f of fehler) findings.push('Einladen: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Einladen'))) console.log('✓ Einladen: „Ask colleagues to confirm" → WhatsApp-Link mit Code → Teilseite „Confirm … in ApoPulse" → Konto → direkt bei der Meldung bestätigt; Einladende sieht 1 neue Kollegin');
  }

  // ── Registrierung im Browser: kurz, und ein Fehler verbrennt nichts ──────
  //  Bis 10/2026: sechs Felder (Pflicht-@Handle, Land doppelt), zwei Formulare
  //  untereinander — und ein vergebener Handle machte die E-Mail unbrauchbar.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', '1'); } localStorage.setItem('apo_country', 'AT'); localStorage.setItem('apo_welcome_seen', '1'); });
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    const felder = await page.$$eval('[data-authpane="register"] input, [data-authpane="register"] select', (els) => els.filter((e) => e.offsetParent).map((e) => e.id));
    if (!(await page.locator('#rg_name').isVisible())) findings.push('Registrierung: Neue Besucher sehen nicht zuerst „Konto erstellen"');
    if (await page.locator('#li_email').isVisible()) findings.push('Registrierung: Anmelde- und Registrierformular gleichzeitig sichtbar');
    if (felder.length > 4) findings.push(`Registrierung: ${felder.length} Felder (${felder.join(', ')}) — Land und Handle gehören nicht hinein`);
    const mail = `ui_${Date.now().toString(36)}@reg.test`;
    await page.fill('#rg_name', 'Jürgen Müller'); await page.fill('#rg_email', mail); await page.fill('#rg_pw', 'Passwort123!');
    await page.click('#rg_go'); await page.waitForTimeout(1200);
    if (await page.locator('#rc_done').count()) { await page.click('#rc_done'); await page.waitForTimeout(1000); }
    const drin = await page.evaluate(() => fetch('/api/me', { headers: { authorization: 'Bearer ' + localStorage.getItem('apo_token') } }).then((r) => r.json()).catch(() => ({})));
    if (!drin.profile || !/^juergen_mueller/.test(drin.profile.handle)) findings.push(`Registrierung im Browser: kein Profil oder Handle nicht aus dem Namen (${drin.profile && drin.profile.handle})`);
    // Gleiche E-Mail noch einmal: führt zur Anmeldung, E-Mail übernommen.
    await page.evaluate(() => { localStorage.removeItem('apo_token'); localStorage.removeItem('apo_konto_bekannt'); });
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.fill('#rg_name', 'Jürgen Müller'); await page.fill('#rg_email', mail); await page.fill('#rg_pw', 'Passwort123!');
    await page.click('#rg_go'); await page.waitForTimeout(800);
    const umgeleitet = await page.evaluate((m) => document.getElementById('li_email')?.offsetParent && document.getElementById('li_email').value === m, mail);
    if (!umgeleitet) findings.push('Registrierung: bei bekannter E-Mail kein Wechsel zur Anmeldung mit übernommener Adresse');
    for (const f of fehler) findings.push('Registrierung: JS-Fehler ' + f);
    if (!findings.some((f) => f.startsWith('Registrierung'))) console.log(`✓ Registrierung: ${felder.length} Felder, Handle aus dem Namen (${drin.profile.handle}), bekannte E-Mail führt zur Anmeldung`);
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
    console.log('✓ Kein Querscroll (Mobil + Tablet/Laptop-Breiten + große Schrift + Detailseite), keine JS-Fehler, keine a11y-Lücken auf allen Reitern der Reiterleiste (hell + dunkel).');
  } else {
    console.log(`⚠️ ${findings.length} Befund(e):`);
    findings.forEach((f) => console.log('  - ' + f));
    process.exitCode = 1;
  }
}
main();
