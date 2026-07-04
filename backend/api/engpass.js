// /api/engpass — Österreichisches BASG Vertriebseinschränkungsregister (ECHTE DATEN)
//
// Offizielle maschinenlesbare Quelle (täglich 00:00–04:00 aktualisiert):
//   Primär:   https://www.basg.gv.at/fileadmin/uploadVERE/VertriebseinschraenkungenASP.xml
//   Sekundär: https://webservices.basg.gv.at/medicineshortage/export/v1/download (gleiche Datei)
// Doku: https://www.basg.gv.at/fuer-unternehmen/datenbereitstellung-vertriebseinschraenkungen
//
// XML-Struktur: <Packungen><Packung>…</Packung>…</Packungen>
// Felder je Packung: Zulassungsnummer, Bezeichnung_Arzneispezialitaet, Status,
//   Wirkstoffe, Grund, Melder, Zulassungsinhaber, Datum_Meldung,
//   Datum_letzte_Aenderung, Beginn_Vertriebseinschraenkung,
//   Datum_voraussichtliche_Wiederbelieferung
//
// Offizielle Statuswerte: "nicht verfügbar" | "eingeschränkt verfügbar"
//   | "verfügbar gemäß § 4 (1)" | "verfügbar"
//
// Debug: /api/engpass?probe=1 zeigt Status beider Endpoints.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const ENDPOINTS = [
  { name: 'basg-xml',        url: 'https://www.basg.gv.at/fileadmin/uploadVERE/VertriebseinschraenkungenASP.xml' },
  { name: 'basg-webservice', url: 'https://webservices.basg.gv.at/medicineshortage/export/v1/download' },
];

const MAX_ITEMS = 150; // Frontend-Schutz: kritisch+eingeschränkt zuerst

// Ehrlicher Fallback — NUR wenn keine Live-Quelle antwortet; als source:"fallback" gekennzeichnet.
const FALLBACK = [
  { name:'Amoxicillin 1000mg',   wirkstoff:'Amoxicillin',   status:'kritisch',       bis:'—', alt:'—', quelle:'Referenz' },
  { name:'Ibuprofen 400mg',      wirkstoff:'Ibuprofen',     status:'eingeschraenkt', bis:'—', alt:'—', quelle:'Referenz' },
  { name:'Salbutamol Spray',     wirkstoff:'Salbutamol',    status:'kritisch',       bis:'—', alt:'—', quelle:'Referenz' },
  { name:'Omeprazol 20mg',       wirkstoff:'Omeprazol',     status:'eingeschraenkt', bis:'—', alt:'—', quelle:'Referenz' },
  { name:'Clarithromycin 500mg', wirkstoff:'Clarithromycin',status:'kritisch',       bis:'—', alt:'—', quelle:'Referenz' },
];

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}

// BASG-Status → App-Status. Rangfolge für Aggregation: kritisch > eingeschraenkt > verfuegbar
function mapStatus(t) {
  t = (t || '').toLowerCase();
  if (t.includes('nicht verf')) return 'kritisch';
  if (t.includes('eingeschr') || t.includes('§ 4') || t.includes('gemäß'))
    return 'eingeschraenkt';
  return 'verfuegbar';
}
const STATUS_RANK = { kritisch: 2, eingeschraenkt: 1, verfuegbar: 0 };

function fmtDate(s) {
  if (!s) return '—';
  const iso = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const de = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (de) return de[0];
  return String(s).slice(0, 10);
}

function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '')) : '';
}

function parseBasgXml(xml) {
  const packs = [...xml.matchAll(/<Packung\b[^>]*>([\s\S]*?)<\/Packung>/gi)];
  // Nach Arzneispezialität gruppieren (mehrere Packungsgrößen je Produkt),
  // schlechtester Packungs-Status gewinnt.
  const byProduct = new Map();
  for (const p of packs) {
    const b = p[1];
    const name = tag(b, 'Bezeichnung_Arzneispezialitaet');
    if (!name || name.length < 3) continue;
    const status = mapStatus(tag(b, 'Status'));
    const entry = byProduct.get(name);
    const rec = {
      name: name.slice(0, 90),
      wirkstoff: (tag(b, 'Wirkstoffe') || '—').slice(0, 60),
      status,
      bis: fmtDate(tag(b, 'Datum_voraussichtliche_Wiederbelieferung')),
      alt: '—', // BASG liefert keine Alternativen; bewusst nicht erfunden
      quelle: 'BASG',
      grund: (tag(b, 'Grund') || '').slice(0, 80) || undefined,
      zulassungsnr: tag(b, 'Zulassungsnummer') || undefined,
      seit: fmtDate(tag(b, 'Beginn_Vertriebseinschraenkung')),
      geaendert: fmtDate(tag(b, 'Datum_letzte_Aenderung')),
    };
    if (!entry || STATUS_RANK[status] > STATUS_RANK[entry.status]) {
      byProduct.set(name, rec);
    }
  }
  return [...byProduct.values()];
}

async function fetchEndpoint(ep) {
  const r = await fetch(ep.url, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/xml, text/xml, */*',
      'Accept-Language': 'de-AT,de;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const xml = await r.text();
  const items = parseBasgXml(xml);
  if (items.length < 3) throw new Error('parse: nur ' + items.length + ' Produkte aus ' + xml.length + ' Bytes');
  return items;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Probe-Modus (QA/Debug)
  if (req.query && req.query.probe) {
    const results = [];
    for (const ep of ENDPOINTS) {
      try {
        const items = await fetchEndpoint(ep);
        results.push({ endpoint: ep.name, url: ep.url, ok: true, produkte: items.length,
          kritisch: items.filter(i => i.status === 'kritisch').length, sample: items[0] });
      } catch (e) {
        results.push({ endpoint: ep.name, url: ep.url, ok: false, error: e.message });
      }
    }
    res.json({ probe: true, ts: new Date().toISOString(), results });
    return;
  }

  let all = null;
  let source = null;
  const attempts = [];

  for (const ep of ENDPOINTS) {
    try {
      all = await fetchEndpoint(ep);
      source = 'BASG-live (' + ep.name + ')';
      break;
    } catch (e) {
      attempts.push(ep.name + ': ' + e.message);
    }
  }

  let items, stats;
  if (all) {
    stats = {
      gesamt: all.length,
      kritisch: all.filter(i => i.status === 'kritisch').length,
      eingeschraenkt: all.filter(i => i.status === 'eingeschraenkt').length,
      verfuegbar: all.filter(i => i.status === 'verfuegbar').length,
    };
    // Kritische zuerst, dann eingeschränkt, dann Rest — gedeckelt
    all.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
    items = all.slice(0, MAX_ITEMS);
  } else {
    items = FALLBACK;
    source = 'fallback';
    stats = null;
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  res.json({
    ok: true,
    source,
    live: source !== 'fallback',
    count: items.length,
    stats,
    truncated: all ? all.length > MAX_ITEMS : false,
    ts: new Date().toISOString(),
    disclaimer: 'Verbindlich ist ausschließlich das BASG-Vertriebseinschränkungsregister: https://medicineshortage.basg.gv.at',
    attempts: source === 'fallback' ? attempts : undefined,
    items,
  });
}

// Named exports für Unit-Tests (Vercel importiert nur den default-Handler).
export { parseBasgXml, mapStatus, fmtDate, decodeEntities, STATUS_RANK };
