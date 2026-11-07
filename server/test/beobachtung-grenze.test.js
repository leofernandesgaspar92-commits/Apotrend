// Beobachtungsliste mit Obergrenze — und einer klaren Ansage, wenn sie voll ist.
// Fund 11/2026: Die Sammel-Übernahme nahm beliebig viele Einträge. Wer seine ganze Bestandsliste einfügte,
// bekam z. B. 2.000 Handelsnamen auf die Beobachtungsliste (Alarme unbrauchbar laut); ein einzelnes Konto
// konnte mit wiederholten großen Anfragen Speicher und Sicherung aufblähen. Für ganze Listen gibt es den
// Sortiments-Check. Jetzt: höchstens MAX Wirkstoffe; die Übernahme nimmt, was passt, und sagt, wie viele nicht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BEOBACHTUNG } from '../src/services/shortages.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('Obergrenze: Sammel-Übernahme nimmt, was passt; einzelner Eintrag bei voller Liste: watch_voll', { timeout: 60000 }, async () => {
  assert.equal(MAX_BEOBACHTUNG, 300);
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'beob-grenze-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1' },
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
    const post = async (p, tok, body) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) }); return { s: r.status, d: await r.json() }; };
    const tok = (await post('/api/register', '', { name: 'Voll', email: 'voll@bg.test', password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' })).d.token;
    await post('/api/watchlist', tok, { wirkstoff: 'Amoxicillin' });
    const liste = ['Amoxicillin', ...Array.from({ length: 349 }, (_, i) => `Produkt ${i} 500 mg Tbl.`)];
    const r = await post('/api/watchlist/bulk', tok, { wirkstoffe: liste });
    assert.equal(r.s, 200);
    assert.equal(r.d.items.length, 300, 'mehr als die Obergrenze übernommen');
    assert.equal(r.d.nicht_uebernommen, 50, '1 schon da + 299 neu passen, 50 nicht');
    assert.equal(r.d.max, 300);
    const eins = await post('/api/watchlist', tok, { wirkstoff: 'Paracetamol' });
    assert.equal(eins.s, 409); assert.equal(eins.d.code, 'watch_voll'); assert.equal(eins.d.params.max, 300);
    assert.equal((await post('/api/watchlist', tok, { wirkstoff: 'Amoxicillin' })).s, 200, 'schon beobachteter Wirkstoff zählt nicht doppelt');
    const nochmal = await post('/api/watchlist/bulk', tok, { wirkstoffe: ['Paracetamol', 'Ibuprofen'] });
    assert.equal(nochmal.d.nicht_uebernommen, 2);
    // Bei voller Liste: schon Beobachtetes erneut einzufügen ist kein „nicht übernommen".
    assert.equal((await post('/api/watchlist/bulk', tok, { wirkstoffe: ['Amoxicillin', 'Produkt 3 500 mg Tbl.'] })).d.nicht_uebernommen, 0);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('App sagt, wie viele nicht übernommen wurden, und verweist auf den Sortiments-Check (5 Sprachen)', () => {
  assert.match(APP, /if \(r\.nicht_uebernommen\) err\.textContent = ti\('wl_teil_voll', \{ n: r\.nicht_uebernommen, max: r\.max \}\);/);
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    assert.match(blk, /[\s,]wl_teil_voll:'[^']*\{n\}[^']*\{max\}/, `wl_teil_voll (${sp})`);
    assert.match(blk, /[\s,]e_watch_voll:'[^']*\{max\}/, `e_watch_voll (${sp})`);
  }
});
