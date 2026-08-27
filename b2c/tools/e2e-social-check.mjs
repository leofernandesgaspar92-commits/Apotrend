// ============================================================================
//  End-to-End-Gate: Rich Media, Reaktionen, Kommentare, Beitrags-Editor
// ============================================================================
//  Ergänzt e2e-check.mjs (Feed + Commerce + Care) um die Medien-Strecke.
//  Der Server wird von tools/with-server.mjs verwaltet.
//
//  Kernfragen dieser Datei:
//   · Erzeugt ein automatischer Feed mit Rx-Produkt ein Kauf-Overlay? (darf nicht)
//   · Ist die Kennzeichnung „Anzeige" samt Auftraggeber wirklich sichtbar?
//   · Startet ein Video von selbst? (darf nicht)
//   · Lässt sich ein Bild OHNE Beschreibung veröffentlichen? (darf nicht)
//   · Hält die Verschachtelungsgrenze im echten DOM?
// ============================================================================

async function loadChromium() {
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
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140))
  })

  await page.goto(BASE + '/neuigkeiten', { waitUntil: 'networkidle' })

  // ==========================================================================
  //  1. Kennzeichnung von Werbung
  // ==========================================================================

  const sponsored = page.locator('[data-sponsored="true"]')
  check('Genau ein Beitrag ist als bezahlt markiert', (await sponsored.count()) === 1)

  const sponsoredText = (await sponsored.first().innerText()).replace(/\s+/g, ' ')
  // Das Badge rendert per CSS in Großbuchstaben („ANZEIGE") — bewusst, weil die
  // Kennzeichnung ins Auge fallen soll. Deshalb ohne Rücksicht auf Groß/Klein prüfen.
  check('Anzeige trägt das Wort „Anzeige"', /anzeige/i.test(sponsoredText))
  check(
    'Anzeige nennt den Auftraggeber im Klartext',
    /Bezahlter Beitrag von Nordsee Pharma GmbH/.test(sponsoredText),
  )

  // Die Kennzeichnung muss ÜBER dem Inhalt stehen, nicht darunter.
  const disclosureAboveHeadline = await page.evaluate(() => {
    const article = document.querySelector('[data-sponsored="true"]')
    const badge = article?.querySelector('[data-testid^="disclosure-"]')
    const headline = article?.querySelector('h2')
    if (!badge || !headline) return false
    return badge.getBoundingClientRect().top < headline.getBoundingClientRect().top
  })
  check('Kennzeichnung steht vor der Überschrift', disclosureAboveHeadline)

  const fachNews = await page.locator('[data-sponsored="false"]').count()
  check('Redaktionelle Beiträge sind als Fach-News markiert', fachNews === 3, `${fachNews} Beiträge`)

  // ==========================================================================
  //  2. DER KERNTEST: Rx-Produkt in einem automatischen Feed
  // ==========================================================================

  const rxCard = page.locator('[data-testid="news-news-4"]')
  const rxHasShoppable = await rxCard.locator('[data-testid^="shoppable-"]').count()
  const rxHasInfo = await rxCard.locator('[data-testid^="informational-"]').count()
  const rxCardText = (await rxCard.innerText()).replace(/\s+/g, ' ')

  check('Rx-Beitrag erscheint im News-Feed', (await rxCard.count()) === 1)
  check('Rx-Beitrag hat KEIN Kauf-Overlay', rxHasShoppable === 0, `${rxHasShoppable} Overlays`)
  check('Rx-Beitrag zeigt den Informations-Zweig', rxHasInfo === 1)
  check('Rx-Beitrag nennt keinen Preis', !/€/.test(rxCardText))
  check(
    'Rx-Beitrag hat keinen Bestell-Knopf',
    (await rxCard.locator('button[type="submit"]').count()) === 0,
  )

  // Zum Vergleich: Der OTC-Beitrag hat sehr wohl ein Overlay.
  const otcShoppable = await page
    .locator('[data-testid="news-news-1"] [data-testid="shoppable-news-1"]')
    .count()
  check('OTC-Beitrag hat sein Kauf-Overlay', otcShoppable === 1)

  // ==========================================================================
  //  3. Bildergalerie
  // ==========================================================================

  const gallery = page.locator('[data-testid="news-news-3"] [data-testid="media-carousel"]')
  check('Galerie wird gerendert', (await gallery.count()) === 1)

  const counterBefore = await gallery.locator('[data-testid="carousel-counter"]').innerText()
  check('Zähler steht in Klartext', /Bild 1 von 3/.test(counterBefore), counterBefore)

  // Sichtbare Schaltflächen, keine versteckte Wischgeste.
  const nextVisible = await gallery.locator('[data-testid="carousel-next"]').isVisible()
  check('Vor-Schaltfläche ist ohne Überfahren sichtbar', nextVisible)

  await gallery.locator('[data-testid="carousel-next"]').click()
  await page.waitForTimeout(600)
  const counterAfter = await gallery.locator('[data-testid="carousel-counter"]').innerText()
  check('Weiterblättern ändert den Zähler', /Bild 2 von 3/.test(counterAfter), counterAfter)

  const prevDisabledAtStart = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="news-news-3"] [data-testid="media-carousel"]')
    return g?.querySelector('[data-testid="carousel-prev"]')?.disabled
  })
  check('Zurück ist am ersten Bild nicht mehr gesperrt (wir sind bei 2)', prevDisabledAtStart === false)

  const galleryImages = await gallery.locator('img').count()
  const galleryAlts = await gallery.locator('img:not([alt=""])').count()
  check('Jedes Galeriebild hat einen alt-Text', galleryImages === galleryAlts, `${galleryImages} Bilder`)

  // ==========================================================================
  //  4. Video
  // ==========================================================================

  const video = page.locator('[data-testid="video-player"]')
  check('Videoplayer wird gerendert', (await video.count()) === 1)

  const videoProps = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="video-player"]')
    if (!v) return null
    return {
      autoplay: v.autoplay,
      controls: v.controls,
      preload: v.preload,
      poster: v.getAttribute('poster') || '',
      tracks: v.querySelectorAll('track[kind="captions"]').length,
      trackDefault: !!v.querySelector('track[kind="captions"][default]'),
      paused: v.paused,
    }
  })
  check('Video startet NICHT von selbst', videoProps?.autoplay === false && videoProps?.paused === true)
  check('Video hat Bedienelemente', videoProps?.controls === true)
  check('Video lädt erst auf Wunsch', videoProps?.preload === 'none', String(videoProps?.preload))
  check('Video hat ein Standbild', (videoProps?.poster ?? '').length > 0)
  check('Untertitelspur ist eingebunden und aktiv', videoProps?.tracks === 1 && videoProps?.trackDefault)

  // Die Abschrift ist die Alternative für Gehörlose — sie muss erreichbar sein.
  const transcriptHiddenBefore = await page.locator('[data-testid="transcript"]').isHidden()
  await page.locator('[data-testid="transcript-toggle"]').click()
  await page.waitForTimeout(300)
  const transcriptText = await page.locator('[data-testid="transcript"]').innerText()
  check('Abschrift ist zunächst eingeklappt', transcriptHiddenBefore)
  check(
    'Abschrift lässt sich öffnen und hat Inhalt',
    /Pumpe mehrmals betätigen/.test(transcriptText),
    transcriptText.replace(/\s+/g, ' ').slice(0, 60),
  )

  // ==========================================================================
  //  5. Reaktionen
  // ==========================================================================

  const trigger = page.locator('[data-testid="react-trigger-news-1"]')

  // Überfahren darf NICHTS öffnen — das ist der Unterschied zu Facebook.
  await trigger.hover()
  await page.waitForTimeout(400)
  check(
    'Überfahren öffnet die Auswahl nicht',
    (await page.locator('[data-testid="react-popup-news-1"]').count()) === 0,
  )

  await trigger.click()
  await page.waitForTimeout(300)
  const popup = page.locator('[data-testid="react-popup-news-1"]')
  check('Klick öffnet die Auswahl', (await popup.count()) === 1)

  const popupText = (await popup.innerText()).replace(/\s+/g, ' ')
  check(
    'Jede Reaktion trägt ihren Namen, nicht nur ein Emoji',
    /Gefällt mir/.test(popupText) &&
      /Informativ/.test(popupText) &&
      /Hilfreich/.test(popupText) &&
      /Danke/.test(popupText),
    popupText.slice(0, 70),
  )

  await popup.locator('[data-testid="react-thanks"]').click()
  await page.waitForTimeout(1200)
  const barText = (await page.locator('[data-testid="reactions-news-1"]').innerText()).replace(/\s+/g, ' ')
  check('Eigene Reaktion wird übernommen', /Danke/.test(barText), barText.slice(0, 70))

  // Startbestand für news-1: 3× Informativ, 1× Hilfreich, 1× Danke = 5.
  // Nach der eigenen Reaktion: 2× Danke.
  check('Zähler wird hochgezählt', /2× Danke/.test(barText), barText.slice(0, 80))

  // Dieselbe noch einmal nimmt sie zurück.
  await page.locator('[data-testid="react-trigger-news-1"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="react-thanks"]').first().click()
  await page.waitForTimeout(1200)
  const barAfter = (await page.locator('[data-testid="reactions-news-1"]').innerText()).replace(/\s+/g, ' ')
  check('Nochmal dieselbe nimmt die Reaktion zurück', /1× Danke/.test(barAfter), barAfter.slice(0, 80))

  // Escape schließt die Auswahl wieder.
  await page.locator('[data-testid="react-trigger-news-1"]').click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check(
    'Escape schließt die Auswahl',
    (await page.locator('[data-testid="react-popup-news-1"]').count()) === 0,
  )

  // ==========================================================================
  //  6. Kommentare: Verschachtelung und Anhänge
  // ==========================================================================

  const depths = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="comment-c-"]')].map((el) =>
      Number(el.getAttribute('data-depth')),
    ),
  )
  check('Kommentare sind verschachtelt', Math.max(...depths) > 0, `Tiefen: ${depths.join(',')}`)
  check('Verschachtelung ist gedeckelt', Math.max(...depths) <= 3, `max ${Math.max(...depths)}`)

  const capText = await page.locator('[data-testid="comment-c-seed-4"]').first().innerText()
  check('Bei gedeckelter Tiefe bleibt der Bezug erhalten', /Antwort an @/.test(capText))

  const commentMedia = await page.locator('[data-testid="comment-media"] img').count()
  const commentMediaAlt = await page
    .locator('[data-testid="comment-media"] img:not([alt=""])')
    .count()
  check('Kommentar-Anhang wird angezeigt', commentMedia >= 1, `${commentMedia} Anhänge`)
  check('Kommentar-Anhänge haben alt-Texte', commentMedia === commentMediaAlt)

  // Antwort-Formular ist eingeklappt und öffnet sich auf Klick.
  const replyFormBefore = await page.locator('[data-testid="reply-form-c-seed-5"]').count()
  await page.locator('[data-testid="reply-toggle-c-seed-5"]').click()
  await page.waitForTimeout(400)
  const replyFormAfter = await page.locator('[data-testid="reply-form-c-seed-5"]').count()
  check('Antwort-Formular ist zunächst eingeklappt', replyFormBefore === 0)
  check('Antworten öffnet das Formular', replyFormAfter === 1)

  await page.locator('[data-testid="reply-body-c-seed-5"]').fill('Guter Hinweis, danke!')
  await page.locator('[data-testid="reply-submit-c-seed-5"]').click()
  await page.waitForTimeout(1800)
  const countText = await page.locator('[data-testid="comment-count-news-1"]').innerText()
  check('Antwort wird gespeichert und mitgezählt', /6 Kommentare/.test(countText), countText)

  // ==========================================================================
  //  7. GIF-Auswahl
  // ==========================================================================

  await page.locator('[data-testid="comment-form-news-3"] [data-testid="gif-trigger"]').click()
  await page.waitForTimeout(300)
  const gifPanel = page.locator('[data-testid="gif-panel"]')
  check('GIF-Auswahl öffnet', (await gifPanel.count()) === 1)

  const gifCount = await gifPanel.locator('img').count()
  check('GIF-Bibliothek zeigt Treffer', gifCount === 4, `${gifCount} GIFs`)

  // Die GIFs müssen wirklich decodieren — ein kaputtes GIF fiele hier auf.
  const gifsDecoded = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('[data-testid="gif-panel"] img')]
    const sizes = []
    for (const img of imgs) {
      try {
        await img.decode()
        sizes.push(img.naturalWidth)
      } catch {
        sizes.push(0)
      }
    }
    return sizes
  })
  check(
    'Alle GIFs decodieren im Browser',
    gifsDecoded.every((w) => w > 0),
    gifsDecoded.join(','),
  )

  await page.locator('[data-testid="gif-search"]').fill('danke')
  await page.waitForTimeout(300)
  const filtered = await gifPanel.locator('img').count()
  check('GIF-Suche filtert', filtered === 1, `${filtered} Treffer`)

  await page.locator('[data-testid="gif-option-gif-danke"]').click()
  await page.waitForTimeout(400)
  const attached = await page
    .locator('[data-testid="comment-form-news-3"] img[alt=""]')
    .count()
  check('Ausgewähltes GIF hängt am Kommentar', attached === 1)

  // ==========================================================================
  //  8. Emoji-Auswahl
  // ==========================================================================

  await page.locator('[data-testid="comment-body-news-3"]').fill('Hallo')
  await page.locator('[data-testid="comment-form-news-3"] [data-testid="emoji-trigger"]').click()
  await page.waitForTimeout(300)
  check('Emoji-Auswahl öffnet', (await page.locator('[data-testid="emoji-panel"]').count()) === 1)

  const emojiLabelled = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-testid="emoji-panel"] button')]
    return btns.length > 0 && btns.every((b) => (b.getAttribute('aria-label') || '').length > 2)
  })
  check('Jedes Emoji hat einen sprechenden Namen', emojiLabelled)

  await page.locator('[data-testid="emoji-panel"] button').first().click()
  await page.waitForTimeout(300)
  const bodyValue = await page.locator('[data-testid="comment-body-news-3"]').inputValue()
  check('Emoji wird in den Text eingefügt', bodyValue.length > 'Hallo'.length, bodyValue)

  // ==========================================================================
  //  9. Beitrags-Editor: DER Alt-Text-Zwang
  // ==========================================================================

  await page.goto(BASE + '/neuigkeiten', { waitUntil: 'networkidle' })
  await page.locator('[data-testid="open-composer"]').click()
  await page.waitForTimeout(400)
  check('Editor öffnet als Dialog', await page.locator('[data-testid="composer"]').isVisible())

  await page.locator('[data-testid="composer-body"]').fill('Ein Hinweis aus der Praxis.')
  await page.waitForTimeout(200)
  const submitEnabledWithText = await page.locator('[data-testid="composer-submit"]').isEnabled()
  check('Reiner Text lässt sich absenden', submitEnabledWithText)

  // Ein echtes Bild anhängen — und dann OHNE Beschreibung absenden wollen.
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: 'befund.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  })
  await page.waitForTimeout(700)

  const draftCount = await page.locator('[data-testid="draft-list"] li').count()
  check('Angehängtes Bild erscheint in der Liste', draftCount === 1)

  const blocked = await page.locator('[data-testid="composer-submit"]').isDisabled()
  const missingText = await page.locator('[data-testid="composer-missing"]').innerText()
  check('Bild OHNE Beschreibung sperrt das Absenden', blocked)
  check(
    'Es wird benannt, WAS fehlt',
    /Bildbeschreibung für Anhang 1/.test(missingText),
    missingText.replace(/\s+/g, ' ').slice(0, 60),
  )

  await page.locator('[data-testid="draft-alt-0"]').fill('Ein Beispielbild ohne Aussagekraft')
  await page.waitForTimeout(300)
  const unblocked = await page.locator('[data-testid="composer-submit"]').isEnabled()
  check('Mit Beschreibung wird das Absenden frei', unblocked)

  await page.locator('[data-testid="composer-submit"]').click()
  await page.waitForTimeout(2200)
  const composerClosed = (await page.locator('[data-testid="composer"]').count()) === 0 ||
    !(await page.locator('[data-testid="composer"]').isVisible())
  check('Editor schließt nach dem Veröffentlichen', composerClosed)

  await page.reload({ waitUntil: 'networkidle' })
  const userPosts = await page.locator('[data-testid^="userpost-"]').count()
  const userPostAlt = await page
    .locator('[data-testid^="userpost-"] img[alt="Ein Beispielbild ohne Aussagekraft"]')
    .count()
  check('Beitrag ist veröffentlicht', userPosts === 1)
  check('Die eingegebene Bildbeschreibung steht am Bild', userPostAlt === 1)

  // ==========================================================================
  //  10. Layout und Barrierefreiheit
  // ==========================================================================

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  check('Kein Querscroll bei 390px', !overflow)

  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(300)
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    check(`Kein Querscroll bei ${width}px`, !wide)
  }
  await page.setViewportSize({ width: 390, height: 844 })

  const small = await page.evaluate(() => {
    return [...document.querySelectorAll('button, a, summary, input[type="range"]')]
      .filter((el) => {
        if (el.classList.contains('sr-only')) return false
        const r = el.getBoundingClientRect()
        return r.height > 0 && r.height < 44
      })
      .map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24))
  })
  check('Alle Bedienelemente ≥ 44px hoch', small.length === 0, small.slice(0, 4).join(' | '))

  const imgsNoAlt = await page.evaluate(
    () => [...document.querySelectorAll('img')].filter((i) => i.getAttribute('alt') === null).length,
  )
  check('Kein Bild ohne alt-Attribut', imgsNoAlt === 0)

  // Dark-Mode: die neuen Flächen dürfen nicht hell stehen bleiben.
  const themes = await page.evaluate(() => {
    const read = () => {
      const card = document.querySelector('[data-testid^="news-"]')
      return card ? getComputedStyle(card).backgroundColor : ''
    }
    document.documentElement.dataset.theme = 'light'
    const light = read()
    document.documentElement.dataset.theme = 'dark'
    const dark = read()
    document.documentElement.dataset.theme = 'light'
    return { light, dark }
  })
  check('News-Karte kippt im Dark-Mode', themes.light !== themes.dark, `${themes.light} → ${themes.dark}`)

  check('Keine JS-Fehler', errors.length === 0, errors.slice(0, 2).join(' | '))

  await ctx.close()
  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(
    failed.length === 0
      ? `✓ Alle ${results.length} Medien-Prüfungen bestanden.`
      : `✗ ${failed.length} von ${results.length} Medien-Prüfungen fehlgeschlagen.`,
  )
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
