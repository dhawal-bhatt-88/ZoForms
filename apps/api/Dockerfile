# syntax=docker/dockerfile:1
# ---- NestJS + Prisma API image (pnpm monorepo aware) ----
# Build context is the repo ROOT: docker build -f apps/api/Dockerfile .

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
# openssl is required by Prisma's query engine at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

# ---- deps: install once, cached on the manifests ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/form-schema/package.json ./packages/form-schema/package.json
# --ignore-scripts: the api postinstall (prisma generate) needs the schema,
# which isn't copied yet — we run generate explicitly in the build stage.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build: compile the shared package, generate Prisma, build the API ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/form-schema ./packages/form-schema
COPY apps/api ./apps/api
RUN pnpm --filter @formbuilder/form-schema build \
  && pnpm --filter api exec prisma generate \
  && pnpm --filter api build

ENV NODE_ENV=production
EXPOSE 4000
# Default command runs the compiled server. docker-compose overrides this to
# run `prisma migrate deploy` first (see deploy/docker-compose.prod.yml).
CMD ["node", "apps/api/dist/main.js"]
