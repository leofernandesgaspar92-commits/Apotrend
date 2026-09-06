// Integrationstest: bootet den echten HTTP-Server und prüft die am HTTP-Layer
// komponierten Endpunkte (die sonst nur im Browser verifiziert wurden).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Roh-GET ohne fetch — fetch dekomprimiert transparent und verschluckt content-encoding.
function rawGet(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

import { featureListe, featureEnvKey } from '../src/data/features.js';

const PORT = 4200 + Math.floor(Math.random() * 300);
process.env.PORT = String(PORT);
process.env.APOPULSE_ADMIN_EMAIL = 'red@apopulse.test';
process.env.APOPULSE_ADMIN_PASSWORD = 'redredred123';
delete process.env.APOPULSE_DATA_FILE; // In-Memory

// ── Alle Bereiche AN, auch die ruhenden ─────────────────────────────────────
// Das Audit vom 06.09.2026 hat mehrere Bereiche geparkt (data/features.js).
// Geparkt heisst ausgeblendet, NICHT aufgegeben: Sie lassen sich mit einer
// Umgebungsvariable zurueckschalten. Genau deshalb muessen sie weiter getestet
// werden — ein ruhender Bereich, dessen Tests verfallen, ist nicht ruhend,
// sondern kaputt, und das faellt erst beim Wiedereinschalten auf.
//
// Dass die Bereiche im NORMALZUSTAND tatsaechlich schweigen, prueft eine
// eigene Datei: test/features-http.test.js. Beides gehoert zusammen.
for (const f of featureListe({})) process.env[featureEnvKey(f.id)] = 'an';
const BASE = `http://localhost:${PORT}`;
const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });

let httpServer;
before(async () => {
  ({ httpServer } = await import('../src/http/server.js'));
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch { /* noch nicht bereit */ }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Server nicht rechtzeitig gestartet');
});
after(() => new Promise(res => httpServer.close(res)));

async function reg(handle) {
  const r = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: handle, handle, email: handle + '@a.at', password: 'geheim123' }) });
  return (await r.json()).token;
}
const j = async (path, tok) => (await fetch(BASE + path, { headers: H(tok) })).json();
const post = (path, tok, body) => fetch(BASE + path, { method: 'POST', headers: H(tok), body: JSON.stringify(body || {}) });

test('Newsfeed ist länder-gescopt: AT-Nutzer sieht AT-News, ?country=DE die DE-News', async () => {
  const a = await reg('cf' + PORT); // Standard AT
  // News des aktiven Landes (AT) enthält BASG, nicht BfArM/ANVISA
  const atNews = await j('/api/news', a);
  assert.equal(atNews.country, 'AT');
  assert.ok(atNews.posts.some(p => /BASG/.test(p.body)), 'AT-News enthält BASG');
  assert.ok(!atNews.posts.some(p => /BfArM|ANVISA/.test(p.body)), 'keine DE/BR-News im AT-Scope');
  // Umschalten per Query -> DE-News (BfArM), keine BASG
  const deNews = await j('/api/news?country=DE', a);
  assert.equal(deNews.country, 'DE');
  assert.ok(deNews.posts.some(p => /BfArM/.test(p.body)), 'DE-News enthält BfArM');
  assert.ok(!deNews.posts.some(p => /BASG/.test(p.body)), 'keine AT-News im DE-Scope');
  // BR
  const brNews = await j('/api/news?country=BR', a);
  assert.ok(brNews.posts.some(p => /ANVISA/.test(p.body)), 'BR-News enthält ANVISA');
  // Eigener Beitrag landet im Land des Autors: nach Wechsel auf DE posten -> im DE-Feed
  await post('/api/profile', a, { country: 'DE' });
  await post('/api/posts', a, { body: 'Hallo aus Deutschland ' + PORT, visibility: 'public' });
  const dePub = await j('/api/feed/public?country=DE', a);
  assert.ok(dePub.posts.some(p => p.body.includes('Hallo aus Deutschland ' + PORT)), 'Beitrag im DE-Feed');
  const atPub = await j('/api/feed/public?country=AT', a);
  assert.ok(!atPub.posts.some(p => p.body.includes('Hallo aus Deutschland ' + PORT)), 'nicht im AT-Feed');
});

test('GET /api/countries: Register deckt alle Sprachgruppen ab (Locale/Währung/Zeitzone/Regulator)', async () => {
  const { listCountries } = await import('../src/data/countries.js');
  const d = await (await fetch(BASE + '/api/countries')).json();
  // Selbstkonsistent statt hartkodierte Zahl -> neue Länder brechen den Test nicht.
  assert.equal(d.countries.length, listCountries().length, 'API spiegelt das Register');
  assert.ok(d.countries.length >= 16, 'mindestens die drei Sprachgruppen vollständig');
  const at = d.countries.find(c => c.code === 'AT');
  assert.equal(at.currency, 'EUR'); assert.equal(at.locale_default, 'de'); assert.equal(at.regulator, 'BASG');
  const br = d.countries.find(c => c.code === 'BR');
  assert.equal(br.currency, 'BRL'); assert.equal(br.locale_default, 'pt');
  // Die vier neuen Länder aus der Ziel-Matrix sind da.
  for (const [code, cur, loc] of [['LI', 'CHF', 'de'], ['CA', 'CAD', 'en'], ['AU', 'AUD', 'en'], ['ZA', 'ZAR', 'en']]) {
    const c = d.countries.find(x => x.code === code);
    assert.ok(c, `${code} im Register`);
    assert.equal(c.currency, cur); assert.equal(c.locale_default, loc);
  }
  // regulator_url: belegte offizielle Quellen sind echte https-URLs; unsichere bleiben null (kein falscher Link).
  for (const [code, url] of [['DE', 'https://www.bfarm.de'], ['NG', 'https://www.nafdac.gov.ng'], ['US', 'https://www.fda.gov']]) {
    const c = d.countries.find(x => x.code === code);
    assert.equal(c.regulator_url, url, `${code} verlinkt die offizielle Behörde`);
  }
  for (const code of ['AO', 'MZ', 'LI']) {
    assert.equal(d.countries.find(x => x.code === code).regulator_url, null, `${code} ohne unbelegten Link`);
  }
  // Jeder gesetzte Link ist eine gültige https-URL.
  for (const c of d.countries) if (c.regulator_url) assert.match(c.regulator_url, /^https:\/\/[^\s]+$/, `${c.code} https-URL`);
});

test('GET /api/country-config: liefert das Feature-Schema für das aktive Land', async () => {
  const a = await reg('cc_a' + PORT);
  const d = await j('/api/country-config?country=NG', a);
  assert.equal(d.country, 'NG');
  assert.equal(d.language, 'en');
  assert.ok(Array.isArray(d.active_features));
  const reguSrc = d.active_features.find(f => f.feature_id === 'regulator_source');
  assert.equal(reguSrc.enabled, true);
  assert.equal(reguSrc.url, 'https://www.nafdac.gov.ng');
  assert.ok(d.active_features.some(f => f.feature_id === 'recall_tracking' && f.enabled === false));
});

test('GET /api/data-status: meldet, ob eine Live-Quelle angeschlossen ist (Standard: nein)', async () => {
  const a = await reg('ds_a' + PORT);
  const d = await j('/api/data-status', a);
  assert.equal(typeof d.country, 'string');
  assert.equal(d.shortages.live, false, 'ohne konfigurierte Quelle nicht live (Referenzdaten)');
  assert.equal(d.shortages.source_configured, false);
});

