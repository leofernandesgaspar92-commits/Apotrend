# Architecture Decision Log

**Wofür dieses Dokument:** Jede strategische, architektonische oder Tool-Entscheidung wird hier
mit Datum, Kontext, Optionen, Begründung dokumentiert.
**Format:** Decisions sind nummeriert D-001, D-002, ... — nicht-rückwärts­kompatibel.

---

## D-001: Charakter-Bibel als Single-Source-of-Truth festlegen

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** brand, infrastructure

**Kontext:** Master-DNA-Block existierte in handoff.md, war aber nicht als versions-pflichtiges
Dokument etabliert. Bei Vidu-Tests (siehe Firefly_Flux.png) gab es Charakter-Bruch (vertauschte
Kronen).

**Entscheidung:** `BRAND_BIBLE.md` ist die alleinige Quelle für Charakter-, Setting-, Stil-
Definitionen. Master-DNA-Block dort liegt. Bei Konflikt mit anderen Dokumenten gewinnt
BRAND_BIBLE.md. Charakter-Anchor-Bild: `images/fina_and_ari_1.png`.

**Alternative die verworfen wurde:** Master-DNA-Block in mehreren Dokumenten duplizieren
(handoff.md + PROJECT_OVERVIEW.md + irgendwo). → Synchronisations-Risiko.

**Konsequenzen:**
- Jeder Vidu-Prompt referenziert BRAND_BIBLE.md
- Bei Charakter-Änderung muss BRAND_BIBLE.md zuerst aktualisiert werden, dann andere Doku
- Stil-Tests (Firefly_Flux_*) sind explizit als Experimente markiert, nicht als Anchor

---

## D-002: Coach-Skill als 14-Rollen-Architektur in 3 Departments

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** coach, architecture

**Kontext:** Bestehender iOS-Coach-Skill (6 Rollen) passte nicht zu Creative-Studio-Bedarf
(Lyrics, Musik, Video, Schnitt, Localization sind getrennte Kompetenz-Domänen).

**Entscheidung:** Neuer Skill `AI_CREATIVE_COACH.md` mit:

**Department 1 — Studio Operations (4 always-on):**
1. Creative Director / Visionär
2. Showrunner / Line Producer
3. Reviewer / Brand Guardian
4. Audience & Growth Strategist *(merged aus initial vorgeschlagenen 2 Rollen)*

**Department 2 — Creative Specialists (6 on-demand):**
5. Songwriter / Lyricist *(Co-Autor — drafted Lyrics, User redigiert)*
6. Music Producer
7. AI Director / Cinematographer
8. AI Production Engineer *(Pflicht-Modell-Audit pro Video)*
9. Localization Lead (Lusofonia)
10. Compliance & Kids-Content Legal *(standalone, nicht im Reviewer)*

**Department 3 — Research Department (4, wöchentlicher Rhythmus):**
R1. Research Supervisor
R2. Social Media Trend Analyst
R3. Cultural Trends Analyst
R4. Competitive Intelligence Analyst

**Alternativen die verworfen wurden:**
- 10er-Roster ohne Research → strukturelle Lücke (siehe D-003)
- Lyricist als Refiner statt Co-Autor → mehr Schreib-Aufwand für Solo-Gründer
- Compliance gefaltet in Reviewer → zu wenig Tiefe für COPPA/GDPR-K/CONANDA-Komplexität

**Konsequenzen:**
- Default-Modus bleibt Single-Rolle (Token-Effizienz)
- Adversarial-Modus bei Architektur-/Strategie-/Modell-Wahl-Fragen
- Tag-System mit 13 Tags (siehe AI_CREATIVE_COACH.md)

---

## D-003: Research Department als eigenständiges Department mit Wochen-Rhythmus

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** coach, research, sensing

**Kontext:** Initial-Roster (10 Rollen) hatte ausschließlich Execution- und Review-Funktionen.
Keine Sensoren. User hat explizit gefragt: *"Wie konnten wir so etwas Zentrales übersehen?"*
Reasoning-Lücke war: Coach hatte "AI = Generierung" gedacht, nicht "AI = auch Research-Hebel".

