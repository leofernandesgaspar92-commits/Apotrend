// @ts-check
// ============================================================================
//  AISStream.io — Schiffe an wichtigen Häfen (live, per WebSocket)
// ============================================================================
//  Nur aktiv mit AISSTREAM_API_KEY (kostenlos auf aisstream.io). Abonniert werden
//  Positionsmeldungen in kleinen Rechtecken um die Häfen (wetter.js, HAEFEN). Gezählt
//  wird je Hafen: Schiffe der letzten 2 Stunden, davon vor Anker (wartend), festgemacht,
//  in Fahrt. Viele wartende Schiffe sind ein HINWEIS auf Stau — keine Aussage über eine
//  bestimmte Lieferung oder einen Engpass.
//  Robust: Verbindungsabbruch → neuer Versuch nach 5 s … 5 min; kaputte Nachrichten
//  werden übersprungen; Speicher gedeckelt. Nie ein Fehler nach außen.
// ============================================================================

/** @typedef {import('./typen').AisNachricht} AisNachricht */
/** @typedef {import('./typen').HafenSchiffe} HafenSchiffe */

const FENSTER_MS = 2 * 60 * 60_000;
const MAX_JE_HAFEN = 3000;
const RAND = 0.15; // Grad um den Hafen
const RUECKZUG = [5_000, 15_000, 60_000, 300_000];

export const STATUS = { VOR_ANKER: 1, FESTGEMACHT: 5 };

export function aisAbo(apiKey, haefen) {
  return {
    APIKey: apiKey,
    BoundingBoxes: haefen.map((h) => [[h.lat - RAND, h.lon - RAND], [h.lat + RAND, h.lon + RAND]]),
    FilterMessageTypes: ['PositionReport'],
  };
}

export function createAisStream({ apiKey = '', haefen = [], WebSocketImpl = globalThis.WebSocket, jetzt = () => Date.now(), log = console, setTimeoutImpl = setTimeout } = {}) {
  const schluessel = String(apiKey || '').trim();
  /** @type {Map<string, Map<number, { sog: number|null, nav: number|null, at: number }>>} */
  const je = new Map(haefen.map((h) => [h.id, new Map()]));
  let ws = null, versuche = 0, verbunden = false, letzteNachricht = null, letzterFehler = null, nachrichten = 0, gestoppt = false;

  const hafenFuer = (lat, lon) => haefen.find((h) => Math.abs(lat - h.lat) <= RAND && Math.abs(lon - h.lon) <= RAND) || null;

  /** Eine Nachricht verarbeiten (auch direkt testbar). */
  function verarbeite(roh) {
    let m;
    try { m = /** @type {AisNachricht} */ (JSON.parse(typeof roh === 'string' ? roh : Buffer.from(roh).toString('utf8'))); } catch { return false; }
    if (m && m.error) { letzterFehler = String(m.error).slice(0, 200); return false; }
    if (!m || m.MessageType !== 'PositionReport' || !m.MetaData) return false;
    const { MMSI, latitude, longitude } = m.MetaData;
    if (!Number.isFinite(MMSI) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    const h = hafenFuer(latitude, longitude);
    if (!h) return false;
    const pr = (m.Message && m.Message.PositionReport) || {};
    const schiffe = je.get(h.id);
    schiffe.delete(MMSI);
    schiffe.set(MMSI, { sog: Number.isFinite(pr.Sog) ? pr.Sog : null, nav: Number.isFinite(pr.NavigationalStatus) ? pr.NavigationalStatus : null, at: jetzt() });
    while (schiffe.size > MAX_JE_HAFEN) schiffe.delete(schiffe.keys().next().value);
    letzteNachricht = jetzt(); nachrichten++;
    return true;
  }

  function verbinden() {
    if (!schluessel || gestoppt || !WebSocketImpl) return;
    try {
      ws = new WebSocketImpl('wss://stream.aisstream.io/v0/stream');
    } catch (e) { letzterFehler = String((e && e.message) || e); return neuVersuchen(); }
    ws.onopen = () => {
      verbunden = true; versuche = 0;
      try { ws.send(JSON.stringify(aisAbo(schluessel, haefen))); } catch (e) { letzterFehler = String((e && e.message) || e); }
    };
    ws.onmessage = (ev) => { verarbeite(ev && ev.data); };
    ws.onerror = (ev) => { letzterFehler = (ev && ev.message) || 'Verbindungsfehler'; };
    ws.onclose = () => { verbunden = false; ws = null; neuVersuchen(); };
  }
  function neuVersuchen() {
    if (gestoppt || !schluessel) return;
    const pause = RUECKZUG[Math.min(versuche, RUECKZUG.length - 1)];
    versuche++;
    const t = setTimeoutImpl(verbinden, pause);
    if (t && t.unref) t.unref();
  }

  /** @param {string} hafenId @returns {HafenSchiffe | null} */
  function lage(hafenId) {
    if (!schluessel) return null;
    const schiffe = je.get(hafenId);
    if (!schiffe) return null;
    const grenze = jetzt() - FENSTER_MS;
    let im = 0, anker = 0, fest = 0, fahrt = 0, zuletzt = 0;
    for (const [mmsi, s] of schiffe) {
      if (s.at < grenze) { schiffe.delete(mmsi); continue; }
      im++; zuletzt = Math.max(zuletzt, s.at);
      if (s.nav === STATUS.FESTGEMACHT) fest++;
      else if (s.nav === STATUS.VOR_ANKER || (s.sog != null && s.sog < 0.5)) anker++;
      else fahrt++;
    }
    return { im_gebiet: im, vor_anker: anker, festgemacht: fest, in_fahrt: fahrt, stand: zuletzt ? new Date(zuletzt).toISOString() : null };
  }

  return {
    aktiv: !!schluessel,
    start() { gestoppt = false; verbinden(); },
    stop() { gestoppt = true; try { if (ws) ws.close(); } catch { /* egal */ } },
    verarbeite,
    lage,
    status() {
      return { name: 'aisstream', quelle: 'AISStream.io', link: 'https://aisstream.io/', aktiv: !!schluessel, verbunden,
        zuletzt_ok: letzteNachricht ? new Date(letzteNachricht).toISOString() : null, letzter_fehler: schluessel ? letzterFehler : 'AISSTREAM_API_KEY nicht gesetzt',
        pause_bis: null, abrufe: nachrichten, aus_speicher: 0 };
    },
  };
}
