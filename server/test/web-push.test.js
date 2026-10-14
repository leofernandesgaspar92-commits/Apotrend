// Web-Push (services/webPush.js): Verschlüsselung nach RFC 8291 (mit dem
// Prüfvektor aus dem Standard), VAPID-Signatur, Abo-Regeln, Versand — und von
// Ende zu Ende: neuer Behörden-Engpass -> verschlüsselter Push an das Gerät.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verschluesseln, vapidKopf, vapidSchluesselErzeugen, aboPruefen, createWebPush, pushNachricht } from '../src/services/webPush.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const b = (s) => Buffer.from(s, 'base64url');

/** Ein „Browser": Schlüsselpaar + Geheimnis, kann Push-Rümpfe entschlüsseln (RFC 8291). */
function geraet(endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  const abo = { endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
  const entschluesseln = (rumpf) => {
    const salt = rumpf.subarray(0, 16); const idlen = rumpf[20]; const asPublic = rumpf.subarray(21, 21 + idlen);
    const chiffre = rumpf.subarray(21 + idlen);
    const hkdf = (ikm, s, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, n));
    const ikm = hkdf(ecdh.computeSecret(asPublic), auth, Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic]), 32);
    const d = crypto.createDecipheriv('aes-128-gcm', hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
    d.setAuthTag(chiffre.subarray(-16));
    const klar = Buffer.concat([d.update(chiffre.subarray(0, -16)), d.final()]);
    assert.equal(klar[klar.length - 1], 2, 'Ende-Markierung des letzten Datensatzes fehlt');
    return klar.subarray(0, -1).toString();
  };
  return { abo, entschluesseln };
}

test('Verschlüsselung: Prüfvektor aus RFC 8291 (Anhang A) Byte für Byte', () => {
  const out = verschluesseln('When I grow up, I want to be a watermelon',
    { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
    { privat: b('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), salt: b('DGv6ra1nlYgDCS1FRnbzlw') });
  assert.equal(out.toString('base64url'),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
  // Und mit Zufall: ein echtes Gerät kann es entschlüsseln.
  const g = geraet();
  assert.equal(g.entschluesseln(verschluesseln('Amoxicillin knapp', g.abo.keys)), 'Amoxicillin knapp');
});

test('VAPID: gültige ES256-Signatur, Zielgruppe = Push-Dienst, begrenzte Laufzeit', () => {
  const k = vapidSchluesselErzeugen();
  const kopf = vapidKopf('https://fcm.googleapis.com/fcm/send/abc', k, 'https://www.apopulse.com', 1_800_000_000);
  const m = kopf.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m, kopf);
  assert.equal(m[4], k.publicKey);
  const pub = b(k.publicKey);
  const schl = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } });
  assert.ok(crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: schl, dsaEncoding: 'ieee-p1363' }, b(m[3])), 'Signatur ungültig');
  const inhalt = JSON.parse(b(m[2]).toString());
  assert.deepEqual(inhalt, { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://www.apopulse.com' });
});

test('Abos: nur bekannte Push-Dienste per https, gültige Schlüssel', () => {
  const g = geraet();
  assert.equal(aboPruefen(g.abo).endpoint, g.abo.endpoint);
  assert.ok(aboPruefen({ ...g.abo, endpoint: 'https://web.push.apple.com/QGz' }));
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://evil.example/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.example/x', 'http://localhost:9/x', 'https://169.254.169.254/latest']) {
    assert.throws(() => aboPruefen({ ...g.abo, endpoint }), /Push-Dienst|Ungültig/, endpoint);
  }
  assert.throws(() => aboPruefen({ ...g.abo, keys: { ...g.abo.keys, auth: 'kurz' } }), /Ungültiges Abo/);
  assert.ok(aboPruefen({ ...g.abo, endpoint: 'http://localhost:9/x' }, { lokalErlaubt: true }), 'lokal nur mit ausdrücklicher Erlaubnis (Tests)');
});

