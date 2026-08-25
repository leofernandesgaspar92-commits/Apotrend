// End-to-End-Gate: Feed + Shoppable Commerce.
// Der Server wird von tools/with-server.mjs verwaltet (npm run check:e2e).
// Kernfrage: Hält die Rx-Sperre, wenn im Browser manipuliert wird?
// Playwright auflösen: regulär aus node_modules (CI, nach `npm ci`), sonst aus
// einer globalen Installation (lokale Umgebungen, die es bereits mitbringen).
// Ein fest verdrahteter absoluter Pfad würde in CI scheitern.
async function loadChromium() {
  // Playwright ist ein CommonJS-Modul: je nach Auflösungsweg liegt `chromium`
  // als Named Export vor ODER auf dem Default-Export (Interop). Beides prüfen.
  const pick = (mod) => mod?.chromium ?? mod?.default?.chromium
  try {
    const found = pick(await import('playwright'))
    if (found) return found
  } catch {
    // nicht installiert — globaler Weg unten
  }
  {
    const global = '/opt/node22/lib/node_modules/playwright/index.js'
    try {
      const found = pick(await import(global))
      if (found) return found
      throw new Error('kein chromium-Export')
    } catch {
      console.error(
        '✗ Playwright nicht gefunden. Installieren mit:\n' +
          '  npm i -D playwright && npx playwright install chromium',
      )
      process.exit(2)
    }
  }
}
const chromium = await loadChromium()
const BASE = process.argv[2] || 'http://127.0.0.1:3100'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 120)) })

  await page.goto(BASE + '/feed', { waitUntil: 'networkidle' })

  // 1. Feed rendert
  const articles = await page.locator('article').count()
  check('Feed rendert alle Beiträge', articles === 4, `${articles} Artikel`)

  // 2. Rx-Produkt: Information, KEIN Kauf
  const rxCard = page.locator('[data-product-class="rx"]')
  const rxVisible = await rxCard.count()
  const rxHasSubmit = await rxCard.locator('button[type="submit"]').count()
  const rxText = rxVisible ? (await rxCard.first().innerText()).replace(/\s+/g, ' ') : ''
  check('Rx-Produkt erscheint im Feed', rxVisible === 1)
  check('Rx-Karte hat KEINEN Kauf-Button', rxHasSubmit === 0, `${rxHasSubmit} Submit-Buttons`)
  check('Rx-Karte zeigt „Rezeptpflichtig"', /Rezeptpflichtig/.test(rxText))
  check('Rx-Karte zeigt KEINEN Preis', !/€/.test(rxText), rxText.slice(0, 60))

  // 3. Zulässiger Kauf funktioniert
  const otcForm = page.locator('form:has(input[value="prod-ibu"])').first()
  await otcForm.locator('button[type="submit"]').click()
  await page.waitForTimeout(1200)
  const okMsg = await page.locator('[role="status"]').count()
  check('OTC-Produkt lässt sich kaufen', okMsg > 0)

  await page.goto(BASE + '/warenkorb', { waitUntil: 'networkidle' })
  const lines = await page.locator('[data-testid="cart-lines"] li').count()
  const total = await page.locator('[data-testid="cart-total"]').innerText().catch(() => '')
  check('Warenkorb enthält die Position', lines === 1, `Summe ${total}`)

  // 4. DER KERNTEST: Manipulation im Browser — Rx-Produkt-ID in ein gültiges
  //    Kauf-Formular schmuggeln und die echte Server Action auslösen.
  await page.goto(BASE + '/feed', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const input = document.querySelector('form input[value="prod-ibu"]')
    if (input) input.value = 'prod-rami' // verschreibungspflichtig
  })
  const tampered = await page.locator('form:has(input[value="prod-rami"])').count()
  check('Manipulation im DOM gelungen (Vorbedingung)', tampered === 1)

  await page.locator('form:has(input[value="prod-rami"]) button[type="submit"]').first().click()
  await page.waitForTimeout(1500)
  const alertText = await page.locator('[role="alert"]').first().innerText().catch(() => '')
  check(
    'Server weist manipuliertes Rx zurück',
    /verschreibungspflichtig/i.test(alertText),
    alertText.replace(/\s+/g, ' ').slice(0, 90),
  )

  await page.goto(BASE + '/warenkorb', { waitUntil: 'networkidle' })
  const linesAfter = await page.locator('[data-testid="cart-lines"] li').count()
  const cartText = await page.locator('main').innerText()
  check('Rx ist NICHT im Warenkorb gelandet', linesAfter === 1 && !/Ramipril/.test(cartText),
    `${linesAfter} Position(en)`)

  // 5. Layout & Themes
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  check('Kein Querscroll bei 390px', !overflow)

  await page.goto(BASE + '/feed', { waitUntil: 'networkidle' })
  const themes = await page.evaluate(() => {
    const el = document.querySelector('article')
    const read = () => getComputedStyle(document.body).backgroundColor
    document.documentElement.dataset.theme = 'light'
    const light = read()
    document.documentElement.dataset.theme = 'dark'
    const dark = read()
    return { light, dark, hasArticle: !!el }
  })
  check('Dark-Mode wechselt die Fläche', themes.light !== themes.dark, `${themes.light} → ${themes.dark}`)

  // 6. Barrierefreiheit: Touch-Targets + Alt-Texte + Fokus
  const a11y = await page.evaluate(() => {
    // Nur SICHTBARE Ziele prüfen: die Sprungmarke ist bis zum Fokus per sr-only
    // ausgeblendet und dort kein Klick-Ziel (im Fokus wächst sie auf > 48px).
    const small = [...document.querySelectorAll('button, a')].filter((el) => {
      if (el.classList.contains('sr-only')) return false
      const r = el.getBoundingClientRect()
      return r.height > 0 && r.height < 44
    }).map((el) => (el.textContent || '').trim().slice(0, 24))
    const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => i.getAttribute('alt') === null).length
    return { small, imgsNoAlt }
  })
  check('Alle Bedienelemente ≥ 44px hoch', a11y.small.length === 0, a11y.small.join(' | '))
  check('Keine Bilder ohne alt', a11y.imgsNoAlt === 0)

  // ==========================================================================
  //  Care-Strecke: Einwilligung, Upload, Widerruf
  // ==========================================================================
  await page.goto(BASE + '/rezept', { waitUntil: 'networkidle' })

  // 7. Ohne Einwilligung kein Upload
  const uploadBeforeConsent = await page.locator('[data-testid="rx-submit"]').count()
  const consentVisible = await page.locator('[data-testid="consent-submit"]').count()
  check('Ohne Einwilligung ist der Upload nicht erreichbar', uploadBeforeConsent === 0)
  check('Einwilligungs-Gate wird gezeigt', consentVisible === 1)

  // 8. Kästchen sind NICHT vorangekreuzt (EuGH Planet49)
  const preChecked = await page.evaluate(
    () => [...document.querySelectorAll('input[type="checkbox"]')].filter((c) => c.checked).length,
  )
  check('Kein Kästchen ist vorangekreuzt', preChecked === 0)

  // 9. Absenden ist gesperrt, solange Pflicht-Einwilligungen fehlen
  const submitDisabled = await page.locator('[data-testid="consent-submit"]').isDisabled()
  check('Absenden gesperrt ohne Pflicht-Einwilligung', submitDisabled)

  // 10. Nur die freiwillige ankreuzen -> weiterhin gesperrt (kein Koppelungs-Trick)
  await page.locator('#consent-medication_list').check()
  await page.waitForTimeout(150)
  const stillDisabled = await page.locator('[data-testid="consent-submit"]').isDisabled()
  check('Freiwillige Einwilligung allein schaltet nicht frei', stillDisabled)

  // 11. Pflicht-Einwilligungen erteilen
  await page.locator('#consent-health_data_processing').check()
  await page.locator('#consent-prescription_handling').check()
  await page.waitForTimeout(150)
  await page.locator('[data-testid="consent-submit"]').click()
  await page.waitForTimeout(1500)
  await page.reload({ waitUntil: 'networkidle' })
  const uploadAfterConsent = await page.locator('[data-testid="rx-submit"]').count()
  check('Nach Einwilligung erscheint der Upload', uploadAfterConsent === 1)

  // 12. Rezept einreichen
  await page.locator('#document').fill('Muster 16 — Demo-Inhalt')
  await page.locator('[data-testid="rx-submit"]').click()
  await page.waitForTimeout(1500)
  const okText = await page.locator('[data-testid="care-ok"]').first().innerText().catch(() => '')
  check('Rezept wird angenommen', /eingereicht/i.test(okText), okText.slice(0, 60))

  await page.reload({ waitUntil: 'networkidle' })
  const rxItems = await page.locator('[data-testid="rx-list"] li').count()
  const rxListText = await page.locator('[data-testid="rx-list"]').innerText().catch(() => '')
  check('Einreichung ist gelistet', rxItems === 1)
  check('Löschfrist wird genannt', /Löschung spätestens/.test(rxListText),
    rxListText.replace(/\s+/g, ' ').slice(0, 70))

  // 13. KERNTEST: Widerruf in einem Tab, veraltetes Formular in einem anderen.
  //     Der Server muss den Upload trotzdem ablehnen.
  const stale = await ctx.newPage()
  await stale.goto(BASE + '/rezept', { waitUntil: 'networkidle' })
  const staleHasForm = await stale.locator('[data-testid="rx-submit"]').count()

  await page.locator('[data-testid="revoke"]').click() // Widerruf im ersten Tab
  await page.waitForTimeout(1200)

  await stale.locator('#document').fill('Versuch nach Widerruf')
  await stale.locator('[data-testid="rx-submit"]').click()
  await stale.waitForTimeout(1500)
  const staleErr = await stale.locator('[data-testid="care-error"]').first().innerText().catch(() => '')
  check('Veraltetes Formular vorhanden (Vorbedingung)', staleHasForm === 1)
  check(
    'Server lehnt Upload nach Widerruf ab',
    /Einwilligung/i.test(staleErr),
    staleErr.replace(/\s+/g, ' ').slice(0, 70),
  )
  await stale.close()

  // 14. Nach Widerruf ist das Gate wieder aktiv
  await page.reload({ waitUntil: 'networkidle' })
  const gateBack = await page.locator('[data-testid="consent-submit"]').count()
  check('Nach Widerruf greift das Einwilligungs-Gate wieder', gateBack === 1)

  const careOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  check('Kein Querscroll auf der Rezept-Seite (390px)', !careOverflow)

  check('Keine JS-Fehler', errors.length === 0, errors.slice(0, 2).join(' | '))

  await ctx.close()
  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(failed.length === 0
    ? `✓ Alle ${results.length} Prüfungen bestanden.`
    : `✗ ${failed.length} von ${results.length} Prüfungen fehlgeschlagen.`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
