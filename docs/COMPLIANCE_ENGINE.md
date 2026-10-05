# Dynamic Country Compliance, Mehrwährungs-Abos, Hybrid-Zahlungen

> **⚠️ Kein Rechtsrat / Not legal advice.**
> Wie [`server/docs/LEGAL_COUNTRY_MATRIX.md`](../server/docs/LEGAL_COUNTRY_MATRIX.md) ist
> dies eine **konservative Compliance-Einschätzung zur Produktsteuerung**, kein anwaltlicher
> Rat. Im Zweifel wurde die strengere Bewertung gewählt. Alle Profile sind
> **vom Betreiber übersteuerbar** und vor produktivem Einsatz von qualifizierten
> Jurist:innen der jeweiligen Rechtsordnung zu prüfen.

---

## Was das System tut

Beim Wechsel des Landes ändern sich drei Dinge gleichzeitig:

| | wird zu |
|---|---|
| **Handels-Modus** | `SAAS_ONLY` ⟷ `MARKETPLACE_FEES` |
| **Gebührenmodell** | `SAAS_FLAT` ⟷ `COMMISSION_FEE` |
| **Zahlwege** | lokale Fiat-Schienen je Land — **Krypto bleibt immer** |

Dazu Währung, Pflichtfelder im Checkout und die Hinweistexte.

**Ausprobieren:** `/checkout-demo.html` auf dem laufenden Server, oder
[`docs/demos/dynamic-checkout.html`](demos/dynamic-checkout.html) direkt im Browser öffnen.

---

## Das Krypto-Gebot ist eine Zusicherung, keine Bitte

Owner-Vorgabe: Krypto-Zahlung ist in **jedem** Land für **jeden** Zweck verfügbar und
darf nicht herausgefiltert werden — für grenzüberschreitende B2B-Lizenzen,
Händler-Guthaben und internationale Transaktionen.

Ein Kommentar im Code hätte das nicht gesichert. Deshalb steht die Regel auf **drei Ebenen**:

| Ebene | Ort | Wirkung |
|---|---|---|
| **Laufzeit** | `assertCryptoAvailable()` in `compliance.js` | wird am Ende **jeder** Methodenliste aufgerufen und **wirft**, wenn die Schiene fehlt |
| **Test** | `test/compliance-engine.test.js` | prüft *alle* Länder × *alle* Zwecke; ein Filter, der Krypto mit erwischt, wird sofort rot |
| **Datenbank** | `enforce_crypto_rail_present()` | Trigger: ein aktives Land ohne aktive Krypto-Methode lässt sich nicht speichern |

`CountryPaymentMethod` hat bewusst **keine** Spalte, mit der sich die Krypto-Schiene
länderweise abschalten ließe.

**Ein Hinweis zur Praxis, keine Einschränkung des Auftrags:** Krypto-Annahme im
gewerblichen Rahmen bringt Pflichten mit sich — Geldwäscheprävention und
Herkunftsnachweise (in DE: GwG), seit MiCA außerdem Anforderungen an Anbieter von
Krypto-Dienstleistungen. Das ist eine Frage des Anbietervertrags und der Prozesse,
nicht der Architektur. Praktisch entschärft sich der heikelste Fall von selbst: In
DACH gibt es gar keine Marktplatz-Bestellung, dort bezahlt Krypto also **Lizenzen und
Guthaben**, nie Arzneimittel.

---

## Länderprofile

### DACH — Österreich, Deutschland, Schweiz, Liechtenstein

`SAAS_ONLY` · `transactionFeeAllowed: false`

**Keine prozentuale Verkaufsprovision auf Arzneimittel.** Das ist nicht als Voreinstellung
gemeint, sondern als Sperre: `paymentMethodsFor(country, 'marketplace_order')` **wirft**
dort, und `feeModel()` ebenfalls. Eine Marktplatz-Bestellung ist in DACH kein
konfigurierbarer Zustand, sondern gar nicht erst erreichbar.

Verdient wird an Software-Lizenzen, gekennzeichneten Hersteller-Beiträgen und —
gar nicht — an der **Notfall-Aushilfe zwischen Apotheken, die dauerhaft kostenfrei bleibt.**

