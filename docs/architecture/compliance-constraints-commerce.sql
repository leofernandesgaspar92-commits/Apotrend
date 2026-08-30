-- ===========================================================================
--  ApoPulse — Constraints für Länder-Compliance, Abos und Zahlungen
-- ===========================================================================
--  Ergänzt compliance-constraints.sql und compliance-constraints-media.sql.
--
--  Zwei Regeln stehen hier im Mittelpunkt, und beide sind zu wichtig, um sie
--  der Anwendungslogik zu überlassen:
--
--    A) In DACH darf auf Arzneimittel KEINE prozentuale Provision anfallen.
--    B) Die Krypto-Schiene darf in KEINEM Land verschwinden (Owner-Vorgabe).
--
--  Ein Import-Skript, eine Migration oder eine psql-Sitzung umgeht jede
--  Anwendungsprüfung. Was nicht in der Datenbank steht, gilt nicht.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  1. Länderprofile: in sich stimmig
-- ---------------------------------------------------------------------------

ALTER TABLE core."Country"
  ADD CONSTRAINT country_code_iso
  CHECK (code ~ '^[A-Z]{2}$');

ALTER TABLE core."Country"
  ADD CONSTRAINT country_currency_iso
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE core."Country"
  ADD CONSTRAINT country_minor_units_sane
  CHECK ("minorUnits" BETWEEN 0 AND 4);

--  Gebührensätze nur, wo Gebühren überhaupt zulässig sind. Ohne diesen CHECK
--  könnte jemand in Deutschland 250 bps eintragen, ohne dass etwas auffällt —
--  bis die erste Rechnung falsch ist.
ALTER TABLE core."Country"
  ADD CONSTRAINT country_fee_bps_requires_permission
  CHECK (
    "transactionFeeAllowed"
    OR ("marketplaceFeeBps" = 0 AND "logisticsFeeBps" = 0)
  );

--  Der Modus muss zur Erlaubnis passen: MARKETPLACE_FEES ohne erlaubte
--  Transaktionsgebühr wäre ein Widerspruch in sich.
ALTER TABLE core."Country"
  ADD CONSTRAINT country_mode_matches_permission
  CHECK (
    ("commerceMode" = 'SAAS_ONLY' AND NOT "transactionFeeAllowed")
    OR ("commerceMode" = 'MARKETPLACE_FEES' AND "transactionFeeAllowed")
  );

ALTER TABLE core."Country"
  ADD CONSTRAINT country_fee_bps_bounded
  CHECK ("marketplaceFeeBps" BETWEEN 0 AND 2000 AND "logisticsFeeBps" BETWEEN 0 AND 2000);

-- ---------------------------------------------------------------------------
--  2. REGEL B: Die Krypto-Schiene bleibt
-- ---------------------------------------------------------------------------
--  Owner-Vorgabe: Krypto ist in allen Ländern dauerhaft verfügbar. Umgesetzt
--  als Trigger statt als CHECK, weil die Bedingung über mehrere Zeilen geht.
--
--  DEFERRABLE INITIALLY DEFERRED ist hier entscheidend: Beim Einrichten eines
--  neuen Landes werden Zahlungsmethoden zeilenweise eingefügt. Ein sofort
--  prüfender Trigger würde schon beim ersten Fiat-INSERT auslösen. Geprüft wird
--  deshalb erst beim COMMIT — also gegen den fertigen Zustand.

CREATE OR REPLACE FUNCTION core.enforce_crypto_rail_present()
RETURNS TRIGGER AS $$
DECLARE
  target_country CHAR(2);
  crypto_count   INT;
  country_active BOOLEAN;
BEGIN
  target_country := COALESCE(NEW."countryCode", OLD."countryCode");

  SELECT "isActive" INTO country_active
  FROM core."Country" WHERE code = target_country;

  -- Ein abgeschaltetes Land braucht keine Zahlungsmethoden.
  IF country_active IS NULL OR country_active = FALSE THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO crypto_count
  FROM core."CountryPaymentMethod"
  WHERE "countryCode" = target_country
    AND rail = 'CRYPTO'
    AND "isEnabled" = TRUE;

  IF crypto_count = 0 THEN
    RAISE EXCEPTION
      'Land % hätte danach keine aktive Krypto-Zahlungsmethode. Die Krypto-Schiene ist eine feste Zusage der Plattform und darf nicht länderweise abgeschaltet werden.',
      target_country
      USING ERRCODE = 'check_violation', HINT = 'Siehe server/src/domain/compliance.js, assertCryptoAvailable().';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_crypto_rail_present
  AFTER INSERT OR UPDATE OR DELETE ON core."CountryPaymentMethod"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.enforce_crypto_rail_present();

