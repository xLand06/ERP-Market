FROM node:20-alpine

WORKDIR /app

# Instalar dependencias de sistema para Prisma
RUN apk add --no-cache openssl

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar pnpm y dependencias
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copiar código fuente
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/app.js"]