Zahlwege: SEPA-Lastschrift, Karte, Rechnung, Überweisung. In CH/LI kein SEPA (Nicht-EU),
Abrechnung in CHF.

### Portugal und EU

`SAAS_ONLY` · MB WAY steht **vor** der Karte, weil es dort der verbreitetste Zahlweg ist.
Rechtsrahmen: Decreto-Lei 176/2006, Richtlinie 2001/83/EG, DSGVO. Aufsicht: INFARMED.

### Angola, Moçambique, Nigeria, Kenia, Ghana, Südafrika

`MARKETPLACE_FEES` · `transactionFeeAllowed: true`

Marktplatz-Transaktionsgebühren sind freigeschaltet: **2,5 % Vermittlung + 1,5 % Logistik**
(ZA: 2,0 % + 1,0 %). Gerechnet wird in Basispunkten, nicht in Prozent-Fließkommazahlen.

Pflicht bei jeder Warenbestellung — der Kern der Regulierung in diesen Märkten ist der
**Nachweis gegen gefälschte Arzneimittel**:

- Einfuhr-Lizenznummer
- GMP-/Herkunftszertifikat (Datei-Upload)
- Apotheken-/Betriebserlaubnis

Zahlwege: Multicaixa Express (AO), M-Pesa (KE), Paystack (NG/GH), Karte, Rechnung.

> Diese Nachweise werden **nur bei `marketplace_order`** verlangt. Bei einer reinen
> Software-Lizenz gibt es keine Ware — ein Herkunftszertifikat dafür wäre eine Hürde
> ohne sachlichen Grund.

### USA

`SAAS_ONLY` · Rückverfolgbarkeit **DSCSA**

Die **FDA Establishment Registration Number** ist Pflichtfeld im Checkout
(`^[0-9]{7,11}$`), die DEA-Nummer optional für kontrollierte Substanzen. Ein
Datenbank-Trigger verlangt bei jeder abgeschlossenen Transaktion in einem Land mit
Rückverfolgbarkeits-Regime einen `traceabilityHash` plus `complianceSnapshot`.

Marktplatz-Provision ist **konservativ nicht** freigeschaltet: Die Großhandelserlaubnis
ist einzelstaatlich geregelt. Der Betreiber kann sie je Bundesstaat freischalten
(`withOverrides`).

---

## Aufbau

```
server/src/domain/compliance.js   Engine: Profile, Zahlwege, Gebühren, Manager
server/src/domain/qr.js           QR-Encoder (Byte-Modus, Stufe M, Version 1–12)
server/src/data/plans.js          Abo-Katalog mit Preisliste je Währung
server/test/compliance-engine.test.js   29 Tests (Länder, Gebühren, Krypto-Gebot)
server/test/crypto-wallets.test.js      14 Tests (Empfangswege aus echten Wallets)
server/src/data/cryptoWallets.js        die Empfangsadressen — EINZIGE Quelle
server/tools/verify-qr.mjs        QR gegen python-qrcode und segno prüfen
server/tools/build-checkout-demo.mjs    Demo bauen (Engine + Tailwind einbetten)
server/tools/check-checkout-demo.mjs    54 Browser-Prüfungen der Demo
docs/architecture/prisma-schema-commerce.prisma
docs/architecture/compliance-constraints-commerce.sql
```

### Warum eine Datei für Server und Browser

`compliance.js` hat **keine Node-Abhängigkeiten**. Der Demo-Build bettet dieselbe Datei
in die HTML-Seite ein, statt die Regeln nachzubauen. Zwei Fassungen derselben
Compliance-Regeln würden auseinanderlaufen — ausgerechnet an der teuersten Stelle.

### API

```
GET /api/compliance/:code                  Profil, Modus, Zahlwege, Felder, Gebühren
GET /api/compliance/:code/quote?amount=…   Gebühren-Vorschau für einen Betrag
GET /api/plans?country=…&interval=…        Pläne in der Landeswährung
GET /api/plans/:id/price?country=…         abrechenbarer Preis-Datensatz
GET /api/payments/wallets                  hinterlegte Krypto-Empfangswege (live)
```

### Der Zustands-Manager

```js
const manager = createComplianceManager({ country: 'AT' })
const off = manager.subscribe(() => render(manager.getState()))
manager.setCountry('AO')      // Modus, Währung, Gebühren, Zahlwege wechseln
manager.quote(1_000_000)      // -> { kind, bps, feeMinor, netMinor }
```