test('Registrierung mit Land/Sprache setzt Profil; Länder-Switch aktualisiert; ungültig abgelehnt', async () => {
  // Registrierung mit Brasilien -> country=BR, locale=pt
  const rb = await (await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'br' + PORT, handle: 'br' + PORT, email: 'br' + PORT + '@a.at', password: 'geheim123', country: 'BR' }) })).json();
  assert.equal(rb.profile.country, 'BR');
  assert.equal(rb.profile.locale, 'pt', 'Sprache folgt dem Land');
  // Länder-Switch nach Deutschland -> locale springt auf de
  const sw = await (await post('/api/profile', rb.token, { country: 'DE' })).json();
  assert.equal(sw.profile.country, 'DE');
  assert.equal(sw.profile.locale, 'de');
  // Sprache separat auf Englisch überschreiben (Land bleibt DE)
  const en = await (await post('/api/profile', rb.token, { locale: 'en' })).json();
  assert.equal(en.profile.country, 'DE');
  assert.equal(en.profile.locale, 'en');
  // ungültiges Land -> 400
  const bad = await post('/api/profile', rb.token, { country: 'XX' });
  assert.equal(bad.status, 400);
  // Fallback: Registrierung ohne Land -> AT/de
  const ra = await (await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'at' + PORT, handle: 'at' + PORT, email: 'at' + PORT + '@a.at', password: 'geheim123' }) })).json();
  assert.equal(ra.profile.country, 'AT');
  assert.equal(ra.profile.locale, 'de');
});

test('GET /api/account-types: 4 Kontotypen mit Schlüssel und Icon', async () => {
  const d = await (await fetch(BASE + '/api/account-types')).json();
  assert.equal(d.account_types.length, 4, '4 Kontotypen im Register');
  const keys = d.account_types.map(a => a.key).sort();
  assert.deepEqual(keys, ['authority', 'pharma', 'pharmacy', 'private']);
  const pharmacy = d.account_types.find(a => a.key === 'pharmacy');
  assert.ok(pharmacy.icon && pharmacy.label, 'Icon und Referenz-Label vorhanden');
});

test('Registrierung mit Kontotyp setzt Profil; Wechsel aktualisiert; ungültig abgelehnt; Fallback pharmacy', async () => {
  // Registrierung als Behörde -> account_type=authority
  const rb = await (await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'ro' + PORT, handle: 'ro' + PORT, email: 'ro' + PORT + '@a.at', password: 'geheim123', accountType: 'authority' }) })).json();
  assert.equal(rb.profile.account_type, 'authority');
  // Wechsel auf Pharma-Unternehmen
  const sw = await (await post('/api/profile', rb.token, { accountType: 'pharma' })).json();
  assert.equal(sw.profile.account_type, 'pharma');
  // ungültiger Kontotyp -> 400
  const bad = await post('/api/profile', rb.token, { accountType: 'wizard' });
  assert.equal(bad.status, 400);
  // Kontotyp bleibt nach dem abgelehnten Versuch unverändert
  const still = await (await fetch(BASE + '/api/profiles/' + ('ro' + PORT), { headers: H(rb.token) })).json();
  assert.equal(still.profile.account_type, 'pharma');
  // Fallback: Registrierung ohne Kontotyp -> pharmacy
  const rp = await (await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'rp' + PORT, handle: 'rp' + PORT, email: 'rp' + PORT + '@a.at', password: 'geheim123' }) })).json();
  assert.equal(rp.profile.account_type, 'pharmacy');
  // Autor:innen-Payload im Feed trägt account_type (für den Kontotyp-Badge in der Beitragskarte)
  await post('/api/posts', rb.token, { body: 'Kontotyp-Badge Feed-Test ' + PORT, visibility: 'public' });
  const feed = await (await fetch(BASE + '/api/feed/public', { headers: H(rb.token) })).json();
  const mine = feed.posts.find(p => p.author && p.author.handle === ('ro' + PORT));
  assert.ok(mine, 'eigener Beitrag im öffentlichen Feed');
  assert.equal(mine.author.account_type, 'pharma', 'Autor:innen-Payload trägt Kontotyp');
});

test('Fehler-Antworten tragen einen i18n-Code (Fundament der mehrsprachigen Backend-Fehler)', async () => {
  const a = await reg('ecode' + PORT);
  // leerer Beitrag -> code post_empty
  const r1 = await post('/api/posts', a, { body: '' });
  const b1 = await r1.json();
  assert.equal(r1.status, 400);
  assert.equal(b1.code, 'post_empty', 'leerer Beitrag liefert code post_empty');
  assert.ok(b1.error, 'message als Fallback weiterhin vorhanden');
  // zu langer Beitrag -> code post_too_long (mehrsprachige Längen-Fehler)
  const r1b = await post('/api/posts', a, { body: 'X'.repeat(1001) });
  const b1b = await r1b.json();
  assert.equal(r1b.status, 400);
  assert.equal(b1b.code, 'post_too_long', 'zu langer Beitrag liefert code post_too_long');
  // Login falsch -> code login_failed, Status 401
  const r2 = await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'nobody' + PORT + '@x.com', password: 'falsch' }) });
  const b2 = await r2.json();
  assert.equal(r2.status, 401);
  assert.equal(b2.code, 'login_failed');
  // Geschützte Route ohne gültigen Token -> 401 mit code not_authenticated (vom Frontend
  // genutzt, um abgelaufene Sitzungen von Login-Fehlern zu unterscheiden).
  const r2b = await fetch(BASE + '/api/feed/home', { headers: H('kaputt.token.x') });
  const b2b = await r2b.json();
  assert.equal(r2b.status, 401);
  assert.equal(b2b.code, 'not_authenticated', 'ungültiger Token liefert code not_authenticated');
  // Doppelte Registrierung: gleiche E-Mail -> code email_taken (mehrsprachig übersetzbar)
  const dupEmail = 'dupe' + PORT + '@a.at';
  await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'de1', handle: 'de1' + PORT, email: dupEmail, password: 'geheim123' }) });
  const r2c = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'de2', handle: 'de2' + PORT, email: dupEmail, password: 'geheim123' }) });
  const b2c = await r2c.json();
  assert.equal(r2c.status, 400);
  assert.equal(b2c.code, 'email_taken', 'doppelte E-Mail liefert code email_taken');
  // Registrierung mit zu kurzem Passwort -> code pw_too_short (mehrsprachig)
  const r2d = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'sp', handle: 'sp' + PORT, email: 'sp' + PORT + '@a.at', password: '12' }) });
  const b2d = await r2d.json();
  assert.equal(r2d.status, 400);
  assert.equal(b2d.code, 'pw_too_short', 'zu kurzes Passwort liefert code pw_too_short');
  // Engpass ohne Wirkstoff -> code shortage_wirkstoff_missing
  const r3 = await post('/api/shortages/report', a, { wirkstoff: '  ' });
  const b3 = await r3.json();
  assert.equal(b3.code, 'shortage_wirkstoff_missing');
  // Unkodierter Fehler bleibt ohne code (rückwärtskompatibel): unbekannte Route ist 404 ohne code
  // (stattdessen: doppelte Meldung liefert code shortage_duplicate)
  await post('/api/shortages/report', a, { wirkstoff: 'Ramipril ' + PORT });
  const r4 = await post('/api/shortages/report', a, { wirkstoff: 'Ramipril ' + PORT });
  const b4 = await r4.json();
  assert.equal(b4.code, 'shortage_duplicate');
});

test('Kontotyp-Rechte am HTTP-Layer: Privat -> 403 bei Engpass-Meldung/-Bestätigung & Bestandsaustausch; Fachkonto & Lesen ok', async () => {
  const suffix = 'kr' + PORT;
  const privReg = await (await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'pv' + suffix, handle: 'pv' + suffix, email: 'pv' + suffix + '@a.at', password: 'geheim123', accountType: 'private' }) })).json();
  const priv = privReg.token;
  // Engpass melden -> 403
  const r1 = await post('/api/shortages/report', priv, { wirkstoff: 'Ibuprofen' });
  assert.equal(r1.status, 403, 'Privat darf keinen Engpass melden');
  // Bestandsaustausch anlegen -> 403
  const r2 = await post('/api/exchange', priv, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(r2.status, 403, 'Privat darf keinen Austausch anlegen');
  // Fachkonto legt einen Community-Engpass an (Kontrolle: 200), dann Privat bestätigt -> 403
  const pro = await reg('pro' + suffix); // pharmacy
  const repRes = await post('/api/shortages/report', pro, { wirkstoff: 'Ramipril ' + suffix });
  assert.equal(repRes.status, 200, 'Fachkonto darf melden');
  const rep = await repRes.json();
  const r3 = await post('/api/shortages/' + rep.id + '/confirm', priv);
  assert.equal(r3.status, 403, 'Privat darf nicht bestätigen');
  // Privat darf trotzdem LESEN
  const list = await j('/api/shortages', priv);
  assert.ok(Array.isArray(list.shortages), 'Privat kann Engpässe lesen');
});

