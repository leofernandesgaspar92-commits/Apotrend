// Gleicher Engpass, zweite Apotheke: Bis 10/2026 entstand eine zweite, getrennte
// Meldung — keine von beiden erreichte die Schwelle „von 3 Apotheken bestätigt",
// gerade in Afrika, wo Apotheken-Meldungen die einzige Quelle sind. Jetzt zählt die
// zweite Meldung als Bestätigung, auch über Schreibweisen hinweg (Amoxicilina).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));

test('Über HTTP: zweite Meldung desselben Wirkstoffs im selben Land = Bestätigung', { timeout: 90000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'zusammenfuehren-12345', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const H = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
    const konto = async (name, land) => (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email: `${name}@zf.test`, password: 'Passwort123!', country: land, accountType: 'pharmacy' }) })).json()).token;
    const melde = async (tok, wirkstoff) => { const r = await fetch(B + '/api/shortages/report', { method: 'POST', headers: H(tok), body: JSON.stringify({ wirkstoff, status: 'kritisch' }) }); return { status: r.status, d: await r.json() }; };
    const offen = async (tok, land) => ((await (await fetch(`${B}/api/shortages?country=${land}`, { headers: H(tok) })).json()).shortages || [])
      .filter((s) => s.provenance === 'community' && /amoxic/i.test(s.wirkstoff));

    const a = await konto('kampala1', 'UG'); const b = await konto('kampala2', 'UG'); const c = await konto('nairobi1', 'KE');
    const erste = await melde(a, 'Amoxicillin');
    assert.equal(erste.status, 200); assert.ok(!erste.d.zusammengefuehrt);
    // Zweite Apotheke, portugiesische Schreibweise: keine neue Meldung, sondern Bestätigung.
    const zweite = await melde(b, 'Amoxicilina');
    assert.equal(zweite.status, 200);
    assert.equal(zweite.d.zusammengefuehrt, true);
    assert.equal(zweite.d.id, erste.d.id, 'dieselbe Meldung');
    const liste = await offen(a, 'UG');
    assert.equal(liste.length, 1, 'nur EINE offene Meldung in Uganda');
    assert.equal(liste[0].confirm_count, 1, 'eine Bestätigung');
    // Nochmals melden zählt nicht doppelt.
    await melde(b, 'Amoxicillin');
    assert.equal((await offen(a, 'UG'))[0].confirm_count, 1, 'nicht doppelt gezählt');
    // Eigene Doppelmeldung (andere Schreibweise) bleibt abgewiesen.
    const doppelt = await melde(a, 'Amoxicillin-Trihydrat');
    assert.equal(doppelt.status, 400); assert.equal(doppelt.d.code, 'shortage_duplicate');
    // Anderes Land: eigene Meldung, keine Zusammenführung über Grenzen.
    const kenia = await melde(c, 'Amoxicillin');
    assert.equal(kenia.status, 200); assert.ok(!kenia.d.zusammengefuehrt); assert.notEqual(kenia.d.id, erste.d.id);
    // Anderer Wirkstoff: eigene Meldung.
    const anders = await melde(b, 'Paracetamol');
    assert.ok(!anders.d.zusammengefuehrt);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Oberfläche: Vorschläge beim Tippen, Hinweis bei Zusammenführung (de/en/pt)', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /<input data-w list="wkVorschlaege"/);
  assert.match(app, /api\('GET', '\/api\/erste-schritte\?country='/);
  assert.match(app, /if \(r && r\.zusammengefuehrt\)/);
  const i18n = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');
  for (const w of ['Deine Meldung zählt als Bestätigung („Auch bei uns“)', 'Your report counts as a confirmation (“Us too”)', 'A sua comunicação conta como confirmação («Nós também»)']) assert.ok(i18n.includes(w), w);
});
