# Nightwatch — v1, deploy anywhere
# Only dependency is express; SQLite is the built-in node:sqlite module (Node >= 22.5).
# No native compilation, no prebuilt binaries, works on any platform Docker supports.

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first (layer cache), then copy the code.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# Pins live outside the image: mount a volume at /data
# (e.g. `docker run -v nightwatch-data:/data -p 3000:3000 nightwatch`).
RUN mkdir -p /data && chown node:node /data
ENV DB_PATH=/data/nightwatch.db

EXPOSE 3000
VOLUME /data
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
