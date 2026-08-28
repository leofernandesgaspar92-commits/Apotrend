// ============================================================================
//  Aktionen/Rabatte — von Herstellern und verifizierten B2B-Konten eingetragen
// ============================================================================
//  Ergänzt den bestehenden Rabatt-Feed (liveData.js `refreshRabatte`) um den
//  zweiten Weg: Ein Großhändler oder Hersteller trägt seine Aktion selbst ein.
//
//  Zwei Dinge, die hier festverdrahtet sind:
//
//  1. NUR FACHKREISE. Private Konten dürfen Aktionen LESEN, aber keine anlegen.
//     Rabattwerbung für Arzneimittel gegenüber Laien ist der rechtlich heikelste
//     Teil der Plattform (siehe LEGAL_COUNTRY_MATRIX.md) — wer einträgt, muss
//     ein verifiziertes Fachkonto sein.
//  2. HERKUNFT BLEIBT SICHTBAR. Selbst eingetragene Aktionen bekommen
//     provenance='self_reported' und den Namen des eintragenden Betriebs.
//     Sie sehen damit anders aus als geprüfte Feed-Daten — was sie auch sind.
// ============================================================================

import { AppError } from '../domain/errors.js';

/**
 * Kontotypen, die eigene Aktionen eintragen dürfen (data/accountTypes.js).
 * `private` fehlt hier ABSICHTLICH — das ist die eigentliche Regel.
 * `authority` ebenfalls: Eine Behörde bewirbt keine Rabatte.
 */
