// Suche (10/2026, Rundgang Senegal): Engpass-Treffer kamen als rohe Zeilen — mit den
// Benutzer-IDs der bestätigenden Apotheken und ohne Vertrauensstufe. Die Karte zeigte
// „, pharmacies signalent — confirmé à partir de 3" (Anzahl fehlte, join(undefined)
// setzt ein Komma) und „1 résultats".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');

test('ti(): fehlender Wert wird leer, nie „undefined" und nie ein Komma', () => {
  const zeile = app.slice(app.indexOf('function ti(key, vars) {'), app.indexOf('\n}\n', app.indexOf('function ti(key, vars) {')) + 3);
  const c = { LOCALE: 'en', t: () => '{n} pharmacies report' };
  vm.runInNewContext(zeile + ';this.r = [ti("x", { n: undefined }), ti("x", { n: 2 })];', c);
  assert.deepEqual([...c.r], [' pharmacies report', '2 pharmacies report']);
});

test('Trefferzahl im Singular: „1 résultat"', () => {
  assert.match(app, /nlabel\(d\.total, 'search_hits_1', 'search_hits'\)/);
});

test('HTTP: Engpass-Treffer der Suche mit Vertrauensstufe, ohne Benutzer-IDs', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'suche-engpass-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((ok, fehler) => {
      let l = ''; const z = setTimeout(() => fehler(new Error('Server startet nicht')), 30000);
      kind.stdout.on('data', (d) => { l += d; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(z); ok(m[1]); } });
    });
    const req = (method, pfad, body, token) => new Promise((ok, fehler) => {
      const r = http.request({ host: 'localhost', port, path: pfad, method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) } }, (res) => {
        let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(b || '{}') }));
      });
      r.on('error', fehler); if (body) r.write(JSON.stringify(body)); r.end();
    });
    const a = (await req('POST', '/api/register', { name: 'Pharmacie A', email: 'a@suche.sn', password: 'motdepasse1', country: 'SN', locale: 'fr' })).json;
    const b = (await req('POST', '/api/register', { name: 'Pharmacie B', email: 'b@suche.sn', password: 'motdepasse1', country: 'SN', locale: 'fr' })).json;
    const m = await req('POST', '/api/shortages/report', { wirkstoff: 'Amoxicilline', bezeichnung: 'Amoxicilline 500 mg', status: 'kritisch' }, a.token);
    assert.equal(m.status, 200, JSON.stringify(m.json));
    const id = m.json.id || (m.json.shortage && m.json.shortage.id);
    assert.ok(id, 'Meldung ohne ID');
    assert.equal((await req('POST', `/api/shortages/${id}/confirm`, {}, b.token)).status, 200);
    const s = await req('GET', '/api/search?q=amoxicilline&country=SN', null, a.token);
    assert.equal(s.status, 200);
    const treffer = s.json.shortages.find((x) => x.id === id);
    assert.ok(treffer, 'Treffer fehlt');
    assert.equal(treffer.apotheken, 2, 'Vertrauensstufe: meldende + bestätigende Apotheke');
    assert.equal(typeof treffer.bestaetigt, 'boolean');
    assert.equal(treffer.confirmations, undefined, 'keine Benutzer-IDs der Bestätigenden');
    assert.equal(treffer.notified_confirmers, undefined);
    assert.ok(!JSON.stringify(s.json.shortages).includes(b.user.id), 'ID der bestätigenden Apotheke taucht nirgends auf');
  } finally { kind.kill(); }
});
