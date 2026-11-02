// Vertrauens-Engine (Sprint 4): Stufen OFFIZIELL / HOHE ZUVERLÄSSIGKEIT / COMMUNITY-VERIFIZIERT /
// UNGEPRÜFT / STATUS UNKLAR / UMSTRITTEN, Vertrauenswert 0–100, Widerspruch mit Grund.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createSocialService } from '../src/services/social.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createShortagesService, PRUEFEN_NACH_TAGEN } from '../src/services/shortages.js';
import { bewerte, UMSTRITTEN_AB } from '../src/domain/vertrauen.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const plus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

test('bewerte: Vorrang der Stufen und nachvollziehbarer Vertrauenswert', () => {
  const c = (x) => bewerte({ provenance: 'community', bestaetigt: false, zaehlend: 1, aktualitaet: 'aktuell', ...x });
  assert.deepEqual(bewerte({ provenance: 'verified', zaehlend: 0, bestaetigt: false, aktualitaet: 'aktuell' }), { stufe: 'offiziell', punkte: 100 });
  assert.equal(bewerte({ provenance: 'editorial', zaehlend: 0, bestaetigt: false, aktualitaet: 'aktuell' }).stufe, 'redaktion');
  assert.deepEqual(c({}), { stufe: 'ungeprueft', punkte: 25 });
  assert.deepEqual(c({ zaehlend: 2 }), { stufe: 'ungeprueft', punkte: 45 }, 'Nachbar-Apotheke bestätigt → Wert steigt');
  assert.deepEqual(c({ zaehlend: 3, bestaetigt: true }), { stufe: 'bestaetigt', punkte: 65 });
  assert.equal(c({ zaehlend: 9, bestaetigt: true }).punkte, 75, 'Deckel +50 fehlt');
  assert.deepEqual(c({ fachbetrieb: true }), { stufe: 'hoch', punkte: 85 }, 'verifizierter Großhandel/Hersteller');
  assert.equal(c({ zaehlend: 3, bestaetigt: true, aktualitaet: 'pruefen' }).stufe, 'unklar', '14 Tage ohne Bestätigung');
  assert.equal(c({ fachbetrieb: true, aktualitaet: 'pruefen' }).stufe, 'unklar', 'Fachbetrieb schützt nicht vor Veralten');
  assert.equal(c({ widersprueche: UMSTRITTEN_AB }).stufe, 'umstritten');
  assert.equal(c({ widersprueche: 1 }).stufe, 'ungeprueft', 'ein einzelner Widerspruch reicht nicht');
  assert.equal(c({ zaehlend: 5, bestaetigt: true, widersprueche: 2 }).stufe, 'bestaetigt', '5 bestätigen, 2 widersprechen: regional verschieden, nicht umstritten');
  assert.equal(c({ zaehlend: 5, bestaetigt: true, widersprueche: 2 }).punkte, 25);
  assert.deepEqual(c({ fachbetrieb: true, redaktionZweifel: true }), { stufe: 'umstritten', punkte: 10 });
  assert.equal(c({ widersprueche: 9 }).punkte, 0, 'Wert unter 0');
});

function aufbau() {
  let tag = new Date().toISOString().slice(0, 10);
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  let mods = new Set();
  const social = createSocialService(socialRepo, repo, { isModerator: (u) => mods.has(u) });
  const shortagesRepo = createShortagesRepo({ seed: false });
  const svc = createShortagesService(shortagesRepo, social, { today: () => tag });
  let i = 0;
  const anlegen = (accountType = 'pharmacy', { verified = false, mod = false } = {}) => {
    const name = `Betrieb ${++i}`;
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: `b${i}@vt.test`, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle: `b${i}vt`, displayName: name, country: 'NG', accountType });
    if (verified) socialRepo.setProfileVerified(r.user.id, true);
    if (mod) mods.add(r.user.id);
    return r.user.id;
  };
  return { svc, social, anlegen, vor: (n) => { tag = plus(tag, n); } };
}