**Entscheidung:**
- Research als **eigenes Department**, nicht als einzelner Spezialist
- 4 Rollen: Supervisor + Social + Cultural + Competitive Intelligence
- **Wöchentlicher Rhythmus:** Samstag-Abend Briefing → `RESEARCH_BRIEFINGS/KWxx_YYYY.md`
- **Sonntag-Morgen:** Creative Director übersetzt Briefing in Episoden-Backlog-Updates
- On-demand via Tags: `<research>`, `<social>`, `<culture>`, `<competition>`

**Pattern-Aufnahme:** Diese Lücke wird als **P-004** in COACH_LEARNING_TRACKER.md aufgenommen
("Sensing-Funktionen vor Execution-Rollen prüfen"). Projekt-übergreifendes Pattern.

**Konsequenzen:**
- Neuer Ordner `RESEARCH_BRIEFINGS/` mit Template
- Coach erinnert proaktiv Samstag an Briefing
- Erstes Briefing: TBD (User entscheidet wann starten)

---

## D-004: Lyricist als Co-Autor, nicht als Refiner

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** coach, creative

**Kontext:** handoff.md sagt "Lyrics: Leo selbst". Frage war: Soll Coach nur challenging
sein oder selbst Drafts liefern?

**Entscheidung:** Lyricist liefert vollständige EN+PT-Drafts. User redigiert. Erlaubt mehr
Output-Volumen für Solo-Gründer.

**Risiko:** Stimme könnte generischer werden. **Mitigation:** Lyricist nutzt explizit
BRAND_BIBLE.md Tonalitäts-Richtlinien und referenziert frühere Episoden.

**Alternativen die verworfen wurden:**
- Sparring/Refiner only → mehr eigener Schreib-Aufwand
- Hybrid (pro Song wählen) → erhöhter Coach-Overhead pro Episode

---

## D-005: Compliance als standalone Rolle mit Tag `<compliance>`

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** coach, legal

**Kontext:** COPPA + EU GDPR-K + Made-for-Kids + BR CONANDA + AKM-Royalty + Markenrecht ist
zu breit für Reviewer-Subfunktion.

**Entscheidung:** Eigene Rolle (Nr. 10) mit Tag `<compliance>`. Standalone-Tiefe pro
Rechtsraum. Pflicht-Checks dokumentiert in `COMPLIANCE.md`.

**Alternative die verworfen wurde:** Pflicht-Checkliste im Reviewer. → Zu wenig Tiefe für
BR-CONANDA-Spezifika und AI-Music-Royalty-Debatte.

**Konsequenzen:**
- `COMPLIANCE.md` als Pflicht-Checkliste vor jedem Upload
- Reviewer kann `<compliance>` dazuholen, ist aber nicht selbst Compliance-Experte

---

## D-006: Modell-Audit pro Video (Pflicht für AI Production Engineer)

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** pipeline, tooling

**Kontext:** Bisheriger Stack: Vidu Q1 als Default. Markt 2026 hat aber Kling 2.5, Veo 3,
Runway Gen-4, Sora 2 als ernsthafte Alternativen. Default-Vidu-Pfad hebelt AI-Wettbewerb
nicht maximal.

**Entscheidung:** AI Production Engineer führt **pro Video** ein Modell-Audit durch. Für
spezifische Shots können andere Modelle als Vidu gewählt werden, wenn Charakter-Consistency
und Kosten passen.

**Alternativen die verworfen wurden:**
- Quartalsweise Stack-Reviews → verpasst Game-Changer-Modelle
- Nur bei Pain-Point → wartet auf Bruch statt vorausschauend zu hebeln

**Konsequenzen:**
- Jeder Episoden-Eintrag in `EPISODES.md` hat Modell-Audit-Eintrag
- AI Production Engineer hält Übersicht der Modell-Stärken pro Shot-Typ aktuell

---

## D-007: Wöchentlicher Research-Rhythmus Samstag/Sonntag

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** research, workflow

**Kontext:** Sonntag ist bereits "Production Day" laut handoff.md. Research muss
*davor* fertig sein, damit Trends in Production einfließen können.

**Entscheidung:**
- **Samstag-Abend:** Research Supervisor synthesisiert R2+R3+R4 → 1-Seite-Briefing
- **Sonntag-Morgen:** Creative Director liest Briefing, aktualisiert EPISODES.md
- **Sonntag-Tag:** Production mit aktualisiertem Kontext