`subscribe(fn)` gibt eine Abmeldefunktion zurück und `getSnapshot()` liefert eine stabile
Referenz — genau die Form, die React `useSyncExternalStore` verlangt. Ein React-Context
ist damit ein Dreizeiler und **keine zweite Zustandshaltung**:

```jsx
const ComplianceContext = createContext(null)

export function ComplianceProvider({ children, country = 'AT' }) {
  const [manager] = useState(() => createComplianceManager({ country }))
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot)
  return <ComplianceContext.Provider value={{ ...state, manager }}>{children}</ComplianceContext.Provider>
}

export const useCompliance = () => useContext(ComplianceContext)
```

---

## Bewusste Entwurfsentscheidungen

- **Beträge als `BigInt` in der kleinsten Währungseinheit.** Ein Monatspreis in Kwanza
  liegt bei 45.000.000 Cêntimos. Nachkommastellen im Geldbetrag sind eine Fehlerquelle,
  die erst in der Buchhaltung auffällt.
- **`minorUnits` steht am Land.** Ein fest verdrahtetes `/100` wäre in mehreren Märkten
  schlicht falsch.
- **Feste Preisliste je Währung, keine Tageskurs-Umrechnung.** Ein Abo, dessen Betrag
  monatlich mit dem Wechselkurs schwankt, ist nicht planbar. Der FX-Dienst dient der
  Anzeige von Vergleichswerten, nicht der Abrechnung.
- **Fiat- und Krypto-Belege in getrennten Spalten.** Ein Transaktions-Hash ist öffentlich
  nachprüfbar, eine Stripe-Session-ID nicht. Unterschiedliche Beweiskraft gehört nicht
  in dasselbe Feld. `cryptoTxHash` ist eindeutig indiziert — sonst ließe sich ein
  fremder, öffentlich einsehbarer Hash zweimal einreichen.
- **Zwei partielle Unique-Indizes** statt eines zusammengesetzten: In PostgreSQL ist
  `NULL` nie gleich `NULL`, ein Index über nullbare Spalten würde nicht greifen.
- **Guthaben-Buchungen sind unveränderlich.** Korrekturen sind Gegenbuchungen, sonst ist
  der Saldo nicht rekonstruierbar.
- **Bezahlt ist nicht freigeschaltet.** Fehlt ein Pflichtnachweis, bleibt das Abo in
  `PENDING_COMPLIANCE` — auch wenn das Geld da ist. Diese Reihenfolge ist in den
  Importmärkten der eigentliche Fälschungsschutz.

---

## Der QR-Code

Selbst geschrieben, weil das Modal eine **einzelne, geschlossene Datei ohne Netzzugriff**
ist: Eine QR-Bibliothek per CDN wäre ein Ladefehler-Risiko und ein Datenschutzproblem,
weil der Aufruf die Wallet-Adresse beim CDN-Betreiber bekannt macht.

Ein selbstgebauter QR-Encoder ist allerdings nur so viel wert wie sein Nachweis — ein
Code, der aussieht wie einer, aber falsch decodiert, schickt Geld an eine fremde Adresse.
`npm run verify:qr` vergleicht deshalb die **Modul-Matrix Zelle für Zelle** gegen
`python-qrcode`, über 7 Nutzlasten × 8 Masken, plus eine Gegenprobe mit `segno`.

> Der Abgleich hat drei echte Fehler gefunden, die ohne ihn unentdeckt geblieben wären:
> die Bit-Reihenfolge der Formatinformation (LSB statt MSB), ein um vier Stellen
> gekürztes Generatorpolynom der Versionsinformation (fällt erst ab Version 7 auf) —
> und im Prüfer selbst, dass `segno` bei kurzen Nutzlasten stillschweigend einen
> **Micro-QR** erzeugt und der Vergleich damit nichts belegte.

**Bekannte Abweichung:** Bei Nutzlasten, die eine Version exakt ausfüllen, stimmen alle
drei Implementierungen überein. Sobald aufgefüllt werden muss, schiebt `segno` ein
zusätzliches `0x00` vor die Auffüllfolge; dieser Encoder und `python-qrcode` tun das
nicht. Beide Ergebnisse decodieren zum selben Text — Auffüllbytes liegen hinter dem
Zeichenzähler und werden ignoriert.

