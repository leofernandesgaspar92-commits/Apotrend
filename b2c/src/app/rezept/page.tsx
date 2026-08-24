import Link from 'next/link'
import { careState, revokeConsentAction } from '@/app/care-actions'
import { ConsentStep, UploadStep } from './RezeptClient'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// Gesundheitsdaten: niemals statisch vorgerendert oder zwischengespeichert.
export const dynamic = 'force-dynamic'

export default async function RezeptPage() {
  const state = await careState()
  const consented = state.hasCore && state.hasRx
  const dateFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

  return (
    <div className="mx-auto max-w-feed px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold text-content">Rezept einlösen</h1>
        <Link
          href="/feed"
          className="ml-auto inline-flex min-h-touch items-center rounded px-3 text-sm font-semibold text-care underline underline-offset-4 focus-visible:outline-none focus-visible:ring focus-visible:ring-focus"
        >
          Zurück zum Feed
        </Link>
      </header>

      <main id="inhalt" className="grid gap-5">
        {/* Ebene 3 (Versorgung): nüchtern, kein Preis, keine Werbesprache */}
        {!consented ? (
          <ConsentStep />
        ) : (
          <>
            <section
              data-testid="consent-status"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-success-border bg-success-subtle p-4"
            >
              <Badge tone="success">Einwilligung erteilt</Badge>
              <span className="text-sm text-content">
                Sie können Ihre Einwilligung jederzeit widerrufen.
              </span>
              {/* Widerruf so einfach wie die Erteilung (Art. 7 Abs. 3 DSGVO) */}
              <form action={revokeConsentAction} className="ml-auto">
                <input type="hidden" name="purpose" value="prescription_handling" />
                <Button type="submit" variant="secondary" size="sm" data-testid="revoke">
                  Einwilligung widerrufen
                </Button>
              </form>
            </section>

            <UploadStep />
          </>
        )}

        {state.prescriptions.length > 0 && (
          <section
            aria-labelledby="rx-list-heading"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 id="rx-list-heading" className="text-xl font-bold text-content">
              Ihre Einreichungen
            </h2>
            <ul className="mt-3 grid gap-2" data-testid="rx-list">
              {state.prescriptions.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded border border-border p-3"
                >
                  <span className="font-semibold text-content">{p.id}</span>
                  <Badge tone={p.documentPresent ? 'info' : 'neutral'}>
                    {p.documentPresent ? 'in Prüfung' : 'Dokument gelöscht'}
                  </Badge>
                  <span className="ml-auto text-xs text-content-muted">
                    Löschung spätestens {dateFmt.format(p.purgeAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
