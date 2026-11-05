// Quelle einer Community-Meldung: „aus Fachkreisen" — nicht „aus Apotheken". Melden und bestätigen dürfen
// alle Fachkreise (Apotheke, Klinik, Großhandel, Hersteller, Logistik, Behörde); bis 11/2026 hieß jede Meldung
// „Meldung aus Apotheken", „3 Apotheken melden", „Eine Apotheke meldet …" — eine falsche Quellenangabe
// (Owner-Entscheidung 11/2026: „aus Fachkreisen").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pushNachricht } from '../src/services/webPush.js';

const c = {}; vm.runInNewContext(readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8') + ';__I=I18N', c);
const I = c.__I;
const QUELLE_APO = {
  de: /Apotheken-Meldung|Meldung(en)? (aus|von) Apotheken|\d+ Apotheken? meld|[Ee]ine Apotheke meldet|(gemeldet|bestätigt) (aus|von) (mehreren )?Apotheken|Apotheken bestätigt/,
  en: /pharmacy reports?\b|pharmacies report|(reported|confirmed) by (several )?pharmacies|A pharmacy reports/i,
  pt: /(comunicaç(ão|ões)|avisos?|notificaç(ão|ões)) de farmácias?|farmácias? comunica|por (várias )?farmácias/i,
  fr: /signalements? (de|des) pharmacies?|pharmacies? signale|par (plusieurs |des )?pharmacies/i,
  ar: /بلاغ(ات)? (من )?(ال)?صيدلي|صيدلي(ة|ات) (واحدة )?تبلّغ|(أكدته|أكّدته|أكدتها) عدة صيدليات|أبلغت عنه(ا)? (ال)?صيدليات/,
};

test('Keine App-Texte nennen Community-Meldungen „aus Apotheken"', () => {
  for (const l of Object.keys(QUELLE_APO)) {
    const treffer = Object.entries(I[l]).filter(([, v]) => typeof v === 'string' && QUELLE_APO[l].test(v)).map(([k, v]) => `${k}: ${v.slice(0, 90)}`);
    assert.deepEqual(treffer, [], `${l}: Quelle als „Apotheken" benannt`);
  }
});

test('Push, öffentliche Seiten, Teilen-Vorschau: „aus Fachkreisen"', () => {
  for (const sprache of Object.keys(QUELLE_APO)) {
    for (const label of ['Oxytocin · Kritischer Engpass (Community-Meldung)', 'Oxytocin · Wieder verfügbar (Community-Meldung)', 'Oxytocin · Eingeschränkt lieferbar']) {
      const m = pushNachricht({ type: 'watch_alert', label }, { sprache });
      assert.doesNotMatch(m.titel + ' ' + m.text, QUELLE_APO[sprache], `${sprache}: ${m.titel} / ${m.text}`);
    }
    const b = pushNachricht({ type: 'shortage_bestaetigt', label: 'Oxytocin · UG · 3' }, { sprache });
    assert.doesNotMatch(b.text, QUELLE_APO[sprache], b.text);
  }
  for (const f of ['../src/http/teilseite.js', '../src/services/oeffentlicheSeiten.js']) {
    const zeilen = readFileSync(new URL(f, import.meta.url), 'utf8').split('\n').filter((z) => !/^\s*\/\//.test(z));
    for (const [l, rx] of Object.entries(QUELLE_APO)) {
      const treffer = zeilen.filter((z) => rx.test(z));
      assert.deepEqual(treffer, [], `${f} (${l})`);
    }
  }
  assert.equal(I.de.nl_community, 'Meldung aus Fachkreisen');
});
