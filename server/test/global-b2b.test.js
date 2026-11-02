// Sprint 5 — Beschaffung international, regulatorischer Cross-Check, neue Zulassungen/Studien,
// Ausbruchs-Radar. Leitlinie: rechnen ja, schätzen nein; Quelle an jedem Eintrag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { einstandskosten, ankunft, createSourcingAnfragen, FOB_LAENDER } from '../src/services/sourcing.js';
import { createRxNormService } from '../src/services/rxnorm.js';
import { fdaLesen, ctLesen, passtZu, createMedIntAbos } from '../src/services/extern/medint.js';
import { whoLesen, regionaleSignale, createAusbruchsRadar, MIN_NEU } from '../src/services/ausbruch.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const antwort = (j) => ({ ok: true, status: 200, json: async () => j });
const fx = { convert: (a, f, t, d) => { const x = d.rates[f], y = d.rates[t]; return x && y ? (a / x) * y : null; } };
const KURSE = { rates: { EUR: 1, USD: 1.1, KES: 140, CAD: 1.5 }, quellen: { USD: 'EZB (Frankfurter)', KES: 'open.er-api.com', CAD: 'EZB (Frankfurter)' }, updated_at: 1, veraltet: false };
const nah = (a, b) => Math.abs(a - b) < 0.01;

test('Einstandskosten: CIF-Basis (Kenia), Umrechnung, Einfuhrumsatzsteuer auf Zollwert + Zoll, Preis je Einheit', () => {
  const r = einstandskosten({ zielLand: 'KE', zielWaehrung: 'KES', warenwert: 10000, waehrung: 'USD', fracht: 800, frachtWaehrung: 'USD', versicherungPct: 0.5, zollPct: 10, mwstPct: 16, gebuehren: 5000, menge: 1000 }, fx, KURSE);
  const p = Object.fromEntries(r.posten.map((x) => [x.art, x.betrag]));
  assert.ok(nah(p.ware, 1272727.27) && nah(p.fracht, 101818.18), 'Umrechnung USD→KES falsch');
  assert.ok(nah(p.versicherung, 6872.73));
  assert.equal(r.zoll_basis, 'CIF');
  assert.ok(nah(p.zoll, 138141.82), 'Zoll nicht auf CIF');
  assert.ok(nah(p.mwst, 243129.6), 'Einfuhrumsatzsteuer nicht auf Zollwert + Zoll');
  assert.ok(nah(r.gesamt, 1767689.6) && nah(r.je_einheit, 1767.69));
  assert.deepEqual(r.kurse.quellen, ['EZB (Frankfurter)', 'open.er-api.com'], 'Kursquelle fehlt');
});

test('Einstandskosten: FOB-Basis für Kanada/USA, Basis wählbar; fehlender Kurs und Unsinn → klare Fehler, nie mit 1 gerechnet', () => {
  assert.ok(FOB_LAENDER.has('CA') && FOB_LAENDER.has('US'));
  const ca = einstandskosten({ zielLand: 'CA', zielWaehrung: 'CAD', warenwert: 100, waehrung: 'USD', fracht: 50, zollPct: 10 }, fx, KURSE);
  assert.equal(ca.zoll_basis, 'FOB');
  assert.ok(nah(ca.posten.find((x) => x.art === 'zoll').betrag, 13.64), 'Zoll in Kanada auf Fracht gerechnet');
  assert.equal(einstandskosten({ zielLand: 'CA', zielWaehrung: 'CAD', warenwert: 100, waehrung: 'USD', fracht: 50, zollPct: 10, zollBasis: 'CIF' }, fx, KURSE).zoll_basis, 'CIF');
  assert.throws(() => einstandskosten({ zielLand: 'KE', zielWaehrung: 'XAF', warenwert: 1, waehrung: 'USD' }, fx, KURSE), (e) => e.code === 'kurs_fehlt');
  assert.throws(() => einstandskosten({ zielLand: 'KE', zielWaehrung: 'KES', warenwert: 1 }, fx, null), (e) => e.code === 'kurs_fehlt' && e.status === 503);
  assert.throws(() => einstandskosten({ zielLand: 'KE', zielWaehrung: 'KES', warenwert: -5 }, fx, KURSE), (e) => e.code === 'sourcing_zahl');
  assert.throws(() => einstandskosten({ zielLand: 'KE', zielWaehrung: 'KES', warenwert: 0 }, fx, KURSE), (e) => e.code === 'sourcing_warenwert');
  assert.throws(() => einstandskosten({ zielLand: 'KE', zielWaehrung: 'KES', warenwert: 5, mwstPct: 150 }, fx, KURSE), (e) => e.code === 'sourcing_zahl');
  assert.equal(ankunft({ transitTage: 30, ab: '2026-11-01' }), '2026-12-01');
  assert.equal(ankunft({ transitTage: '' }), null, 'Ankunft ohne Transitzeit erfunden');
});