test('GET /api/wirkstoff/:name bündelt Engpass/Preise/Rabatte/Austausch', async () => {
  const a = await reg('wi_a' + PORT);
  const b = await reg('wi_b' + PORT);
  await post('/api/exchange', b, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten' });
  const d = await j('/api/wirkstoff/' + encodeURIComponent('Amoxicillin'), a);
  assert.equal(d.wirkstoff, 'Amoxicillin');
  assert.ok(d.shortages.length >= 1, 'Engpass-Seed vorhanden');
  assert.ok(d.prices.length >= 1, 'Preis-Seed vorhanden');
  assert.ok(d.exchange.biete.length >= 1, 'Biete-Eintrag gefunden');
  assert.equal(typeof d.watched, 'boolean');
  // Diskussion: ein öffentlicher Beitrag, der den Wirkstoff erwähnt, taucht auf.
  await post('/api/posts', a, { body: 'Bei uns Engpass bei Amoxicillin — wer hat Bestand?', visibility: 'public' });
  const d2 = await j('/api/wirkstoff/' + encodeURIComponent('Amoxicillin'), a);
  assert.ok(Array.isArray(d2.posts), 'posts-Feld vorhanden');
  assert.ok(d2.posts.some(p => /Amoxicillin/i.test(p.body)), 'erwähnender Beitrag in Diskussion');
});

test('GET /api/wirkstoff/:name: also_watching zählt beobachtende Kolleg:innen ohne sich selbst', async () => {
  const a = await reg('aw_a' + PORT);
  const b = await reg('aw_b' + PORT);
  const c = await reg('aw_c' + PORT);
  const wirk = 'Pantoprazol';
  // c schaut das Detail an, bevor jemand beobachtet -> 0
  assert.equal((await j('/api/wirkstoff/' + wirk, c)).also_watching, 0);
  await post('/api/watchlist', a, { wirkstoff: wirk });
  await post('/api/watchlist', b, { wirkstoff: wirk });
  // c sieht 2 (a + b), sich selbst nicht mitgezählt
  assert.equal((await j('/api/wirkstoff/' + wirk, c)).also_watching, 2);
  // a beobachtet selbst -> für a zählen nur die anderen (b) = 1
  assert.equal((await j('/api/wirkstoff/' + wirk, a)).also_watching, 1);
});

test('GET /api/shortages: Antibiotika-Engpässe sind als is_antibiotic markiert (für AMR-Hinweis)', async () => {
  const a = await reg('sab_a' + PORT);
  const d = await j('/api/shortages', a);
  const amox = d.shortages.find(s => /Amoxicillin/i.test(s.wirkstoff));
  assert.ok(amox && amox.is_antibiotic === true, 'Amoxicillin-Engpass als Antibiotikum markiert');
  const nonAb = d.shortages.find(s => /Metformin/i.test(s.wirkstoff));
  if (nonAb) assert.equal(nonAb.is_antibiotic, false, 'Metformin nicht als Antibiotikum markiert');
});

test('GET /api/patient-info: mehrsprachige Karten mit Quelle, Sprachwechsel funktioniert', async () => {
  const a = await reg('pinfo_a' + PORT);
  const de = await j('/api/patient-info', a);
  assert.ok(de.cards.length >= 3, 'mehrere Karten');
  assert.equal(de.lang, 'de');
  assert.ok(de.langs.some(l => l.code === 'tr'), 'Türkçe als Sprache verfügbar');
  assert.match(de.source.url, /^https:\/\//);
  assert.ok(de.disclaimer && /ersetzt nicht/i.test(de.disclaimer), 'Disclaimer vorhanden');
  const tr = await j('/api/patient-info?lang=tr', a);
  assert.equal(tr.lang, 'tr', 'Sprachwechsel auf Türkçe');
  assert.notEqual(tr.cards[0].title, de.cards[0].title, 'übersetzter Titel unterscheidet sich');
  const xx = await j('/api/patient-info?lang=xx', a);
  assert.equal(xx.lang, 'de', 'unbekannte Sprache faellt auf Deutsch zurueck');
});

test('GET /api/hashtag/stewardship: Fachforum enthält den redaktionellen Starter-Beitrag; eigene Beiträge erscheinen', async () => {
  const a = await reg('stew_a' + PORT);
  const seeded = await j('/api/hashtag/stewardship', a);
  assert.ok(seeded.posts.some(p => /Stewardship-Fachforum/i.test(p.body)), 'Starter-Beitrag vorhanden');
  await post('/api/posts', a, { body: 'Erfahrung zu kurzer Therapiedauer bei unkomplizierten Infekten? #stewardship', visibility: 'public' });
  const after = await j('/api/hashtag/stewardship', a);
  assert.ok(after.posts.some(p => /Therapiedauer/.test(p.body)), 'eigener #stewardship-Beitrag erscheint im Forum');
});

test('GET /api/wirkstoff/:name: Antibiotikum liefert quellenbelegte AMR-Info, Nicht-Antibiotikum nicht', async () => {
  const a = await reg('amr_a' + PORT);
  const anti = await j('/api/wirkstoff/' + encodeURIComponent('Amoxicillin'), a);
  assert.ok(anti.amr && anti.amr.is_antibiotic, 'Amoxicillin als Antibiotikum erkannt');
  assert.ok(anti.amr.sources.length >= 1, 'mindestens eine Quelle');
  assert.ok(anti.amr.sources.every(s => /^https:\/\//.test(s.url)), 'alle Quellen sind https-Links');
  assert.match(anti.amr.disclaimer, /keine patientenindividuelle Therapieempfehlung/i);
  const non = await j('/api/wirkstoff/' + encodeURIComponent('Metformin'), a);
  assert.equal(non.amr, null, 'Metformin ist kein Antibiotikum -> keine AMR-Info');
});

test('GET /api/me/activity liefert eigene Fragen, Meldungen, Austausch', async () => {
  const a = await reg('ac_a' + PORT);
  const q = await (await post('/api/posts', a, { body: 'Testfrage?', kind: 'frage', visibility: 'public' })).json();
  await post('/api/shortages/report', a, { wirkstoff: 'Ramipril' + PORT, bezeichnung: 'Ramipril 5mg' });
  await post('/api/exchange', a, { kind: 'suche', bezeichnung: 'Ibuprofen 400mg' });
  const d = await j('/api/me/activity', a);
  assert.ok(d.questions.some(x => x.id === q.id), 'eigene Frage enthalten');
  assert.ok(d.reports.some(r => r.wirkstoff === 'Ramipril' + PORT), 'eigene Meldung enthalten');
  assert.ok(d.exchange.length >= 1, 'eigener Austausch-Eintrag enthalten');
  // Beitrag-Statistik spiegelt die eigenen Aktivitäten wider.
  assert.ok(d.stats, 'stats-Feld vorhanden');
  assert.ok(d.stats.questions >= 1, 'mindestens eine Frage in der Statistik');
  assert.ok(d.stats.questions_open >= 1, 'offene Frage gezählt');
  assert.ok(d.stats.reports >= 1, 'Meldung in der Statistik');
  assert.ok(d.stats.exchange >= 1, 'Austausch-Eintrag in der Statistik');
  assert.equal(typeof d.stats.best_answers, 'number', 'best_answers ist eine Zahl');
});

test('GET /api/feed/public?filter=questions liefert nur Fragen', async () => {
  const a = await reg('fq_a' + PORT);
  await post('/api/posts', a, { body: 'Normaler Beitrag ' + PORT, visibility: 'public' });
  await post('/api/posts', a, { body: 'Fachfrage ' + PORT + '?', kind: 'frage', visibility: 'public' });
  const d = await j('/api/feed/public?filter=questions', a);
  assert.ok(d.posts.length >= 1);
  assert.ok(d.posts.every(p => p.is_question), 'ausschließlich Fragen');
});

test('POST /api/shortages/report: optionales "voraussichtlich bis"-Datum wird übernommen und validiert', async () => {
  const a = await reg('vb_a' + PORT);
  const ok = await (await post('/api/shortages/report', a, { wirkstoff: 'Bisoprolol' + PORT, bezeichnung: 'Bisoprolol 5mg', voraussichtlichBis: '2026-10-01' })).json();
  assert.equal(ok.voraussichtlich_bis, '2026-10-01', 'gültiges Datum gespeichert');
  const bad = await post('/api/shortages/report', a, { wirkstoff: 'Ramipril' + PORT + 'x', bezeichnung: 'X', voraussichtlichBis: '01.10.2026' });
  assert.equal(bad.status, 400, 'ungültiges Datumsformat abgelehnt');
});

test('GET /api/prices: laufende Aktion, die den besten AEP unterbietet, wird eingeblendet', async () => {
  const a = await reg('px_a' + PORT);
  const d = await j('/api/prices', a);
  const panto = d.comparisons.find(g => g.bezeichnung === 'Pantoprazol 40 mg');
  assert.ok(panto, 'Pantoprazol-Gruppe vorhanden');
  assert.ok(panto.action, 'Aktion eingeblendet (3,90 < 5,08 AEP)');
  assert.ok(panto.action.aktionspreis < panto.best_aep, 'Aktionspreis unterbietet AEP');
  assert.ok(panto.action.unter_aep_abs > 0, 'Ersparnis gegenüber AEP positiv');
  // Amoxicillin: bester AEP (3,01) ist günstiger als die Aktion (3,10) -> keine Einblendung.
  const amox = d.comparisons.find(g => g.bezeichnung === 'Amoxicillin 1000 mg');
  assert.ok(amox, 'Amoxicillin-Gruppe vorhanden');
  assert.equal(amox.action, null, 'keine Aktion, da AEP bereits günstiger');
});

test('GET /api/overview enthält watch_offers für beobachteten Wirkstoff mit Angebot', async () => {
  const a = await reg('ov_a' + PORT);
  const b = await reg('ov_b' + PORT);
  await post('/api/watchlist', a, { wirkstoff: 'Pantoprazol' });
  await post('/api/exchange', b, { kind: 'biete', bezeichnung: 'Pantoprazol 40 mg' });
  const o = await j('/api/overview', a);
  assert.ok(o.watch_offers.some(w => w.wirkstoff === 'Pantoprazol' && w.offers_count >= 1), 'Bezugsquelle im Overview');
});

test('GET /api/profiles/:handle/followers|following listet Profile', async () => {
  const a = await reg('fl_a' + PORT);
  const b = await reg('fl_b' + PORT);
  const bProfile = await j('/api/me', b);
  const bHandle = bProfile.profile.handle;
  const aHandle = (await j('/api/me', a)).profile.handle;
  await post('/api/follow', a, { handle: bHandle }); // a folgt b
  const followers = await j('/api/profiles/' + encodeURIComponent(bHandle) + '/followers', b);
  assert.ok(followers.people.some(p => p.handle === aHandle), 'a ist Follower von b');
  const following = await j('/api/profiles/' + encodeURIComponent(aHandle) + '/following', a);
  assert.ok(following.people.some(p => p.handle === bHandle), 'a folgt b');
});

test('GET /api/colleagues/nearby findet Apotheken im selben Bundesland', async () => {
  const a = await reg('nb_a' + PORT);
  const b = await reg('nb_b' + PORT);
  const c = await reg('nb_c' + PORT);
  await post('/api/profile', a, { bundesland: 'Tirol' });
  await post('/api/profile', b, { bundesland: 'Tirol' });
  await post('/api/profile', c, { bundesland: 'Wien' });
  const aHandleB = (await j('/api/me', b)).profile.handle;
  const aHandleC = (await j('/api/me', c)).profile.handle;
  const nearby = await j('/api/colleagues/nearby', a);
  assert.equal(nearby.bundesland, 'Tirol');
  assert.ok(nearby.people.some(p => p.handle === aHandleB), 'b (Tirol) gefunden');
  assert.ok(!nearby.people.some(p => p.handle === aHandleC), 'c (Wien) NICHT gefunden');
});

test('GET /api/colleagues/nearby leer ohne eigenes Bundesland', async () => {
  const a = await reg('nx_a' + PORT);
  const nearby = await j('/api/colleagues/nearby', a);
  assert.equal(nearby.bundesland, null);
  assert.deepEqual(nearby.people, []);
});

test('GET /api/trending/hashtags zählt Hashtags aus sichtbaren Beiträgen', async () => {
  const a = await reg('th_a' + PORT);
  await post('/api/posts', a, { body: 'Engpass bei #Amoxicillin und #Antibiotika ' + PORT, visibility: 'public' });
  await post('/api/posts', a, { body: 'Noch was zu #Amoxicillin ' + PORT, visibility: 'public' });
  const d = await j('/api/trending/hashtags', a);
  const amox = d.hashtags.find(h => h.tag.toLowerCase() === 'amoxicillin');
  assert.ok(amox && amox.count >= 2, 'Amoxicillin mindestens 2x');
});

test('Unbekannte Route -> 404', async () => {
  const r = await fetch(BASE + '/api/gibtsnicht');
  assert.equal(r.status, 404);
});

test('Sichtbarkeit über HTTP: Selbst-Folgen abgelehnt; „nur Follower"-Beitrag bleibt für Fremde verborgen', async () => {
  const a = await reg('fva' + PORT);
  const fResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'fvf' + PORT, handle: 'fvf' + PORT, email: 'fvf' + PORT + '@a.at', password: 'geheim123' }) });
  const follower = (await fResp.json()).token;
  const nResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'fvn' + PORT, handle: 'fvn' + PORT, email: 'fvn' + PORT + '@a.at', password: 'geheim123' }) });
  const nonFollower = (await nResp.json()).token;
  // Selbst-Folgen ist nicht möglich.
  assert.equal((await post('/api/follow', a, { handle: 'fva' + PORT })).status, 400);
  // Follower folgt A; A postet „nur Follower".
  assert.equal((await post('/api/follow', follower, { handle: 'fva' + PORT })).status, 200);
  const marker = 'FOLONLY' + PORT;
  assert.equal((await post('/api/posts', a, { body: marker, visibility: 'followers' })).status, 200);
  // Follower sieht ihn, Nicht-Follower weder im Home- noch im öffentlichen Feed.
  assert.ok(((await j('/api/feed/home', follower)).posts || []).some(p => (p.body || '').includes(marker)), 'Follower sieht Beitrag');
  assert.equal(((await j('/api/feed/home', nonFollower)).posts || []).filter(p => (p.body || '').includes(marker)).length, 0, 'Nicht-Follower: nicht im Home');
  assert.equal(((await j('/api/feed/public', nonFollower)).posts || []).filter(p => (p.body || '').includes(marker)).length, 0, 'Nicht-Follower: nicht im öffentlichen Feed');
});

