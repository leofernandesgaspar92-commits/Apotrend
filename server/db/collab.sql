-- ApoPulse Plattform — collab-Modul (Teams-artig, IMMER apothekenintern).
-- Baut auf db/schema.sql (organizations/users/memberships) auf.
-- Alles hier ist hart auf organization_id gescoped und verlaesst die Apotheke nie.

-- Arbeitsbereich / Kanal innerhalb einer Organisation
create table channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  visibility      text not null default 'all_members'
                    check (visibility in ('all_members','private')),
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on channels (organization_id);

-- Mitglieder eines privaten Kanals (bei 'all_members' unnoetig)
create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  primary key (channel_id, user_id)
);

-- Textnachricht im Kanal (Echtzeit-Transport spaeter, Phase 6)
create table messages (
  id             uuid primary key default gen_random_uuid(),
  channel_id     uuid not null references channels(id) on delete cascade,
  author_user_id uuid not null references users(id) on delete set null,
  body           text not null,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  deleted_at     timestamptz
);
create index on messages (channel_id, created_at);

-- Angeheftete Info / Notiz / Dokument-Referenz
create table notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel_id      uuid references channels(id) on delete set null,
  title           text not null,
  body            text,
  doc_url         text,
  pinned          boolean not null default false,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on notes (organization_id);

-- Aufgabe / To-Do mit Zuweisung
create table tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  channel_id       uuid references channels(id) on delete set null,
  title            text not null,
  description      text,
  assignee_user_id uuid references users(id) on delete set null,
  status           text not null default 'offen'
                     check (status in ('offen','in_arbeit','erledigt')),
  due_date         date,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index on tasks (organization_id, status);
