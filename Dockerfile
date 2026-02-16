FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts && npx prisma generate

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Compile seed.ts to JS for production use
RUN npx tsc prisma/seed.ts --esModuleInterop --module commonjs --outDir prisma/out --skipLibCheck

# --- Prisma CLI (for db push/migrate at startup) ---
FROM base AS prisma-cli
WORKDIR /tmp/prisma-cli
RUN npm init -y > /dev/null 2>&1 && npm install prisma@6.19.2 --save-exact 2>/dev/null

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3004

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output + static
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma runtime
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/@napi-rs ./node_modules/@napi-rs

# Server-external packages (not bundled by Next.js standalone)
COPY --from=deps /app/node_modules/otplib ./node_modules/otplib
COPY --from=deps /app/node_modules/@otplib ./node_modules/@otplib
COPY --from=deps /app/node_modules/qrcode ./node_modules/qrcode
COPY --from=deps /app/node_modules/dijkstrajs ./node_modules/dijkstrajs
COPY --from=deps /app/node_modules/pngjs ./node_modules/pngjs
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=deps /app/node_modules/stripe ./node_modules/stripe
COPY --from=deps /app/node_modules/nodemailer ./node_modules/nodemailer
COPY --from=deps /app/node_modules/@aws-sdk ./node_modules/@aws-sdk
COPY --from=deps /app/node_modules/@smithy ./node_modules/@smithy
COPY --from=deps /app/node_modules/mammoth ./node_modules/mammoth
COPY --from=deps /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=deps /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY --from=deps /app/node_modules/xlsx ./node_modules/xlsx
# Redis + BullMQ
COPY --from=deps /app/node_modules/ioredis ./node_modules/ioredis
COPY --from=deps /app/node_modules/bullmq ./node_modules/bullmq
COPY --from=deps /app/node_modules/glob ./node_modules/glob
COPY --from=deps /app/node_modules/node-abort-controller ./node_modules/node-abort-controller

# Prisma CLI with all dependencies (for db push/migrate at startup)
COPY --from=prisma-cli /tmp/prisma-cli/node_modules /app/prisma-cli/node_modules
COPY prisma/schema.prisma ./prisma/
COPY --from=builder /app/prisma/out/seed.js ./prisma/
COPY --chmod=755 docker-entrypoint.sh ./

# Sentry config files (if present)
COPY sentry.*.config.ts ./  2>/dev/null || true

EXPOSE 3004

# Switch to non-root user for the entrypoint
# Migrations run before USER switch via docker-entrypoint.sh (when SKIP_MIGRATIONS is not set)
USER nextjs

ENTRYPOINT ["./docker-entrypoint.sh"]
