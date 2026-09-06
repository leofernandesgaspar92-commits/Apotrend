import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createPricesService } from '../src/services/prices.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const prices = createPricesService(createPricesRepo(), social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { prices, a: A.user.id };
}

test('Preisvergleich: nach Präparat gruppiert, günstigster Lieferant zuerst, Trend + Herkunft', () => {
  const { prices, a } = setup();
  const cmp = prices.comparisons(a);
  const amox = cmp.find(g => g.bezeichnung.startsWith('Amoxicillin'));
  assert.ok(amox.offers.length >= 2);
  // guenstigster zuerst
  assert.ok(amox.offers[0].aep <= amox.offers[1].aep);
  assert.equal(amox.offers[0].provenance, 'reference');
  // Trend: Herba 3.98 (prev 3.72) -> positiv; Großhandel B 3.01 (prev 3.05) -> negativ
  const herba = amox.offers.find(o => o.supplier === 'Großhandel A');
  const kwizda = amox.offers.find(o => o.supplier === 'Großhandel B');
  assert.ok(herba.trend_pct > 0);
  assert.ok(kwizda.trend_pct < 0);
});

test('Aus Preis heraus posten -> Beitrag referenziert das Angebot + Aktivität', () => {
  const { prices, a } = setup();
  const offer = prices.comparisons(a)[0].offers[0];
  const post = prices.postAbout(a, offer.id, { body: 'Preis bei ' + offer.supplier + ' gerade gestiegen.' });
  assert.equal(post.ref_type, 'price');
  assert.equal(post.ref_id, offer.id);

  const act = prices.withActivity(a, offer.id);
  assert.equal(act.post_count, 1);
  // Zähler taucht im Vergleich auf
  const again = prices.comparisons(a).flatMap(g => g.offers).find(o => o.id === offer.id);
  assert.equal(again.post_count, 1);
});

test('Posten zu unbekanntem Preis wird abgelehnt', () => {
  const { prices, a } = setup();
  assert.throws(() => prices.postAbout(a, 'nope', { body: 'x' }), /nicht gefunden/);
});

// ── Keine erfundenen Preise unter echten Firmennamen ────────────────────────
// Bis zum 06.09.2026 nannten die Referenzdaten real existierende
// oesterreichische Grosshaendler mit Preisen, die nicht von ihnen stammen.
// Intern war das als provenance='reference' gekennzeichnet — das genuegt aber
// nicht: Eine Apothekerin liest „<Name>: 3,01 €" als Preis dieses Hauses, und
// das betroffene Unternehmen haette ein berechtigtes Anliegen.
//
// Dieser Test haelt die Entscheidung fest. Kommen echte Namen zurueck, dann
// bitte GEMEINSAM mit echten Daten (provenance='verified') — dann faellt hier
// bewusst etwas auf, und jemand muss diese Zeile mit Bedacht anfassen.

import { readFileSync } from 'node:fs';

test('Referenzdaten tragen keine echten Grosshaendler-Namen', () => {
  const ECHTE_HAEUSER = [
    'Herba Chemosan', 'Kwizda', 'Jacoby', 'Phoenix', 'Sanacorp',
    'Noweda', 'Gehe', 'Alliance Healthcare', 'AEP Arzneimittel',
  ];
  for (const datei of ['../src/repo/pricesRepo.js', '../src/repo/rabatteRepo.js']) {
    const quelltext = readFileSync(new URL(datei, import.meta.url), 'utf8');
    // Nur der Datenteil zaehlt: Im Kommentarkopf steht die Begruendung, und
    // dort DUERFEN die Namen nicht stehen — deshalb pruefen wir die Zeilen mit
    // `supplier:`, wo die Daten tatsaechlich liegen.
    const zeilen = quelltext.split('\n').filter((z) => z.includes('supplier:'));
    for (const haus of ECHTE_HAEUSER) {
      const treffer = zeilen.filter((z) => z.includes(haus));
      assert.equal(treffer.length, 0,
        `${datei}: „${haus}" steht an erfundenen Referenzdaten. `
        + 'Entweder neutralen Namen verwenden oder echte Daten mit provenance="verified" liefern.');
    }
  }
});

// ── Preise gehören zu einem Land ────────────────────────────────────────────
// Dieselbe Klasse wie bei den Engpässen, nur unmittelbarer: An einem Preis
// hängt eine Zahl, die jemand einer Verhandlung oder Bestellung zugrunde legt.
// Bis zum 06.09.2026 sah eine Apotheke in Nairobi österreichische
// Referenzpreise als ihre Marktlage.

test('die Referenzpreise gehören nach Österreich — und nur dorthin', () => {
  const repo = createPricesRepo();
  const alle = repo.listFlat();
  assert.ok(alle.length > 0, 'ohne Referenzpreise prüft dieser Test nichts');
  assert.ok(alle.every((p) => p.country === 'AT'),
    'jede Referenzzeile trägt AT: ' + alle.map((p) => `${p.bezeichnung}=${p.country}`).join(', '));
  assert.ok(repo.listComparisons({ country: 'AT' }).length > 0);
  assert.equal(repo.listComparisons({ country: 'KE' }).length, 0,
    'Kenia darf keine österreichischen Referenzpreise sehen');
});

test('eine Preiszeile ohne Land gilt überall', () => {
  const repo = createPricesRepo({ seed: false });
  repo.upsert({ bezeichnung: 'Weltweit 1 mg', wirkstoff: 'W', supplier: 'Großhandel A', aep: 1, country: null });
  assert.equal(repo.listComparisons({ country: 'KE' }).length, 1);
  assert.equal(repo.listComparisons({ country: 'AT' }).length, 1);
});

test('ohne Länderangabe bleibt alles sichtbar', () => {
  const repo = createPricesRepo({ seed: false });
  repo.upsert({ bezeichnung: 'A', wirkstoff: 'A', supplier: 'S', aep: 1, country: 'AT' });
  repo.upsert({ bezeichnung: 'B', wirkstoff: 'B', supplier: 'S', aep: 1, country: 'KE' });
  assert.equal(repo.listComparisons().length, 2);
});

test('das Land wird normalisiert', () => {
  const repo = createPricesRepo({ seed: false });
  assert.equal(repo.upsert({ bezeichnung: 'A', supplier: 'S', aep: 1, country: 'ke' }).country, 'KE');
  // Leerer String ist kein Land, sondern „überall".
  assert.equal(repo.upsert({ bezeichnung: 'B', supplier: 'S', aep: 1, country: '' }).country, null);
});
