// /api/countries trägt `preise`: Gibt es für das Land Preisvergleiche oder
// Angebote? Die Startseite verspricht „Preise vergleichen" und die
// Beobachtungsliste zeigt Rabatt-Alarme nur dort (bis 10/2026 auch in Uganda,
// wo es nichts zu vergleichen gibt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

async function laender(extra) {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'laenderwahl-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '', ...extra };
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    return (await (await fetch(`http://localhost:${port}/api/countries`)).json()).countries;
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
}

test('Länderliste: preise nur, wo es Preise oder Angebote gibt', { timeout: 90000 }, async () => {
  // Mit Beispieldaten (nur Österreich hat Preise und Angebote).
  const mit = Object.fromEntries((await laender({ APOPULSE_REFERENCE_DATA: 'an' })).map((c) => [c.code, c.preise]));
  assert.equal(mit.AT, true, 'Österreich mit Beispieldaten ohne Preise gemeldet');
  for (const c of ['UG', 'LR', 'KE', 'ET']) assert.equal(mit[c], false, `${c} ohne Preise als „mit Preisen" gemeldet`);
  // Live-Betrieb ohne Beispieldaten: nirgends etwas zu vergleichen — dann auch nirgends versprechen.
  const ohne = await laender({});
  assert.ok(ohne.every((c) => c.preise === false), 'ohne Preisdaten trotzdem „mit Preisen"');
  assert.ok(ohne.every((c) => c.region && c.timezone), 'Felder für die Länderwahl fehlen');
});
