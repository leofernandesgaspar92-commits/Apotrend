// Patienten-Infokarten und Einnahmeplan für Afrika: bis 10/2026 nur Deutsch,
// Englisch, Türkisch (österreichische Kundschaft), immer zuerst Deutsch, Quelle
// nur AGES, und die Karte „Reste in die Apotheke bringen" versprach eine
// Rücknahme, die es nicht überall gibt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPatientInfoService } from '../src/services/patientInfo.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const pi = createPatientInfoService();

test('Portugiesisch vollständig: alle Karten, Hinweis, Quelle', () => {
  const pt = pi.cards('pt', { land: 'MZ' });
  assert.equal(pt.lang, 'pt');
  assert.ok(pt.langs.some((l) => l.code === 'pt'));
  assert.equal(pt.cards.length, pi.cards('de').cards.length);
  for (const c of pt.cards) assert.ok(c.title && c.body && !/[äöüß]/.test(c.title + c.body), c.id);
  assert.match(pt.disclaimer, /não substitui/);
  assert.match(pt.source.label, /^OMS/);
});

test('Außerhalb Österreichs: WHO-Quelle, Entsorgung ohne Rücknahme-Versprechen', () => {
  for (const [land, sp] of [['UG', 'en'], ['NG', 'en'], ['MZ', 'pt'], ['DE', 'de']]) {
    const d = pi.cards(sp, { land });
    assert.match(d.source.url, /^https:\/\/www\.who\.int\//, land);
    const ents = d.cards.find((c) => c.id === 'entsorgung').body;
    assert.doesNotMatch(ents, /Return leftovers to the pharmacy|Entregue as sobras na farmácia|Bringen Sie Reste/, land + ': kein Rücknahme-Versprechen');
    assert.match(ents, /Ask your pharmacy|Pergunte na sua farmácia|Fragen Sie in Ihrer Apotheke/, land);
  }
  const at = pi.cards('de', { land: 'AT' });
  assert.match(at.source.url, /ages\.at/);
  assert.match(at.cards.find((c) => c.id === 'entsorgung').body, /Bringen Sie Reste zur Entsorgung in die Apotheke/, 'Österreich unverändert');
});

test('Oberfläche: Standardsprache = Oberflächensprache, Land wird mitgeschickt, Portugiesisch im Einnahmeplan', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /let patientLang = 'de'|let zettelLang = 'de'/, 'nicht mehr fest Deutsch');
  assert.match(app, /patientLang \|\| patientStart\(\)/);
  assert.equal((app.match(/\/api\/patient-info\?lang='\+encodeURIComponent\([^)]*\)\)?\+'&country='\+encodeURIComponent\(viewCountry\(\)\)/g) || []).length, 2, 'beide Abrufe mit Land');
  assert.match(app, /pt: \{ title: 'Plano de toma'/);
  assert.match(app, /\['pt','Português'\]/);
});

test('Über HTTP: Uganda-Ansicht WHO, Österreich-Ansicht AGES', { timeout: 60000 }, async () => {
  // Bereich ruht standardmäßig (data/features.js) — hier eingeschaltet wie vom Betreiber.
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'patient-info-land-1234', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_FEATURE_PATIENTENINFO: 'an' };
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
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Mukasa Pharmacy', email: 'pi@ug.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const hole = async (q) => (await fetch(`${B}/api/patient-info?${q}`, { headers: { authorization: 'Bearer ' + tok } })).json();
    assert.match((await hole('lang=en&country=UG')).source.url, /who\.int/);
    assert.match((await hole('lang=en')).source.url, /who\.int/, 'ohne Angabe: Heimatland Uganda');
    assert.match((await hole('lang=de&country=AT')).source.url, /ages\.at/);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Ruhende Bereiche: keine Knöpfe ins Leere, 404 mit übersetzbarem Code', { timeout: 60000 }, async () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  // Forum-Karte auf der Übersicht und Knöpfe im Antibiotika-Kasten nur bei laufendem Bereich.
  assert.match(app, /if \(featureAn\('social'\)\) \{\n  const stew = el\(/, 'Forum-Karte auf der Übersicht');
  assert.match(app, /featureAn\('social'\) \? `<button class="ghost small" data-forum>/);
  assert.match(app, /featureAn\('patienteninfo'\) \? `<button class="ghost small" data-pinfo>\$\{esc\(t\('wk_amr_pinfo'\)\)\}/);
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'patient-info-ruht-12345', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  delete env.APOPULSE_FEATURE_COMPLIANCE_API; delete env.APOPULSE_FEATURE_SOCIAL;
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    for (const pfad of ['/api/compliance/AT', '/api/hashtag/stewardship', '/api/gibt-es-nicht']) {
      const r = await fetch(`http://localhost:${port}${pfad}`);
      assert.equal(r.status, 404, pfad);
      assert.equal((await r.json()).code, 'not_found', pfad + ': Code für die Übersetzung');
    }
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

