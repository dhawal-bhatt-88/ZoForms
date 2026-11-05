# syntax=docker/dockerfile:1
# ---- Tenant app (Next.js standalone, pnpm monorepo aware) ----
# Build context is the repo ROOT: docker build -f apps/web/Dockerfile .

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/form-schema/package.json ./packages/form-schema/package.json
COPY packages/ui/package.json ./packages/ui/package.json
# @zoworkhq/zoforms isn't on a registry: the web app installs this committed tarball.
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build ----
FROM deps AS build
# NEXT_PUBLIC_* are inlined at build time, so they must be known here.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
# The web app's own public address, for Open Graph and canonical URLs.
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/form-schema ./packages/form-schema
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
RUN pnpm --filter @formbuilder/form-schema build \
  && pnpm --filter web build

# ---- runtime: only the standalone server + static assets ----
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