test('Versand: an alle Geräte, abgelaufene Abos werden gelöscht, Gerät wandert beim Kontowechsel', async () => {
  const gesendet = [];
  let antwort = 201;
  const fetchImpl = async (url, opt) => { gesendet.push({ url, opt }); return { status: antwort }; };
  const wp = createWebPush({ fetchImpl });
  const g1 = geraet('https://fcm.googleapis.com/fcm/send/1'); const g2 = geraet('https://updates.push.services.mozilla.com/wpush/v2/2');
  wp.abonnieren('u1', g1.abo); wp.abonnieren('u1', g2.abo);
  assert.equal(wp.geraete('u1'), 2);
  const r = await wp.senden('u1', { titel: 'Engpass: Amoxicillin' });
  assert.deepEqual(r, { ok: 2, entfernt: 0, fehler: 0 });
  const an1 = gesendet.find((x) => x.url === g1.abo.endpoint);
  assert.equal(an1.opt.headers['Content-Encoding'], 'aes128gcm');
  assert.match(an1.opt.headers.Authorization, /^vapid t=/);
  assert.equal(JSON.parse(g1.entschluesseln(an1.opt.body)).titel, 'Engpass: Amoxicillin');
  antwort = 410;
  assert.deepEqual(await wp.senden('u1', { titel: 'x' }), { ok: 0, entfernt: 2, fehler: 0 });
  assert.equal(wp.geraete('u1'), 0);
  // Gleiches Gerät, anderes Konto: nur noch das neue Konto bekommt Alarme.
  wp.abonnieren('u1', g1.abo); wp.abonnieren('u2', g1.abo);
  assert.deepEqual([wp.geraete('u1'), wp.geraete('u2')], [0, 1]);
  // Höchstens 10 Geräte je Konto.
  for (let i = 0; i < 12; i++) wp.abonnieren('u3', geraet('https://fcm.googleapis.com/fcm/send/n' + i).abo);
  assert.equal(wp.geraete('u3'), 10);
  // Sicherung: Schlüssel und Abos überleben einen Neustart; feste Schlüssel nicht in der Sicherung.
  const d = JSON.parse(JSON.stringify(wp.__dump()));
  const neu = createWebPush({ fetchImpl }); neu.__load(d);
  assert.equal(neu.oeffentlicherSchluessel(), wp.oeffentlicherSchluessel());
  assert.equal(neu.geraete('u2'), 1);
  assert.equal(createWebPush({ ausUmgebung: true }).__dump().schluessel, null);
});

test('Texte: Wirkstoff, Land in Klartext, Ziel in der App', () => {
  const m = pushNachricht({ type: 'shortage_home', refType: 'wirkstoff', refId: 'Amoxicillin', label: 'Amoxicillin · AT' }, { sprache: 'de', landName: () => 'Österreich' });
  assert.equal(m.titel, 'Engpass: Amoxicillin');
  assert.match(m.text, /laut Behörde in Österreich knapp/);
  assert.equal(m.url, '/?wirkstoff=Amoxicillin');
  assert.match(pushNachricht({ type: 'watch_alert', label: 'Ibuprofen · eingeschränkt (Community-Meldung)' }).text, /nicht amtlich/);
  assert.equal(pushNachricht({ type: 'like', label: 'x' }), null, 'nur sicherheitsrelevante Meldungen als Push');
});

