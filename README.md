# HomeHub - Centro de Gestión Familiar

Plataforma completa para la gestión de una casa familiar: gastos, facturas, tareas, lista de supermercado, calendario compartido y gestión de usuarios.

## 🏗️ Arquitectura

```
homehub/
├── apps/
│   ├── api/          # Fastify + TypeScript + Prisma + Socket.io
│   └── web/          # Next.js 15 + React 18 + TypeScript + Tailwind
├── packages/
│   ├── shared/       # Tipos TypeScript, esquemas Zod, utilidades
│   ├── ui/           # Componentes UI compartidos (shadcn/ui style)
│   └── config/       # Configuraciones ESLint, TypeScript, Prettier
├── docker-compose.yml
├── turbo.json
└── package.json
```

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 20+
- Docker & Docker Compose
- pnpm 9+

### Instalación

```bash
# Clonar e instalar dependencias
git clone <repo>
cd homehub
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Levantar base de datos y Redis
docker compose up -d

# Generar cliente Prisma
pnpm run db:generate

# Ejecutar migraciones y seed
pnpm run db:push
pnpm run db:seed

# Desarrollo (terminales separadas)
pnpm run dev          # API en :3001 + Web en :3000
```

### URLs de Desarrollo
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/docs
- **Adminer (DB)**: http://localhost:8080 (profile: tools)
- **Prisma Studio**: `pnpm run db:studio`

## 🧰 Stack Tecnológico

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify 4
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache/Realtime**: Redis 7 + Socket.io
- **Auth**: JWT (access 15min + refresh 7d) + bcrypt
- **Validation**: Zod + fastify-type-provider-zod
- **Docs**: Swagger/OpenAPI
- **Testing**: Vitest

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript + React 18
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: Zustand + TanStack Query
- **Real-time**: Socket.io Client
- **Forms**: React Hook Form + Zod
- **i18n**: next-intl (es/en)
- **Charts**: Recharts
- **Calendar**: FullCalendar

### DevOps
- **Monorepo**: Turborepo
- **Container**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Deploy**: Vercel (Web) + Render (API) + Redis Cloud

## 📦 Módulos Principales

| Módulo | Descripción | Tiempo Real |
|--------|-------------|-------------|
| **Gastos** | Categorización, presupuestos, gráficos, exportación | ❌ |
| **Facturas** | Servicios, impuestos, deudas, recordatorios, OCR (v2) | ❌ |
| **Tareas** | Kanban, asignación, prioridades, fechas límite | ✅ |
| **Supermercado** | Lista colaborativa, categorías, modo compras | ✅ |
| **Calendario** | Mes/Semana/Día, recurrencia, recordatorios | ❌ |
| **Usuarios** | Roles (Admin/Miembro), invitaciones, perfil | ❌ |

## 🔐 Seguridad

- Row Level Security (RLS) en PostgreSQL por `family_id`
- JWT con access token corto (15min) + refresh token rotativo (7d)
- Rate limiting por IP y usuario
- Validación Zod en frontend y backend
- Headers de seguridad (Helmet, CSP, HSTS)
- Sanitización de uploads
- Auditoría de acciones sensibles

## 🧪 Testing

```bash
# Tests unitarios + integración
pnpm run test

# Solo API
cd apps/api && pnpm run test

# Solo Web
cd apps/web && pnpm run test
```

## 📝 Scripts Disponibles

```bash
# Raíz
pnpm run dev          # Dev API + Web
pnpm run build        # Build all
pnpm run lint         # Lint all
pnpm run typecheck    # TypeScript check all
pnpm run format       # Prettier all

# Base de datos
pnpm run db:generate  # Prisma generate
pnpm run db:push      # Prisma db push
pnpm run db:migrate   # Prisma migrate dev
pnpm run db:studio    # Prisma Studio
pnpm run db:seed      # Seed data

# Docker
docker compose up -d           # Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Production
docker compose logs -f api     # Logs API
docker compose exec postgres psql -U homehub -d homehub  # PSQL
```

## 🌍 Internacionalización

- Español (por defecto)
- Inglés
- Fácil agregar más idiomas en `apps/web/messages/`

## 🎨 Design System

Generado con `ui-ux-pro-max` skill:
- Paleta de colores familiar/financiera
- Tipografía legible y accesible
- Componentes base consistentes
- Modo claro/oscuro
- Responsive mobile-first

## 📄 Licencia

MIT - Ver [LICENSE](LICENSE) para detalles.

## 🛠️ Cómo se desarrolla

El proyecto no está abierto a contribuciones por ahora. Las reglas de ramas, commits, pull
requests y CI están en [CODE_GUIDE.md](CODE_GUIDE.md). En resumen: ramas cortas desde
`stg`, commits en inglés con formato `type(scope): subject`, pull request contra `stg` con
el CI en verde, merge con rebase. `main` solo recibe releases desde `stg`.

---

**Desarrollado con ❤️ usando opencode skills**