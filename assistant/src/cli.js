// CLI-Einstieg für den Prototyp.
//   node src/cli.js                      → Tagesbriefing ("Was muss ich heute beachten?")
//   node src/cli.js compare <PZN> <PZN>  → Produktvergleich
import { loadData } from './data.js';
import { buildRecommendations, compareProducts } from './engine.js';
import { renderBriefing } from './narrate.js';

const data = loadData();
const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'compare') {
  const [pa, pb] = args;
  if (!pa || !pb) {
    console.error('Aufruf: node src/cli.js compare <PZN-A> <PZN-B>');
    process.exit(1);
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
  console.log(renderBriefing(recs, { apotheke_name: data.inventory.apotheke_name, stand: data.inventory.stand }));
}
