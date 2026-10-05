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
  await page.click(`.tabs button[data-tab="${tab}"]`).catch(() => {});
}

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
    const reiter = await reiterLesen(page, findings, theme);
    for (const { tab, label } of reiter) {
      await reiterOeffnen(page, tab);
      await page.waitForTimeout(450);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) findings.push(`Querscroll: ${label || tab} [${theme}]`);
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
    ];
    let geprueft = 0;
    for (const [id, sel, name] of erwartet) {
      if (!ruht.has(id)) continue;
      geprueft++;
      const da = await page.locator(sel).count();
      if (da > 0) findings.push(`${name} ist sichtbar, obwohl "${id}" ruht`);
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
      await page.click(`.tabs button[data-tab="${tab}"]`).catch(() => {});
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
    await page.click('.tabs button[data-tab="signals"]').catch(() => {});
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
      await page.click('.tabs button[data-tab="signals"]').catch(() => {});
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
    await page.click('.tabs button[data-tab="signals"]').catch(() => {});
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
    await page2.click('.tabs button[data-tab="signals"]').catch(() => {});
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
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

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
    await page.addInitScript((t) => { localStorage.setItem('apo_token', t); localStorage.setItem('apo_welcome_seen', '1'); }, token);
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
    await page.click('.tabs button[data-tab="signals"]').catch(() => {});
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
    if (errors.length) findings.push(`Säule 3: JS-Fehler — ${errors.slice(0, 2).join(' | ')}`);
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
