// Land automatisch beim ersten Besuch (Owner: „Länder automatisch nach Lokation
// wählen und nur nach Bedarf ändern") und ein Einstieg so einfach wie bei
// Facebook: Formular zuerst, Enter schickt ab, Passwort-Manager funktionieren,
// keine Pflicht-Zwischenseite nach der Registrierung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES } from '../src/data/countries.js';
import { ZEITZONE_LAND } from '../src/data/zeitzonen.js';
import { landVorschlag } from '../src/domain/landVorschlag.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const css = readFileSync(join(HIER, '..', 'public', 'app.css'), 'utf8');
const v = (tz, sprachen) => landVorschlag({ zeitzone: tz, sprachen, laender: COUNTRIES });

test('Zeitzonen-Tabelle: jedes Land des Registers wird über seine Zeitzone gefunden, nur Register-Länder', () => {
  for (const c of Object.values(COUNTRIES)) assert.ok((ZEITZONE_LAND[c.timezone] || []).includes(c.code), `${c.code} ${c.timezone}`);
  for (const [tz, liste] of Object.entries(ZEITZONE_LAND)) for (const cc of liste) assert.ok(COUNTRIES[cc], `${tz} → ${cc}`);
  // Alle 54 Länder Afrikas: ihre Hauptzone ist eindeutig.
  for (const c of Object.values(COUNTRIES).filter((x) => x.region === 'AFRICA')) assert.equal(v(c.timezone, []).land, c.code, c.code);
});

test('Sicher nur bei eindeutiger Zeitzone; Werksvorgaben (en-US, pt-BR, ar-EG) überstimmen sie nicht', () => {
  assert.equal(v('Africa/Dakar', ['fr-FR', 'fr']).land, 'SN');
  assert.equal(v('Africa/Kampala', ['en-US', 'en']).land, 'UG', 'Ugandische Handys stehen oft auf en-US');
  assert.equal(v('Africa/Maputo', ['pt-BR']).land, 'MZ');
  assert.equal(v('Africa/Casablanca', ['ar-EG', 'fr-FR']).land, 'MA');
  assert.equal(v('Africa/Lubumbashi', []).land, 'CD', 'zweite Zone der DR Kongo');
  assert.equal(v('Africa/Nairobi', ['sw-KE', 'en-US']).land, 'KE');
});

test('Widerspruch oder unbekannt: nichts festlegen, Kandidaten anbieten', () => {
  const kenia = v('Africa/Nairobi', ['de-AT', 'de']);
  assert.equal(kenia.land, null);
  assert.deepEqual(kenia.kandidaten, ['KE', 'AT']);
  assert.deepEqual(v('Asia/Tokyo', ['ja-JP']), { land: null, kandidaten: [], grund: 'unbekannt' });
  assert.deepEqual(v('Asia/Tokyo', ['en-NG']).kandidaten, ['NG'], 'Sprach-Region allein: nur Vorschlag');
  assert.equal(v('Asia/Tokyo', ['en-NG']).land, null);
  assert.equal(v('', 'x'.repeat(5000)).land, null, 'Unsinn bricht nichts');
});

test('Oberfläche: Start ohne Länderliste, wenn sicher; Formulare wie bei Facebook', () => {
  const start = app.slice(app.lastIndexOf('const _hasCountry'));
  assert.match(start, /if \(await landAutomatisch\(\)\) authScreen\(\);\n\s*else countryScreen\(\);/);
  assert.match(app, /fetch\('\/api\/land-vorschlag\?tz='/);
  // Echte Formulare: Enter schickt ab, Passwort-Manager erkennen sie.
  assert.match(app, /<form data-authpane="login" id="li_form"/);
  assert.match(app, /<form data-authpane="register" id="rg_form"/);
  assert.match(app, /id="li_go" type="submit"/); assert.match(app, /id="rg_go" type="submit"/);
  assert.match(app, /autocomplete="current-password"/); assert.match(app, /autocomplete="new-password"/);
  assert.match(app, /data-pw="li_pw"/); assert.match(app, /data-pw="rg_pw"/);
  // Keine Pflicht-Zwischenseite nach der Registrierung; Codes nur für diese Sitzung.
  const reg = app.slice(app.indexOf('const registrieren = async'), app.indexOf('const forgot ='));
  assert.doesNotMatch(reg, /recoveryCodesScreen\(/);
  assert.match(reg, /sessionStorage\.setItem\('apo_rc_neu'/);
  assert.doesNotMatch(app, /localStorage\.setItem\('apo_rc_neu'/, 'Codes nie dauerhaft im Browser');
  // Handy: Formular vor den Werbetexten.
  assert.match(css, /@media \(max-width:819\.98px\)\{ \.auth-forms \{ order:-1; \} \}/);
});

test('HTTP: /api/land-vorschlag ohne Anmeldung, ohne IP-Auswertung', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'land-vorschlag-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((ok, fehler) => {
      let l = ''; const z = setTimeout(() => fehler(new Error('Server startet nicht')), 30000);
      kind.stdout.on('data', (d) => { l += d; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(z); ok(m[1]); } });
    });
    const get = (pfad) => new Promise((ok, fehler) => http.get({ host: 'localhost', port, path: pfad, headers: { 'x-forwarded-for': '41.82.0.1' } }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(b) }));
    }).on('error', fehler));
    const sn = await get('/api/land-vorschlag?tz=' + encodeURIComponent('Africa/Dakar') + '&sprachen=fr-FR,fr');
    assert.equal(sn.status, 200); assert.equal(sn.json.land, 'SN');
    const ohne = await get('/api/land-vorschlag');
    assert.equal(ohne.json.land, null, 'IP allein bestimmt nichts');
    const ke = await get('/api/land-vorschlag?tz=' + encodeURIComponent('Africa/Nairobi') + '&sprachen=de-AT');
    assert.deepEqual(ke.json.kandidaten, ['KE', 'AT']);
  } finally { kind.kill(); }
});