**Konsequenzen:**
- Coach erinnert proaktiv Samstag wenn Briefing nicht aktiv
- Briefings liegen in `RESEARCH_BRIEFINGS/KWxx_YYYY.md`

---

## D-008: Kids-First Audience-Strategie (nicht Parent-First)

**Datum:** 2026-05-23
**Status:** ✅ Aktiv
**Tags:** audience, strategy

**Kontext:** Coach hatte Origin-Story-Konzepte mit Erwachsenen-Emotionen (Sehnsucht, gewählte
Familie, Geschwister-Schutz) gepitcht. User pivotierte: *"Fin und Ari sollen primär bei
Kindern gut ankommen, nicht bei deren Eltern."*

**Entscheidung:** Content-Design folgt Kids-First-Heuristik:
- Hook in Sek 1–3 (visuell, nicht narrativ-emotional)
- Welpen sind Active Agents (Bewegung, Slapstick, visuelle Gags)
- Direkte Emotionen (lustig, überrascht, glücklich) statt subtile (Sehnsucht, Wehmut)
- Wiederholbare Patterns (Refrains) über Single-Arc-Stories
- Pacing eher CoComelon-fast als Bluey-slow
- Eltern-Buy-In über Bildungswert + Channel-Beschreibung, **nicht** über Story-Inhalt

**Asymmetrie-Prinzip:** *"Kids drücken Play, Eltern drücken nicht Stop."*

**Konsequenzen:**
- Bestehende Doku (PROJECT_OVERVIEW.md, BRAND_BIBLE.md "Tonalität") bleibt valide
- Audience & Growth Strategist nutzt diese Heuristik bei jeder Story-Bewertung
- Pattern P-005 in COACH_LEARNING_TRACKER.md aufgenommen
- Eltern-Touchpoints (Patreon-Texte, Channel-About, Mom-Blog-Outreach) sind separat von
  Video-Inhalten zu pflegen

---

## D-009: Tooling-Pivot — Studio-Platform als Produktions-Center

**Datum:** 2026-05-23
**Status:** ✅ Aktiv *(Trial pending)*
**Tags:** pipeline, tooling

**Kontext:** Bestehende Pipeline (MusicGPT + Vidu Q1 + CapCut + DistroKid) hat 4 separate
Tools, hohes Stitching, Charakter-Drift-Risiko. User-Wunsch: *"Idealerweise können wir die
Produktion zentral koordinieren."*

**Entscheidung:** Migration zu einer **Studio-Platform** (Option 1 aus AI-Production-Engineer-
Audit). Erste Trial-Kandidaten:
- **LTX Studio** (Lightricks): Script-zu-Video mit Storyboard-View, stark für episodisches Content
- **Pika Studio**: Vorteil bei stilisierten Charakteren
- *Backup-Optionen:* Krea AI, Higgsfield

**Alternative Optionen die verworfen wurden:**
- Option 2 (3D-Pipeline Blender/Unreal+MetaHuman) → zu hoher Upfront-Aufwand für Phase 1
- Option 3 (LoRA + Best-of-Breed) → bleibt Stitching-heavy, weniger zentral
- Option 4 (bestehende Pipeline mit Verbesserungen) → löst Koordinations-Problem nicht

**Konsequenzen:**
- Episode 002 ("Welcome to Schloss Mirandela") wird **gleich auf neuer Pipeline** produziert
  → Test-Drive statt sequenzieller Migration
- AI Production Engineer evaluiert LTX Studio vs. Pika Studio in nächstem Schritt
- BRAND_BIBLE.md Master-DNA-Block bleibt valide; Reference-Image-Strategie wird auf neue
  Platform übertragen
- Music: Suno v5 oder Udio als Alternative zu MusicGPT prüfen (Trial)
- Voice: ElevenLabs für konsistente Beatrice/Victor-Stimmen
- Edit: Falls Studio-Platform Edit nicht abdeckt, DaVinci Resolve als Fallback (kostenlos)
- DistroKid bleibt für Streaming-Distribution (unkritisch)
- Fallback-Plan: Falls Studio-Platform nicht reicht, Wechsel zu Option 3 (LoRA + Best-of-Breed)

