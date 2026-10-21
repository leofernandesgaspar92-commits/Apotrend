// Antibiotika-Hinweis (services/amr.js): bis 10/2026 bekam eine Apotheke in
// Uganda einen deutschen Text und den österreichischen Resistenzbericht als
// einzige Quelle; „Co-trimoxazole" oder „Amoxicilina" wurden nicht erkannt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createAmrService } from '../src/services/amr.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const amr = createAmrService();

test('Erkennung über Sprachen: deutsch, englisch, portugiesisch, mit Salz und Stärke', () => {
  for (const x of ['Amoxicillin', 'Amoxicillin/Clavulansäure', 'Amoxicillin 1000 mg', 'Amoxicilina', 'Ceftriaxone', 'Ceftriaxona',
    'Doxycycline hyclate', 'Co-trimoxazole', 'Sulfametoxazol + trimetoprim', 'Metronidazole', 'Fusidic acid', 'Ácido fusídico',
    'Benzathine benzylpenicillin', 'Chloramphenicol', 'Rifampin', 'Cefuroxime axetil', 'Gentamicina', 'Nitrofurantoína']) {
    assert.ok(amr.isAntibiotic(x), x);
  }
});

test('Keine falschen Treffer: Penicillamin ist kein Antibiotikum, Clavulansäure allein auch nicht', () => {
  for (const x of ['Penicillamin', 'Penicillamine', 'Paracetamol', 'Metformin', 'Oxytocin', 'Artemether/Lumefantrin', 'Clavulansäure',
    'Fluconazol', 'Aciclovir', 'Tenofovir/Lamivudin/Dolutegravir', 'Zinksulfat', 'Magnesiumsulfat', '']) {
    assert.equal(amr.isAntibiotic(x), false, x);
  }
  assert.equal(amr.forWirkstoff('Metformin', { land: 'UG' }), null);
});

test('Quellen passend zum Land, Beschriftung in der Landessprache', () => {
  const ug = amr.forWirkstoff('Amoxicillin', { land: 'UG' }).sources;
  assert.ok(ug.length >= 2 && ug.every((s) => /^https:\/\/www\.who\.int\//.test(s.url)), 'Uganda: WHO-Quellen');
  assert.ok(ug.every((s) => !/[äöüß]|Österreich|Antibiotika/.test(s.label)), 'Uganda: englische Beschriftung');
  assert.ok(ug.some((s) => /AWaRe/.test(s.label)));
  const mz = amr.forWirkstoff('Amoxicilina', { land: 'MZ' }).sources;
  assert.ok(mz.every((s) => /OMS/.test(s.label)), 'Mosambik: portugiesisch');
  const at = amr.forWirkstoff('Amoxicillin', { land: 'AT' }).sources;
  assert.ok(at.some((s) => /ages\.at/.test(s.url)) && at.every((s) => !/who\.int/.test(s.url)), 'Österreich: AGES/AURES');
  const de = amr.forWirkstoff('Amoxicillin', { land: 'DE' }).sources;
  assert.ok(de.every((s) => !/ages\.at|sozialministerium/.test(s.url)), 'Deutschland bekommt keinen österreichischen Bericht');
});

test('Sicherheitshinweis in allen drei Sprachen, Oberfläche nutzt die Übersetzung', () => {
  const ctx = {}; vm.runInNewContext(readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8') + '\n;this.I18N = I18N;', ctx);
  const I = ctx.I18N;
  assert.match(I.de.wk_amr_disclaimer, /keine patientenindividuelle Therapieempfehlung/);
  assert.match(I.en.wk_amr_disclaimer, /not a treatment recommendation for an individual patient/);
  assert.match(I.pt.wk_amr_disclaimer, /não é uma recomendação terapêutica para um doente individual/);
  for (const sp of ['de', 'en', 'pt']) assert.ok(I[sp].wk_amr_note && I[sp].wk_amr_note.length > 60, sp + ': Hinweis');
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /t\('wk_amr_note'\)/);
  assert.match(app, /t\('wk_amr_disclaimer'\)/);
  assert.doesNotMatch(app, /a\.note\b|a\.disclaimer\b/, 'kein fester (deutscher) Text vom Server mehr');
});

test('Über HTTP: Wirkstoff-Seite mit Uganda-Ansicht liefert WHO-Quellen, mit Österreich-Ansicht AGES', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'amr-test-geheim-12345', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Mukasa Pharmacy', email: 'amr@ug.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const hole = async (land) => (await (await fetch(`${B}/api/wirkstoff/Amoxicillin?country=${land}`, { headers: { authorization: 'Bearer ' + tok } })).json()).amr;
    const ug = await hole('UG');
    assert.ok(ug.sources.every((s) => /who\.int/.test(s.url)), 'Uganda-Ansicht: WHO');
    assert.equal(ug.note, undefined, 'kein deutscher Text mehr vom Server');
    assert.ok((await hole('AT')).sources.some((s) => /ages\.at/.test(s.url)), 'Österreich-Ansicht: AGES');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
