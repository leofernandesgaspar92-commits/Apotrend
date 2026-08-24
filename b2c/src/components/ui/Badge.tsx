import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Badge — Statuskennzeichnung.
 *
 * Grundsatz: Farbe ist NIE der alleinige Informationsträger (WCAG 1.4.1).
 * Jede Variante trägt deshalb Text; Icons sind Zugabe, nicht Ersatz.
 *
 * Bewusst NICHT vorhanden: eine „urgency"-Variante („nur noch 2 Stück",
 * Countdown). Angstwerbung ist nach § 11 HWG unzulässig — was es nicht gibt,
 * kann auch nicht versehentlich an einem Arzneimittel landen.
 */

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'rx' | 'ad'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-content-muted border-border',
  info: 'bg-info-subtle text-info border-info-border',
  success: 'bg-success-subtle text-success border-success-border',
  warning: 'bg-warning-subtle text-warning border-warning-border',
  danger: 'bg-danger-subtle text-danger border-danger-border',
  rx: 'bg-rx-subtle text-rx border-rx-border',
  // Anzeigen-Kennzeichnung: bewusst nüchtern, nie dekorativ oder übersehbar
  ad: 'bg-surface text-content-muted border-border-strong uppercase tracking-wide',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  icon?: React.ReactNode
}

export function Badge({ tone = 'neutral', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-0.5',
        'text-xs font-semibold leading-relaxed',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}

/**
 * LiveBadge — pulsiert, respektiert aber `prefers-reduced-motion`
 * (die Animation ist in der Tailwind-Konfiguration entsprechend gekapselt).
 */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill bg-danger px-3 py-0.5',
        'text-xs font-bold uppercase tracking-wide text-white',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-pill bg-current motion-safe:animate-pulse-live"
      />
      Live
    </span>
  )
}
