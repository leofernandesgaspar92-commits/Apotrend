// Schein-Konten bremsen: „bestätigt" (ab 3 Apotheken) zählt nur Konten, die
// mindestens ZAEHLT_AB_STUNDEN alt sind. Vorher reichten zwei frisch angelegte
// Schein-Apotheken, um jede Meldung als „von 3 Apotheken bestätigt" zu zeigen —
// in Ländern ohne Behördenliste die stärkste Aussage der Plattform.
// Dazu: Die Login-Bremse ließ sich mit wechselndem X-Forwarded-For umgehen.
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
import { createShortagesService, vertrauenEinstellen, ZAEHLT_AB_STUNDEN } from '../src/services/shortages.js';
import { regionLage } from '../src/services/regionLage.js';
import { COUNTRIES, laenderInRegion } from '../src/data/countries.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const STUNDE = 3600000;

test('Neue Konten zählen erst nach 24 Stunden — dann kommt der Alarm von selbst, genau einmal', () => {
  let jetzt = Date.parse('2026-10-14T08:00:00Z');
  const seit = new Map();
  vertrauenEinstellen({ kontoSeit: (uid) => seit.get(uid) || null, jetzt: () => jetzt });
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const svc = createShortagesService(shortagesRepo, social, { today: () => new Date(jetzt).toISOString().slice(0, 10) });
  const anlegen = (name, alterStunden) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: name.replace(/\W/g, '') + '@sk.test', password: 'geheim123' } });
    social.createProfile(r.user.id, { handle: name.replace(/\W/g, '').toLowerCase(), displayName: name, country: 'UG', accountType: 'pharmacy' });
    seit.set(r.user.id, new Date(jetzt - alterStunden * STUNDE).toISOString());
    return r.user.id;
  };
  const alt = anlegen('Apo Alt', 72);
  const beob = anlegen('Beobachterin', 72);
  svc.watch(beob, 'Ceftriaxone');
  const m = svc.reportShortage(alt, { wirkstoff: 'Ceftriaxone', bezeichnung: 'Ceftriaxone 1 g', status: 'kritisch', country: 'UG' });
  const neu1 = anlegen('Schein 1', 0); const neu2 = anlegen('Schein 2', 1);
  svc.confirmShortage(neu1, m.id);
  const z = svc.confirmShortage(neu2, m.id);
  assert.deepEqual([z.apotheken, z.bestaetigt, z.apotheken_neu], [3, false, 2], 'frische Konten bestätigen sofort');
  const alarme = () => social.notifications(beob).filter((n) => n.type === 'shortage_bestaetigt').length;
  assert.equal(alarme(), 0, 'Alarm schon mit Schein-Konten');
  const lage = () => regionLage({ shortagesRepo, chronik: { aufzeichnungSeit: () => null }, laender: COUNTRIES, codes: laenderInRegion('AFRICA'), heute: new Date(jetzt).toISOString().slice(0, 10) }).laender.find((l) => l.land === 'UG');
  assert.equal(lage().apotheken_bestaetigt, 0);
  svc.erinnern();
  assert.equal(alarme(), 0);

  jetzt += (ZAEHLT_AB_STUNDEN + 1) * STUNDE;
  const danach = svc.listWithCounts(beob, { country: 'UG' }).find((s) => s.id === m.id);
  assert.deepEqual([danach.bestaetigt, danach.apotheken_neu], [true, 0]);
  assert.equal(lage().apotheken_bestaetigt, 1);
  svc.erinnern();
  assert.equal(alarme(), 1, 'Alarm kommt nach dem Altern nicht');
  svc.erinnern();
  assert.equal(alarme(), 1, 'Alarm doppelt');
});

test('Über HTTP (Voreinstellung): drei frische Konten sind „3 Apotheken", aber nicht „bestätigt"; Login-Bremse je Konto', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'schein-konten-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '' };
  delete env.APOPULSE_BESTAETIGUNG_AB_STUNDEN;
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const H = (t, extra = {}) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}), ...extra });
    const reg = async (n) => (await (await fetch(B + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, email: n.replace(/\W/g, '') + '@sk.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const [a, b, c] = [await reg('Apo A'), await reg('Apo B'), await reg('Apo C')];
    assert.equal((await fetch(B + '/api/shortages/report', { method: 'POST', headers: H(a), body: JSON.stringify({ wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol Inhaler', status: 'kritisch', country: 'UG' }) })).status, 200);
    const id = (await (await fetch(B + '/api/shortages?country=UG', { headers: H(a) })).json()).shortages.find((x) => x.wirkstoff === 'Salbutamol').id;
    for (const t of [b, c]) await fetch(`${B}/api/shortages/${id}/confirm`, { method: 'POST', headers: H(t) });
    const z = (await (await fetch(B + '/api/shortages?country=UG', { headers: H(a) })).json()).shortages.find((x) => x.id === id);
    assert.deepEqual([z.apotheken, z.bestaetigt, z.apotheken_neu], [3, false, 3]);
    const seite = await (await fetch(B + '/teilen/w/UG/Salbutamol')).text();
    assert.match(seite, /not yet confirmed/);
    assert.match(seite, /bestaetigen=1/);

    // Login: wechselndes X-Forwarded-For hebelt die Bremse nicht mehr aus.
    let letzter = 0;
    for (let i = 0; i < 21; i++) {
      const r = await fetch(B + '/api/login', { method: 'POST', headers: H(null, { 'x-forwarded-for': `10.0.${i}.1` }), body: JSON.stringify({ email: 'ApoA@sk.test', password: 'falsch-' + i }) });
      letzter = r.status;
    }
    assert.equal(letzter, 429, 'Passwort-Raten mit wechselnder Adresse unbegrenzt');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
