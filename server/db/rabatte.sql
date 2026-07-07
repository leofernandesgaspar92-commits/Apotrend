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
  provenance   text not null default 'reference'
                 check (provenance in ('verified','reference','simulated')),
  quelle       text,
  updated_at   timestamptz not null default now()
);
create index on rabatte (gueltig_bis);