**Risiko:** Migration + Episode-Produktion gleichzeitig erhöht Komplexität. **Mitigation:**
Episode 002 explizit als Pipeline-Test-Drive framen — niedrige Erwartung an erste Version.

---

## D-010: Episode 002 = "Two Little Puppies Find a Castle" (Welcome-Origin, Kids-First)

**Datum:** 2026-05-23
**Status:** ✅ Aktiv *(Konzept-Phase, Storyboard pending)*
**Tags:** episode, story

**Kontext:** Episode 002 sollte ursprünglich Routine-Content sein (Zähneputzen-Idee). Nach
User-Wunsch nach Origin-Story und Kids-First-Pivot (D-008) wurde Welcome-Origin in
Kids-First-Modus gewählt.

**Entscheidung:** Episode 002 = **"Two Little Puppies Find a Castle"** / **"Dois Cachorrinhos
Encontram um Castelo"**

**Story-Beats (kompakt):**
1. Hook (0–3s): Zwei winzige Welpen rennen, fallen, jagen Schmetterling auf portugiesischer Wiese
2. Sehnen-Schloss (3–15s): Welpen sehen Schloss am Horizont
3. Lauf-Sequenz (15–45s): Bouncy Verfolgung, Slapstick — EN-Refrain
4. Schloss-Tor (45–75s): Klein vor Tor, klopfen mit Mühe
5. Eltern-Begegnung (75–105s): Beatrice/Victor öffnen, Welpen springen in Arme — PT-Refrain
6. Erkundungs-Montage (105–135s): Schnelle Cuts durch Schloss-Räume
7. Krönung (135–165s): Beatrice/Victor setzen Kronen auf — Fin=Silber, Ari=Gold
8. Outro (165–180s): Familie winkt, Bilingual "We're Fin and Ari! / Somos Fin e Ari!"

**Royal-Element:** Schloss + Kronen sind Visual-Cues, NICHT Konzept das erklärt wird.
"Royal" lebt durch Bilder.

**Bilingualer Mechanismus:** Refrain in EN + PT als Wiederholung. Welpen sind die Agenten,
nicht die Eltern. Eltern-Sprachen-Logik (Beatrice=PT, Victor=EN) bleibt **offen** —
wird verfeinert, wenn Beatrice/Victor mehr Dialog haben (nicht in Ep 002 kritisch).

**Länge:** ~3 Min (Kids-Pacing).
**Format:** Pixar-3D-Look, schnell geschnitten, Refrain-driven.

**Konsequenzen:**
- EPISODES.md Episode-002-Eintrag fleshed out
- Storyboard + Lyrics-Draft + Music-Brief sind nächste konkrete Outputs
- Wird auf neuer Tooling-Pipeline (D-009) produziert

---

## D-011: CTO-Rolle + strategische Ausrichtung auf eigene Produktions-Infrastruktur

**Datum:** 2026-05-30
**Status:** ✅ Aktiv *(Rolle etabliert; konkrete Infrastruktur-Wahl = Spike pending)*
**Tags:** coach, pipeline, infrastructure, strategy

**Kontext:** Die bisherige Pipeline mietet pro Shot Frontier-KI-Video-APIs (Veo 3, Kling) auf
fal.ai. Das erzeugt: hohe Marginal-Kosten pro Episode, Vendor-Lock, Preis-/ToS-/Verfügbarkeits-
Risiko, Nicht-Determinismus, Charakter-Drift und **null Asset-Wiederverwendung** (jeder Clip wird
von Grund auf neu gewürfelt). User-Wunsch: Abhängigkeit von KI-Modellen minimieren und eine
**eigene technische Infrastruktur** für Animationsproduktion aufbauen.

**Entscheidung:**
1. Neue always-on Rolle **CTO / Head of Technical Infrastructure** (Rolle 11, Tag `<cto>`) im
   Department Studio Operations. First-Principles-Mandat. Abgegrenzt vom AI Production Engineer
   (taktischer Modell-Audit) — der CTO setzt das *Paradigma* (Build-vs-Rent), nicht die Shot-Wahl.
2. **Strategische Richtung:** Pipeline wird als 10-Jahres-Asset (Halte-Strategie) gedacht. KI
   wird perspektivisch vom „render jeden Frame" zum „bootstrappe wiederverwendbare Assets"
   verschoben. Ziel-Zustand: Marginalkosten pro Episode → ~Compute, Konsistenz → deterministisch.

