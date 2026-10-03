# ✦ Lumi — by Beyondex

سیستم مدیریت کار، برنامه‌ریزی و همکاری تیمی — وب، اندروید و iOS.

| سند | محتوا |
|---|---|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | لیست کامل فیچرها، user storyها و معیار پذیرش |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری، مدل داده، تصمیم‌های کلیدی |
| [docs/DESIGN.md](docs/DESIGN.md) | زبان طراحی «Playful Pro» و توکن‌ها |
| [docs/ROADMAP.md](docs/ROADMAP.md) | فازبندی پیاده‌سازی |

## ساختار
```
apps/api         NestJS + Prisma + PostgreSQL
apps/web         Next.js + Tailwind (fa/en, RTL)
apps/mobile      Flutter (Android & iOS)
packages/shared  enumها، توکن‌های دیزاین، ابزارها
infra            docker-compose (Postgres+pgvector, Redis, MinIO, Mailpit)
```

## شروع
```bash
pnpm install
pnpm infra:up
cp apps/api/.env.example apps/api/.env
pnpm --filter @lumi/api prisma:migrate
pnpm dev   # api: http://localhost:4000 (Swagger: /docs) · web: http://localhost:3000
```
موبایل: [apps/mobile/README.md](apps/mobile/README.md)
