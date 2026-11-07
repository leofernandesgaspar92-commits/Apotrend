// Tippfehler in den Render-Einstellungen dürfen weder den Start verhindern noch Geld kosten.
// Fund 11/2026 (Start mit absichtlich falschen Werten durchprobiert):
//  · APOPULSE_ADMIN_PASSWORD mit weniger als 8 Zeichen → der Server startete NICHT („Passwort muss mindestens
//    8 Zeichen haben" + Stapel). Beim ersten Start mit neuer Datenbank lag damit die ganze App still.
//  · Wallet-Adressen wurden ungeprüft angezeigt. Ein Kopierfehler in APOPULSE_WALLET_TRON (abgeschnitten,
//    Leerzeichen, versehentlich die Ethereum-Adresse) → Kundinnen schicken USDT an eine Adresse, die es
//    nicht gibt oder die nicht dem Betreiber gehört. Jetzt: Format und Prüfsumme je Kette; ungültige
//    Wallets werden nicht angezeigt, Protokoll und Startklar-Check nennen die Variable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adresseGueltig } from '../src/domain/walletAdresse.js';
import { cryptoWallets } from '../src/data/cryptoWallets.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const ETH = '0x5f50991186014eDcbDE301467bE7a20C6CCc179B';
const TRON_OK = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // öffentlich bekannte Tron-Adresse (USDT-Vertrag)

test('Adressprüfung je Kette: Standard-Wallets gültig, Kopierfehler erkannt', () => {
  for (const w of cryptoWallets({})) assert.equal(adresseGueltig(w.coin, w.address).ok, true, `${w.id}: ${w.address}`);
  assert.equal(adresseGueltig('tron', TRON_OK).ok, true);
  assert.equal(adresseGueltig('tron', TRON_OK.slice(0, -1) + 'u').ok, false, 'Tron: Prüfsumme');
  assert.equal(adresseGueltig('tron', TRON_OK.slice(0, -2)).ok, false, 'Tron: abgeschnitten');
  assert.equal(adresseGueltig('tron', ETH).ok, false, 'Ethereum-Adresse im Tron-Feld');
  assert.equal(adresseGueltig('tron', 'nicht eine adresse').ok, false);
  const btc = cryptoWallets({})[0].address;
  assert.equal(adresseGueltig('bitcoin', btc.slice(0, -1) + (btc.endsWith('q') ? 'p' : 'q')).ok, false, 'Bitcoin: Prüfsumme');
  assert.equal(adresseGueltig('bitcoin', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2').ok, true, 'Bitcoin: altes Format');
  assert.equal(adresseGueltig('bitcoin', TRON_OK).ok, false);
  assert.equal(adresseGueltig('ethereum', ETH.slice(0, -1)).ok, false, 'Ethereum: zu kurz');
  assert.equal(adresseGueltig('ethereum', TRON_OK).ok, false);
  // Solana hat keine Prüfsumme: Ein fehlendes letztes Zeichen kann formal gültig bleiben — deutlich Gekürztes nicht.
  assert.equal(adresseGueltig('solana', 'EMSJTkRGnnExNwaCkte9PDCN4Tm3BNSZKdXqc').ok, false, 'Solana: abgeschnitten');
  assert.equal(adresseGueltig('solana', ETH).ok, false);
  assert.match(adresseGueltig('tron', ETH).erwartet, /T/, 'Hinweis, wie eine Tron-Adresse aussieht');
});

async function starte(env) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'tippfehler-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const st = { kind, log: '' };
  st.port = await new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + st.log)), 20000);
    const lies = (d) => { st.log += d; const m = st.log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${st.log.slice(0, 600)}`)); });
  });
  return st;
}
const stoppe = (st) => new Promise((ok) => { if (!st || st.kind.exitCode !== null) return ok(); st.kind.once('exit', ok); st.kind.kill(); });

test('Zu kurzes Admin-Passwort: Server startet trotzdem und sagt klar, was zu tun ist', { timeout: 60000 }, async () => {
  let st;
  try {
    st = await starte({ APOPULSE_ADMIN_EMAIL: 'red@tf.test', APOPULSE_ADMIN_PASSWORD: 'kurz123' });
    assert.match(st.log, /APOPULSE_ADMIN_PASSWORD[^\n]*mindestens 8 Zeichen/);
    const r = await fetch(`http://localhost:${st.port}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'red@tf.test', password: 'kurz123' }) });
    assert.equal(r.status, 401, 'zu kurzes Passwort darf nicht trotzdem gelten');
  } finally { await stoppe(st); }
});

test('Ungültige Wallet-Adressen: nicht angezeigt, Protokoll und Startklar nennen die Variable', { timeout: 60000 }, async () => {
  let st;
  const btcKaputt = cryptoWallets({})[0].address.slice(0, -3);
  try {
    st = await starte({ APOPULSE_WALLET_TRON: ETH, APOPULSE_WALLET_BTC: btcKaputt, APOPULSE_ADMIN_EMAIL: 'red@tf.test', APOPULSE_ADMIN_PASSWORD: 'langes-passwort-1' });
    const B = `http://localhost:${st.port}`;
    assert.match(st.log, /APOPULSE_WALLET_TRON[^\n]*keine gültige/);
    assert.match(st.log, /APOPULSE_WALLET_BTC[^\n]*keine gültige/);
    const w = (await (await fetch(B + '/api/payments/wallets')).json()).wallets.map((x) => x.id);
    assert.ok(!w.includes('tron') && !w.includes('btc'), `ungültige Wallets angezeigt: ${w}`);
    assert.ok(w.includes('eth'), 'gültige Wallets müssen bleiben');
    const c = (await (await fetch(B + '/api/payments/crypto?productId=premium_monthly')).json()).coins.map((x) => x.id);
    assert.ok(!c.includes('tron') && !c.includes('btc'), `Premium zeigt ungültige Wallets: ${c}`);
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'red@tf.test', password: 'langes-passwort-1' }) })).json()).token;
    const sk = await (await fetch(B + '/api/startklar', { headers: { authorization: 'Bearer ' + red } })).json();
    const k = sk.punkte.find((p) => p.id === 'krypto');
    assert.equal(k.stufe, 'fehlt');
    assert.match(k.warum + ' ' + k.tun, /APOPULSE_WALLET_TRON/);
    assert.match(k.warum + ' ' + k.tun, /APOPULSE_WALLET_BTC/);
  } finally { await stoppe(st); }
});
