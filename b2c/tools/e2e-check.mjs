// End-to-End-Gate: Feed + Shoppable Commerce.
// Voraussetzung: laufender Server (npx next start -p 3100).
// Kernfrage: Hält die Rx-Sperre, wenn im Browser manipuliert wird?
import pkg from '/opt/node22/lib/node_modules/playwright/index.js'
const { chromium } = pkg
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
