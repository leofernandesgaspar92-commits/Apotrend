// Betriebs-Cockpit (services/betrieb.js): nur Summen, richtig gezählt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betriebsZahlen } from '../src/services/betrieb.js';

const JETZT = Date.parse('2026-10-13T10:00:00Z');
const tage = (n) => new Date(JETZT + n * 86400000).toISOString();

test('Premium: aktiv, unbefristet, läuft bald ab, kürzlich ausgelaufen', () => {
  const grants = [
    { userId: 'a', bis: tage(20) }, { userId: 'b', bis: tage(3) }, { userId: 'c', bis: null },
    { userId: 'd', bis: tage(-10) }, { userId: 'e', bis: tage(-90) },
  ];
  const z = betriebsZahlen({ grants, aktiv: (u) => ['a', 'b', 'c'].includes(u), jetzt: JETZT });
  assert.deepEqual(z.premium, { aktiv: 3, unbefristet: 1, laeuft_ab_7: 1, abgelaufen_30: 1 });
});

test('Einnahmen: nur bezahlt, nur 30 Tage, je Währung; offene Prüfungen gezählt', () => {
  const z = betriebsZahlen({ jetzt: JETZT, zahlungen: [
    { status: 'paid', paid_at: tage(-2), amount_cents: 999, currency: 'EUR' },
    { status: 'paid', paid_at: tage(-20), amount_cents: 9900, currency: 'EUR' },
    { status: 'paid', paid_at: tage(-40), amount_cents: 999, currency: 'EUR' },
    { status: 'paid', paid_at: tage(-1), amount_cents: 500, currency: 'USD' },
    { status: 'pending_review', created_at: tage(-1), amount_cents: 999, currency: 'EUR' },
    { status: 'failed', created_at: tage(-1), amount_cents: 999, currency: 'EUR' },
  ] });
  assert.equal(z.einnahmen.anzahl, 3);
  assert.deepEqual(z.einnahmen.summen, [{ currency: 'EUR', cents: 10899 }, { currency: 'USD', cents: 500 }]);
  assert.equal(z.einnahmen.offen_pruefung, 1);
});

test('Quellen: liefern, Fehler mit Grund, noch nicht abgefragt — News zählen nicht', () => {
  const z = betriebsZahlen({ jetzt: JETZT,
    quellen: [{ id: 'basg', country: 'AT', label: 'BASG' }, { id: 'fda', country: 'US', label: 'FDA' }, { id: 'bfarm', country: 'DE', label: 'BfArM' }],
    gemessen: {
      'shortages:AT': { quellen: [{ id: 'basg', ok: true, meldungen: 37 }] },
      'shortages:US': { quellen: [{ id: 'fda', ok: false, fehler: 'HTTP 403' }] },
      'news:DE': { quellen: [{ id: 'bfarm', ok: true }] },
    } });
  assert.deepEqual([z.quellen.gesamt, z.quellen.liefern, z.quellen.fehler, z.quellen.offen], [3, 1, 1, 1]);
  assert.deepEqual(z.quellen.fehlerhaft, [{ id: 'fda', land: 'US', label: 'FDA', fehler: 'HTTP 403' }]);
});

test('Konten: gesamt und neu in 7 Tagen — ohne Kontaktdaten', () => {
  const z = betriebsZahlen({ jetzt: JETZT, konten: [{ id: '1', created_at: tage(-1) }, { id: '2', created_at: tage(-8) }] });
  assert.deepEqual(z.konten, { gesamt: 2, neu_7: 1 });
});
