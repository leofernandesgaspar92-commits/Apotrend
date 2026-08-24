import { cn } from '@/lib/cn'

/**
 * VerifiedBadge — Prüfsiegel für Fachpersonal und Apotheken.
 *
 * Bewusste Gestaltungsentscheidungen:
 *  - Es ist ein PRÜF-, kein Werbesiegel: kein Gold, kein Glanz, keine Animation.
 *  - Es sagt, WAS geprüft wurde — „verifiziert" allein ist eine leere Behauptung.
 *  - Es verfällt: `validUntil` in der Vergangenheit -> Badge wird nicht gerendert.
 *    Ein abgelaufenes Siegel still weiterzuzeigen wäre irreführend.
 *  - Es ist nie selbst vergebbar (nur Admin nach Nachweisprüfung) — das erzwingt
 *    die Datenbank, siehe compliance-constraints.sql Nr. 6.
 */

export type CredentialKind = 'pharmacist' | 'pharmacy' | 'pta' | 'physician'

const LABEL: Record<CredentialKind, string> = {
  pharmacist: 'Approbierte:r Apotheker:in',
  pharmacy: 'Apotheke mit Betriebserlaubnis',
  pta: 'Pharmazeutisch-technische:r Assistent:in',
  physician: 'Ärztin / Arzt',
}

const WHAT_WAS_CHECKED: Record<CredentialKind, string> = {
  pharmacist: 'Approbation bei der zuständigen Apothekerkammer geprüft',
  pharmacy: 'Betriebserlaubnis nach ApBetrO geprüft',
  pta: 'Berufsabschluss geprüft',
  physician: 'Eintrag im Arztregister geprüft',
}

const ICON: Record<CredentialKind, string> = {
  pharmacist: '🛡️',
  pharmacy: '🏥',
  pta: '✔',
  physician: '🩺',
}

export interface VerifiedBadgeProps {
  kind: CredentialKind
  verifiedAt: Date
  validUntil: Date
  /** Anzeigename, z. B. Kammer oder Behörde */
  authority?: string
  className?: string
}

export function VerifiedBadge({
  kind,
  verifiedAt,
  validUntil,
  authority,
  className,
}: VerifiedBadgeProps) {
  // Abgelaufene Prüfung => kein Siegel. Kein stiller Weiterbestand.
  if (validUntil.getTime() < Date.now()) return null

  const fmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })
  const tooltip =
    `${WHAT_WAS_CHECKED[kind]}${authority ? ` (${authority})` : ''} · ` +
    `geprüft am ${fmt.format(verifiedAt)} · gültig bis ${fmt.format(validUntil)}`

  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border border-info-border',
        'bg-info-subtle px-3 py-0.5 text-xs font-semibold text-info',
        className,
      )}
    >
      <span aria-hidden="true">{ICON[kind]}</span>
      {/* Der zugängliche Name enthält die Prüfaussage, nicht nur „verifiziert". */}
      <span className="sr-only">Geprüft: </span>
      {LABEL[kind]}
    </span>
  )
}
