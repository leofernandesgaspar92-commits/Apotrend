-- ApoTrend — Bestandsaustausch (Biete/Suche). Löst das tägliche Engpass-Problem:
-- eine Apotheke hat Überbestand, eine andere sucht dringend — hier finden sie
-- zueinander. Kontakt läuft über die bestehenden Direktnachrichten (kein
-- öffentlicher Kontaktdatentausch -> Datenschutz).

create table exchange_entries (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('biete','suche')),  -- Biete Überbestand / Suche
  author_user_id uuid not null,
  bezeichnung    text not null,               -- Präparat/Wirkstoff
  menge          text,                        -- z.B. "20 Packungen" (Klartext)
  ort            text,                        -- optional (z.B. "1010 Wien")
  note           text,                        -- optionaler Hinweis
  status         text not null default 'offen' check (status in ('offen','erledigt')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index on exchange_entries (status, kind);
