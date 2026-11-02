// @ts-check
// ============================================================================
//  Neue Zulassungen und Studienergebnisse (Sprint 5, „Medical Intelligence")
// ============================================================================
//  Zwei freie, amtliche bzw. öffentliche Quellen ohne Schlüssel:
//   • openFDA drugsfda — Erstzulassungen (submission ORIG, Status AP) der US-FDA.
//   • ClinicalTrials.gov (NIH, API v2) — Studien, deren ERGEBNISSE neu veröffentlicht wurden.
//  Die WHO hat für Studienergebnisse keine offene Schnittstelle (ICTRP nur als Download);
//  WHO-Daten nutzt der Ausbruchs-Radar (services/ausbruch.js).
//
//  Was das ist — und was nicht: eine Liste mit Quelle und Datum. Eine FDA-Zulassung heißt
//  NICHT, dass das Mittel im Land der Nutzerin zugelassen oder erhältlich ist; ein
//  Studienergebnis ist keine Therapieempfehlung. Beides steht an jedem Eintrag.
//  Abruf über den gemeinsamen Baustein (Zwischenspeicher, Zeitlimit, letzter guter Stand).
// ============================================================================
import { createAbruf } from './abruf.js';

/** Fachgebiete: Stichwörter für FDA-Wirkstoffklassen und die ClinicalTrials-Suche. */
export const BEREICHE = {
  onkologie: { ct: 'cancer', fda: /antineoplastic|kinase inhibitor|tumor|cancer|programmed death|cd20|her2|parp|bcl-2|antibody-drug|alkylating|antimetabolite/i },
  infektion: { ct: 'infection', fda: /antibacterial|antiviral|antifungal|antimycobacterial|antiprotozoal|antimalarial|vaccine|anti-infective/i },
  diabetes: { ct: 'diabetes', fda: /glucagon-like|insulin|sodium-glucose|dipeptidyl|sulfonylurea|biguanide|amylin/i },
  herz: { ct: 'cardiovascular', fda: /anticoagulant|antiplatelet|angiotensin|beta adrenergic|calcium channel|hmg-coa|pcsk9|diuretic|cardiac/i },
};

