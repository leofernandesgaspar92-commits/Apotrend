// ============================================================================
//  Wirkstoff-Alarm zu Behoerdenmeldungen
// ============================================================================
//  Der teuerste Fehler hier ist NICHT ein verpasster Alarm, sondern einer zu
//  viel. Wer dreimal am Tag „Neue Meldung zu Ibuprofen" bekommt und jedes Mal
//  eine Pressemitteilung vorfindet, schaltet die Kategorie ab — und verpasst
//  dann auch den Chargenrueckruf. Ein stummer Melder ist schlimmer als gar
//  keiner, weil man sich auf ihn verlaesst.
//
//  Die meisten Tests unten pruefen deshalb, dass NICHT gemeldet wird.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wortTreffer, trefferQuelle, landPasst, alarmeFuerSignal, benachrichtigeZuSignal,
  tagesSchluessel, meldungsSchluessel, EU_WEIT_EMPFAENGER, MIN_TITEL_LAENGE,
} from '../src/services/signalAlerts.js';
import { baueSignal } from '../src/services/signals.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';

function signal({ land = 'DE', titel = 'Lieferengpass gemeldet', wirkstoff = null, handelsname = null, url = 'https://www.bfarm.de/m/1' } = {}) {
  return baueSignal({
    meldung: { title: titel, summary: 'Anriss' },
    herkunft: { originalUrl: url, sourceName: 'BfArM', sourceId: 'bfarm_news', country: land },
    extraktion: { wirkstoff, handelsname },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Wortgrenzen — die haeufigste Quelle von Fehlalarmen
// ─────────────────────────────────────────────────────────────────────────────

test('ein Kuerzel trifft NICHT mitten im Wort', () => {
  // Der klassische Fehler: `includes('ass')`. Genau so arbeitet die aeltere
  // Austausch-Zuordnung (watchersForText) — fuer eine kurze
  // Produktbezeichnung tragbar, fuer eine Behoerdenueberschrift nicht.
  for (const hay of ['Erste KLASSE', 'Was PASSIERT ist', 'GLASSPLITTER im Produkt', 'Kassenrezept']) {
    assert.equal(wortTreffer(hay, 'ass'), false, `"ass" traf in "${hay}"`);
  }
  assert.equal(wortTreffer('Rueckruf ASS 100 mg', 'ass'), true, 'als eigenes Wort muss es treffen');
});

test('Bindestrich, Klammer und Komma sind Wortgrenzen', () => {
  for (const hay of ['Amoxicillin-ratiopharm 1000 mg', '(Amoxicillin)', 'Amoxicillin, 500 mg', 'Wirkstoff: Amoxicillin.']) {
    assert.equal(wortTreffer(hay, 'amoxicillin'), true, `nicht getroffen in "${hay}"`);
  }
});

test('ein Wortanfang ist kein eigenes Wort', () => {
  assert.equal(wortTreffer('Acetylsalicylsäure', 'acetylsalicyl'), false);
  assert.equal(wortTreffer('Paracetamolhaltige Praeparate', 'paracetamol'), false);
  assert.equal(wortTreffer('Vitamin B12 betroffen', 'b12'), true);
  assert.equal(wortTreffer('Vitamin B123', 'b12'), false);
});

test('Umlaute zaehlen als Buchstaben — nicht als Wortgrenze', () => {
  // ── DIESER TEST ENTSTAND AUS EINER FEHLGESCHLAGENEN GEGENPROBE ──
  //  Ich habe die Unicode-Grenze gegen das einfachere `\b` getauscht, um zu
  //  belegen, dass die Tests den Unterschied merken — und ALLE blieben gruen.
  //  Kein Fall oben hatte einen Umlaut DIREKT am Treffer, und genau dort
  //  liegt der einzige Unterschied: `\b` ist in JavaScript ASCII-basiert und
  //  haelt „ä" fuer ein Trennzeichen.
  //
  //  Beide Richtungen, und die zweite ist die schlimmere:

  //  1. FEHLALARM: `\b` erzeugt vor dem Umlaut eine Grenze, die es nicht gibt.
  assert.equal(wortTreffer('Ibuprofenähnliche Wirkstoffe', 'Ibuprofen'), false,
    '„Ibuprofenähnliche" ist nicht „Ibuprofen"');
  assert.equal(wortTreffer('Amoxicillinösung getestet', 'Amoxicillin'), false);

  //  2. VERPASSTER ALARM: Ein Wirkstoff, der MIT einem Umlaut beginnt, wird
  //     von `\b` nie gefunden — dort steht am Wortanfang kein ASCII-Wortzeichen,
  //     an dem die Grenze ansetzen koennte. Wer „Östrogen" beobachtet, haette
  //     nie einen Hinweis bekommen, und niemandem waere es aufgefallen.
  assert.equal(wortTreffer('Rueckruf Östrogen 2 mg', 'Östrogen'), true);
  assert.equal(wortTreffer('Charge Ölsäure gesperrt', 'Ölsäure'), true);
  assert.equal(wortTreffer('Übelkeit', 'Östrogen'), false, 'und trotzdem kein Freifahrtschein');
});

test('Gross- und Kleinschreibung spielt keine Rolle', () => {
  assert.equal(wortTreffer('RUECKRUF IBUPROFEN', 'ibuprofen'), true);
  assert.equal(wortTreffer('Ibuprofen', 'IBUPROFEN'), true);
});

test('Sonderzeichen im Wirkstoffnamen bringen die Suche nicht zum Absturz', () => {
  // Wirkstoffnamen enthalten „(", „+", „." — ein ungeschuetztes Muster waere
  // ein Syntaxfehler mitten im Abruf.
  for (const nadel of ['Amoxicillin (Trihydrat)', 'Ibuprofen + Coffein', 'Vit. D3', 'a**b', '[x]']) {
    assert.doesNotThrow(() => wortTreffer('irgendein Text', nadel));
  }
  assert.equal(wortTreffer('Rueckruf Ibuprofen + Coffein 400 mg', 'Ibuprofen + Coffein'), true);
});

test('Leeres trifft nie', () => {
  for (const [h, n] of [['', 'x'], ['x', ''], [null, 'x'], ['x', null], [undefined, undefined]]) {
    assert.equal(wortTreffer(h, n), false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Woher der Treffer stammt
// ─────────────────────────────────────────────────────────────────────────────

test('der KI-Wirkstoff hat Vorrang vor dem Titel', () => {
  const s = signal({ titel: 'Amoxicillin betroffen', wirkstoff: 'amoxicillin' });
  assert.equal(trefferQuelle(s, 'Amoxicillin'), 'wirkstoff');
});

test('auch der Handelsname zaehlt', () => {
  const s = signal({ titel: 'Charge gesperrt', handelsname: 'Amoxi-PRUEF' });
  assert.equal(trefferQuelle(s, 'Amoxi-PRUEF'), 'handelsname');
});

test('ohne KI greift der Titel — das ist der Normalbetrieb ohne KI-Schluessel', () => {
  // Wichtig: Ohne APOPULSE_AI_API_KEY ist `wirkstoff` IMMER null. Ein Alarm,
  // der nur auf dem KI-Feld trifft, wuerde beim Owner heute nie ausloesen.
  const s = signal({ titel: 'Lieferengpass Amoxicillin 1000 mg Filmtabletten' });
  assert.equal(s.wirkstoff, null, 'Voraussetzung des Tests');
  assert.equal(trefferQuelle(s, 'Amoxicillin'), 'titel');
});

test('kurze Kuerzel werden im Fliesstext NICHT gesucht', () => {
  // „ASS", „BCG", „HES" sind in einer Ueberschrift nicht sicher von
  // Abkuerzungen zu unterscheiden. Im strukturierten KI-Feld schon.
  assert.ok(MIN_TITEL_LAENGE >= 4);
  const imTitel = signal({ titel: 'Rueckruf ASS 100 mg' });
  assert.equal(trefferQuelle(imTitel, 'ASS'), null, 'Kuerzel im Titel darf nicht ausloesen');
  const imFeld = signal({ titel: 'Rueckruf', wirkstoff: 'ASS' });
  assert.equal(trefferQuelle(imFeld, 'ASS'), 'wirkstoff', 'im KI-Feld ist es belastbar');
});

test('kein Treffer, kein Alarm', () => {
  const s = signal({ titel: 'Zulassung fuer Metformin erweitert', wirkstoff: 'metformin' });
  assert.equal(trefferQuelle(s, 'Amoxicillin'), null);
  assert.equal(trefferQuelle(s, ''), null);
  assert.equal(trefferQuelle(null, 'x'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Land
// ─────────────────────────────────────────────────────────────────────────────

test('eine Meldung erreicht nur das eigene Land', () => {
  assert.equal(landPasst('DE', 'DE'), true);
  assert.equal(landPasst('DE', 'AT'), false);
  assert.equal(landPasst('de', 'DE'), true, 'Schreibweise egal');
});

test('EU-weite Meldungen erreichen den EU-/EWR-Raum — die Schweiz NICHT', () => {
  for (const land of EU_WEIT_EMPFAENGER) assert.equal(landPasst('EU', land), true, land);
  // Swissmedic entscheidet eigenstaendig; eine EMA-Meldung ist dort keine
  // Behoerdenaussage. Sichtbar bleibt sie ueber den Laender-Umschalter — ein
  // unaufgeforderter Alarm aus fremder Jurisdiktion ist etwas anderes.
  assert.equal(landPasst('EU', 'CH'), false);
  assert.equal(landPasst('EU', 'KE'), false);
  assert.equal(landPasst('EU', 'US'), false);
  // Und nicht umgekehrt: Eine deutsche Meldung ist keine EU-Meldung.
  assert.equal(landPasst('DE', 'EU'), false);
});

test('ohne Land auf einer der beiden Seiten passt nichts', () => {
  assert.equal(landPasst('', 'DE'), false);
  assert.equal(landPasst('DE', ''), false);
  assert.equal(landPasst(null, null), false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Wer wird benachrichtigt — und wer nicht
// ─────────────────────────────────────────────────────────────────────────────

const beobachter = [
  { userId: 'u-de', country: 'DE', wirkstoffe: ['Amoxicillin', 'Metformin'] },
  { userId: 'u-at', country: 'AT', wirkstoffe: ['Amoxicillin'] },
  { userId: 'u-de-2', country: 'DE', wirkstoffe: ['Ibuprofen'] },
];

test('getroffen wird, wer den Wirkstoff beobachtet UND im Land ist', () => {
  const a = alarmeFuerSignal({ signal: signal({ land: 'DE', titel: 'Lieferengpass Amoxicillin 1000 mg' }), beobachter });
  assert.deepEqual(a.map((x) => x.userId), ['u-de']);
  assert.equal(a[0].wirkstoff, 'Amoxicillin');
  assert.equal(a[0].quelle, 'titel');
});

test('eine EU-Meldung erreicht AT und DE gleichzeitig', () => {
  const a = alarmeFuerSignal({ signal: signal({ land: 'EU', titel: 'Amoxicillin: Versorgungslage' }), beobachter });
  assert.deepEqual(a.map((x) => x.userId).sort(), ['u-at', 'u-de']);
});

test('EIN Hinweis je Person je Meldung, auch bei zwei passenden Wirkstoffen', () => {
  const b = [{ userId: 'u', country: 'DE', wirkstoffe: ['Amoxicillin', 'Metformin'] }];
  const a = alarmeFuerSignal({ signal: signal({ titel: 'Amoxicillin und Metformin betroffen' }), beobachter: b });
  assert.equal(a.length, 1);
});

test('eine schon gemeldete Meldung wird nicht erneut gemeldet', () => {
  const s = signal({ titel: 'Lieferengpass Amoxicillin' });
  const a = alarmeFuerSignal({
    signal: s, beobachter,
    schonGemeldet: (uid, key) => key === meldungsSchluessel(s),
  });
  assert.deepEqual(a, []);
});

test('die Tagesbremse laesst nur einen Hinweis je Wirkstoff und Tag durch', () => {
  const jetzt = Date.parse('2026-10-04T08:00:00Z');
  const a = alarmeFuerSignal({
    signal: signal({ titel: 'Amoxicillin erneut betroffen', url: 'https://www.bfarm.de/m/2' }),
    beobachter, jetzt,
    schonGemeldet: (uid, key) => key === tagesSchluessel('Amoxicillin', jetzt),
  });
  assert.deepEqual(a, []);
});

test('die Tagesbremse gilt je Wirkstoff, nicht pauschal', () => {
  const jetzt = Date.parse('2026-10-04T08:00:00Z');
  const b = [{ userId: 'u', country: 'DE', wirkstoffe: ['Amoxicillin', 'Ibuprofen'] }];
  const a = alarmeFuerSignal({
    signal: signal({ titel: 'Ibuprofen betroffen' }), beobachter: b, jetzt,
    // Amoxicillin ist heute verbraucht — Ibuprofen nicht.
    schonGemeldet: (uid, key) => key === tagesSchluessel('Amoxicillin', jetzt),
  });
  assert.deepEqual(a.map((x) => x.wirkstoff), ['Ibuprofen']);
});

test('ein Wirkstoff OHNE Treffer verbraucht kein Tagesbudget', () => {
  // Die Reihenfolge im Code ist Absicht: erst Treffer pruefen, dann Tagesbremse.
  // Andersherum haette ein beobachteter, nicht getroffener Wirkstoff den
  // Hinweis zu einem anderen blockiert.
  const jetzt = Date.parse('2026-10-04T08:00:00Z');
  const gefragt = [];
  const b = [{ userId: 'u', country: 'DE', wirkstoffe: ['Metformin', 'Amoxicillin'] }];
  alarmeFuerSignal({
    signal: signal({ titel: 'Amoxicillin betroffen' }), beobachter: b, jetzt,
    schonGemeldet: (uid, key) => { gefragt.push(key); return false; },
  });
  assert.ok(!gefragt.includes(tagesSchluessel('Metformin', jetzt)),
    'fuer den nicht getroffenen Wirkstoff darf die Tagesbremse nicht gefragt werden');
});

test('der Tagesschluessel wechselt um Mitternacht UTC', () => {
  const a = tagesSchluessel('Amoxicillin', Date.parse('2026-10-04T23:59:00Z'));
  const b = tagesSchluessel('Amoxicillin', Date.parse('2026-10-05T00:01:00Z'));
  assert.notEqual(a, b);
  assert.match(a, /2026-10-04$/);
  // Schreibweise des Wirkstoffs darf keinen zweiten Schluessel ergeben.
  assert.equal(tagesSchluessel('AMOXICILLIN', 0), tagesSchluessel(' amoxicillin ', 0));
});

test('ein unbrauchbares Signal loest nichts aus', () => {
  for (const s of [null, {}, { dedupeKey: 'x' }, { title: 'T' }]) {
    assert.deepEqual(alarmeFuerSignal({ signal: s, beobachter }), []);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Eintragen
// ─────────────────────────────────────────────────────────────────────────────

test('zugestellt wird mit Label in der Form „Wirkstoff · Quelle"', () => {
  const gesendet = [];
  const gemerkt = [];
  const s = signal({ titel: 'Lieferengpass Amoxicillin 1000 mg' });
  const res = benachrichtigeZuSignal(s, {
    beobachter, schonGemeldet: () => false,
    merkeGemeldet: (uid, key) => gemerkt.push(key),
    notify: (n) => gesendet.push(n),
  });
  assert.equal(res.gesendet, 1);
  assert.equal(gesendet[0].userId, 'u-de');
  // Dieselbe Form wie bei watch_alert: Das Frontend schneidet den Wirkstoff
  // vor dem Trennzeichen heraus, um die Ansicht darauf zu filtern.
  assert.equal(gesendet[0].label, 'Amoxicillin · BfArM');
  assert.equal(gesendet[0].refId, s.dedupeKey);
  // BEIDE Schluessel gemerkt — sonst greift eine der zwei Bremsen nicht.
  assert.equal(gemerkt.length, 2);
  assert.ok(gemerkt.includes(meldungsSchluessel(s)));
});

test('erst zustellen, dann merken — sonst geht ein Hinweis fuer immer verloren', () => {
  const gemerkt = [];
  const res = benachrichtigeZuSignal(signal({ titel: 'Amoxicillin betroffen' }), {
    beobachter, schonGemeldet: () => false,
    merkeGemeldet: (uid, key) => gemerkt.push(key),
    notify: () => { throw new Error('Zustellung kaputt'); },
    log: () => {},
  });
  assert.equal(res.gesendet, 0);
  // Der Punkt: NICHTS gemerkt. Andersherum waere die fehlgeschlagene
  // Benachrichtigung fuer immer als „schon gemeldet" verbucht, und die Person
  // haette sie nie bekommen.
  assert.deepEqual(gemerkt, []);
});

test('eine kaputte Zustellung haelt den Abruf nicht auf', () => {
  assert.doesNotThrow(() => benachrichtigeZuSignal(signal({ titel: 'Amoxicillin' }), {
    beobachter, schonGemeldet: () => false, merkeGemeldet: () => {},
    notify: () => { throw new Error('boom'); }, log: () => {},
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
//  Zusammenspiel mit dem echten Repo
// ─────────────────────────────────────────────────────────────────────────────

test('die Bremsen ueberleben einen Neustart (Snapshot)', () => {
  const repo = createShortagesRepo();
  repo.addWatch('u1', 'Amoxicillin');
  const s = signal({ titel: 'Lieferengpass Amoxicillin 1000 mg' });
  const deps = {
    beobachter: repo.listWatchers().map((b) => ({ ...b, country: 'DE' })),
    schonGemeldet: (uid, key) => repo.wasDealAlerted(uid, key),
    merkeGemeldet: (uid, key) => repo.markDealAlerted(uid, key),
    notify: () => {},
  };
  assert.equal(benachrichtigeZuSignal(s, deps).gesendet, 1);
  assert.equal(benachrichtigeZuSignal(s, deps).gesendet, 0, 'gleich nochmal: nichts');

  // Neustart nachstellen: Zustand sichern, neues Repo, laden.
  const snap = repo.__dump();
  const neu = createShortagesRepo();
  neu.__load(snap);
  const deps2 = {
    ...deps,
    beobachter: neu.listWatchers().map((b) => ({ ...b, country: 'DE' })),
    schonGemeldet: (uid, key) => neu.wasDealAlerted(uid, key),
    merkeGemeldet: (uid, key) => neu.markDealAlerted(uid, key),
  };
  // Ohne diese Zusicherung wuerde jeder Deploy jede bekannte Meldung erneut
  // melden — bei 500 Signalen und einer Beobachtungsliste von zehn
  // Wirkstoffen ist das eine Lawine, ausgeloest durch ein Deploy.
  assert.equal(benachrichtigeZuSignal(s, deps2).gesendet, 0, 'nach dem Neustart erneut gemeldet');
});

test('listWatchers liefert die Anzeigenamen, nicht die Normschluessel', () => {
  const repo = createShortagesRepo();
  repo.addWatch('u1', '  Amoxicillin  ');
  repo.addWatch('u1', 'Metformin');
  repo.addWatch('u2', 'Ibuprofen');
  const w = repo.listWatchers();
  assert.equal(w.length, 2);
  const u1 = w.find((x) => x.userId === 'u1');
  // Was die Person eingetragen hat, steht spaeter in ihrer Benachrichtigung —
  // „amoxicillin" klein waere dort eine fremde Schreibweise.
  assert.ok(u1.wirkstoffe.includes('Amoxicillin'), JSON.stringify(u1.wirkstoffe));
  assert.equal(u1.wirkstoffe.length, 2);
});

test('wer nichts beobachtet, erscheint nicht in der Liste', () => {
  const repo = createShortagesRepo();
  repo.addWatch('u1', 'Amoxicillin');
  repo.removeWatch('u1', 'Amoxicillin');
  assert.deepEqual(repo.listWatchers(), []);
});
