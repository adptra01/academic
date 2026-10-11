# Frontend produksi — multi-stage.
#
# Sebelumnya berkas ini memakai `npm run dev` di container. Dev server TIDAK
# boleh dipakai di produksi: tanpa optimasi build, tanpa cache, dan langsing
# memori karena hot-reload watcher. Yang benar: build sekali, lalu `next start`.
#
# CATATAN PENTING: `NEXT_PUBLIC_*` di-inline oleh Next.js SAAT BUILD. Mengubah
# nilainya nanti WAJIB rebuild image — men-set env saat runtime tidak berpengaruh.

# ---------- stage 1: builder ----------
FROM node:24-alpine AS builder
WORKDIR /app

# Lockfile disalin lebih dulu supaya `npm ci` bisa pakai cache layer Docker
# selama requirements belum berubah.
COPY package.json package-lock.json ./
RUN npm ci

# Nilai default hanya untuk build lokal; compose mengirim lewat build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN npm run build

# ---------- stage 2: runner ----------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Jalan sebagai user non-root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

USER nextjs
EXPOSE 3000

CMD ["npm", "start"]
