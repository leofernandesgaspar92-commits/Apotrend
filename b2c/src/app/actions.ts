'use server'

// ============================================================================
//  Server Actions — die Systemgrenze
// ============================================================================
//  Alles, was hier ankommt, kommt vom Client und ist damit unvertrauenswürdig:
//  Formularfelder lassen sich im Browser beliebig ändern. Genau deshalb liegt
//  die Compliance-Prüfung im Service (cart.ts), nicht in der Komponente.
// ============================================================================

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { addToCart, removeFromCart } from '@/lib/cart'
import { ComplianceError } from '@/lib/product'

const SESSION_COOKIE = 'apotrend_sid'

/** Sitzungs-ID aus dem Cookie; steht später für die echte Auth-Session. */
export async function sessionId(): Promise<string> {
  const store = cookies()
  const existing = store.get(SESSION_COOKIE)?.value
  if (existing) return existing
  // Beim ersten Aufruf innerhalb einer Server Action darf gesetzt werden.
  const fresh = randomUUID()
  try {
    store.set(SESSION_COOKIE, fresh, { httpOnly: true, sameSite: 'lax', path: '/' })
  } catch {
    // In einer reinen Server Component ist set() nicht erlaubt — dann bleibt
    // die ID für diesen Render flüchtig. Für die Demo ausreichend.
  }
  return fresh
}

export type ActionResult = { ok: true } | { ok: false; code: string; message: string } | null

/**
 * Signatur passend zu `useFormState`: (vorherigerZustand, formData).
 * So bleibt das Formular ohne JavaScript benutzbar (Progressive Enhancement)
 * und zeigt mit JavaScript zusätzlich die Begründung an.
 */
export async function addToCartAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const productId = String(formData.get('productId') ?? '')
  const sid = await sessionId()

  try {
    addToCart(sid, productId, 1)
    revalidatePath('/warenkorb')
    revalidatePath('/feed')
    return { ok: true }
  } catch (error) {
    if (error instanceof ComplianceError) {
      // Bewusst KEINE generische Fehlermeldung: Die Nutzer:in soll erfahren,
      // WARUM etwas nicht geht — „Rezeptpflichtig" ist eine Information,
      // kein technischer Fehler.
      return { ok: false, code: error.code, message: error.message }
    }
    throw error
  }
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const productId = String(formData.get('productId') ?? '')
  const sid = await sessionId()
  removeFromCart(sid, productId)
  revalidatePath('/warenkorb')
}
