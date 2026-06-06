// Decision-Engine — der Kern-Wert: verknüpft Bestand × Signale × Verfügbarkeit × Substitution
// zu quellenbelegten Empfehlungen. Deterministisch → keine Halluzination (Reviewer-DoD).
// Jede Empfehlung trägt `quellen` (welcher Datensatz die Aussage stützt).

const SEVERITY_ORDER = { kritisch: 0, hoch: 1, normal: 2, info: 3, niedrig: 4 };

export function bestOffer(angebote = []) {
  const lieferbar = angebote.filter((a) => a.lieferbar);
  if (!lieferbar.length) return null;
  return lieferbar.slice().sort((a, b) => a.aep_eur - b.aep_eur)[0];
}

export function daysUntil(dateStr, today) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - today) / 86400000);
}

export function buildRecommendations(data, today = new Date()) {
  const { signals, productByPzn, availByPzn, inventoryByPzn } = data;
  const recs = [];
  const engpassPzns = new Set(signals.signale.filter((s) => s.typ === 'engpass').map((s) => s.pzn));

  // 1. Rückrufe, die den EIGENEN Bestand treffen (kritisch)
  for (const sig of signals.signale.filter((s) => s.typ === 'rueckruf')) {
    const inv = inventoryByPzn.get(sig.pzn);
    if (!inv || (sig.charge && sig.charge !== inv.charge)) continue;
    const p = productByPzn.get(sig.pzn);
    recs.push({
      typ: 'rueckruf', schweregrad: 'kritisch', pzn: sig.pzn,
      titel: `Rückruf betrifft deinen Bestand: ${p?.name ?? sig.pzn}`,
      details: `Charge ${inv.charge} (${inv.bestand} Stk im Lager) — ${sig.text} Sofort aus dem Verkauf nehmen.`,
      quellen: [`signals:${sig.id}`, `inventory:${sig.pzn}`],
    });
  }

  // 2. Engpässe auf Eigenbestand → Substitut suchen + Verfügbarkeit prüfen
  for (const sig of signals.signale.filter((s) => s.typ === 'engpass')) {
    const inv = inventoryByPzn.get(sig.pzn);
    if (!inv) continue; // nicht bevorratet → Hinweis in Schritt 5
    const p = productByPzn.get(sig.pzn);
    const origOffer = bestOffer(availByPzn.get(sig.pzn));

    // Substitut: Signal-Empfehlung ODER gleicher ATC/Wirkstoff im Katalog
    let altPzn = sig.empfohlene_alternative_pzn;
    if (!altPzn && p?.atc) {
      altPzn = [...productByPzn.values()].find((x) => x.pzn !== p.pzn && x.atc === p.atc)?.pzn ?? null;
    }
    const alt = altPzn ? productByPzn.get(altPzn) : null;
    const altOffer = altPzn ? bestOffer(availByPzn.get(altPzn)) : null;

    const quellen = [`signals:${sig.id}`, `inventory:${sig.pzn}`, `availability:${sig.pzn}`];
    let details = `Engpass (${sig.schweregrad}), Eigenbestand ${inv.bestand}` +
      (inv.bestand < inv.min_bestand ? ` < Mindestbestand ${inv.min_bestand}` : '') +
      `. Original ${origOffer ? 'lieferbar' : 'beim Großhandel NICHT lieferbar'}.`;
    if (alt && altOffer) {
      details += ` Substitut ${alt.name} (PZN ${alt.pzn}, gleicher Wirkstoff) lieferbar bei ` +
        `${altOffer.grosshaendler} (AEP €${altOffer.aep_eur.toFixed(2)}, ~${altOffer.lieferzeit_min} Min).`;
      quellen.push(`products:${alt.pzn}`, `availability:${alt.pzn}`);
    } else if (alt) {
      details += ` Substitut ${alt.name} (PZN ${alt.pzn}) gelistet — Verfügbarkeit prüfen.`;
      quellen.push(`products:${alt.pzn}`);
    }
    recs.push({
      typ: 'engpass', schweregrad: origOffer ? 'normal' : 'hoch', pzn: sig.pzn,
      titel: `Engpass: ${p?.name ?? sig.pzn}`, details, quellen,
    });
  }

  // 3. Nachbestellung unter Mindestbestand (sofern nicht schon als Engpass behandelt)
  for (const inv of inventoryByPzn.values()) {
    if (inv.bestand >= inv.min_bestand || engpassPzns.has(inv.pzn)) continue;
    const p = productByPzn.get(inv.pzn);
    const offer = bestOffer(availByPzn.get(inv.pzn));
    const menge = Math.max(inv.max_bestand - inv.bestand, 0);
    recs.push({
      typ: 'nachbestellung', schweregrad: 'normal', pzn: inv.pzn,
      titel: `Nachbestellen: ${p?.name ?? inv.pzn}`,
      details: `Bestand ${inv.bestand} < Mindestbestand ${inv.min_bestand}. Vorschlag: ${menge} Stk` +
        (offer ? ` bei ${offer.grosshaendler} (günstigster AEP €${offer.aep_eur.toFixed(2)}).`
               : ` — derzeit kein Großhändler lieferbar.`),
      quellen: [`inventory:${inv.pzn}`, `availability:${inv.pzn}`],
    });
  }

  // 4. Überbestand / naher Verfall / Ladenhüter
  for (const inv of inventoryByPzn.values()) {
    const tage = daysUntil(inv.verfall, today);
    const ueber = inv.bestand > inv.max_bestand;
    const naherVerfall = tage !== null && tage <= 90;
    if (!ueber && !naherVerfall) continue;
    const p = productByPzn.get(inv.pzn);
    const gruende = [];
    if (ueber) gruende.push(`Überbestand (${inv.bestand} > Max ${inv.max_bestand})`);
    if (naherVerfall) gruende.push(`Verfall in ${tage} Tagen (${inv.verfall})`);
    if (inv.abverkauf_30d <= 1) gruende.push(`Ladenhüter (Abverkauf ${inv.abverkauf_30d}/30 T)`);
    recs.push({
      typ: 'ueberbestand', schweregrad: 'info', pzn: inv.pzn,
      titel: `Bestand prüfen: ${p?.name ?? inv.pzn}`,
      details: `${gruende.join('; ')}. Nicht nachbestellen; ggf. retournieren/abverkaufen.`,
      quellen: [`inventory:${inv.pzn}`],
    });
  }

  // 5. Engpass-Hinweis für NICHT bevorratete Artikel (Awareness)
  for (const sig of signals.signale.filter((s) => s.typ === 'engpass')) {
    if (inventoryByPzn.get(sig.pzn)) continue;
    const p = productByPzn.get(sig.pzn);
    const offer = bestOffer(availByPzn.get(sig.pzn));
    recs.push({
      typ: 'hinweis', schweregrad: 'niedrig', pzn: sig.pzn,
      titel: `Engpass (nicht bevorratet): ${p?.name ?? sig.pzn}`,
      details: `${sig.text}` + (offer ? ` Restmenge bei ${offer.grosshaendler}.` : ' Aktuell nirgends lieferbar.'),
      quellen: [`signals:${sig.id}`, `availability:${sig.pzn}`],
    });
  }

  return recs.sort((a, b) => SEVERITY_ORDER[a.schweregrad] - SEVERITY_ORDER[b.schweregrad]);
}

// Produktvergleich (Feature: Produktvergleiche)
export function compareProducts(data, pznA, pznB) {
  const a = data.productByPzn.get(pznA);
  const b = data.productByPzn.get(pznB);
  if (!a || !b) throw new Error(`PZN nicht gefunden: ${!a ? pznA : pznB}`);
  const offerA = bestOffer(data.availByPzn.get(pznA));
  const offerB = bestOffer(data.availByPzn.get(pznB));
  return {
    a, b, offerA, offerB,
    gleicherWirkstoff: !!a.wirkstoff && a.wirkstoff === b.wirkstoff,
    gleicherAtc: !!a.atc && a.atc === b.atc,
    guenstigerePzn: (offerA?.aep_eur ?? a.aep_eur) <= (offerB?.aep_eur ?? b.aep_eur) ? pznA : pznB,
  };
}