const tagFda = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const ausFda = (s) => (/^\d{8}$/.test(String(s)) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const fdaLink = (appl) => `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${encodeURIComponent(String(appl).replace(/\D/g, ''))}`;

/** openFDA-Antwort → Erstzulassungen im Zeitraum, neueste zuerst. Wirft bei unbrauchbarer Antwort. */
export function fdaLesen(j, { ab }) {
  if (!j || !Array.isArray(j.results)) throw Object.assign(new Error('openFDA: keine Ergebnisliste'), { code: 'quelle_gestoert' });
  const out = [];
  for (const r of j.results) {
    const sub = (r.submissions || []).find((s) => s.submission_type === 'ORIG' && s.submission_status === 'AP' && String(s.submission_status_date) >= ab);
    if (!sub || !r.application_number) continue;
    const prod = (r.products || [])[0] || {};
    const of = r.openfda || {};
    const wirkstoffe = [...new Set([...(of.generic_name || []), ...((prod.active_ingredients || []).map((a) => a && a.name))].filter(Boolean).map((x) => String(x).toLowerCase()))];
    out.push({
      id: 'fda:' + r.application_number, art: 'zulassung', quelle: 'US-FDA (openFDA)', link: fdaLink(r.application_number),
      datum: ausFda(sub.submission_status_date), titel: String(prod.brand_name || (of.brand_name || [])[0] || wirkstoffe[0] || r.application_number),
      wirkstoffe, hersteller: r.sponsor_name || null, klassen: (of.pharm_class_epc || []).slice(0, 4), darreichung: prod.dosage_form || null,
    });
  }
  return out.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
}

/** ClinicalTrials.gov v2 → Studien mit neu veröffentlichten Ergebnissen. Wirft bei unbrauchbarer Antwort. */
export function ctLesen(j) {
  if (!j || !Array.isArray(j.studies)) throw Object.assign(new Error('ClinicalTrials.gov: keine Studienliste'), { code: 'quelle_gestoert' });
  return j.studies.map((st) => {
    const p = st.protocolSection || {};
    const nct = p.identificationModule && p.identificationModule.nctId;
    if (!nct) return null;
    const datum = p.statusModule && p.statusModule.resultsFirstPostDateStruct && p.statusModule.resultsFirstPostDateStruct.date;
    return {
      id: 'ct:' + nct, art: 'studie', quelle: 'ClinicalTrials.gov (NIH)', link: `https://clinicaltrials.gov/study/${nct}`,
      datum: datum || null, titel: String((p.identificationModule.briefTitle) || nct),
      wirkstoffe: ((p.armsInterventionsModule && p.armsInterventionsModule.interventions) || []).map((i) => i && i.name).filter(Boolean).slice(0, 5),
      hersteller: (p.sponsorCollaboratorsModule && p.sponsorCollaboratorsModule.leadSponsor && p.sponsorCollaboratorsModule.leadSponsor.name) || null,
      phase: ((p.designModule && p.designModule.phases) || []).join(', ') || null,
      erkrankungen: ((p.conditionsModule && p.conditionsModule.conditions) || []).slice(0, 4),
    };
  }).filter(Boolean);
}

/** Passt ein Eintrag zu einem Fachgebiet? */
export function passtZu(eintrag, bereich) {
  const b = BEREICHE[bereich];
  if (!b) return false;
  if (eintrag.art === 'studie') return eintrag.bereich === bereich;
  return (eintrag.klassen || []).some((k) => b.fda.test(k));
}

export function createMedInt({ speicher, fetchImpl, jetzt = () => Date.now(), tage = 60 } = /** @type {any} */ ({})) {
  const fda = createAbruf({ name: 'openfda_zulassungen', quelle: 'US-FDA (openFDA drugsfda)', link: 'https://open.fda.gov/apis/drug/drugsfda/', ttlMs: 12 * 3_600_000, speicher, fetchImpl, jetzt });
  const ct = createAbruf({ name: 'clinicaltrials', quelle: 'ClinicalTrials.gov (NIH)', link: 'https://clinicaltrials.gov/data-api/api', ttlMs: 12 * 3_600_000, speicher, fetchImpl, jetzt });
  return {
    async zulassungen() {
      const bis = new Date(jetzt()), von = new Date(jetzt() - tage * 86_400_000);
      const ab = tagFda(von);
      const url = 'https://api.fda.gov/drug/drugsfda.json?search=' + encodeURIComponent(`submissions.submission_type:"ORIG" AND submissions.submission_status:"AP" AND submissions.submission_status_date:[${ab} TO ${tagFda(bis)}]`).replace(/%20/g, '+') + '&limit=100';
      return fda.holen('neu', url, (j) => fdaLesen(j, { ab }));
    },
    async studien(bereich) {
      const b = BEREICHE[bereich];
      if (!b) return { daten: [], stand: null, aus: /** @type {'keine'} */ ('keine'), veraltet: false };
      const ab = new Date(jetzt() - tage * 86_400_000).toISOString().slice(0, 10);
      const url = `https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=15&sort=ResultsFirstPostDate:desc&query.cond=${encodeURIComponent(b.ct)}`
        + `&filter.advanced=${encodeURIComponent(`AREA[ResultsFirstPostDate]RANGE[${ab},MAX]`)}`;
      return ct.holen(bereich, url, (j) => ctLesen(j).map((s) => ({ ...s, bereich })));
    },
    status: () => [fda.status(), ct.status()],
  };
}

// ── Abos je Fachgebiet + Benachrichtigung über NEUE Zulassungen ──────────────
//  Erster Lauf merkt nur, was schon da ist (sonst bekäme jede:r 60 Tage auf einmal).
export function createMedIntAbos() {
  /** @type {Map<string, Set<string>>} */
  const abos = new Map();
  const gesehen = new Set();
  let ersterLauf = true;
  return {
    setzen(userId, bereiche) {
      const gueltig = [...new Set((Array.isArray(bereiche) ? bereiche : []).filter((b) => BEREICHE[b]))];
      if (gueltig.length) abos.set(userId, new Set(gueltig)); else abos.delete(userId);
      return gueltig;
    },
    von: (userId) => [...(abos.get(userId) || [])],
    /** Neue Zulassungen → [{ userId, eintrag, bereich }] (je Person und Eintrag höchstens einmal). */
    neue(zulassungen) {
      const neu = (zulassungen || []).filter((z) => z && !gesehen.has(z.id));
      for (const z of neu) gesehen.add(z.id);
      if (ersterLauf) { ersterLauf = false; return []; }
      const out = [];
      for (const [userId, bs] of abos) for (const z of neu) { const b = [...bs].find((x) => passtZu(z, x)); if (b) out.push({ userId, eintrag: z, bereich: b }); }
      return out;
    },
    __dump: () => ({ abos: [...abos].map(([u, s]) => [u, [...s]]), gesehen: [...gesehen].slice(-2000), erster: ersterLauf }),
    __load(d) {
      abos.clear(); gesehen.clear();
      if (!d) return;
      for (const [u, s] of Array.isArray(d.abos) ? d.abos : []) if (typeof u === 'string' && Array.isArray(s)) abos.set(u, new Set(s.filter((b) => BEREICHE[b])));
      for (const g of Array.isArray(d.gesehen) ? d.gesehen : []) if (typeof g === 'string') gesehen.add(g);
      ersterLauf = d.erster !== false && gesehen.size === 0;
    },
  };
}
