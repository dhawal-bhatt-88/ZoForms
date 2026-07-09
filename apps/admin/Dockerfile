# syntax=docker/dockerfile:1
# ---- Admin console (Next.js standalone, pnpm monorepo aware) ----
# Build context is the repo ROOT: docker build -f apps/admin/Dockerfile .

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
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build ----
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_TENANT_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TENANT_URL=$NEXT_PUBLIC_TENANT_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY apps/admin ./apps/admin
RUN pnpm --filter admin build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3002 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public
EXPOSE 3002
CMD ["node", "apps/admin/server.js"]
