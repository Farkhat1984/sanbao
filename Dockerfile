FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3004

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/@napi-rs ./node_modules/@napi-rs
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
COPY prisma ./prisma/

USER nextjs
EXPOSE 3004

CMD ["node", "server.js"]
