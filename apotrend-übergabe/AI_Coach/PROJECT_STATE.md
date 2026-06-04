# Project State — Fin & Ari Creative Studio

**Letztes Update:** 2026-05-31
**Aktuelle Phase:** Phase 1 — Aufbau & Erste Videos (Studio-Architektur + Infrastruktur-Spike)

---

## Status-Snapshot

| Bereich | Status |
|---|---|
| **YouTube-Kanal** | ✅ Aktiv (FinandAri) |
| **Erste Episode** | ✅ Live: "Where Is My Welcome Cake" |
| **Streaming-Distribution** | ✅ Aktiv (Spotify, Apple Music, Amazon Music, Deezer via DistroKid) |
| **Social Media** | ✅ Instagram, TikTok, Facebook etabliert |
| **Charakter-DNA** | ✅ Konsistent (Master-DNA-Block, Anchor-Bild) |
| **Tech-Pipeline** | ✅ Funktioniert (MusicGPT + Vidu + CapCut + DistroKid) |
| **Coach-Infrastruktur** | ✅ **Neu aufgesetzt 2026-05-23** (14 Rollen in 3 Departments) |
| **Markenrechtsschutz** | ⏳ In Vorbereitung (ÖPA Juni, EUIPO Q3) |
| **Episode 002** | ⏳ Idee-Phase |
| **Research-Briefing #1** | ⏳ Noch nicht erstellt |
| **Konsistentes Posting** | ⏳ Im Aufbau (Ziel: 1–2 Videos/Monat) |

---

## Session 2026-05-30/31 — Studio-Architektur + Samovar-Spike

**Coach-Architektur stark erweitert (19 Rollen in 4 Departments):**
- Neues **Department 0 — Writers' Room** (W1 `<story>`, W2 `<world>`, W3 `<soul>`) — D-012
- **CTO / Head of Technical Infrastructure** (Rolle 11, `<cto>`) — D-011
- **Head of Studio / Standards Lead** (Rolle 19, `<standards>`) — D-014
- **Betriebsmodell** formalisiert (Studio als Maschine Idee→Produkt) — D-012
- **Role-Charter-Standard** (`ROLE_CHARTERS.md`, alle 19 Rollen) + 3-Schichten-QA + Anti-Silo-Pflicht — D-014
- **Skills-Layer** (`STUDIO_SKILLS.md`): Market-Research + Remotion vetted — D-015
- Neues Cross-Project-Pattern **P-006** (Rollen-Treue) im Learning-Tracker

**Produktions-Realität (wichtiger als ältere Tabelle unten):**
- Episode 002 ("Two Little Puppies…"): fal.ai-Pipeline gebaut, S01–S04 generiert, dann **gestoppt**
  (Drift + 2D/Stil-Problem + Kosten-Audit ~$30–45/Ep). Liegt brach zugunsten des Spikes.
- **Infrastruktur-Spike** (`production/spike_infrastructure/`, D-011→D-013): 4 Pfade A/B/C/D.
- **Samovar-Mini-IP** (Smeschariki-*Stil*, eigene Figuren Toptun/Zyabik/… , russische Seele) als
  Spike-Vehikel. Figuren-Anchor **gelockt** (`character_anchor.png`, flach/gedämpft). Skript +
  Writers'/CD-Präsentation vorhanden.
- **Pfad A (fal.ai) fertig** (`path_a_fal/samovar_test_15s.mp4`, ~$1.10): hübsch, aber 3/4
  Soul-Beats fehlen → i2v macht Ambient, kein gerichtetes Schauspiel. Bewertung 51/95 in `results.md`.

- **Pfad A + Ton fertig** (`path_a_fal/samovar_test_15s_audio.mp4`): 15s-Musikbett (ElevenLabs) gemuxt.
- **Pfad D (Remotion) gebaut + gerendert** (`path_d_remotion/out/samovar_test_15s.mp4`): alle 4
  Soul-Beats erreicht, flacher Stil, $0/Render, Ton + Untertitel. Bewertung **81/95 vs. A 51/95**.

- **Entscheidung D-013 gefällt:** **Remotion (Pfad D) = primäre Produktions-Engine.** Spike
  abgeschlossen. Pfad C = Reserve für Hero-Shots; B/A nicht weiterverfolgt (A bleibt Explorations-Tool).

- **Episode 01 „Zyabiks Gedicht" produziert + poliert** (`path_d_remotion/out/ep01_zyabiks_gedicht.mp4`,
  **48s**): 5 Figuren (Toptun/Zyabik + neu Burya/Cherepan/Vasilisa via `samovarLib.tsx`), 5 RU-Stimmen,
  **Lipsync** (mouthOpen), **SFX** (ElevenLabs v2-Endpoint: scribble/pop/thud/sparkle/pour/chime),
  bilinguale Untertitel, Musik geloopt/geduckt. Getrimmt von 75→48s (Dead Spots raus), mehr Bewegung
  (Bleistift-Schreiben, Kopf-Turns/Shake, Ambient-Blätter). $0 Marginalkosten.