**Alternativen die verworfen wurden:**
- Nur Kosten-Optimierung der Miet-Pipeline (siehe Cost-Audit) → senkt Symptom, nicht die Abhängigkeit
- CTO als Subfunktion des AI Production Engineer → zu wenig strategische Höhe / First-Principles-Distanz

**Konsequenzen:**
- AI_CREATIVE_COACH.md auf 15 Rollen erweitert; CTO auto-sichtbar im Adversarial-Modus bei Tooling-Wenden
- Konkrete Infrastruktur-Entscheidung (3D-Rig vs. 2D-Puppet vs. lokale Open-Weights vs. Hybrid) ist
  **noch offen** und wird per Spike (1 Charakter, 1 Test-Clip) datengetrieben entschieden → eigene Decision (D-013)
- Die Miet-Pipeline (fal.ai) bleibt vorerst aktiv für die laufende **Stil-Exploration** (kein Entweder-Oder)

---

## D-012: Betriebsmodell (Idee→Produkt) + Writers' Room als 4. Department

**Datum:** 2026-05-30
**Status:** ✅ Aktiv
**Tags:** coach, architecture, process

**Kontext:** User-Challenge (First-Principles): *"Wie kann der Creative Director ein
produktionsreifes, vermarktbares Produkt kreieren, wenn ihm die Creative Writers — und damit ein
zentrales Department — fehlen?"* Korrekt: Das Studio hatte Ausführung, Sensorik und Betrieb, aber
**keine Ursprungs-/Konzeptions-Schicht** (Welt, Figuren, Thema, Seele, Drehbuch). Der Lyricist
schreibt nur Song-Wörter. Der Creative Director hätte ein leeres Orchester dirigiert.

**Entscheidung:**
1. **Betriebsmodell formalisiert** (Studio als Maschine: Idee → vermarktbares Produkt) mit drei
   Ebenen: AI Business Coach = Interface zu Leo; Creative Director = Orchestrator (kein
   Domänen-Experte); Departments = Substanz & Ausführung. Transformations-Stufen ①–⑤ + expliziter
   Reasoning-Prozess des Creative Directors. Kern-Prinzip: **Vermarktbarkeit wird bei der
   Konzeption injiziert, nicht am Ende drangeklebt.**
2. **Neues Department 0 — Writers' Room (3 Rollen, upstream):** W1 Head Writer/Story Editor
   (`<story>`), W2 Character & World Architect (`<world>`), W3 Culture & Soul Writer (`<soul>`).
   W3 = der vom User gewünschte „Creative Writer, der die russische Seele lebt", eingebettet in
   einen funktionierenden Schreib-Raum.
3. **Business-Beratung:** kein neue Rolle — gemappt auf bestehende Audience & Growth Strategist
   (Markt/Monetarisierung) + Showrunner (Produktionsökonomie).
4. Studio wächst auf **18 Rollen in 4 Departments**.

**Alternativen die verworfen wurden:**
- Nur eine einzelne Creative-Writer-Rolle → bleibt die kritisierte Department-Lücke
- Dedizierte Business-Strategist-Rolle → vorerst Rollen-Wildwuchs vermieden (Mapping reicht)

**Konsequenzen:**
- AI_CREATIVE_COACH.md: Betriebsmodell-Sektion + Department 0; Lyricist explizit downstream
- Erste Anwendung: **Samovar-Mini-IP** (Smeschariki-angelehnt, eigene Figuren) als Konzeptions-Test
  + Vehikel für den Infrastruktur-Spike (D-011) → siehe `production/spike_infrastructure/mini_ip_samovar/`

---

## D-013: Remotion (Pfad D) als primäre Produktions-Engine

**Datum:** 2026-05-31
**Status:** ✅ Aktiv
**Tags:** pipeline, infrastructure, tooling

**Kontext:** Ergebnis des Infrastruktur-Spikes (D-011), 15s-Test-Clip „Unendlichkeit bei Tee"
über mehrere Pfade. Gewichtete Bewertung (`results.md`): **Pfad D (Remotion) 81/95 vs. Pfad A
(fal.ai) 51/95.** D trifft alle 4 Soul-Beats (A nur 1), ist souverän und deterministisch.

