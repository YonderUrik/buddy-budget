# syntax=docker/dockerfile:1
# Landing statica di buddybudget.io: build Next (export in out/) servita da nginx non-root sulla porta 3000.

# ---- build: next build con export statico ----
FROM node:24-alpine AS build
RUN npm install -g pnpm@11.5.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_* sono pubbliche e vengono incollate nel bundle a build time: vanno passate qui, non a runtime.
ARG NEXT_PUBLIC_SITE_URL=https://buddybudget.io
ARG NEXT_PUBLIC_APP_URL=https://app.buddybudget.io
ARG NEXT_PUBLIC_UMAMI_SRC=https://app.buddybudget.io/stats/script.js
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=409671c6-76bb-464b-88a0-314a6c592efe
# Repo del codice: se vuoto la landing non mostra il link «Vedi il codice».
ARG NEXT_PUBLIC_SOURCE_URL=https://github.com/YonderUrik/buddy-budget
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_SOURCE_URL=${NEXT_PUBLIC_SOURCE_URL} \
    NEXT_PUBLIC_UMAMI_SRC=${NEXT_PUBLIC_UMAMI_SRC} \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=${NEXT_PUBLIC_UMAMI_WEBSITE_ID}
RUN pnpm build

# ---- runner: solo i file statici ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