test('Proforma-Anfragen: Pflichtfelder, Incoterm, Status, Grenze, Sicherung', () => {
  let uhr = 1_790_000_000_000;
  const a = createSourcingAnfragen({ jetzt: () => uhr++ });
  assert.throws(() => a.erstellen('u1', { produkt: 'x' }), (e) => e.code === 'sourcing_produkt');
  assert.throws(() => a.erstellen('u1', { produkt: 'Amoxicillin', herkunft: 'IN', ziel: 'KE' }), (e) => e.code === 'sourcing_menge');
  assert.throws(() => a.erstellen('u1', { produkt: 'Amoxicillin', menge: '10.000', herkunft: 'Indien', ziel: 'KE' }), (e) => e.code === 'sourcing_land');
  const x = a.erstellen('u1', { produkt: 'Amoxicillin 500 mg', menge: '10.000 Kapseln', herkunft: 'in', ziel: 'ke', incoterm: 'cif', transport: 'see' });
  assert.deepEqual([x.herkunft, x.ziel, x.incoterm, x.status], ['IN', 'KE', 'CIF', 'neu']);
  assert.equal(a.erstellen('u1', { produkt: 'Metformin', menge: '1', herkunft: 'IN', ziel: 'KE', incoterm: 'XYZ' }).incoterm, null, 'unbekannter Incoterm übernommen');
  assert.throws(() => a.status(x.id, 'erfunden'), (e) => e.code === 'sourcing_status');
  assert.equal(a.status(x.id, 'beantwortet', 'Angebot per E-Mail').antwort, 'Angebot per E-Mail');
  assert.equal(a.alle()[0].status, 'neu', 'offene Anfragen nicht zuerst');
  for (let i = 0; i < 19; i++) a.erstellen('u2', { produkt: 'P' + i, menge: '1', herkunft: 'IN', ziel: 'KE' });
  a.erstellen('u2', { produkt: 'P19', menge: '1', herkunft: 'IN', ziel: 'KE' });
  assert.throws(() => a.erstellen('u2', { produkt: 'P20', menge: '1', herkunft: 'IN', ziel: 'KE' }), (e) => e.code === 'sourcing_zu_viele');
  const b = createSourcingAnfragen(); b.__load(JSON.parse(JSON.stringify(a.__dump())));
  assert.equal(b.meine('u1').length, 2);
});

test('ATC-Gruppe (RxClass): Gruppe Stufe 4, Mitglieder ohne den Wirkstoff selbst, Hinweis „nicht austauschbar"; Netzfehler → null, nicht gemerkt', async () => {
  let netz = true; const urls = [];
  const rx = createRxNormService({ log: { warn() {} }, fetchImpl: async (u) => {
    urls.push(u); if (!netz) throw new Error('offline');
    if (u.includes('byDrugName')) return antwort({ rxclassDrugInfoList: { rxclassDrugInfo: [
      { rxclassMinConceptItem: { classId: 'J01CA', className: 'Penicillins with extended spectrum', classType: 'ATC1-4' } },
      { rxclassMinConceptItem: { classId: 'J01CA', className: 'Penicillins with extended spectrum', classType: 'ATC1-4' } },
      { rxclassMinConceptItem: { classId: 'J01', className: 'zu grob', classType: 'ATC1-4' } }] } });
    return antwort({ drugMemberGroup: { drugMember: [{ minConcept: { name: 'amoxicillin' } }, { minConcept: { name: 'ampicillin' } }, { minConcept: { name: 'pivampicillin' } }] } });
  } });
  const r = await rx.atcGruppe('Amoxicillin');
  assert.equal(r.klassen.length, 1, 'grobe oder doppelte ATC-Klasse übernommen');
  assert.deepEqual(r.klassen[0], { id: 'J01CA', name: 'Penicillins with extended spectrum', mitglieder: ['ampicillin', 'pivampicillin'] });
  assert.match(r.hinweis, /keine Aussage über Austauschbarkeit/i);
  assert.ok(urls.some((u) => u.includes('classMembers.json?classId=J01CA&relaSource=ATC&ttys=IN')));
  netz = false;
  assert.equal(await rx.atcGruppe('Metformin'), null);
  netz = true;
  assert.ok(await rx.atcGruppe('Metformin'), 'Netzfehler wurde gemerkt');
});