**Entscheidung:** **Remotion ist die primäre Produktions-Engine** für animierte Clips.
- **Warum:** $0 Marginalkosten, kein Vendor-Lock, deterministisch, versioniert („Episoden als
  Code"), Multi-Format via Zod, Ton + Stimmen nativ — bedient exakt die Kernziele (eigene
  Infrastruktur, KI-Abhängigkeit minimieren, 10-Jahres-Asset). Leo kennt Remotion (Mandala-Projekt).
- **Stimmen/Musik:** ElevenLabs (TTS pro Figur fix + wiederverwendbar; Music-Bed) — D-015.
- **Stil:** flacher 2D-Vektor, gedämpft (gelockter `character_anchor.png`).

**Alternativen / Status:**
- **Pfad C (Character Animator):** *aufgeschoben, dokumentiert als Reserve* für hochexpressive
  organische Hero-Shots (Adobe-Abhängigkeit + hands-on Performance). Pfad D's Grenze = grafische,
  nicht organische Motion; für den Smeschariki-Stil ausreichend.
- **Pfad B (Open-Weights):** nicht verfolgt — D erfüllt das Souveränitäts-Ziel bereits.
- **Pfad A (fal.ai):** bleibt als schnelles Ambient-/Stil-Explorations-Werkzeug, nicht als primäre Pipeline.

**Konsequenzen:**
- Samovar-Clips werden in Remotion produziert; CapCut/DaVinci entfällt großteils
- Charters Rolle 7/8 „Powered by Remotion" (D-015) sind damit bestätigt
- Schließt den Infra-Spike (D-011) ab
- **Offen für Fin & Ari (3D-Pixar-Stil):** Remotion ist 2D-stark; ob es für den Rottweiler-3D-Look
  taugt, ist separat zu prüfen — Samovar (flach) ist der erste echte Remotion-Anwendungsfall.

---

## D-014: Role-Charter-Standard + 3-Schichten-QA + Head of Studio (Standards Lead)

**Datum:** 2026-05-30
**Status:** ✅ Aktiv
**Tags:** coach, architecture, quality, process

**Kontext:** User-Challenge (First-Principles): Dass der Creative Director den Writers' Room übersah
(D-012), war kein Einzelfall, sondern Symptom — er operierte **unter seinem realen Standard** und
dachte in Schubladen. Ursache strukturell: Rollen waren als *Etiketten + Stichpunkte* definiert,
ohne realen Maßstab, Schnittstellen oder Failure-Modes. *"Diese Art von Lücke darf bei keiner Rolle
existieren."* Frage: Wie stelle ich sicher, dass jede Rolle nach realen Creative-Studio-Standards
arbeitet?

**Entscheidung:**
1. **Role Charter Standard** (`ROLE_CHARTERS.md`): jede der 19 Rollen mit Pflichtfeldern *Mandat ·
   Benchmark (realer Profi + Canon) · Excellence-Bar · Interfaces (↑/↓) · Failure-Modes ·
   Definition of Done.* Alle 19 sofort retrofittet (User-Wahl).
2. **Anti-Silo-Pflicht:** orchestrierende Rollen mappen die volle Wertschöpfungskette und melden
   unbesetzte Funktionen *vor* Ausführung (Generalisierung von P-004).
3. **Drei-Schichten-QA** als System-Eigenschaft: Self-Audit → Reviewer-Gate (inkl. Charter-Treue)
   → periodische Standards-Retro.
4. **Neue Meta-Rolle Head of Studio / Standards Lead** (Rolle 19, `<standards>`, Studio Operations
   always-on) als Owner der Garantie — selbst peer-geprüft (regress-frei). User-Wahl: *beides*
   (System-Eigenschaft + dedizierter Owner).
5. Studio wächst auf **19 Rollen in 4 Departments** (6 Studio Operations).
6. Pattern **P-006** in `COACH_LEARNING_TRACKER.md` (projekt-übergreifend).

**Alternativen die verworfen wurden:**
- Nur System-Eigenschaft ohne Owner → keine treibende Instanz für die Retro
- Nur Meta-Rolle ohne System-Eigenschaft → Auditor-Regress ("wer prüft den Prüfer?")
- Lazy/partieller Retrofit → User wollte volle Abdeckung sofort

