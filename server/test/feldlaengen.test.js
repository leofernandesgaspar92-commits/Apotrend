// Name, Berufsbezeichnung, Fachgebiete und Meldegrund haben eine Höchstlänge.
// Fund 11/2026 (Probe mit 200.000 Zeichen je Feld): Name bei der Registrierung und im Profil, Berufsbezeichnung,
// einzelne Fachgebiete und der Grund beim Melden eines Inhalts wurden ungekürzt gespeichert. Der Name steht an
// jedem Beitrag: Ein Konto mit langem Namen und 5 Beiträgen machte den öffentlichen Feed für jede Leserin im Land
// 504 KB groß statt rund 5 KB — mobile Daten, die Apotheken in Afrika bezahlen. Die Bio war schon begrenzt (500).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('Höchstlängen: Name 80, Berufsbezeichnung 120, Fachgebiet 60, Meldegrund 500; Feed bleibt klein', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'feldlaengen-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1',
      APOPULSE_ADMIN_EMAIL: 'red@fl.test', APOPULSE_ADMIN_PASSWORD: 'feldlaengen-PW-1' },
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
    const req = async (m, p, tok, body) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: m === 'GET' ? undefined : JSON.stringify(body || {}) }); const txt = await r.text(); return { s: r.status, d: JSON.parse(txt), n: txt.length }; };
    const neu = (name, email) => req('POST', '/api/register', '', { name, email, password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' });

    // Registrierung
    const lang = await neu('Ä'.repeat(81), 'lang@fl.test');
    assert.equal(lang.s, 400, 'Name mit 81 Zeichen angenommen');
    assert.equal(lang.d.code, 'display_name_too_long'); assert.equal(lang.d.params?.max, 80);
    const ok = await neu('Wanjiru ' + 'K'.repeat(72), 'ok@fl.test');
    assert.equal(ok.s, 200, '80 Zeichen abgelehnt');
    const tok = ok.d.token;
    const betrieb = await req('POST', '/api/register', '', { name: 'Kurz', pharmacyName: 'B'.repeat(121), email: 'b@fl.test', password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' });
    assert.equal(betrieb.s, 400); assert.equal(betrieb.d.code, 'betrieb_name_too_long'); assert.equal(betrieb.d.params?.max, 120);

    // Profil
    const pn = await req('POST', '/api/profile', tok, { displayName: 'N'.repeat(81) });
    assert.equal(pn.s, 400); assert.equal(pn.d.code, 'display_name_too_long');
    const pt = await req('POST', '/api/profile', tok, { title: 'T'.repeat(121) });
    assert.equal(pt.s, 400); assert.equal(pt.d.code, 'title_too_long'); assert.equal(pt.d.params?.max, 120);
    assert.equal((await req('POST', '/api/profile', tok, { title: 'Apothekerin, Filialleitung' })).s, 200);
    const sp = await req('POST', '/api/profile', tok, { specializations: ['Onkologie', 'S'.repeat(5000)] });
    assert.equal(sp.s, 200);
    assert.ok(sp.d.profile.specializations.every((s) => s.length <= 60), 'Fachgebiet ungekürzt');

    // Melden
    const red = (await req('POST', '/api/login', '', { email: 'red@fl.test', password: 'feldlaengen-PW-1' })).d.token;
    const post = (await req('POST', '/api/posts', tok, { body: 'Amoxicillin knapp?', visibility: 'public' })).d;
    const pid = post.id || post.post?.id;
    const rep = await req('POST', `/api/posts/${pid}/report`, tok, { reason: 'G'.repeat(200000) });
    assert.equal(rep.s, 200);
    assert.ok(rep.n < 2000, `Meldegrund ungekürzt gespeichert (${rep.n} Zeichen)`);
    const liste = (await req('GET', '/api/reports', red));
    assert.ok(liste.n < 5000, `Prüfliste ${liste.n} Zeichen`);

    // Feed: 5 Beiträge eines Kontos mit Höchstlängen bleiben klein
    for (let i = 0; i < 4; i++) await req('POST', '/api/posts', tok, { body: 'Beitrag ' + i, visibility: 'public' });
    const leser = (await neu('Leser', 'leser@fl.test')).d.token;
    const feed = await req('GET', '/api/feed/public?sort=neu', leser);
    assert.equal(feed.s, 200);
    assert.ok(feed.n < 20000, `Feed ${feed.n} Zeichen`);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Eingabefelder begrenzen schon beim Tippen; Fehlertexte in 5 Sprachen', () => {
  assert.match(APP, /<input id="ep_name" maxlength="80" /);
  assert.match(APP, /<input id="ep_title" maxlength="120" /);
  assert.match(APP, /id="rg_name"[^>]*maxlength="80"/);
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    for (const k of ['e_display_name_too_long', 'e_title_too_long', 'e_betrieb_name_too_long']) assert.match(blk, new RegExp(`[\\s,]${k}:'[^']*\\{max\\}`), `${k} (${sp})`);
  }
});
