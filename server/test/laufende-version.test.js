// Welche Version läuft live? Render setzt RENDER_GIT_COMMIT/RENDER_GIT_BRANCH; /api/health und das
// Betriebs-Cockpit zeigen sie. Anlass: Einmal gingen ~20 fertige Funktionen nie live, weil der
// Deploy-Branch (feed-first) einen anderen Stand hatte — niemand konnte es von außen sehen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
async function mitServer(env, fn) {
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], { env: { ...process.env, PORT: '0', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', RENDER_GIT_COMMIT: '', RENDER_GIT_BRANCH: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    await fn(`http://localhost:${port}`);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
}

test('/api/health und Cockpit nennen Commit, Branch und Startzeit', { timeout: 60000 }, async () => {
  await mitServer({ APOPULSE_TOKEN_SECRET: 'ver-1', RENDER_GIT_COMMIT: '8edf065a1b2c3d4e5f60718293a4b5c6d7e8f901', RENDER_GIT_BRANCH: 'feed-first',
    APOPULSE_ADMIN_EMAIL: 'red@ver.test', APOPULSE_ADMIN_PASSWORD: 'ver-test-PW-123' }, async (B) => {
    const h = await (await fetch(B + '/api/health')).json();
    assert.equal(h.version.commit, '8edf065');
    assert.equal(h.version.branch, 'feed-first');
    assert.ok(Math.abs(Date.parse(h.version.gestartet) - Date.now()) < 60000, 'Startzeit');
    const H = { 'content-type': 'application/json' };
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'red@ver.test', password: 'ver-test-PW-123' }) })).json()).token;
    const b = await (await fetch(B + '/api/betrieb', { headers: { authorization: 'Bearer ' + red } })).json();
    assert.deepEqual(b.version, h.version);
  });
  await mitServer({ APOPULSE_TOKEN_SECRET: 'ver-2' }, async (B) => {
    const h = await (await fetch(B + '/api/health')).json();
    assert.equal(h.version.commit, null, 'ohne Render: ehrlich unbekannt');
  });
  const app = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
  assert.match(app, /data-btversion>\$\{esc\(b\.version\.commit \? ti\('bt_version'/);
});
