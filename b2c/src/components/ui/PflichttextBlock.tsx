import { cn } from '@/lib/cn'

/**
 * PflichttextBlock — Pflichtangaben nach § 4 HWG.
 *
 * Gestalterisch ruhig, aber NIE versteckt: kein Aufklapper, keine Modal-Lösung,
 * kein Zufügen erst im Warenkorb. Der Text steht im selben Sichtbereich wie die
 * Kauf-Aktion, weil er genau dort seine Funktion erfüllt.
 *
 * `text` kommt aus der versionierten Pflichttext-Tabelle — bei Bestellungen wird
 * die gültige Fassung als Snapshot mitgeschrieben (Nachweispflicht).
 */
export function PflichttextBlock({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-4 border-t border-border pt-3 text-xs leading-relaxed text-content-muted',
        className,
      )}
    >
      <p className="font-semibold">Pflichtangaben</p>
      <p className="mt-1">{text}</p>
    </div>
  )
}

/** Standardtext für apothekenpflichtige Arzneimittel (Fallback der Redaktion). */
export const PFLICHTTEXT_STANDARD =
  'Zu Risiken und Nebenwirkungen lesen Sie die Packungsbeilage und fragen Sie ' +
  'Ihre Ärztin, Ihren Arzt oder in Ihrer Apotheke.'
