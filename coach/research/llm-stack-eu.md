# LLM-/Daten-Stack — EU-Residency (Research zu D-006)

**Rollen:** AI/Agent-Engineer `<agent>` + Compliance `<compliance>` · **Datum:** 2026-06-06
**Bias-Disclosure (P-002):** Mein Default-Reflex (Anthropic-API direkt) ist **nicht** EU-resident —
bewusst gegen den Markt geprüft.

## Randbedingung
DSGVO + **EU AI Act (volle Wirkung 02.08.2026)** für ein Gesundheits-nahes Produkt → EU-Residency ist
**Pflicht**: Inferenz + Storage + Backups in der EU, **kein** Zugriff von außerhalb (auch nicht Support).

## EU-residente Optionen (Stand 06/2026)
| Anbieter | EU-Residency | Anmerkung |
|---|---|---|
| **Mistral** (FR, EU-nativ) | ✅ standardmäßig | einfachste Souveränität, gutes Preis-Leistung |
| **Claude @ AWS Bedrock Frankfurt** (eu-central-1) | ✅ | Claude-Qualität + Residency; **direkte Anthropic-API = ❌** |
| **OpenAI EU** | ✅ (seit 2025, erweitert 05/2026) | Enterprise/API konfigurierbar |
| **Aleph Alpha** (DE) | ✅ EU-only | Übernahme durch Cohere (CA) angekündigt 04/2026 → Unsicherheit |
| **Open-Weights self-hosted** | ✅ max. | volle Kontrolle, höchster Ops-Aufwand |

## Architektur-Hebel
Fakten sind **deterministisch + quellenbelegt**; das LLM *formuliert* nur → Modell-Stärke zweitrangig,
Halluzinationsrisiko niedrig. → **Souveränität/Kosten dürfen über rohe Power gewinnen.**

## Entscheidung (D-006)
1. **Hartes Prinzip: nur EU-resident.**
2. **Provider-agnostische LLM-Schicht** jetzt (`assistant/src/llm/`), Vendor beim Pilot.
3. **DB:** Postgres + `pgvector`, EU-Region (Frankfurt), managed, hinter Repository-Seam.

> Quellen: [OpenAI – EU data residency](https://openai.com/index/introducing-data-residency-in-europe/) ·
> [Claude EU-Hosting (Bedrock/Vertex)](https://compound.law/en-DE/tools/claude-eu-hosting/) ·
> [EU data residency für KI — Anbieter](https://www.mateit.de/en/blog/dsgvo-ki-eu-hosting/) ·
> [Sovereign-AI-Plattformen EU 2026](https://vstorm.co/agentic-ai/ai-platforms/top-5-sovereign-ai-platforms-in-europe-ranked-by-compliance-regional-fit-and-data-control/)