test('Ablauf: ungeprüft → Community-verifiziert → 14 Tage → Status unklar; „Noch knapp" frischt auf', () => {
  const { svc, anlegen, vor } = aufbau();
  const [a, b, c, d] = [anlegen(), anlegen(), anlegen(), anlegen()];
  const m = svc.reportShortage(a, { wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: 'NG' });
  assert.deepEqual(m.vertrauen, { stufe: 'ungeprueft', punkte: 25 });
  assert.equal(svc.confirmShortage(b, m.id).vertrauen.punkte, 45);
  const v = svc.confirmShortage(c, m.id);
  assert.deepEqual(v.vertrauen, { stufe: 'bestaetigt', punkte: 65 });
  vor(PRUEFEN_NACH_TAGEN);
  const alt = svc.fuerAnzeige(d, svc.get(m.id));
  assert.equal(alt.vertrauen.stufe, 'unklar', 'nach 14 Tagen ohne Bestätigung nicht „Status unklar"');
  assert.equal(alt.vertrauen.punkte, 45);
  assert.equal(svc.nochAktuell(d, m.id).vertrauen.stufe, 'bestaetigt', 'erneute Bestätigung frischt nicht auf');
});

test('Verifizierter Großhandel/Hersteller → hohe Zuverlässigkeit; unverifiziert nicht', () => {
  const { svc, anlegen } = aufbau();
  const gh = anlegen('wholesale', { verified: true });
  const m = svc.reportShortage(gh, { wirkstoff: 'Artemether', bezeichnung: 'Artemether/Lumefantrin', status: 'eingeschraenkt', country: 'NG' });
  assert.deepEqual(m.vertrauen, { stufe: 'hoch', punkte: 85 });
  const ungeprueft = svc.reportShortage(anlegen('wholesale'), { wirkstoff: 'Insulin', bezeichnung: 'Insulin', status: 'kritisch', country: 'NG' });
  assert.equal(ungeprueft.vertrauen.stufe, 'ungeprueft', 'unverifizierter Großhandel gilt als hohe Zuverlässigkeit');
  const apo = svc.reportShortage(anlegen('pharmacy', { verified: true }), { wirkstoff: 'Metformin', bezeichnung: 'Metformin', status: 'kritisch', country: 'NG' });
  assert.deepEqual(apo.vertrauen, { stufe: 'ungeprueft', punkte: 35 }, 'verifizierte Apotheke ist nicht „hoch", aber +10');
  const hersteller = anlegen('pharma', { verified: true });
  assert.equal(svc.confirmShortage(hersteller, apo.id).vertrauen.stufe, 'hoch', 'Bestätigung eines verifizierten Herstellers zählt nicht');
});