export const DEAL_ACCOUNT_TYPES = ['pharmacy', 'pharma'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TERM_DAYS = 365;

/**
 * Eingabe prüfen. Gibt eine bereinigte Zeile zurück oder wirft mit einem
 * i18n-Code — dieselbe Fehlerform wie im übrigen Backend.
 */
export function validateDeal(input, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const d = input || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  const bezeichnung = text(d.bezeichnung);
  const supplier = text(d.supplier);
  if (!bezeichnung) throw new AppError('deal_bezeichnung_missing', 'Bitte das Präparat angeben.');
  if (bezeichnung.length > 160) throw new AppError('deal_bezeichnung_long', 'Die Bezeichnung ist zu lang (max. 160 Zeichen).');
  if (!supplier) throw new AppError('deal_supplier_missing', 'Bitte den anbietenden Betrieb angeben.');

  const listenpreis = Number(d.listenpreis);
  const aktionspreis = Number(d.aktionspreis);
  if (!(listenpreis > 0)) throw new AppError('deal_listenpreis_invalid', 'Der Listenpreis muss größer als 0 sein.');
  if (!(aktionspreis > 0)) throw new AppError('deal_aktionspreis_invalid', 'Der Aktionspreis muss größer als 0 sein.');
  if (aktionspreis >= listenpreis) {
    // Ein „Rabatt", der nichts spart, ist irreführende Werbung.
    throw new AppError('deal_no_discount', 'Der Aktionspreis muss unter dem Listenpreis liegen.');
  }

  const gueltig_bis = text(d.gueltig_bis);
  if (!ISO_DATE.test(gueltig_bis)) {
    throw new AppError('deal_date_invalid', 'Bitte ein Enddatum im Format JJJJ-MM-TT angeben.');
  }
  if (gueltig_bis < today) {
    throw new AppError('deal_date_past', 'Das Enddatum liegt in der Vergangenheit.');
  }
  const days = Math.round((Date.parse(gueltig_bis + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  if (days > MAX_TERM_DAYS) {
    // Eine „Aktion" über mehrere Jahre ist keine Aktion, sondern ein Preis.
    throw new AppError('deal_term_long', `Aktionen laufen höchstens ${MAX_TERM_DAYS} Tage.`);
  }

  const min_menge = d.min_menge == null || d.min_menge === '' ? null : Number(d.min_menge);
  if (min_menge != null && !(Number.isInteger(min_menge) && min_menge > 0)) {
    throw new AppError('deal_min_menge_invalid', 'Die Mindestabnahme muss eine ganze Zahl größer 0 sein.');
  }

  return {
    bezeichnung,
    wirkstoff: text(d.wirkstoff) || null,
    supplier,
    listenpreis: Math.round(listenpreis * 100) / 100,
    aktionspreis: Math.round(aktionspreis * 100) / 100,
    currency: text(d.currency).toUpperCase() || 'EUR',
    min_menge,
    gueltig_bis,
  };
}

export function createDealsService({ rabatteRepo, social, accountTypeOf, today = null }) {
  const heute = () => today || new Date().toISOString().slice(0, 10);

  function assertMayCreate(userId) {
    const type = accountTypeOf(userId);
    if (!DEAL_ACCOUNT_TYPES.includes(type)) {
      throw new AppError(
        'deal_forbidden',
        'Aktionen dürfen nur Fachbetriebe eintragen (Apotheke oder Pharma-Unternehmen).',
      );
    }
    return type;
  }

  return {
    mayCreate(userId) {
      try { assertMayCreate(userId); return true; } catch { return false; }
    },

    /** Eigene Aktion eintragen. */
    create(userId, input) {
      assertMayCreate(userId);
      const row = validateDeal(input, { today: heute() });
      const profile = social.getProfile ? social.getProfile(userId) : null;
      const author = (profile && (profile.display_name || profile.handle)) || 'Fachbetrieb';

      return rabatteRepo.upsert({
        ...row,
        provenance: 'self_reported',
        quelle: author,
        created_by: userId,
      });
    },

    /** Eigene Aktionen auflisten. */
    mine(userId) {
      return rabatteRepo.listFlat()
        .filter((r) => r.created_by === userId)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    },

    /** Eigene Aktion zurückziehen. Fremde Aktionen sind tabu. */
    remove(userId, id) {
      const row = rabatteRepo.get(id);
      if (!row) throw new AppError('deal_not_found', 'Aktion nicht gefunden.');
      if (row.created_by !== userId) {
        throw new AppError('deal_not_owner', 'Nur eigene Aktionen können zurückgezogen werden.');
      }
      rabatteRepo.remove(id);
      return { ok: true, id };
    },
  };
}

// ============================================================================
//  Rückfall-Generator
// ============================================================================
//  Der Owner hat ihn ausdrücklich gewünscht: Solange weder ein Feed
//  angeschlossen ist noch jemand selbst eingetragen hat, soll die Ansicht nicht
//  leer sein.
//
//  Die Zeilen tragen deshalb provenance='simulated' und die Quelle
//  „Demodaten" — das Schema kennt diesen Wert bereits (db/rabatte.sql). Die
//  Oberfläche zeigt Herkunft an; eine erfundene Aktion darf nie aussehen wie
//  ein echtes Angebot eines echten Großhändlers.
//
//  Deshalb auch KEINE echten Firmennamen: „Demo-Großhandel A" statt eines
//  Unternehmens, das sich diese Preise nie zu eigen gemacht hat.
// ============================================================================

const DEMO_PRODUCTS = [
  { bezeichnung: 'Ibuprofen 400 mg, 50 Stück', wirkstoff: 'Ibuprofen', listenpreis: 2.35 },
  { bezeichnung: 'Pantoprazol 40 mg, 30 Stück', wirkstoff: 'Pantoprazol', listenpreis: 5.08 },
  { bezeichnung: 'Metformin 850 mg, 120 Stück', wirkstoff: 'Metformin', listenpreis: 6.95 },
  { bezeichnung: 'Cetirizin 10 mg, 100 Stück', wirkstoff: 'Cetirizin', listenpreis: 1.90 },
  { bezeichnung: 'Simvastatin 40 mg, 100 Stück', wirkstoff: 'Simvastatin', listenpreis: 5.60 },
  { bezeichnung: 'Ramipril 5 mg, 100 Stück', wirkstoff: 'Ramipril', listenpreis: 4.80 },
  { bezeichnung: 'ASS 100 mg, 100 Stück', wirkstoff: 'Acetylsalicylsäure', listenpreis: 1.40 },
  { bezeichnung: 'Vitamin D3 20.000 I.E., 50 Stück', wirkstoff: 'Colecalciferol', listenpreis: 4.20 },
];

const DEMO_SUPPLIERS = ['Demo-Großhandel A', 'Demo-Großhandel B', 'Demo-Hersteller C'];

/**
 * Deterministischer Demobestand.
 *
 * Deterministisch, damit die Ansicht nicht bei jedem Neustart andere Zahlen
 * zeigt — „gestern waren es noch 18 %" untergräbt das Vertrauen in alle Zahlen
 * der Plattform, auch in die echten. `seed` erlaubt Tests mit festen Werten.
 */
export function generateDemoDeals({ count = 8, today = new Date().toISOString().slice(0, 10), seed = 42 } = {}) {
  // Kleiner, reproduzierbarer Zufall (LCG) — kein Math.random.
  let state = seed >>> 0;
  const next = () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000;

  const base = Date.parse(today + 'T00:00:00Z');
  const out = [];

  for (let i = 0; i < Math.min(count, DEMO_PRODUCTS.length); i++) {
    const p = DEMO_PRODUCTS[i];
    const pct = 8 + Math.floor(next() * 22);           // 8–29 % Rabatt
    const days = 10 + Math.floor(next() * 70);          // 10–79 Tage Laufzeit
    const aktionspreis = Math.max(0.01, Math.round(p.listenpreis * (1 - pct / 100) * 100) / 100);

    out.push({
      bezeichnung: p.bezeichnung,
      wirkstoff: p.wirkstoff,
      supplier: DEMO_SUPPLIERS[i % DEMO_SUPPLIERS.length],
      listenpreis: p.listenpreis,
      aktionspreis,
      currency: 'EUR',
      min_menge: [10, 20, 30, 50][i % 4],
      gueltig_bis: new Date(base + days * 86400000).toISOString().slice(0, 10),
    });
  }
  return out;
}

/**
 * Demobestand anlegen, wenn keine LAUFENDE Aktion vorhanden ist.
 *
 * Die Betonung liegt auf „laufend", und das ist der ganze Punkt: Die
 * kuratierten Referenzdaten haben feste Enddaten. Sie laufen nach und nach ab,
 * und wenn die letzte abgelaufen ist, steht die Rabatt-Ansicht still leer —
 * ohne Fehler, ohne Meldung, ohne dass es jemandem auffällt. Eine Prüfung auf
 * „gibt es überhaupt Zeilen" würde das nie bemerken, weil die abgelaufenen
 * Zeilen ja weiterhin in der Tabelle stehen.
 *
 * Erfunden wird nur, was nötig ist: Sobald eine einzige echte Aktion läuft —
 * aus dem Feed oder selbst eingetragen — passiert hier nichts.
 */
export function seedDemoDealsIfNoneRunning({ rabatteRepo, today = null, log = console } = {}) {
  const laufend = rabatteRepo.listTop10()
    .filter((r) => r.provenance !== 'simulated');
  if (laufend.length > 0) {
    return { seeded: false, reason: `${laufend.length} laufende Aktionen vorhanden` };
  }

  const heute = today || new Date().toISOString().slice(0, 10);
  const rows = generateDemoDeals({ today: heute });
  for (const row of rows) {
    rabatteRepo.upsert({ ...row, provenance: 'simulated', quelle: 'Demodaten' });
  }
  log.log?.(`ApoTrend: ${rows.length} Demo-Aktionen angelegt (als „simuliert" gekennzeichnet — `
    + 'es lief keine echte Aktion mehr). Sie verschwinden, sobald echte vorliegen.');
  return { seeded: true, count: rows.length };
}