test('Autorisierung über HTTP: fremde:r darf Beitrag/Kommentar nicht bearbeiten/löschen, eigene:r schon', async () => {
  const owner = await reg('owna' + PORT);
  const otherResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'ownb' + PORT, handle: 'ownb' + PORT, email: 'ownb' + PORT + '@a.at', password: 'geheim123' }) });
  const other = (await otherResp.json()).token;
  const p = await (await post('/api/posts', owner, { body: 'Gehört mir ' + PORT, visibility: 'public' })).json();
  const c = await (await post(`/api/posts/${p.id}/comments`, owner, { body: 'Mein Kommentar' })).json();
  // Fremde:r -> 403 auf alle vier Aktionen.
  assert.equal((await post(`/api/posts/${p.id}/edit`, other, { body: 'gehackt' })).status, 403);
  assert.equal((await post(`/api/posts/${p.id}/delete`, other)).status, 403);
  assert.equal((await post(`/api/comments/${c.id}/edit`, other, { body: 'gehackt' })).status, 403);
  assert.equal((await post(`/api/comments/${c.id}/delete`, other)).status, 403);
  // Beitrag unverändert.
  const g = await j(`/api/posts/${p.id}`, owner);
  assert.equal((g.post || g).body, 'Gehört mir ' + PORT, 'Beitrag unangetastet');
  // Eigentümer:in darf bearbeiten und löschen.
  assert.equal((await post(`/api/posts/${p.id}/edit`, owner, { body: 'Aktualisiert ' + PORT })).status, 200);
  assert.equal((await post(`/api/posts/${p.id}/delete`, owner)).status, 200);
});

