// Sicherheits-Kopfzeilen auf JEDER Antwort, HTTPS-Zwang hinter Render.
// Fund 11/2026: Nur die App-Seite trug nosniff/Referrer-Regel/Einbettungsschutz. Datenschutzerklärung, Checkout-Demo,
// Skripte und Schnittstelle nicht; und nirgends Strict-Transport-Security — wer einmal über HTTPS da war, konnte in
// einem offenen WLAN auf eine unverschlüsselte, manipulierte Fassung umgeleitet werden (Token liegt im Browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Jede Antwort: nosniff, Referrer-Regel, Einbettung nur von der eigenen Seite; HSTS nur hinter HTTPS', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'kopf-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1' },
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
    const pfade = ['/', '/datenschutz.html', '/datenschutz-ar.html', '/checkout-demo.html', '/app.js', '/i18n.js', '/sitemap.xml', '/engpass', '/api/countries', '/api/nichtda', '/api/me'];
    const falsch = [];
    for (const p of pfade) {
      const r = await fetch(B + p); await r.arrayBuffer();
      const h = (n) => r.headers.get(n) || '';
      if (h('x-content-type-options') !== 'nosniff') falsch.push(`${p}: nosniff fehlt`);
      if (!/^(strict-origin-when-cross-origin|no-referrer)$/.test(h('referrer-policy'))) falsch.push(`${p}: Referrer-Policy „${h('referrer-policy')}"`);
      if (!/^(SAMEORIGIN|DENY)$/.test(h('x-frame-options'))) falsch.push(`${p}: X-Frame-Options „${h('x-frame-options')}"`);
      if (h('strict-transport-security')) falsch.push(`${p}: HSTS ohne HTTPS`);
    }
    assert.deepEqual(falsch, []);
    // Hinter Render (TLS endet dort, x-forwarded-proto: https): HSTS ein Jahr, ohne includeSubDomains (andere Dienste
    // auf Unterdomänen des Betreibers sollen nicht unbeabsichtigt HTTPS-pflichtig werden).
    for (const p of ['/', '/api/countries', '/datenschutz.html']) {
      const r = await fetch(B + p, { headers: { 'x-forwarded-proto': 'https' } }); await r.arrayBuffer();
      const hsts = r.headers.get('strict-transport-security') || '';
      assert.match(hsts, /^max-age=(\d+)$/, `${p}: HSTS „${hsts}"`);
      assert.ok(Number(hsts.split('=')[1]) >= 31536000, `${p}: HSTS zu kurz`);
    }
    // Die App-Seite bleibt strenger: gar nicht einbettbar.
    const start = await fetch(B + '/'); await start.arrayBuffer();
    assert.match(start.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