---

## Ihre Wallets — eine Quelle, kein Abtippen

Die Empfangsadressen stehen **ausschließlich** in
[`server/src/data/cryptoWallets.js`](../server/src/data/cryptoWallets.js). Das Modal
bettet diese Datei ein und zieht beim Laden zusätzlich die Live-Liste über
`GET /api/payments/wallets` — damit greifen ENV-Überschreibungen sofort, ohne neuen Build.
Woher die angezeigten Adressen stammen, steht im Modal („Adressen: live vom Server" bzw.
„eingebettet").

Hinterlegt sind vier Wallets:

| ID | Wert | Kette | Bezeichnung |
|---|---|---|---|
| `btc` | BTC | Bitcoin (Mainnet) | — |
| `eth` | ETH | Ethereum (Mainnet) | — |
| `sol_seeker` | SOL | Solana (Mainnet) | Seeker · leokennedy.skr |
| `sol_phantom` | SOL | Solana (Mainnet) | Phantom |

Daraus leitet `paymentRoutes()` die Zahlwege ab — **Stablecoins haben keine eigene
Adresse**: USDT und USDC über ERC-20 gehen an dieselbe Ethereum-Adresse wie ETH, USDC auf
Solana an dieselbe Solana-Adresse wie SOL. Beide Solana-Wallets stehen einzeln zur Wahl,
genau wie das Datenmodell es vorsieht.

### Steuerung über Umgebungsvariablen

| Variable | Wirkung |
|---|---|
| `APOPULSE_WALLET_BTC` / `_ETH` / `_SOL_SEEKER` / `_SOL_PHANTOM` | Adresse ersetzen |
| *dieselbe Variable auf leer* | **Wallet abschalten** — die zugehörigen Wege verschwinden |
| `APOPULSE_WALLET_TRON` | schaltet USDT über TRC-20 frei (braucht eine eigene Tron-Adresse) |
| `APOPULSE_EVM_NETWORKS="Polygon,Base"` | zusätzliche EVM-Ketten auf derselben Ethereum-Adresse |

> **Warum EVM-Ketten Opt-in sind:** Eine gewöhnliche Konto-Adresse gilt auf allen
> EVM-Ketten — es ist dieselbe Adresse aus demselben Schlüssel. Für ein
> Smart-Contract-Wallet (z. B. Safe) gilt das **nicht**, das existiert nur dort, wo es
> ausgerollt wurde. Von außen ist beides nicht unterscheidbar. Deshalb wird gefragt
> statt geraten: Bei MetaMask, Ledger oder Phantom können Sie die Ketten bedenkenlos
> freischalten.

> **Warum „leer" abschaltet:** Mit einem schlichten `||` fiele ein leerer Wert auf die
> Standardadresse zurück — eine Kette ließe sich dann gar nicht aus dem Angebot nehmen.

---

## Was in der Demo bewusst nicht passiert

- **Keine Wallet-Adresse wird erfunden.** Angeboten wird nur, wofür eine Adresse
  hinterlegt ist. USDT über TRC-20 erscheint erst, wenn `APOPULSE_WALLET_TRON` gesetzt
  ist — eine erfundene Adresse wäre der teuerste denkbare Platzhalter.
- **Warnung am Token-Weg.** Bei Stablecoins steht „Nur diesen Token auf dieser Kette
  senden" — ein anderer Token an dieselbe Adresse ist verloren.
- **Kein Betrag im Zahlungslink.** Ohne angebundenen Kursdienst wäre ein geschätzter
  Kurs eine falsche Zusage. Im Betrieb rechnet der Zahlungsdienst live um und zählt
  die Netzwerk-Bestätigungen (`services/cryptoRates.js`, `services/payments.js`).
- **Keine Zahlung wird ausgelöst.** Der echte Ablauf läuft über gehostete, lizenzierte
  Anbieter mit signierten Webhooks — nie „der Client sagt, es sei bezahlt".

## Jurisdiction-Guard: die Fachkreis-Schranke für Rx-Arzneimittel (04.10.2026)

> ⚠️ Kein Rechtsrat. Konservative Gating-Einschätzung zur Produktsteuerung; im
> Zweifel wurde die strengere Variante gewählt.

### Der Befund war akut, nicht hypothetisch

`GET /api/exchange` war angemeldet, aber **nicht auf Fachkreise beschränkt**.
Im Code stand ausdrücklich: „Privatnutzer:innen können Einträge lesen, aber
keine anlegen." Da die Registrierung Selbstbedienung ist, heißt das: Angebote
für verschreibungspflichtige Arzneimittel waren praktisch öffentlich lesbar.
In DACH ist Publikumswerbung für Rx-Arzneimittel untersagt (HWG § 10).

**Zwei Lecks, nicht eines.** Neben `list()` gab es `byAuthor()` — die
Profilansicht einer Apotheke. Sie war als „öffentlich lesbar wie die Liste"
kommentiert und nahm gar keinen Betrachter an. Die Liste zu schützen und das
Profil offen zu lassen hätte die Schranke wertlos gemacht. Dieselbe Prüfung
greift jetzt auch in `search.js` und `overview.js`.

### Fail closed: nichts wird geraten

Ob „Amoxicillin 1000 mg" verschreibungspflichtig ist, lässt sich aus einer
Zeichenkette **nicht** zuverlässig bestimmen — und der Fehler ginge in die
gefährliche Richtung: Ein falsches „nicht verschreibungspflichtig" stellt ein
Rx-Angebot öffentlich.

Deshalb trägt jedes Angebot eine Kennzeichnung, die die einstellende Fachperson
setzt:

| Wert | Bedeutung | Sichtbarkeit |
|---|---|---|
| `otc` → `false` | ausdrücklich nicht verschreibungspflichtig | alle |
| `rx` → `true` | verschreibungspflichtig | nur verifizierter Fachkreis |
| alles andere → `null` | **unbestimmt** (Standard) | nur verifizierter Fachkreis |

`normalizeRx` lässt nur ein ausdrückliches `otc` zu `false` werden; ein
Tippfehler im Formular bleibt geschützt. Im Repo steht `rx: e.rx ?? null` und
nicht `?? false` — ein `false` als Standard hätte jeden Altbestand im Moment
des Einbaus öffentlich gestellt.

### Warum `verified` und nicht nur der Kontotyp

Den Kontotyp wählt man bei der Registrierung selbst. Eine Schranke, die nur
`account_type !== 'private'` prüft, ist mit einem Klick im Anmeldeformular
umgangen — eine Schranke auf dem Papier. Verlangt wird die von der Moderation
bestätigte Verifizierung.

**Die unbequeme Folge:** Solange niemand verifiziert ist, sieht fast niemand
Rx-Einträge. Das ist der korrekte Zustand, kein Defekt — und der Bereich
„Tauschbörse" ruht ohnehin (Audit vom 06.09.2026), die Schranke landet also
**vor** der Freischaltung, nicht danach.

### Verifizierungsstufen

```
UNVERIFIED · PENDING · VERIFIED_PHARMACY · VERIFIED_WHOLESALE
VERIFIED_MANUFACTURER · VERIFIED_LOGISTICS
```

`VERIFIED_LOGISTICS` gehört **nicht** zum Rx-Fachkreis: Ein
Transportunternehmen befördert Arzneimittel, es erwirbt sie nicht. Die Stufe
existiert, weil Logistiker eigene Funktionen brauchen — nur eben keinen
Rx-Einblick. Je mehr Gruppen hineindürfen, desto weniger ist die Schranke wert.

Dazu zwei neue Kontotypen: `wholesale` und `logistics`. Beide unter „pharma" zu
führen hätte genau diesen Unterschied gelöscht.

### Die zwei Länder-Mechanismen dürfen sich nicht verwechseln

1. **Anzeigefilter `country`** folgt dem Länder-Umschalter („Besuchen"). Eine
   Berliner Apotheke darf sich ansehen, was in Wien los ist.
2. **Rx-Schranke** folgt dem **Heimatland**. Eine deutsche Apotheke ist in
   Österreich nicht erwerbsberechtigt.

Wäre die Schranke an den Anzeigefilter gekoppelt, ließe sie sich mit einem
Klick im Länder-Umschalter umgehen — dieselbe Falle, die das Rechts-Gate schon
einmal hatte (`userCountry` ignoriert `?country=` genau deshalb). Ein Test
hält beide Mechanismen auseinander.

### Ehrliche Meldung statt leerer Liste

`filterRx` **zählt**, was es verbirgt, und nennt den Grund
(`unverifiziert | pruefung | anmeldung | entzogen | kein_land | anderes_land`).
Die Oberfläche sagt damit „3 Angebote sind für dich nicht sichtbar — …" statt
stillschweigend eine kürzere Liste zu zeigen. Eine Schranke ohne Erklärung
sieht aus wie ein leerer Bereich, und das Signal wäre falsch: Es ist etwas da,
nur nicht für diese Person.

### Datenmodell

`User.jurisdiction`, `User.verificationStatus`, `User.licenseNumber`,
`User.isRxAllowed` (Migration `20261004200000_jurisdiction_guard`).

**Die Durchsetzung wartet nicht auf diese Spalten.** `domain/jurisdiction.js`
leitet die Stufe heute aus `account_type` plus `verified` ab, weil die Konten
noch nicht relational liegen. Eine Schranke, die erst mit einer künftigen
Datenmigration greift, ist keine.

`isRxAllowed` ist bewusst ein eigenes Feld und nicht aus `verificationStatus`
abgeleitet: Es ist der Hebel für die Moderation. Ein Betrieb, dessen Erlaubnis
erloschen ist, lässt sich sperren, ohne die Verifizierung zurückzunehmen — und
ohne die Historie zu verlieren, warum er einmal verifiziert war. Standard
`false`: Ein neues Konto sieht kein Rx, bis es bestätigt ist.

## Der Verifizierungs-Durchlauf (04.10.2026)

Ohne ihn war die Fachkreis-Schranke eine geschlossene Tür ohne Schlüssel: Die
Mechanik gab es (`/api/verify/*`), aber kein Betrieb hatte sie je benutzt — und
die Tauschbörse war damit nicht leer, sondern **verschlossen**.

### Antrag

`POST /api/verify/request` nimmt jetzt `licenseNumber` **und** `note`.

Die **Lizenznummer ist Pflicht** für alle Gewerbetreibenden. Ohne sie hat die
Moderation nichts zu prüfen — sie könnte nur dem Freitext glauben, und eine
Freigabe auf Zuruf wäre genau die Schranke auf dem Papier, die die Rx-Sperre
vermeiden soll. Ausnahme: `authority` (eine Behörde legitimiert sich anders und
hat keine Betriebserlaubnis im selben Sinn).

**Privatnutzer:innen können nicht beantragen** (`verify_private`). Ein Antrag,
der nie bewilligt werden kann, ist kein Angebot, sondern eine Sackgasse — der
Fehlertext sagt, was stattdessen zu tun ist, und das Formular erscheint gar
nicht.

**Kontotyp, Land und Lizenz werden mit dem Antrag festgehalten**, nicht erst
bei der Prüfung aus dem Profil gelesen. Das Profil lässt sich dazwischen
ändern: Wer als Logistik beantragt und vor der Freigabe auf Apotheke umstellt,
bekäme sonst eine Stufe freigeschaltet, die nie geprüft wurde. Ein Test
stellt genau das nach.

### Prüfung

`GET /api/verify/requests` liefert zusätzlich `license_number`,
`account_type`, `country` und — das Wichtigste — **`would_allow_rx`**. Die
Moderations-Ansicht sagt damit vor dem Klick, ob eine Freigabe Einblick in
verschreibungspflichtige Angebote schafft. Vorher stand dort nur Freitext.

### Freigabe

`resolveVerification` setzt `verified` **und** `is_rx_allowed`, letzteres
**nach Kontotyp**:

| Kontotyp | Stufe | Rx-Einblick |
|---|---|---|
| pharmacy | VERIFIED_PHARMACY | ✅ |
| wholesale | VERIFIED_WHOLESALE | ✅ |
| pharma | VERIFIED_MANUFACTURER | ✅ |
| logistics | VERIFIED_LOGISTICS | ❌ |
| authority | — | ❌ |

Pauschal `isRxAllowed = true` zu setzen wäre falsch: Ein Transportunternehmen
befördert Arzneimittel, es erwirbt sie nicht.

### Entziehen

`POST /api/verify/:userId/rx` mit `{allowed:false}` sperrt den Rx-Einblick,
**ohne** die Verifizierung zurückzunehmen — der Hebel, den das Schema
verspricht. Eine erloschene Betriebserlaubnis muss sich sperren lassen, ohne
die Historie zu verlieren, warum der Betrieb einmal verifiziert war.

### Status für die Nutzerin

`GET /api/verify/me` gibt bei „verifiziert" **auch `rx_allowed`** zurück, und
die Karte im Profil bleibt stehen (vorher verschwand sie). Das ist der
Unterschied, nach dem ein Logistiker sonst rätselt: Er ist verifiziert und
sieht trotzdem keine Rx-Angebote — ohne diese Angabe sieht das aus wie ein
Fehler.

## Übersetzen auf Zuruf (Säule 4, 04.10.2026)

`POST /api/translate` mit `{ text, to }`, `GET /api/translate/status` für die
Verfügbarkeit.

### Die wichtigste Eigenschaft ist eine negative

Der Dienst bekommt **nur Text**. Keine Adresse, keinen Behördennamen, keine
Kennung. Die Herkunft kann hier also nicht verändert werden, **weil sie nie
hereinkommt** — strukturell gelöst und nicht per Bitte im Prompt. Ein Prompt
lässt sich umgehen, eine fehlende Eingabe nicht.

Zwei Tests schieben genau das hinein, was nicht durchkommen darf: einer auf
Dienstebene, einer im Browser-Audit (der die echte Netzanfrage mitliest).

### Kostenbremse, nicht Missbrauchsschutz

Jeder Aufruf geht gegen die Abrechnung des Betreibers. Deshalb:
- **Auf Zuruf, nicht automatisch.** 500 Signale × 3 Sprachen vorab wären Geld
  für Texte, die niemand liest.
- **Zwischenspeicher** je `Zielsprache + Hash(Text)`. Derselbe Text wird nicht
  zweimal bezahlt; eine Antwort aus dem Speicher zählt auch nicht gegen das
  Limit.
- **60 Anbieter-Aufrufe je Stunde und Konto.**
- **Eine gescheiterte Übersetzung landet nicht im Speicher** — sonst wäre ein
  einmaliger Netzfehler für immer als Ergebnis verbucht.

### Drei Regeln für den Knopf

1. **Er erscheint nur, wenn Übersetzen möglich ist.** Ohne KI-Schlüssel kein
   Knopf — besser als einer, der mit einer Fehlermeldung endet.
2. **Er ersetzt nur den Text.** Herkunfts-Abzeichen, Quellenname und Link
   bleiben stehen.
3. **Das Original bleibt erreichbar.** Ein zweiter Klick schaltet zurück (mit
   dem ursprünglichen HTML, damit verlinkte @Handles und #Hashtags nicht
   verloren gehen). Eine Übersetzung, die das Original ersetzt, nimmt der
   Apothekerin die Möglichkeit, im Zweifel selbst nachzulesen — und bei einer
   Engpassmeldung ist dieser Zweifel berechtigt.

### Was der Auftrag an das Modell verbietet

Ergänzungen, Erklärungen, Einordnung, Zusammenfassung, Empfehlungen — und das
Übersetzen von Fachbegriffen: Wirkstoffnamen (INN), Handelsnamen,
Chargennummern, Dosierungen, Zulassungsnummern und Behördennamen werden
unverändert übernommen. Eine verdeutschte Chargennummer ist eine falsche.

## Kühlkette & Transport: ein Meldeweg, keine Anzeige (Säule 3, 05.10.2026)

`GET /api/logistik` (+ `/mine`, `POST /api/logistik`, `POST /api/logistik/:id/behoben`,
`DELETE /api/logistik/:id`).

### Warum dieser Bereich am Anfang leer ist, und das richtig ist

Für Kühlketten-Brüche, Zollstaus und Transportstörungen gibt es **keine
Behördenschnittstelle** — weder kostenlos noch kostenpflichtig. Diese
Information entsteht bei den Beteiligten (Spedition, Großhandel, Apotheke) und
sonst nirgends. Wer hier Beispielzeilen einsetzt, erzeugt genau das, was die
eiserne Regel verbietet: Zeilen, die wie geprüfte Meldungen aussehen und keine
sind — und bei einer Kühlkette entscheidet daran, ob eine Charge vernichtet
wird.

Die Antwort ist deshalb **ehrliche Leermeldung plus Meldeweg**. Ein Meldeweg
ist vom ersten Teilnehmer an nützlich; eine Anzeige ohne Quelle ist es nie.

### `provenance: 'self_reported'`, immer und mit Namen

Jede Zeile trägt die Herkunft und den **meldenden Betrieb mit Namen**. Das ist
keine Formalie: Die Eigenangabe eines Großhändlers ist etwas anderes als eine
Behördenmeldung, und wer sie verwechselt, hält eine Vermutung für einen Befund.

### `logistikErlaubt` ist absichtlich nicht `rxErlaubt`

Zwei Prädikate in `domain/jurisdiction.js`, die sich **nicht** vereinfachen
lassen:

| | Apotheke | Großhandel | Hersteller | **Logistik** |
|---|---|---|---|---|
| `rxErlaubt` (Rx-Angebote sehen) | ✓ | ✓ | ✓ | **✗** |
| `logistikErlaubt` (Störungen melden) | ✓ | ✓ | ✓ | **✓** |

Eine Spedition hat **keinen** Grund, Angebote zu verschreibungspflichtiger Ware
zu sehen — sie transportiert, sie beschafft nicht. Bei Transportstörungen ist
sie dagegen die **wichtigste** Gruppe: Sie merkt den Kühlketten-Bruch zuerst.
Zusätzlich gilt: Das `isRxAllowed`-Veto der Redaktion sperrt den Rx-Einblick,
**nicht** den Meldeweg — ein Betrieb, dem der Rx-Einblick entzogen wurde, darf
weiter melden, dass sein Container im Hafen steht.

Eine Gegenprobe, die Logistik in `RX_FACHKREIS_STATUS` aufnimmt, schlägt an;
eine zweite, die den Rx-Entzug auf das Melden ausweitet, ebenfalls.

### Gesperrt ist nicht leer

`list()` gibt `{ meldungen, erlaubt, grund }` zurück, nicht nur ein Array. Ohne
diese Unterscheidung sagte die Ansicht einem unverifizierten Konto „hier ist
nichts" — eine **Falschaussage**, und sie verschweigt den einen Schritt, der
hilft (verifizieren lassen). Das Frontend zeigt deshalb drei verschiedene
Zustände: gesperrt, leer, gefiltert-und-nichts-getroffen. Das Browser-Audit
prüft die Sperrkarte über ihr Kennzeichen `data-lglocked` — auf das Wort
„verifiziert" zu prüfen wäre vakuant gewesen, es steht ohnehin im Untertitel.

### Zwei Vorsichten in der Normalisierung

- **Unbekannte Dringlichkeit fällt auf `hinweis`, nie auf `kritisch`.** Nach
  oben zu runden erzeugte Fehlalarme aus Tippfehlern; rot bedeutet hier
  „kritischer Engpass" und muss das bedeuten.
- **Das Land kommt aus dem Profil, nicht aus der Anfrage** — dieselbe Regel wie
  bei den Börsen-Einträgen. Der Rechtsraum ist keine Anzeigeoption.

Abgelaufene (`gueltig_bis` in der Vergangenheit) und behobene Meldungen sind
standardmäßig ausgeblendet: Eine Kühlketten-Warnung von vor drei Monaten ist
keine Warnung mehr, sondern Rauschen. Über `offen=false` bleibt sie erreichbar.

### Was bewusst nicht gebaut wurde

Der Auftrag nannte auch eine **Fachkreis-Kommunikation für Hersteller und
Pharmareferenten**. Umgesetzt ist davon die *Leserichtung*: Rote-Hand-Briefe
und Rückrufe über `/api/sicherheitsmeldungen` (ungesperrt, siehe
`docs/LIVE_DATA.md` 3e). Ein **Sendeweg** für herstellereigene
Produkt-Mitteilungen wäre Werbung an Fachkreise, bräuchte die Schranke und
Moderation — und hätte ohne ersten Hersteller einen leeren Bereich ergeben.
Die eiserne Regel verbietet Platzhalter, also wurde er nicht angelegt.