test('Widerspruch: Grund Pflicht, umstritten ab 2, Bestätigen hebt eigenen Widerspruch auf, keine Benutzer-IDs nach außen', () => {
  const { svc, social, anlegen } = aufbau();
  const [a, b, c, d] = [anlegen(), anlegen(), anlegen(), anlegen()];
  const m = svc.reportShortage(a, { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 500 mg', status: 'kritisch', country: 'NG' });
  assert.throws(() => svc.widersprechen(b, m.id, {}), (e) => e.code === 'widerspruch_grund');
  assert.throws(() => svc.widersprechen(a, m.id, { grund: 'doppelt' }), (e) => e.code === 'widerspruch_eigene');
  assert.throws(() => svc.widersprechen(anlegen('private'), m.id, { grund: 'doppelt' }), (e) => e.code === 'shortage_pro_only');
  const w1 = svc.widersprechen(b, m.id, { grund: 'bei_uns_lieferbar', text: 'Heute geliefert' });
  assert.equal(w1.vertrauen.stufe, 'ungeprueft');
  assert.equal(w1.i_disputed, true);
  assert.equal(w1.widersprueche, undefined, 'rohe Widersprüche (mit Benutzer-IDs) nach außen');
  assert.ok(social.notifications(a).some((n) => n.type === 'shortage_widerspruch' && !n.actor), 'Meldende nicht (anonym) benachrichtigt');
  svc.widerspruchZuruecknehmen(b, m.id); svc.widersprechen(b, m.id, { grund: 'bei_uns_lieferbar' }); // Hin und Her
  assert.equal(social.notifications(a).filter((n) => n.type === 'shortage_widerspruch').length, 1, 'Meldende per Hin und Her mit Benachrichtigungen geflutet');
  svc.widersprechen(b, m.id, { grund: 'doppelt' }); // zweites Mal: ersetzt, zählt nicht doppelt
  const w2 = svc.widersprechen(c, m.id, { grund: 'bei_uns_lieferbar' });
  assert.deepEqual([w2.widerspruch_anzahl, w2.vertrauen.stufe], [2, 'umstritten']);
  assert.deepEqual(w2.widerspruch_gruende, { doppelt: 1, bei_uns_lieferbar: 1 });
  assert.equal(JSON.stringify(w2).includes(b), false, 'Benutzer-ID der Widersprechenden sichtbar');
  // c bestätigt doch: Widerspruch weg, Bestätigung zählt
  const w3 = svc.confirmShortage(c, m.id);
  assert.deepEqual([w3.widerspruch_anzahl, w3.confirm_count, w3.i_disputed], [1, 1, false]);
  // d widerspricht nach Bestätigung: Bestätigung weg
  svc.confirmShortage(d, m.id);
  const w4 = svc.widersprechen(d, m.id, { grund: 'sonstiges' });
  assert.deepEqual([w4.confirm_count, w4.widerspruch_anzahl], [1, 2]);
  assert.equal(svc.widerspruchZuruecknehmen(d, m.id).widerspruch_anzahl, 1);
});

test('Redaktion: Zweifel nur mit Begründung, sofort „umstritten", Begründung öffentlich; amtliche Zeilen nicht', () => {
  const { svc, anlegen } = aufbau();
  const gh = anlegen('wholesale', { verified: true });
  const red = anlegen('pharmacy', { mod: true });
  const m = svc.reportShortage(gh, { wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol', status: 'kritisch', country: 'NG' });
  assert.throws(() => svc.widersprechen(red, m.id, { grund: 'falscher_wirkstoff' }), (e) => e.code === 'widerspruch_text');
  const z = svc.widersprechen(red, m.id, { grund: 'falscher_wirkstoff', text: 'Gemeint ist Salmeterol' });
  assert.deepEqual(z.vertrauen, { stufe: 'umstritten', punkte: 10 });
  assert.equal(z.redaktion_zweifel, 'Gemeint ist Salmeterol');
  assert.equal(z.widerspruch_anzahl, 0, 'Redaktion als Community-Widerspruch gezählt');
});

test('HTTP: Vertrauen in /api/shortages, Widerspruch-Routen, amtlich nicht widersprechbar', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'vt-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', DATABASE_URL: '', APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    const B = `http://localhost:${port}`;
    const reg = async (n) => (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Apo ' + n, email: `${n}@vt.test`, password: 'Passwort-1234', country: 'KE', accountType: 'pharmacy' }) })).json()).token;
    const H = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
    const [a, b, c] = [await reg('a'), await reg('b'), await reg('c')];
    const m = await (await fetch(B + '/api/shortages/report', { method: 'POST', headers: H(a), body: JSON.stringify({ wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: 'KE' }) })).json();
    assert.equal(m.vertrauen.stufe, 'ungeprueft');
    for (const t of [b, c]) {
      const r = await fetch(B + `/api/shortages/${m.id}/widerspruch`, { method: 'POST', headers: H(t), body: JSON.stringify({ grund: 'bei_uns_lieferbar' }) });
      assert.equal(r.status, 200);
    }
    const liste = await (await fetch(B + '/api/shortages?country=KE', { headers: H(a) })).json();
    const z = liste.shortages.find((s) => s.id === m.id);
    assert.deepEqual([z.vertrauen.stufe, z.widerspruch_anzahl], ['umstritten', 2]);
    const del = await (await fetch(B + `/api/shortages/${m.id}/widerspruch`, { method: 'DELETE', headers: H(b) })).json();
    assert.equal(del.widerspruch_anzahl, 1);
    const ohne = await fetch(B + `/api/shortages/${m.id}/widerspruch`, { method: 'POST', headers: H(b), body: JSON.stringify({}) });
    assert.equal(ohne.status, 400);
    assert.equal((await ohne.json()).code, 'widerspruch_grund');
    // Jede Zeile trägt eine Stufe — auch amtliche (falls Seed vorhanden).
    assert.ok(liste.shortages.every((s) => s.vertrauen && s.vertrauen.stufe), 'Zeile ohne Vertrauensstufe');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