test('Von Ende zu Ende: neuer Behörden-Engpass -> verschlüsselter Push aufs Gerät', { timeout: 60000 }, async () => {
  let liste = [{ wirkstoff: 'Ibuprofen', bezeichnung: 'Ibuprofen 400 mg', status: 'eingeschränkt lieferbar' }];
  const behoerde = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ items: liste })); });
  await new Promise((ok) => behoerde.listen(0, ok));
  // Nachgestellter Push-Dienst (Google/Mozilla): nimmt verschlüsselte Rümpfe an.
  const eingang = []; let pushStatus = 201;
  const dienst = http.createServer((req, res) => {
    const teile = []; req.on('data', (c) => teile.push(c));
    req.on('end', () => { eingang.push({ headers: req.headers, rumpf: Buffer.concat(teile) }); res.writeHead(pushStatus); res.end(); });
  });
  await new Promise((ok) => dienst.listen(0, ok));
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'push-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '',
      APOPULSE_ADMIN_EMAIL: 'red@push.test', APOPULSE_ADMIN_PASSWORD: 'push-test-123', APOPULSE_PUSH_LOKAL_ERLAUBT: '1',
      APOPULSE_SOURCE_BASG_SHORTAGES_URL: `http://localhost:${behoerde.address().port}/basg.json` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
    const req = async (m, pfad, t, body) => { const r = await fetch(B + pfad, { method: m, headers: H(t), body: body ? JSON.stringify(body) : undefined }); return { status: r.status, d: await r.json() }; };
    const warte = async (n) => { for (let i = 0; i < 50 && eingang.length < n; i++) await new Promise((ok) => setTimeout(ok, 100)); };
    const red = (await req('POST', '/api/login', '', { email: 'red@push.test', password: 'push-test-123' })).d.token;
    const apo = (await req('POST', '/api/register', '', { name: 'Stadt Apotheke', email: 'apo@push.test', password: 'Passwort123!', country: 'AT', accountType: 'pharmacy' })).d.token;
    await req('POST', '/api/watchlist', apo, { wirkstoff: 'Amoxicillin' });

    const info = (await req('GET', '/api/push', apo)).d;
    assert.equal(b(info.schluessel).length, 65, 'öffentlicher VAPID-Schlüssel fehlt');
    assert.equal((await req('POST', '/api/push/test', apo)).status, 409, 'Test ohne Gerät');
    const g = geraet(`http://localhost:${dienst.address().port}/push/geraet1`);
    assert.equal((await req('POST', '/api/push/abo', apo, { abo: { ...g.abo, endpoint: 'https://evil.example/x' } })).status, 400);
    assert.equal((await req('POST', '/api/push/abo', apo, { abo: g.abo })).d.geraete, 1);

    // Test-Nachricht.
    assert.equal((await req('POST', '/api/push/test', apo)).d.ok, 1);
    await warte(1);
    assert.match(eingang[0].headers.authorization, /^vapid t=.+, k=/);
    assert.equal(eingang[0].headers['content-encoding'], 'aes128gcm');
    assert.match(JSON.parse(g.entschluesseln(eingang[0].rumpf)).titel, /Benachrichtigung funktioniert/);

    // Erster Abruf baut nur die Chronik auf (kein Alarm-Schwall), der zweite meldet Amoxicillin neu.
    assert.equal((await req('POST', '/api/live/run/shortages', red)).status, 200);
    liste = [...liste, { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'nicht lieferbar' }];
    assert.equal((await req('POST', '/api/live/run/shortages', red)).status, 200);
    await warte(2);
    assert.equal(eingang.length, 2, 'kein Push beim neuen Engpass: ' + log.slice(-400));
    const msg = JSON.parse(g.entschluesseln(eingang[1].rumpf));
    assert.equal(msg.titel, 'Engpass: Amoxicillin');
    assert.match(msg.text, /Österreich/);
    assert.equal(msg.url, '/?wirkstoff=Amoxicillin');
    // Die Benachrichtigung in der App gibt es weiterhin.
    assert.ok((await req('GET', '/api/notifications', apo)).d.notifications.some((n) => n.type === 'shortage_home'));

    // Push-Dienst meldet „Abo abgelaufen": Gerät wird entfernt.
    pushStatus = 410;
    await req('POST', '/api/push/test', apo);
    assert.equal((await req('GET', '/api/push', apo)).d.geraete, 0);
    assert.equal((await req('GET', '/api/betrieb', red)).d.push.gesendet, 2);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    behoerde.close(); dienst.close();
  }
});
