// ============================================================================
//  Tausch-Matching: Zahl und Klick müssen dasselbe sagen
// ============================================================================
//  Am Eintrag steht „N passende Angebote". Ein Klick darauf setzt einen
//  Suchbegriff und zeigt die Liste. Vorher riet das Frontend diesen Begriff
//  selbst (eigenes, nur deutsches Muster, ohne Formwort-Filter), und die
//  Dashboard-Kachel setzte die GANZE Bezeichnung ein — deren Wörter das
//  Angebot fast nie alle enthielt. Zahl und Liste widersprachen sich.
//
//  Jetzt liefert der Server mit der Zahl den Schlüssel (`match_key`). Diese
//  Datei prüft die Zusage dahinter: Mit genau diesem Schlüssel findet die
//  Suche genau die gezählten Gegenstücke.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createExchangeService } from '../src/services/exchange.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  let n = 0;
  const apotheke = ({ verifiziert = true } = {}) => {
    n++;
    const r = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name: 'Farmácia ' + n }, owner: { name: 'F' + n, email: `f${n}@a.pt`, password: 'geheim123' },
    });
    social.createProfile(r.user.id, { handle: 'farm' + n, displayName: 'Farmácia ' + n, country: 'PT', accountType: 'pharmacy' });
    if (verifiziert) socialRepo.setProfileVerified(r.user.id, true);
    return r.user.id;
  };
  return { social, exchange, apotheke, unverifiziert: () => apotheke({ verifiziert: false }) };
}

/** Was „passende anzeigen" zeigt: gegenteilige Art, Suchbegriff = match_key. */
function klick(exchange, betrachter, eintrag) {
  const gegen = eintrag.kind === 'biete' ? 'suche' : 'biete';
  return exchange.list(betrachter, { kind: gegen, q: eintrag.match_key }).eintraege
    .filter((e) => e.author_user_id !== betrachter);
}

test('Zahl und Klick: der Schlüssel findet genau die gezählten Angebote', () => {
  const { exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Metformina Solução oral 100 ml', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Metformina 850 mg comprimidos', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Metformina 500 mg', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Amoxicilina Solução oral 100 ml', rx: 'otc' }); // teilt nur Formwörter

  const meins = exchange.mine(ich)[0];
  assert.equal(meins.match_count, 2, 'Amoxicilina darf über „Solução oral" nicht mitzählen');
  assert.equal(meins.match_key, 'metformina');
  assert.equal(klick(exchange, ich, meins).length, meins.match_count, 'der Klick zeigt etwas anderes als die Zahl');
});

test('Zahl und Klick: Akzent im Gesuch, keiner im Angebot — trotzdem dieselbe Liste', () => {
  const { exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Ácido acetilsalicílico 100', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Acido acetilsalicilico 100 mg', rx: 'otc' });
  const meins = exchange.mine(ich)[0];
  assert.equal(meins.match_count, 1);
  // Schreibweise des EIGENEN Eintrags — so steht es dann im Suchfeld.
  assert.equal(meins.match_key, 'acetilsalicílico');
  assert.equal(klick(exchange, ich, meins).length, 1, 'die Suche faltet die Akzente nicht');
});

test('Zahl und Klick: deutsche Bezeichnung mit Füllwörtern', () => {
  // Vorher filterte das Frontend hier nach „lösung" — dem ersten Wort.
  const { exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Lösung zum Einnehmen Metformin', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Metformin 1000 mg Filmtabletten', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Amoxicillin Lösung zum Einnehmen', rx: 'otc' });
  const meins = exchange.mine(ich)[0];
  assert.equal(meins.match_count, 1);
  assert.equal(meins.match_key, 'metformin');
  assert.equal(klick(exchange, ich, meins).length, 1);
});

test('match_key ist null, wenn nichts passt', () => {
  const { exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Metformina 850', rx: 'otc' });
  const meins = exchange.mine(ich)[0];
  assert.equal(meins.match_count, 0);
  assert.equal(meins.match_key, null);
});

test('match_key folgt der Schranke: verborgene Gegenstücke liefern keinen Schlüssel', () => {
  // Sonst wiese der Schlüssel auf etwas, das die Liste nicht zeigen darf —
  // und „passende anzeigen" führte wieder auf eine leere Liste.
  const { exchange, apotheke, unverifiziert } = setup();
  const ich = unverifiziert();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Semaglutido caneta', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Semaglutido 1 mg', rx: 'rx' });
  const meins = exchange.mine(ich)[0];
  assert.equal(meins.match_count, 0);
  assert.equal(meins.match_key, null);

  // Gegenprobe im selben Aufbau: Eine verifizierte Apotheke sieht es.
  const befugt = apotheke();
  exchange.create(befugt, { kind: 'suche', bezeichnung: 'Semaglutido caneta', rx: 'otc' });
  const ihrs = exchange.mine(befugt)[0];
  assert.equal(ihrs.match_count, 1);
  assert.equal(ihrs.match_key, 'semaglutido');
});

test('Glocke: portugiesische Formwörter verbinden keine fremden Wirkstoffe mehr', () => {
  const { social, exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Comprimidos de Metformina 850', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Comprimidos de Amoxicilina 500', rx: 'otc' });
  assert.equal(social.notifications(ich).filter((n) => n.type === 'exchange_offer').length, 0);
});

test('Suche: „losung" findet „Lösung", „acido" findet „Ácido"', () => {
  const { exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Metformin Lösung', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Ácido fólico 5 mg', rx: 'otc' });
  assert.equal(exchange.list(ich, { q: 'losung' }).eintraege.length, 1);
  assert.equal(exchange.list(ich, { q: 'acido folico' }).eintraege.length, 1);
  assert.equal(exchange.list(ich, { q: 'Lösung' }).eintraege.length, 1, 'mit Umlaut weiterhin');
});

test('match_key: das Wort mit den meisten Gegenstücken, nicht einfach das erste', () => {
  // Ein Schlüssel ist EIN Suchwort. Kommen Treffer über verschiedene Wörter,
  // zeigt der Klick die größte Gruppe — nicht alle. Das ist die ehrliche
  // Grenze eines einzelnen Suchbegriffs; die Zahl am Eintrag bleibt die
  // Gesamtzahl.
  const { exchange, apotheke } = setup();
  const ich = apotheke();
  exchange.create(ich, { kind: 'suche', bezeichnung: 'Augmentin Amoxicilina', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Augmentin 875', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Amoxicilina 500', rx: 'otc' });
  exchange.create(apotheke(), { kind: 'biete', bezeichnung: 'Amoxicilina 1 g', rx: 'otc' });
  const meins = exchange.mine(ich)[0];
  assert.equal(meins.match_count, 3);
  assert.equal(meins.match_key, 'amoxicilina', '„augmentin" steht vorn, trifft aber nur eines');
  assert.equal(klick(exchange, ich, meins).length, 2);
});
