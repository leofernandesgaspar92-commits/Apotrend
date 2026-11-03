// B2B-Benachrichtigungen (Proforma-Anfrage/-Antwort, Frühwarnung, neue Zulassung): Der Server
// speichert Rohdaten im Label. Bis 11/2026 standen die so in der Liste —
// „Paracetamol · in_bearbeitung", „amoxicillin · AFRICA · 5", „Titel ·".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ANFRAGE_STATUS } from '../src/services/sourcing.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/http/server.js', import.meta.url), 'utf8');
const I = (() => { const c = {}; vm.runInNewContext(readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8') + ';__I=I18N', c); return c.__I; })();

function b2bLabel(sp, dir = sp === 'ar' ? 'rtl' : 'ltr') {
  const start = app.indexOf('function b2bLabel(type, label) {');
  assert.ok(start > 0, 'b2bLabel nicht gefunden');
  const ende = app.indexOf('\n}\n', start) + 3;
  const T = I[sp];
  const ctx = {
    t: (k) => T[k] || k, ti: (k, v) => (T[k] || k).replace(/\{(\w+)\}/g, (m, x) => v[x]),
    landName: (cc) => new Intl.DisplayNames([sp], { type: 'region' }).of(cc),
    document: { documentElement: { dir } },
  };
  const pf = app.indexOf('function richtungsPfeil() {');
  assert.ok(pf > 0, 'richtungsPfeil nicht gefunden');
  vm.createContext(ctx); vm.runInContext(app.slice(pf, app.indexOf('\n', pf)) + '\n' + app.slice(start, ende) + ';globalThis.f = b2bLabel;', ctx);
  return ctx.f;
}

test('Proforma-Antwort: Status in Klartext, in allen 5 Sprachen und für jeden Status', () => {
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const f = b2bLabel(sp);
    for (const st of ANFRAGE_STATUS) {
      const aus = f('sourcing_antwort', `Paracetamol 500 · ${st}`);
      assert.equal(aus, `Paracetamol 500 · ${I[sp]['sc5_st_' + st]}`, `${sp}/${st}`);
      assert.doesNotMatch(aus, /_/, `${sp}: Code sichtbar`);
    }
  }
  assert.equal(b2bLabel('en')('sourcing_antwort', 'Paracetamol · in_bearbeitung'), 'Paracetamol · In progress');
  // Der Server baut das Label wirklich so.
  assert.match(server, /type: 'sourcing_antwort'[^\n]*label: `\$\{a\.produkt\} · \$\{a\.status\}`/);
});

test('Proforma-Anfrage (Redaktion): Länder statt Codes', () => {
  // Herkunft ist oft kein Plattform-Land (Indien, China) — bis 11/2026 blieb dann „IN" stehen, Kenia stand englisch.
  assert.equal(b2bLabel('en')('sourcing_anfrage', 'Amoxicillin · IN → KE'), 'Amoxicillin · India → Kenya');
  assert.equal(b2bLabel('de')('sourcing_anfrage', 'Amoxicillin · CN → KE'), 'Amoxicillin · China → Kenia');
  // Arabisch: Pfeile werden in RTL nicht gespiegelt — „→" zeigte von Ägypten nach Indien.
  assert.equal(b2bLabel('ar')('sourcing_anfrage', 'Amoxicillin · IN → EG'), `Amoxicillin · ${new Intl.DisplayNames(['ar'], { type: 'region' }).of('IN')} ← ${new Intl.DisplayNames(['ar'], { type: 'region' }).of('EG')}`);
  assert.match(server, /type: 'sourcing_anfrage'[^\n]*label: `\$\{a\.produkt\} · \$\{a\.herkunft\} → \$\{a\.ziel\}`/);
});

test('Frühwarnung: Region und Anzahl verständlich', () => {
  assert.equal(b2bLabel('de')('ausbruch_signal', 'Amoxicillin · AFRICA · 5'), 'Amoxicillin · Afrika · 5 neue Meldungen in 14 Tagen');
  assert.equal(b2bLabel('fr')('ausbruch_signal', 'Amoxicillin · EUROPE · 3'), 'Amoxicillin · Europe · 3 nouveaux signalements en 14 jours');
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    for (const r of ['AFRICA', 'EUROPE', 'AMERICAS', 'OCEANIA']) assert.doesNotMatch(b2bLabel(sp)('ausbruch_signal', `X · ${r} · 4`), /[A-Z]{4}/, `${sp}/${r}`);
  }
  // Die „14 Tage" im Text müssen zum Zeitfenster des Radars passen.
  const radar = readFileSync(new URL('../src/services/ausbruch.js', import.meta.url), 'utf8');
  assert.match(radar, /export const FENSTER_TAGE = 14;/);
  assert.match(server, /type: 'ausbruch_signal'[^\n]*label: `\$\{sig\.wirkstoff\} · \$\{sig\.region\} · \$\{sig\.neu\}`/);
});

test('Neue Zulassung ohne Wirkstoff: kein einzelnes „·" am Ende', () => {
  assert.equal(b2bLabel('de')('medint_neu', 'Zepbound ·'), 'Zepbound'); // alte, schon gespeicherte Benachrichtigungen
  assert.match(server, /type: 'medint_neu'[^\n]*label: \[eintrag\.titel, \(eintrag\.wirkstoffe \|\| \[\]\)\[0\]\]\.filter\(Boolean\)\.join\(' · '\)/);
});

test('Andere Typen bleiben unverändert; die Liste nutzt b2bLabel', () => {
  assert.equal(b2bLabel('en')('comment', 'Hallo · in_bearbeitung'), 'Hallo · in_bearbeitung');
  assert.match(app, /n\.type==='verify_rejected'\?vfGrund\(n\.label\):b2bLabel\(n\.type, n\.label\)/);
});

test('Richtungspfeile im Code folgen der Schreibrichtung (kein fester „→" in Oberflächentext)', () => {
  // Erlaubt: Kommentare, die Hilfsfunktion selbst und das Muster, das Server-Labels („IN → KE") erkennt.
  const fest = app.split('\n').map((z, i) => [i + 1, z]).filter(([, z]) => z.includes('→'))
    .filter(([, z]) => !/^\s*\/\//.test(z) && !/function richtungsPfeil\(\)/.test(z) && !/\/\* .*→.* \*\//.test(z) && !/s\.replace\(\/ · \(\[A-Z\]\{2\}\) → /.test(z));
  assert.deepEqual(fest, [], 'Fester Pfeil im Oberflächentext — richtungsPfeil() verwenden');
  assert.match(app, /function richtungsPfeil\(\) \{ return document\.documentElement\.dir === 'rtl' \? '←' : '→'; \}/);
});
