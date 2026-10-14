// Moderation: Prüfliste der Apotheken-Meldungen (shortages.pruefliste).
// Die 24-Stunden-Regel verzögert Schein-Konten nur — in der Zeit muss die
// Moderation sehen, was auffällt, und eingreifen können: einzelne
// Bestätigung entfernen oder die Meldung als falsch entfernen (OHNE allen
// Beobachter:innen „wieder verfügbar" zu melden).
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
import { createShortagesService, vertrauenEinstellen } from '../src/services/shortages.js';
import { startklar } from '../src/services/startklar.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const STUNDE = 3600000;

test('Prüfliste: auffällige Meldung mit Signalen, unauffällige nicht; Bestätigung entfernen; Meldung entfernen ohne „wieder verfügbar"', () => {
  const jetzt = Date.parse('2026-10-14T08:00:00Z');
  const seit = new Map(); const eingeladen = new Map();
  vertrauenEinstellen({ kontoSeit: (uid) => seit.get(uid) || null, jetzt: () => jetzt });
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  let modId = null;
  const social = createSocialService(socialRepo, repo, { isModerator: (uid) => uid === modId });
  const shortagesRepo = createShortagesRepo({ seed: false });
  const svc = createShortagesService(shortagesRepo, social, { today: () => '2026-10-14', moderatoren: () => (modId ? [modId] : []), vonWem: (uid) => eingeladen.get(uid) || null });
  const anlegen = (name, alterStunden, von = null) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email: name.replace(/\W/g, '') + '@mp.test', password: 'geheim123' } });
    social.createProfile(r.user.id, { handle: name.replace(/\W/g, '').toLowerCase(), displayName: name, country: 'UG', accountType: 'pharmacy' });
    seit.set(r.user.id, new Date(jetzt - alterStunden * STUNDE).toISOString());
    if (von) eingeladen.set(r.user.id, von);
    return r.user.id;
  };
  const mod = anlegen('Moderation', 500);
  modId = mod;
  const a = anlegen('Apo Alt', 400);
  const beob = anlegen('Beob', 400); svc.watch(beob, 'Oxytocin');
  const m = svc.reportShortage(a, { wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: 'UG' });
  const s1 = anlegen('Schein Eins', 2, a); const s2 = anlegen('Schein Zwei', 2.3, a);
  svc.confirmShortage(s1, m.id); svc.confirmShortage(s2, m.id);
  // Unauffällig: zwei alte, nicht eingeladene Konten, Monate auseinander.
  const n = svc.reportShortage(a, { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 500 mg', status: 'kritisch', country: 'UG' });
  svc.confirmShortage(anlegen('Alt Zwei', 2000), n.id); svc.confirmShortage(anlegen('Alt Drei', 300), n.id);

  const vonWem = (uid) => eingeladen.get(uid) || null;
  // Die Moderation erfährt es von selbst — einmal, und nur für die auffällige Meldung.
  const pruefHinweise = () => social.notifications(mod).filter((x) => x.type === 'meldung_pruefen');
  assert.equal(pruefHinweise().length, 1, 'Moderation nicht (oder mehrfach) benachrichtigt');
  assert.match(pruefHinweise()[0].label, /^Oxytocin · UG$/);
  svc.unconfirmShortage(s2, m.id); svc.confirmShortage(s2, m.id);
  assert.equal(pruefHinweise().length, 1, 'erneute Bestätigung meldet doppelt');
  assert.throws(() => svc.pruefliste(a, { vonWem }), (e) => e.status === 403);
  const liste = svc.pruefliste(mod, { vonWem });
  assert.deepEqual(liste.map((x) => x.wirkstoff), ['Oxytocin'], 'unauffällige Meldung gelistet oder auffällige fehlt');
  const arten = Object.fromEntries(liste[0].signale.map((sg) => [sg.art, sg.n]));
  assert.deepEqual(arten, { neue_konten: 2, eingeladen: 2, kurz_nacheinander: 2 });
  assert.equal(liste[0].beteiligte.find((p) => p.handle === 'scheineins').eingeladen_von_meldender, true);
  assert.equal(liste[0].beteiligte.find((p) => p.handle === 'scheineins').alter_stunden, 2);

  assert.throws(() => svc.modBestaetigungEntfernen(a, m.id, 'scheineins'), (e) => e.status === 403);
  assert.equal(svc.modBestaetigungEntfernen(mod, m.id, 'scheineins').apotheken, 2);

  assert.throws(() => svc.modEntfernen(a, m.id), (e) => e.status === 403);
  const hinweiseVorher = social.notifications(beob).filter((x) => x.type === 'watch_alert').length;
  svc.modEntfernen(mod, m.id);
  assert.equal(shortagesRepo.get(m.id), null);
  assert.ok(social.notifications(a).some((x) => x.type === 'shortage_entfernt'), 'Meldende erfährt es nicht');
  assert.equal(social.notifications(beob).filter((x) => x.type === 'watch_alert').length, hinweiseVorher, 'Beobachter:in bekam „wieder verfügbar"');
  assert.deepEqual(svc.pruefliste(mod, { vonWem }), []);
});

