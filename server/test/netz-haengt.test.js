// Netz HÄNGT (Verbindung da, aber keine Antwort — in den Zielmärkten häufig). Bis 10/2026
// wartete der Service Worker dann endlos aufs Netz: Die App blieb weiß, obwohl alles im
// Speicher lag (gemessen: nach 30 s nicht bedienbar; jetzt 4,6 s, mit Offline-Hinweis).
// Hier läuft public/sw.js in Node mit nachgebautem Speicher und steuerbarem Netz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = readFileSync(join(ROOT, 'public', 'sw.js'), 'utf8');
const APP = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
const O = 'https://apopulse.example';
const ruhe = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

function welt() {
  const speicher = new Map(); // Name -> Map(url -> Response)
  const schluessel = (r) => (typeof r === 'string' ? new URL(r, O).href : r.url);
  const cacheVon = (name) => { if (!speicher.has(name)) speicher.set(name, new Map()); const m = speicher.get(name);
    return { put: async (r, res) => { m.set(schluessel(r), res); }, match: async (r) => { const x = m.get(schluessel(r)); return x ? x.clone() : undefined; },
      add: async () => {}, keys: async () => [...m.keys()] }; };
  const caches = {
    open: async (name) => cacheVon(name),
    match: async (r, opt = {}) => { for (const [name, m] of speicher) { if (opt.cacheName && opt.cacheName !== name) continue; const x = m.get(schluessel(r)); if (x) return x.clone(); } },
    keys: async () => [...speicher.keys()], delete: async (n) => speicher.delete(n),
  };
  let netz = 'haengt'; const offen = [];
  const fetch = (req) => {
    if (netz === 'weg') return Promise.reject(new TypeError('Failed to fetch'));
    if (netz === 'ok') return Promise.resolve(new Response('frisch:' + new URL(req.url).pathname, { status: 200 }));
    return new Promise((ok, fail) => offen.push({ ok, fail, req })); // hängt
  };
  const hoerer = {};
  const self = { location: { origin: O }, addEventListener: (t, f) => { hoerer[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} } };
  new Function('self', 'caches', 'fetch', SW)(self, caches, fetch);
  const anfrage = (pfad, { navigate = false, token = null } = {}) => {
    const e = { request: { method: 'GET', url: O + pfad, mode: navigate ? 'navigate' : 'cors', headers: new Headers(token ? { Authorization: 'Bearer ' + token } : {}) },
      antwort: null, respondWith(p) { this.antwort = Promise.resolve(p); }, waitUntil() {} };
    hoerer.fetch(e);
    return e;
  };
  return { caches, anfrage, offen, setzeNetz: (n) => { netz = n; }, legeAb: async (name, pfad, text) => (await caches.open(name)).put(O + pfad, new Response(text, { status: 200, headers: { 'x-apo-gespeichert': '2026-10-28T08:00:00.000Z' } })) };
}
// Ist die Antwort schon da? Erwartet: ja → bis zu 2000 Runden warten (Hash-Berechnung unter Last);
// erwartet: nein → 20 Runden (genug, um eine sofortige Antwort zu sehen).
const schonDa = async (e, erwartet = true) => {
  let fertig = false; e.antwort.then(() => { fertig = true; }, () => { fertig = true; });
  for (let i = 0; i < (erwartet ? 2000 : 20) && !fertig; i++) await ruhe(1);
  return fertig;
};

test('Hülle: Netz hängt → nach der Frist aus dem Speicher; danach sofort (Netz als hängend erkannt)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const w = welt();
  await w.legeAb('apopulse-shell-v5', '/app.js', 'alt:app.js');
  await w.legeAb('apopulse-shell-v5', '/index.html', 'alt:index');
  const nav = w.anfrage('/', { navigate: true });
  assert.equal(await schonDa(nav, false), false, 'antwortet vor der Frist');
  t.mock.timers.tick(4000); await ruhe();
  assert.equal(await (await nav.antwort).text(), 'alt:index', 'Navigation fällt auf die gespeicherte Hülle zurück');
  const js = w.anfrage('/app.js');
  assert.equal(await schonDa(js), true, 'wartet trotz erkannt hängendem Netz erneut');
  assert.equal(await (await js.antwort).text(), 'alt:app.js');
  // Kommt die Antwort doch noch, landet sie im Speicher (nächster Start frisch).
  w.offen.find((o) => o.req.url.endsWith('/app.js')).ok(new Response('neu:app.js', { status: 200 })); await ruhe();
  assert.equal(await (await w.caches.match(O + '/app.js')).text(), 'neu:app.js');
});

test('Hülle: nichts im Speicher → weiter aufs Netz warten statt Fehler', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const w = welt();
  const e = w.anfrage('/i18n/fr.js');
  t.mock.timers.tick(4000); await ruhe();
  assert.equal(await schonDa(e, false), false, 'gab ohne Speicher vorzeitig auf');
  w.offen[0].ok(new Response('spät', { status: 200 })); await ruhe();
  assert.equal(await (await e.antwort).text(), 'spät');
});

