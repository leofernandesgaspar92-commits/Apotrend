// Schreibrichtung einer Sprache: Arabisch von rechts nach links, alle übrigen
// Sprachen der App von links nach rechts. Gehört an jedes <html lang="…"> einer
// Seite, die der Server baut (öffentliche Seiten, Teilseite, Wochenbericht) —
// sonst stehen arabische Sätze linksbündig und Satzzeichen landen am falschen Ende.
export const RTL_SPRACHEN = Object.freeze(['ar']);
export const richtung = (sprache) => (RTL_SPRACHEN.includes(String(sprache || '')) ? 'rtl' : 'ltr');
