# ApoTrend Feed-App — universeller Container (läuft auf Render, Railway, Fly.io,
# jedem Docker-Host). Das Backend läuft auf Node-Built-ins; einzige Abhängigkeit
# ist der Prisma-Client für den OPTIONALEN PostgreSQL-Spiegel der Live-Daten.
# Ohne DATABASE_URL startet der Container unverändert ohne Datenbank.
FROM node:22-alpine

WORKDIR /app

# Manifeste zuerst (Layer-Caching).
COPY package.json package-lock.json* ./
# --include=dev holt die Prisma-CLI; sie wird nur für "prisma generate"
# gebraucht und ist zur Laufzeit nicht nötig (siehe Aufräumschritt unten).
RUN npm install --include=dev

# Schema vor dem restlichen Code: Der erzeugte Client hängt nur daran, die
# Ebene bleibt damit über Code-Änderungen hinweg im Cache.
COPY prisma ./prisma
RUN npx --no-install prisma generate --schema prisma/schema.prisma

# Anwendungscode
COPY . .

# Build-Werkzeuge abwerfen. Geprüft: Der erzeugte Client unter
# node_modules/.prisma überlebt den Schritt und lässt sich danach laden.
# (Das Prisma-CLI-Paket selbst bleibt liegen — @prisma/client zieht es in
# Version 6 mit; der Schritt spart also weniger als es aussieht, schadet
# aber nicht und stimmt, sobald das Paket wirklich nur noch devDependency ist.)
RUN npm prune --omit=dev

ENV NODE_ENV=production
# Der Host setzt PORT selbst; 4000 nur als Fallback/Doku.
ENV PORT=4000
EXPOSE 4000

# Health-Check nutzt den eingebauten /api/health-Endpunkt.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "src/http/server.js"]
