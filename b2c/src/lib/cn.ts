/**
 * Minimaler Klassennamen-Helfer — bewusst ohne Abhängigkeit.
 * (clsx/tailwind-merge kann später ersetzen; für das Design-System reicht das.)
 */
export type ClassValue = string | false | null | undefined

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
