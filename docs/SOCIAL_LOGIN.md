# Social-Login (OAuth) — Architektur & Umsetzungsstand

> Status: **Fundament implementiert und getestet, inaktiv bis Zugangsdaten gesetzt sind.**
> Dieses Dokument beschreibt das Datenmodell, den Fluss, den Provider-Vertrag und die
> noch offenen Schritte, damit „Anmelden mit Google/Microsoft/…“ produktiv geht.

## Warum dieser Ansatz

OAuth braucht zwingend einen **externen Identitäts-Anbieter** (Google, Microsoft, …) mit
**Client-ID/Secret**. Das steht im Spannungsverhältnis zum Repo-Constraint „nur Built-ins,
keine externen Dienste“. Lösung: der **provider-agnostische Kern** (Identitäts-Verknüpfung,
Konto-Anlage, Endpunkte) ist vollständig gebaut und getestet; die eigentliche Provider-
Kommunikation steckt hinter einem **Adapter**, der nur registriert wird, wenn Zugangsdaten
als Umgebungsvariablen vorliegen. Ohne Provider ist der Flow inaktiv (leere Provider-Liste,
keine „Anmelden mit …“-Buttons) — mit Provider funktioniert er, ohne Codeänderung.

## Datenmodell

Neue Verknüpfungstabelle (im `memoryRepo`, später Postgres hinter demselben Seam):

| Feld               | Bedeutung                                              |
|--------------------|--------------------------------------------------------|
| `provider`         | z. B. `google`, `microsoft`                            |
| `provider_user_id` | stabile ID der Person beim Anbieter (`sub`)            |
| `user_id`          | ApoPulse-Konto, mit dem die Identität verknüpft ist    |

Schlüssel = `${provider}:${provider_user_id}` → `user_id` (1 Identität → 1 Konto; ein Konto
kann mehrere Identitäten tragen). Repo-Methoden: `linkIdentity`, `findUserIdByIdentity`,
`listIdentities`, `unlinkIdentity`. Persistenz-Roundtrip (`__dump`/`__load`) und
DSGVO-Löschung (`deleteUser` entfernt alle Identitäten des Kontos) sind abgedeckt.

## Fluss (Login/Registrierung)

```
Frontend                         Server                         Provider (Google …)
  │  „Anmelden mit Google“         │                                   │
  │  ─ GET /api/auth/providers ──▶ │  (liefert authorize_url je Provider, state=providername)
  │  ◀──────────────────────────── │                                   │
  │  location = authorize_url ─────────────────────────────────────▶  │  (Einwilligung)
  │  ◀──── redirect ?code=&state= ────────────────────────────────── │
  │  ─ POST /api/auth/oauth/google { code, redirectUri } ─▶ │
  │                                 │  adapter.exchange(code) ───────▶ │  (Token + Userinfo)
  │                                 │  ◀───────────────────────────── │
  │                                 │  loginOrRegister:                 │
  │                                 │   1) Identität bekannt? → login   │
  │                                 │   2) E-Mail bekannt?  → verknüpfen│
  │                                 │   3) sonst → neues Konto + Profil │
  │  ◀── { token, user, profile } ─ │                                   │
```

`loginOrRegister` (getestet mit Fake-Provider):
1. **Identität bereits verknüpft** → dasselbe Konto (`created:false`).
2. **E-Mail trifft bestehendes Passwort-Konto** → Identität ankoppeln, kein Zweitkonto.
3. **sonst** → neues Konto (zufälliges Passwort) + Social-Profil mit eindeutigem Handle.

## Provider-Vertrag (Adapter)

```js
async exchange(code, redirectUri) -> { providerUserId, email?, name? }   // Pflicht
authorizeUrl(redirectUri, state) -> string                               // für den Button
```

Der **Google-Adapter** ist als Referenz implementiert (`createGoogleAdapter`): `authorizeUrl`
(OpenID-Connect authorize endpoint, scope `openid email profile`) und `exchange`
(Token-Endpoint → Userinfo `sub/email/name`). Die Netz-Funktion (`fetch`) ist **injizierbar**
und damit ohne echtes Netz testbar. Weitere Provider = eine weitere `createXAdapter`-Funktion.

## Aktivierung (was der Owner setzen muss)

Umgebungsvariablen (Render → Environment):

```
OAUTH_GOOGLE_CLIENT_ID=…
OAUTH_GOOGLE_CLIENT_SECRET=…
```

Registrierte Redirect-URI beim Anbieter = die App-URL (z. B. `https://apopulse.onrender.com/`).
`buildProvidersFromEnv()` aktiviert Google automatisch, sobald beide Werte vorhanden sind.

## Offen (bewusst noch nicht gebaut — braucht echten Provider zum sicheren Testen)

1. **CSRF-`state` härten:** aktuell trägt `state` den Providernamen. Produktiv sollte `state`
   zusätzlich ein zufälliges, client-seitig hinterlegtes Token führen und beim Callback
   geprüft werden. (Frontend-seitig kleiner Zusatz; erst mit echtem Redirect testbar.)
2. **Weitere Provider** (Microsoft/Apple) nach demselben Adapter-Muster.
3. **Konto-Einstellungen:** verknüpfte Anbieter anzeigen/trennen — Endpunkte
   (`GET /api/auth/identities`, `POST /api/auth/identities/:provider/unlink`) existieren
   bereits; die UI-Sektion fehlt noch.

## Testabdeckung (bereits vorhanden)

- `test/oauth.test.js`: Konto-Anlage, Wieder-Login, E-Mail-Kopplung, unbekannter/inaktiver
  Provider, fehlerhaftes Profil, unlink, Persistenz-Roundtrip, Löschung, `buildProvidersFromEnv`,
  Google-`authorizeUrl`, Google-`exchange` (fetch gemockt).
- `test/http-integration.test.js`: leere Provider-Liste ohne Zugangsdaten,
  `oauth_not_configured` am Endpunkt, sowie die Sicherheits-Regression, dass `/api/me`
  keinen Passwort-/Recovery-Hash ausliefert.