--  Gegenrichtung: Ein Land auf isActive=true zu setzen, ohne dass eine
--  Krypto-Methode existiert, wäre dieselbe Lücke von der anderen Seite.
CREATE OR REPLACE FUNCTION core.enforce_crypto_rail_on_activate()
RETURNS TRIGGER AS $$
DECLARE
  crypto_count INT;
BEGIN
  IF NEW."isActive" = FALSE THEN RETURN NULL; END IF;

  SELECT count(*) INTO crypto_count
  FROM core."CountryPaymentMethod"
  WHERE "countryCode" = NEW.code AND rail = 'CRYPTO' AND "isEnabled" = TRUE;

  IF crypto_count = 0 THEN
    RAISE EXCEPTION 'Land % kann nicht aktiviert werden: keine Krypto-Zahlungsmethode hinterlegt.', NEW.code
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_crypto_rail_on_activate
  AFTER INSERT OR UPDATE OF "isActive" ON core."Country"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.enforce_crypto_rail_on_activate();

--  Krypto-Methoden brauchen Asset und Netzwerk, Fiat-Methoden nicht.
ALTER TABLE core."CountryPaymentMethod"
  ADD CONSTRAINT paymentmethod_crypto_fields
  CHECK (
    (rail = 'FIAT' AND asset IS NULL)
    OR (rail = 'CRYPTO' AND asset IS NOT NULL AND array_length(networks, 1) >= 1)
  );

-- ---------------------------------------------------------------------------
--  3. REGEL A: Keine Provision, wo keine erlaubt ist
-- ---------------------------------------------------------------------------

--  Zeileninterne Stimmigkeit: Basispunkte nur bei COMMISSION_FEE.
ALTER TABLE core."Transaction"
  ADD CONSTRAINT transaction_bps_only_for_commission
  CHECK (
    ("feeKind" = 'COMMISSION_FEE' AND "feeBps" > 0)
    OR ("feeKind" <> 'COMMISSION_FEE' AND "feeBps" = 0 AND "feeAmountMinor" = 0)
  );

--  Beträge müssen aufgehen. Ein Nettobetrag, der nicht Brutto minus Gebühr ist,
--  wäre ein Buchhaltungsfehler, den niemand bemerkt.
ALTER TABLE core."Transaction"
  ADD CONSTRAINT transaction_amounts_consistent
  CHECK (
    "grossAmountMinor" >= 0
    AND "feeAmountMinor" >= 0
    AND "feeAmountMinor" <= "grossAmountMinor"
    AND "netAmountMinor" = "grossAmountMinor" - "feeAmountMinor"
  );

--  DER Kern-Constraint: In einem Land ohne erlaubte Transaktionsgebühr darf
--  keine Provisions-Transaktion entstehen. Als Trigger, weil die Erlaubnis in
--  der Country-Tabelle steht.
CREATE OR REPLACE FUNCTION core.enforce_commission_permitted()
RETURNS TRIGGER AS $$
DECLARE
  allowed BOOLEAN;
  mode    TEXT;
BEGIN
  IF NEW."feeKind" <> 'COMMISSION_FEE' THEN RETURN NEW; END IF;

  SELECT "transactionFeeAllowed", "commerceMode"::text
  INTO allowed, mode
  FROM core."Country" WHERE code = NEW."countryCode";

  IF allowed IS NOT TRUE THEN
    RAISE EXCEPTION
      'Provisionsbuchung in % nicht zulässig (Modus %). Auf Arzneimittel wird dort keine prozentuale Verkaufsprovision erhoben.',
      NEW."countryCode", COALESCE(mode, 'unbekannt')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_commission_permitted
  BEFORE INSERT OR UPDATE ON core."Transaction"
  FOR EACH ROW EXECUTE FUNCTION core.enforce_commission_permitted();

--  Ebenso: Marktplatz-Zweck nur, wo es einen Marktplatz gibt.
CREATE OR REPLACE FUNCTION core.enforce_purpose_permitted()
RETURNS TRIGGER AS $$
DECLARE
  allowed BOOLEAN;
