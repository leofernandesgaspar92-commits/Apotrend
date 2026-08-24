// ============================================================================
//  Compliance-Wächter — Laufzeit-Ebene
// ============================================================================
//  Die Typ-Ebene schützt den Code, den WIR schreiben. Diese Tests schützen die
//  Systemgrenze: Daten aus API, Datenbank oder Formular haben zur Laufzeit keine
//  Typen mehr. Fällt einer dieser Tests, ist ein rechtswidriger Zustand möglich.
//
//  Aufruf:  node --experimental-strip-types --test test/
// ============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertShoppable,
  assertTaggable,
  isRx,
  isShoppable,
  isArzneimittel,
  ComplianceError,
  type Product,
  type ShoppableProduct,
  type RxProduct,
} from '../src/lib/product.ts'

const otc: ShoppableProduct = {
  id: 'p1',
  slug: 'ibuprofen-400',
  name: 'Ibuprofen 400 mg',
  imageAlt: 'Packung Ibuprofen 400 mg',
  productClass: 'otc_arzneimittel',
  priceCents: 599,
  currency: 'EUR',
  pflichttext: 'Zu Risiken und Nebenwirkungen …',
  inStock: true,
}

const kosmetik: ShoppableProduct = {
  id: 'p2',
  slug: 'handcreme',
  name: 'Handcreme',
  imageAlt: 'Tube Handcreme',
  productClass: 'kosmetik',
  priceCents: 349,
  currency: 'EUR',
  pflichttext: null, // korrekt: kein Arzneimittel
  inStock: true,
}

const rx: RxProduct = {
  id: 'p3',
  slug: 'ramipril-5',
  name: 'Ramipril 5 mg',
  imageAlt: 'Packung Ramipril 5 mg',
  productClass: 'rx_arzneimittel',
  infoUrl: 'https://www.bfarm.de/beispiel',
  prescriptionFlow: 'upload',
}

test('Rx wird als Rx erkannt und ist nicht kaufbar', () => {
  assert.equal(isRx(rx), true)
  assert.equal(isShoppable(rx as Product), false)
  assert.equal(isRx(otc as Product), false)
  assert.equal(isShoppable(otc as Product), true)
})

test('assertShoppable wirft bei verschreibungspflichtigem Arzneimittel', () => {
  assert.throws(
    () => assertShoppable(rx as Product),
    (err: unknown) => err instanceof ComplianceError && err.code === 'rx_not_shoppable',
  )
})

test('assertTaggable wirft bei Rx — keine Publikumswerbung (§ 10 HWG)', () => {
  assert.throws(
    () => assertTaggable(rx as Product),
    (err: unknown) => err instanceof ComplianceError && err.code === 'rx_not_shoppable',
  )
})

test('assertShoppable wirft bei Arzneimittel ohne Pflichttext (§ 4 HWG)', () => {
  const ohnePflichttext: ShoppableProduct = { ...otc, pflichttext: null }
  assert.throws(
    () => assertShoppable(ohnePflichttext as Product),
    (err: unknown) => err instanceof ComplianceError && err.code === 'pflichttext_missing',
  )
})

test('Kosmetik braucht keinen Pflichttext und passiert den Wächter', () => {
  assert.doesNotThrow(() => assertShoppable(kosmetik as Product))
})

test('OTC mit Pflichttext passiert den Wächter', () => {
  assert.doesNotThrow(() => assertShoppable(otc as Product))
})

test('isArzneimittel trennt Arzneimittel von übrigen Klassen', () => {
  assert.equal(isArzneimittel('otc_arzneimittel'), true)
  assert.equal(isArzneimittel('rx_arzneimittel'), true)
  assert.equal(isArzneimittel('kosmetik'), false)
  assert.equal(isArzneimittel('nahrungsergaenzung'), false)
  assert.equal(isArzneimittel('medizinprodukt'), false)
})

test('Ein als OTC getarntes Rx-Objekt wird trotzdem abgefangen', () => {
  // Genau der Fall, den die Typ-Ebene NICHT abdeckt: Daten aus einer fremden
  // Quelle, bei denen die Klasse erst zur Laufzeit bekannt ist.
  const ausFremderQuelle = JSON.parse(JSON.stringify(rx)) as Product
  assert.throws(
    () => assertShoppable(ausFremderQuelle),
    (err: unknown) => err instanceof ComplianceError,
  )
})
