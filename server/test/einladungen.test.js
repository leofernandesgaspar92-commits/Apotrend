// Kolleg:innen einladen und um Bestätigung bitten (services/einladungen.js).
// In Ländern ohne Behördenliste entsteht die Lage aus Apotheken-Meldungen —
// „bestätigt" erst ab 3 Apotheken. Der Einladungs-Link ist der Weg dorthin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEinladungen, CODE_RE } from '../src/services/einladungen.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Codes: je Konto fest und eindeutig; zuordnen einmal, nie sich selbst; Löschen räumt auf', () => {
  const e = createEinladungen();
  const a = e.code('a'); const b = e.code('b');
  assert.match(a, CODE_RE);
  assert.equal(e.code('a'), a);
  assert.notEqual(a, b);
  assert.equal(e.aufloesen(a), 'a');
  for (const x of [null, '', 'kurz', a + 'x', { a }, '../../../x']) assert.equal(e.aufloesen(x), null);
  assert.equal(e.zuordnen('a', a), null, 'sich selbst eingeladen');
  assert.equal(e.zuordnen('n1', a), 'a');
  assert.equal(e.zuordnen('n1', b), null, 'zweimal zugeordnet');
  assert.equal(e.zuordnen('n2', 'AAAAAAAA'), null);
  e.zuordnen('n2', a);
  assert.equal(e.anzahl('a'), 2);
  const kopie = createEinladungen(); kopie.__load(JSON.parse(JSON.stringify(e.__dump())));
  assert.deepEqual([kopie.code('a'), kopie.aufloesen(b), kopie.anzahl('a')], [a, 'b', 2]);
  e.nutzerEntfernen('a');
  assert.deepEqual([e.aufloesen(a), e.anzahl('a')], [null, 0]);
});

async function starte(env) {
  const kind = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT: '0', APOPULSE_PRESSE: 'aus', APOPULSE_TOKEN_SECRET: 'einladung-test-geheimnis', APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const port = await new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
    const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
  });
  const ende = () => new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill('SIGTERM'); });
  return { B: `http://localhost:${port}`, ende };
}

test('Über HTTP: Link mit Code → Bitte um Bestätigung → Konto zugeordnet, Einladende erfährt es; Code übersteht den Neustart', { timeout: 90000 }, async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'apo-einl-'));
  const datei = join(ordner, 'daten.json');
  let s = await starte({ APOPULSE_DATA_FILE: datei });
  try {
    const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
    const reg = async (name, mail, extra = {}) => (await (await fetch(s.B + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name, email: mail, password: 'Passwort123!', country: 'UG', accountType: 'pharmacy', ...extra }) })).json());
    const a = await reg('Kampala Central', 'a@einl.test');
    const r = await fetch(s.B + '/api/shortages/report', { method: 'POST', headers: H(a.token), body: JSON.stringify({ wirkstoff: 'Oxytocin', bezeichnung: 'Oxytocin 10 IU', status: 'kritisch', country: 'UG' }) });
    assert.equal(r.status, 200, await r.text());
    const { code, beigetreten } = await (await fetch(s.B + '/api/einladung', { headers: H(a.token) })).json();
    assert.match(code, CODE_RE);
    assert.equal(beigetreten, 0);

    // Teilseite: bittet um Bestätigung und trägt den Code in den Knopf.
    const seite = await (await fetch(`${s.B}/teilen/w/UG/Oxytocin?e=${code}`)).text();
    assert.match(seite, /Short at your pharmacy too\? Confirm Oxytocin in ApoPulse/);
    assert.match(seite, new RegExp(`href="/\\?land=UG&amp;beobachten=Oxytocin&amp;bestaetigen=1&amp;e=${code}"`));
    // Unbekannter Code: kommt nicht in den Knopf.
    assert.ok(!/&amp;e=/.test(await (await fetch(`${s.B}/teilen/w/UG/Oxytocin?e=ZZZZZZZZ`)).text()));

    const b = await reg('Entebbe Pharmacy', 'b@einl.test', { einladung: code });
    assert.ok(b.token);
    // Unsinn als Code verhindert keine Registrierung.
    assert.ok((await reg('Jinja Pharmacy', 'c@einl.test', { einladung: { x: 1 } })).token);
    const nf = (await (await fetch(s.B + '/api/notifications', { headers: H(a.token) })).json()).notifications;
    const n = nf.find((x) => x.type === 'einladung');
    assert.ok(n, 'Einladende erfährt nichts');
    assert.equal(n.actor.handle, b.profile.handle);
    assert.equal((await (await fetch(s.B + '/api/einladung', { headers: H(a.token) })).json()).beigetreten, 1);

    // Nach 3 Apotheken ist die Meldung bestätigt — dann keine Bitte mehr.
    const c = await reg('Mbarara Pharmacy', 'd@einl.test', { einladung: code });
    const id = (await (await fetch(s.B + '/api/shortages?country=UG', { headers: H(b.token) })).json()).shortages.find((x) => x.wirkstoff === 'Oxytocin').id;
    for (const t of [b.token, c.token]) assert.equal((await fetch(`${s.B}/api/shortages/${id}/confirm`, { method: 'POST', headers: H(t) })).status, 200);
    const danach = await (await fetch(`${s.B}/teilen/w/UG/Oxytocin?e=${code}`)).text();
    assert.ok(!/bestaetigen=1/.test(danach), 'bestätigte Meldung bittet weiter um Bestätigung');
    assert.match(danach, new RegExp(`&amp;e=${code}"`));

    // Neustart: derselbe Code gilt weiter (geteilte Links bleiben gültig).
    await s.ende();
    s = await starte({ APOPULSE_DATA_FILE: datei });
    const nach = await (await fetch(s.B + '/api/einladung', { headers: H(a.token) })).json();
    assert.deepEqual(nach, { code, beigetreten: 2 });
  } finally {
    await s.ende();
    rmSync(ordner, { recursive: true, force: true });
  }
});
