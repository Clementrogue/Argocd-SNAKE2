# ---------- Stage 1 : dépendances ----------
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---------- Stage 2 : runtime ----------
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Utilisateur non-root (sécurité — Étape 5)
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER appuser
EXPOSE 3000

# Healthcheck aligné avec la probe K8s
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
