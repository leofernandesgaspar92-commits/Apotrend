// Narrations-Schicht. Default = deterministisch (keine externen Calls).
// Die LLM-Schicht (D-006 offen) ist bewusst getrennt: sie formuliert die BEREITS gegroundeten Fakten
// natürlichsprachlich, OHNE neue Fakten zu erfinden — Quellen bleiben Pflicht.

const ICON = { kritisch: '🔴', hoch: '🟠', normal: '🔵', info: '🟡', niedrig: '⚪' };

export function renderBriefing(recs, meta = {}) {
  const out = [];
  out.push(`📋 Tagesbriefing — ${meta.apotheke_name ?? 'Apotheke'}  (Stand: ${meta.stand ?? '—'})`);
  out.push('='.repeat(72));
  if (!recs.length) {
    out.push('Keine Auffälligkeiten.');
    return out.join('\n');
  }
  for (const r of recs) {
    out.push('');
    out.push(`${ICON[r.schweregrad] ?? '•'} [${r.typ.toUpperCase()}] ${r.titel}`);
    out.push(`   ${r.details}`);
    out.push(`   Quellen: ${r.quellen.join(', ')}`);
  }
  out.push('');
  out.push('— Fakten deterministisch aus den Sample-Daten; jede Aussage ist quellenbelegt (D-012).');
  return out.join('\n');
}

// Platzhalter für die spätere LLM-Schicht (D-006). Bewusst nicht an einen Anbieter gebunden.
export async function narrateWithLLM(recs, llm) {
  if (!llm) {
    throw new Error('Kein LLM konfiguriert (D-006 offen) — nutze renderBriefing() deterministisch.');
  }
  // Vorgesehen: llm.complete({ fakten: recs, regel: "nur diese Fakten, jede Aussage mit Quelle" })
  return renderBriefing(recs);
}
