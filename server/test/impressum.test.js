// Impressum (§ 5 ECG, § 25 MedienG) und Betreiberangaben. Bis 10/2026: kein Impressum, Datenschutz
// nirgends verlinkt, Verantwortlicher nur Platzhalter — niemand konnte sehen, wer ApoPulse betreibt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { impressumSeite, betreiberAngaben, datenschutzMitAngaben, organisationJsonLd, GRUENDER } from '../src/http/impressum.js';

const HIER = dirname(fileURLToPath(import.meta.url));

test('Impressum: Gründer fest, Rest aus den Einstellungen; Fehlendes sichtbar als „noch einzutragen", nichts erfunden', () => {
  assert.equal(GRUENDER, 'Leo Fernandes Gaspar');
  const leer = impressumSeite({ sp: 'de', angaben: betreiberAngaben({}) });
  assert.match(leer, /Betreiber und Medieninhaber<\/th><td>Leo Fernandes Gaspar/);
  assert.match(leer, /Gründer<\/th><td>Leo Fernandes Gaspar/);
  assert.equal((leer.match(/\[noch einzutragen\]/g) || []).length, 2, 'Anschrift und E-Mail');
  assert.match(leer, /§ 5 E-Commerce-Gesetz/);
  const voll = impressumSeite({ sp: 'en', basis: 'https://apopulse.example', angaben: betreiberAngaben({ APOPULSE_FIRMA_NAME: 'ApoPulse <GmbH>', APOPULSE_FIRMA_ANSCHRIFT: 'Hauptplatz 1\n4020 Linz', APOPULSE_KONTAKT_EMAIL: 'hallo@apopulse.example', APOPULSE_FIRMA_UST_ID: 'ATU123' }) });
  assert.match(voll, /<html lang="en"/);
  assert.match(voll, /ApoPulse &lt;GmbH&gt;/, 'escaped');
  assert.match(voll, /Hauptplatz 1<br>4020 Linz/);
  assert.ok(!/\[to be added\]/.test(voll));
  assert.match(voll, /"founder":\{"@type":"Person","name":"Leo Fernandes Gaspar"\}/);
  assert.deepEqual(organisationJsonLd('').founder, { '@type': 'Person', name: 'Leo Fernandes Gaspar' });
});

test('Datenschutz: Verantwortlicher und Kontakt werden eingesetzt, sobald Anschrift und E-Mail eingetragen sind', () => {
  const roh = readFileSync(join(HIER, '..', 'public', 'datenschutz.html'), 'utf8');
  assert.equal(datenschutzMitAngaben(roh, betreiberAngaben({})), roh, 'ohne Angaben unverändert (Platzhalter bleibt sichtbar)');
  const mit = datenschutzMitAngaben(roh, betreiberAngaben({ APOPULSE_FIRMA_ANSCHRIFT: 'Hauptplatz 1, 4020 Linz', APOPULSE_KONTAKT_EMAIL: 'datenschutz@apopulse.example' }));
  assert.ok(!/Noch einzutragen: Name bzw\. Firma/.test(mit), 'Verantwortlicher noch Platzhalter');
  assert.ok(!/Noch einzutragen: E-Mail-Adresse für Datenschutzanfragen/.test(mit), 'Kontakt noch Platzhalter');
  assert.match(mit, /Leo Fernandes Gaspar<br>Hauptplatz 1, 4020 Linz<br>E-Mail: <a href="mailto:datenschutz@apopulse\.example">/);
});

test('Erreichbar: Menü, Anmeldung, öffentliche Seiten, Teilseiten; Startseite nennt den Gründer für Suchmaschinen', { timeout: 30000 }, async () => {
  const idx = readFileSync(join(HIER, '..', 'public', 'index.html'), 'utf8');
  assert.match(idx, /class="km-recht"><a href="\/impressum"[^>]*>Impressum<\/a> · <a href="\/datenschutz\.html"/);
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  const auth = app.slice(app.indexOf('function authScreen('), app.indexOf('function afterAuth('));
  assert.match(auth, /class="auth-recht"><a href="\/impressum">/);
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'imp-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
    APOPULSE_PUBLIC_URL: 'https://apopulse.example', APOPULSE_FIRMA_ANSCHRIFT: 'Hauptplatz 1, 4020 Linz', APOPULSE_KONTAKT_EMAIL: 'hallo@apopulse.example' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    });
    const B = `http://localhost:${port}`;
    const imp = await fetch(B + '/impressum', { headers: { 'accept-language': 'de-AT' } });
    assert.equal(imp.status, 200);
    const t = await imp.text();
    assert.match(t, /Hauptplatz 1, 4020 Linz/); assert.match(t, /hallo@apopulse\.example/); assert.ok(!/noch einzutragen/.test(t));
    assert.match(await (await fetch(B + '/datenschutz.html')).text(), /Hauptplatz 1, 4020 Linz/);
    assert.match(await (await fetch(B + '/')).text(), /<script type="application\/ld\+json">\{[^<]*"founder":\{"@type":"Person","name":"Leo Fernandes Gaspar"\}/);
    assert.match(await (await fetch(B + '/engpaesse', { headers: { 'accept-language': 'fr' } })).text(), /<a href="\/impressum">Mentions légales<\/a> · <a href="\/datenschutz\.html">Confidentialité<\/a>/);
    assert.match(await (await fetch(B + '/teilen/lage/GH')).text(), /<a href="\/impressum">Legal notice<\/a>/);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
