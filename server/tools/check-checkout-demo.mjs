#!/usr/bin/env node
// ============================================================================
//  Checkout-Demo im Browser prüfen
// ============================================================================
//  Die Datei baut sauber — das heißt nicht, dass sie funktioniert. Hier wird
//  die erzeugte Seite tatsächlich geöffnet und bedient:
//
//   · Wechselt der Modus beim Länderwechsel wirklich?
//   · Verschwindet der Krypto-Reiter irgendwo? (darf nie)
//   · Erscheint das FDA-Feld nur in den USA?
//   · Sperrt eine fehlende Pflichtangabe das Bezahlen?
//   · Ist der QR-Code echt gerendert und decodierbar groß?
//   · Kein Querscroll, Trefferflächen groß genug, Dunkelmodus tragfähig?
//
//  Aufruf:  node tools/check-checkout-demo.mjs
// ============================================================================

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'public', 'checkout-demo.html');

async function loadChromium() {
  const pick = (mod) => mod?.chromium ?? mod?.default?.chromium;
  try {
    const found = pick(await import('playwright'));
    if (found) return found;
  } catch { /* nicht installiert */ }
  try {
    const found = pick(await import('/opt/node22/lib/node_modules/playwright/index.js'));
    if (found) return found;
  } catch { /* auch nicht global */ }
  console.error('✗ Playwright nicht gefunden.');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  const chromium = await loadChromium();
  const html = readFileSync(PAGE);

  // Eigener Server statt file:// — sonst greifen weder Schriftarten noch
  // strenge Sicherheitsvorgaben so wie später im Betrieb.
  const srv = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
  const page = await ctx.newPage();
  // Schriftarten kommen von Google Fonts. In einer abgeschotteten Umgebung
  // schlägt dieser Aufruf fehl — das ist ein Umgebungsbefund, kein Seitenfehler,
  // und die Ersatzschriften greifen. Deshalb wird er getrennt gezählt statt
  // pauschal ignoriert: ein ECHTER Ladefehler würde sonst mit untergehen.
  const errors = [];
  const fontFailures = [];
  const isFontHost = (url) => /fonts\.(googleapis|gstatic)\.com/.test(url);

  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => {
    if (isFontHost(r.url())) fontFailures.push(r.url());
    else errors.push('request: ' + r.url().slice(0, 90));
  });
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() !== 'error') return;
    // Die Begleitmeldung zum fehlgeschlagenen Schrift-Aufruf trägt keine URL.
    if (/Failed to load resource/.test(text) && fontFailures.length > 0) return;
    errors.push('console: ' + text.slice(0, 140));
  });

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // --- 1. Grundzustand: Österreich ------------------------------------------
  check('Seite lädt ohne Skriptfehler', errors.length === 0, errors[0] || '');
  check('Startzustand ist SAAS_ONLY', (await page.locator('[data-testid="s-mode"]').innerText()) === 'SAAS_ONLY');
  check('Startwährung ist EUR', (await page.locator('[data-testid="s-currency"]').innerText()) === 'EUR');
  check('Gebührenmodell ist die Pauschale', (await page.locator('[data-testid="s-fee"]').innerText()) === 'SAAS_FLAT');

  const atFiat = await page.locator('[data-testid="s-fiat"] li').allInnerTexts();
  check('Österreich zeigt SEPA', atFiat.join(' ').includes('SEPA'), atFiat.join(' | ').slice(0, 60));

  // --- 2. Das Krypto-Gebot ---------------------------------------------------
  const countries = await page.locator('[data-testid="page-country"] option').evaluateAll((os) => os.map((o) => o.value));
  check('Alle Länder mit Profil stehen zur Wahl', countries.length === 16, `${countries.length} Länder`);

  // Wichtig: mitzählen. Eine leere Schleife würde sonst „bestanden" melden,
  // ohne irgendetwas geprüft zu haben — genau das ist beim ersten Lauf passiert,
  // als die Länderliste wegen eines Build-Fehlers leer war.
  let cryptoEverywhere = true;
  let cryptoMissing = '';
  let visited = 0;
  for (const code of countries) {
    await page.selectOption('[data-testid="page-country"]', code);
    await page.waitForTimeout(60);
    visited++;
    const n = await page.locator('[data-testid="s-crypto"] li').count();
    if (n !== 6) { cryptoEverywhere = false; cryptoMissing = `${code}: ${n} Methoden`; break; }
  }
  check('Krypto steht in JEDEM Land (6 Methoden)',
    cryptoEverywhere && visited === 16, cryptoMissing || `${visited} Länder geprüft`);

  // --- 3. Länderwechsel schaltet um -----------------------------------------
  await page.selectOption('[data-testid="page-country"]', 'AO');
  await page.waitForTimeout(120);
  check('Angola: Marktplatz-Modus', (await page.locator('[data-testid="s-mode"]').innerText()) === 'MARKETPLACE_FEES');
  check('Angola: Währung AOA', (await page.locator('[data-testid="s-currency"]').innerText()) === 'AOA');
  const aoFiat = (await page.locator('[data-testid="s-fiat"]').innerText()).replace(/\s+/g, ' ');
  check('Angola: Multicaixa im Angebot', /Multicaixa/.test(aoFiat), aoFiat.slice(0, 60));

  await page.selectOption('[data-testid="page-purpose"]', 'marketplace_order');
  await page.waitForTimeout(120);
  check('Angola: Provision statt Pauschale',
    (await page.locator('[data-testid="s-fee"]').innerText()) === 'COMMISSION_FEE');

  // Der interessante Übergang: Land wechseln, während ein unmöglicher Zweck aktiv ist.
  await page.selectOption('[data-testid="page-country"]', 'DE');
  await page.waitForTimeout(150);
  const notes = (await page.locator('[data-testid="s-notes"]').innerText()).replace(/\s+/g, ' ');
  check('Deutschland: wieder SAAS_ONLY', (await page.locator('[data-testid="s-mode"]').innerText()) === 'SAAS_ONLY');
  check('Deutschland: keine Provision', (await page.locator('[data-testid="s-fee"]').innerText()) === 'SAAS_FLAT');
  check('Zweck wird sichtbar korrigiert', /Zweck angepasst/.test(notes), notes.slice(0, 70));

  await page.selectOption('[data-testid="page-country"]', 'PT');
  await page.waitForTimeout(120);
  check('Portugal: MB WAY im Angebot',
    /MB WAY/.test(await page.locator('[data-testid="s-fiat"]').innerText()));

  await page.selectOption('[data-testid="page-country"]', 'KE');
  await page.waitForTimeout(120);
  check('Kenia: M-Pesa im Angebot',
    /M-Pesa/.test(await page.locator('[data-testid="s-fiat"]').innerText()));

  // --- 4. Modal --------------------------------------------------------------
  await page.selectOption('[data-testid="page-country"]', 'US');
  await page.waitForTimeout(120);
  await page.click('[data-testid="open-checkout"]');
  await page.waitForTimeout(300);
  check('Kasse öffnet als Dialog', await page.locator('[data-testid="checkout"]').isVisible());
  check('Kasse zeigt die Landeswährung',
    (await page.locator('[data-testid="co-currency"]').innerText()) === 'USD');

  const usFields = await page.locator('[data-testid="co-fields"] input').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-field')));
  check('USA: FDA-Nummer wird abgefragt', usFields.includes('fda_registration'), usFields.join(','));

  // Pflichtfeld leer -> Bezahlen gesperrt
  check('Fehlende Pflichtangabe sperrt das Bezahlen',
    await page.locator('[data-testid="co-pay"]').isDisabled());
  const blockedText = await page.locator('[data-testid="co-blocked"]').innerText();
  check('Es wird benannt, was fehlt', /FDA/.test(blockedText), blockedText.slice(0, 60));

  // Falsches Format -> weiterhin gesperrt, mit Begründung
  await page.fill('#field-fda_registration', 'ABC');
  await page.waitForTimeout(150);
  const formatErr = await page.locator('[data-error-for="fda_registration"]').innerText();
  check('Falsches Format wird erklärt', /Format stimmt nicht/.test(formatErr), formatErr.slice(0, 50));

  await page.fill('#field-fda_registration', '3001234567');
  await page.waitForTimeout(200);
  check('Gültige Nummer gibt das Bezahlen frei',
    await page.locator('[data-testid="co-pay"]').isEnabled());

  // Land im Modal wechseln -> Seite zieht mit (ein Zustand, zwei Ansichten)
  await page.selectOption('[data-testid="co-country"]', 'CH');
  await page.waitForTimeout(200);
  check('Länderwechsel im Modal wirkt auf die Seite',
    (await page.locator('[data-testid="page-country"]').inputValue()) === 'CH');
  check('Schweiz rechnet in CHF',
    (await page.locator('[data-testid="co-currency"]').innerText()) === 'CHF');
  const chFields = await page.locator('[data-testid="co-fields"] input').count();
  check('FDA-Feld verschwindet außerhalb der USA', chFields === 0, `${chFields} Felder`);

  // --- 5. Krypto-Reiter -------------------------------------------------------
  await page.click('[data-testid="tab-crypto"]');
  await page.waitForTimeout(250);
  check('Krypto-Reiter lässt sich öffnen',
    (await page.locator('[data-testid="tab-crypto"]').getAttribute('aria-selected')) === 'true');

  // Angeboten wird nur, wofür auch eine Empfangsadresse hinterlegt ist —
  // die Liste stammt aus cryptoWallets.js, nicht aus einer zweiten Aufzählung.
  const assets = await page.locator('[data-testid="co-assets"] button').allInnerTexts();
  const assetText = assets.join(' | ');
  check('Alle hinterlegten Werte stehen bereit', assets.length === 6, assetText);
  for (const want of ['USDT', 'USDC', 'Bitcoin', 'Ethereum', 'Solana', 'WalletConnect']) {
    check(`  · ${want} wählbar`, assetText.includes(want));
  }

  const qrSvg = await page.locator('[data-testid="qr-plate"] svg').count();
  check('QR-Code ist gerendert', qrSvg === 1);

  const qrInfo = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="qr-plate"] svg');
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const path = svg.querySelector('path');
    // Anzahl der Module grob aus der Pfadlänge: jedes dunkle Modul ist ein "M…z".
    const modules = (path?.getAttribute('d') || '').split('M').length - 1;
    return { w: Math.round(box.width), h: Math.round(box.height), modules };
  });
  check('QR hat echte Module (kein leeres Bild)', (qrInfo?.modules ?? 0) > 100, `${qrInfo?.modules} Module`);
  check('QR ist groß genug zum Scannen', (qrInfo?.w ?? 0) >= 140, `${qrInfo?.w}×${qrInfo?.h} px`);

  const address = await page.locator('[data-testid="wallet-address"]').innerText();
  check('Empfangsadresse steht im Klartext daneben', /^bc1|^0x|^[1-9A-HJ-NP-Za-km-z]{32,}/.test(address.trim()),
    address.trim().slice(0, 28) + '…');

  // --- Die echten Wallets des Betreibers -------------------------------------
  // USDC läuft über Ethereum ODER Solana — und dort gibt es ZWEI Wallets
  // (Seeker und Phantom). Beide müssen einzeln wählbar sein, so ist das
  // Datenmodell in cryptoWallets.js ausdrücklich angelegt.
  await page.click('[data-testid="co-assets"] button:has-text("USDC")');
  await page.waitForTimeout(250);
  const usdcNets = (await page.locator('[data-testid="co-networks"]').innerText()).replace(/\s+/g, ' ');
  check('USDC: Ethereum und Solana stehen zur Wahl',
    /Ethereum/.test(usdcNets) && /Solana/.test(usdcNets), usdcNets.slice(0, 70));
  check('Beide Solana-Wallets sind unterscheidbar',
    /Seeker/.test(usdcNets) && /Phantom/.test(usdcNets), usdcNets.slice(0, 90));

  const usdcRoutes = await page.locator('[data-testid="co-networks"] input[name="network"]').count();
  check('Keine Empfangsadresse ist ausgegraut', 
    (await page.locator('[data-testid="co-networks"] input[disabled]').count()) === 0,
    `${usdcRoutes} Wege`);

  // Auf die Phantom-Wallet umschalten und prüfen, dass die Adresse wirklich wechselt.
  const addrBefore = (await page.locator('[data-testid="wallet-address"]').innerText()).trim();
  await page.locator('[data-testid="co-networks"] label:has-text("Phantom") input').check();
  await page.waitForTimeout(250);
  const addrAfter = (await page.locator('[data-testid="wallet-address"]').innerText()).trim();
  check('Wallet-Wahl ändert die Empfangsadresse', addrBefore !== addrAfter,
    addrAfter.slice(0, 24) + '…');

  check('Herkunft der Adressen wird ausgewiesen',
    /Adressen:/.test(await page.locator('[data-testid="route-source"]').innerText()),
    (await page.locator('[data-testid="route-source"]').innerText()).slice(0, 40));

  // Token-Warnung: falscher Token auf der richtigen Kette ist der teuerste Fehler.
  const noteText = (await page.locator('[data-testid="co-crypto-detail"]').innerText()).replace(/\s+/g, ' ');
  check('Token-Warnung steht am Weg', /geht verloren/.test(noteText), noteText.slice(0, 70));

  // Zurück auf Bitcoin für die folgenden Prüfungen.
  await page.click('[data-testid="co-assets"] button:has-text("Bitcoin")');
  await page.waitForTimeout(200);

  // Krypto darf auch im strengsten Land nicht verschwinden.
  await page.selectOption('[data-testid="co-country"]', 'DE');
  await page.waitForTimeout(250);
  check('Krypto-Reiter bleibt auch in Deutschland',
    await page.locator('[data-testid="tab-crypto"]').isVisible());
  check('Krypto-Reiter trägt den Dauer-Hinweis',
    /immer/i.test(await page.locator('[data-testid="tab-crypto"]').innerText()));

  // --- 6. Layout und Bedienbarkeit -------------------------------------------
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check('Kein Querscroll bei 390px', !overflow);

  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(`Kein Querscroll bei ${width}px`, !wide);
  }

  const small = await page.evaluate(() => {
    // Gemessen wird die TREFFERFLÄCHE, nicht das Steuerelement: ein 20-px-Radio
    // in einem 48-px-Label ist bequem zu treffen — die Fläche des Labels zählt,
    // weil ein Klick darauf das Radio auslöst.
    const hitBox = (el) => {
      const label = el.closest('label');
      return (label || el).getBoundingClientRect();
    };
    return [...document.querySelectorAll('button, select, a, input[type="radio"], input[type="text"]')]
      .filter((el) => {
        const r = hitBox(el);
        return r.height > 0 && r.width > 0 && r.height < 44;
      })
      .map((el) => (el.getAttribute('data-testid') || el.textContent || el.type || '').trim().slice(0, 22));
  });
  check('Trefferflächen ≥ 44px hoch', small.length === 0, small.slice(0, 4).join(' | '));

  // --- 7. Themes --------------------------------------------------------------
  const themes = await page.evaluate(() => {
    const read = () => {
      const card = document.querySelector('.card');
      return {
        body: getComputedStyle(document.body).backgroundColor,
        card: card ? getComputedStyle(card).backgroundColor : '',
        text: getComputedStyle(document.body).color,
      };
    };
    document.documentElement.dataset.theme = 'light';
    const light = read();
    document.documentElement.dataset.theme = 'dark';
    const dark = read();
    document.documentElement.dataset.theme = 'light';
    return { light, dark };
  });
  check('Dunkelmodus kippt die Fläche', themes.light.body !== themes.dark.body,
    `${themes.light.body} → ${themes.dark.body}`);
  check('Dunkelmodus kippt auch Karten und Text',
    themes.light.card !== themes.dark.card && themes.light.text !== themes.dark.text);
  check('Body hat eine eigene Fläche (nicht durchsichtig)',
    !/transparent|rgba\(0, 0, 0, 0\)/.test(themes.light.body), themes.light.body);

  check('Weiterhin keine Skriptfehler', errors.length === 0, errors.slice(0, 2).join(' | '));
  if (fontFailures.length > 0) {
    console.log(`  … Hinweis: Google Fonts nicht erreichbar (${fontFailures.length} Aufrufe) — ` +
      'die Ersatzschriften greifen. In der Artifact-Umgebung ist dieser Host zugelassen.');
  }

  await ctx.close();
  await browser.close();
  srv.close();

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(failed.length === 0
    ? `✓ Alle ${results.length} Prüfungen bestanden.`
    : `✗ ${failed.length} von ${results.length} Prüfungen fehlgeschlagen.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
