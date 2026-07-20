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

const PORT = 4200 + Math.floor(Math.random() * 300);
process.env.PORT = String(PORT);
process.env.APOTREND_ADMIN_EMAIL = 'red@apotrend.test';
process.env.APOTREND_ADMIN_PASSWORD = 'redredred123';
delete process.env.APOTREND_DATA_FILE; // In-Memory
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

test('GET /api/countries: 12 Länder mit Locale/Währung/Zeitzone', async () => {
  const d = await (await fetch(BASE + '/api/countries')).json();
  assert.equal(d.countries.length, 12, '12 Länder im MVP-Register');
  const at = d.countries.find(c => c.code === 'AT');
  assert.equal(at.currency, 'EUR'); assert.equal(at.locale_default, 'de'); assert.equal(at.regulator, 'BASG');
  const br = d.countries.find(c => c.code === 'BR');
  assert.equal(br.currency, 'BRL'); assert.equal(br.locale_default, 'pt');
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
  const login = await (await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'red@apotrend.test', password: 'redredred123' }) })).json();
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
  const login = await (await fetch(BASE + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'red@apotrend.test', password: 'redredred123' }) })).json();
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
