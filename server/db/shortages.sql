-- ApoTrend Plattform — Lieferengpässe (Priorität 2). Marktdaten aus autoritativer
-- Quelle (Österreich: BASG-Vertriebseinschränkungsregister). Jeder Eintrag traegt
-- ein HERKUNFTS-Flag (provenance): verified (echt/BASG) · reference (kuratierte
-- Referenz) · simulated (Platzhalter). Das loest den offenen "echt vs. simuliert"-Punkt.
--
-- Feed-Andockpunkt: Beiträge referenzieren einen Engpass ueber
-- posts.ref_type='shortage' + posts.ref_id (siehe db/social.sql) -> "X Apotheker
-- haben dazu gepostet".

create table shortages (
  id                  uuid primary key default gen_random_uuid(),
  wirkstoff           text not null,
  bezeichnung         text not null,          -- betroffenes Praeparat
  status              text not null default 'kritisch'
                        check (status in ('kritisch','eingeschraenkt','verfuegbar')),
  grund               text,
  gemeldet_am         date,
  voraussichtlich_bis date,
  provenance          text not null default 'reference'
                        check (provenance in ('verified','reference','simulated')),
  quelle              text,                    -- z.B. 'BASG' oder 'Referenzdaten'
  created_at          timestamptz not null default now()
);
create index on shortages (status);
create index on shortages (wirkstoff);
