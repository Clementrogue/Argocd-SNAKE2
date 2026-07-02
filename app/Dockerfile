# ---------- Stage 1 : dépendances ----------
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---------- Stage 2 : runtime ----------
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Mise a jour des paquets systeme (corrige les CVE Debian connues - Etape 5)
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# npm n'est pas necessaire a l'execution (deps deja installees au build) :
# on le retire pour eliminer ses CVE internes et reduire la surface d'attaque
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

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
