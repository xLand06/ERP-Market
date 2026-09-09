# Management Server — ERP Market

Panel de gestión centralizado para administrar tenants, pagos y salud de la plataforma ERP Market.

## Requisitos

- Node.js 20+
- PostgreSQL 16 (o Docker)
- Docker (para métricas de contenedores)

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del server API | `3001` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | `dev-secret-change-in-production` |
| `DATABASE_URL` | URL de conexión a PostgreSQL | — (requerida) |
| `DOCKER_SOCKET` | Ruta al socket de Docker | `/var/run/docker.sock` |
| `NODE_ENV` | Entorno de ejecución | `development` |

## Desarrollo Local

```bash
# Instalar dependencias
cd management/server && pnpm install

# Configurar entorno
cp .env.example .env
# Editar .env con tus valores

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma db push

# Iniciar en desarrollo
pnpm dev
```

El server arranca en `http://localhost:3001`.

### Frontend

```bash
cd management/frontend && pnpm install
pnpm dev
```

El frontend arranca en `http://localhost:5174` con proxy al API.

## Endpoints

### Health Check
- `GET /api/health` — Estado del sistema (público)

### Auth
- `POST /api/auth/login` — Login con username/password → JWT

### Tenants
- `GET /api/tenants` — Listar todos los tenants
- `POST /api/tenants` — Crear tenant
- `GET /api/tenants/:slug` — Detalle de tenant
- `PATCH /api/tenants/:slug` — Actualizar tenant
- `DELETE /api/tenants/:slug` — Eliminar tenant (soft delete)
- `POST /api/tenants/:slug/suspend` — Suspender tenant
- `POST /api/tenants/:slug/resume` — Reactivar tenant

## Despliegue (Docker)

```bash
# Variables requeridas en .env
export MGMT_DB_PASSWORD=tu-password-seguro
export JWT_SECRET=tu-jwt-secret-seguro

# Levantar stack
docker compose up -d

# Verificar
docker compose ps
docker compose logs mgmt-api
```

### VPS (Hetzner CX23)

El stack está diseñado para correr en el VPS junto con los tenants ERP:
- `mgmt-api` se expone en el puerto `3001`
- `mgmt-db` usa 32MB shared_buffers (apropiado para 4GB RAM)
- Se conecta a la red `erp_proxy` existente para acceder a los contenedores de tenants

## Estructura del Proyecto

```
management/
├── server/
│   ├── src/
│   │   ├── app.ts              # Entry point de Express
│   │   ├── config/
│   │   │   ├── env.ts          # Variables de entorno
│   │   │   └── prisma.ts       # Cliente Prisma
│   │   ├── modules/
│   │   │   ├── auth/           # Autenticación JWT
│   │   │   └── tenants/        # CRUD de tenants
│   │   ├── services/
│   │   │   └── docker.ts       # Cliente Docker
│   │   └── middlewares/
│   │       ├── auth.ts         # Middleware JWT
│   │       └── validate.ts     # Validación Zod
│   ├── prisma/
│   │   └── schema.prisma       # Schema de base de datos
│   └── Dockerfile
├── frontend/
│   └── src/                    # Dashboard React
├── docker-compose.yml          # Stack de gestión
└── README.md
```
