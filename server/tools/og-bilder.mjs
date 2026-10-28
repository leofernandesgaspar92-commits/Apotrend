// Vorschaubilder (Open Graph, 1200×630) für WhatsApp, Facebook, Telegram & Co. — je Sprache.
// Bis 10/2026 gab es nur ein deutsches Bild („Behördenlisten aus Europa") — auch in Ghana und Senegal.
// Erzeugen:  node tools/og-bilder.mjs   → public/og-bild-<sp>.png (+ og-bild.png = Englisch als Rückfall)
import { createRequire } from 'node:module';
import { copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

export const OG_TEXTE = {
  de: { kopf: 'Lieferengpässe mit Quelle', sub: 'Behördenlisten und Meldungen aus Apotheken — aktuell, verständlich, mit Benachrichtigung bei jeder Änderung.', fuss: 'Für Apotheken, Großhandel und Einkauf · kostenlos' },
  en: { kopf: 'Medicine shortages with sources', sub: 'Official lists and reports from pharmacies — current, clear, with an alert on every change.', fuss: 'For pharmacies, wholesale and purchasing · free' },
  fr: { kopf: 'Pénuries de médicaments avec sources', sub: 'Listes officielles et signalements des pharmacies — à jour, clairs, avec une alerte à chaque changement.', fuss: 'Pour pharmacies, grossistes et achats · gratuit' },
  pt: { kopf: 'Ruturas de medicamentos com fonte', sub: 'Listas oficiais e comunicações de farmácias — atuais, claras, com alerta a cada alteração.', fuss: 'Para farmácias, distribuição e compras · gratuito' },
  ar: { kopf: 'نقص الأدوية مع المصادر', sub: 'قوائم رسمية وبلاغات من الصيدليات — محدّثة وواضحة، مع تنبيه عند كل تغيير.', fuss: 'للصيدليات وتجارة الجملة والمشتريات · مجانًا' },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function seite(sp) {
  const T = OG_TEXTE[sp];
  const rtl = sp === 'ar';
  return `<!DOCTYPE html><html lang="${sp}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #fff; font-family: Inter, 'DejaVu Sans', sans-serif; color: #0d1117; overflow: hidden;
    display: flex; flex-direction: column; padding: 80px 90px 40px; border-top: 14px solid #2b3440; }
  .marke { display: flex; align-items: center; gap: 30px; direction: ltr; }
  .logo { width: 104px; height: 104px; flex: none; display: block; }
  .name { font-size: 84px; font-weight: 700; letter-spacing: -1px; }
  h1 { margin-top: 56px; font-size: 56px; font-weight: 700; color: #2b3440; line-height: 1.1; }
  p { margin-top: 14px; font-size: 32px; color: #4a5866; line-height: 1.35; }
  .fuss { margin-top: auto; font-size: 28px; font-weight: 600; }
  </style></head><body>
  <div class="marke"><svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lgog" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5562"/><stop offset="1" stop-color="#1d242d"/></linearGradient><mask id="lmog"><rect width="32" height="32" fill="#fff"/><path d="M4 16.2h7.2l2.2-4.4 3.4 8.6 2.2-4.2H28" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><path d="M11.5 3h9a1 1 0 0 1 1 1v7.5H29a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7.5V28a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7.5V4a1 1 0 0 1 1-1z" fill="url(#lgog)" mask="url(#lmog)"/></svg><div class="name">ApoPulse</div></div>
  <h1>${esc(T.kopf)}</h1><p>${esc(T.sub)}</p><div class="fuss">${esc(T.fuss)}</div></body></html>`;
}

const br = await playwright.chromium.launch();
const p = await br.newPage({ viewport: { width: 1200, height: 630 } });
for (const sp of Object.keys(OG_TEXTE)) {
  await p.setContent(seite(sp), { waitUntil: 'load' });
  // Kein Text darf aus dem Bild laufen (lange französische/portugiesische Sätze).
  const ueber = await p.evaluate(() => {
    const [h, t, f] = ['h1', 'p', '.fuss'].map((s) => document.querySelector(s).getBoundingClientRect());
    return f.bottom > 630 || t.bottom > f.top - 12 || h.bottom > t.top;
  });
  if (ueber) throw new Error('Text läuft über: ' + sp);
  await p.screenshot({ path: join(PUBLIC, `og-bild-${sp}.png`) });
  console.log('✓ og-bild-' + sp + '.png');
}
await br.close();
copyFileSync(join(PUBLIC, 'og-bild-en.png'), join(PUBLIC, 'og-bild.png'));
console.log('✓ og-bild.png (= Englisch, Rückfall für alte Links)');