test('Reaktion über HTTP: setzen -> my_reaction + Zähler, erneut -> aus (Toggle)', async () => {
  const a = await reg('rxa' + PORT);
  const bResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'rxb' + PORT, handle: 'rxb' + PORT, email: 'rxb' + PORT + '@a.at', password: 'geheim123' }) });
  const b = (await bResp.json()).token;
  const p = await (await post('/api/posts', a, { body: 'React ' + PORT, visibility: 'public' })).json();
  const state = async () => { const g = await j(`/api/posts/${p.id}`, b); const q = g.post || g; return { my: q.my_reaction, c: (q.reaction_counts || {}).hilfreich }; };
  assert.equal((await post(`/api/posts/${p.id}/react`, b, { type: 'hilfreich' })).status, 200);
  let s = await state();
  assert.equal(s.my, 'hilfreich', 'my_reaction gesetzt');
  assert.equal(s.c, 1, 'Zähler 1');
  // Erneut dieselbe Reaktion -> aus.
  await post(`/api/posts/${p.id}/react`, b, { type: 'hilfreich' });
  s = await state();
  assert.equal(s.my, null, 'my_reaction zurückgesetzt');
  assert.equal(s.c, 0, 'Zähler 0');
});

test('Kommentar-Antwort über HTTP: Antwort trägt parent_comment_id (Threading)', async () => {
  const a = await reg('cra' + PORT);
  const bResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'crb' + PORT, handle: 'crb' + PORT, email: 'crb' + PORT + '@a.at', password: 'geheim123' }) });
  const b = (await bResp.json()).token;
  const p = await (await post('/api/posts', a, { body: 'Diskussion ' + PORT, visibility: 'public' })).json();
  const top = await (await post(`/api/posts/${p.id}/comments`, a, { body: 'Top-Kommentar' })).json();
  const reply = await (await post(`/api/posts/${p.id}/comments`, b, { body: 'Antwort darauf', parentCommentId: top.id })).json();
  assert.equal(reply.parent_comment_id, top.id, 'Antwort verweist auf Eltern-Kommentar');
  const list = await j(`/api/posts/${p.id}/comments`, a);
  const found = (list.comments || []).find(c => c.body === 'Antwort darauf');
  assert.ok(found && found.parent_comment_id === top.id, 'Antwort erscheint threaded in der Liste');
});

test('Fachfrage über HTTP: nur der/die Fragesteller:in darf die beste Antwort wählen', async () => {
  const asker = await reg('qa' + PORT);
  const answerer = await reg('qb' + PORT);
  const q = await (await post('/api/posts', asker, { body: 'Alternative zu X? ' + PORT, kind: 'frage', visibility: 'public' })).json();
  assert.equal(q.kind, 'frage');
  const c = await (await post(`/api/posts/${q.id}/comments`, answerer, { body: 'Nimm Y' })).json();
  // Nicht-Fragesteller darf keine beste Antwort setzen.
  assert.equal((await post(`/api/posts/${q.id}/accept`, answerer, { commentId: c.id })).status, 403);
  // Fragesteller:in darf -> accepted_comment_id wird gesetzt.
  const ok = await post(`/api/posts/${q.id}/accept`, asker, { commentId: c.id });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).accepted_comment_id, c.id, 'beste Antwort markiert');
});

test('Verifizierung über HTTP: beantragen -> Queue nur für Mods -> Redaktion genehmigt -> Profil verifiziert', async () => {
  const user = await reg('vera' + PORT);
  const handle = 'vera' + PORT;
  assert.equal((await post('/api/verify/request', user, { note: 'Konzession ' + PORT })).status, 200);
  // Nicht-Mod darf die Verifizierungs-Queue nicht sehen.
  assert.equal((await fetch(BASE + '/api/verify/requests', { headers: H(user) })).status, 403);
  // Redaktion sieht den Antrag und genehmigt ihn (Antrag ist per user_id referenziert).
  const login = await (await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'red@apopulse.test', password: 'redredred123' }) })).json();
  const queue = await j('/api/verify/requests', login.token);
  const item = (queue.requests || []).find(r => r.handle === handle);
  assert.ok(item, 'Antrag erscheint in der Queue');
  assert.equal((await post(`/api/verify/${item.user_id}/resolve`, login.token, { approve: true })).status, 200);
  // Profil ist danach verifiziert.
  const prof = await j(`/api/profiles/${handle}`, user);
  assert.ok(prof.verified || (prof.profile && prof.profile.verified), 'Profil verifiziert');
});

test('Moderation über HTTP: melden -> Queue nur für Mods -> auflösen+entfernen -> Beitrag weg', async () => {
  const author = await reg('moda' + PORT);
  const reporter = await reg('modb' + PORT);
  const marker = 'BADPOST' + PORT;
  const p = await (await post('/api/posts', author, { body: marker, visibility: 'public' })).json();
  assert.equal((await post(`/api/posts/${p.id}/report`, reporter, { reason: 'Spam' })).status, 200);
  // Nicht-Mod darf die Moderations-Queue nicht sehen.
  assert.equal((await fetch(BASE + '/api/reports', { headers: H(reporter) })).status, 403);
  // Redaktion/Mod (Seed-Konto aus dem Test-Setup) meldet sich an und sieht die Meldung.
  const login = await (await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'red@apopulse.test', password: 'redredred123' }) })).json();
  const mod = login.token;
  assert.ok(mod, 'Mod-Login liefert Token');
  const queue = await j('/api/reports', mod);
  const item = (queue.reports || []).find(r => r.target_id === p.id);
  assert.ok(item, 'Meldung erscheint in der Queue');
  // Auflösen mit Entfernen -> Beitrag verschwindet aus dem öffentlichen Feed.
  assert.equal((await post(`/api/reports/${item.id}/resolve`, mod, { remove: true })).status, 200);
  const feed = await j('/api/feed/public', author);
  assert.equal((feed.posts || []).filter(x => (x.body || '').includes(marker)).length, 0, 'entfernter Beitrag ist weg');
});

test('DSGVO-Datenexport über HTTP: liefert alle personenbezogenen Daten inkl. eigener Beiträge', async () => {
  const a = await reg('exp' + PORT);
  assert.equal((await post('/api/posts', a, { body: 'Export-Beitrag ' + PORT, visibility: 'public' })).status, 200);
  const dump = await j('/api/me/export', a);
  // Vollständigkeit der Export-Struktur (Auskunftsrecht Art. 15/20 DSGVO).
  for (const k of ['profile', 'posts', 'comments', 'bookmarks_post_ids', 'direct_messages', 'exchange_entries']) {
    assert.ok(k in dump, `Export enthält ${k}`);
  }
  assert.ok((dump.posts || []).some(p => (p.body || '').includes('Export-Beitrag ' + PORT)), 'eigener Beitrag im Export');
});