test('Über HTTP: frische Konten erscheinen in der Prüfliste; nur Moderation; Entfernen wirkt', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'meldungs-pruefung-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '',
    APOPULSE_ADMIN_EMAIL: 'mod@mp.test', APOPULSE_ADMIN_PASSWORD: 'mod-pruef-123' };
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
    const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
    const mod = (await (await fetch(B + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'mod@mp.test', password: 'mod-pruef-123' }) })).json()).token;
    const reg = async (n) => (await (await fetch(B + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: n, email: n.replace(/\W/g, '') + '@mp.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const [a, b, c] = [await reg('Apo A'), await reg('Apo B'), await reg('Apo C')];
    await fetch(B + '/api/shortages/report', { method: 'POST', headers: H(a), body: JSON.stringify({ wirkstoff: 'Ceftriaxone', bezeichnung: 'Ceftriaxone 1 g', status: 'kritisch', country: 'UG' }) });
    const id = (await (await fetch(B + '/api/shortages?country=UG', { headers: H(a) })).json()).shortages.find((x) => x.wirkstoff === 'Ceftriaxone').id;
    for (const t of [b, c]) await fetch(`${B}/api/shortages/${id}/confirm`, { method: 'POST', headers: H(t) });
    assert.equal((await fetch(B + '/api/mod/meldungen', { headers: H(a) })).status, 403);
    const liste = (await (await fetch(B + '/api/mod/meldungen', { headers: H(mod) })).json()).meldungen;
    const m = liste.find((x) => x.id === id);
    assert.ok(m, 'frische Konten nicht in der Prüfliste');
    assert.ok(m.signale.some((sg) => sg.art === 'neue_konten' && sg.n === 3));
    assert.equal((await fetch(`${B}/api/mod/meldungen/${id}/entfernen`, { method: 'POST', headers: H(a) })).status, 403);
    assert.equal((await fetch(`${B}/api/mod/meldungen/${id}/entfernen`, { method: 'POST', headers: H(mod) })).status, 200);
    assert.ok(!(await (await fetch(B + '/api/shortages?country=UG', { headers: H(a) })).json()).shortages.some((x) => x.id === id));
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Startklar: abgeschalteter Schutz vor Schein-Konten steht als „fehlt"', () => {
  const schutz = (env) => startklar({ env }).punkte.find((x) => x.id === 'schutz');
  assert.equal(schutz({ APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0' })?.stufe, 'fehlt', 'Warnung fehlt');
  assert.equal(schutz({}), undefined, 'Warnung ohne Grund');
  assert.equal(schutz({ APOPULSE_BESTAETIGUNG_AB_STUNDEN: '48' }), undefined);
});
