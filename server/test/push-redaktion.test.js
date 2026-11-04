// Push für die Redaktion: Ereignisse, bei denen eine KUNDIN auf uns wartet.
// Fund 11/2026: Meldet eine Kundin ihre Krypto-Zahlung, stand das nur in der Glocke der Redaktion —
// die Freischaltung wartete, bis zufällig jemand die App öffnete. Ebenso neue Angebotsanfragen
// (E-Mail nur mit APOPULSE_HANDEL_EMAIL) und bezahlte Anzeigen, die auf Freigabe warten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pushNachricht, PUSH_TYPEN } from '../src/services/webPush.js';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const SPRACHEN = ['de', 'en', 'pt', 'fr', 'ar'];

test('Zahlung prüfen, neue Angebotsanfrage, Anzeige prüfen: als Push an die Redaktion', () => {
  for (const t of ['payment_review', 'sourcing_anfrage', 'anzeige_pruefen']) assert.ok(PUSH_TYPEN.has(t), t);
});

test('Texte in 5 Sprachen, Betrag/Präparat/Titel genannt, öffnen die Prüfliste', () => {
  for (const sprache of SPRACHEN) {
    const z = pushNachricht({ type: 'payment_review', label: 'usdt_tron · 9.99 EUR' }, { sprache });
    const u = pushNachricht({ type: 'payment_review', label: 'Überweisung · 99.00 EUR' }, { sprache });
    const s = pushNachricht({ type: 'sourcing_anfrage', label: 'Amoxicillin 500 mg · IN → KE' }, { sprache });
    const a = pushNachricht({ type: 'anzeige_pruefen', label: 'Lagos Pharma Großhandel' }, { sprache });
    for (const m of [z, u, s, a]) { assert.ok(m && m.titel && m.text, sprache); assert.equal(m.url, '/?moderation=1'); }
    assert.match(z.text, /9\.99 EUR/); assert.match(u.text, /99\.00 EUR/);
    if (sprache !== 'de') assert.ok(!/Überweisung/.test(u.titel + u.text), `deutsches „Überweisung" im Push (${sprache})`);
    assert.match(s.text, /Amoxicillin 500 mg/);
    assert.match(a.text, /Lagos Pharma Großhandel/);
  }
  // Mehrere offene Zahlungen ersetzen sich nicht gegenseitig auf dem Sperrbildschirm.
  assert.notEqual(pushNachricht({ type: 'payment_review', refId: 'p1', label: 'x · 1.00 EUR' }).tag, pushNachricht({ type: 'payment_review', refId: 'p2', label: 'x · 1.00 EUR' }).tag);
});

test('App: /?moderation=1 öffnet die Prüfliste — nur für die Redaktion', () => {
  assert.match(APP, /if \(params\.get\('moderation'\) === '1' && iAmModerator\) \{ history\.replaceState\(null, '', location\.pathname\); showModeration\(\); return; \}/);
});