BEGIN
  IF NEW.purpose <> 'MARKETPLACE_ORDER' THEN RETURN NEW; END IF;

  SELECT "transactionFeeAllowed" INTO allowed
  FROM core."Country" WHERE code = NEW."countryCode";

  IF allowed IS NOT TRUE THEN
    RAISE EXCEPTION 'Marktplatz-Bestellungen sind in % nicht freigeschaltet.', NEW."countryCode"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purpose_permitted
  BEFORE INSERT ON core."Transaction"
  FOR EACH ROW EXECUTE FUNCTION core.enforce_purpose_permitted();

-- ---------------------------------------------------------------------------
--  4. Fiat- und Krypto-Belege sauber trennen
-- ---------------------------------------------------------------------------

--  Eine Transaktion ist entweder Fiat oder Krypto. Belege der jeweils anderen
--  Schiene dürfen nicht danebenstehen — sonst ist bei einer Rückfrage nicht
--  mehr entscheidbar, welcher Nachweis gilt.
ALTER TABLE core."Transaction"
  ADD CONSTRAINT transaction_rail_evidence_exclusive
  CHECK (
    (rail = 'FIAT'
      AND "cryptoTxHash" IS NULL AND "cryptoAsset" IS NULL AND "cryptoAmount" IS NULL)
    OR
    (rail = 'CRYPTO'
      AND "fiatProviderRef" IS NULL AND "fiatPaymentMethod" IS NULL)
  );

--  Eine abgeschlossene Zahlung braucht ihren Beleg. „SETTLED" ohne Nachweis
--  wäre eine Behauptung.
ALTER TABLE core."Transaction"
  ADD CONSTRAINT transaction_settled_needs_evidence
  CHECK (
    status <> 'SETTLED'
    OR (rail = 'FIAT'  AND "fiatProvider" IS NOT NULL AND "fiatProviderRef" IS NOT NULL)
    OR (rail = 'CRYPTO' AND "cryptoTxHash" IS NOT NULL)
  );

--  Krypto-Belege: Hash-Form je Kette grob prüfen. Kein Ersatz für die
--  Kettenabfrage, aber es fängt Tippfehler und Copy-Paste-Unfälle ab.
ALTER TABLE core."Transaction"
  ADD CONSTRAINT transaction_crypto_hash_shape
  CHECK (
    "cryptoTxHash" IS NULL
    OR "cryptoTxHash" ~ '^(0x[0-9a-fA-F]{64}|[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{43,88})$'
  );

ALTER TABLE core."Transaction"
  ADD CONSTRAINT transaction_confirmations_nonnegative
  CHECK (confirmations IS NULL OR confirmations >= 0);

--  Der eindeutige Index auf cryptoTxHash liegt im Prisma-Modell. Wichtig ist
--  das WARUM: Ohne ihn ließe sich derselbe Transaktions-Hash zweimal
--  einreichen und zweimal gutschreiben. Bei einer öffentlich einsehbaren Kette
--  ist ein fremder Hash trivial zu beschaffen.

-- ---------------------------------------------------------------------------
--  5. Pflichtnachweise: bezahlt ist nicht freigeschaltet
-- ---------------------------------------------------------------------------

--  Fehlt ein Pflichtnachweis (Einfuhrlizenz, FDA-Nummer), bleibt das Abo in
--  PENDING_COMPLIANCE — auch wenn das Geld da ist. Diese Reihenfolge ist der
--  Kern des Fälschungsschutzes in den Importmärkten.
CREATE OR REPLACE FUNCTION core.enforce_subscription_compliance()
RETURNS TRIGGER AS $$
DECLARE
  missing TEXT[];
