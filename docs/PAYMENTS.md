# Zahlungen & Premium — Architektur, Einrichtung, Sicherheit

> **Status:** sicheres Fundament implementiert und getestet, **inaktiv**, bis du deine
> *eigenen, verifizierten* Anbieter-Schlüssel als Umgebungsvariablen hinterlegst.
>
> **Grundprinzip:** Es werden **keine** Karten- oder Wallet-Rohdaten im Code/DB gespeichert
> und **keine** rohen Wallet-Adressen eingebettet. Alles läuft über **lizenzierte, gehostete
> Anbieter** (Stripe = Karte/Wallet/PayPal, Coinbase Commerce = Krypto). Die Freischaltung
> erfolgt ausschließlich über **signierte Webhooks** — nie, weil „der Client sagt, es sei bezahlt".

## 1. Übersicht der Komponenten

| Schicht | Datei | Aufgabe |
|--------|-------|---------|
| Produkte | `src/data/products.js` | Premium-Pakete + Preise in **Cent (EUR)** |
| Speicher | `src/repo/memoryRepo.js` | Entitlements (freigeschaltete Features) + Zahlungs-Audit (nur Metadaten) |
| Service | `src/services/payments.js` | provider-agnostischer Kern + Stripe-/Coinbase-Adapter (Netz über `fetch`) |
| HTTP | `src/http/server.js` | `/api/payments/*`-Routen + Roh-Body-Webhook |

**Wichtig zu Krypto:** Der Coinbase-Commerce-Weg nutzt **nicht** deine rohen BTC/ETH/SOL-Adressen.
Der Prozessor nimmt entgegen, rechnet den €-Betrag **live** um, zählt Netzwerk-Bestätigungen und
zahlt an dein dort **verifiziertes** Konto aus. Willst du Zahlungen **direkt** in genau deine
eigenen Wallets (du hältst die Keys), ist der einzig verantwortbare Weg ein selbstgehostetes
**BTCPay Server** — separat, nicht in Apotrend hineingebaut. Für **Solana** ist die Prozessor-
Unterstützung uneinheitlich; kläre vor dem Anbieten, ob dein Prozessor SOL abwickelt.

## 1b. Welche Bezahlwege angeboten werden

Die Liste je Land liefert `paymentMethodsFor(land, zweck)` in
`src/domain/compliance.js`. Sie besteht aus drei Teilen:

| Teil | Wege | Woher |
|---|---|---|
| **Landesspezifisch** | SEPA, ACH, Bacs, Pix, MB WAY, Multicaixa, M-Pesa, Paystack, Rechnung | Länderprofil (`fiat: [...]`) |
| **Karte + Umfeld** | Kredit-/Debitkarte, **PayPal**, **Apple Pay**, **Google Pay** | Karte aus dem Profil, der Rest abgeleitet |
| **Krypto** | USDT, USDC, BTC, ETH, SOL, WalletConnect | **immer, in jedem Land und Zweck** |

**Apple Pay und Google Pay sind keine eigene Schiene**, sondern eine andere
Verpackung derselben Kartenzahlung: Der Kunde bestätigt mit Gesicht oder
Fingerabdruck, abgerechnet wird über denselben Acquirer. Deshalb tragen sie
`via: 'card'` und werden **abgeleitet** — wo Karte geht, gehen sie auch. Zwei
Listen parallel zu pflegen würde bedeuten, dass irgendwann ein Land Karte
anbietet und Google Pay nicht, ohne dass es dafür einen Grund gäbe. Das Feld
`via` verhindert außerdem, dass jemand später drei Kartenwege zählt, wo es
einer mit drei Bedienoberflächen ist, und die Acquirer-Gebühr dreifach ansetzt.

**PayPal** ist dagegen eine echte eigene Schiene mit eigener Länderabdeckung
und steht in `PAYPAL_COUNTRIES`. Diese Liste ist ein **Startwert, keine
Rechtsauskunft**: AO, MZ, NG, KE und GH fehlen nicht, weil PayPal dort
ausgeschlossen wäre, sondern weil es sich von hier aus nicht belegen ließ — in
mehreren dieser Märkte ist das Konto nur zum Empfangen freigeschaltet. Lieber
ein Bezahlweg zu wenig als ein Knopf, der im Checkout ins Leere führt.
Bestätigt sich ein Markt, genügt der Ländercode in der Liste.

