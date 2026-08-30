// ═══════════════════════════════════════════════════════════════
//  ApoPulse Terminal — e-Rezept-Modul (Skelett)
//  Reifegrad: 🟡 MOCK — echter SV-Peering-Zugang ist zertifizierungspflichtig.
//
//  Design: Die Business-Logik (State-Machine) kennt KEINE Datenquelle.
//  Sie spricht nur das Interface `RezeptProvider`. Heute liefert ein
//  MockProvider Testdaten; morgen ersetzt ein echter SvPeeringProvider ihn –
//  ohne dass eine Zeile Business-Logik sich ändert (Adapter-Muster).
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── 1. Status-Automat ───────────────────────────────────────────
// Erlaubte Übergänge. Jeder andere Übergang ist ein Fehler (auditierbar).
const REZEPT_STATES = {
  EMPFANGEN:      'empfangen',       // vom SV-System abgerufen
  IN_BEARBEITUNG: 'in_bearbeitung',  // PKA/Apotheker bearbeitet
  ABGEGEBEN:      'abgegeben',        // an Patient ausgehändigt
  ABGERECHNET:    'abgerechnet',      // mit Kasse abgerechnet
  STORNIERT:      'storniert',
};

const ERLAUBTE_UEBERGAENGE = {
  empfangen:      ['in_bearbeitung', 'storniert'],
  in_bearbeitung: ['abgegeben', 'storniert'],
  abgegeben:      ['abgerechnet', 'storniert'],
  abgerechnet:    [],
  storniert:      [],
};

class RezeptStateError extends Error {}

function uebergang(rezept, neuerStatus, akteur) {
  const erlaubt = ERLAUBTE_UEBERGAENGE[rezept.status] || [];
  if (!erlaubt.includes(neuerStatus)) {
    throw new RezeptStateError(
      `Ungültiger Übergang: ${rezept.status} → ${neuerStatus}`
    );
  }
  const eintrag = {
    von: rezept.status,
    nach: neuerStatus,
    akteur: akteur || 'system',
    ts: new Date().toISOString(),
  };
  rezept.status = neuerStatus;
  rezept.audit = rezept.audit || [];
  rezept.audit.push(eintrag); // unveränderliches Audit-Log
  return rezept;
}

// ── 2. Provider-Interface ───────────────────────────────────────
// Jeder konkrete Provider MUSS diese Methoden implementieren.
class RezeptProvider {
  async leseECard(/* leserId */)        { throw new Error('not implemented'); }
  async holeRezepte(/* svNummer */)     { throw new Error('not implemented'); }
  async markiereEingeloest(/* id */)    { throw new Error('not implemented'); }
  istVerfuegbar()                       { return false; } // TI-Status
}

// ── 3. Mock-Provider (Reifegrad 🟡) ─────────────────────────────
// Simuliert e-Card-Lesung + Rezept-Abruf. Klar als Simulation erkennbar.
class MockRezeptProvider extends RezeptProvider {
  constructor() {
    super();
    this._verfuegbar = true; // simuliert TI-Erreichbarkeit
  }

  // e-Card ist eine Smartcard (PC/SC) – im Browser nicht lesbar.
  // Real: nativer GINA-Client + zertifizierter Kartenleser.
  async leseECard() {
    await this._delay(400);
    if (!this._verfuegbar) throw new Error('TI nicht erreichbar');
    return {
      svNummer: '1234010180',            // Demo-SV-Nummer (fiktiv)
      name: 'Maria Musterpatientin',
      geburtsdatum: '1980-01-01',
      _simuliert: true,
    };
  }

  async holeRezepte(svNummer) {
    await this._delay(600);
    if (!this._verfuegbar) throw new Error('TI nicht erreichbar');
    return [
      {
        id: 'RZ-2026-0001',
        svNummer,
        medikament: 'Amoxicillin Genericon 1000 mg',
        menge: '1 Packung (20 Stk)',
        arzt: 'Dr. Weber, Wien',
        ausgestellt: '2026-07-03',
        status: REZEPT_STATES.EMPFANGEN,
        audit: [],
        _simuliert: true,
      },
      {
        id: 'RZ-2026-0002',
        svNummer,
        medikament: 'Ramipril 5 mg',
        menge: '1 Packung (30 Stk)',
        arzt: 'Dr. Weber, Wien',
        ausgestellt: '2026-07-03',
        status: REZEPT_STATES.EMPFANGEN,
        audit: [],
        _simuliert: true,
      },
    ];
  }

  async markiereEingeloest(id) {
    await this._delay(300);
    return { id, quittung: 'MOCK-' + id, ts: new Date().toISOString() };
  }

  istVerfuegbar() { return this._verfuegbar; }

  // Test-Helfer: TI-Ausfall simulieren (für Notfall-Modus-Demo)
  _setzeTiStatus(v) { this._verfuegbar = v; }
  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ── 4. Platzhalter für den ECHTEN Provider (Reifegrad 🔴) ────────
// Wird erst nach SV-Peering-Zertifizierung implementiert.
// class SvPeeringProvider extends RezeptProvider { … mTLS, GINA, PC/SC … }

// ── 5. Orchestrator (Business-Logik, quellenunabhängig) ─────────
class RezeptService {
  constructor(provider) {
    this.provider = provider || new MockRezeptProvider();
  }

  async patientEinlesen() {
    const patient = await this.provider.leseECard();
    const rezepte = await this.provider.holeRezepte(patient.svNummer);
    return { patient, rezepte };
  }

  bearbeitungStarten(rezept, akteur) { return uebergang(rezept, REZEPT_STATES.IN_BEARBEITUNG, akteur); }
  abgeben(rezept, akteur)            { return uebergang(rezept, REZEPT_STATES.ABGEGEBEN, akteur); }
  abrechnen(rezept, akteur)          { return uebergang(rezept, REZEPT_STATES.ABGERECHNET, akteur); }
  stornieren(rezept, akteur)         { return uebergang(rezept, REZEPT_STATES.STORNIERT, akteur); }

  // Notfall-Modus: bei TI-Ausfall → Papier-Workflow in 2 Klicks
  notfallModusAktiv() { return !this.provider.istVerfuegbar(); }
}

module.exports = {
  REZEPT_STATES,
  ERLAUBTE_UEBERGAENGE,
  RezeptStateError,
  uebergang,
  RezeptProvider,
  MockRezeptProvider,
  RezeptService,
};
