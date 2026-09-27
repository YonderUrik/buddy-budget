# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
# (check=skip: i valori ENV "segreti" dello stage builder sono segnaposto fittizi, l'avviso non è pertinente.)

# ---- base: Node + pnpm alla versione fissata in package.json ----
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.5.0
WORKDIR /app

# ---- deps: dipendenze complete (servono a build e migrator) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

# ---- builder: next build ----
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Valori FITTIZI solo per la build: alcuni moduli leggono l'env all'import (client DB/Redis, Resend,
# better-auth) e next build li importa. Non arrivano nell'immagine finale: lo stage runner parte da zero
# e l'env vero arriva a runtime (validato in instrumentation.ts).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?sslmode=disable \
    REDIS_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-0000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_build_placeholder
# NEXT_PUBLIC_* non sono un'eccezione al commento sopra: Next.js le sostituisce testualmente in
# fase di build in ogni file (anche i Server Component), quindi il valore letto a runtime nel pod
# non ha alcun effetto se il bundle è stato compilato senza — vanno per forza passate qui.
ARG NEXT_PUBLIC_UMAMI_SRC=""
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=""
ENV NEXT_PUBLIC_UMAMI_SRC=$NEXT_PUBLIC_UMAMI_SRC \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID
RUN pnpm build

# ---- migrator: esegue le migration Drizzle (Job PreSync in k8s) ----
FROM deps AS migrator
COPY tsconfig.json drizzle.config.ts ./
COPY lib ./lib
USER node
CMD ["pnpm", "db:migrate"]

# ---- runner: immagine dell'app ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
