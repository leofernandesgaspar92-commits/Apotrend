// CLI-Einstieg für den Prototyp.
//   node src/cli.js                      → Tagesbriefing ("Was muss ich heute beachten?")
//   node src/cli.js compare <PZN> <PZN>  → Produktvergleich
//
// Datenquelle wählbar:  APOPULSE_SOURCE=file (default) | db
//   file → Sample-Daten (D-012)   ·   db → echte Anbindung (Skelett, noch nicht verdrahtet)
import { loadContext } from './data.js';
import { FileSource } from './sources/fileSource.js';
import { DbSource } from './sources/dbSource.js';
import { buildRecommendations, compareProducts } from './engine.js';
import { narrateBriefing } from './narrate.js';
import { EuProviderStub } from './llm/euProviderStub.js';

const source = process.env.APOPULSE_SOURCE === 'db' ? new DbSource() : new FileSource();
const data = await loadContext(source);
const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'compare') {
  const [pa, pb] = args;
  if (!pa || !pb) {
    console.error('Aufruf: node src/cli.js compare <PZN-A> <PZN-B>');
    process.exit(1);
  }
  // Verfügbarkeit der verglichenen PZNs sicherstellen (falls nicht im Standard-Kontext)
  for (const pzn of [pa, pb]) {
    if (!data.availByPzn.has(pzn)) data.availByPzn.set(pzn, await source.getAvailability(pzn));
  }
  const c = compareProducts(data, pa, pb);
  console.log(`🔎 Vergleich: ${c.a.name} (PZN ${c.a.pzn})  ↔  ${c.b.name} (PZN ${c.b.pzn})`);
  console.log(`   Wirkstoff:     ${c.a.wirkstoff} / ${c.b.wirkstoff}  → ` +
    (c.gleicherWirkstoff ? 'substituierbar (gleicher Wirkstoff/ATC)' : 'unterschiedlich'));
  console.log(`   AEP:           €${c.a.aep_eur.toFixed(2)} / €${c.b.aep_eur.toFixed(2)}  → günstiger: PZN ${c.guenstigerePzn}`);
  console.log(`   VKP:           €${c.a.vkp_eur.toFixed(2)} / €${c.b.vkp_eur.toFixed(2)}`);
  console.log(`   Rezeptpflicht: ${c.a.rezeptpflichtig} / ${c.b.rezeptpflichtig}`);
  console.log(`   EKO:           ${c.a.eko_status ?? '—'} / ${c.b.eko_status ?? '—'}`);
  console.log(`   Lieferbar:     ${c.offerA ? c.offerA.grosshaendler : 'nein'} / ${c.offerB ? c.offerB.grosshaendler : 'nein'}`);
} else {
  const today = new Date(data.inventory.stand); // deterministisch aus den Daten
  const recs = buildRecommendations(data, today);
  // Default: deterministisch (kein Anbieter). APOPULSE_LLM=<name> aktiviert den EU-Provider-Seam (Skelett).
  const llm = process.env.APOPULSE_LLM ? new EuProviderStub({ name: process.env.APOPULSE_LLM }) : null;
  const meta = { apotheke_name: data.inventory.apotheke_name, stand: data.inventory.stand };
  let text;
  try {
    text = await narrateBriefing(recs, meta, { llm });
  } catch (e) {
    if (!llm) throw e;
    console.error(`⚠️  LLM-Narration nicht verfügbar (${e.message}) — deterministischer Fallback.`);
    text = await narrateBriefing(recs, meta); // ohne LLM = renderBriefing
  }
  console.log(text);
}