test('Neue Zulassungen/Studien: openFDA nur Erstzulassungen im Zeitraum, Link zur FDA; ClinicalTrials mit Register-Link; Fachgebiet passt', () => {
  const fda = { results: [
    { application_number: 'NDA219001', sponsor_name: 'Pharma X', submissions: [{ submission_type: 'ORIG', submission_status: 'AP', submission_status_date: '20261020' }], products: [{ brand_name: 'ONCOVIA', active_ingredients: [{ name: 'ZOLITINIB' }], dosage_form: 'TABLET' }], openfda: { generic_name: ['zolitinib'], pharm_class_epc: ['Kinase Inhibitor [EPC]'] } },
    { application_number: 'ANDA2', submissions: [{ submission_type: 'SUPPL', submission_status: 'AP', submission_status_date: '20261021' }], products: [{ brand_name: 'ALT' }] },
    { application_number: 'NDA3', submissions: [{ submission_type: 'ORIG', submission_status: 'AP', submission_status_date: '20240101' }], products: [{ brand_name: 'ALT2' }] },
  ] };
  const z = fdaLesen(fda, { ab: '20260901' });
  assert.equal(z.length, 1, 'Ergänzung oder alte Zulassung als neu gezählt');
  assert.deepEqual([z[0].titel, z[0].datum, z[0].wirkstoffe[0]], ['ONCOVIA', '2026-10-20', 'zolitinib']);
  assert.equal(z[0].link, 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=219001');
  assert.equal(passtZu(z[0], 'onkologie'), true); assert.equal(passtZu(z[0], 'diabetes'), false);
  assert.throws(() => fdaLesen({ error: { code: 'NOT_FOUND' } }, { ab: '1' }), /keine Ergebnisliste/);
  const st = ctLesen({ studies: [{ protocolSection: { identificationModule: { nctId: 'NCT01234567', briefTitle: 'Study A' }, statusModule: { resultsFirstPostDateStruct: { date: '2026-10-15' } }, designModule: { phases: ['PHASE3'] }, armsInterventionsModule: { interventions: [{ name: 'Drug B' }] } } }, { protocolSection: {} }] });
  assert.equal(st.length, 1);
  assert.deepEqual([st[0].link, st[0].datum, st[0].phase], ['https://clinicaltrials.gov/study/NCT01234567', '2026-10-15', 'PHASE3']);
});

test('Zulassungs-Abo: erster Lauf still, danach nur passende neue Einträge, je Eintrag einmal', () => {
  const ab = createMedIntAbos();
  assert.deepEqual(ab.setzen('onko', ['onkologie', 'quatsch']), ['onkologie']);
  ab.setzen('dia', ['diabetes']);
  const alt = { id: 'fda:1', art: 'zulassung', klassen: ['Kinase Inhibitor [EPC]'] };
  assert.deepEqual(ab.neue([alt]), [], 'erster Lauf hat benachrichtigt');
  const neu = { id: 'fda:2', art: 'zulassung', klassen: ['Programmed Death Receptor-1 Blocker [EPC]'] };
  const r = ab.neue([alt, neu]);
  assert.deepEqual(r.map((x) => [x.userId, x.eintrag.id]), [['onko', 'fda:2']]);
  assert.deepEqual(ab.neue([alt, neu]), [], 'doppelt benachrichtigt');
  const b = createMedIntAbos(); b.__load(JSON.parse(JSON.stringify(ab.__dump())));
  assert.deepEqual(b.von('onko'), ['onkologie']);
  assert.deepEqual(b.neue([neu]), [], 'nach Neustart erneut gemeldet');
});

test('Ausbruchs-Radar: WHO-Meldungen mit Link; Signal erst ab 3 neuen und doppelt so vielen wie davor; Alarm-Pause je Wirkstoff+Region', () => {
  const w = whoLesen({ value: [{ Title: 'Cholera – Country A', PublicationDateAndTime: '2026-10-28T10:00:00Z', ItemDefaultUrl: '/2026-DON590' }, { Title: '', PublicationDateAndTime: 'x' }] });
  assert.deepEqual(w, [{ titel: 'Cholera – Country A', datum: '2026-10-28', link: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON590', quelle: 'WHO Disease Outbreak News' }]);
  assert.throws(() => whoLesen({}), /keine Meldungsliste/);
  const heute = Date.parse('2026-11-01T12:00:00Z');
  const d = (n) => new Date(heute - n * 86_400_000).toISOString().slice(0, 10);
  const regionVon = (cc) => ({ KE: 'AFRICA', UG: 'AFRICA', TZ: 'AFRICA', EG: 'AFRICA', DE: 'EUROPE' })[cc] || null;
  const meldungen = [
    { country: 'KE', wirkstoff: 'Oxytocin', gemeldet_am: d(2), provenance: 'community' },
    { country: 'UG', wirkstoff: 'oxytocin', gemeldet_am: d(5), provenance: 'community' },
    { country: 'DE', wirkstoff: 'Oxytocin', gemeldet_am: d(3), provenance: 'community' },
    { country: 'EG', wirkstoff: 'Insulin', gemeldet_am: d(1), provenance: 'community' },
    { country: 'EG', wirkstoff: 'Insulin', gemeldet_am: d(2), provenance: 'verified' }, // amtlich zählt über die Chronik, nicht doppelt
  ];
  const episoden = [{ land: 'TZ', wirkstoff: 'Oxytocin', erstmals_gesehen: d(4) }];
  const s = regionaleSignale({ episoden, meldungen, regionVon, heute });
  assert.equal(s.length, 1, 'Signal ohne Schwelle oder mit Europa vermischt');
  assert.deepEqual([s[0].region, s[0].neu, s[0].vorher, s[0].amtlich, s[0].apotheken, s[0].laender], ['AFRICA', MIN_NEU, 0, 1, 2, ['KE', 'TZ', 'UG']]);
  // davor genauso viele → kein Anstieg
  const flach = regionaleSignale({ episoden, meldungen: [...meldungen, ...['KE', 'UG'].map((c) => ({ country: c, wirkstoff: 'Oxytocin', gemeldet_am: d(20), provenance: 'community' }))], regionVon, heute });
  assert.equal(flach.length, 0, 'gleichbleibende Lage als Anstieg gemeldet');
  let uhr = heute;
  const r = createAusbruchsRadar({ speicher: { get: () => null, set() {} }, fetchImpl: async () => antwort({}), jetzt: () => uhr });
  assert.equal(r.zuMelden(s).length, 1);
  assert.equal(r.zuMelden(s).length, 0, 'Alarm ohne Pause wiederholt');
  uhr += 15 * 86_400_000;
  assert.equal(r.zuMelden(s).length, 1, 'nach 14 Tagen nicht erneut gemeldet');
});

test('HTTP: Bremsen — RxNorm-Abrufe je Konto (Prüfung still, Cross-Check 429), Proforma-Anfragen je Stunde', { timeout: 90000 }, async () => {
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'b2b-2', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', DATABASE_URL: '', APOPULSE_DATA_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    const B = `http://localhost:${port}`;
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'gh', email: 'gh@br.test', password: 'Passwort-1234', country: 'KE', accountType: 'wholesale' }) })).json()).token;
    const H = { 'content-type': 'application/json', authorization: 'Bearer ' + tok };
    for (let i = 0; i < 60; i++) {
      const r = await (await fetch(B + '/api/wirkstoff-pruefen?name=Xylofantin' + String.fromCharCode(97 + (i % 26)) + i, { headers: H })).json();
      assert.equal(r.begrenzt, undefined, `Abruf ${i + 1} schon begrenzt`);
    }
    const zuViel = await (await fetch(B + '/api/wirkstoff-pruefen?name=Xylofantinzz', { headers: H })).json();
    assert.deepEqual([zuViel.begrenzt, zuViel.vorschlaege], [true, []], 'RxNorm-Abrufe je Konto nicht begrenzt');
    const cx = await fetch(B + '/api/crosscheck?wirkstoff=Amoxicillin&land=KE', { headers: H });
    assert.equal(cx.status, 429); assert.equal((await cx.json()).code, 'abfragen_zu_viele');
    for (let i = 0; i < 10; i++) {
      const r = await fetch(B + '/api/sourcing/anfrage', { method: 'POST', headers: H, body: JSON.stringify({ produkt: 'P' + i, menge: '1', herkunft: 'IN', ziel: 'KE' }) });
      assert.equal(r.status, 200, 'Anfrage ' + (i + 1));
    }
    const elf = await fetch(B + '/api/sourcing/anfrage', { method: 'POST', headers: H, body: JSON.stringify({ produkt: 'P11', menge: '1', herkunft: 'IN', ziel: 'KE' }) });
    assert.equal(elf.status, 429); assert.equal((await elf.json()).code, 'sourcing_zu_schnell');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('HTTP: Fachkreise-Sperre, Rechnung mit gesicherten Kursen, Anfrage → Cockpit → Antwort, Cross-Check ehrlich, Ausbruchs-Alarm nur an andere Regionen', { timeout: 90000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'apo-b2b-'));
  const datei = join(dir, 'stand.json');
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'b2b-1', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', APOPULSE_RXNORM: 'off', DATABASE_URL: '', APOPULSE_DATA_FILE: datei,
    APOPULSE_ADMIN_EMAIL: 'red@b2b.test', APOPULSE_ADMIN_PASSWORD: 'b2b-test-PW-123' };
  let kind, log = '';
  const starte = async () => {
    log = ''; kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
  };
  const ende = () => new Promise((ok) => { if (!kind || kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  try {
    // 1) Frischstart legt die Redaktion an; beim Beenden wird gesichert.
    await starte(); await ende();
    // 2) Gesicherte Kurse einfügen (Quellen bleiben offline) und neu starten.
    const stand = JSON.parse(readFileSync(datei, 'utf8'));
    stand.kurse = { fx: { data: { base: 'EUR', rates: { EUR: 1, USD: 1.1, KES: 140 }, quellen: { USD: 'EZB (Frankfurter)', KES: 'open.er-api.com' }, updated_at: Date.now() } } };
    writeFileSync(datei, JSON.stringify(stand));
    const port = await starte();
    const B = `http://localhost:${port}`;
    const H = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
    const reg = async (n, country, accountType) => (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, email: n + '@b2b.test', password: 'Passwort-1234', country, accountType }) })).json()).token;
    const j = async (m, p, t, b) => { const r = await fetch(B + p, { method: m, headers: H(t), body: b ? JSON.stringify(b) : undefined }); return [r.status, await r.json()]; };
    const [ghKE, ghDE, ghUG, privat] = [await reg('ghke', 'KE', 'wholesale'), await reg('ghde', 'DE', 'wholesale'), await reg('ghug', 'UG', 'wholesale'), await reg('pv', 'KE', 'private')];
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'red@b2b.test', password: 'b2b-test-PW-123' }) })).json()).token;
    // Fachkreise-Sperre
    for (const [m, p] of [['POST', '/api/sourcing/kalkulation'], ['GET', '/api/crosscheck?wirkstoff=Amoxicillin'], ['GET', '/api/medint'], ['GET', '/api/ausbruch']]) {
      assert.equal((await j(m, p, privat, m === 'POST' ? {} : undefined))[0], 403, `${p} für Privatkonto offen`);
    }
    // Rechnung mit gesicherten Kursen (Quellen offline)
    const [st, k] = await j('POST', '/api/sourcing/kalkulation', ghKE, { zielLand: 'KE', zielWaehrung: 'KES', warenwert: 1000, waehrung: 'USD', zollPct: 10, transitTage: 30, transport: 'see' });
    assert.equal(st, 200, JSON.stringify(k));
    assert.ok(nah(k.posten[0].betrag, 127272.73));
    assert.match(k.ankunft, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(k.hafen && k.hafen.id, 'mombasa', 'Zielhafen Mombasa fehlt');
    assert.deepEqual(k.hafen.hinweise, [], 'Wetterwarnung ohne Daten erfunden');
    // Anfrage → Cockpit → Antwort
    const [sa, a] = await j('POST', '/api/sourcing/anfrage', ghKE, { produkt: 'Amoxicillin 500 mg', menge: '10.000 Kapseln', herkunft: 'IN', ziel: 'KE', incoterm: 'CIF' });
    assert.equal(sa, 200); assert.equal(a.userId, undefined, 'Benutzer-ID nach außen');
    assert.equal((await j('GET', '/api/sourcing/anfragen/alle', ghKE))[0], 403, 'Cockpit für Kund:innen offen');
    const alleAntwort = await j('GET', '/api/sourcing/anfragen/alle', red);
    assert.equal(alleAntwort[0], 200, JSON.stringify(alleAntwort[1]));
    const alle = alleAntwort[1].anfragen;
    assert.equal(alle[0].betrieb.handle && alle[0].betrieb.art, 'wholesale');
    const nRed = (await j('GET', '/api/notifications', red))[1].notifications;
    assert.ok(nRed.some((n) => n.type === 'sourcing_anfrage'), 'Handelsteam nicht benachrichtigt');
    await j('POST', `/api/sourcing/anfragen/${a.id}/status`, red, { status: 'beantwortet', antwort: 'Angebot folgt per E-Mail' });
    const meine = (await j('GET', '/api/sourcing/anfragen', ghKE))[1].anfragen;
    assert.deepEqual([meine[0].status, meine[0].antwort], ['beantwortet', 'Angebot folgt per E-Mail']);
    assert.ok((await j('GET', '/api/notifications', ghKE))[1].notifications.some((n) => n.type === 'sourcing_antwort'));
    // Cross-Check: keine Zulassungsbehauptung, Behörde verlinkt, ohne RxNorm ehrlich „nicht verfügbar"
    const cx = (await j('GET', '/api/crosscheck?wirkstoff=Amoxicillin&land=MA', ghKE))[1];
    assert.deepEqual([cx.zulassung_bekannt, cx.behoerde.name, cx.atc_verfuegbar], [false, 'AMMPS', false]);
    // Medint/WHO offline: ehrlich nicht verfügbar
    const mi = (await j('GET', '/api/medint?bereich=onkologie', ghKE))[1];
    assert.deepEqual([mi.zulassungen.verfuegbar, mi.studien.verfuegbar], [false, false]);
    // Ausbruch: 3 Apotheken-Meldungen in drei afrikanischen Ländern → Signal AFRICA
    for (const c of ['KE', 'UG', 'TZ']) {
      const apo = await reg('apo' + c, c, 'pharmacy');
      await j('POST', '/api/shortages/report', apo, { wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: c });
    }
    const ab = (await j('GET', '/api/ausbruch?country=DE', ghDE))[1];
    const sig = ab.signale.find((s) => s.wirkstoff === 'Oxytocin');
    assert.ok(sig && sig.region === 'AFRICA' && sig.neu === 3, 'Anstieg nicht erkannt: ' + JSON.stringify(ab.signale));
    assert.deepEqual(sig.preise, [], 'Preise ohne Lieferantendaten erfunden');
    assert.equal((await j('POST', '/api/b2b/lauf', ghKE))[0], 403, 'Lauf für Kund:innen auslösbar');
    const lauf = (await j('POST', '/api/b2b/lauf', red))[1];
    assert.ok(lauf.alarme >= 1, JSON.stringify(lauf));
    const hatAlarm = async (t) => (await j('GET', '/api/notifications', t))[1].notifications.some((n) => n.type === 'ausbruch_signal');
    assert.equal(await hatAlarm(ghDE), true, 'Großhandel in Europa nicht gewarnt');
    assert.equal(await hatAlarm(ghUG), false, 'Großhandel in der betroffenen Region bekam die Fernwarnung');
    assert.equal((await j('POST', '/api/b2b/lauf', red))[1].alarme, 0, 'Alarm sofort wiederholt');
  } finally {
    await ende();
    rmSync(dir, { recursive: true, force: true });
  }
});
