# ApoTrend Plattform-Backend

Neuer, **zustandsbehafteter** Backend-Pfeiler für die Hybrid-Plattform
(Collab / Market / Network). Getrennt vom bestehenden `backend/` (das sind
zustandslose Vercel-Daten-Fetcher — Engpass/News/Preise) und von `frontend/`
(PWA/Desktop).

> **Status (Neu-Priorisierung: Social-Feed = Kern):**
> - 🌍 **Länderübergreifend — Schritt 3ae: Feinschliff — Datumsformat, Entdeckungs-Karten, Dialoge:**
>   `fmtDateDe()` formatiert Kalenderdaten jetzt **locale-korrekt** (z. B. „15/08/2026" für PT über
>   `_bcp47`) statt fest deutsch. Übersetzt: die „Vorschläge zum Folgen"- und „Apotheken in
>   {Bundesland}"-Karten (inkl. Folgen/„folgst du"), die Beitrag-Bearbeiten-Box (Speichern/
>   Abbrechen) und der Beitrag-Löschen-Dialog. (Browser verifiziert: „Sugestões para seguir /
>   Farmácias em Lisboa / 15/08/2026", keine JS-Fehler.) Rest: 3 Spezialseiten (Stewardship-Forum,
>   Patienten-Infokarten, Begleitzettel) + kurze Lade-Spinner.
> - 🌍 **Länderübergreifend — Schritt 3ad: Wirkstoff-Detailseite mehrsprachig — letzte Seite:** Die
>   Wirkstoff-Seite (Untertitel, Beobachten/Teilen, Antibiotika-Stewardship-Panel, Engpass-Status
>   mit Direkt-Melden-Formular, die Abschnitte „Wer bietet/sucht", „Preisvergleich", „Laufende
>   Aktionen" und „Diskussion & Fragen" inkl. Verfassen-Formular + Leerzustände) ist jetzt DE/EN/PT.
>   Damit ist **jede erreichbare Nutzerseite übersetzt**. (Browser verifiziert: „Estado de falta /
>   Quem oferece / Comparação de preços / Discussão & perguntas".)
> - 🌍 **Länderübergreifend — Schritt 3ac: „Meine Aktivität"-Seite mehrsprachig (DE/EN/PT):** Die
>   Aktivitätsseite (Titel, Untertitel, Beitrag-Statistik mit allen Kennzahl-Labels, „Meine
>   Fachfragen/Engpass-Meldungen/Austausch-Einträge" inkl. Zähler, offen-Suffix, Bestätigungen und
>   Leerzustände) ist jetzt übersetzt. (Browser verifiziert: „🗂️ A minha atividade / As minhas
>   estatísticas / Publicações / Perguntas / Confirmações recebidas".)
> - 🌍 **Länderübergreifend — Schritt 3ab: Merkliste, Hashtag-Seite & Wirkstoff-Dashboard-Karten:**
>   Die Merklisten-Seite und die Hashtag-Themenseite (Titel, Zähler, Zurück, Leerzustände) sowie
>   die zwei bedingten „Für dich"-Karten (🏷️ Aktionen / 🔄 Bezugsquellen zu deinen Wirkstoffen,
>   inkl. Singular/Plural & Ablauf-Countdown) sind jetzt DE/EN/PT. (Browser verifiziert: „🔖 Os
>   meus marcadores / Ainda nada guardado / 0 publicações".)
> - 🌍 **Länderübergreifend — Schritt 3aa: Login-/Registrierungs-Screen mehrsprachig (DE/EN/PT):**
>   Der Anmelde-/Registrierungs-Screen (Anmelden/Neu registrieren, alle Feld-Labels, Buttons) ist
>   jetzt übersetzt — wiederkehrende EN/PT-Nutzer:innen sehen das Eingangstor in ihrer Sprache
>   (Sprache aus `apo_locale`). (Browser verifiziert: „Entrar / Registar / Criar conta / Palavra-
>   passe (mín. 8 caracteres)".) Rest-Detailseiten (Merkliste, Hashtag, Wirkstoff, Aktivität) folgen.
> - 🌍 **Länderübergreifend — Schritt 3z: Moderationspanel mehrsprachig — Oberfläche 100% DE/EN/PT:**
>   Das Redaktions-/Moderations-Dashboard (Kennzahl-Kacheln, Verifizierungs-Anträge mit
>   Verifizieren/Ablehnen, gemeldete Beiträge/Kommentare mit Grund/Autor/Entfernen/„In Ordnung",
>   Leerzustand) ist jetzt übersetzt. Damit ist die **gesamte Nutzeroberfläche mehrsprachig** —
>   von Registrierung über alle Reiter, Social-Flow, Nachrichten, Profil bis Moderation.
>   (Verifiziert: Skript parst fehlerfrei, `showModeration()` ohne JS-Fehler, alle `md_*`-Keys
>   lösen auf PT auf, z. B. „🛡️ Painel da redação".)
> - 🌍 **Länderübergreifend — Schritt 3y: Follower-/Folgt-Liste mehrsprachig — Profil komplett:**
>   Die Follower- und „Folgt"-Listen (Zurück, Überschrift, „Wer @X folgt", Leerzustände, Follow-/
>   Entfolgen-Buttons inkl. Live-Umschaltung) sind jetzt DE/EN/PT. Damit ist die **gesamte
>   Profil-Erfahrung** (Kopf, Bearbeiten, Konto, Follower-Listen) in der Landessprache.
>   (Browser verifiziert: „← voltar ao perfil / 👥 Seguidores / Quem segue @… / Ainda sem seguidores".)
> - 🌍 **Länderübergreifend — Schritt 3x: Profil bearbeiten + Datenschutz-/Konto-Karte mehrsprachig:**
>   Das Bearbeiten-Formular (alle Feld-Labels/Platzhalter, Region-Auswahl) und die Konto-Karte
>   (DSGVO-Datenexport, Passwort ändern, Konto löschen inkl. Bestätigungs-Dialoge) sind jetzt
>   DE/EN/PT — sicherheits-/datenschutzrelevante Texte also auch in der Landessprache. Auch der
>   „keine Beiträge"-Leerzustand und die zuvor übersehene Biete/Suche-Sektion in der Suche.
>   (Browser verifiziert: „Editar perfil / Guardar / Privacidade & conta / Nome a apresentar…".)
> - 🌍 **Länderübergreifend — Schritt 3w: Profil-Kopf mehrsprachig (DE/EN/PT):** Die Profilseite
>   (Zurück, Redaktion-/Verifiziert-Badge, Kennzahlen Beiträge/Follower/folgt/beste Antworten,
>   Aktions-Buttons Aktivität/Bearbeiten/Nachricht/Folgen bzw. Entfolgen) ist jetzt übersetzt.
>   (Browser verifiziert: „← voltar ao feed / Editar perfil / publicações / seguidores / a seguir".)
>   Offen: Profil-Bearbeiten-Formular und die Datenschutz-/Konto-Karte.
> - 🌍 **Länderübergreifend — Schritt 3v: Suche mehrsprachig (DE/EN/PT):** Die Suchergebnis-Ansicht
>   (Titel „Suchergebnisse für …", Treffer-Zähler, Zurück, Kein-Treffer-Leerzustand, der Wirkstoff-
>   Schnellzugriff und alle Abschnitts-Überschriften Personen/Beiträge/Engpässe/Preise/Rabatte) ist
>   jetzt übersetzt. (Browser verifiziert: „Resultados para … / 0 resultados / Sem resultados".)
> - 🌍 **Länderübergreifend — Schritt 3u: Willkommens-/Hilfe-Overlay mehrsprachig (DE/EN/PT):**
>   Das Onboarding-Overlay (Titel, Untertitel, alle 8 Erklär-Schritte, App-Installations-Tipp,
>   „Los geht's") ist jetzt übersetzt — der erste Eindruck neuer Nutzer:innen und die Hilfe hinter
>   dem ❓-Button. Steps von festen Strings auf i18n-Keys umgestellt (vermeidet zugleich das
>   `t`-Shadowing im `.map`). (Browser verifiziert: „👋 Bem-vindo à ApoTrend / Vamos começar →".)
> - 🌍 **Länderübergreifend — Schritt 3t: Direktnachrichten mehrsprachig (DE/EN/PT):** Posteingang
>   (Titel, Neu-schreiben-Feld, Leerzustand, Konversations-Zeilen) und Thread-Ansicht (Zurück,
>   Nachricht-Feld, Senden, „sag Hallo") sind jetzt übersetzt. Erneut einen latenten Shadowing-Bug
>   vermieden: die `forEach(t => …)`-Laufvariable im Posteingang verdeckte die i18n-Funktion `t()`
>   → in `th` umbenannt. (Browser verifiziert: „← Mensagens / Enviar / Escrever mensagem…".)
> - 🌍 **Länderübergreifend — Schritt 3s: Benachrichtigungen + relative Zeit mehrsprachig:** Das
>   Benachrichtigungen-Panel (Titel, Zurück, „Alle als gelesen", Leerzustand, alle 12 Ereignis-
>   Verben) und die Einzelbeitrags-Ansicht sind jetzt DE/EN/PT. Wichtiger Hebel: die geteilte
>   `relTime()`-Funktion („gerade eben / vor N Minuten") wird jetzt übersetzt (inkl. locale-
>   korrektem Datum via `_bcp47`) — das korrigiert **alle Zeitstempel app-weit** (Feed, Kommentare,
>   Austausch, DMs). (Browser verifiziert: „… começou a segui-lo agora mesmo".)
> - 🌍 **Länderübergreifend — Schritt 3r: Kommentar-Thread mehrsprachig — Social-Flow komplett:**
>   Kommentare sind jetzt DE/EN/PT: Leerzustand, Zähler, „Beste Antwort"-Badge & -Aktion,
>   Antworten/Melden/Bearbeiten/Löschen, Antwort- und Bearbeiten-Boxen, Melde-Dialog. Damit ist
>   der komplette Beitrags- & Kommentar-Fluss (Composer → Karte → Thread) in der Landessprache.
>   (Browser verifiziert: PT-Kommentar mit „↩ Responder", keine JS-Fehler.)
> - 🌍 **Länderübergreifend — Schritt 3q: Beitragskarten mehrsprachig (DE/EN/PT):** Die
>   `postCard`-Karten sind jetzt übersetzt: Reaktionen (Hilfreich/Danke/Bestätigt/Interessant —
>   `REACTS` von festem Label auf i18n-Key umgestellt, wirkt auch bei Kommentar-Reaktionen),
>   Kommentare-Zähler, Merken/Teilen/Bearbeiten/Löschen/Melden, Sichtbarkeit (öffentlich/Follower),
>   Verifiziert-/Redaktion-/Fachfrage-Badges, Quelle, Antwort-Feld. (Browser verifiziert: echter
>   PT-Beitrag mit „👍 Útil / 💬 0 comentários / 🔗 Partilhar / 🌍 público".) Offen: der
>   Kommentar-Thread (einzelne Kommentare, beste-Antwort-Flow).
> - 🌍 **Länderübergreifend — Schritt 3p: Beitrags-Composer mehrsprachig (DE/EN/PT):** Das
>   Verfassen-Formular (Beitrag/Fachfrage, Quelle, Bild, Sichtbarkeit öffentlich/Follower, Posten)
>   und die „Jemandem folgen"-Karte sind jetzt übersetzt — via `data-i18n`/`data-i18n-ph`, also
>   **live beim Sprachwechsel** ohne Neuladen. (Browser verifiziert: Composer auf „Mein Feed"
>   komplett portugiesisch.) Offen: die gerenderten Beitragskarten (`postCard`).
> - 🌍 **Länderübergreifend — Schritt 3o: Austausch-Einträge mehrsprachig — 5. Reiter komplett:**
>   Die einzelnen `exchangeCard`-Karten sind jetzt DE/EN/PT: Biete/Suche-Badge, Erledigt-Status,
>   Mengen-Label, „von {Name}", Kontaktieren/Erledigt/Wieder-öffnen/Löschen. Damit sind **alle
>   fünf Haupt-Reiter** (Dashboard, Engpässe, Preise, Rabatte, Biete/Suche) vollständig in der
>   Landessprache. (Browser verifiziert: echter PT-Eintrag „📦 Oferta / Quantidade: … / ✓ Concluído".)
> - 🌍 **Länderübergreifend — Schritt 3n: Biete/Suche-Reiter (Formular + Filter) mehrsprachig:**
>   Das Bestandsaustausch-Formular (Biete/Suche, alle Felder, Foto, Veröffentlichen, Kontakt-
>   Hinweis), die Filterleiste und alle Leerzustände sind jetzt DE/EN/PT. Ortsangaben von
>   AT-Beispielen auf generische („Region", PLZ/Stadt) umgestellt. (Browser verifiziert:
>   „🔄 Troca de stock…", Filter & Leerzustand auf Portugiesisch, keine JS-Fehler.) Offen: die
>   einzelnen Austausch-Einträge (`exchangeCard`).
> - 🌍 **Länderübergreifend — Schritt 3m: Rabatte-Reiter komplett mehrsprachig (DE/EN/PT):** Kopf,
>   Filter (Alle/Bald ablaufend), Suche, Leerzustände und die einzelnen Rabatt-Karten (Ersparnis,
>   Mindestabnahme, „Beste Aktion für X", Ablauf-Countdown, Posten-Feld) sind übersetzt — mit
>   Interpolation & Singular/Plural. Damit sind **vier komplette Reiter** (Dashboard, Engpässe,
>   Preise, Rabatte) in der Landessprache. `let t`-Debounce auch hier in `deb` umbenannt. (Browser
>   verifiziert: Rabatte-Reiter auf Portugiesisch, keine JS-Fehler.)
> - 🌍 **Länderübergreifend — Schritt 3l: Preisvergleichs-Karten mehrsprachig — Reiter komplett:**
>   Die einzelnen `priceGroup`-Karten sind jetzt DE/EN/PT: Vergleichs-Untertitel, Trend-Warnung,
>   Ersparnis-Badge, Aktions-Box (statt/pro Packung/gültig-bis/nur-noch-X-Tage, mit Interpolation),
>   Lieferanten-Zeilen (günstigster, „N Beiträge", Posten-Feld). Damit ist der **gesamte
>   Preise-Reiter** in der Landessprache. (Browser verifiziert: Preisvergleich auf Portugiesisch,
>   keine JS-Fehler.)
> - 🌍 **Länderübergreifend — Schritt 3k: Preise-Reiter (Kopf) mehrsprachig:** Sparpotenzial-
>   Kachel (mit Betrag/Anzahl-Interpolation, Singular/Plural), CSV-Export-Karte, Suchleiste und
>   Leerzustand sind jetzt DE/EN/PT. Die lokale `let t`-Debounce-Variable in `loadPrices` wurde
>   vorsorglich in `deb` umbenannt (gleicher latenter Shadowing-Bug wie in Schritt 3h). (Browser
>   verifiziert: „💶 Poupança nas compras / até € 1,34 por embalagem", keine JS-Fehler.) Offen:
>   die einzelnen Preisvergleichs-Karten (`priceGroup`).
> - 🌍 **Länderübergreifend — Schritt 3j: Engpass-Zeilen mehrsprachig — Reiter komplett:** Die
>   einzelnen Engpass-Karten sind jetzt übersetzt (DE/EN/PT): Melde-Info, Voraussichtlich-bis,
>   Antibiotika-Hinweis, Community-Bestätigungen (Singular/Plural), alle Aktions-Buttons
>   (Posten/Biete-Suche/Beobachten/Bestätigen/Wieder-lieferbar/Verlauf), das Post-Feld und die
>   Redaktions-Statusbox. Damit ist der **gesamte Engpässe-Reiter** in der Landessprache.
>   (Browser verifiziert: Engpass-Zeile auf Portugiesisch, keine JS-Fehler.)
> - 🌍 **Länderübergreifend — Schritt 3i: Datenherkunft-Legende + Herkunfts-Labels mehrsprachig:**
>   Die aufklappbare „Datenherkunft & Sicherheit"-Legende (inkl. Quellen-Grundsatz) und die
>   Herkunfts-Labels (BASG/Referenz/simuliert/Redaktion/Community) sind jetzt DE/EN/PT. Das
>   früher konstante `PROV`-Objekt wurde zu `provLabel()` (folgt der Sprache) — wirkt an allen
>   4 Fundstellen (Engpass-Zeilen, Status-Verlauf, Preise, Wirkstoff-Seite). (Browser verifiziert:
>   Legende & Chips auf Portugiesisch, keine JS-Fehler.) Offen: die einzelnen Engpass-Zeilen selbst.
> - 🌍 **Länderübergreifend — Schritt 3h: Engpässe-Reiter (Melde-Formular + Filter) mehrsprachig:**
>   Die größte verbliebene deutsche Fläche ist jetzt übersetzt (DE/EN/PT): die komplette
>   Filter-/Sortier-/Suchleiste (inkl. Drucken/CSV-Tooltips, Leerzustand) und das „Engpass
>   melden"-Formular (Beschreibung, alle Feld-Labels, Status-Optionen, Platzhalter, Senden-Button,
>   Validierungshinweis). Nebenbei ein latenter Bug behoben: eine lokale Debounce-Variable `t`
>   verdeckte die globale i18n-Funktion `t()` (TDZ-Absturz beim Rendern) → umbenannt. (Browser
>   verifiziert: Reiter auf Portugiesisch inkl. offenem Formular.) Offen: Datenherkunft-Legende
>   und die einzelnen Engpass-Zeilen.
> - 🌍 **Länderübergreifend — Schritt 3g: „Für dich"-Startseite komplett mehrsprachig:** Die
>   restlichen Dashboard-Karten sind jetzt übersetzt (DE/EN/PT): „Zuletzt im Bestandsaustausch",
>   das Stewardship-Fachforum (Titel/Tag/Beschreibung), „Offene Fachfragen" (inkl. Antwort-
>   Singular/Plural) und „Aktuelle Themen". Damit ist die meistgenutzte Startansicht von oben bis
>   unten in der Landessprache. (Browser verifiziert: Stewardship- und Themen-Karte auf
>   Portugiesisch, Vollbild-Screenshot.) Offen: die Apotheken-in-Bundesland-Karte (AT-spezifisch).
> - 🌍 **Länderübergreifend — Schritt 3f: Status-Vokabeln mehrsprachig (DE/EN/PT):** Die
>   app-weit geteilten Engpass-Status (Kritisch/Eingeschränkt/Verfügbar) werden jetzt übersetzt —
>   sowohl die Kurz-Badges (🔴/🟠/🟢) als auch die Langtexte (`watchStatusMeta`, `statusShort`,
>   CSV-Export). Die **Farb-Semantik bleibt sprachunabhängig** (rot=kritisch, CLAUDE.md). Auch die
>   „Kritische Engpässe"-Vorschau auf dem Dashboard ist übersetzt. (Browser verifiziert: PT-Nutzer
>   sehen „🔴 Crítica / 🟠 Limitada / 🟢 Disponível" und „🔴 Faltas críticas".)
> - 🌍 **Länderübergreifend — Schritt 3e: Beobachtungslisten-Karte mehrsprachig (DE/EN/PT):**
>   Die „Meine beobachteten Wirkstoffe"-Karte auf dem Dashboard ist jetzt vollständig übersetzt:
>   Titel, Untertitel, Melde-Badge (Singular/Plural), Schnell-Beobachten-Vorschläge,
>   „Alle N kritischen beobachten", Leerzustand, Eingabe-Platzhalter, Beobachten/Ansehen/
>   Entfernen und der CSV-Tooltip. (Browser verifiziert: PT komplett portugiesisch inkl.
>   „Vigiar os 3 críticos".) Nächste Etappe: die Status-Vokabeln (kritisch/verfügbar) und die
>   Engpass-Vorschau darunter.
> - 🌍 **Länderübergreifend — Schritt 3d: Dashboard-Hero mehrsprachig (DE/EN/PT):** Die
>   „Für dich"-Startansicht — der erste Eindruck für alle Nutzer:innen — war bisher auch bei
>   EN/PT-Oberfläche deutsch. Jetzt übersetzt: Überschrift, Untertitel, alle Kennzahl-Kacheln
>   (kritische/Antibiotika-Engpässe, Angebote/Gesuche, Sparpotenzial, Benachrichtigungen),
>   der Merklisten-Button und „Zuletzt angesehen". (Browser verifiziert: AT deutsch, GB englisch
>   (dark), PT portugiesisch.) Nächste Etappe: die Beobachtungslisten-Karte darunter.
> - 🌍 **Länderübergreifend — Schritt 3c: Länderauswahl bei der Registrierung:** Das
>   Registrierungsformular hat jetzt ein gut sichtbares Feld „Land (bestimmt Feed-Inhalte &
>   Sprache)" (12 Länder, Österreich als Vorauswahl, aus `GET /api/countries`). Neue Nutzer:innen
>   starten damit sofort im richtigen Land + der passenden Sprache: nach der Registrierung lädt
>   die App direkt in der Landessprache (z. B. Portugal → Oberfläche auf Portugiesisch). Geteilter
>   Helfer `ensureCountries()`/`countryOptionsHtml()` (auch vom Kopfzeilen-Umschalter genutzt).
>   (Browser verifiziert: Registrierung mit Portugal → Profil PT/pt, Navigation auf Portugiesisch.)
> - 🌍 **Länderübergreifend — Schritt 3b: Ehrlicher Länder-Datenhinweis:** Die Live-
>   Regulierungsdaten (Engpässe/Preise/Rabatte) stammen derzeit aus 🇦🇹 Österreich. Bei
>   aktivem Nicht-AT-Land erscheint jetzt ganz oben auf Dashboard, Engpässen, Preisen und
>   Rabatten ein klarer, mehrsprachiger Hinweis (DE/EN/PT), dass diese Zahlen aus Österreich
>   stammen und der soziale Feed/News bereits länderspezifisch sind — statt AT-Daten
>   stillschweigend als Landesdaten auszugeben (Quellen-/Sicherheitspflicht, CLAUDE.md).
>   Neuer `countryDataNotice()`-Helfer + `ti()` (Platzhalter-Interpolation). (Browser verifiziert:
>   AT ohne Hinweis; PT/GB mit Hinweis in Landessprache auf allen vier Ansichten.)
> - 🌍 **Länderübergreifend — Schritt 3: i18n-Navigation + Land-/Sprach-Umschalter:** Neuer,
>   framework­loser i18n-Kern im Frontend (`I18N`-Wörterbuch DE/EN/PT, `t()`, `setLocale()`,
>   `applyI18n()` über `data-i18n`/`data-i18n-ph`/`data-i18n-title`). Übersetzt sind Navigation,
>   Suche und die gesamte Kopfzeilen-Bedienung (Hell/Dunkel, Schrift, Hilfe, Nachrichten,
>   Meldungen, Abmelden). Neuer **Länder-Umschalter in der Kopfzeile** (aus `GET /api/countries`
>   befüllt): ein Landwechsel schreibt das Profil-Land (`POST /api/profile`), stellt die Sprache
>   automatisch auf die Landessprache um und lädt den aktiven Reiter länder-gescoped neu. Handy:
>   Umschalter zeigt nur die Flagge (voller Name beim Aufklappen), Kopfzeile bricht bei sehr
>   schmalen Geräten sauber um statt horizontal zu scrollen (docW=390). (Verifiziert im Browser:
>   AT→DE→GB→PT wechselt Beschriftungen live, Hell/Dunkel, Desktop 1280 + Handy 390.)
> - 🌍 **Länderübergreifend — Schritt 2: Newsfeed länder-gescopt:** Beiträge tragen jetzt
>   `country` (erben das Land des Autors); `publicFeed`/`newsFeed` filtern nach aktivem Land.
>   Endpunkte lösen das aktive Land auf (`?country=` → Profil-Land → Fallback AT) via neuem
>   `activeCountry`-Helfer und geben es mit zurück. Seeds: DE-Redaktion (BfArM/E-Rezept) und
>   BR-Redação (ANVISA) — der Länder-Switch zeigt echte, getrennte Inhalte. Rückwärtskompatibel
>   (fehlendes `country` = AT). (Integrationstest: AT→BASG, DE→BfArM, BR→ANVISA, eigener
>   Beitrag im Autor-Land; im Browser verifiziert.)
> - 🌍 **Länderübergreifend — Schritt 1: Länder-Fundament (Backend):** Neues Länder-Register
>   `data/countries.js` (12 MVP-Länder: AT/DE/CH · PT/BR/AO/MZ · GB/US/NG/KE/GH mit Locale,
>   Währung, Zeitzone, Regulator) + `GET /api/countries` (öffentlich). Profile tragen jetzt
>   `country` + `locale`; Registrierung nimmt `country`/`locale` an (Fallback AT/de), der
>   `POST /api/profile`-Länder-Switch aktualisiert beides (Sprache folgt automatisch dem Land,
>   außer explizit gesetzt), ungültiges Land → 400. Fundament für i18n + länder-gescopte
>   Inhalte. (Architektur-Dokument separat; Integrationstests grün.)
> - ✅ **Qualitäts-Audit — aktiver Reiter mit `aria-current`:** Der aktive Reiter war nur über
>   die Farbe erkennbar — für Screenreader- und farbsehschwache Nutzer:innen unsichtbar. Neu:
>   zentraler `setTabAria()`-Helper spiegelt den Aktiv-Zustand als `aria-current="page"` und
>   wird bei jeder Tab-Änderung sowie beim Öffnen von Detailseiten (Reiter dann nicht mehr
>   „current") synchronisiert. (Browser verifiziert: overview→shortages→prices wandert korrekt,
>   Detailseite = kein current.)
> - ✅ **Qualitäts-Audit — Browsertab-Titel je Ansicht:** `document.title` blieb überall
>   „ApoTrend …" — keine Orientierung im Tab, uneindeutige History, für Screenreader kein
>   Kontext beim Seitenwechsel. Neu: `setDocTitle()` setzt pro Ansicht einen sprechenden Titel
>   („Lieferengpässe · ApoTrend", „💊 Amoxicillin · ApoTrend", „#tag", „@handle", „Suche: …",
>   „Nachrichten/Meldungen/Moderation", Reiter-Titel); beim Abmelden zurück auf den Basistitel.
>   (Im Browser über alle Reiter + Detailviews verifiziert.)
> - ✅ **Qualitäts-Audit — Mobile-Überlauf durch lange Wörter/URLs behoben:** Systematischer
>   Mobile-Scan (390 px) fand die Beitragsdetail-Seite mit **docW 643** — ein langes Wort bzw.
>   eine lange URL ohne Leerzeichen brach das Layout (Horizontal-Scroll), weil `.post-body`
>   nur `white-space:pre-wrap` hatte (bricht keine langen Token). Fix: `overflow-wrap:anywhere`
>   auf `.card` (verhindert die ganze Klasse) und `.post-body`. Ergebnis: docW **643 → 390**
>   trotz Extrem-Langwort + langer URL; alle Reiter/Detailseiten 390. (Playwright-Scan +
>   8-Reiter-Smoke-Test grün, Desktop unverändert.)
> - ✅ **Qualitäts-Audit — freundliche Fehler-States mit Retry:** API-Fehler zeigten nur eine
>   nackte rote Textzeile ohne Ausweg. Neu: `errorState()`-Karte (⚠️ „Das hat nicht geklappt" +
>   Meldung + „↻ Erneut versuchen"). Auf alle Vollseiten-Fehler angewandt (Reiter → `loadTab`,
>   Moderations-Dashboard → eigener Reload). Nebenbei: der bei der Spinner-Migration übersehene
>   Moderations-Loader nutzt jetzt auch `.loading`. (Browser verifiziert: simulierter 500 zeigt
>   die Karte, Retry lädt nach Wiederherstellung erfolgreich nach.)
> - ✅ **Qualitäts-Audit — OS-Dark-Mode respektiert:** Ohne eigene Wahl folgte die App bisher
>   immer Light, egal wie das System eingestellt war. Jetzt: ohne gespeicherte Präferenz gilt
>   `prefers-color-scheme` des Betriebssystems; eine manuelle Wahl hat weiter Vorrang und wird
>   gespeichert. Der Umschalter richtet sich nun nach dem **tatsächlich angezeigten** Modus
>   (kein toter Erstklick aus dem OS-Default heraus); OS-Wechsel werden übernommen, solange
>   nicht manuell gewählt wurde. (Browser verifiziert: OS-dark→App dunkel, Toggle→hell+gespeichert,
>   OS-light→hell.)
> - ✅ **Qualitäts-Audit — Empty-States komplettiert (Rabatte/Hashtag/Follower):** Die
>   `emptyState()`-Komponente nun auch bei leeren Rabatt-Aktionen (🏷️), leerem Hashtag-Thema
>   (🏷️ mit `#tag`) und leeren Follower-/Folge-Listen (👥). Damit tragen alle prominenten
>   Vollseiten-Leerzustände dieselbe freundliche Optik; DM-Postfach bleibt bewusst als
>   Inline-Hinweis (Karte-in-Karte vermieden). (Browser verifiziert; 8-Reiter-Smoke-Test grün.)
> - ✅ **Qualitäts-Audit — Empty-States ausgeweitet (Suche/Merkliste/Austausch):** Die
>   `emptyState()`-Komponente nun auch bei: Suche ohne Treffer (🔍 mit Suchbegriff),
>   leerer Merkliste (🔖), Austausch „Meine" leer (🗂️ + CTA „Eintrag anlegen" → fokussiert
>   das Formular) und offenem Austausch leer (🔄, mit/ohne Suchbegriff). Konsistente,
>   handlungsleitende Leerzustände statt grauer Textzeilen. (Im Browser verifiziert inkl. CTA.)
> - ✅ **Qualitäts-Audit — freundliche Empty-States (Feed):** Leere Feeds zeigten nur eine
>   graue Textzeile. Neu: einheitliche `emptyState()`-Komponente (Icon + Titel + erklärender
>   Text + optionale Aktion). Angewandt auf Mein Feed (📭 + Folge-Vorschläge), „Öffentlich"
>   leer (✍️ „Beitrag schreiben" → fokussiert den Composer) und Fragen-Filter leer (❓
>   „Fachfrage stellen" → hakt Frage an + fokussiert Composer). (Im Browser verifiziert inkl.
>   funktionierender CTA; Basis für weitere Empty-States.)
> - ✅ **Qualitäts-Audit — Mobile-Bug behoben (Header + Tabs liefen über):** Auf dem Handy
>   (390 px) liefen Header und die 8er-Tableiste horizontal über (docW 781 → Seiten-Scroll,
>   4 Tabs nur per Scrollen erreichbar, „Abmelden" abgeschnitten). Jetzt: Tabs als
>   **4-Spalten-Grid** (2 Reihen, alle 8 sichtbar), Header eng gesetzt und „Abmelden" als
>   🚪-Icon (wie die übrigen Header-Aktionen). Grundursache mitbehoben: die Mobile-Media-Query
>   stand **vor** den Basisregeln (gleiche Spezifität → wirkungslos) und liegt jetzt danach.
>   docW = 390 (kein Überlauf); Desktop unverändert. (Präzise vermessen + Screenshot verifiziert.)
> - ✅ **Qualitäts-Audit — einheitlicher Lade-Indikator:** Die Reiter zeigten beim Laden ein
>   blankes „lädt…" (Text). Neu: dezenter, theme-tauglicher Spinner (`.loading` mit
>   animiertem `::before`, Rahmen aus `--line`/`--green`) plus Text — konsistent über alle
>   18 Ladepunkte + Suche. `prefers-reduced-motion` respektiert (kein Spin). (Im Browser mit
>   künstlich verzögerter API verifiziert: Spinner 18px, `apo-spin`, keine JS-Fehler.)
> - ✅ **Qualitäts-Audit — Farb-Token-Migration abgeschlossen (Orange/Blau + KPI-Kacheln):**
>   Restliche Text-Akzente auf Tokens: Orange (`#c77700`/`#b26a00`) → `--warn-fg`, Blau
>   (`#2952cc`) → `--info-fg`; KPI-Kacheln (Für-dich + Redaktions-Dashboard), `.editorial`-
>   und `.hashtag`-Badges, „nur noch X Tage"-Restlauftext, Offene-Fragen-Icons. Nur noch
>   Token-Definitionen und bewusste Badge-Hintergründe (weiß-auf-Farbe) tragen Roh-Hex.
>   Im Dark Mode alle Akzentzahlen/-texte hell & lesbar; Light Mode byte-gleich. (Browser Dark
>   verifiziert: Kacheln crit/ok/warn/info-fg; 8-Reiter-Smoke-Test grün.)
> - ✅ **Qualitäts-Audit — roter Akzenttext auf Token (Dark-Kontrast):** Alle Text-Rot-Stellen
>   (`color:#c0392b`, Trend-Pfeile, Fehlermeldungen, `watchStatusMeta`-Statusfarben) →
>   `var(--crit-fg)` (auch Orange/Grün der Status-Pillen auf `--warn-fg`/`--ok-fg`). Im Dark
>   Mode jetzt helles, lesbares Rot (#f0857a) statt dunklem `#c0392b`; rote Badge-Hintergründe
>   mit weißem Text bleiben (in beiden Modi ok). Light Mode byte-gleich. (Browser Dark
>   verifiziert: Kritisch-Pille rgb(240,133,122), Trend-Pfeile hell-rot.)
> - ✅ **Qualitäts-Audit — grüner Akzenttext auf Token (Dark-Kontrast):** Alle inline
>   `color:#0b7f28` (16 Stellen: Sparpotenzial, „günstigster", Quell-/CSV-Links, Badges …)
>   → `color:var(--ok-fg)`. Im Dark Mode jetzt helles, gut lesbares Grün (#46d67a) statt des
>   kontrastarmen dunklen `#0b7f28` auf dunklen Karten; Light Mode byte-gleich
>   (`--ok-fg`=`#0b7f28`). (Im Browser Dark verifiziert; Screenshot bestätigt Lesbarkeit.)
> - ✅ **Qualitäts-Audit — Tastatur-Bedienbarkeit (a11y):** Viele klickbare Elemente waren
>   `div`/`span.clickable` mit `onclick`, aber **ohne** `tabindex`/`role`/Tastatur-Handler —
>   für Tastatur- und Screenreader-Nutzer:innen unerreichbar. Neu: zentrale Aufwertung per
>   MutationObserver stampft `.clickable`-Elemente auf `tabindex=0` + `role=button` (Container
>   mit eigenen Bedienelementen ausgenommen → keine verschachtelten Interaktiv-Elemente); ein
>   delegierter Keydown-Handler löst sie mit Enter/Leertaste aus. Deckt alle aktuellen und
>   künftig gerenderten klickbaren Elemente ab, ohne jede Fundstelle anzufassen.
>   (Im Browser verifiziert: Fokus + Enter navigiert; keine Fehl-Stamps.)
> - ✅ **Qualitäts-Audit — Header mit Klartext-Beschriftung:** Die Kopfzeilen-Aktionen waren
>   bloße Glyphen (`🌙`, `A⁺`, `❓`, `✉️`, `🔔`) — für die nicht-technische Zielgruppe kryptisch
>   (CLAUDE.md: „Klartext statt Kürzel", „klare Beschriftung"). Jetzt Icon **+** sichtbares
>   Label: „Hell/Dunkel", „Schrift", „Hilfe", „Nachrichten", „Meldungen". Ab ≤ 980 px Icon-only
>   (kein Umbruch). Theme-/Schrift-Toggle aktualisieren nur noch das Icon-Span (Label bleibt),
>   `aria-label`/`title` unverändert. (Im Browser Desktop/Mobile + beide Toggles verifiziert.)
> - ✅ **Qualitäts-Audit — semantische Farb-Tokens (Dark Mode):** Hart codierte Chip-/Badge-
>   Farben (`#eef3f0`, `#e6f7ef`, `#fff4e6` …) schalteten im Dark Mode nicht mit und standen
>   als grelle helle Pillen auf dunklem Grund. Neu: Tokens `--chip-bg` und
>   `--ok/--warn/--crit/--info`-Sätze (bg/fg/bd) in `:root` **und** `body.dark`; damit
>   umgestellt: Biete/Suche-Pillen, `.spec`-Chips, `.reacts`-Buttons, `.rabatt-badge`,
>   Referenz-Chips, DM-Blasen. Konsistente, theme-taugliche Farben; Light Mode unverändert
>   (Tokens = Originalwerte). Basis für weitere Token-Migration. (Im Browser Dark/Light verifiziert.)
> - ✅ **Qualitäts-Audit — Informationshierarchie korrigiert:** Bisher standen Suche,
>   Post-Compose und „Jemandem folgen" **über den Tabs auf jedem Reiter** — man scrollte auf
>   Engpässe/Preise/Rabatte erst an zwei Formularen vorbei (~660 px verschenkt). Jetzt:
>   schlanke Suche → Tabs → Inhalt; Compose/Folgen erscheinen nur noch auf den Social-Feed-
>   Reitern (Öffentlich/Mein Feed). Daten-Reiter starten den Inhalt bei ~256 px statt ~660 px
>   (Inhalt „above the fold", weniger Scrollen). (Frontend-Restrukturierung; Posten/Folgen
>   weiter funktionsfähig; im Browser verifiziert inkl. Screenshot, keine JS-Fehler.)
> - ✅ **Rabatt-Aktionen als CSV exportieren:** Der Rabatt-Reiter bekommt (wie Preise/Engpässe)
>   einen „⬇️ CSV (N)"-Export der aktuell gefilterten Aktionen für den Einkauf — Rang,
>   Präparat, Wirkstoff, Lieferant, Listen-/Aktionspreis, Rabatt %, Ersparnis/Pkg,
>   Mindestmenge + Ersparnis bei Mindestmenge, gültig bis, „beste Aktion je Wirkstoff".
>   Zähler im Button folgt Filter/Suche. (Frontend; im Browser verifiziert.)
> - ✅ **Merkliste als CSV exportieren:** Die beobachteten Wirkstoffe lassen sich mit ihrem
>   aktuellen Engpass-Status als CSV (Excel) exportieren („⬇️ CSV" in der Merkliste-Karte) —
>   z. B. als Aushang/Liste am Handverkaufstisch. Spalten: Wirkstoff, Aktueller Status,
>   Präparat; bleibt mit der Live-Liste synchron. (Frontend; im Browser verifiziert.)
> - ✅ **Kachel „Antibiotika-Engpässe" auf der Startübersicht:** Zeigt (wenn > 0) die Zahl
>   aktiver Antibiotika-Engpässe als KPI-Kachel; Klick springt direkt in den Engpass-Reiter
>   mit voraktiviertem 🧫-Filter. Verbindet die AMR-Ausrichtung mit dem Dashboard.
>   (`overview` erhält `amr` injiziert, neues Feld `shortages.antibiotika`; Tile-Deep-Link
>   mit Filter; Test + im Browser verifiziert.)
> - ✅ **Engpass-Filter „🧫 Antibiotika":** Neuer Filter-Chip im Lieferengpässe-Reiter zeigt
>   nur Antibiotika-Engpässe (nutzt das `is_antibiotic`-Feld) — passend zur
>   Stewardship-Ausrichtung, damit AMR-relevante Engpässe schnell auffindbar sind. Wirkt mit
>   Sortierung/Suche/Druck/CSV zusammen. (Frontend; im Browser verifiziert: 6 → 2 Einträge,
>   alle als Antibiotikum markiert.)
> - ✅ **Begleitzettel + Infokarten in einem Druck:** Im Abgabe-Begleitzettel kann per
>   Checkbox „🧫 Antibiotika-Infokarten mitdrucken" gewählt werden — die Patienten-Infokarten
>   erscheinen dann in derselben Sprache auf einer Folgeseite (Seitenumbruch) desselben
>   Druckauftrags, inkl. Quelle/Disclaimer. Ein Druckvorgang bei der Abgabe statt zwei.
>   Popup wird synchron im Klick geöffnet (kein Popup-Blocker); Karten optional — bei
>   Ladefehler druckt der Zettel trotzdem. (Frontend; im Browser verifiziert, DE/TR.)
> - ✅ **„Offene Fachfragen" auf der Startübersicht:** Bis zu 3 unbeantwortete Fragen
>   anderer Kolleg:innen (eigene ausgenommen) erscheinen als klickbare Karte auf „Für dich"
>   — Klick öffnet die Frage direkt. Bringt Fragen schneller zu Antworten und speist die
>   „beste Antwort"-Reputation. (Frontend, nicht-blockierend nachgeladen über
>   `filter=questions`; im Browser verifiziert inkl. „eigene Frage ausgeblendet".)
> - ✅ **Engpass-Statusverlauf:** Jede Statusänderung wird protokolliert (Datum, Status,
>   Herkunft, Quelle) — Ausgangsmeldung beim Anlegen, Redaktions-Updates (Quellpflicht
>   bleibt), „wieder lieferbar". Die Engpass-Karte zeigt ab 2 Einträgen „📜 Verlauf (N)"
>   (neueste zuerst, Quelle als Link). Beantwortet „seit wann kritisch — und woher wissen
>   wir das?". Alte Snapshots ohne `history` bleiben kompatibel; keine Nutzer-IDs im
>   Verlauf. (Repo `history` + Tests inkl. Abwärtskompatibilität; im Browser verifiziert.)
> - ✅ **Engpass-CSV vervollständigt:** Der Excel-Export der Engpassliste enthält jetzt auch
>   „voraussichtlich wieder lieferbar bis" (leer bei „wieder verfügbar") und „Antibiotikum"
>   (ja/nein) — die Spalten, die der Einkauf für Bevorratungs-/Stewardship-Planung braucht.
>   (Frontend; im Browser verifiziert: Header + Werte je Zeile konsistent.)
> - ✅ **Rabatte: „Beste Aktion je Wirkstoff":** Laufen zum selben Wirkstoff mehrere
>   Aktionen, markiert die Liste die mit dem niedrigsten Aktionspreis („⭐ Beste Aktion für
>   … (1 weitere läuft)"); die teurere Alternative bekommt einen dezenten Hinweis. Berechnung
>   über **alle** laufenden Aktionen (nicht nur Top-10). Zweite Ibuprofen-Aktion im Seed als
>   Vergleichsfall. (`listTop10` um `best_for_wirkstoff`/`wirkstoff_alternatives`; Unit-Test +
>   im Browser verifiziert.)
> - ✅ **Preis-Trend-Warnung:** Ist der günstigste Anbieter einer Preisgruppe zuletzt
>   spürbar teurer geworden (≥ +5 %), zeigt die Gruppe einen Warnhinweis
>   („⚠️ Günstigster Anbieter zuletzt teurer (+X %) — Preis beobachten"). Nur Hinweis zum
>   Beobachten, keine Kaufberatung. (Frontend, nutzt vorhandenes `trend_pct`; im Browser verifiziert.)
> - ✅ **Engpass ↔ Stewardship-Verknüpfung:** Antibiotika-Engpässe sind serverseitig als
>   `is_antibiotic` markiert; die Engpass-Karte zeigt dann einen Hinweis „🧫 Antibiotikum —
>   Stewardship-Infos & Quellen", der zur quellenbelegten AMR-Wissensecke des Wirkstoffs führt.
>   **Bewusst keine eigene Substitutionsempfehlung** (nur Verweis auf Quellen). Fünfter
>   Stewardship-Baustein. (`/api/shortages` um `is_antibiotic` via `amr.isAntibiotic`;
>   Integrationstest + im Browser verifiziert.)
> - ✅ **Abgabe-Begleitzettel (Verordnungs-Klartext):** Die Apotheke gibt die Angaben laut
>   Verordnung ein (Arzneimittel, Einnahmeschema Morgens/Mittags/Abends/Nacht, Essen, Dauer,
>   Hinweise) — ApoTrend macht daraus einen großen, gut lesbaren Einnahmeplan mit
>   Live-Vorschau und Druck, mehrsprachig (DE/EN/TR). **Reine Klartext-Aufbereitung der
>   Eingaben des Fachpersonals — es wird keine Dosierung berechnet oder vorgeschlagen**
>   (Medizinprodukt-Grenze). Vierter Stewardship-Baustein; Einstieg über Patienten-Infokarten
>   und Fachforum. (Frontend; im Browser verifiziert inkl. Sprachwechsel + Pflichtfeld-Guard.)
> - ✅ **Mehrsprachige Patienten-Infokarten (Antibiotika):** Kuratierte, quellenbelegte
>   Aufklärungskarten (Deutsch/English/Türkçe) zur verständlichen Abgabe in der Apotheke —
>   Sprachwechsel, „Kopieren" je Karte und sauberer Druck (eigenes Druckfenster). Allgemeine
>   Public-Health-Botschaften, **keine** patientenindividuelle Therapie-/Dosierungsaussage.
>   Einstieg über AMR-Wissensecke und Stewardship-Fachforum. Dritter Stewardship-Baustein.
>   (`services/patientInfo.js`; `/api/patient-info?lang=`; Integrationstest + im Browser verifiziert.)
> - ✅ **Stewardship-Fachforum:** Kuratierter Themen-Einstieg (über den `#stewardship`-Hashtag)
>   für anonymisierte Fachdiskussion zum verantwortungsvollen Antibiotikaeinsatz — mit klarem
>   Zweck/Disclaimer („keine Patientenberatung, keine personenbezogenen Patientendaten"),
>   Composer (hängt `#stewardship` automatisch an) und redaktionellem Starter-Beitrag.
>   Einstieg über die Startübersicht und die AMR-Wissensecke. Zweiter Stewardship-Baustein.
>   (Reuse der bestehenden Hashtag-/Feed-Infrastruktur; Integrationstest + im Browser verifiziert.)
> - ✅ **Antibiotika-Stewardship-Wissensecke (AMR):** Auf der Wirkstoff-Detailseite eines
>   Antibiotikums erscheint ein quellenbelegtes Info-Panel (allgemeine Stewardship-Hinweise +
>   offizielle AT-Quellen AGES/AURES) — ausdrücklich **keine patientenindividuelle
>   Therapieempfehlung** (klar gekennzeichnet, hält die Medizinprodukt-Grenze ein). Erster
>   Baustein der Antibiotic-Stewardship-Ausrichtung. (`services/amr.js` rein informativ;
>   `/api/wirkstoff/:name` um `amr` erweitert; Integrationstest + im Browser verifiziert.)
> - ✅ **Engpass „voraussichtlich wieder lieferbar bis":** Beim Melden eines Engpasses kann
>   optional ein Datum angegeben werden, bis wann der Engpass voraussichtlich dauert; die
>   Engpass-Karte zeigt es prominent an („🗓️ Voraussichtlich wieder lieferbar bis …"). Datum
>   wird serverseitig validiert (ISO YYYY-MM-DD). Zwei Referenz-Engpässe sind beispielhaft
>   damit befüllt. (`/api/shortages/report` um `voraussichtlichBis`; Test + Browser verifiziert.)
> - ✅ **Direktnachrichten benutzerfreundlicher:** Enter sendet die Nachricht (Shift+Enter
>   für Zeilenumbruch), Enter startet auch eine neue Konversation. Die Nachrichten-Übersicht
>   zeigt je Konversation den Zeitpunkt der letzten Nachricht (relativ) und hebt ungelesene
>   Konversationen hervor (fetter Name, farbig hinterlegt). (Frontend; im Browser verifiziert.)
> - ✅ **Rabatt-Aktion im Preisvergleich:** Läuft für ein Präparat/einen Wirkstoff eine
>   Rabatt-Aktion, deren Aktionspreis den besten AEP unterbietet, zeigt die Preisgruppe
>   einen Hinweis („🏷️ Aktion günstiger als der beste Einkaufspreis" mit Lieferant,
>   Preis, Ersparnis pro Packung, Mindestmenge, Restlaufzeit). Der Einkauf sieht die
>   günstigere Option an einer Stelle. (`prices.comparisons` um `action` erweitert —
>   `rabatteRepo` injiziert; Integrationstest + im Browser verifiziert.)
> - ✅ **Engpass-Sortierung:** Der Lieferengpässe-Reiter hat einen Sortier-Umschalter
>   („🔴 Kritischste zuerst" / „🕘 Neueste zuerst"). Kritischste = Status → Bestätigungen →
>   Datum; Neueste = Meldedatum absteigend. Wirkt zusammen mit Filter/Suche, nur die
>   Listenbox wird neu gerendert. (Frontend; im Browser verifiziert.)
> - ✅ **„Meine Beitrag-Statistik":** „Meine Aktivität" zeigt oben eine Kennzahl-Leiste
>   (Beiträge, Fragen inkl. offener, beste Antworten als Reputation, Engpass-Meldungen,
>   erhaltene Bestätigungen, Austausch-Einträge) — das eigene Engagement auf einen Blick.
>   (`/api/me/activity` um `stats` erweitert; Test + im Browser verifiziert.)
> - ✅ **Preise-Reiter: Suche:** Textsuche (Präparat/Wirkstoff/Lieferant) filtert den
>   Preisvergleich live; nur die Listenbox wird neu gerendert (Suchfokus bleibt erhalten).
>   (Frontend; im Browser verifiziert.)
> - ✅ **Engpassliste drucken (Team-Aushang):** „🖨️ Drucken" auf dem Engpässe-Reiter öffnet
>   eine druckoptimierte Ansicht der aktuellen (gefilterten) Liste — Kopf-/Navigations-/
>   Formular-Elemente per Print-CSS ausgeblendet, Druckkopf „ApoTrend — Lieferengpässe" mit
>   Stand/Filter. Zum Aushängen für nicht-digitale Kolleg:innen. (Im Browser via
>   emulateMedia('print') verifiziert.)
> - ✅ **Barrierefreiheit — „Zum Inhalt springen":** Skip-Link (per Tab sichtbar) springt
>   zum Hauptinhalt (`<main id="app">` mit Fokus), damit Tastatur-/Screenreader-Nutzer:innen
>   die Kopfleiste überspringen. (Im Browser mit Tastatur verifiziert.)
> - ✅ **Aktuelle Themen (Trending-Hashtags):** die Startübersicht zeigt die häufigsten
>   #Hashtags aus den letzten sichtbaren Beiträgen als Chips (mit Anzahl); Klick öffnet die
>   Hashtag-Ansicht. (`GET /api/trending/hashtags`; 193 Tests grün, im Browser verifiziert.)
> - ✅ **Rabatt-Ersparnis-Hochrechnung:** jede Aktion mit Mindestmenge zeigt zusätzlich die
>   Gesamt-Ersparnis bei Mindestabnahme („Bei Mindestabnahme (50 Stück): € 35,00 gespart")
>   — konkreter Einkaufsvorteil statt nur Ersparnis je Packung. (Im Browser verifiziert.)
> - ✅ **Preisverlauf-Details an der Sparkline:** Hover zeigt die letzten AEP-Werte als
>   Tooltip („€ 3,10 → € 3,08 → …"), und die Sparkline hat ein beschreibendes
>   Screenreader-Label mit Richtung + Werten (statt nur „Preisverlauf"). (Im Browser verifiziert.)
> - ✅ **Redaktions-Dashboard (Moderation):** die Moderations-Ansicht (🛡️, nur Redaktion)
>   führt jetzt mit Kennzahl-Kacheln — offene Meldungen, Verifizierungs-Anträge, aktive
>   kritische Engpässe, Community-Meldungen — für Plattform-Gesundheit auf einen Blick.
>   (Im Browser als Redaktion verifiziert.)
> - ✅ **Austausch startet im eigenen Bundesland:** hat das Profil ein Bundesland, ist der
>   Bestandsaustausch beim ersten Öffnen darauf vorgefiltert (Ware in der Nähe zuerst);
>   „📍 Alle Bundesländer" ist der Ein-Klick-Opt-out. (Frontend; im Browser verifiziert.)
> - ✅ **Rabatt-Reiter: Suche + „bald ablaufend"-Filter:** Textsuche (Präparat/Wirkstoff/
>   Lieferant) und Umschalter „Alle / ⏳ Bald ablaufend"; nur die Liste wird neu gerendert
>   (Suchfokus bleibt), aria-pressed an den Umschaltern. (Frontend; im Browser verifiziert.)
> - ✅ **Apotheken in deinem Bundesland:** die Startübersicht zeigt Kolleg:innen im selben
>   Bundesland (aus dem Profil) mit Folgen-Button — Umkreis-Vernetzung für den
>   Bestandsaustausch. (`GET /api/colleagues/nearby`; 191 Tests grün, im Browser verifiziert.)
> - ✅ **Bundesland im Profil:** Apotheken hinterlegen ihr Bundesland (Profil bearbeiten,
>   9 AT-Länder, serverseitig validiert). Es wird am Profil (📍) angezeigt und bei neuen
>   Biete/Suche-Einträgen vorausgewählt — weniger Tippen, Grundlage für Umkreis-Bezug.
>   (`social.updateProfile` bundesland; 189 Tests grün, end-to-end im Browser verifiziert.)
> - ✅ **Follower-/Folge-Listen:** die Zahlen „Follower" und „folgt" auf jedem Profil sind
>   jetzt anklickbar und zeigen die Personen (mit direktem Folgen/Entfolgen) — so lassen
>   sich Kolleg:innen entdecken und Follows verwalten. (`GET /api/profiles/:handle/
>   followers|following`; 188 Tests grün, end-to-end im Browser verifiziert.)
> - ✅ **Suche umfasst jetzt den Bestandsaustausch:** die globale Suche findet zusätzlich
>   offene Biete/Suche-Einträge (mit Autor-Profil) — „Amoxicillin" zeigt also auch, wer
>   gerade Bestand anbietet. (`searchService` bekommt `exchange` injiziert; 187 Tests grün,
>   im Browser verifiziert.)
> - ✅ **Zuletzt angesehene Wirkstoffe:** die Startübersicht zeigt „🕘 Zuletzt angesehen"
>   als Chips (neueste zuerst, max 8) für den schnellen Wiedereinstieg in oft
>   nachgeschlagene Medikamente. Nur lokal im Gerät gespeichert (localStorage, kein
>   Server). (Im Browser verifiziert.)
> - ✅ **HTTP-Integrationstests:** die am HTTP-Layer komponierten Endpunkte
>   (`/api/wirkstoff/:name`, `/api/me/activity`, `/api/feed/public?filter=questions`,
>   `/api/overview` watch_offers, 404-Fallback) werden jetzt gegen den echt gebooteten
>   Server getestet (nicht nur im Browser). Server exportiert `httpServer` für sauberes
>   `close()`. (Neuer Test http-integration.test.js; 186 Tests grün.)
> - ✅ **Produktionsreife — Sessions überleben Neustarts:** Datendurchlauf-Test
>   (Zustand anlegen → SIGTERM/Snapshot → Neustart → prüfen) deckte auf, dass das
>   Session-Secret pro Prozess zufällig war → jeder Deploy loggte alle aus. Jetzt aus
>   `APOTREND_TOKEN_SECRET` (in `render.yaml` via `generateValue` einmalig fest gesetzt);
>   ohne Variable Warnhinweis + Dev-Fallback. Round-Trip bestätigt: Q&A-Antwort,
>   Beobachtungsliste, Community-Bestätigung, Merkliste überstehen den Neustart bei
>   gültiger Session. (Neuer Test token.test.js; 181 Tests grün.)
> - ✅ **Wirkstoff-Detailseite (alles zu einem Medikament):** Klick auf einen Wirkstoff
>   (z.B. den Titel einer Engpass-Karte oder „Ansehen" in der Beobachtungsliste) öffnet
>   eine gebündelte Ansicht: Engpass-Status, wer bietet/sucht (Austausch), Preisvergleich
>   und laufende Aktionen sowie Diskussion & Fragen (Beiträge, die den Wirkstoff erwähnen)
>   — plus Beobachten-Umschalter. Komposition am HTTP-Layer aus getesteten Diensten,
>   Wiederverwendung aller Karten-Renderer.
>   (`GET /api/wirkstoff/:name`; 186 Tests grün, end-to-end im Browser verifiziert.)
>   Teilbar per Deep-Link: „🔗 Teilen" kopiert `/?wirkstoff=Name`, beim Öffnen springt
>   die App direkt auf die Seite (wie schon Beitrags-Links). Engpass für den Wirkstoff
>   direkt von der Detailseite meldbar (vorbefülltes „➕ Engpass melden"); Beitrag oder
>   Fachfrage zum Wirkstoff direkt aus der Diskussion verfassbar („✍ Beitrag verfassen").
>   Einstieg von überall: Wirkstoff-Namen auf Engpass-, Preis- und Rabatt-Karten sowie in
>   der Beobachtungsliste sind klickbar und führen zur Detailseite; auch die Suche zeigt
>   „💊 <Wirkstoff>"-Chips, die direkt dorthin springen.
> - ✅ **Engpass-Liste als CSV (aktuelle Auswahl):** „⬇️ CSV (N)" in der Filterleiste
>   exportiert die gerade gefilterten Engpässe (Wirkstoff, Präparat, Status, Grund,
>   Meldedatum, Herkunft, Melder, beobachtet) — u.a. zur Dokumentation der
>   Nichtverfügbarkeit. Gemeinsamer `downloadCsv`-Helfer mit dem Preis-Export.
>   (Im Browser verifiziert, Zähler spiegelt den Filter.)
> - ✅ **Preisvergleich als CSV (für Einkauf/Großhandel):** „⬇️ Preisvergleich als CSV"
>   auf dem Preise-Reiter lädt alle Präparate & Lieferanten (AEP, Trend, günstigster
>   Anbieter, Ersparnis) im deutschen Excel-Format herunter (Semikolon-Trenner,
>   Komma-Dezimal, UTF-8+BOM) — direkt weiterverarbeitbar. (Frontend; im Browser verifiziert.)
> - ✅ **Barrierefreiheit — aria-pressed auf Umschaltern:** Sortier-, Feed-Filter-,
>   Engpass-Filter- und Beobachten-Buttons melden ihren An/Aus-Zustand an Screenreader
>   (`aria-pressed`, synchron beim Umschalten). (Im Browser verifiziert.)
> - ✅ **Bestands-Alarm für beobachtete Wirkstoffe:** bietet eine Apotheke im Austausch
>   Bestand an, der einen von dir beobachteten Wirkstoff enthält, wirst du sofort
>   benachrichtigt („📦 Neuer Bestand zu deinem beobachteten Wirkstoff: Amoxicillin") —
>   Klick öffnet den Austausch gefiltert. Der aktive Gegenpart zur Bezugsquellen-Karte.
>   (`exchange.create` → `shortagesRepo.watchersForText`, Typ watch_offer; 177 Tests grün,
>   end-to-end im Browser verifiziert.)
> - ✅ **Bezugsquellen zu beobachteten Wirkstoffen (Beobachtungsliste ↔ Biete/Suche):**
>   bietet eine Apotheke einen von dir beobachteten Wirkstoff an, erscheint das auf „Für
>   dich" („📦 Amoxicillin — 2 Angebote"), Klick springt gefiltert in den Austausch. Genau
>   der Moment, in dem man während eines Engpasses Bestand sucht. (`overview.watch_offers`;
>   172 Tests grün, end-to-end im Browser verifiziert.)
> - ✅ **„Meine Aktivität" (eigenes Profil):** ein Ort für die eigenen Beiträge —
>   Fachfragen (mit offen/beantwortet), Engpass-Meldungen (mit Status/Bestätigungen)
>   und Austausch-Einträge, jeweils anklickbar. Komposition am HTTP-Layer aus bereits
>   getesteten Diensten. (`GET /api/me/activity`; im Browser verifiziert.)
> - ✅ **Fragen-Filter im Öffentlich-Feed:** Umschalter „❓ Offene Fragen zuerst" zeigt nur
>   Fachfragen, unbeantwortete oben — so finden Kolleg:innen Fragen, bei denen sie helfen
>   können. (`GET /api/feed/public?filter=questions`; 170 Tests grün, im Browser verifiziert.)
> - ✅ **Fachfragen-Q&A im Feed:** Beiträge lassen sich als „❓ Fachfrage" posten
>   (Checkbox im Compose-Feld). Die/der Fragesteller:in markiert eine Antwort als
>   „✔ beste Antwort" — sie wird hervorgehoben, die Frage als „✔ Beantwortet"
>   gekennzeichnet, die antwortende Person benachrichtigt (🏆). Markierung ist umschaltbar,
>   nur der/die Fragesteller:in darf wählen, nur echte Antworten dieser Frage.
>   (`POST /api/posts/:id/accept`, post.kind='frage', accepted_comment_id; 169 Tests grün,
>   end-to-end im Browser verifiziert.)
> - ✅ **„Für dich" verschlankt (weniger Scrollen):** Sparpotenzial, bald ablaufende
>   Aktionen und Top-Rabatt stehen jetzt kompakt als Kennzahl-Kacheln oben statt als je
>   eigene Karte; die Startübersicht ist etwa halb so hoch. Persönlich-Handlungsrelevantes
>   (Beobachtungsliste, Aktionen zu deinen Wirkstoffen, kritische Engpässe, Austausch)
>   bleibt als Karte, Details auf den Reitern. (Im Browser verifiziert.)
> - ✅ **Datenherkunft & Vertrauen (Legende):** auf Engpässe/Preise/Rabatte klärt eine
>   aufklappbare Legende (Standard: zu) auf, was ✔ BASG-verifiziert / 📌 Referenzdaten /
>   📰 Redaktion / 👥 Community-Meldung bedeuten, und macht die Quellenpflicht sichtbar
>   — Vertrauen für nicht-technische Fachleute. (Im Browser verifiziert.)
> - ✅ **Preisverlauf-Sparkline:** jede Lieferanten-Zeile im Preisvergleich zeigt eine
>   kompakte Trendlinie aus den letzten Preisen (steigend rot / fallend grün / gleich
>   grau) — die Richtung steht zusätzlich als ▲/▼-Prozent daneben, also nie nur über
>   Farbe (barrierefrei). Einzelserie, dünne 2px-Linie, dezent. (Frontend-SVG aus dem
>   `series`-Feld; im Browser verifiziert.)
> - ✅ **Beobachtungsliste — „Alle kritischen beobachten":** ein Klick setzt alle aktuell
>   kritischen Wirkstoffe auf die Beobachtungsliste (erscheint bei ≥2 Vorschlägen). (Im Browser verifiziert.)
> - ✅ **Beobachtungsliste — Schnell-Vorschläge:** die Beobachtungsliste auf „Für dich"
>   schlägt aktuell kritische Wirkstoffe als Ein-Klick-Chips vor („🔴 Amoxicillin +"),
>   solange sie noch nicht beobachtet werden — neue Nutzer:innen kommen sofort zum
>   Nutzen, ohne Tippen. (Frontend, aus `overview.shortages.top`; im Browser verifiziert.)
> - ✅ **Engpässe filtern & suchen:** der Engpässe-Reiter hat eine Such- und Filterleiste
>   (Alle / 🔴 Nur kritisch / ⭐ Beobachtet / 👥 Community) plus Textsuche nach
>   Wirkstoff/Präparat. Filterung ohne Neu-Laden (Suchfokus bleibt erhalten) — wichtig,
>   da die Liste mit Community-Meldungen wächst. (Frontend-Filter über die vorhandenen
>   Felder; 160 Tests grün, im Browser verifiziert.)
> - ✅ **Aktionen zu beobachteten Wirkstoffen (Beobachtungsliste ↔ Rabatte):** läuft für
>   einen Wirkstoff, den die Apotheke beobachtet, gerade eine Rabatt-Aktion, erscheint sie
>   auf „Für dich" als eigene Karte („🏷️ Aktionen zu deinen Wirkstoffen" — beste Aktion je
>   Wirkstoff, mit Ablaufhinweis). Verbindet Engpass-Beobachtung und Einkaufs-Vorteil.
>   (`overview.watch_deals`; 160 Tests grün, API/Browser verifiziert.)
> - ✅ **Rabatt-Ablaufwarnung:** laufende Aktionen tragen die Restlaufzeit; endet eine
>   Aktion in ≤14 Tagen, zeigt der Rabatt-Reiter ein „⏳ nur noch X Tage"-Badge
>   (≤3 Tage rot, sonst orange). Die Startübersicht „Für dich" warnt zusätzlich
>   („N Aktionen laufen bald ab" + dringendste Aktion) — kein verpasstes Angebot mehr.
>   (`rabatteRepo.listTop10` liefert `days_left`/`expiring_soon`, Overview `rabatte_expiring`;
>   158 Tests grün, im Browser verifiziert.)
> - ✅ **Preisvergleich mit Sparpotenzial:** der Preis-Reiter zeigt oben, wie viel bei
>   optimaler Großhändler-Wahl je Packung frei wird („💶 Sparpotenzial: bis zu € X pro
>   Packung" + Top-3-Präparate); jede Vergleichsgruppe trägt ein Ersparnis-Badge
>   („💰 −€ X günstiger bei …"), der günstigste Anbieter ist hervorgehoben. Konkreter
>   Marge-Vorteil auf einen Blick. (`GET /api/prices` liefert `savings`; 154 Tests grün,
>   im Browser verifiziert.)
> - ✅ **Community-Engpassmeldung („Frühwarnnetz"):** Apotheker:innen melden selbst
>   beobachtete Lieferengpässe („➕ Engpass melden" auf dem Engpässe-Reiter) — oft weiß
>   die Frontline früher Bescheid als offizielle BASG-Daten. Herkunft klar als
>   👥 Community-Meldung gekennzeichnet (nicht offiziell verifiziert), mit Melder-Handle.
>   Beobachter:innen des Wirkstoffs werden sofort benachrichtigt. Andere Apotheken
>   bestätigen mit „➕ Auch bei uns" (Zähler „N weitere Apotheken bestätigt", Melder wird
>   informiert). Doppel-/Fehlklick-Schutz, Melder-Identität DSGVO-anonymisierbar.
>   Die meldende Apotheke (oder Moderation) schließt die Meldung mit „✓ Wieder lieferbar";
>   Beobachter:innen **und** Bestätiger:innen werden informiert, danach ist der Wirkstoff
>   wieder frei meldbar. (`POST /api/shortages/report|:id/confirm|:id/resolve`; 149 Tests
>   grün, end-to-end im Browser verifiziert.)
> - ✅ **Engpass-Status-Alarm für beobachtete Wirkstoffe:** ändert die Redaktion/
>   Moderation den Status eines Engpasses (nur mit **Pflicht-Quelle**, http[s]-Link —
>   sicherheitsrelevant lt. CLAUDE.md), werden alle Apotheker:innen benachrichtigt,
>   die diesen Wirkstoff beobachten („⭐ Neuer Status bei deinem beobachteten
>   Wirkstoff: Amoxicillin · Wieder verfügbar"). Klick springt zu den Engpässen.
>   Redaktions-Editor direkt an jeder Engpass-Karte. (`POST /api/shortages/:id/status`;
>   136 Tests grün, end-to-end im Browser verifiziert.)
> - ✅ **Beobachtungsliste (Wirkstoffe im Blick):** Apotheker:innen merken sich die
>   Wirkstoffe, die sie regelmäßig führen (☆ Beobachten an jedem Engpass **oder**
>   Eingabefeld auf „Für dich"); der aktuelle Engpass-Status steht dann oben auf der
>   Startübersicht — kritische zuerst (Farb-Semantik rot = kritisch), mit Quelle/Herkunft.
>   Kein Engpass = „Aktuell keine Meldung". In Snapshot-Persistenz + DSGVO-Löschung
>   eingebunden. (`GET/POST /api/watchlist`, `DELETE /api/watchlist/:wirkstoff`;
>   129 Tests grün, im Browser verifiziert.)
> - ✅ **Feed-Sortierung (Öffentlich):** Umschalter „🕒 Neueste / 🔥 Beliebteste"
>   über dem öffentlichen Feed — Beliebteste zeigt die meist-reagierten Beiträge
>   zuerst (Summe aller Reaktionen), damit wichtige Fach-Diskussionen nicht
>   untergehen. (`GET /api/feed/public?sort=top|neu`; 119 Tests grün, im Browser verifiziert.)
> - ✅ **@Erwähnungs-Autovervollständigung:** beim Tippen von `@…` im Compose-/News-Feld
>   werden passende Handles vorgeschlagen (Präfix zuerst), Auswahl fügt `@handle` ein.
>   (`GET /api/handles?q=`; 118 Tests grün, im Browser verifiziert.)
> - ✅ **Bilder in Kommentaren:** Foto an einen Kommentar anhängen (📷 am Kommentarfeld,
>   Client-Verkleinerung + gemeinsame Media-Validierung), Bild-only-Kommentar erlaubt.
>   (117 Tests grün, im Browser verifiziert.)
> - ✅ **Folge-Vorschläge:** leerer „Mein Feed" zeigt „👥 Vorschläge zum Folgen"
>   (Profile, denen man noch nicht folgt, aktivste zuerst) mit „+ Folgen" — hilft
>   neuen Nutzer:innen, das Netzwerk aufzubauen. (`GET /api/suggestions/follow`;
>   115 Tests grün, im Browser verifiziert.)
> - ✅ **Beitrag teilen (Direktlink):** „🔗 Teilen" kopiert einen Link (`/?post=ID`);
>   beim Öffnen springt die App direkt zum Beitrag (Deep-Link, Sichtbarkeit erzwungen).
>   (114 Tests grün, im Browser verifiziert.)
> - ✅ **Einzelne Benachrichtigung als gelesen** beim Anklicken (`/api/notifications/:id/read`).
> - ✅ **Konto löschen (DSGVO — Recht auf Löschung):** mit Passwort-Bestätigung; purge
>   über alle Repos (Profil, Beiträge, Kommentare, Reaktionen, Follows, DMs, Merkliste,
>   Verifizierung, Austausch-Einträge, Nutzer + Login). (`POST /api/me/delete`; 114 Tests
>   grün, end-to-end verifiziert: Login danach unmöglich, andere Daten unberührt.)
> - ✅ **Passwort ändern:** altes Passwort prüfen (scrypt), neues (≥8) setzen
>   (`POST /api/me/password`, `orgAuth.changePassword`). UI in der Konto-Karte am
>   eigenen Profil. (113 Tests grün, end-to-end per API verifiziert.)
> - ✅ **DSGVO-Datenexport (Datenübertragbarkeit):** „⬇️ Meine Daten exportieren" auf
>   dem eigenen Profil lädt alle eigenen Daten als JSON (Profil, Beiträge, Kommentare,
>   Merkliste, Direktnachrichten, Verifizierung, Austausch-Einträge; `GET /api/me/export`).
>   (110 Tests grün, Endpoint verifiziert.)
> - ✅ **Kommentare melden:** 🚩 an fremden Kommentaren → Moderations-Queue (mit
>   Kommentartext + „💬 Kommentar"-Kennzeichnung); „Kommentar entfernen" löscht ihn.
>   Schließt die Moderations-Lücke (bisher nur Beiträge). (`POST /api/comments/:id/report`;
>   109 Tests grün, im Browser verifiziert.)
> - ✅ **Lesezeichen / „Merken":** Beiträge für später merken (🔖 an jedem Beitrag,
>   Status in der App gespiegelt), Merkliste über „Für dich" öffnen. Sichtbarkeit
>   erzwungen, gelöschte Beiträge fallen raus, in Snapshot-Persistenz. (`/api/posts/:id/bookmark`,
>   `/api/bookmarks`; 108 Tests grün, im Browser verifiziert.)
> - ✅ **Austausch-Historie („Meine Einträge") + Wieder öffnen:** eigene Biete/Suche-
>   Einträge inkl. erledigter einsehen (`GET /api/exchange/mine`), erledigte
>   wieder öffnen (`/:id/reopen`, nur Ersteller, löst erneut Matching aus). Reiter-Filter
>   „🗂️ Meine". (105 Tests grün, im Browser verifiziert.)
> - ✅ **Dunkelmodus:** augenschonender Hell/Dunkel-Umschalter (🌙/☀️) im Header, in
>   localStorage gemerkt, per CSS-Variablen (Karten/Eingaben/Kontrast angepasst,
>   theme-color aktualisiert). (Im Browser verifiziert.)
> - ✅ **Profil-Verifizierung (Apotheken-Nachweis):** Nutzer beantragen Verifizierung
>   (Hinweis mit Konzession/Apotheke), Redaktion/Moderation genehmigt oder lehnt ab;
>   Genehmigung setzt `verified` → „✔ verifiziert"-Badge an Profil und Beiträgen, plus
>   Benachrichtigung. Nur-Moderator-Queue, in Snapshot-Persistenz eingebunden.
>   (`/api/verify/*`; 104 Tests grün, im Browser verifiziert.)
> - ✅ **Barrierefreiheit / Feinschliff (Owner-UX-Vorgabe):** Schriftgrößen-Umschalter
>   A / A⁺ / A⁺⁺ (16/19/22px, in localStorage gespeichert; zentrale Textgrößen auf `em`
>   umgestellt, damit sie mitskalieren), sichtbarer Tastatur-Fokus, größere Klickflächen
>   (Buttons ≥44px, Eingaben ≥46px, Touch-Ziele), höherer Kontrast (dunkleres Grau),
>   aria-labels auf Icon-Buttons, Kopfzeile auf schmalen Screens entlastet. (Im Browser verifiziert.)
> - ✅ **Startübersicht „Für dich":** neuer Standard-Reiter mit dem Wichtigsten auf
>   einen Blick — Kennzahlen (kritische Engpässe, Angebote/Gesuche, neue
>   Benachrichtigungen), Top-3 kritische Engpässe, zuletzt im Austausch, Top-Rabatt;
>   alles anklickbar zum jeweiligen Bereich (`GET /api/overview`, `overviewService`
>   komponiert getestete Dienste). (100 Tests grün, im Browser verifiziert.)
> - ✅ **Aktives Matching (Biete ↔ Suche):** legt jemand ein Angebot an, das zu einer
>   offenen Suche passt (gemeinsames Wirkstoff-Wort), wird die suchende Person automatisch
>   benachrichtigt — und umgekehrt. Kein ständiges Nachschauen. Benachrichtigung mit Label,
>   Klick öffnet den Austausch gefiltert. (`social.pushNotification`, Notif-Feld `label`;
>   99 Tests grün, im Browser verifiziert.)
> - ✅ **Standort-Filter im Bestandsaustausch:** Einträge tragen ein Bundesland (AT,
>   9 Länder, serverseitig validiert); im Reiter nach Bundesland filterbar — Ware in
>   der Nähe finden. (`GET /api/exchange?bundesland=`; 98 Tests grün, im Browser verifiziert.)
> - ✅ **Fotos im Bestandsaustausch:** Biete/Suche-Einträge können ein Foto tragen
>   (z.B. Charge/Ablaufdatum) — schafft Vertrauen beim Tausch. Bild-/Quellen-Validierung
>   in gemeinsames Modul `domain/media.js` ausgelagert (von Social + Austausch genutzt).
>   (96 Tests grün, im Browser verifiziert.)
> - ✅ **Engpass ↔ Bestandsaustausch verknüpft:** an jedem Engpass ein Button
>   „🔄 Biete/Suche" → springt in den Austausch, vorgefiltert auf den Wirkstoff
>   (zeigt sofort, wer ihn bietet/sucht). Austausch-Reiter zusätzlich mit Textsuche
>   nach Präparat (`GET /api/exchange?q=`). (95 Tests grün, im Browser verifiziert.)
> - ✅ **Bilder & Quellen in Beiträgen/News:** Bild posten (Client verkleinert auf
>   ~1200px/JPEG → kleine `data:image`-URL, serverseitig auf Format/Größe geprüft, nur
>   `data:image`, kein Fremd-Host/Skript), Quelle als http(s)-Link (`🔗 Quelle`,
>   javascript:/data:-URLs abgelehnt). News zeigen Quellenangabe (Seed-News mit
>   BASG/Kammer/Gehaltskasse verlinkt) — passt zur Regel „Aussagen nur mit Quelle".
>   Body-Limit auf 2 MB erhöht. (94 Tests grün, im Browser verifiziert.)
> - ✅ **Bestandsaustausch (Biete & Suche):** löst das tägliche Engpass-Problem —
>   Apotheke mit Überbestand findet die, die sucht. Eigenes Modul (`db/exchange.sql`,
>   Repo/Service/Tests), Reiter „🔄 Biete/Suche" mit Formular, Filter (Angebote/Gesuche),
>   „✉️ Kontaktieren" (startet Direktnachricht — **keine öffentlichen Kontaktdaten**),
>   eigene Einträge als erledigt markieren/löschen. In Snapshot-Persistenz eingebunden.
>   (`GET/POST /api/exchange`, `/:id/resolve`, `/:id/delete`; 89 Tests grün, im Browser verifiziert.)
> - ✅ **Benachrichtigungen: informativ + anklickbar:** zeigen jetzt Wer (Akteur-Name),
>   Was (kommentiert/reagiert/gefolgt/erwähnt/DM) und Wann (relTime); Klick springt zum
>   Ziel — Follow → Profil, DM → Konversation, Kommentar/Reaktion/Erwähnung → **Einzelbeitrag-
>   Ansicht** (neu, `GET /api/posts/:id`) mit aufgeklappten Kommentaren. Ungelesene
>   hervorgehoben. (85 Tests grün, im Browser verifiziert.)
> - ✅ **Zeitstempel (Klartext):** Beiträge und Kommentare zeigen „vor 3 Stunden" /
>   „gerade eben" / Datum (relTime, de-AT), Tooltip mit exaktem Zeitpunkt. Wichtig für
>   zeitkritische Themen (Engpässe/News). (Frontend; im Browser verifiziert.)
> - ✅ **Onboarding/Willkommen:** beim ersten Login ein kurzer, freundlicher Overlay
>   („So funktioniert ApoTrend": posten, folgen, Marktdaten, DMs, Suche/Themen) plus
>   „Als App installieren"-Tipp; per ❓ jederzeit wieder aufrufbar, Merker in
>   localStorage. (Frontend; im Browser verifiziert.)
> - ✅ **PWA (installierbar auf allen Geräten):** `manifest.webmanifest`, App-Icons
>   (Pharma-Kreuz), Theme-Farbe, Apple-Touch-Icon und minimaler Service Worker
>   (`sw.js`, netzwerk-durchreichend → keine veralteten Stände). App lässt sich auf
>   Handy-Startbildschirm/Desktop „installieren" und öffnet im Vollbild — eine
>   Codebasis für Computer/Laptop/Tablet/Smartphone, kein App-Store nötig. Statische
>   Auslieferung um PNG/SVG/Manifest-MIME-Typen erweitert. (Im Browser verifiziert:
>   Manifest erkannt, SW registriert.)
> - ✅ **Priorität 1 — Social-Feed (Kern, personenzentriert), KOMPLETT:** Fachprofile ·
>   kurze Posts (public/followers) · Kommentar-Threads · typisierte Reaktionen ·
>   gerichtete Follows · Home-/Öffentlich-Feed · **Direktnachrichten (1:1)** ·
>   **Benachrichtigungen** (Follow/Kommentar/Reaktion/@Mention/DM) · **Melden/Moderation** ·
>   DSGVO-Hard-Delete. (35 Tests grün.)
> - ✅ **Priorität 2 — Lieferengpässe (mit Feed verknüpft):** Engpass-Liste mit
>   **Herkunfts-Flag** (verifiziert/Referenz/simuliert), „Dazu posten" aus dem
>   Engpass heraus, „X Apotheker haben dazu gepostet", Engpass-Chip am Beitrag im
>   Feed (`posts.ref_type='shortage'`). (40 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 3 — Preise (mit Feed verknüpft):** Preisvergleich je Präparat
>   (mehrere Lieferanten, günstigster oben), Trend (▲/▼ %), Herkunfts-Flag,
>   „Dazu posten" + Preis-Chip am Beitrag (`posts.ref_type='price'`). (43 Tests grün.)
> - ✅ **Priorität 4 — News (im selben Feed-System):** News = Beiträge mit `kind='news'` —
>   kuratierte Redaktions-Beiträge (Account `@apotrend`, `is_editorial`, 📰-Badge) **plus**
>   von Nutzern geteilte News. Eigene News-Ansicht (`GET /api/news`), Sichtbarkeit
>   (public/followers) wird respektiert, News erscheinen auch im normalen Feed. (47 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 5 — Top-10-Rabatte (mit Feed verknüpft):** befristete Aktionsangebote
>   je Präparat, **Ranking nach Rabatt-Höhe** (höchster zuerst, max. 10), nur laufende
>   Aktionen (abgelaufene ausgeblendet), Listenpreis→Aktionspreis + Ersparnis + Gültigkeit,
>   Herkunfts-Flag, „Dazu posten" + Aktions-Chip am Beitrag (`posts.ref_type='rabatt'`).
>   (51 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 6 — Profil-Detailseite:** Klick auf @Handle/Name → Profilseite mit
>   Avatar, Fachgebieten, Zählern (Beiträge/Follower/folgt), Folgen/Entfolgen und den
>   sichtbaren Beiträgen der Person (`GET /api/profiles/:handle/page`, Sichtbarkeit
>   erzwungen). (55 Tests grün, im Browser verifiziert.)
> - ✅ **Priorität 7 — Übergreifende Suche:** ein Suchbegriff, gebündelte Treffer aus
>   allen Modulen — Personen (Handle/Name/Fachgebiet), Beiträge (sichtbarkeitsgefiltert),
>   Engpässe, Preise, Rabatte (`GET /api/search?q=`). Ergebnisseite gruppiert nach Typ.
>   (60 Tests grün, im Browser verifiziert.)
> - ✅ **Moderation in der UI (Löschen/Melden):** eigene Beiträge löschen (🗑,
>   nur der Autor, serverseitig erzwungen), fremde Beiträge melden (🚩 →
>   `POST /api/posts/:id/report`, Moderations-Queue). Erfüllt die Owner-Vorgabe
>   „Beiträge löschen/melden". (Im Browser verifiziert.)
> - ✅ **#Hashtags / Themen:** `#tag` in Beiträgen/Kommentaren wird verlinkt; Klick
>   öffnet eine Themen-Ansicht mit allen sichtbaren Beiträgen dazu (`GET /api/hashtag/:tag`,
>   exaktes Tag, kein Präfix-Treffer, Sichtbarkeit erzwungen). (82 Tests grün, im Browser verifiziert.)
> - ✅ **@Erwähnungen anklickbar:** `@handle` in Beiträgen und Kommentaren wird
>   grün hervorgehoben und verlinkt aufs Profil (E-Mails werden nicht fälschlich
>   als Erwähnung erkannt). Mention-Benachrichtigung existierte schon. (Frontend;
>   im Browser verifiziert.)
> - ✅ **Reaktionen auf Kommentare:** dieselben typisierten Reaktionen (hilfreich/
>   danke/bestätigt/interessant) auch je Kommentar, Zähler in `listComments`,
>   eine Reaktion je Nutzer+Ziel (umschaltbar). (`POST /api/comments/:id/react`;
>   78 Tests grün, im Browser verifiziert.)
> - ✅ **Verschachtelte Antworten (Kommentar-Threads):** Antworten auf Kommentare
>   werden als eingerückter Baum dargestellt (`parent_comment_id`), „↩ Antworten" je
>   Kommentar, Eltern-Autor:in wird benachrichtigt. (Frontend-Baum aus flacher Liste;
>   im Browser verifiziert.)
> - ✅ **Kommentare bearbeiten/löschen + Autor sichtbar:** Kommentare zeigen jetzt
>   Verfasser:in (anklickbar → Profil); eigene Kommentare inline bearbeiten (✏️,
>   `edited_at`) oder löschen (🗑), nur der Autor (serverseitig erzwungen). Thread
>   bleibt beim Posten offen, Zähler aktualisiert lokal. (`POST /api/comments/:id/edit`,
>   `/delete`; 76 Tests grün, im Browser verifiziert.)
> - ✅ **Beitrag bearbeiten:** eigene Posts nachträglich korrigieren (inline, `✏️
>   Bearbeiten`), `edited_at` wird gesetzt und als „✏️ bearbeitet" angezeigt. Nur der
>   Autor (serverseitig erzwungen), gelöschte Beiträge nicht editierbar.
>   (`POST /api/posts/:id/edit`; 72 Tests grün, im Browser verifiziert.)
> - ✅ **Profil bearbeiten:** eigenes Profil pflegen — Anzeigename, Titel/Funktion,
>   Bio (max. 500), Fachgebiete (Komma-getrennt). „✏️ Profil bearbeiten" auf dem
>   eigenen Profil (`POST /api/profile`, nur eigenes; Handle bleibt unveränderlich).
>   (68 Tests grün, im Browser verifiziert.)
> - ✅ **Moderations-Ansicht (nur Redaktions-/Admin-Konto):** 🛡️-Queue der offenen
>   Meldungen mit Beitrag, Melder:in und Grund; „Beitrag entfernen" oder „In Ordnung".
>   Moderator = Konto mit `is_editorial` (Login über `APOTREND_ADMIN_EMAIL/PASSWORD`).
>   Zugriff für Nicht-Moderator:innen serverseitig geblockt (403). (`GET /api/reports`,
>   `POST /api/reports/:id/resolve`; im Browser + per API verifiziert.)
> - ✅ **Priorität 8 — Direktnachrichten-Oberfläche (Kern-Feature komplett):** 1:1-Chat
>   zwischen Apotheker:innen — Posteingang mit letzter Nachricht + Ungelesen-Zähler,
>   Konversationsansicht (eigene/fremde Bubbles), „✉️ Nachricht" vom Profil aus,
>   ✉️-Badge in der Kopfzeile, Öffnen markiert als gelesen. Fremde können Threads nicht
>   lesen (serverseitig erzwungen). (`GET /api/dm`, `/api/dm/:id`, `POST /api/dm/start`.)
>   (64 Tests grün, im Browser verifiziert.)
> - ✅ **Deployment-fähig gemacht:** `/api/health`-Endpunkt, `Dockerfile`,
>   `render.yaml` (Render-Blueprint) und **`DEPLOY.md`** (Schritt-für-Schritt für
>   Render/Railway/Docker). App braucht einen Node-Host (nicht GitHub Pages!).
> - ✅ **Persistenz (Snapshot, Built-ins-only):** kompletter Zustand als JSON
>   auf Platte (`APOTREND_DATA_FILE`), Laden beim Start, Speichern nach jeder
>   Schreiboperation + beim Herunterfahren (atomar). Daten überleben Neustart —
>   **im echten Server-Neustart verifiziert**. Ohne die ENV-Variable: reines
>   In-Memory (Tests unverändert). Postgres/EU bleibt der Cloud-Zielschritt
>   hinter demselben Repository-Seam.
> - ✅ **Baustein 1 — Fundament:** Organisationen · Nutzer · Mitgliedschaften ·
>   echte Auth (scrypt) · Mandanten-Isolation + RBAC.
> - ✅ **Baustein 2 — collab (Teams-artig):** Kanäle · Nachrichten · Notizen ·
>   Aufgaben — alles apothekenintern gescoped, RBAC + Isolation erzwungen.
> - ✅ **Baustein 3 — network (Phase 4):** Profile · Kontakte · Feed · Direktnachrichten
>   — org-übergreifend, aber mit expliziter Sichtbarkeit (network / nur-Kontakte).
> - ⏳ **Baustein 4 — market (Phase 3):** Integration des bestehenden Kerns + Herkunfts-Flag.
> - ⏳ **HTTP-/Echtzeit-Schicht** (Framework + WebSocket) — Tech-Stack-Entscheidung Phase 6.

## Prinzipien
- **Repository-Seam:** Die Service-Schicht kennt nur ein Repository-Interface
  (`src/repo/`). Heute läuft eine **In-Memory-Umsetzung** (lauffähig & testbar
  ohne externen Dienst); Ziel-Persistenz ist **PostgreSQL, EU-gehostet**
  (`db/schema.sql`) — dieselbe Philosophie wie im bestehenden `assistant/`.
- **Keine Klartext-Passwörter:** nur scrypt-Hash (Node-Built-in, kein Dependency).
- **Mandanten-Grenze = Apotheke:** jede geschützte Aktion läuft über
  `assertCan(userId, organizationId, capability)` — Zugriff über Apotheken-Grenzen
  hinweg ist damit strukturell ausgeschlossen (serverseitig, nicht im Client).
- **Pharmareferent** gehört zu einer `supplier`-Organisation, nie in eine Apotheke.

## Struktur
```
server/
  db/schema.sql              Postgres-Zielschema (Fundament)
  src/domain/password.js     scrypt-Hashing (hash/verify, timing-safe)
  src/domain/roles.js        Org-Typen, Rollen, RBAC-Fähigkeiten
  src/repo/memoryRepo.js     Repository-Interface + In-Memory-Umsetzung
  src/services/orgAuth.js    Registrierung, Login, Mitgliedschaften, Isolation
  src/services/collab.js     Kanäle · Nachrichten · Notizen · Aufgaben (RBAC + Isolation)
  src/services/network.js    (org-zentriert; wird vom Social-Layer abgelöst)
  src/repo/socialRepo.js     Social-Store (Profile/Posts/Kommentare/Reaktionen/Follows)
  src/services/social.js     Prio-1-Feed: Posts · Kommentare · Reaktionen · Follows · Feed
  db/collab.sql              Postgres-Schema des collab-Moduls
  db/network.sql             Postgres-Schema des (abgelösten) org-network-Moduls
  db/social.sql              Postgres-Schema des Social-Layers (Prio 1)
  test/                      node --test (ohne externe Abhängigkeiten)
```

## Lauffähige App (Feed, klickbar)
```bash
cd server
npm start                 # startet http://localhost:4000
```
Öffnen im Browser → registrieren → posten, folgen, kommentieren, reagieren.
HTTP-API (Node-Built-ins, kein Framework) in `src/http/`, Oberfläche in `public/`.
Persistenz derzeit **In-Memory** (Neustart = leer) — Postgres kommt hinter denselben
Repository-Seam.

## Tests
```bash
cd server
npm test          # node --test (35 grün)
```

## Nächste Bausteine (Phase 2/4)
1. **collab**: Channel · Message · Note · Task (+ HTTP-API, Echtzeit-Transport).
2. **network**: PharmacyProfile · Connection · FeedPost · DirectMessage.
3. **Postgres-Repo** hinter demselben Interface (Deployment/Phase 6).
4. **HTTP-/Echtzeit-Schicht** (Framework + WebSocket) — Tech-Stack-Entscheidung Phase 6.
