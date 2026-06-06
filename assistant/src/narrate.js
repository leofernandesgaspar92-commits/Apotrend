// Narrations-Schicht. Default = deterministisch (kein Anbieter nötig, keine externen Calls).
// Optionale LLM-Schicht (D-006): formuliert die BEREITS gegroundeten Fakten natürlichsprachlich,
// OHNE neue Fakten zu erfinden — Quellen bleiben Pflicht. Nur EU-resident (LlmClient.assertEuResident).

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
  out.push('— Fakten deterministisch aus den Daten; jede Aussage ist quellenbelegt (D-012).');
  return out.join('\n');
}

// Erzeugt das Briefing. Ohne `llm` → deterministisch. Mit `llm` (EU-resident) → natürlichsprachlich,
// aber faktengebunden (das LLM bekommt nur die fertigen Fakten + die Regel "nichts erfinden").
export async function narrateBriefing(recs, meta = {}, { llm } = {}) {
  if (!llm) return renderBriefing(recs, meta);
  llm.assertEuResident?.();
  const fakten = recs
    .map((r) => `- [${r.typ}/${r.schweregrad}] ${r.titel}: ${r.details} (Quellen: ${r.quellen.join(', ')})`)
    .join('\n');
  const system =
    'Du formulierst ein Apotheken-Tagesbriefing. Nutze AUSSCHLIESSLICH die gelieferten Fakten. ' +
    'Erfinde nichts dazu. Behalte jede Quellenangabe bei. Kurz, sachlich, handlungsorientiert.';
  return llm.complete({ system, prompt: `Fakten:\n${fakten}` });
}
