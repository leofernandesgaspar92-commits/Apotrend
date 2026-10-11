// ============================================================================
//  Länder-Trennung: Wer auf Portugal umschaltet, sieht Portugal
// ============================================================================
//  Die Listen-Reiter (Engpässe, Preise, Rabatte) folgten dem Länder-Umschalter
//  schon. Die Sammelansichten nicht: Start-Übersicht, Wirkstoff-Seite und Suche
//  fragten die Dienste OHNE Land ab — und „ohne Land" heißt dort „alle Länder".
//  Eine portugiesische Apotheke sah österreichische Engpässe als „kritisch" auf
//  ihrer Startseite, österreichische Aktionen als „Top-Rabatt".
//
//  Zwei Regeln, die sich NICHT vertauschen dürfen:
//
//   · ANZEIGE folgt dem ANGESEHENEN Land. Wer auf Angola klickt, will Angola.
//   · BENACHRICHTIGUNG folgt dem HEIMATLAND. Eine Push-Meldung „Amoxicillin
//     kritisch" oder „−22 % auf Amoxicillin" meint: in deinem Markt, bei
//     deinem Großhandel. Eine Aktion in Österreich kann eine Schweizer
//     Apotheke nicht kaufen; ein Engpass in Wien ist keiner in Lissabon.
//
//  Die Referenzdaten sind hier eingeschaltet — sie sind österreichisch. Jeder
//  „leer in Portugal"-Test hat deshalb eine Gegenprobe „voll in Österreich",
//  sonst wäre er auch ohne Daten grün.
// ============================================================================

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PORT = '0';
process.env.APOPULSE_ADMIN_EMAIL = 'red@apopulse.test';
process.env.APOPULSE_ADMIN_PASSWORD = 'redredred123';
delete process.env.APOPULSE_DATA_FILE;
process.env.APOPULSE_REFERENCE_DATA = 'an';
// Kein Netz in Tests: Presse aus, KI aus. Geprüft wird hier das LAND, nicht der Abruf.
process.env.APOPULSE_PRESSE = 'aus';
delete process.env.APOPULSE_AI_PROVIDER;
delete process.env.APOPULSE_AI_API_KEY;

let BASE;
let httpServer;
before(async () => {
  ({ httpServer } = await import('../src/http/server.js'));
  if (!httpServer.listening) {
    await new Promise((ok, fail) => {
      httpServer.once('listening', ok);
      httpServer.once('error', (e) => fail(new Error(`Testserver startet nicht: ${e.code || e.message}`)));
    });
  }
  BASE = `http://localhost:${httpServer.address().port}`;
});
after(() => new Promise((res) => httpServer.close(res)));

async function konto(country) {
  const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await (await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'T', email: `lt_${uniq}@ex.com`, password: 'Passwort123!', handle: `lt_${uniq}`, country, accountType: 'pharmacy' }),
  })).json();
  assert.ok(r.token, 'Registrierung fehlgeschlagen: ' + JSON.stringify(r));
  return { 'content-type': 'application/json', authorization: 'Bearer ' + r.token };
}
const get = async (H, pfad) => (await fetch(BASE + pfad, { headers: H })).json();
const post = async (H, pfad, body) => (await fetch(BASE + pfad, { method: 'POST', headers: H, body: JSON.stringify(body || {}) })).json();

// ── Anzeige folgt dem angesehenen Land ───────────────────────────────────────

test('Start-Übersicht: Portugal ansehen zeigt keine österreichischen Engpässe und Rabatte', async () => {
  const H = await konto('AT');
  const at = await get(H, '/api/overview');
  assert.ok(at.shortages.kritisch > 0, 'Gegenprobe: In Österreich gibt es kritische Referenz-Engpässe');
  assert.ok(at.top_rabatt, 'Gegenprobe: In Österreich gibt es einen Top-Rabatt');

  const pt = await get(H, '/api/overview?country=PT');
  assert.equal(pt.shortages.kritisch, 0, 'österreichische Engpässe als „kritisch" auf der portugiesischen Übersicht');
  assert.equal(pt.shortages.total, 0);
  assert.deepEqual(pt.shortages.top, []);
  assert.equal(pt.top_rabatt, null, 'österreichische Aktion als Top-Rabatt in Portugal');
  assert.equal(pt.rabatte_expiring.count, 0);
  assert.equal(pt.country, 'PT', 'die Antwort nennt das Land, das sie zeigt');
});

test('Wirkstoff-Seite: Amoxicillin in Portugal zeigt keine österreichischen Daten', async () => {
  const H = await konto('AT');
  const at = await get(H, '/api/wirkstoff/Amoxicillin');
  assert.ok(at.shortages.length > 0, 'Gegenprobe: österreichischer Engpass vorhanden');
  assert.ok(at.rabatte.length > 0, 'Gegenprobe: österreichische Aktion vorhanden');

  const pt = await get(H, '/api/wirkstoff/Amoxicillin?country=PT');
  assert.equal(pt.shortages.length, 0);
  assert.equal(pt.prices.length, 0);
  assert.equal(pt.rabatte.length, 0);
});

