# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/app/package.json ./packages/app/package.json

RUN pnpm install --frozen-lockfile --filter @bluecollar/app

# ── builder ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN npm install -g pnpm

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/app/node_modules ./packages/app/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/app ./packages/app

# Build-time public env vars (injected at image build, not runtime)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
ARG NEXT_PUBLIC_MARKET_CONTRACT_ID
ARG NEXT_PUBLIC_REGISTRY_CONTRACT_ID
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK \
    NEXT_PUBLIC_MARKET_CONTRACT_ID=$NEXT_PUBLIC_MARKET_CONTRACT_ID \
    NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$NEXT_PUBLIC_REGISTRY_CONTRACT_ID \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN pnpm --filter @bluecollar/app build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone bundle produced by next build with output: 'standalone'
COPY --from=builder --chown=nextjs:nodejs /app/packages/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/app/.next/static ./packages/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/app/public ./packages/app/public

USER nextjs
EXPOSE 3001

CMD ["node", "packages/app/server.js"]
