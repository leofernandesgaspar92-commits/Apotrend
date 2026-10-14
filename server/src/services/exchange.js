// Bestandsaustausch-Modul (Biete/Suche) + Feed-nahe Anreicherung mit Autor-Profil.
// Kontaktaufnahme läuft über Direktnachrichten (social.startDm) — es werden keine
// öffentlichen Kontaktdaten getauscht.
import { ForbiddenError } from './orgAuth.js';
import { cleanImage } from '../domain/media.js';
import { AppError } from '../domain/errors.js';
import { filterRx, normalizeRx, rxSichtbar, verificationStatusFor } from '../domain/jurisdiction.js';
import { bedeutungsWoerter, falten } from '../domain/bezeichnung.js';

const KINDS = ['biete', 'suche'];
// Echtes Kalenderdatum (YYYY-MM-DD), kein Überlauf (z.B. 2026-02-31 ungültig).
function isValidCalendarDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date().toISOString().slice(0, 10);
  const a = Date.parse(today + 'T00:00:00Z'), b = Date.parse(dateStr + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
export const BUNDESLAENDER = ['Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark', 'Tirol', 'Kärnten', 'Salzburg', 'Vorarlberg', 'Burgenland'];

export function createExchangeService(exchangeRepo, social, foundationRepo, shortagesRepo = null) {
  function requireUser(userId) {
    if (!foundationRepo.getUserById(userId)) throw Object.assign(new Error('Unbekannter Nutzer.'), { code: 'user_unknown' });
  }
  // Bedeutungstragende Wörter fuer das Matching Biete<->Suche: Darreichungs-,
  // Füll- und Stärkewörter fallen raus, in DE/PT/EN, Akzente gefaltet
  // (domain/bezeichnung.js — dort auch, was vorher alles falsch zusammenfand).
  // Gibt eine Map gefaltet -> Schreibweise zurück.
  const words = bedeutungsWoerter;
  function sharedWords(a, b) { const out = []; for (const w of a.keys()) if (b.has(w)) out.push(w); return out; }
  // Nach dem Anlegen: passende Gegen-Einträge finden und deren Autor:innen benachrichtigen.
  //
  // ⚠️ FACHKREIS-SCHRANKE GILT AUCH HIER. Eine Benachrichtigung ist eine
  //    Anzeige: Sie traegt die Bezeichnung des Eintrags und verweist auf ihn.
  //    Vorher lief das Matching an der Schranke vorbei — wer ein passendes
  //    Gesuch hatte, bekam den Namen des Rx-Angebots in die Glocke, verifiziert
  //    oder nicht, und ueber die Landesgrenze. Die Liste war geschuetzt, die
  //    Glocke nicht. Geprueft wird mit DEMSELBEN Praedikat wie in der Liste
  //    (`rxSichtbar`), damit beide nie auseinanderlaufen koennen.
  //
  //    Gilt fuer alle drei Ausloeser: anlegen, umbenennen, wieder oeffnen.
  function notifyMatches(entry) {
    if (entry.reserved) return; // reservierte Einträge lösen kein Matchmaking aus (auch nicht beim Umbenennen)
    const opposite = entry.kind === 'biete' ? 'suche' : 'biete';
    const mine = words(entry.bezeichnung);
    if (!mine.size) return;
    const type = entry.kind === 'biete' ? 'exchange_offer' : 'exchange_want';
    const seen = new Set();
    for (const other of exchangeRepo.list()) {
      if (other.status !== 'offen' || other.reserved || other.kind !== opposite || other.id === entry.id) continue;
      if (other.author_user_id === entry.author_user_id || seen.has(other.author_user_id)) continue;
      if (!sharedWords(mine, words(other.bezeichnung)).length) continue;
      if (!rxSichtbar(entry, betrachterFuerRx(other.author_user_id))) continue;
      seen.add(other.author_user_id);
      social.pushNotification({ userId: other.author_user_id, type, actorUserId: entry.author_user_id, refType: 'exchange', refId: entry.id, label: entry.bezeichnung });
    }
  }

  // Passende offene Gegen-Einträge (nach Autor:in eindeutig) — für ein sichtbares
  // Matchmaking-Signal am Eintrag: „N passende Angebote/Gesuche". Nur für offene Einträge.
  //
  // Gezaehlt wird nur, was die BETRACHTERIN sehen darf. Vorher stand am Gesuch
  // „3 passende Angebote" — ein Klick, und die Liste war leer, weil alle drei
  // Rx-Angebote hinter der Schranke lagen. Die Zahl verriet, was die Liste
  // verbarg, und sah dabei aus wie ein Fehler.
  //
  // Liefert neben der Zahl den SCHLUESSEL: das Wort, über das die meisten
  // Gegenstücke gefunden wurden, in der Schreibweise des Eintrags. Die
  // Oberfläche setzt es als Suchbegriff ein, wenn jemand auf „passende
  // anzeigen" klickt. Vorher riet sie das Wort selbst — mit einem eigenen,
  // nur deutschen Muster und ohne Formwort-Filter. Bei „Lösung zum Einnehmen
  // Metformin" filterte sie nach „lösung", und die Kachel „1 passendes
  // Angebot" setzte die GANZE Bezeichnung ein, deren Wörter das Angebot nie
  // alle enthielt: Zahl und Klick sagten Verschiedenes.
  function passende(entry, betrachter) {
    const leer = { anzahl: 0, schluessel: null };
    if (entry.status !== 'offen' || entry.reserved) return leer; // reservierte sind vergeben – kein aktives Matchmaking
    const opposite = entry.kind === 'biete' ? 'suche' : 'biete';
    const mine = words(entry.bezeichnung);
    if (!mine.size) return leer;
    const authors = new Set();
    const jeWort = new Map(); // gefaltetes Wort -> Autor:innen
    for (const other of exchangeRepo.list()) {
      if (other.status !== 'offen' || other.reserved || other.kind !== opposite || other.id === entry.id) continue;
      if (other.author_user_id === entry.author_user_id) continue;
      const geteilt = sharedWords(mine, words(other.bezeichnung));
      if (!geteilt.length) continue;
      if (!rxSichtbar(other, betrachter)) continue;
      authors.add(other.author_user_id);
      for (const w of geteilt) {
        if (!jeWort.has(w)) jeWort.set(w, new Set());
        jeWort.get(w).add(other.author_user_id);
      }
    }
    // Meiste Gegenstücke gewinnt; bei Gleichstand das frühere Wort im Eintrag.
    let best = null;
    for (const w of mine.keys()) {
      const n = jeWort.has(w) ? jeWort.get(w).size : 0;
      if (n && (!best || n > jeWort.get(best).size)) best = w;
    }
    return { anzahl: authors.size, schluessel: best ? mine.get(best) : null };
  }

  /**
   * Rechtsraum eines Eintrags.
   *
   * Neue Eintraege tragen ihr Land selbst (beim Anlegen aus dem Profil
   * uebernommen). Fuer Altbestand ohne Land wird es aus dem Profil der Autorin
   * abgeleitet — sonst verschwaende die gesamte bestehende Boerse in dem
   * Moment, in dem der Laenderfilter eingeschaltet wird.
   */
  function countryOf(e, prof) {
    return e.country || (prof && prof.country) || null;
  }

  /**
   * Freitext-Treffer. Sucht in Bezeichnung UND Notiz.
   *
   * Mehrere Woerter muessen ALLE vorkommen (UND, nicht ODER): „pantoprazol 40"
   * soll die 40-mg-Packung finden und nicht jede Zeile, in der irgendwo eine 40
   * steht. Reihenfolge egal — „40 pantoprazol" findet dasselbe.
   */
  //
  // Akzente gefaltet, auf beiden Seiten: „acido" findet „Ácido", „losung"
  // findet „Lösung". Der Schlüssel aus `passende()` muss hier treffen, sonst
  // zeigt „passende anzeigen" eine leere Liste.
  function matchesQuery(e, query) {
    const heu = falten(`${e.bezeichnung || ''} ${e.note || ''}`);
    return falten(query).split(/\s+/).filter(Boolean).every((w) => heu.includes(w));
  }

  /**
   * Betrachter fuer die Rx-Schranke beschreiben.
   *
   * Leitet die Verifizierungsstufe aus dem ab, was die Anwendung HEUTE fuehrt
   * (Kontotyp + von der Moderation bestaetigtes `verified`). Das neue
   * Vokabular ist damit von echten Daten gedeckt und nicht von einem leeren
   * Feld, das niemand fuellt (domain/jurisdiction.js).
   */
  function betrachterFuerRx(userId) {
    if (!userId) return null;
    const prof = social.getProfile ? social.getProfile(userId) : null;
    if (!prof) return { userId };
    const v = (social.getVerification && social.getVerification(userId)) || null;
    return {
      userId,
      jurisdiction: String(prof.country || '').toUpperCase(),
      verificationStatus: verificationStatusFor({
        accountType: prof.account_type,
        verified: !!prof.verified,
        verificationPending: !!(v && v.status === 'offen'),
      }),
      // `isRxAllowed` kennt die Anwendung noch nicht als eigenes Feld (es steht
      // im Schema bereit). `undefined` heisst „kein Entzug" — nur ein
      // ausdruecklicher `false`-Wert sperrt.
      isRxAllowed: prof.is_rx_allowed,
    };
  }

  // `betrachter` bestimmt `match_count` und `match_key` (siehe passende()).
  // Ohne Betrachter zaehlt nur, was ohnehin jeder sehen darf — fail closed.
  function decorate(e, betrachter = null) {
    const prof = social.getProfile ? social.getProfile(e.author_user_id) : null;
    const treffer = passende(e, betrachter);
    return {
      ...e,
      country: countryOf(e, prof),
      author: prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified } : null,
      match_count: treffer.anzahl,
      match_key: treffer.schluessel, // Suchbegriff für „passende anzeigen"; null ohne Treffer
      days_until_expiry: daysUntil(e.ablauf), // null wenn kein Verfallsdatum
    };
  }

  return {
    create(actorUserId, { kind, bezeichnung, menge, ort, bundesland, note, image, ablauf, rx }) {
      requireUser(actorUserId);
      // Bestandsaustausch ist professioneller B2B-Vorgang (Apotheken tauschen Bestand) —
      // Privatnutzer:innen können Einträge lesen, aber keine anlegen.
      const prof = social.getProfile(actorUserId);
      if (prof && prof.account_type === 'private') {
        throw new AppError('exchange_pro_only', 'Der Bestandsaustausch (Biete/Suche) ist Apotheken und Fachkreisen vorbehalten. Als Privatnutzer:in kannst du Einträge lesen, aber keine anlegen.', 403);
      }
      if (!KINDS.includes(kind)) throw Object.assign(new Error('Art muss "biete" oder "suche" sein.'), { code: 'exchange_kind_invalid' });
      const b = String(bezeichnung ?? '').trim();
      if (!b) throw new AppError('exchange_name_required', 'Präparat/Wirkstoff erforderlich.');
      if (b.length > 200) throw Object.assign(new Error('Bezeichnung zu lang.'), { code: 'bezeichnung_zu_lang' });
      const bl = bundesland ? String(bundesland).trim() : null;
      if (bl && !BUNDESLAENDER.includes(bl)) throw Object.assign(new Error('Ungültiges Bundesland.'), { code: 'region_invalid' });
      const abl = ablauf ? String(ablauf).trim() : null;
      if (abl && !isValidCalendarDay(abl)) throw new AppError('exchange_bad_date', 'Ungültiges Verfallsdatum.', 400);
      const created = exchangeRepo.create({
        kind, authorUserId: actorUserId, bezeichnung: b,
        // Land AUS DEM PROFIL, nicht aus der Anfrage: Sonst koennte jemand ein
        // Angebot unter fremder Rechtsordnung einstellen — bei Arzneimitteln
        // ist der Rechtsraum keine Anzeigeoption, sondern die Grundlage dafuer,
        // ob der Handel ueberhaupt zulaessig ist.
        country: (prof && prof.country) || null,
        menge: (menge ?? '').toString().trim() || null,
        ort: (ort ?? '').toString().trim() || null,
        bundesland: bl,
        ablauf: abl,
        note: (note ?? '').toString().trim() || null,
        image: cleanImage(image),
        // Rx-Kennzeichnung. `normalizeRx` laesst nur ein AUSDRUECKLICHES „otc"
        // zu false werden; alles andere — auch ein Tippfehler im Formular —
        // bleibt geschuetzt (domain/jurisdiction.js, FAIL CLOSED).
        rx: normalizeRx(rx),
      });
      notifyMatches(created); // aktives Matching Biete<->Suche
      // Beobachter:innen benachrichtigen, wenn jemand ihren Wirkstoff anbietet.
      if (created.kind === 'biete' && shortagesRepo && shortagesRepo.watchersForText) {
        for (const { userId, wirkstoff } of shortagesRepo.watchersForText(created.bezeichnung)) {
          // Dieselbe Schranke wie oben: Die Glocke verraet sonst, DASS und VON
          // WEM ein Rx-Praeparat angeboten wird — mit Verweis auf den Eintrag.
          if (!rxSichtbar(created, betrachterFuerRx(userId))) continue;
          social.pushNotification({ userId, type: 'watch_offer', actorUserId: created.author_user_id, refType: 'exchange', refId: created.id, label: wirkstoff });
        }
      }
      return decorate(created, betrachterFuerRx(actorUserId));
    },
    // Offene Einträge (Standard), optional nach Art + Text (Präparat) + Bundesland gefiltert.
    // sort='ablauf' -> bald ablaufende zuerst (ohne Verfallsdatum ans Ende).
    list(viewerUserId, { kind = null, status = 'offen', q = null, bundesland = null, sort = null, country = null } = {}) {
      requireUser(viewerUserId);
      const query = q ? String(q).trim().toLowerCase() : null;
      const cc = country ? String(country).toUpperCase() : null;
      // Erst dekorieren, dann filtern: Das Land steht erst nach decorate() fest
      // (Altbestand leitet es aus dem Profil ab).
      const betrachter = betrachterFuerRx(viewerUserId);
      const out = exchangeRepo.list()
        .map((e) => decorate(e, betrachter))
        .filter(e => (!status || e.status === status) && (!kind || e.kind === kind)
          // Freitext ueber Bezeichnung UND Notiz: Der Wirkstoff steht bei
          // Boersen-Eintraegen oft nur in der Notiz („INN: Pantoprazol"),
          // und eine Suche, die ihn dort nicht findet, wirkt kaputt.
          && (!query || matchesQuery(e, query))
          && (!bundesland || e.bundesland === bundesland)
          && (!cc || e.country === cc));
      if (sort === 'ablauf') {
        // Nur Einträge MIT Verfallsdatum aufsteigend; ohne Datum unverändert ans Ende.
        out.sort((a, b) => {
          const av = a.ablauf || '9999-12-31', bv = b.ablauf || '9999-12-31';
          return av.localeCompare(bv);
        });
      }
      // ── Fachkreis-Schranke ───────────────────────────────────────────────
      //  ZULETZT, nach allen anderen Filtern — und mit ZAEHLER. Die Zahl ist
      //  der Punkt: Nur mit ihr kann die Oberflaeche „3 Angebote nur fuer
      //  verifizierte Fachkreise" sagen, statt stillschweigend eine kuerzere
      //  Liste zu zeigen. Eine Schranke ohne Erklaerung sieht aus wie ein
      //  leerer Bereich, und das Signal waere falsch: Es ist etwas da, nur
      //  nicht fuer diese Person.
      return filterRx(out, betrachter);
    },
    // Offene Einträge einer bestimmten Apotheke — für deren öffentliches Profil (Biete/Suche
    // auf einen Blick; Kontakt läuft wie üblich per DM). Neueste zuerst, begrenzt.
    //
    // ⚠️ `viewerUserId` ist PFLICHT, auch wenn die Ansicht „oeffentlich lesbar"
    //    ist. Hier stand vorher kein Betrachter — und das war das zweite Leck
    //    neben `list()`: Wer das Profil einer Apotheke oeffnete, sah deren
    //    Rx-Angebote vollstaendig, ganz gleich ob verifiziert oder nicht. Die
    //    Liste war geschuetzt, die Hintertuer ueber das Profil nicht.
    //
    //    Die Begrenzung auf `limit` kommt NACH der Schranke. Andersherum waere
    //    das Profil mit lauter verborgenen Eintraegen gefuellt und zeigte
    //    weniger als die zwoelf, die es zeigen koennte.
    byAuthor(authorUserId, { status = 'offen', limit = 12, viewerUserId = null } = {}) {
      if (!authorUserId) return { eintraege: [], verborgen: 0, grund: null };
      const betrachter = betrachterFuerRx(viewerUserId);
      const out = exchangeRepo.list()
        .filter(e => e.author_user_id === authorUserId && (!status || e.status === status))
        .map((e) => decorate(e, betrachter))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const gefiltert = filterRx(out, betrachter);
      return {
        ...gefiltert,
        eintraege: limit ? gefiltert.eintraege.slice(0, limit) : gefiltert.eintraege,
      };
    },
    // Eigene Einträge (alle Status), neueste zuerst — für „Meine Einträge"/Historie.
    mine(actorUserId, { status = null } = {}) {
      requireUser(actorUserId);
      const betrachter = betrachterFuerRx(actorUserId);
      return exchangeRepo.list()
        .filter(e => e.author_user_id === actorUserId && (!status || e.status === status))
        .map((e) => decorate(e, betrachter));
    },
    // Noch gültigen, aber alten Eintrag auffrischen (nur Ersteller, nur offen): setzt das
    // Erstelldatum auf jetzt, damit er wieder oben in der Liste steht und der „veraltet"-Hinweis
    // verschwindet — ohne löschen + neu anlegen. Löst kein neues Matchmaking aus (Inhalt bleibt).
    renew(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw new AppError('exchange_not_found', 'Eintrag nicht gefunden.', 404);
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      if (e.status !== 'offen') throw new AppError('exchange_not_open', 'Nur offene Einträge lassen sich auffrischen.', 400);
      return decorate(exchangeRepo.update(id, { created_at: new Date().toISOString() }), betrachterFuerRx(actorUserId));
    },
    // Erledigten Eintrag wieder öffnen (nur Ersteller) — löst erneut Matching aus.
    reopen(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw Object.assign(new Error('Eintrag nicht gefunden.'), { code: 'exchange_not_found' });
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      const updated = exchangeRepo.update(id, { status: 'offen', resolved_at: null });
      notifyMatches(updated);
      return decorate(updated, betrachterFuerRx(actorUserId));
    },
    markResolved(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw Object.assign(new Error('Eintrag nicht gefunden.'), { code: 'exchange_not_found' });
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      return decorate(exchangeRepo.update(id, { status: 'erledigt', reserved: false, resolved_at: new Date().toISOString() }), betrachterFuerRx(actorUserId));
    },
    // Eintrag als „reserviert" markieren/freigeben (nur Ersteller, nur bei offenen Einträgen).
    // Reserviert = ein Tausch ist per Direktnachricht in Absprache; der Eintrag bleibt für alle
    // sichtbar, aber klar gekennzeichnet und aus dem aktiven Matchmaking genommen — so sparen
    // sich Kolleg:innen doppelte Anfragen zu bereits vergebener Ware.
    setReserved(actorUserId, id, reserved) {
      const e = exchangeRepo.get(id);
      if (!e) throw new AppError('exchange_not_found', 'Eintrag nicht gefunden.', 404);
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      if (e.status !== 'offen') throw new AppError('exchange_not_open', 'Nur offene Einträge lassen sich reservieren.', 400);
      return decorate(exchangeRepo.update(id, { reserved: !!reserved }), betrachterFuerRx(actorUserId));
    },
    remove(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw Object.assign(new Error('Eintrag nicht gefunden.'), { code: 'exchange_not_found' });
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf loeschen.');
      exchangeRepo.remove(id);
      return { ok: true };
    },
    // Eigenen Eintrag bearbeiten (Ersteller): Präparat/Menge/Ort/Bundesland/Notiz. Die Art
    // (biete/suche) bleibt fest. Ändert sich die Bezeichnung, wird das Matching neu ausgelöst.
    update(actorUserId, id, { bezeichnung, menge, ort, bundesland, note, ablauf } = {}) {
      const e = exchangeRepo.get(id);
      if (!e) throw new AppError('exchange_not_found', 'Eintrag nicht gefunden.', 404);
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf bearbeiten.');
      const patch = {};
      if (bezeichnung !== undefined) {
        const b = String(bezeichnung ?? '').trim();
        if (!b) throw new AppError('exchange_name_required', 'Präparat/Wirkstoff erforderlich.');
        if (b.length > 200) throw Object.assign(new Error('Bezeichnung zu lang.'), { code: 'bezeichnung_zu_lang' });
        patch.bezeichnung = b;
      }
      if (menge !== undefined) patch.menge = (menge ?? '').toString().trim() || null;
      if (ort !== undefined) patch.ort = (ort ?? '').toString().trim() || null;
      if (bundesland !== undefined) {
        const bl = bundesland ? String(bundesland).trim() : null;
        if (bl && !BUNDESLAENDER.includes(bl)) throw Object.assign(new Error('Ungültiges Bundesland.'), { code: 'region_invalid' });
        patch.bundesland = bl;
      }
      if (note !== undefined) patch.note = (note ?? '').toString().trim() || null;
      if (ablauf !== undefined) {
        const abl = ablauf ? String(ablauf).trim() : null;
        if (abl && !isValidCalendarDay(abl)) throw new AppError('exchange_bad_date', 'Ungültiges Verfallsdatum.', 400);
        patch.ablauf = abl;
      }
      const updated = exchangeRepo.update(id, patch);
      // Bei geänderter Bezeichnung (und noch offenem Eintrag) erneut passende Gegenstücke suchen.
      if (patch.bezeichnung !== undefined && updated.status === 'offen') notifyMatches(updated);
      return decorate(updated, betrachterFuerRx(actorUserId));
    },
  };
}
