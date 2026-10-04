// Konto-/Teilnehmertyp-Register: WAS für ein Teilnehmer ein Konto im
// Gesundheitswesen ist — Apotheke, Pharma-Unternehmen, Behörde oder
// Privatnutzer:in. Das ist eine EIGENE Achse:
//   • Land       → Sichtbarkeit / Sprache / Währung (data/countries.js)
//   • Kontotyp    → Art des Teilnehmers (diese Datei)
//   • Team-Rolle  → interne RBAC innerhalb einer Org (domain/roles.js:
//                   admin/apotheker/pta/lehrling/pharmareferent)
// Bewusst getrennt benannt (account_type statt "role"), um die bestehende
// Team-RBAC in domain/roles.js NICHT zu überladen.
//
// WICHTIG: nur Stammdaten. KEINE Rechte-Durchsetzung — die ist ein bewusst
// getrennter, abgestimmter Folgeschritt. Labels werden im Frontend per i18n
// übersetzt.

export const ACCOUNT_TYPES = {
  pharmacy:  { key: 'pharmacy',  icon: '🏥', label: 'Apotheke' },
  pharma:    { key: 'pharma',    icon: '🏭', label: 'Pharma-Unternehmen' },
  // Grosshandel und Logistik: eigene Teilnehmergruppen, nicht Unterarten der
  // Apotheke. Sie brauchen eine eigene VERIFIZIERUNGSSTUFE, weil daran die
  // Rx-Schranke haengt (domain/jurisdiction.js): Ein Grosshaendler ist
  // erwerbsberechtigt, ein Logistiker befoerdert nur — er erwirbt nicht.
  // Beides unter „pharma" zu fuehren haette diesen Unterschied geloescht.
  wholesale: { key: 'wholesale', icon: '🚚', label: 'Großhandel' },
  logistics: { key: 'logistics', icon: '📦', label: 'Logistik / Transport' },
  authority: { key: 'authority', icon: '🏛️', label: 'Behörde' },
  private:   { key: 'private',   icon: '👤', label: 'Privatnutzer:in' },
};

// Standardtyp: Apotheke — passt zur bisherigen Zielgruppe und hält bestehende
// Profile (ohne account_type-Feld) rückwärtskompatibel.
export const DEFAULT_ACCOUNT_TYPE = 'pharmacy';

// Gültiger Kontotyp-Schlüssel? (Kleinschreibung normalisiert.)
export function isValidAccountType(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(ACCOUNT_TYPES, key.toLowerCase());
}

// Kontotyp normalisieren mit Fallback auf den Standardtyp.
export function normalizeAccountType(key) {
  return isValidAccountType(key) ? key.toLowerCase() : DEFAULT_ACCOUNT_TYPE;
}

// Öffentliche Liste fürs Frontend (stabile Reihenfolge = Einfügereihenfolge).
export function listAccountTypes() {
  return Object.values(ACCOUNT_TYPES).map((a) => ({ ...a }));
}
