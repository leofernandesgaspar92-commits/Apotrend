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
server/test/compliance-engine.test.js   29 Tests
server/tools/verify-qr.mjs        QR gegen python-qrcode und segno prüfen
server/tools/build-checkout-demo.mjs    Demo bauen (Engine + Tailwind einbetten)
server/tools/check-checkout-demo.mjs    42 Browser-Prüfungen der Demo
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

## Was in der Demo bewusst nicht passiert

- **Keine Wallet-Adresse wird erfunden.** Netzwerke ohne hinterlegte Empfangsadresse
  (Tron, Polygon, Arbitrum) sind sichtbar deaktiviert und mit „Adresse noch zu
  hinterlegen" gekennzeichnet. Eine erfundene Adresse wäre der teuerste denkbare
  Platzhalter.
- **Kein Betrag im Zahlungslink.** Ohne angebundenen Kursdienst wäre ein geschätzter
  Kurs eine falsche Zusage. Im Betrieb rechnet der Zahlungsdienst live um und zählt
  die Netzwerk-Bestätigungen (`services/cryptoRates.js`, `services/payments.js`).
- **Keine Zahlung wird ausgelöst.** Der echte Ablauf läuft über gehostete, lizenzierte
  Anbieter mit signierten Webhooks — nie „der Client sagt, es sei bezahlt".
