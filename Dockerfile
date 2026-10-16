# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
# (check=skip: the "secret" ENV values in the builder stage are fake placeholders, the warning does not apply.)

# ---- base: Node + pnpm at the version pinned in package.json ----
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.5.0
WORKDIR /app

# ---- deps: full dependencies (needed by build and migrator) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

# ---- builder: next build ----
FROM deps AS builder
# Commit SHA (build-arg from CI): .git is excluded from the context, without this the version label
# in the app would show only the semver.
ARG GIT_COMMIT_SHA=""
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# FAKE values for the build only: some modules read env at import time (DB/Redis client, Resend,
# better-auth) and next build imports them. They do not reach the final image: the runner stage starts from scratch
# and the real env arrives at runtime (validated in instrumentation.ts).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?sslmode=disable \
    REDIS_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-0000000000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_build_placeholder
RUN pnpm build

# ---- migrator: runs the Drizzle migrations (PreSync Job in k8s) ----
FROM deps AS migrator
COPY tsconfig.json drizzle.config.ts ./
COPY lib ./lib
COPY scripts ./scripts
USER node
CMD ["pnpm", "db:migrate"]

# ---- csv-worker: separate process for AI analysis and sandbox ----
FROM deps AS csv-worker
COPY tsconfig.json ./
COPY lib ./lib
COPY scripts ./scripts
ENV NODE_ENV=production
USER node
CMD ["pnpm", "worker:csv"]

# ---- runner: app image ----
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
