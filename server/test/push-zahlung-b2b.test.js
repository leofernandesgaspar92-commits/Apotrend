// Push aufs Handy auch für Ereignisse, auf die jemand WARTET — nicht nur für Engpässe.
// Fund 11/2026: Krypto-Zahlung (von Hand geprüft, kann Stunden dauern), Antwort des Handelsteams
// auf eine Angebotsanfrage und die Ausbruchs-Frühwarnung an den Großhandel kamen nur in die Glocke.
// Wer die App nicht öffnet, erfuhr nichts — obwohl er Push eingeschaltet hatte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pushNachricht, PUSH_TYPEN } from '../src/services/webPush.js';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const SPRACHEN = ['de', 'en', 'pt', 'fr', 'ar'];

test('Zahlung bestätigt/abgelehnt, Antwort auf Angebotsanfrage, Frühwarnung: als Push', () => {
  for (const t of ['payment_confirmed', 'payment_rejected', 'sourcing_antwort', 'ausbruch_signal']) assert.ok(PUSH_TYPEN.has(t), t);
});

test('Zahlung: 5 Sprachen, ohne Freitext der Prüfung, öffnet die Premium-Seite', () => {
  const titel = new Set();
  for (const sprache of SPRACHEN) {
    const ja = pushNachricht({ type: 'payment_confirmed', label: 'ApoPulse Premium (Monat)' }, { sprache });
    const nein = pushNachricht({ type: 'payment_rejected', label: 'geheimer Prüfvermerk: Betrag zu niedrig' }, { sprache });
    assert.ok(ja && ja.titel && ja.text && nein && nein.titel && nein.text, sprache);
    assert.ok(!/geheimer|Prüfvermerk/.test(nein.titel + nein.text), 'Freitext der Prüfung im Push');
    assert.deepEqual([ja.url, nein.url], ['/?zahlung=1', '/?zahlung=1']);
    assert.equal(ja.tag, nein.tag, 'bestätigt ersetzt abgelehnt auf dem Sperrbildschirm');
    titel.add(ja.titel);
  }
  assert.equal(titel.size, 5, 'Titel nicht übersetzt');
});

test('Angebotsanfrage: Präparat im Text, öffnet genau diese Anfrage', () => {
  for (const sprache of SPRACHEN) {
    const m = pushNachricht({ type: 'sourcing_antwort', ref_type: 'sourcing', ref_id: 'pfabc12', label: 'Amoxicillin 500 mg · beantwortet' }, { sprache });
    assert.ok(m && m.titel, sprache);
    assert.match(m.text, /Amoxicillin 500 mg/);
    assert.ok(!/beantwortet/.test(m.titel + m.text) || sprache === 'de', 'deutscher Status-Code im Push');
    assert.equal(m.url, '/sourcing?anfrage=pfabc12');
  }
  // Aus der Benachrichtigung (Speicher) kommt refId als ref_id; fremde Zeichen landen nicht in der URL.
  assert.equal(pushNachricht({ type: 'sourcing_antwort', refId: 'pf"><x', label: 'X · neu' }).url, '/sourcing?anfrage=pf%22%3E%3Cx');
});

test('Frühwarnung: Wirkstoff + Region in Klartext, öffnet das Ausbruchs-Radar', () => {
  for (const sprache of SPRACHEN) {
    const m = pushNachricht({ type: 'ausbruch_signal', ref_type: 'wirkstoff', ref_id: 'Oxytocin', label: 'Oxytocin · AFRICA · 7' }, { sprache });
    assert.ok(m && m.titel, sprache);
    assert.match(m.titel + m.text, /Oxytocin/);
    assert.match(m.text, /7/);
    assert.ok(!/^(Apotheken|Pharmacies|Farmácias|les pharmacies) /.test(m.text), 'Signal zählt auch Behörden — nicht nur Apotheken');
    assert.ok(!/AFRICA/.test(m.titel + m.text), `Regions-Code statt Name (${sprache})`);
    assert.equal(m.url, '/?radar=1');
  }
  assert.match(pushNachricht({ type: 'ausbruch_signal', label: 'Oxytocin · EUROPE · 3' }, { sprache: 'fr' }).text, /Europe/);
});

test('App öffnet die Ziele der neuen Push-Links', () => {
  assert.match(APP, /if \(params\.get\('zahlung'\) === '1'\) \{ history\.replaceState\(null, '', location\.pathname\); openPremium\(\); return; \}/);
  assert.match(APP, /if \(params\.get\('radar'\) === '1'\) \{ history\.replaceState\(null, '', location\.pathname\); openAusbruch\(\); return; \}/);
  assert.match(APP, /if \(location\.pathname === '\/sourcing'\) \{ const anfrage = params\.get\('anfrage'\); if \(anfrage\) history\.replaceState\(null, '', '\/sourcing'\); openSourcing\(anfrage\); return; \}/);
  assert.match(APP, /data-pushauch>\$\{esc\(t\('push_auch'\)\)\}/, 'Push-Karte sagt nicht, was sonst noch kommt');
});

// Werbekunden (11/2026): Freigabe, Ablehnung, Zahlungseingang ihrer Anzeige kamen nur in die Glocke;
// eine abgelehnte Krypto-Zahlung einer Anzeige führte zur Premium-Seite.
test('Anzeige freigegeben/abgelehnt/bezahlt: als Push, 5 Sprachen, öffnet „Werbung"', () => {
  for (const t of ['anzeige_freigegeben', 'anzeige_abgelehnt', 'anzeige_bezahlt']) assert.ok(PUSH_TYPEN.has(t), t);
  for (const sprache of SPRACHEN) {
    for (const type of ['anzeige_freigegeben', 'anzeige_abgelehnt', 'anzeige_bezahlt']) {
      const m = pushNachricht({ type, refType: 'anzeige', refId: 'k1', label: 'Kühlkette Süd' }, { sprache });
      assert.ok(m && m.titel && m.text, `${type} ${sprache}`);
      assert.match(m.text, /Kühlkette Süd/);
      assert.equal(m.url, '/?werbung=1');
    }
  }
  const nein = pushNachricht({ type: 'payment_rejected', refType: 'anzeige', refId: 'k1', label: 'Betrag zu niedrig' }, { sprache: 'en' });
  assert.equal(nein.url, '/?werbung=1', 'abgelehnte Anzeigen-Zahlung führt zur Premium-Seite');
  assert.ok(!/Betrag/.test(nein.text));
  assert.match(APP, /if \(params\.get\('werbung'\) === '1'\) \{ history\.replaceState\(null, '', location\.pathname\); openWerbung\(\); return; \}/);
  assert.match(APP, /else if \(n\.type === 'payment_rejected' && n\.ref_type === 'anzeige'\) \{ openWerbung\(\); \}/);
});