test('Konto-Löschung über HTTP: falsches Passwort abgelehnt, korrekt löscht Daten und entwertet Token', async () => {
  const a = await reg('del' + PORT);
  const marker = 'DELME' + PORT;
  assert.equal((await post('/api/posts', a, { body: marker, visibility: 'public' })).status, 200);
  // Falsches Passwort -> 401.
  assert.equal((await post('/api/me/delete', a, { password: 'FALSCH' })).status, 401);
  // Korrektes Passwort -> gelöscht.
  assert.equal((await post('/api/me/delete', a, { password: 'geheim123' })).status, 200);
  // Token danach: sauberes 401 not_authenticated (Nutzer existiert nicht mehr).
  const after = await fetch(BASE + '/api/feed/home', { headers: H(a) });
  assert.equal(after.status, 401);
  assert.equal((await after.json()).code, 'not_authenticated');
  // Beiträge des gelöschten Kontos sind aus dem öffentlichen Feed verschwunden (Art. 17).
  const other = await reg('delx' + PORT);
  const feed = await j('/api/feed/public', other);
  assert.equal((feed.posts || []).filter(p => (p.body || '').includes(marker)).length, 0, 'Beiträge purge-t');
});

test('Merkliste über HTTP: Beitrag merken -> erscheint in Merkliste/ids -> erneut tippen -> weg', async () => {
  const a = await reg('bma' + PORT);
  const p = await (await post('/api/posts', a, { body: 'Merk mich ' + PORT, visibility: 'public' })).json();
  assert.ok(p.id);
  assert.equal((await post(`/api/posts/${p.id}/bookmark`, a)).status, 200);
  assert.ok(((await j('/api/bookmarks', a)).posts || []).some(x => x.id === p.id), 'in Merkliste');
  assert.ok(((await j('/api/bookmarks/ids', a)).ids || []).includes(p.id), 'in ids');
  // Erneutes Tippen entfernt aus der Merkliste (Toggle).
  await post(`/api/posts/${p.id}/bookmark`, a);
  assert.equal(((await j('/api/bookmarks', a)).posts || []).filter(x => x.id === p.id).length, 0, 'nach Toggle nicht mehr gemerkt');
});

test('Engpass-Bestätigung über HTTP: „Auch bei uns" erhöht Zähler und benachrichtigt den Melder', async () => {
  const reporter = await reg('confr' + PORT);
  const confirmer = await reg('confc' + PORT);
  const wirk = 'Conf' + PORT;
  const rep = await (await post('/api/shortages/report', reporter, { wirkstoff: wirk, bezeichnung: wirk + ' 5 mg', status: 'kritisch' })).json();
  assert.ok(rep.id, 'Meldung angelegt');
  const conf = await post(`/api/shortages/${rep.id}/confirm`, confirmer);
  assert.equal(conf.status, 200);
  assert.equal((await conf.json()).confirm_count, 1, 'Bestätigungszähler = 1');
  // Der ursprüngliche Melder wird über die Bestätigung informiert.
  const rn = await j('/api/notifications', reporter);
  assert.ok((rn.notifications || []).some(n => n.type === 'shortage_confirm'), 'Melder erhält shortage_confirm');
});

test('Login-Sicherheit über HTTP: keine E-Mail-Enumeration (gleiche Antwort für unbekannte E-Mail und falsches Passwort)', async () => {
  const email = 'enum' + PORT + '@a.at';
  await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'enum', handle: 'enum' + PORT, email, password: 'geheim123' }) });
  const wrongPw = await (await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email, password: 'FALSCH' }) })).json();
  const unknownResp = await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'niemand' + PORT + '@a.at', password: 'FALSCH' }) });
  const unknown = await unknownResp.json();
  // Identische Antwort -> Angreifer kann gültige E-Mails nicht erkennen.
  assert.equal(unknownResp.status, 401);
  assert.equal(wrongPw.error, unknown.error, 'gleiche Fehlermeldung');
  assert.equal(wrongPw.code, unknown.code, 'gleicher Code (login_failed)');
});

test('DM-Privatsphäre über HTTP: Dritte können einen fremden Thread weder lesen noch beschreiben', async () => {
  const a = await reg('dpa' + PORT);
  const bResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'dpb' + PORT, handle: 'dpb' + PORT, email: 'dpb' + PORT + '@a.at', password: 'geheim123' }) });
  const b = (await bResp.json()).token;
  const c = await reg('dpc' + PORT); // Dritte:r
  const start = await (await post('/api/dm/start', a, { handle: 'dpb' + PORT })).json();
  const tid = start.thread.id;
  assert.equal((await post(`/api/dm/${tid}`, a, { body: 'geheim ' + PORT })).status, 200);
  // Dritte:r darf den Thread nicht lesen (403, kein Leak).
  const read = await fetch(BASE + `/api/dm/${tid}`, { headers: H(c) });
  assert.equal(read.status, 403, 'Dritte:r kann Thread nicht lesen');
  // Dritte:r darf nicht in den Thread schreiben.
  assert.equal((await post(`/api/dm/${tid}`, c, { body: 'eindringen' })).status, 403);
});

test('Direktnachricht über HTTP: Thread starten -> senden -> Empfänger sieht unread -> nach Lesen 0', async () => {
  const a = await reg('dma' + PORT);
  const bResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'dmb' + PORT, handle: 'dmb' + PORT, email: 'dmb' + PORT + '@a.at', password: 'geheim123' }) });
  const b = (await bResp.json()).token;
  const bHandle = 'dmb' + PORT;
  const start = await (await post('/api/dm/start', a, { handle: bHandle })).json();
  const tid = start.thread && start.thread.id;
  assert.ok(tid, 'Thread wird angelegt');
  assert.equal((await post(`/api/dm/${tid}`, a, { body: 'Hallo ' + PORT })).status, 200);
  // Empfänger: eine ungelesene Nachricht.
  const inbox = await j('/api/dm', b);
  assert.equal(inbox.unread, 1, 'Empfänger hat 1 ungelesen');
  assert.equal((inbox.threads || []).length, 1);
  // Nach dem Öffnen der Konversation ist nichts mehr ungelesen.
  const conv = await j(`/api/dm/${tid}`, b);
  assert.equal((conv.messages || []).length, 1, 'eine Nachricht in der Konversation');
  const inbox2 = await j('/api/dm', b);
  assert.equal(inbox2.unread, 0, 'nach Lesen 0 ungelesen');
});

test('Folgen über HTTP: Beitrag der gefolgten Person erscheint im „Mein Feed", bei Nicht-Follower nicht', async () => {
  const a = await reg('flwa' + PORT);
  const bResp = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'flwb' + PORT, handle: 'flwb' + PORT, email: 'flwb' + PORT + '@a.at', password: 'geheim123' }) });
  const b = (await bResp.json()).token;
  const bHandle = 'flwb' + PORT;
  assert.equal((await post('/api/follow', a, { handle: bHandle })).status, 200);
  const marker = 'HELLO' + PORT;
  assert.equal((await post('/api/posts', b, { body: marker + ' von B', visibility: 'public' })).status, 200);
  // Follower sieht den Beitrag im Home-Feed.
  const home = await j('/api/feed/home', a);
  assert.ok((home.posts || []).some(p => (p.body || '').includes(marker)), 'gefolgter Beitrag im Mein-Feed');
  // Nicht-Follower sieht ihn dort NICHT.
  const c = await reg('flwc' + PORT);
  const homeC = await j('/api/feed/home', c);
  assert.equal((homeC.posts || []).filter(p => (p.body || '').includes(marker)).length, 0, 'Nicht-Follower: nicht im Mein-Feed');
});

