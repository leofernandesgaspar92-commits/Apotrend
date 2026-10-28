// Content-Security-Policy der App-Seite: zweite Schutzschicht gegen eingeschleusten Code.
// (Wirkung im echten Browser: tools/loop-browser-audit.mjs, Block „CSP".)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startseiteCsp } from '../src/http/startseiteKopf.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');

test('Regeln: Skripte nur von hier + Prüfsumme des eingebetteten Sprach-Skripts; kein unsafe-inline/eval für Skripte', () => {
  const html = readFileSync(join(HIER, '..', 'public', 'index.html'), 'utf8');
  const csp = startseiteCsp(html);
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const hash = crypto.createHash('sha256').update(inline, 'utf8').digest('base64');
  const scriptSrc = csp.match(/script-src([^;]*)/)[1];
  assert.match(scriptSrc, /'self'/);
  assert.ok(scriptSrc.includes(`'sha256-${hash}'`), 'Prüfsumme des Sprach-Skripts fehlt');
  assert.ok(!/unsafe-inline|unsafe-eval/.test(scriptSrc));
  for (const d of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self'", "form-action 'self'"]) assert.ok(csp.includes(d), d);
  // Geänderte index.html → andere Prüfsumme (kein veralteter, fest eingetragener Wert).
  assert.notEqual(startseiteCsp(html.replace('ok.indexOf', 'ok .indexOf')), csp);
});

test('App-Code: keine eingebetteten Skripte in Druckfenstern, kein eval/new Function', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  assert.ok(!/<script/i.test(app), 'eingebettetes Skript im App-Code (würde von der CSP blockiert)');
  assert.ok(!/\beval\(|new Function\(/.test(app));
  assert.match(app, /function druckenWennGeladen\(win\)/);
  assert.equal((app.match(/^  druckenWennGeladen\(w(in)?\);/gm) || []).length, 2, 'Druck-Rahmen und Begleitzettel');
});

test('HTTP: App-Seite mit CSP und nosniff, in jeder Sprache', { timeout: 30000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'csp-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    });
    for (const al of ['en-GH', 'fr-SN', 'ar-EG', '']) {
      const r = await fetch(`http://localhost:${port}/?k=tiktok`, { headers: al ? { 'accept-language': al } : {} });
      assert.match(r.headers.get('content-security-policy') || '', /script-src 'self' 'sha256-/, al);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    }
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