- **Fin & Ari Refrain-Clip (Flat-2D-Experiment) produziert** (`path_d_remotion/out/finari_refrain.mp4`,
  25s): Fin (blau+silber) + Ari (pink+gold) via `finAriLib.tsx`, bilingualer EN→PT-Refrain (Ep002-Lyrics,
  gesungen via ElevenLabs Music), Lipsync, sonnige Wiese/Schloss/Schmetterling. Bewusst 2D (off-brand vs.
  3D-Bible, D-013-Note). **Kein neuer Writer** (Writers' Room W3 deckt lusofone Seele ab, Lyricist+Localization
  den Song). Beweist: owned Code → Kronen/Shirt-Konsistenz garantiert (Fin&Aris #1-Risiko gelöst).

- **Hybrid-Richness-Pass (owned L2-Hälfte) produziert** (`path_d_remotion/out/finari_hybrid.mp4`, 25s):
  Gradient-Himmel/Sonne, Tiefenschärfe (geblurrte ferne Layer), Kontakt-+Schlagschatten, Rim-Light,
  Vignette auf den Fin-&-Ari-Vektorfiguren. Schließt viel der Qualitätslücke zum AI-Look, owned/$0.
  Komposition `FinAriHybrid.tsx` ist **drop-in-ready** für L2: `<RichMeadow/>` → `<Img bg_meadow.png>`.

- ⚠️ **BLOCKER:** **fal.ai-Guthaben aufgebraucht** ("User is locked. Exhausted balance"). **Jede
  KI-Generierung** (Flux/Kling/Veo/ElevenLabs) ist gesperrt bis Top-up: fal.ai/dashboard/billing.
  (User lädt auf. Hat zusätzlich Midjourney-Zugang.)

- **3D-Pipeline BEWIESEN (R3F in Remotion):** `Three3D.tsx` rendert echtes 3D mit Licht/Schatten/
  Materialien/Turntable in headless Chromium via `npx remotion render Three3D --gl=angle` →
  `out/three3d.mp4`. Deps: `@react-three/fiber@8` + `three@0.160` + `@remotion/three` (mit
  `--legacy-peer-deps` installiert; R3F v9 braucht React 19, daher v8). **Erkenntnis:** kein hartes
  Detail-Limit in Remotion — **Bottleneck = das 3D-Modell-Asset**, nicht der Renderer. Proof nutzt nur
  Primitiv-Geometrie (kein modellierter Charakter).

### ▶ NÄCHSTE AKTIONEN (Wiedereinstieg)
0. **3D-Track (gewählt) — Loader ist gebaut & wartet auf das Asset:** `FinAri3D.tsx` lädt
   `public/models/fin.glb` via `useLoader(GLTFLoader)` (Primitiv-Fallback bis dahin; Bundle validiert).
   **Du:** Midjourney Fin-Turnaround → AI-Image-to-3D (Meshy/Tripo/Rodin) → `fin.glb` in
   `public/models/` legen → `npx remotion render FinAri3D --gl=angle`. Voller Workflow:
   `3D_ASSET_PIPELINE.md`. Showrunner-Flag: echtes 3D = Projekt-Scope (Modell/Rig/Textur), Rendern gelöst.
1. **fal.ai aufladen** → dann **echtes L2 (2D)**: `gen_finari_bg.py` (KI-gemalter Hintergrund) laufen lassen,
   in `FinAriHybrid` den `<RichMeadow/>` durch `<Img bg_meadow.png>` ersetzen → AI-Bildqualität + owned Figuren.
2. **Ep01 weiter verfeinern** (optional): 9:16-Export via Zod-Param, Lipsync feiner (audio-amplitude),
   denselben Richness-Pass (Gradienten/Schatten/DoF) auf Samovar anwenden.
2. **Veröffentlichen?** YouTube-Brief (Titel/Thumbnail/SEO) + Compliance (Made-for-Kids) + DistroKid —
   oder Samovar bewusst als Stil-Experiment behalten.
3. **Ep02 angehen** (Writers' Room: „Der erste Schnee" / „Ein Stuhl zu viel" lagen schon als Pitches vor).
4. **Offen:** taugt Remotion auch für Fin-&-Ari-3D-Look? (Ep002 dort liegt brach.)
5. **`samovarLib.tsx`** ist die wiederverwendbare Figuren-Basis — für jede weitere Episode nutzen.

---

## Was diese Session verändert hat (2026-05-23)

1. ✅ Neues Coach-Skill `AI_CREATIVE_COACH.md` (14 Rollen in 3 Departments)
2. ✅ `COACH_LEARNING_TRACKER.md` mit neuem Pattern P-004 (Sensing-Funktionen)
3. ✅ Dokumenten-Architektur: CLAUDE.md, PROJECT_OVERVIEW.md, BRAND_BIBLE.md,
   EPISODES.md, COMPLIANCE.md, DECISIONS.md, PROJECT_STATE.md angelegt
4. ✅ `RESEARCH_BRIEFINGS/` Ordner mit Template
5. ✅ Erste 7 Decisions (D-001 bis D-007) dokumentiert
6. ✅ Reasoning-Lücke explizit reflektiert (Research-Department initial übersehen)

**Stand vorher:** Nur `handoff.md` + `docs/` + `images/` existierten.

---

## Offene Fragen / Pending Decisions

### Kurzfristig (diese Woche)

- [ ] **Erstes Research-Briefing erstellen?** Coach kann starten — User-Go-Ahead nötig.
- [ ] **Episode 002 Idee festlegen** — `<lyrics>` kann Vorschläge generieren auf Basis
      handoff.md-Welt + erstem Briefing.
- [ ] **Anti-Vision definieren** (was Fin & Ari **niemals** sein soll). Wichtig für
      Reviewer-Filter.

### Mittelfristig (1–3 Monate)

- [ ] **Markenrecht-Recherche** vor ÖPA-Anmeldung (Konflikt-Check mit Paw Patrol etc.)
- [ ] **ÖPA-Anmeldung** "Fin & Ari" + "Schloss Mirandela" (Juni 2026)
- [ ] **EUIPO-Anmeldung** (Q3 2026)
- [ ] **Modell-Audit-Tabelle aufbauen:** Welches AI-Video-Modell für welchen Shot-Typ
      die beste Wahl ist (AI Production Engineer pflegt)
- [ ] **PT-PT vs. PT-BR Default** final festlegen (vorläufig PT-PT, aber prüfen ob
      BR-Markt-Größe das umkehrt)
- [ ] **Production-Rhythmus etablieren:** 1 Episode/Monat als Minimum erreichen
- [ ] **YouTube-Kanal-Optimierung:** Banner, About-Section, Playlists strukturieren

### Langfristig (3–12 Monate)

- [ ] 1.000 → 10.000 YouTube-Subs erreichen
- [ ] Plüsch-Prototyp-Design (ab 10k Subs Relevanz)
- [ ] Bilderbuch-Konzept
- [ ] Patreon-Launch-Vorbereitung
- [ ] Erste Lizenz-Gespräche mit lusofonen Kindersendern

---

## Risiken (laufend zu beobachten)

| Risiko | Mitigation |
|---|---|
| Charakter-Inkonsistenz in Vidu-Outputs | Master-DNA-Block + Anchor-Bild + ggf. LoRA-Training |
| Solo-Gründer-Burnout | Showrunner kalibriert Schedule, Coach erinnert bei Überlast |
| AI-Music-Royalty-Debatte beeinträchtigt Distribution | Compliance verfolgt AKM-/EU-Stand |
| CoComelon/Bluey-Stil verschiebt sich, wir bleiben "alt" | Research Department wöchentlich |
| PT-Authentizität wirkt nicht muttersprachlich | Localization Lead (auto-trigger mit `<lyrics>`/`<music>`) |
| Konkurrenz-Marke meldet ähnliche IP an | Compliance treibt Markenanmeldung |
| Vidu-Stack obsolet wenn Veo 3 / Kling 2.5 deutlich besser | AI Production Engineer Pflicht-Audit pro Video |

---

## Nächste empfohlene Aktionen (Coach-Vorschlag)

**Wenn User in nächste Session einsteigt, schlage in dieser Reihenfolge vor:**

1. Erstes **Research-Briefing** erstellen → liefert Input für Episode 002 Konzept
2. **Anti-Vision-Definition** → schärft Reviewer-Filter
3. **Episode 002 Konzept** → erstes komplettes Sparring nach neuem Coach-Skill

**Alternative:** Wenn User bereits Episode-Idee hat, direkt mit `<lyrics>` einsteigen
und Coach-Infrastruktur "in der Praxis" testen.

---

## Coach-Reminders

- **Samstag-Abend:** Research-Briefing erstellen (falls noch nicht)
- **Nach jedem Live-Video (Day 30):** Performance-Review-Eintrag in EPISODES.md
- **Bei Charakter-Bruch in Output:** BRAND_BIBLE.md konsultieren, Reviewer eskaliert

---

## Änderungs-Protokoll

| Datum | Änderung |
|---|---|
| 2026-05-23 | Initial-Version. Coach-Infrastruktur aufgesetzt. Phase 1 läuft. |
| 2026-05-31 | Studio auf 19 Rollen/4 Dept (D-011/012/014), Charters+QA, Skills-Layer (D-015), Samovar-Spike, Pfad A fertig. Offen: Ton + Pfad D (Remotion). |