test('Bestandsaustausch über HTTP: anlegen -> erscheint in offener Liste -> erledigt -> verschwindet', async () => {
  const a = await reg('exh' + PORT); // AT-Apotheke darf Austausch anlegen
  const bez = 'Amoxi' + PORT;
  const c = await post('/api/exchange', a, { kind: 'biete', bezeichnung: bez + ' 1000 mg', menge: '20 Pkg', ort: 'Wien', note: 'frisch' });
  assert.equal(c.status, 200);
  const created = await c.json();
  assert.ok(created.id, 'Eintrag bekommt eine id');
  // Erscheint in der offenen Liste.
  const open = await j('/api/exchange?status=offen', a);
  assert.ok((open.entries || []).some(e => e.id === created.id), 'Eintrag erscheint offen');
  // Als erledigt markieren -> verschwindet aus der offenen Liste.
  const res = await post(`/api/exchange/${created.id}/resolve`, a);
  assert.equal(res.status, 200);
  const open2 = await j('/api/exchange?status=offen', a);
  assert.equal((open2.entries || []).filter(e => e.id === created.id).length, 0, 'erledigter Eintrag ist nicht mehr offen');
});

test('Frühwarnnetz über HTTP: Beobachter wird bei fremder Engpass-Meldung benachrichtigt', async () => {
  const watcher = await reg('warnw' + PORT);
  const reporter = await reg('warnr' + PORT);
  const wirk = 'Ramipril' + PORT; // eindeutig pro Testlauf
  // Beobachter beobachtet den Wirkstoff.
  const w = await post('/api/watchlist', watcher, { wirkstoff: wirk });
  assert.equal(w.status, 200);
  // Reporter meldet dafür einen Engpass.
  const rep = await post('/api/shortages/report', reporter, { wirkstoff: wirk, bezeichnung: wirk + ' 5 mg', status: 'kritisch', grund: 'Test' });
  assert.equal(rep.status, 200);
  // Beobachter bekommt eine watch_alert-Benachrichtigung, der Melder nicht.
  const wn = await j('/api/notifications', watcher);
  assert.ok((wn.notifications || []).some(n => n.type === 'watch_alert'), 'Beobachter erhält watch_alert');
  const rn = await j('/api/notifications', reporter);
  assert.equal((rn.notifications || []).filter(n => n.type === 'watch_alert').length, 0, 'Melder erhält keine watch_alert');
});

test('Umfragen über HTTP: erstellen, abstimmen, im Feed, Fehlercodes', async () => {
  const author = await reg('pollA' + PORT);
  const voter = await reg('pollB' + PORT);
  // Umfrage anlegen
  const cr = await post('/api/posts', author, { kind: 'poll', body: 'Welcher Wirkstoff ist knapp?', pollOptions: ['Amoxicillin', 'Cefuroxim', 'Ibuprofen'] });
  const created = await cr.json();
  assert.equal(cr.status, 200);
  assert.equal(created.kind, 'poll');
  assert.equal(created.poll_options.length, 3);
  const pid = created.id;
  // Abstimmen über die dedizierte Route
  const vr = await post(`/api/polls/${pid}/vote`, voter, { optionId: 'o2' });
  const voted = await vr.json();
  assert.equal(vr.status, 200);
  assert.equal(voted.ok, true);
  assert.equal(voted.poll.total, 1);
  assert.equal(voted.poll.counts.o2, 1);
  // Im öffentlichen Feed reichert der Server die Umfrage an (aus Betrachtersicht)
  const feed = await j('/api/feed/public', voter);
  const seen = feed.posts.find(p => p.id === pid);
  assert.ok(seen && seen.poll, 'Umfrage samt poll-Payload im Feed');
  assert.equal(seen.poll.total, 1);
  assert.equal(seen.poll.my_vote, 'o2', 'eigene Stimme des Betrachters');
  // Stimme zurückziehen
  const undo = await (await post(`/api/polls/${pid}/vote`, voter, { optionId: null })).json();
  assert.equal(undo.poll.total, 0);
  // Fehlercodes: Abstimmen auf Nicht-Umfrage / unbekannte Option
  const normal = await (await post('/api/posts', author, { body: 'Kein Poll' })).json();
  const e1 = await post(`/api/polls/${normal.id}/vote`, voter, { optionId: 'o1' });
  assert.equal(e1.status, 400);
  assert.equal((await e1.json()).code, 'poll_not_a_poll');
  const e2 = await post(`/api/polls/${pid}/vote`, voter, { optionId: 'o99' });
  assert.equal((await e2.json()).code, 'poll_bad_option');
  // Anlegen mit nur einer Option -> poll_options_missing
  const e3 = await post('/api/posts', author, { kind: 'poll', body: 'Frage?', pollOptions: ['Nur eine'] });
  assert.equal(e3.status, 400);
  assert.equal((await e3.json()).code, 'poll_options_missing');
  // Abstimmen erfordert Auth
  const noAuth = await fetch(BASE + `/api/polls/${pid}/vote`, { method: 'POST', headers: H(), body: JSON.stringify({ optionId: 'o1' }) });
  assert.equal(noAuth.status, 401, 'ohne Token 401');
});

test('Login-Brute-Force-Schutz: sperrt nach 5 Fehlversuchen (429), Erfolg setzt zurück', async () => {
  const handle = 'brute' + PORT;
  await reg(handle); // legt Konto mit Passwort geheim123 an
  const email = handle + '@a.at';
  const tryLogin = (pw) => fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email, password: pw }) });
  // 5 Fehlversuche -> jeweils 401 login_failed
  for (let i = 0; i < 5; i++) {
    const r = await tryLogin('falsch' + i);
    assert.equal(r.status, 401, `Versuch ${i + 1} -> 401`);
    assert.equal((await r.json()).code, 'login_failed');
  }
  // 6. Versuch -> 429 too_many_attempts, auch mit RICHTIGEM Passwort gesperrt
  const blocked = await tryLogin('geheim123');
  assert.equal(blocked.status, 429, 'nach 5 Fehlversuchen gesperrt');
  const bb = await blocked.json();
  assert.equal(bb.code, 'too_many_attempts');
  assert.ok(bb.retry_after_s > 0, 'Wartezeit fürs Frontend');
  // Ein anderes Konto (andere E-Mail) ist NICHT betroffen — kein globaler Ausfall.
  const other = 'brute2' + PORT;
  await reg(other);
  const ok2 = await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: other + '@a.at', password: 'geheim123' }) });
  assert.equal(ok2.status, 200, 'anderes Konto weiterhin einlogbar');
});

test('Passwort-Reset per Wiederherstellungscode über HTTP (kein E-Mail-Dienst)', async () => {
  // Registrierung liefert die Codes einmalig mit.
  const handle = 'recov' + PORT;
  const rr = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: handle, handle, email: handle + '@a.at', password: 'geheim123' }) });
  const reg = await rr.json();
  assert.ok(Array.isArray(reg.recovery_codes) && reg.recovery_codes.length === 8, '8 Codes bei Registrierung');
  const email = handle + '@a.at';
  const code = reg.recovery_codes[0];
  // Reset mit gültigem Code -> neues Passwort greift
  const reset = await post('/api/password/reset', null, { email, code, newPassword: 'neuespw123' });
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).remaining_codes, 7);
  const ok = await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email, password: 'neuespw123' }) });
  assert.equal(ok.status, 200, 'Login mit neuem Passwort');
  // Verbrauchter Code funktioniert nicht mehr -> reset_invalid (400)
  const reuse = await post('/api/password/reset', null, { email, code, newPassword: 'nochwas123' });
  assert.equal(reuse.status, 400);
  assert.equal((await reuse.json()).code, 'reset_invalid');
  // Eingeloggt: verbleibende Codes abfragen + neu erzeugen
  const rem = await j('/api/recovery-codes', reg.token);
  assert.equal(rem.remaining, 7);
  const regen = await (await post('/api/recovery-codes/regenerate', reg.token, {})).json();
  assert.equal(regen.codes.length, 8, 'Neu-Erzeugung liefert 8 Codes');
});