**Krypto bleibt unberührt.** Ein Test prüft über die volle Kreuzmenge aus allen
Ländern und allen Zwecken, dass weiterhin sechs Krypto-Wege angeboten werden —
die neuen Bezahlwege verdrängen dort nichts.

> **Status wie oben:** Die Wege stehen im Katalog und im Checkout, abgerechnet
> wird noch nichts — für **keinen** Fiat-Weg, auch nicht für Karte oder SEPA.
> Dazu braucht es die verifizierten Anbieter-Schlüssel aus Abschnitt 2.

## 2. Schritt-für-Schritt-Einrichtung

1. **Rechtliches zuerst.** Zahlungen einzunehmen kann in Österreich/EU Gewerbe-, Umsatzsteuer-
   und ggf. Aufsichtsfragen (PSD2/E-Geld) auslösen. Kurzer Check mit Steuerberater:in/Anwalt:in.
2. **Stripe-Konto** anlegen (dashboard.stripe.com) und **verifizieren** (KYC). Aktiviere die
   gewünschten Methoden (Karte deckt Apple/Google Pay automatisch ab; PayPal separat aktivieren).
3. **Coinbase-Commerce-Konto** anlegen (commerce.coinbase.com), verifizieren, Auszahlungskonto
   hinterlegen. *(Optional statt Coinbase: NOWPayments/BitPay — gleiches Adapter-Muster.)*
4. **Umgebungsvariablen** (Render → Environment) setzen:
   ```
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   COINBASE_COMMERCE_API_KEY=…
   COINBASE_COMMERCE_WEBHOOK_SECRET=…
   ```
   Ohne diese bleibt alles inaktiv (leere Methodenliste, keine Checkouts).
5. **Webhooks registrieren** (siehe §5).

## 3. API-Endpunkte

| Methode & Pfad | Auth | Zweck |
|----------------|------|-------|
| `GET /api/payments/products` | – | Produktkatalog (EUR-Preise) |
| `GET /api/payments/methods` | – | verfügbare Methoden (leer ohne Anbieter) |
| `POST /api/payments/checkout` | ✅ | gehosteten Checkout anlegen → `{ payment_id, redirect_url }`; Client leitet auf `redirect_url` weiter |
| `GET /api/me/premium` | ✅ | `{ premium: bool, features: [...] }` |
| `POST /api/payments/webhook/:provider` | Signatur | Anbieter meldet „bezahlt" → Feature wird freigeschaltet (idempotent) |

Ablauf: **Preis in € → Checkout beim Anbieter → Nutzer zahlt → signierter Webhook → Feature frei.**
Bei Krypto macht der Anbieter die €→Coin-Umrechnung und Bestätigungs-Zählung — kein eigener
Kurs-Code, keine eigene Chain-Prüfung.

## 4. Datenmodell

- **Entitlements:** `userId → Set(feature)` (z. B. `"premium"`). Freischaltung nur via Webhook.
- **Payments (Audit):** `{ id, user_id, product_id, amount_cents, currency, method, provider,
  provider_ref, status, created_at, paid_at }` — **keine** Karten-/Wallet-Rohdaten. `provider_ref`
  (Stripe-Session bzw. Coinbase-Charge-Code) sorgt für Webhook-Idempotenz.
- Beide werden persistiert und bei **Konto-Löschung (DSGVO)** mitentfernt.

## 5. Anbieter- & Webhook-Setup

**Stripe:** Dashboard → Developers → Webhooks → Endpoint
`https://DEINE-DOMAIN/api/payments/webhook/stripe`, Event `checkout.session.completed`.
Das „Signing secret" ist `STRIPE_WEBHOOK_SECRET`. Der Adapter prüft die `Stripe-Signature`
(HMAC-SHA256 über `t.payload`) mit Node-`crypto` — kein SDK.