BEGIN
  IF NEW.status NOT IN ('ACTIVE', 'TRIALING') THEN RETURN NEW; END IF;

  SELECT array_agg(f."fieldId")
  INTO missing
  FROM core."CountryCheckoutField" f
  WHERE f."countryCode" = NEW."countryCode"
    AND f."isRequired" = TRUE
    AND (
      NEW."complianceData" IS NULL
      OR NOT (NEW."complianceData" ? f."fieldId")
      OR length(btrim(NEW."complianceData" ->> f."fieldId")) = 0
    );

  IF missing IS NOT NULL AND array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Abo % kann nicht aktiv werden: Pflichtnachweise fehlen (%).',
      NEW.id, array_to_string(missing, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_compliance
  BEFORE INSERT OR UPDATE OF status, "complianceData" ON core."Subscription"
  FOR EACH ROW EXECUTE FUNCTION core.enforce_subscription_compliance();

--  US-Transaktionen führen ihre Rückverfolgbarkeit mit (DSCSA).
CREATE OR REPLACE FUNCTION core.enforce_traceability()
RETURNS TRIGGER AS $$
DECLARE
  regime TEXT;
BEGIN
  IF NEW.status <> 'SETTLED' THEN RETURN NEW; END IF;

  SELECT traceability INTO regime FROM core."Country" WHERE code = NEW."countryCode";
  IF regime IS NULL THEN RETURN NEW; END IF;

  IF NEW."traceabilityHash" IS NULL OR NEW."complianceSnapshot" IS NULL THEN
    RAISE EXCEPTION
      'Transaktion % in % unterliegt %: Nachweis (traceabilityHash + complianceSnapshot) ist Pflicht.',
      NEW.id, NEW."countryCode", regime
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_traceability
  BEFORE INSERT OR UPDATE OF status ON core."Transaction"
  FOR EACH ROW EXECUTE FUNCTION core.enforce_traceability();

-- ---------------------------------------------------------------------------
--  6. Abos und Preise
-- ---------------------------------------------------------------------------

ALTER TABLE core."Subscription"
  ADD CONSTRAINT subscription_amount_positive
  CHECK ("amountMinor" > 0);

ALTER TABLE core."Subscription"
  ADD CONSTRAINT subscription_period_ordered
  CHECK ("currentPeriodEnd" > "currentPeriodStart");

--  Krypto-Abos werden nicht abgebucht, sondern je Periode bezahlt. Ein aktives
--  Krypto-Abo ohne bezahlten Zeitraum wäre eine unbemerkte Gratisnutzung.
ALTER TABLE core."Subscription"
  ADD CONSTRAINT subscription_crypto_needs_paid_through
  CHECK (
    "paymentRail" <> 'CRYPTO'
    OR status <> 'ACTIVE'
    OR "paidThrough" IS NOT NULL
  );

ALTER TABLE core."PlanPrice"
  ADD CONSTRAINT planprice_amount_positive
  CHECK ("amountMinor" > 0);

ALTER TABLE core."PlanPrice"
  ADD CONSTRAINT planprice_validity_ordered
  CHECK ("validTo" IS NULL OR "validTo" > "validFrom");

-- ---------------------------------------------------------------------------
--  7. Händler-Guthaben: der Saldo muss stimmen
-- ---------------------------------------------------------------------------

ALTER TABLE core."MerchantCredit"
  ADD CONSTRAINT credit_no_overdraft
  CHECK ("balanceMinor" >= 0);

--  Append-only durchsetzen: Buchungen werden nie geändert oder gelöscht,
--  Korrekturen sind Gegenbuchungen. Sonst ist der Saldo nicht rekonstruierbar.
CREATE OR REPLACE FUNCTION core.forbid_credit_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Guthaben-Buchungen sind unveränderlich. Korrekturen als Gegenbuchung anlegen.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_entry_immutable
  BEFORE UPDATE OR DELETE ON core."MerchantCreditEntry"
  FOR EACH ROW EXECUTE FUNCTION core.forbid_credit_entry_mutation();

--  Saldo aus der letzten Buchung fortschreiben, statt ihn der Anwendung zu
--  überlassen — zwei Stellen, die denselben Saldo rechnen, driften auseinander.
CREATE OR REPLACE FUNCTION core.apply_credit_entry()
RETURNS TRIGGER AS $$
DECLARE
  current_balance BIGINT;
BEGIN
  SELECT "balanceMinor" INTO current_balance
  FROM core."MerchantCredit" WHERE id = NEW."creditId" FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Guthabenkonto % existiert nicht.', NEW."creditId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW."balanceAfter" := current_balance + NEW."deltaMinor";

  IF NEW."balanceAfter" < 0 THEN
    RAISE EXCEPTION 'Buchung würde das Guthaben ins Minus bringen (% + %).',
      current_balance, NEW."deltaMinor"
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE core."MerchantCredit"
  SET "balanceMinor" = NEW."balanceAfter"
  WHERE id = NEW."creditId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_credit_entry
  BEFORE INSERT ON core."MerchantCreditEntry"
  FOR EACH ROW EXECUTE FUNCTION core.apply_credit_entry();
