// Integrationstest: bootet den echten HTTP-Server und prüft die am HTTP-Layer
// komponierten Endpunkte (die sonst nur im Browser verifiziert wurden).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

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
