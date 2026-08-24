// ============================================================================
//  Verschlüsselung für Gesundheitsdaten (Art. 9 DSGVO)
// ============================================================================
//  AES-256-GCM als Envelope: Ciphertext + Nonce + Auth-Tag + Schlüsselversion.
//  Die Schlüsselversion erlaubt Rotation OHNE Datenmigration: neue Datensätze
//  mit Schlüssel n+1, alte bleiben mit n lesbar.
//
//  WICHTIG — bewusst laute Sicherung:
//  Ohne echten Schlüssel aus der Umgebung läuft dieses Modul NUR in Entwicklung
//  und protokolliert das. In Produktion wirft es beim Start. Ein Demo-Schlüssel,
//  der unbemerkt in Produktion landet, wäre schlimmer als gar keine
//  Verschlüsselung — er erzeugt ein falsches Sicherheitsgefühl.
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const NONCE_BYTES = 12
const TAG_BYTES = 16

export interface Envelope {
  cipher: Buffer
  nonce: Buffer
  tag: Buffer
  keyVersion: number
}

/** Nur für Entwicklung/Tests — deterministisch, damit Tests reproduzierbar sind. */
const DEV_KEY = createHash('sha256').update('apotrend-dev-key-not-for-production').digest()

export class KeyConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KeyConfigurationError'
  }
}

let warned = false

/**
 * Liefert den Schlüssel der angeforderten Version.
 * In echt: KMS/Vault-Abruf. Hier: Umgebungsvariable, sonst Dev-Schlüssel.
 */
export function getKey(version: number): Buffer {
  const fromEnv = process.env[`APOTREND_HEALTH_KEY_V${version}`]

  if (fromEnv) {
    const key = Buffer.from(fromEnv, 'base64')
    if (key.length !== 32) {
      throw new KeyConfigurationError(
        `APOTREND_HEALTH_KEY_V${version} muss 32 Byte (base64) sein, hat ${key.length}.`,
      )
    }
    return key
  }

  if (process.env.NODE_ENV === 'production') {
    // Kein stiller Fallback. Lieber Ausfall als Scheinsicherheit.
    throw new KeyConfigurationError(
      `Kein Schlüssel APOTREND_HEALTH_KEY_V${version} gesetzt. ` +
        'Gesundheitsdaten dürfen in Produktion nicht mit dem Entwicklungsschlüssel ' +
        'verarbeitet werden.',
    )
  }

  if (!warned) {
    warned = true
    console.warn(
      '[crypto] Entwicklungsschlüssel aktiv — NICHT für echte Gesundheitsdaten. ' +
        'Für Produktion APOTREND_HEALTH_KEY_V1 (32 Byte, base64) setzen.',
    )
  }
  return DEV_KEY
}

/** Aktuell zu verwendende Schlüsselversion für NEUE Datensätze. */
export function currentKeyVersion(): number {
  const raw = process.env.APOTREND_HEALTH_KEY_CURRENT
  const parsed = raw ? Number.parseInt(raw, 10) : 1
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function encrypt(plaintext: string, keyVersion = currentKeyVersion()): Envelope {
  const key = getKey(keyVersion)
  const nonce = randomBytes(NONCE_BYTES)
  const cipherer = createCipheriv(ALGORITHM, key, nonce)
  const cipher = Buffer.concat([cipherer.update(plaintext, 'utf8'), cipherer.final()])
  return { cipher, nonce, tag: cipherer.getAuthTag(), keyVersion }
}

export function decrypt(envelope: Envelope): string {
  const key = getKey(envelope.keyVersion)
  if (envelope.tag.length !== TAG_BYTES) {
    throw new Error('Ungültiges Auth-Tag — Datensatz möglicherweise manipuliert.')
  }
  const decipherer = createDecipheriv(ALGORITHM, key, envelope.nonce)
  decipherer.setAuthTag(envelope.tag)
  // .final() wirft, wenn der Ciphertext manipuliert wurde (GCM-Integrität).
  return Buffer.concat([decipherer.update(envelope.cipher), decipherer.final()]).toString('utf8')
}

/**
 * IP-Adressen werden für Einwilligungsnachweise gebraucht, aber nie im Klartext
 * gespeichert (Datenminimierung). Salt aus der Umgebung verhindert das
 * Zurückrechnen über eine Regenbogentabelle.
 */
export function hashIp(ip: string): string {
  const salt = process.env.APOTREND_IP_SALT ?? 'dev-salt'
  return createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 32)
}
