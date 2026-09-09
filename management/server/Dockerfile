# =============================================================================
# Management Server — Multi-stage Dockerfile
#
# Build context: management/ (docker-compose sets context: .)
# Stage 1: Build frontend (Vite + React)
# Stage 2: Build server (TypeScript → Node.js)
# Stage 3: Production image (serves API + static frontend)
# =============================================================================

# ── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./

RUN npm ci --ignore-scripts 2>/dev/null || npm install

COPY frontend/ .

RUN npm run build

# ── Stage 2: Build server ───────────────────────────────────────────────────
FROM node:20-alpine AS server-build

WORKDIR /app

# Dependencias del sistema para Prisma
RUN apk add --no-cache openssl

COPY server/package.json server/package-lock.json* ./

RUN npm ci --ignore-scripts 2>/dev/null || npm install

COPY server/ .

# Generar cliente Prisma
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

# ── Stage 3: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Dependencias del sistema
RUN apk add --no-cache openssl

# Copiar dependencias de producción del server
COPY server/package.json server/package-lock.json* ./

RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev

# Copiar cliente Prisma generado
COPY --from=server-build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-build /app/node_modules/@prisma ./node_modules/@prisma

# Copiar server compilado
COPY --from=server-build /app/dist ./dist

# Copiar schema de Prisma (necesario para migraciones)
COPY --from=server-build /app/prisma ./prisma

# Copiar frontend compilado
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 3001

CMD ["node", "dist/app.js"]
