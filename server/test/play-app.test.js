// Play-Store-App (10/2026): Google Play erlaubt in Apps für digitale Abos nur Google Play
// Billing. Krypto und Rechnung werden deshalb NUR in der Play-App ausgeblendet — auf der
// Website bleiben sie unverändert (Owner: Krypto zu 100 %, Afrika-Strategie).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const twa = JSON.parse(readFileSync(new URL('../../android/twa-manifest.json', import.meta.url), 'utf8'));

function erkennung({ search = '', referrer = '', merker = {} } = {}) {
  const code = app.slice(app.indexOf('const PLAY_PAKET'), app.indexOf('async function openPremium('));
  const lokal = {};
  const c = {
    location: { search }, document: { referrer },
    sessionStorage: { getItem: (k) => merker[k] ?? null, setItem: (k, v) => { merker[k] = v; } },
    localStorage: { getItem: (k) => lokal[k] ?? null, setItem: (k, v) => { lokal[k] = v; } },
    URLSearchParams,
  };
  vm.runInNewContext(code + ';this.r = istPlayApp;', c);
  return { play: c.r, merker, lokal };
}

test('Erkennung: Startadresse ?src=twa oder Android-Referrer; nur für die Sitzung gemerkt', () => {
  assert.equal(erkennung().play, false, 'normale Website');
  assert.equal(erkennung({ search: '?src=twa' }).play, true);
  assert.equal(erkennung({ referrer: 'android-app://com.apopulse.app/' }).play, true);
  assert.equal(erkennung({ referrer: 'android-app://com.andere.app/' }).play, false);
  const r = erkennung({ search: '?src=twa' });
  assert.deepEqual(r.lokal, {}, 'nie localStorage — die Play-App teilt den Speicher mit Chrome');
  assert.equal(erkennung({ merker: r.merker }).play, true, 'innerhalb der Sitzung (Navigation ohne Parameter) bleibt es erkannt');
});

test('Beide Bezahlstellen enden in der Play-App vor jedem Zahlweg', () => {
  const pr = app.slice(app.indexOf('async function openPremium('));
  const halt = pr.indexOf("if (istPlayApp) {");
  for (const zahlweg of ['/api/payments/crypto?product=', "ueberweisungsBox(rg, prPlan)", "'/api/payments/checkout'", "data-coinwahl"]) {
    const i = pr.indexOf(zahlweg);
    assert.ok(i > 0, zahlweg);
    // Kryptoliste wird vor dem Halt geladen (Preisanzeige) — gezeigt wird sie erst danach.
    if (zahlweg !== '/api/payments/crypto?product=') assert.ok(halt > 0 && halt < i, `${zahlweg} steht vor dem Halt`);
  }
  assert.match(pr.slice(halt, halt + 300), /data-playhinweis[\s\S]*return;/);
  const wb = app.slice(app.indexOf('async function zahlungKampagne('));
  assert.match(wb.slice(0, 300), /if \(istPlayApp\) \{[^\n]*wb2_play_hinweis[^\n]*return; \}/);
});

test('Android-Konfiguration: gleiche Paketkennung, Startadresse und Verknüpfungen mit src=twa', () => {
  assert.equal(twa.packageId, (app.match(/const PLAY_PAKET = '([^']+)'/) || [])[1]);
  assert.equal(twa.startUrl, '/?src=twa');
  for (const s of twa.shortcuts) assert.match(s.url, /[?&]src=twa/, s.name);
});
