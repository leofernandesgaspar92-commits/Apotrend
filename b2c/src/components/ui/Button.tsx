import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Button — die einzige Schaltflächen-Komponente des Systems.
 *
 * Zielgruppen-Vorgaben, die hier fest verdrahtet sind (nicht optional):
 *  - Mindesthöhe 48 px auch in Größe „sm" (Touch-Target, Generation 50+)
 *  - sichtbarer Fokus-Ring über :focus-visible (3 px, 2 px Offset)
 *  - `loading` deaktiviert UND meldet den Zustand an Screenreader
 *  - Icon-only nur mit Pflicht-Label (siehe IconButton unten)
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'care' | 'danger' | 'link'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-action text-action-fg hover:bg-action-hover active:bg-action-active border border-transparent',
  secondary:
    'bg-surface text-content border border-border-strong hover:bg-surface-sunken',
  ghost:
    'bg-transparent text-content border border-transparent hover:bg-surface-sunken',
  care: 'bg-care text-care-fg hover:bg-care-hover border border-transparent',
  danger: 'bg-danger text-white hover:brightness-95 border border-transparent',
  link: 'bg-transparent text-care underline underline-offset-4 border-0 px-0',
}

// Auch „sm" bleibt bei 48 px Höhe — kleinere Trefferflächen sind für die
// Kernzielgruppe nicht vertretbar. „sm" reduziert nur die Innenabstände.
const SIZES: Record<Size, string> = {
  sm: 'min-h-touch px-3 text-sm',
  md: 'min-h-touch px-5 text-base',
  lg: 'min-h-touch-lg px-6 text-lg',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Begründung, warum der Button deaktiviert ist. Wird Screenreadern gemeldet. */
  disabledReason?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    disabledReason,
    className,
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      // Ein deaktivierter Button ohne Begründung ist eine Sackgasse —
      // die Begründung wandert in den zugänglichen Namen.
      aria-description={isDisabled ? disabledReason : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-semibold',
        'transition-colors duration-DEFAULT',
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
})

/**
 * IconButton — Icon ohne sichtbaren Text ist nur mit Pflicht-Label erlaubt.
 * `label` ist NICHT optional: ein unbeschriftetes Icon wäre für die
 * Kernzielgruppe und für Screenreader gleichermaßen unbrauchbar.
 */
export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  label: string
  icon: React.ReactNode
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, icon, className, ...props }, ref) {
    return (
      <Button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn('min-w-touch px-0', className)}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </Button>
    )
  },
)