test('Suche: in Portugal keine österreichischen Engpässe, Preise, Rabatte', async () => {
  const H = await konto('AT');
  const at = await get(H, '/api/search?q=Amoxicillin');
  assert.ok(at.shortages.length > 0 && at.rabatte.length > 0, 'Gegenprobe: in Österreich vorhanden');

  const pt = await get(H, '/api/search?q=Amoxicillin&country=PT');
  assert.equal(pt.shortages.length, 0);
  assert.equal(pt.prices.length, 0);
  assert.equal(pt.rabatte.length, 0);
});

test('Beobachtungsliste: der Status kommt aus dem angesehenen Land', async () => {
  // Vorher: der kritischste Engpass aus IRGENDEINEM Land. Eine deutsche
  // Apotheke sah „Amoxicillin: kritisch" wegen eines Wiener Eintrags.
  const H = await konto('AT');
  await post(H, '/api/watchlist', { wirkstoff: 'Amoxicillin' });
  const at = await get(H, '/api/overview');
  assert.equal(at.watchlist.items.find((w) => w.wirkstoff === 'Amoxicillin').status, 'kritisch', 'Gegenprobe');

  const pt = await get(H, '/api/overview?country=PT');
  assert.equal(pt.watchlist.items.find((w) => w.wirkstoff === 'Amoxicillin').status, 'unauffaellig');

  // Und ohne Umschalter folgt sie dem Heimatland.
  const H2 = await konto('PT');
  await post(H2, '/api/watchlist', { wirkstoff: 'Amoxicillin' });
  const eigen = await get(H2, '/api/watchlist');
  assert.equal(eigen.items.find((w) => w.wirkstoff === 'Amoxicillin').status, 'unauffaellig',
    'eine portugiesische Apotheke sieht den österreichischen Engpass als ihren');
});

// ── Benachrichtigung folgt dem Heimatland ────────────────────────────────────

test('Rabatt-Alarm: nur für Aktionen im eigenen Land — auch beim Umschalten', async () => {
  // Schweiz: Rabatte dort erlaubt. In DE/PT sind sie rechtlich gesperrt — dort
  // bliebe der Alarm aus dem falschen Grund aus, und der Test wäre vakuant.
  const ch = await konto('CH');
  await post(ch, '/api/watchlist', { wirkstoff: 'Amoxicillin' });
  await post(ch, '/api/watchlist/Amoxicillin/alert', { pct: 5 });
  await get(ch, '/api/overview');
  await get(ch, '/api/overview?country=AT'); // Umschalten darf keinen Alarm auslösen
  const n = (await get(ch, '/api/notifications')).notifications.filter((x) => x.type === 'price_alert');
  assert.equal(n.length, 0, 'Schweizer Apotheke bekam einen Alarm für eine österreichische Aktion');

  const at = await konto('AT');
  await post(at, '/api/watchlist', { wirkstoff: 'Amoxicillin' });
  await post(at, '/api/watchlist/Amoxicillin/alert', { pct: 5 });
  await get(at, '/api/overview');
  const m = (await get(at, '/api/notifications')).notifications.filter((x) => x.type === 'price_alert');
  assert.equal(m.length, 1, 'Gegenprobe: die österreichische Apotheke bekommt ihn');
});

test('Engpass-Meldung: Beobachter:innen anderer Länder werden nicht alarmiert', async () => {
  const wirkstoff = 'Pruefcillin' + Math.random().toString(36).slice(2, 6);
  const pt = await konto('PT');
  const at = await konto('AT');
  await post(pt, '/api/watchlist', { wirkstoff });
  await post(at, '/api/watchlist', { wirkstoff });

  const melder = await konto('AT');
  const r = await post(melder, '/api/shortages/report', { wirkstoff, status: 'kritisch', grund: 'Test' });
  assert.ok(r.id, 'Meldung angelegt: ' + JSON.stringify(r));

  const nPt = (await get(pt, '/api/notifications')).notifications.filter((x) => x.type === 'watch_alert');
  const nAt = (await get(at, '/api/notifications')).notifications.filter((x) => x.type === 'watch_alert');
  assert.equal(nPt.length, 0, 'portugiesische Apotheke wurde über einen österreichischen Engpass alarmiert');
  assert.equal(nAt.length, 1, 'Gegenprobe: die österreichische wird alarmiert');
});

// ── Presse und Lagebild folgen dem angesehenen Land ─────────────────────────

test('Presse und Lagebild: angemeldet, und für das angesehene Land', async () => {
  for (const pfad of ['/api/presse?country=AO', '/api/lagebild?country=AO']) {
    assert.equal((await fetch(BASE + pfad)).status, 401, `${pfad} ohne Anmeldung`);
  }
  const H = await konto('AT');
  const pr = await get(H, '/api/presse?country=AO');
  assert.equal(pr.land, 'AO', 'Presse aus Österreich, obwohl Angola angesehen wird');
  assert.equal(pr.grund, 'abgeschaltet');
  const lb = await get(H, '/api/lagebild?country=NG&lang=pt');
  assert.equal(lb.land, 'NG');
  assert.equal(lb.grund, 'ki_aus', 'ohne KI-Schlüssel ehrlich „aus", kein erfundenes Lagebild');
  assert.equal(lb.sprache, 'pt');
  assert.deepEqual(lb.punkte, []);
});
