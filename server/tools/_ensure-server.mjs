// Gemeinsamer Helfer für die Browser-Loop-Werkzeuge: stellt sicher, dass ein Server
// läuft. Ist unter baseUrl schon einer erreichbar, wird er genutzt (Rückgabe: no-op
// Cleanup). Sonst wird einer gestartet und beim Cleanup wieder beendet — damit die
// tägliche Routine (frische Session ohne laufenden Server) die Checks trotzdem fahren kann.
import { spawn } from 'node:child_process';
import path from 'node:path';

const SERVER_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export async function ensureServer(base) {
  try { const r = await fetch(base + '/api/account-types'); if (r.ok) return () => {}; } catch { /* nicht erreichbar */ }
  const proc = spawn('node', ['src/http/server.js'], {
    cwd: SERVER_ROOT,
    env: { ...process.env, APOPULSE_TOKEN_SECRET: process.env.APOPULSE_TOKEN_SECRET || 'loop-tools-secret', PORT: new URL(base).port || '4000' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(base + '/api/account-types'); if (r.ok) return () => { try { proc.kill('SIGTERM'); } catch { /* egal */ } }; }
    catch { /* noch nicht bereit */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  try { proc.kill('SIGTERM'); } catch { /* egal */ }
  throw new Error('Server konnte nicht gestartet werden (auto-start).');
}
