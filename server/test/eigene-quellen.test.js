// Eigene Engpass-Quellen (services/eigeneQuellen.js): Adressprüfung gegen
// Umlenkung des Servers auf interne Dienste (SSRF).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quellenUrlFehler, createEigeneQuellen } from '../src/services/eigeneQuellen.js';

test('erlaubt: öffentliche https-Adressen', () => {
  for (const u of ['https://www.tga.gov.au/export/active.csv', 'https://example.com:8443/a.json?x=1']) assert.equal(quellenUrlFehler(u), null, u);
});

test('abgewiesen: alles, womit sich der Server nach innen lenken ließe', () => {
  for (const u of [
    'http://www.tga.gov.au/x.csv',          // kein https
    'https://localhost/x', 'https://api.localhost/x', 'https://db.internal/x', 'https://drucker.local/x',
    'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.1/x', 'https://172.20.0.1/x',
    'https://169.254.169.254/latest/meta-data/', // Cloud-Metadaten
    'https://100.64.0.1/x', 'https://0.0.0.0/x',
    'https://[::1]/x', 'https://[fd00::1]/x', 'https://[fe80::1]/x',
    'https://[::ffff:127.0.0.1]/x',        // IPv4 in IPv6 verpackt
    'https://0x7f000001/x', 'https://127.1/x', // andere Schreibweisen von 127.0.0.1
    'https://2130706433/x',                 // 127.0.0.1 als Zahl
    'https://user:pass@example.com/x',      // Zugangsdaten
    'file:///etc/passwd', 'javascript:alert(1)', 'kein url',
  ]) assert.ok(quellenUrlFehler(u), `durchgelassen: ${u}`);
});

test('lokal nur, wenn ausdrücklich für Tests erlaubt', () => {
  assert.equal(quellenUrlFehler('http://localhost:1234/x.csv', { lokalErlaubt: true }), null);
  assert.ok(quellenUrlFehler('file:///etc/passwd', { lokalErlaubt: true }));
});

test('Eintrag: Land, Format, Standardstatus geprüft; Sichern und Laden', () => {
  const q = createEigeneQuellen({ istLand: (cc) => ['AU', 'AT'].includes(cc) });
  assert.throws(() => q.hinzufuegen({ country: 'XX', format: 'csv', url: 'https://a.b/c' }), /Land/);
  assert.throws(() => q.hinzufuegen({ country: 'AU', format: 'xml', url: 'https://a.b/c' }), /Format/);
  assert.throws(() => q.hinzufuegen({ country: 'AU', format: 'csv', url: 'https://a.b/c', standardStatus: 'egal' }), /Standardstatus/);
  const e = q.hinzufuegen({ country: 'au', format: 'csv', url: 'https://www.tga.gov.au/x.csv', label: 'TGA', standardStatus: 'eingeschraenkt' });
  assert.deepEqual([e.id, e.country, e.kind, e.eigen], ['eigen_au_1', 'AU', 'shortages', true]);
  const z = createEigeneQuellen({ istLand: () => true });
  z.__load(JSON.parse(JSON.stringify(q.__dump())));
  assert.equal(z.liste().length, 1);
  assert.equal(z.hinzufuegen({ country: 'AT', format: 'json', url: 'https://x.y/z' }).id, 'eigen_at_2', 'Zähler nach dem Laden weitergeführt');
  assert.equal(z.entfernen('eigen_au_1'), true);
  assert.equal(z.liste().length, 1);
});
