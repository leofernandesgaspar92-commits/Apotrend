// Erstbesuch mit Mobilfunk-Daten (Zielmärkte: Prepaid, oft 2G/3G).
// Fund 11/2026 (gemessen über einen Proxy mit 400 kbit/s, fr-SN, 360 px): Von 300 KB beim ersten Besuch
// waren 92 KB Icons, die der Service Worker vorab speicherte (512er, maskable, Apple) — offline braucht
// die App davon keines; beim Installieren holt sie der Browser bzw. das Betriebssystem selbst.
// Jetzt: nur icon-192 (Benachrichtigungen) und icon.svg (Tab-Symbol) im Vorab-Speicher; alte Einträge
// werden beim Aktivieren entfernt (Speicher am Handy); die PNGs sind verlustfrei verkleinert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = readFileSync(join(ROOT, 'public', 'sw.js'), 'utf8');
const O = 'https://apopulse.example';

function welt() {
  const speicher = new Map();
  const hinzugefuegt = [];
  const cacheVon = (name) => {
    if (!speicher.has(name)) speicher.set(name, new Map());
    const m = speicher.get(name);
    return {
      add: async (u) => { hinzugefuegt.push(u); m.set(new URL(u, O).href, new Response('x')); },
      put: async (r, res) => { m.set(typeof r === 'string' ? new URL(r, O).href : r.url, res); },
      keys: async () => [...m.keys()].map((url) => new Request(url)),
      delete: async (r) => m.delete(typeof r === 'string' ? new URL(r, O).href : r.url),
      match: async () => undefined,
    };
  };
  const caches = { open: async (n) => cacheVon(n), keys: async () => [...speicher.keys()], delete: async (n) => speicher.delete(n), match: async () => undefined };
  const hoerer = {};
  const self = { location: { origin: O }, addEventListener: (t, f) => { hoerer[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} } };
  new Function('self', 'caches', 'fetch', SW)(self, caches, async () => new Response('netz'));
  const ereignis = async (typ) => { let p; hoerer[typ]({ waitUntil: (x) => { p = x; } }); await p; };
  return { speicher, hinzugefuegt, ereignis, cacheVon };
}
const shellName = () => SW.match(/const CACHE = '([^']+)'/)[1];

test('Vorab-Speicher: nur, was die App offline braucht — keine großen Icons', async () => {
  const w = welt();
  await w.ereignis('install');
  const pfade = w.hinzugefuegt.map(String);
  for (const p of ['/index.html', '/app.js', '/app.css', '/icon-192.png', '/icon.svg']) assert.ok(pfade.includes(p), `${p} fehlt (offline nötig)`);
  for (const p of ['/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png']) assert.ok(!pfade.includes(p), `${p} wird beim Erstbesuch mitgeladen`);
});

test('Aktivieren räumt alte Einträge aus dem Vorab-Speicher (Speicher am Handy)', async () => {
  const w = welt();
  const c = w.cacheVon(shellName());
  await c.put(O + '/icon-512.png', new Response('alt')); await c.put(O + '/app.js', new Response('alt'));
  await w.ereignis('activate');
  const urls = (await c.keys()).map((r) => new URL(r.url).pathname);
  assert.ok(!urls.includes('/icon-512.png'), 'altes 512er-Icon bleibt liegen');
  assert.ok(urls.includes('/app.js'), 'App-Hülle gelöscht');
});

test('Icons verlustfrei verkleinert', () => {
  const g = (f) => statSync(join(ROOT, 'public', f)).size;
  assert.ok(g('icon-512.png') < 40000, `icon-512.png ${g('icon-512.png')} B`);
  assert.ok(g('icon-maskable-512.png') < 25000, `icon-maskable-512.png ${g('icon-maskable-512.png')} B`);
  assert.ok(g('icon-192.png') < 10500, `icon-192.png ${g('icon-192.png')} B`);
});
