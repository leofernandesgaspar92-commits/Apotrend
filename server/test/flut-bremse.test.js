// Beiträge, Kommentare und Logistik-Meldungen haben eine Bremse je Konto; Melden zählt je Inhalt nur einmal.
// Fund 11/2026 (Flut-Probe, ein verifiziertes Großhandelskonto, je 120 Versuche): Beiträge 120/120, Kommentare
// 120/120, Logistik-Meldungen 120/120 angenommen — jeder Beitrag benachrichtigt Folgende, jede Logistik-Meldung
// erscheint im Lagebild des Landes. Und dasselbe Konto konnte denselben Beitrag 120-mal melden: 120 Einträge in
// der Prüfliste der Redaktion. Engpass-Meldungen (10/Tag) und Proforma-Anfragen (10/Stunde) waren schon gebremst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('Flut-Bremse: Beiträge 30/h, Kommentare 60/h, Logistik 20/Tag; Mehrfach-Melden = ein offener Eintrag', { timeout: 90000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'flut-bremse-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1',
      APOPULSE_ADMIN_EMAIL: 'red@fb.test', APOPULSE_ADMIN_PASSWORD: 'flut-bremse-PW-1', APOPULSE_BEITRAEGE_JE_STUNDE: '' },
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
    const req = async (m, p, tok, body) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: m === 'GET' ? undefined : JSON.stringify(body || {}) }); return { s: r.status, d: await r.json() }; };
    const reg = (await req('POST', '/api/register', '', { name: 'Flut', email: 'flut@fb.test', password: 'Passwort123!', country: 'KE', accountType: 'wholesale' })).d;
    const tok = reg.token;
    const zweit = (await req('POST', '/api/register', '', { name: 'Zweit', email: 'zweit@fb.test', password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' })).d.token;
    const red = (await req('POST', '/api/login', '', { email: 'red@fb.test', password: 'flut-bremse-PW-1' })).d.token;
    assert.ok(tok && zweit && red);
    await req('POST', '/api/verify/request', tok, { note: 'Großhandel', licenseNumber: 'KE-1' });
    assert.equal((await req('POST', `/api/verify/${reg.user.id}/resolve`, red, { approve: true })).s, 200, 'Verifizierung');

    // Beiträge
    const posts = [];
    for (let i = 0; i < 30; i++) { const r = await req('POST', '/api/posts', tok, { body: 'Lage ' + i }); assert.equal(r.s, 200, `Beitrag ${i}`); posts.push(r.d.id || r.d.post?.id); }
    const p31 = await req('POST', '/api/posts', tok, { body: 'Lage 31' });
    assert.equal(p31.s, 429, 'Beitrag 31 in einer Stunde angenommen');
    assert.equal(p31.d.code, 'beitraege_zu_viele');
    assert.equal(p31.d.params?.max, 30);
    assert.equal((await req('POST', '/api/posts', zweit, { body: 'Anderes Konto' })).s, 200, 'Bremse gilt je Konto');
    for (let i = 0; i < 35; i++) assert.equal((await req('POST', '/api/posts', red, { body: 'Redaktion ' + i })).s, 200, 'Redaktion gebremst');

    // Kommentare
    const ziel = posts[0];
    assert.ok(ziel, 'Beitrags-ID fehlt');
    for (let i = 0; i < 60; i++) assert.equal((await req('POST', `/api/posts/${ziel}/comments`, tok, { body: 'K ' + i })).s, 200, `Kommentar ${i}`);
    const k61 = await req('POST', `/api/posts/${ziel}/comments`, tok, { body: 'K 61' });
    assert.equal(k61.s, 429); assert.equal(k61.d.code, 'kommentare_zu_viele'); assert.equal(k61.d.params?.max, 60);

    // Logistik
    const lm = (i) => ({ art: 'transport', titel: 'Grenzstau ' + i, beschreibung: 'Wartezeit am Grenzübergang', region: 'Mombasa', dringlichkeit: 'mittel' });
    const erste = await req('POST', '/api/logistik', tok, lm(0));
    assert.equal(erste.s, 200, 'Logistik-Meldung abgelehnt: ' + JSON.stringify(erste.d));
    for (let i = 1; i < 20; i++) assert.equal((await req('POST', '/api/logistik', tok, lm(i))).s, 200, `Logistik ${i}`);
    const l21 = await req('POST', '/api/logistik', tok, lm(21));
    assert.equal(l21.s, 429); assert.equal(l21.d.code, 'logistik_zu_viele'); assert.equal(l21.d.params?.max, 20);

    // Mehrfach melden
    const ids = new Set();
    for (let i = 0; i < 5; i++) { const r = await req('POST', `/api/posts/${ziel}/report`, zweit, { reason: 'Spam' }); assert.equal(r.s, 200); ids.add(r.d.id); }
    assert.equal(ids.size, 1, 'jede Wiederholung legte einen neuen Eintrag an');
    await req('POST', `/api/posts/${ziel}/report`, red, { reason: 'Spam' });
    const offen = (await req('GET', '/api/reports', red)).d;
    const liste = Array.isArray(offen) ? offen : (offen.reports || offen.items || []);
    assert.equal(liste.filter((r) => r.target_id === ziel).length, 2, 'zwei meldende Konten = zwei Einträge');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Fehlertexte der Bremsen in 5 Sprachen, mit {max}', () => {
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    for (const k of ['beitraege_zu_viele', 'kommentare_zu_viele', 'logistik_zu_viele']) assert.match(blk, new RegExp(`[\\s,]e_${k}:'[^']*\\{max\\}`), `e_${k} (${sp})`);
  }
});
