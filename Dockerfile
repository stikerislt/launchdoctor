# Launch Doctor — production image (web + audit worker with Playwright)
FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ENV NODE_ENV=development
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

# Chromium for server-side mobile audits (bundled under node_modules for the worker)
ENV PLAYWRIGHT_BROWSERS_PATH=0
RUN pnpm exec playwright install-deps chromium \
  && pnpm exec playwright install chromium

FROM base AS runner
ENV PLAYWRIGHT_BROWSERS_PATH=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY --from=build /app/worker ./worker
COPY --from=build /app/collector ./collector
COPY --from=build /app/audit-engine ./audit-engine
COPY --from=build /app/app ./app
COPY --from=build /app/scripts ./scripts

EXPOSE 3000
CMD ["pnpm", "run", "docker-start"]
