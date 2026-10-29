// Funde der Klickrunde (29.10.2026: jede Ansicht und jeder harmlose Knopf, 6 Kontoarten/Sprachen, 360 px).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const abschnitt = (von, bis) => app.slice(app.indexOf(von), app.indexOf(bis, app.indexOf(von)));

test('Hilfe erklärt nur eingeschaltete Bereiche (keine Tauschbörse, kein Folgen, keine Direktnachrichten, wenn aus)', () => {
  const code = abschnitt('function hilfeSchritte()', 'function showWelcome(');
  const schritte = (aus, tauschImLand = true) => {
    const ctx = { featureAn: (id) => !aus.includes(id), tauschAn: () => !aus.includes('tauschboerse') && tauschImLand };
    vm.runInNewContext(code + ';this.r = JSON.stringify(hilfeSchritte().map((s) => s[1]));', ctx);
    return JSON.parse(ctx.r);
  };
  const heute = schritte(['tauschboerse', 'social', 'direktnachrichten']);
  assert.deepEqual(heute, ['wc_s1_t', 'wc_s2_t', 'wc_s3_t', 'wc_s4_t', 'wc_s8_t_einfach']);
  assert.deepEqual(schritte([]), ['wc_s1_t', 'wc_s2_t', 'wc_s3_t', 'wc_s4_t', 'wc_s5_t', 'wc_s6_t', 'wc_s7_t', 'wc_s8_t']);
  assert.ok(!schritte([], false).includes('wc_s5_t'), 'Tauschbörse erklärt, obwohl im Land gesperrt');
  assert.match(abschnitt('function showWelcome(', 'function goTab('), /const steps = hilfeSchritte\(\);/);
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const blk = i18n.slice(i18n.indexOf('\n  ' + sp + ': {'));
    assert.match(blk.slice(0, blk.indexOf('\n  },')), /wc_s8_d_einfach:'[^']+'/, sp + ': Suchtext ohne Hashtags fehlt');
  }
  // Der einfache Suchtext verspricht keine Hashtags.
  assert.ok(!/#|hashtag|هاشتاغ/i.test((i18n.match(/wc_s8_d_einfach:'([^']+)'/g) || []).join(' ')));
});

test('Leerer Beitrag: Hinweis sofort im Gerät (vorgelesen), Cursor ins Textfeld, keine Anfrage', () => {
  const knopf = abschnitt("document.getElementById('pgo').onclick", "document.getElementById('fgo').onclick");
  const leer = knopf.indexOf("if (!payload.body && (isPoll || !composeImage))"), senden = knopf.indexOf("await api('POST','/api/posts'");
  assert.ok(leer > 0 && leer < senden, 'Prüfung fehlt oder erst nach dem Senden');
  assert.match(knopf.slice(leer, senden), /t\('e_post_empty'\)[\s\S]*\.focus\(\); return; \}/);
  assert.match(app, /<div class="err" id="perr" role="alert"><\/div>/, 'Fehlerzeile wird nicht vorgelesen');
});

test('Social-Mechanik ruht: kein Folgen-Feld, keine „Nur Follower", keine Umfrage, kein Merken, kein Abstimmen', () => {
  // wendeFeaturesAn mit einer kleinen DOM-Attrappe
  const code = abschnitt('function wendeFeaturesAn()', 'async function renderAdSlot(');
  const lauf = (aus) => {
    const el = (name) => ({ name, style: {}, removed: false, remove() { this.removed = true; } });
    const elemente = { '[data-folgen-box]': [el('folgen')], '#pv': [el('pv')] };
    const label = el('umfrage-label');
    const ctx = {
      featureAn: (id) => !aus.includes(id),
      document: {
        querySelectorAll: (sel) => sel.split(',').map((x) => x.trim()).flatMap((x) => elemente[x] || []),
        getElementById: (id) => (id === 'ppoll' ? { closest: () => label } : null),
      },
    };
    vm.runInNewContext(code + ';wendeFeaturesAn();', ctx);
    return JSON.stringify([...elemente['[data-folgen-box]'], ...elemente['#pv'], label].map((x) => x.style.display || 'sichtbar'));
  };
  assert.equal(lauf(['social']), JSON.stringify(['none', 'none', 'none']));
  assert.equal(lauf([]), JSON.stringify(['sichtbar', 'sichtbar', 'sichtbar']));
  assert.match(app, /<div class="card" data-folgen-box>\s*<label data-i18n="co_follow_label">/);
  // Umfrage: ohne Social nur lesbar
  const poll = abschnitt('function pollHtml(p)', '\n}\n') + '\n}';
  const html = (an) => {
    const ctx = { featureAn: () => an, esc: (x) => String(x), t: (k) => k, ti: (k) => k };
    vm.runInNewContext(poll + ';this.h = pollHtml({ poll: { options: [{ id: "a", text: "Ja" }, { id: "b", text: "Nein" }], counts: { a: 1 }, total: 0 } });', ctx);
    return ctx.h;
  };
  assert.ok(!/data-pollvote|<button/.test(html(false)), 'Abstimm-Knöpfe trotz ruhender Social-Mechanik');
  assert.ok(!html(false).includes('pl_tap'), '„Zum Abstimmen tippen" trotz ruhender Social-Mechanik');
  assert.match(html(true), /<button class="poll-opt" data-pollvote="a"/);
  // Merken: nur mit Social (Liste der Lesezeichen ruht sonst)
  assert.match(app, /\$\{featureAn\('social'\) \? `<button class="ghost small" data-bookmark/);
});
