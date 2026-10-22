// JEDES afrikanische Land, nicht nur das Testbeispiel Uganda (Owner, 10/2026:
// „konzentriere dich auf alle afrikanischen Länder"). Dieser Test läuft über
// alle Länder der Region AFRICA in data/countries.js — ein neu aufgenommenes
// Land, dem eine der Stellen fehlt (Währung, Behörde, Presse, Datumsformat,
// Rechtsprofil, Preis, Steuer), macht ihn sofort rot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCountries, regionVon } from '../src/data/countries.js';
import { featureStatus } from '../src/data/countryFeatures.js';
import { complianceProfile, hasProfile, paymentMethodsFor, minorUnits, formatAmount, CRYPTO_METHODS } from '../src/domain/compliance.js';
import { GDELT_LAND, presseQuery } from '../src/services/presse.js';
import { preisCents, faktorenAusUmgebung } from '../src/domain/regionPreis.js';
import { ustFuerEmpfaenger } from '../src/domain/umsatzsteuer.js';
import { ISO_LAENDER } from '../src/domain/iso3166.js';
import { ersteSchritte } from '../src/services/ersteSchritte.js';
import { getProduct } from '../src/data/products.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const AFRIKA = listCountries().filter((c) => c.region === 'AFRICA');
const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const leer = { list: () => [] };

test('Afrika: Liste nicht leer (sonst prüft dieser Test nichts)', () => {
  assert.ok(AFRIKA.length >= 27, `nur ${AFRIKA.length} Länder`);
});

for (const c of AFRIKA) {
  test(`${c.code} ${c.name}: alle Afrika-Bausteine vorhanden und stimmig`, () => {
    // Stammdaten: echter Ländercode, Sprache der App, gültige Währung und Zeitzone.
    assert.ok(ISO_LAENDER.has(c.code), 'ISO-Code');
    assert.ok(['en', 'pt', 'fr'].includes(c.locale_default), `Sprache ${c.locale_default}`);
    assert.doesNotThrow(() => new Intl.NumberFormat('en', { style: 'currency', currency: c.currency }).format(1), 'Währung');
    assert.match(c.timezone, /^(Africa|Indian|Atlantic)\//, 'afrikanische Zeitzone (Inselstaaten: Indian/Atlantic)');
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: c.timezone }).format(0), 'Zeitzone');
    assert.ok(c.regulator, 'Behörde genannt');
    // Rechts-/Zahlungsprofil: eigenes Profil mit Landeswährung, Krypto immer dabei.
    assert.ok(hasProfile(c.code), 'Compliance-Profil');
    const p = complianceProfile(c.code);
    assert.equal(p.region, 'AFRICA'); assert.equal(p.currency, c.currency, 'Währung Profil = Land');
    const wege = paymentMethodsFor(c.code, 'saas_license').map((m) => m.id || m);
    assert.ok(CRYPTO_METHODS.some((k) => wege.includes(k.id || k)), 'Krypto verfügbar');
    assert.doesNotThrow(() => formatAmount(10 ** minorUnits(c.currency), c.currency));
    // Rechtlich heikle Module ohne eigene Analyse: nie einfach „allowed".
    assert.notEqual(featureStatus(c.code, 'stock_exchange'), 'allowed', 'Tauschbörse nur mit Hinweis/gesperrt');
    // Presse (Land-Ebene der Nachrichten) und Datumsformat des Landes.
    assert.ok(GDELT_LAND[c.code], 'Presse-Land'); assert.ok(presseQuery(c.code, {}), 'Presse-Suche');
    const tag = (app.match(new RegExp(`\\b${c.code}:'([a-z]{2}-[A-Z]{2})'`)) || [])[1];
    assert.ok(tag, 'Datumsformat (REGIONAL_TAGS)');
    // Euro-Betrag lesbar: In Kap Verde machte „pt-CV“ aus 3,00 € „3$00 €“ (Escudo-Trenner).
    assert.match(new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR' }).format(3), /3[.,]00/, `Euro-Format ${tag}`);
    // Afrika-Preis und Steuer.
    assert.equal(regionVon(c.code), 'AFRICA');
    assert.equal(preisCents(getProduct('premium_monthly'), regionVon(c.code), faktorenAusUmgebung({})), 300, 'Afrika-Preis 3,00 €');
    assert.deepEqual(ustFuerEmpfaenger(20, c.code), { satz: 0, hinweis: 'drittland' }, 'keine EU-Umsatzsteuer');
    // Erste Schritte: afrikatypische Vorschläge in der Sprache des Landes.
    const e = ersteSchritte({ shortagesRepo: leer, land: c.code, sprache: c.locale_default, region: 'AFRICA' });
    assert.ok((e.vorschlaege || []).length >= 8, 'Vorschläge');
  });
}