test('Repost über HTTP: teilen, Original eingebettet im Feed, Original-Autor benachrichtigt', async () => {
  const author = await reg('rpA' + PORT);
  const sharer = await reg('rpB' + PORT);
  const orig = await (await post('/api/posts', author, { body: 'HTTP-REPOST-ORIG', visibility: 'public' })).json();
  // Teilen
  const rp = await post(`/api/posts/${orig.id}/repost`, sharer, {});
  assert.equal(rp.status, 200);
  const rpBody = await rp.json();
  assert.equal(rpBody.reposted, true);
  assert.equal(rpBody.post.kind, 'repost');
  assert.equal(rpBody.post.repost_of, orig.id);
  // Im öffentlichen Feed trägt der Repost das eingebettete Original
  const feed = await j('/api/feed/public', sharer);
  const seen = feed.posts.find(p => p.id === rpBody.post.id);
  assert.ok(seen && seen.repost_of_post, 'Original eingebettet');
  assert.equal(seen.repost_of_post.body, 'HTTP-REPOST-ORIG');
  // Erneuter Aufruf nimmt das Teilen zurück (Umschalter)
  const off = await (await post(`/api/posts/${orig.id}/repost`, sharer, {})).json();
  assert.equal(off.reposted, false);
  await post(`/api/posts/${orig.id}/repost`, sharer, {}); // wieder teilen für die folgenden Prüfungen
  // Original-Autor erhält eine repost-Benachrichtigung
  const n = await j('/api/notifications', author);
  assert.ok((n.notifications || []).some(x => x.type === 'repost'), 'repost-Benachrichtigung');
  // Repost eines gelöschten Originals -> 400 post_not_found
  await post(`/api/posts/${orig.id}/delete`, author, {});
  const gone = await post(`/api/posts/${orig.id}/repost`, sharer, {});
  assert.equal(gone.status, 400);
  assert.equal((await gone.json()).code, 'post_not_found');
});

test('Social-Login: Provider-Liste leer ohne Zugangsdaten; OAuth-Endpoint meldet klar', async () => {
  const prov = await j('/api/auth/providers', null);
  assert.deepEqual(prov.providers, [], 'ohne ENV-Zugangsdaten keine Provider');
  // OAuth-Login gegen einen nicht konfigurierten Provider -> 400 oauth_not_configured
  const r = await post('/api/auth/oauth/google', null, { code: 'x', redirectUri: 'https://app/cb' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).code, 'oauth_not_configured');
});

test('Sicherheit: /api/me liefert nie den Passwort-Hash oder Wiederherstellungs-Hashes', async () => {
  const handle = 'nohash' + PORT;
  const reg = await (await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: handle, handle, email: handle + '@a.at', password: 'geheim123' }) })).json();
  const me = await j('/api/me', reg.token);
  assert.equal(me.user.password_hash, undefined, 'kein Passwort-Hash in /api/me');
  assert.equal(me.user.recovery_hashes, undefined, 'keine Wiederherstellungs-Hashes in /api/me');
  assert.equal(me.user.twofa_secret, undefined, 'kein 2FA-Geheimnis in /api/me');
});

test('Zahlungen/Premium: Produkte sichtbar, Methoden ohne Anbieter leer, Freischaltung geschützt', async () => {
  const a = await reg('pay' + PORT);
  // Produktkatalog ist öffentlich sichtbar (EUR-Preise)
  const prods = await j('/api/payments/products', null);
  assert.ok(prods.products.some(p => p.id === 'premium_monthly' && p.amount_cents === 999));
  // ohne konfigurierten Anbieter: keine Methoden
  const methods = await j('/api/payments/methods', null);
  assert.deepEqual(methods.methods, []);
  // Checkout erfordert Login
  const noAuth = await fetch(BASE + '/api/payments/checkout', { method: 'POST', headers: H(), body: JSON.stringify({ productId: 'premium_monthly', method: 'card' }) });
  assert.equal(noAuth.status, 401);
  // eingeloggt, aber kein Anbieter -> method_unavailable (400)
  const co = await post('/api/payments/checkout', a, { productId: 'premium_monthly', method: 'card' });
  assert.equal(co.status, 400);
  assert.equal((await co.json()).code, 'method_unavailable');
  // Premium-Status ist zunächst false (Freischaltung nur über signierten Webhook)
  const me = await j('/api/me/premium', a);
  assert.equal(me.premium, false);
  // Webhook zu unbekanntem/inaktivem Anbieter -> 400 provider_unknown (Roh-Body-Pfad läuft)
  const wh = await fetch(BASE + '/api/payments/webhook/stripe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(wh.status, 400);
  assert.equal((await wh.json()).code, 'provider_unknown');
});

test('Direkt-Krypto über HTTP: Adressen anzeigen, Zahlung starten + Tx melden, Moderation bestätigt', async () => {
  const cust = await reg('crypto' + PORT);
  // Anzeige: BTC/ETH-Adressen (öffentliche Empfangsadressen), EUR-Betrag
  const opt = await j('/api/payments/crypto?product=premium_monthly', null);
  assert.equal(opt.amount_eur, 9.99);
  const btc = opt.coins.find(c => c.id === 'btc');
  assert.ok(btc && btc.address.startsWith('bc1q'), 'BTC-Adresse');
  assert.ok(opt.coins.some(c => c.id === 'eth'));
  assert.ok(btc.uri.startsWith('bitcoin:bc1q'), 'Wallet-URI');
  assert.equal(opt.coins.filter(c => c.coin === 'solana').length, 2, 'zwei SOL-Wallets (Seeker + Phantom)');
  // Zahlung starten + Tx-ID melden
  const start = await (await post('/api/payments/crypto/start', cust, { productId: 'premium_monthly', coin: 'btc' })).json();
  assert.ok(start.payment_id && start.address.startsWith('bc1q'));
  const claim = await post(`/api/payments/crypto/${start.payment_id}/claim`, cust, { txRef: 'txhash1234567890' });
  assert.equal(claim.status, 200);
  // Kunde ist NICHT Moderator -> darf nicht bestätigen; Premium noch nicht frei
  const forbid = await post(`/api/payments/${start.payment_id}/confirm`, cust, {});
  assert.equal(forbid.status, 400);
  assert.equal((await forbid.json()).code, 'forbidden');
  assert.equal((await j('/api/me/premium', cust)).premium, false);
  // Admin (Redaktion) meldet sich an, sieht die offene Zahlung, bestätigt -> Premium frei
  const adminLogin = await (await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'red@apopulse.test', password: 'redredred123' }) })).json();
  const admin = adminLogin.token;
  const pending = await j('/api/payments/pending', admin);
  assert.ok(pending.payments.some(p => p.id === start.payment_id));
  const conf = await post(`/api/payments/${start.payment_id}/confirm`, admin, {});
  assert.equal(conf.status, 200);
  assert.equal((await conf.json()).granted, true);
  assert.equal((await j('/api/me/premium', cust)).premium, true, 'Premium nach Bestätigung frei');
});

test('Statische Assets: gzip-Komprimierung + ETag/304-Revalidierung', async () => {
  // gzip nur, wenn der Client es anbietet.
  const gz = await rawGet('/app.js', { 'accept-encoding': 'gzip' });
  assert.equal(gz.status, 200);
  assert.equal(gz.headers['content-encoding'], 'gzip', 'Textasset wird gzip-komprimiert');
  assert.ok(gz.headers.etag, 'ETag gesetzt');
  assert.match(gz.headers['cache-control'] || '', /no-cache/);
  // Ohne Accept-Encoding: unkomprimiert (Fallback).
  const plain = await rawGet('/app.js');
  assert.equal(plain.headers['content-encoding'], undefined, 'ohne Accept-Encoding unkomprimiert');
  // Passendes If-None-Match -> 304 (spart erneuten Download).
  const notMod = await rawGet('/app.js', { 'if-none-match': plain.headers.etag });
  assert.equal(notMod.status, 304, 'unveränderte Datei -> 304');
  // Auch größere API-JSON-Antworten werden gzip-komprimiert (eigener Code-Pfad: json()).
  const apiGz = await rawGet('/api/countries', { 'accept-encoding': 'gzip' });
  assert.equal(apiGz.headers['content-encoding'], 'gzip', 'große API-Antwort wird gzip-komprimiert');
});
