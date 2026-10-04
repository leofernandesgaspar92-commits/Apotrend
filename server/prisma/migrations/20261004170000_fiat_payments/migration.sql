-- FIAT-Zahlungen neben Krypto: Transaktionstabelle plus Kundennummern am Konto.
--
-- HANDGESCHRIEBEN, und warum: `prisma migrate diff --from-migrations` braucht
-- eine Shadow-Datenbank; in dieser Bauumgebung laeuft kein Postgres.
--
-- Nicht frei formuliert: Das DDL unten ist die Ausgabe von
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- fuer die neuen Objekte, uebernommen samt Prismas eigener Namensgebung
-- (Transaction_providerRef_key, Transaction_userId_createdAt_idx, …). Haette
-- ich die Indexnamen selbst erfunden, wuerde `migrate deploy` spaeter Drift
-- melden, obwohl inhaltlich alles stimmt. Ergaenzt wurden nur die Kommentare
-- und das IF NOT EXISTS an den ALTER-Zeilen.
--
-- Beim naechsten Lauf auf Render zeigt `prisma migrate deploy`, ob die
-- Migration zum Schema passt: Weicht sie ab, meldet Prisma Drift und der Build
-- faellt — laut, nicht still.

-- ── Bezahlweg, den die Kundin gewaehlt hat ─────────────────────────────────
-- Feiner als „CRYPTO/STRIPE/PAYPAL": Apple Pay und eine eingetippte
-- Kartennummer sind fuer die Auswertung zwei Dinge, fuer die Abrechnung eines.
CREATE TYPE "PaymentMethod" AS ENUM ('CRYPTO_DIRECT', 'CRYPTO_HOSTED', 'CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'PAYPAL', 'KLARNA', 'SEPA', 'INVOICE');

-- ── Wer das Geld verarbeitet ────────────────────────────────────────────────
-- Die Achse, die fuer Gebuehren und Buchhaltung zaehlt. PAYPAL kann hier
-- stehen, wenn PAYPAL als Methode ueber STRIPE lief — deshalb zwei Spalten.
CREATE TYPE "PaymentProvider" AS ENUM ('DIRECT', 'COINBASE', 'STRIPE', 'PAYPAL');

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PENDING_REVIEW', 'PAID', 'FAILED', 'REFUNDED');

-- ── Kundennummern am Konto ──────────────────────────────────────────────────
-- IF NOT EXISTS, weil diese Migration auf eine bereits laufende Datenbank
-- trifft und ein zweiter Lauf (Wiederholung eines abgebrochenen Deploys) sie
-- nicht abbrechen soll.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paypalPayerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- ── Die Transaktionszeile ───────────────────────────────────────────────────
-- KEIN Fremdschluessel auf "User": Die Konten liegen noch nicht in diesem
-- Schema (In-Memory-Repo + AppSnapshot). Ein FK wuerde jeden Schreibvorgang
-- ablehnen, weil die Zielzeile in Postgres nicht existiert. Begruendung
-- ausfuehrlich im Schema am Feld `userId`.
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "feature" TEXT,

    -- Betrag in der kleinsten Waehrungseinheit (Cent). Ganzzahl, weil die
    -- Anbieter selbst in Minor Units rechnen.
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',

    "paymentMethod" "PaymentMethod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',

    -- Referenz beim Anbieter (Stripe-Session, Coinbase-Charge,
    -- PayPal-Bestellung). Ueber sie findet der Webhook die Zahlung wieder.
    "providerRef" TEXT,

    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "paypalOrderId" TEXT,
    -- Erst der Einzug ist Geld, nicht die Genehmigung. Deshalb eine eigene
    -- Spalte neben der Bestell-ID.
    "paypalCaptureId" TEXT,

    "coin" TEXT,
    "walletId" TEXT,
    "txRef" TEXT,

    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- Zweimal dieselbe Anbieter-Referenz ist ein Zuordnungsfehler, keine zweite
-- Zahlung.
CREATE UNIQUE INDEX "Transaction_providerRef_key" ON "Transaction"("providerRef");

-- „Alle Zahlungen dieses Betriebs, neueste zuerst" — die Rechnungsansicht.
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt" DESC);

-- „Was haengt bei diesem Anbieter offen" — der Blick nach einem Ausfall.
CREATE INDEX "Transaction_provider_status_idx" ON "Transaction"("provider", "status");

CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt" DESC);
