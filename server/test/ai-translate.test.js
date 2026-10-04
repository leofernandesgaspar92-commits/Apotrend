// ============================================================================
//  Übersetzen auf Zuruf
// ============================================================================
//  Die wichtigste Zusicherung dieser Datei ist eine NEGATIVE: Die Herkunft
//  einer Meldung — Adresse und Behördenname — darf durch die Übersetzung nicht
//  verändert werden können. Gelöst ist das nicht per Bitte im Prompt, sondern
//  strukturell: Der Dienst bekommt nur Text. Was nie hereinkommt, kann nicht
//  verfälscht werden.
//
//  Ein Test schiebt genau das hinein, was NICHT durchkommen darf, und prüft,
//  dass beim Anbieter nichts davon landet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTranslateService, uebersetzungsAuftrag, cacheKey, MAX_ZEICHEN,
} from '../src/services/aiTranslate.js';

const MIT_KI = {
  APOPULSE_AI_PROVIDER: 'anthropic',
  APOPULSE_AI_API_KEY: 'test-key',
  APOPULSE_AI_MODEL: 'claude-test',
};

/** Dienst mit mitschreibendem Anbieter-Doppelgänger. */
function dienst({ antwort = 'Supply shortage reported', env = MIT_KI, wirft = null } = {}) {
  const aufrufe = [];
  const svc = createTranslateService({
    env,
    frage: async (cfg, auftrag, opts) => {
      aufrufe.push({ cfg, auftrag, system: opts && opts.system });
      if (wirft) throw wirft;
      return antwort;
    },
  });
  return { svc, aufrufe };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Die Herkunft kommt nicht herein
// ─────────────────────────────────────────────────────────────────────────────

test('nur der TEXT geht zum Anbieter — keine Adresse, kein Behoerdenname', async () => {
  const { svc, aufrufe } = dienst();
  await svc.uebersetze('Lieferengpass Amoxicillin gemeldet', 'en');
  assert.equal(aufrufe.length, 1);
  const { auftrag, system } = aufrufe[0];
  // Der Auftrag IST der Text, nichts weiter.
  assert.equal(auftrag, 'Lieferengpass Amoxicillin gemeldet');
  // Und im Systemauftrag steht kein Platz, an dem eine Herkunft mitreisen
  // koennte — er ist fuer alle Meldungen derselbe.
  assert.doesNotMatch(system, /http|bfarm|basg|ema\.europa/i);
});

test('wer Herkunft mitschicken WILL, kann es nicht', async () => {
  // Die Signatur nimmt (text, ziel). Ein drittes Argument mit Adresse und
  // Quelle wird nicht einmal gelesen — das ist die strukturelle Fassung der
  // Regel aus services/aiExtract.js.
  const { svc, aufrufe } = dienst();
  await svc.uebersetze('Charge gesperrt', 'pt', {
    originalUrl: 'https://www.bfarm.de/m/1', sourceName: 'BfArM',
  });
  const gesendet = JSON.stringify(aufrufe[0]);
  assert.doesNotMatch(gesendet, /bfarm\.de/i);
  assert.doesNotMatch(gesendet, /BfArM/);
});

test('der Auftrag verbietet Ergaenzungen, Empfehlungen und das Uebersetzen von Fachbegriffen', async () => {
  for (const ziel of ['de', 'en', 'pt']) {
    const a = uebersetzungsAuftrag(ziel);
    assert.match(a, /ERFINDE|ÜBERSETZE NUR, WAS DASTEHT/i, ziel);
    assert.match(a, /KEINE EMPFEHLUNG/i, ziel);
    // Wirkstoffnamen, Chargennummern und Dosierungen duerfen nicht
    // „uebersetzt" werden — eine verdeutschte Chargennummer ist eine falsche.
    assert.match(a, /Chargennummern/i, ziel);
    assert.match(a, /ZIELSPRACHE/i, ziel);
  }
  assert.match(uebersetzungsAuftrag('de'), /Deutsch/);
  assert.match(uebersetzungsAuftrag('en'), /English/);
  assert.match(uebersetzungsAuftrag('pt'), /Português/);
});

test('je Zielsprache ein eigener Auftrag', async () => {
  const { svc, aufrufe } = dienst();
  await svc.uebersetze('Text', 'en');
  await svc.uebersetze('Text', 'pt');
  assert.notEqual(aufrufe[0].system, aufrufe[1].system);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Eingaben werden VOR dem Anbieter geprueft
// ─────────────────────────────────────────────────────────────────────────────

test('leerer Text loest keinen bezahlten Aufruf aus', async () => {
  const { svc, aufrufe } = dienst();
  for (const t of ['', '   ', null, undefined]) {
    await assert.rejects(() => svc.uebersetze(t, 'en'), (e) => e.code === 'translate_empty');
  }
  assert.equal(aufrufe.length, 0, 'kein Aufruf beim Anbieter');
});

test('eine unbekannte Zielsprache ebenso', async () => {
  const { svc, aufrufe } = dienst();
  for (const z of ['fr', 'es', '', 'DEU', null]) {
    await assert.rejects(() => svc.uebersetze('Text', z), (e) => e.code === 'translate_lang');
  }
  assert.equal(aufrufe.length, 0);
});

test('zu langer Text wird abgewiesen, nicht gekuerzt', async () => {
  // Gekuerzt zu uebersetzen waere schlimmer: Die Haelfte einer
  // Behoerdenmeldung sieht wie die ganze aus.
  const { svc, aufrufe } = dienst();
  await assert.rejects(
    () => svc.uebersetze('x'.repeat(MAX_ZEICHEN + 1), 'en'),
    (e) => e.code === 'translate_too_long' && /Zeichen/.test(e.message),
  );
  assert.equal(aufrufe.length, 0);
});

test('ohne KI-Schluessel wird ehrlich abgewiesen, nie das Original als Uebersetzung ausgegeben', async () => {
  const { svc, aufrufe } = dienst({ env: {} });
  assert.equal(svc.verfuegbar(), false);
  await assert.rejects(() => svc.uebersetze('Lieferengpass', 'en'), (e) => e.code === 'translate_unconfigured' && e.status === 503);
  assert.equal(aufrufe.length, 0);
});

test('mit Schluessel meldet der Dienst sich als verfuegbar', () => {
  const { svc } = dienst();
  assert.equal(svc.verfuegbar(), true);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Zwischenspeicher
// ─────────────────────────────────────────────────────────────────────────────

test('derselbe Text wird nicht zweimal bezahlt', async () => {
  const { svc, aufrufe } = dienst({ antwort: 'Supply shortage' });
  const a = await svc.uebersetze('Lieferengpass', 'en');
  const b = await svc.uebersetze('Lieferengpass', 'en');
  assert.equal(a.text, 'Supply shortage');
  assert.equal(a.cached, false);
  assert.equal(b.cached, true, 'zweiter Aufruf aus dem Zwischenspeicher');
  assert.equal(aufrufe.length, 1, 'nur EIN Anbieter-Aufruf');
});

test('der Zwischenspeicher trennt die Zielsprachen', async () => {
  const { svc, aufrufe } = dienst();
  await svc.uebersetze('Lieferengpass', 'en');
  await svc.uebersetze('Lieferengpass', 'pt');
  // Sonst bekaeme die portugiesische Ansicht die englische Uebersetzung —
  // und das faellt niemandem auf, weil beides „fremd" aussieht.
  assert.equal(aufrufe.length, 2);
  assert.notEqual(cacheKey('Lieferengpass', 'en'), cacheKey('Lieferengpass', 'pt'));
});

test('der Schluessel haengt am Textinhalt', () => {
  assert.equal(cacheKey('Gleicher Text', 'en'), cacheKey('Gleicher Text', 'en'));
  assert.notEqual(cacheKey('Text A', 'en'), cacheKey('Text B', 'en'));
});

test('der Zwischenspeicher waechst nicht unbegrenzt', async () => {
  const svc = createTranslateService({ env: MIT_KI, max: 3, frage: async () => 'x' });
  for (let i = 0; i < 10; i++) await svc.uebersetze('Text ' + i, 'en');
  assert.equal(svc.stats().gespeichert, 3);
  // Der aelteste ist heraus, der neueste drin.
  assert.equal((await svc.uebersetze('Text 9', 'en')).cached, true);
  assert.equal((await svc.uebersetze('Text 0', 'en')).cached, false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stoerungen
// ─────────────────────────────────────────────────────────────────────────────

test('eine Stoerung beim Anbieter wird benannt, nicht verschluckt', async () => {
  const { svc } = dienst({ wirft: new Error('HTTP 529') });
  await assert.rejects(() => svc.uebersetze('Text', 'en'),
    (e) => e.code === 'translate_provider' && e.status === 502 && /529/.test(e.message));
});

test('eine leere Antwort gilt NICHT als Uebersetzung', async () => {
  // `antwort: undefined` NICHT ueber den Helfer: Dort greift der
  // Vorgabewert („Supply shortage") und der Test prueft dann das Gegenteil
  // von dem, was dasteht. Genau so war die erste Fassung gruen, obwohl sie
  // nichts belegte — Vorgabewerte in Testhelfern verschlucken den
  // interessanten Fall.
  for (const leer of ['', '   ', null, undefined]) {
    const svc = createTranslateService({ env: MIT_KI, frage: async () => leer });
    await assert.rejects(() => svc.uebersetze('Text', 'en'), (e) => e.code === 'translate_empty_answer',
      `Antwort ${JSON.stringify(leer)} haette abgewiesen werden muessen`);
  }
});

test('eine gescheiterte Uebersetzung landet NICHT im Zwischenspeicher', async () => {
  // Sonst waere ein einmaliger Netzfehler fuer immer als Ergebnis verbucht.
  let n = 0;
  const svc = createTranslateService({
    env: MIT_KI,
    frage: async () => { n++; if (n === 1) throw new Error('weg'); return 'Supply shortage'; },
  });
  await assert.rejects(() => svc.uebersetze('Lieferengpass', 'en'));
  const zweiter = await svc.uebersetze('Lieferengpass', 'en');
  assert.equal(zweiter.text, 'Supply shortage');
  assert.equal(zweiter.cached, false);
});
