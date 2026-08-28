-- ApoTrend Plattform — Rabatt-Aktionen (Priorität 5). Zeitlich befristete
-- Aktionsangebote von Großhändlern/Herstellern je Präparat. Top-10-Ranking nach
-- Rabatt-Höhe (rabatt_pct), nur laufende Aktionen (gueltig_bis in der Zukunft).
-- HERKUNFTS-Flag wie bei Engpässen/Preisen (verified/reference/simulated).
-- Feed-Andockpunkt: posts.ref_type='rabatt' + posts.ref_id -> eine Aktion wird
-- kommentier-/teilbar ("Top-Rabatt bei X — lohnt sich das?").

create table rabatte (
  id           uuid primary key default gen_random_uuid(),
  bezeichnung  text not null,               -- Präparat
  wirkstoff    text,
  supplier     text not null,               -- Großhändler/Hersteller mit der Aktion
  listenpreis  numeric(10,2) not null,       -- regulärer AEP
  aktionspreis numeric(10,2) not null,       -- Aktionspreis
  currency     text not null default 'EUR',
  min_menge    integer,                     -- Mindestabnahme (optional)
  gueltig_bis  date not null,               -- Aktion läuft bis einschließlich
  -- self_reported = von einem Fachbetrieb selbst eingetragen (siehe created_by).
  -- Bewusst ein EIGENER Wert und nicht 'verified': Eine Eigenangabe ist etwas
  -- anderes als eine geprüfte Feed-Übernahme, und die Oberfläche zeigt das an.
  provenance   text not null default 'reference'
                 check (provenance in ('verified','reference','simulated','self_reported')),
  quelle       text,
  -- Wer die Aktion eingetragen hat. NULL bei Feed-/Referenzdaten. Ohne dieses
  -- Feld ließe sich „nur eigene Aktionen zurückziehen" nicht durchsetzen.
  created_by   uuid references users(id) on delete set null,
  updated_at   timestamptz not null default now(),

  -- Ein „Rabatt" ohne Ersparnis ist irreführende Werbung.
  constraint rabatt_spart_wirklich check (aktionspreis < listenpreis),
  -- Eine Aktion über Jahre ist kein Aktionspreis, sondern ein Preis.
  constraint rabatt_laufzeit check (gueltig_bis <= current_date + interval '365 days'),
  -- Selbst eingetragen heißt: es gibt jemanden, der dafür einsteht.
  constraint rabatt_eigenangabe_hat_urheber
    check (provenance <> 'self_reported' or created_by is not null)
);
create index on rabatte (gueltig_bis);
create index on rabatte (created_by) where created_by is not null;
