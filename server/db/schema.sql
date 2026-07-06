-- ApoTrend Plattform — DB-Schema (Ziel-Persistenz: PostgreSQL, EU-gehostet).
-- Dev/Test nutzt eine austauschbare In-Memory-Implementierung HINTER demselben
-- Repository-Interface (server/src/repo/). Dieses SQL ist die verbindliche
-- Struktur fuer die spaetere Postgres-Anbindung (Phase 6 / Deployment).
--
-- Baustein 1 (dieser Commit): FUNDAMENT — Organisationen, Nutzer, Mitgliedschaften.
-- Kanaele/Nachrichten/Aufgaben (collab) und Feed/Kontakte (network) folgen in
-- den naechsten Bausteinen.

create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive E-Mail

-- Organisation = Apotheke ODER Lieferant/Hersteller.
-- Die Apotheke ist die Mandanten-Grenze; ein Pharmareferent gehoert zu einer
-- 'supplier'-Org und hat NIE Zugriff auf Apotheken-Internes.
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null check (type in ('pharmacy','supplier')),
  name               text not null,
  ort                text,
  plz                text,
  bundesland         text,
  konzessionsnr      text,                       -- optionale Verifizierung als echte Apotheke
  specializations    text[] not null default '{}',
  profile_text       text,
  profile_visibility text not null default 'network'
                       check (profile_visibility in ('network','contacts_only')),
  created_at         timestamptz not null default now()
);

-- Natuerliche Person. Passwort NUR als Hash (scrypt), niemals Klartext.
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique not null,
  password_hash text not null,
  name          text not null,
  status        text not null default 'active'
                  check (status in ('invited','active','disabled')),
  twofa_secret  text,
  created_at    timestamptz not null default now()
);

-- Verbindet User <-> Organisation und traegt die ROLLE (RBAC).
-- Vorerst genau eine Mitgliedschaft pro User; das Modell erlaubt aber spaeter
-- Ketten/Filialen ohne Umbau.
create table memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role            text not null
                    check (role in ('admin','apotheker','pta','lehrling','pharmareferent')),
  created_at      timestamptz not null default now(),
  unique (user_id, organization_id)
);
create index on memberships (organization_id);
create index on memberships (user_id);