test('Hülle: Netz da → frisch (kein Speicher-Stand), Netz weg → sofort Speicher', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const w = welt();
  await w.legeAb('apopulse-shell-v5', '/app.css', 'alt:css');
  w.setzeNetz('ok');
  assert.equal(await (await w.anfrage('/app.css').antwort).text(), 'frisch:/app.css');
  w.setzeNetz('weg');
  const e = w.anfrage('/app.css');
  assert.equal(await schonDa(e), true);
  assert.ok(['frisch:/app.css', 'alt:css'].includes(await (await e.antwort).text()));
});

test('API: Netz hängt → nach Frist gespeicherter Stand MIT Offline-Kennzeichnung; nach hängender Startseite sofort', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_800_000_000_000 });
  const w = welt();
  w.setzeNetz('ok');
  for (const p of ['/api/me', '/api/overview']) await (await w.anfrage(p, { token: 'abc' }).antwort).text();
  await (await w.anfrage('/api/features').antwort).text(); // öffentlich: ohne Anmeldung
  await ruhe(10);
  w.setzeNetz('haengt');
  const me = w.anfrage('/api/me', { token: 'abc' });
  while (!w.offen.length) await ruhe(1); // Abruf (nach Hash-Berechnung) gestartet
  assert.equal(await schonDa(me, false), false);
  t.mock.timers.tick(6000); await ruhe(10);
  const r = await me.antwort;
  assert.equal(r.headers.get('x-apo-offline'), '1', 'gespeicherter Stand nicht gekennzeichnet');
  assert.match(await r.text(), /frisch:\/api\/me/);
  // Anderes Konto (anderer Token): kein fremder Stand, sondern weiter warten.
  const fremd = w.anfrage('/api/overview', { token: 'xyz' });
  while (w.offen.length < 2) await ruhe(1);
  t.mock.timers.tick(6000); await ruhe(10);
  assert.equal(await schonDa(fremd, false), false, 'Stand eines anderen Kontos geliefert');
  // Startseite hängt → Daten (auch die öffentliche Funktionsschaltung) sofort aus dem Speicher.
  const w2 = welt(); w2.setzeNetz('ok');
  await (await w2.anfrage('/api/overview', { token: 'abc' }).antwort).text();
  await (await w2.anfrage('/api/features').antwort).text(); await ruhe(10);
  await w2.legeAb('apopulse-shell-v5', '/index.html', 'alt:index');
  w2.setzeNetz('haengt');
  const nav = w2.anfrage('/', { navigate: true }); t.mock.timers.tick(4000); await nav.antwort;
  for (const [pfad, token] of [['/api/overview', 'abc'], ['/api/features', null]]) {
    const e = w2.anfrage(pfad, { token });
    await ruhe(10);
    assert.equal(await schonDa(e), true, pfad + ' wartet trotz hängender Startseite');
    assert.equal((await e.antwort).headers.get('x-apo-offline'), '1');
  }
});

test('API: persönliche Daten ohne Anmeldung oder außerhalb der Liste werden nie gespeichert', () => {
  const oeff = SW.match(/const OFFLINE_OEFFENTLICH = \[([^\n]+)\];/);
  assert.ok(oeff, 'OFFLINE_OEFFENTLICH nicht gefunden');
  const muster = [...oeff[1].matchAll(/\/(\^[^,]+?\$)\//g)].map((m) => new RegExp(m[1].replace(/\\\//g, '/')));
  assert.deepEqual(muster.map(String), ['/^\\/api\\/features$/'], 'ohne Anmeldung nur die Funktionsschaltung');
  const w = welt();
  for (const p of ['/api/dm', '/api/rechnungen', '/api/notifications']) {
    const e = w.anfrage(p, { token: 'abc' });
    assert.equal(e.antwort, null, p + ' läuft über den Speicher');
  }
  assert.equal(w.anfrage('/api/me').antwort, null, '/api/me ohne Anmeldung gespeichert');
});

test('Seite: Start-Abfragen haben eine Frist; Länder-Einstellung fällt auf den letzten Stand zurück', () => {
  assert.match(APP, /const START_FRIST_MS = \d+;/);
  assert.match(APP, /mitFrist\(fetch\('\/api\/features'\)/, 'Funktionsschaltung ohne Frist');
  const haupt = APP.slice(APP.indexOf('async function mainScreen()'), APP.indexOf("let meData = await api('GET','/api/me')"));
  assert.match(haupt, /mitFrist\(api\('GET', '\/api\/country-config'\)/);
  assert.match(haupt, /mitFrist\(api\('GET','\/api\/bookmarks\/ids'\)/);
  const gating = APP.slice(APP.indexOf('async function applyCountryGating('), APP.indexOf('async function applyCountryGating(') + 900);
  assert.match(gating, /localStorage\.setItem\('apo_land_cfg'/);
  assert.match(gating, /JSON\.parse\(localStorage\.getItem\('apo_land_cfg'\)/, 'ohne Netz wären gesperrte Reiter wieder offen');
  // mitFrist selbst
  const mitFrist = new Function(APP.match(/const mitFrist = [^\n]+/)[0] + '; return mitFrist;')();
  return Promise.all([
    mitFrist(new Promise(() => {}), 5, 'ersatz').then((v) => assert.equal(v, 'ersatz')),
    mitFrist(Promise.resolve('echt'), 50, 'ersatz').then((v) => assert.equal(v, 'echt')),
    mitFrist(new Promise(() => {}), 5, new Error('frist')).then(() => assert.fail('kein Fehler'), (e) => assert.equal(e.message, 'frist')),
  ]);
});
