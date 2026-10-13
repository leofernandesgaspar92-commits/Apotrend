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
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

function starte(datei) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'neustart-test', APOPULSE_DATA_FILE: datei,
      APOPULSE_ADMIN_EMAIL: 'red@neustart.test', APOPULSE_ADMIN_PASSWORD: 'neustart-test-123', APOPULSE_PRESSE: 'aus' },
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
    // Eine eigene Engpass-Quelle der Redaktion — muss den Neustart überleben.
    const red = (await (await fetch(`http://localhost:${portA}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'red@neustart.test', password: 'neustart-test-123' }) })).json()).token;
    const q = await fetch(`http://localhost:${portA}/api/quellen`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + red },
      body: JSON.stringify({ country: 'AU', format: 'csv', url: 'https://www.tga.gov.au/beispiel.csv', label: 'TGA' }) });
    assert.equal(q.status, 200, await q.text());
    for (let i = 0; i < 40 && !existsSync(datei); i++) await new Promise((ok) => setTimeout(ok, 100));
    await new Promise((ok) => setTimeout(ok, 600)); // gedrosseltes Schreiben (400 ms) abwarten
    await stopp(a.kind);
    assert.ok(existsSync(datei), 'erster Start hat keine Datei geschrieben');
    // Altbestand nachstellen: bezahltes Monats-Premium OHNE Frist — so speicherte
    // der Code bis 10/2026. Der nächste Start muss es auf Laufzeit umstellen.
    const stand = JSON.parse(readFileSync(datei, 'utf8'));
    const uid = stand.foundation.users.find(([, u]) => u.email === 'neustart@x.at')[0];
    stand.foundation.entitlements = [[uid, ['premium']]];
    stand.foundation.entitlementBis = [];
    stand.foundation.payments = [...(stand.foundation.payments || []), ['alt1', { id: 'alt1', user_id: uid, product_id: 'premium_monthly', status: 'paid', method: 'crypto_direct', provider: 'crypto_direct', amount_cents: 999, currency: 'EUR', created_at: '2026-01-01T10:00:00.000Z', paid_at: '2026-01-01T10:00:00.000Z' }]];
    writeFileSync(datei, JSON.stringify(stand));

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
      const tok = (await login.json()).token;
      const prem = await (await fetch(`http://localhost:${portB}/api/me/premium`, { headers: { authorization: 'Bearer ' + tok } })).json();
      assert.equal(prem.premium, true, 'Kulanz: Altbestand darf nicht sofort abgeschnitten werden');
      const tage = (Date.parse(prem.bis) - Date.now()) / 86400000;
      assert.ok(tage > 6 && tage <= 7.01, `Altbestand nicht umgestellt (bis ${prem.bis})`);
      assert.match(b.log(), /Premium-Freischaltung\(en\) auf Laufzeit umgestellt/);
      const st = await (await fetch(`http://localhost:${portB}/api/live/status`)).json();
      assert.ok(st.sources.some((x) => x.id === 'eigen_au_1' && x.eigen), 'eigene Quelle hat den Neustart nicht überlebt');
    } finally {
      await stopp(b.kind);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
