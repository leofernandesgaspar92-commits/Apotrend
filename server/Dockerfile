# ApoTrend Feed-App — universeller Container (läuft auf Render, Railway, Fly.io,
# jedem Docker-Host). Reines Node-Built-in-Backend, keine externen npm-Pakete.
FROM node:22-alpine

WORKDIR /app

# package.json zuerst (Layer-Caching). Es gibt keine Dependencies, daher ist
# "npm install" praktisch ein No-op — bleibt aber für spätere Pakete korrekt.
COPY package.json ./
RUN npm install --omit=dev

# Anwendungscode
COPY . .

ENV NODE_ENV=production
# Der Host setzt PORT selbst; 4000 nur als Fallback/Doku.
ENV PORT=4000
EXPOSE 4000

# Health-Check nutzt den eingebauten /api/health-Endpunkt.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "src/http/server.js"]
