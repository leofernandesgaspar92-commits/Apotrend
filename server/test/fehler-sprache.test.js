// Fehlermeldungen in der Sprache der Oberfläche. Die App übersetzt über den
// Code (e_<code>); fehlt die Übersetzung, erscheint die deutsche Server-
// Meldung. Bis 10/2026 hatten 134 von 167 Codes keine — eine Apotheke in
// Uganda las „Wieder lieferbar melden kann, wer den Engpass gemeldet …".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const c = {}; vm.runInNewContext(readFileSync(join(ROOT, 'public/i18n.js'), 'utf8') + ';__I=I18N', c);
const I = c.__I;

function codesImServer() {
  const dateien = []; (function lauf(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) lauf(p); else if (p.endsWith('.js')) dateien.push(p); } })(join(ROOT, 'src'));
  const codes = new Set();
  for (const f of dateien) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/new AppError\(\s*'([a-z_0-9]+)'/g)) codes.add(m[1]);
    for (const m of s.matchAll(/\.code\s*=\s*'([a-z_0-9]+)'/g)) codes.add(m[1]);
    for (const m of s.matchAll(/code:\s*'([a-z_0-9]+)'/g)) codes.add(m[1]);
  }
  for (const x of ['de', 'en', 'pt', 'fr', 'tr']) codes.delete(x); // Sprach-, keine Fehlercodes
  return codes;
}

test('Jeder Fehlercode des Servers hat eine Übersetzung in de, en, pt und fr', () => {
  const codes = codesImServer();
  assert.ok(codes.size > 100, `nur ${codes.size} Codes gefunden — Suche kaputt?`);
  for (const l of ['de', 'en', 'pt', 'fr']) {
    const fehlt = [...codes].filter((k) => !I[l]['e_' + k]);
    assert.deepEqual(fehlt, [], `${l}: ohne Übersetzung`);
  }
  // Bedeutung stichprobenartig: link_invalid ist der ungültige ABMELDE-Link (Wochenbericht),
  // keine Link-Eingabe. Die erste Übersetzung hatte das aus dem Code-Namen falsch geraten.
  assert.match(I.en.e_link_invalid, /unsubscribe/);
  assert.match(I.de.e_link_invalid, /Abmelde-Link/);
  assert.match(I.fr.e_link_invalid, /désabonnement/);
});

test('Platzhalter: tx_format nennt Kette und Format auch auf Englisch', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'fehler-sprache-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [join(ROOT, 'src/http/server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (cd) => { clearTimeout(zeit); fail(new Error(`Server beendet (${cd}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const H = (tk) => ({ 'content-type': 'application/json', ...(tk ? { authorization: 'Bearer ' + tk } : {}) });
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Kampala', email: 'k@fs.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const start = await (await fetch(B + '/api/payments/crypto/start', { method: 'POST', headers: H(tok), body: JSON.stringify({ productId: 'premium_monthly', walletId: 'btc' }) })).json();
    const id = start.payment_id || start.id || (start.payment && start.payment.id);
    assert.ok(id, 'Krypto-Zahlung nicht angelegt: ' + JSON.stringify(start).slice(0, 200));
    const r = await fetch(B + `/api/payments/crypto/${id}/claim`, { method: 'POST', headers: H(tok), body: JSON.stringify({ txRef: 'keine-gueltige-id' }) });
    const d = await r.json();
    assert.equal(d.code, 'tx_format');
    assert.ok(d.params && d.params.kette && d.params.format, 'Platzhalter-Werte fehlen');
    const text = I.en.e_tx_format.replace(/\{(\w+)\}/g, (m, k) => d.params[k]);
    assert.doesNotMatch(text, /\{\w+\}/);
    assert.match(text, /transaction ID/);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

// Riegel gegen Rückfall: Neue Fehler sollen einen Code bekommen (sonst erscheinen
// sie in Uganda deutsch). 33 = Stand 10/2026: interne Fehler (Datenbank-Treiber,
// Kursabruf, Quellen-Parser) und Meldungen mit eingesetzten Werten. Die Zahl darf
// sinken, nicht steigen.
test('Keine neuen Fehler ohne Code', () => {
  const dateien = []; (function lauf(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) lauf(p); else if (p.endsWith('.js')) dateien.push(p); } })(join(ROOT, 'src'));
  let n = 0; const beispiele = [];
  for (const f of dateien) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/new Error\(['`]/g)) {
      if (/Object\.assign\($/.test(s.slice(Math.max(0, m.index - 16), m.index))) continue;
      if (/\.code\s*=/.test(s.slice(m.index, m.index + 200))) continue;
      n += 1; if (beispiele.length < 5) beispiele.push(f.replace(ROOT, '') + ': ' + s.slice(m.index, m.index + 70));
    }
  }
  assert.ok(n <= 33, `${n} Fehler ohne Code (höchstens 33) — z. B.\n${beispiele.join('\n')}`);
});
