// Neustart MIT gespeicherter Datei: Der Server muss hochkommen.
//
// Von Säule 3 bis 10/2026 brach jeder solche Start ab („Cannot access
// 'logistikRepo' before initialization"): Der Bestand wurde in
// applySnapshot() geladen, aber erst weiter unten angelegt. Kein Test sah es,
// weil ALLE Tests frisch starten. Auf Render trifft es genau den Betrieb mit
// dauerhafter Platte — also den Bezahltarif, der empfohlen wird, damit die
// Abrufe nicht einschlafen.
//
// Darum hier zwei echte Prozesse nacheinander auf derselben Datei.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

function starte(datei) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'neustart-test', APOPULSE_DATA_FILE: datei,
      APOPULSE_ADMIN_PASSWORD: 'neustart-test-123', APOPULSE_PRESSE: 'aus' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const bereit = new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch. Log:\n' + log)), 20000);
    const lies = (d) => {
      log += d;
      const m = log.match(/läuft auf http:\/\/localhost:(\d+)/);
      if (m) { clearTimeout(zeit); ok(Number(m[1])); }
    };
    kind.stdout.on('data', lies);
    kind.stderr.on('data', lies);
    kind.on('exit', (code) => { clearTimeout(zeit); fail(new Error(`Server beendet (Code ${code}). Log:\n${log}`)); });
  });
  return { kind, bereit, log: () => log };
}

const stopp = (k) => new Promise((ok) => { if (k.exitCode !== null) return ok(); k.once('exit', ok); k.kill(); });

test('Neustart mit gespeicherter Datei: Server kommt hoch, Konto ist noch da', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'apopulse-neustart-'));
  const datei = join(dir, 'stand.json');
  try {
    // 1. Erster Start: Konto anlegen, warten bis die Datei geschrieben ist.
    const a = starte(datei);
    const portA = await a.bereit;
    const r = await fetch(`http://localhost:${portA}/api/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'N', email: 'neustart@x.at', password: 'Passwort123!', handle: 'neustart', country: 'AT', accountType: 'pharmacy' }),
    });
    assert.equal(r.status, 200);
    for (let i = 0; i < 40 && !existsSync(datei); i++) await new Promise((ok) => setTimeout(ok, 100));
    await new Promise((ok) => setTimeout(ok, 600)); // gedrosseltes Schreiben (400 ms) abwarten
    await stopp(a.kind);
    assert.ok(existsSync(datei), 'erster Start hat keine Datei geschrieben');

    // 2. Zweiter Start auf derselben Datei.
    const b = starte(datei);
    const portB = await b.bereit;
    try {
      assert.match(b.log(), /wiederhergestellt/, 'zweiter Start hat die Datei nicht geladen');
      const login = await fetch(`http://localhost:${portB}/api/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'neustart@x.at', password: 'Passwort123!' }),
      });
      assert.equal(login.status, 200, 'Konto hat den Neustart nicht überlebt');
    } finally {
      await stopp(b.kind);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