**Coinbase Commerce:** Settings → Webhook subscriptions → Endpoint
`https://DEINE-DOMAIN/api/payments/webhook/coinbase`. Das „Shared secret" ist
`COINBASE_COMMERCE_WEBHOOK_SECRET`. Geprüft wird `X-CC-Webhook-Signature` (HMAC-SHA256 des
rohen Bodys), Event `charge:confirmed`.

## 6. Testanleitung

- **Automatisiert:** `npm run test` deckt Entitlements, Checkout-Anlage, Webhook-Freischaltung
  (inkl. Idempotenz), Signaturprüfung (gültig/ungültig) sowie beide Adapter (fetch gemockt,
  echte HMAC-Signaturen) ab. HTTP-Test: Produkte/Methoden/Checkout-Schutz/Webhook-Routing.
- **Stripe-Sandbox:** Testmodus-Schlüssel (`sk_test_…`) + Stripe-CLI
  (`stripe listen --forward-to localhost:4000/api/payments/webhook/stripe`), Testkarte
  `4242 4242 4242 4242`.
- **Coinbase:** Charge im Dashboard anlegen und den Webhook mit einer Testzahlung auslösen.

## 6a. Direkt-in-Wallet Krypto (aktiv, ohne Prozessor)

Zusätzlich zum Prozessor-Weg gibt es den **einfachen Direkt-Weg**: Kund:innen zahlen direkt
an die **eigenen** öffentlichen Empfangsadressen des Betreibers.

- **Adressen:** `src/data/cryptoWallets.js` (BTC + ETH vorbelegt, per `APOTREND_WALLET_BTC/ETH`
  überschreibbar). **Solana** ist bewusst leer — es wurden zwei verschiedene SOL-Adressen
  genannt; erst nach Klärung über `APOTREND_WALLET_SOL` setzen (falsche Adresse = Geldverlust).
- **Kurse:** `src/services/cryptoRates.js` holt EUR→Coin von CoinGecko (öffentlich, lesend,
  5-min-Cache, `fetch` injizierbar). Fällt der Abruf aus, wird nur der **€-Betrag** gezeigt —
  die Zahlung (Adresse + „In Wallet-App öffnen") funktioniert **immer**.
- **UI:** Konto → „⭐ Premium freischalten" → je Coin: Betrag, Adresse (kopieren) und
  **„📲 In Wallet-App öffnen"** (`bitcoin:` / `ethereum:` / `solana:`-URI → Wallet öffnet sich
  vorausgefüllt). So einfach wie möglich: klicken → senden.
- **Freischaltung (ehrlich, kein Fake-Auto):** Statische Adressen erlauben **keine**
  zuverlässige automatische Zuordnung „welche:r Kund:in hat gezahlt". Ablauf:
  `POST /api/payments/crypto/start` → Kund:in nennt die **Transaktions-ID**
  (`…/crypto/:id/claim`) → Status `pending_review` → **Moderation/Betreiber bestätigt manuell**
  (`GET /api/payments/pending`, `POST /api/payments/:id/confirm`) nach Blick in die Wallet →
  Feature frei. Damit gibt es einen sauberen Datensatz und eine bewusste Freigabe.
- **Wichtig:** Auch der Direkt-Weg entbindet nicht von **Steuer/Buchführung** (Krypto-Eingänge
  sind zu erfassen) und ggf. gewerbe-/aufsichtsrechtlichen Pflichten.

## 7. Bewusst NICHT gebaut (und warum)

- **Rohe Wallet-Adressen im Code / eigene „1-Bestätigung"-Chain-Prüfung:** unsicher (Reorgs,
  Betrags-/Race-Fehler) und ohne KYC-Hürde ein Betrugs-/Geldwäsche-Vektor. Direkt-in-eigene-Wallet
  gehört an **BTCPay Server**.
- **Eigene Kursabfrage (CoinGecko/Binance):** unnötig — der Krypto-Prozessor rechnet live um.
- **Bestätigungs-Mail:** der Haken (`onPaid`) ist vorhanden; der Versand braucht einen eigenen
  Mail-Anbieter (z. B. Postmark/SES) und wird angebunden, sobald einer gewählt ist.
