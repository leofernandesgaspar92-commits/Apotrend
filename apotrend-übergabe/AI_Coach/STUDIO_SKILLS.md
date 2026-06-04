# Studio Skills Layer — externe Komponenten, die Rollen bewaffnen

**Wofür:** Erprobte Claude-Skills / Tool-Connectoren, die *in* die Role-Charters einstecken —
keine Ersatz-Rollen. Ein Charter definiert *Standard + wie das Werkzeug geführt wird*; die Skill
liefert das erprobte Handwerk/Automation. Quelle: D-015. **Owner: Head of Studio / Standards Lead.**

## Drei Schichten (nicht verwechseln)
1. **Skills** = prozedurales Know-how (Storytelling, Market-Research, Remotion).
2. **MCP / Tool-Connectoren** = die eigentliche Generierung/Daten (ElevenLabs, Firecrawl, fal.ai).
3. **Custom-Coach + Pipeline** = Orchestrierung + IP-Differenzierung (unser Moat).

## Status-Legende
✅ **vetted** (geprüft, adoptieren) · 🟡 **candidate** (vielversprechend, ungeprüft) ·
🔒 **custom** (bewusst eigenbau — Moat) · ⛔ **pass** (nicht passend)

---

## Register

| Skill / Komponente | Ziel-Rolle(n) | Status | Verdikt / Anpassung | Quelle |
|---|---|---|---|---|
| **Market-Research / Competitive-Intelligence** | R1, R4 (stützt R2/R3) | ✅ vetted | Daten-/Synthese-Engine übernehmen; Output auf unser 1-Seiten-Kids-Briefing trimmen; B2B-Frameworks (TAM/Porter/BCG) streichen | mcpmarket / community |
| **Firecrawl** | R1–R4 | ✅ vetted | Scrape/Search/Crawl als Daten-Backend der Research-Skill | firecrawl.dev |
| **Remotion (best-practices)** | Rolle 7 (Director), Rolle 8 (Prod Eng) | ✅ vetted | Assembly + bilinguale Subtitles + Zod-Multi-Format (16:9/9:16/Shorts); **+ neuer Spike-Pfad D** als eigene 2D-Engine. Grenze: organisches Schauspiel | github.com/remotion-dev/skills |
| **ElevenLabs (music/TTS/voice)** | Rolle 6 (Music), Rolle 8 | 🟡 candidate | Musik + konsistente Beatrice/Victor-Stimmen; via Remotion-Voiceover integrierbar | digitalsamba toolkit |
| **acestep (music-gen)** | Rolle 6 (Music) | 🟡 candidate | Alternative/Backup zu ElevenLabs Music | digitalsamba toolkit |
| **Creative Storytelling** (3-Akt, Hero's Journey, Pixar Story Spine) | W1 | 🟡 candidate | Story-Handwerk; gegen W1-DoD prüfen | mcpmarket |
| **Scriptwriter** (episodisch, 9 Beats) | W1 | 🟡 candidate | Für Dialog/Drehbuch bei Skalierung | mcpmarket |
| **Marketing-Skills** (CRO/SEO/Analytics/Growth) | Rolle 4 (Audience & Growth) | 🟡 candidate | Go-to-Market-Mechanik (Titel/Thumbnail/SEO) | github/coreyhaines31 |
| **skill-creator / mcp-builder** | Rolle 11 (CTO), Rolle 19 (Standards) | 🟡 candidate | Eigene Skills/Connectoren bauen & warten | anthropics/skills |
| **Brand-Guidelines-Skill** | Rolle 3 (Reviewer) | 🟡 candidate | Mechanik ja — `BRAND_BIBLE.md` bleibt Quelle | anthropics/skills |
| **EN+PT-Bilingualität** | Rolle 5, Rolle 9 | 🔒 custom | USP — kein generischer Translation-Skill | — |
| **Russische Seele (W3)** | W3 | 🔒 custom | Differenzierer — eigenbau | — |
| **Kids-Compliance (COPPA/MFK/GDPR-K/CONANDA)** | Rolle 10 | 🔒 custom | Nische — `COMPLIANCE.md` bleibt Quelle | — |
| **Orchestrierung (Betriebsmodell)** | CD, Showrunner, Standards | 🔒 custom | unser Coach-Skill ist die Orchestrierung | — |

---

## Vetting-Prozess (Standards Lead)
1. Skill-Kandidat gegen die **Definition of Done** des Ziel-Charters prüfen (nicht nach Sternen).
2. Anpassungsbedarf notieren (Output-Format, irrelevante Teile streichen).
3. Status setzen, „Powered by"-Zeile ins Charter (`ROLE_CHARTERS.md`).
4. Bias-Check (P-002/P-003): keine Anthropic-/Hype-Default-Annahme.

## Wichtig
Musik/Video-„Skills" sind oft dünne API-Wrapper → sie **ersetzen den Infra-Spike (D-011) nicht**.
Die Build-vs-Rent-Frage des CTO bleibt. Remotion ist die Ausnahme: echte *eigene* Engine (Pfad D).
