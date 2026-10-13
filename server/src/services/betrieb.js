// ============================================================================
//  Betriebs-Cockpit: Wie läuft das Geschäft, liefern die Daten?
// ============================================================================
//  Für den Owner oben im Redaktions-Dashboard. NUR Summen — keine Namen,
//  keine E-Mail-Adressen, keine einzelnen Zahlungen. Wer mehr braucht, sieht
//  die Prüfliste (Zahlungen) und die Datenquellen-Seite (Quellen).
//
//  Eine reine Funktion über das, was die Dienste ohnehin führen — damit sie
//  ohne Server testbar ist und nichts davon doppelt gespeichert wird.
// ============================================================================

const TAG = 86400000;

export function betriebsZahlen({ konten = [], grants = [], aktiv = () => false, zahlungen = [], quellen = [], gemessen = {}, jetzt = Date.now() }) {
  const vor = (tage) => jetzt - tage * TAG;
  const ms = (iso) => Date.parse(iso || '') || 0;

  const premium = { aktiv: 0, unbefristet: 0, laeuft_ab_7: 0, abgelaufen_30: 0 };
  for (const g of grants) {
    const istAktiv = aktiv(g.userId);
    if (istAktiv) premium.aktiv++;
    if (!g.bis) { if (istAktiv) premium.unbefristet++; continue; }
    const bis = ms(g.bis);
    if (istAktiv && bis - jetzt <= 7 * TAG) premium.laeuft_ab_7++;
    if (!istAktiv && bis >= vor(30)) premium.abgelaufen_30++;
  }

  const summen = new Map();
  let anzahl = 0;
  for (const p of zahlungen) {
    if (p.status !== 'paid' || ms(p.paid_at || p.created_at) < vor(30)) continue;
    anzahl++;
    summen.set(p.currency || 'EUR', (summen.get(p.currency || 'EUR') || 0) + (Number(p.amount_cents) || 0));
  }

  // Quellen-Zustand aus dem letzten Abruf (coverage.alle()).
  const ergebnis = new Map();
  for (const [k, e] of Object.entries(gemessen || {})) {
    if (!k.startsWith('shortages:')) continue;
    for (const q of e.quellen || []) ergebnis.set(q.id, q);
  }
  const fehlerhaft = [];
  let liefern = 0; let offen = 0;
  for (const q of quellen) {
    const r = ergebnis.get(q.id);
    if (!r) offen++;
    else if (r.ok) liefern++;
    else fehlerhaft.push({ id: q.id, land: q.country, label: q.label || q.id, fehler: r.fehler || null });
  }

  return {
    konten: { gesamt: konten.length, neu_7: konten.filter((k) => ms(k.created_at) >= vor(7)).length },
    premium,
    einnahmen: { tage: 30, anzahl, summen: [...summen].map(([currency, cents]) => ({ currency, cents })), offen_pruefung: zahlungen.filter((p) => p.status === 'pending_review').length },
    quellen: { gesamt: quellen.length, liefern, offen, fehler: fehlerhaft.length, fehlerhaft },
  };
}