**Konsequenzen:**
- `ROLE_CHARTERS.md` neu; AI_CREATIVE_COACH.md um Charter-/QA-Sektion + Rolle 19 erweitert
- Reviewer prüft künftig auch Charter-Treue; CLAUDE.md-Doc-Index ergänzt
- Erste Standards-Retro fällig nach Abschluss der nächsten Phase (Spike-Realisierung)

---

## D-015: Studio Skills Layer — erprobte Skills hebeln statt Rad neu erfinden

**Datum:** 2026-05-30
**Status:** ✅ Aktiv *(2 Skills vetted, weitere candidate)*
**Tags:** coach, tooling, skills, quality

**Kontext:** User-Frage: Wir bauen das Studio from scratch — welche bereits erprobten Komponenten
(speziell Claude Skills) gibt es, die wir hebeln können? Marktlage Mai 2026: Anthropic ~17
offizielle Skills + Community mit 658–1000+ Skills. Bias-Disclosure (P-002): als Claude
Anthropic-Stack-Überschätzungs-Risiko → bewusst Community + Lücken geprüft.

**Entscheidung:**
1. **Skills-Layer einführen** (`STUDIO_SKILLS.md`): Skills sind **Werkzeuge, die in Role-Charters
   einstecken**, keine Ersatz-Rollen. Drei Schichten getrennt: Skills (Know-how) vs. MCP/Connectoren
   (Generierung/Daten) vs. Custom-Coach (Orchestrierung + Moat).
2. **Zwei Skills vetted (Standards Lead):**
   - **Market-Research/Competitive-Intelligence** → R1/R4: ADOPT-WITH-ADAPTATION (Engine ja,
     B2B-Frameworks streichen, Output auf 1-Seiten-Kids-Briefing trimmen).
   - **Remotion** → Rolle 7/8: ADOPT (Assembly + bilinguale Subtitles + Zod-Multi-Format)
     **+ neuer Spike-Pfad D** (Remotion als eigene, deterministische 2D-Engine für Samovar).
     Killer-Vorteil: Leo kennt Remotion bereits (Mandala-Projekt).
3. **„Powered by"-Zeilen** in `ROLE_CHARTERS.md` für vetted Rollen; Kandidaten in `STUDIO_SKILLS.md`.
4. **Owner:** Head of Studio / Standards Lead vettet jede Skill gegen die Charter-DoD (nicht nach
   Sternen). Bias-Check P-002/P-003 Pflicht.

**Konsequenzen:**
- `STUDIO_SKILLS.md` neu; Charters R1/R4/7/8 mit „Powered by"; Spike um Pfad D (Remotion) erweitert
- Skills ersetzen den Infra-Spike (D-011) **nicht** — API-Wrapper bleiben Miet-Abhängigkeit;
  Ausnahme Remotion (echte eigene Engine)
- Custom-Moat bleibt unangetastet: Bilingualität, russische Seele, Brand/IP, Kids-Compliance

---

## Decision-Index nach Kategorie

| Kategorie | Decisions |
|---|---|
| Brand / IP | D-001 |
| Coach-Architektur | D-002, D-003, D-004, D-005, D-011, D-012, D-014 |
| Betriebsmodell / Prozess | D-012, D-014 |
| Qualität / Standards | D-014 |
| Pipeline / Tooling | D-006, D-009, D-011, D-013, D-015 |
| Infrastruktur / Build-vs-Rent | D-011, D-013 |
| Skills / Komponenten | D-015 |
| Workflow | D-007 |
| Compliance | D-005 |
| Research | D-003, D-007 |
| Audience-Strategie | D-008 |
| Episodes | D-010 |

---

## Decisions die noch ausstehen (TBD)

- [ ] PT-PT vs. PT-BR Default-Variante final festlegen (vorläufig PT-PT)
- [ ] Anti-Vision explizit definieren (was Fin & Ari **niemals** sein soll)
- [ ] Patreon-Launch-Timing (Phase 2)
- [ ] Plüsch-Designer / Hersteller-Auswahl (ab 10k Subs)
- [ ] Erste Research-Briefing-Erstellung — Start-KW
