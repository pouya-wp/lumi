# ✦ Lumi — by Beyondex

سیستم مدیریت کار، برنامه‌ریزی و همکاری تیمی — وب، اندروید و iOS.

| سند | محتوا |
|---|---|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | لیست کامل فیچرها، user storyها و معیار پذیرش |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری، مدل داده، تصمیم‌های کلیدی |
| [docs/DESIGN.md](docs/DESIGN.md) | زبان طراحی «Playful Pro» و توکن‌ها |
| [docs/ROADMAP.md](docs/ROADMAP.md) | فازبندی پیاده‌سازی |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | **انتشار روی سرور، ساخت حساب‌های تیم، اپ موبایل، بکاپ** |
| [docs/PUBLIC_API.md](docs/PUBLIC_API.md) | API عمومی، وب‌هوک، گیت‌هاب، تلگرام، iCal، ورود CSV |
| [CHANGELOG.md](CHANGELOG.md) | تغییرات نسخه‌ها |

## در یک نگاه
- **کار و برنامه‌ریزی:** تسک با پیشنهاد/مذاکره‌ی ددلاین، بورد، لیست، جدول، تقویم شمسی، گانت، بار کاری، تایم‌شیت
- **روش‌ها:** اسپرینت، OKR، GTD، آیزنهاور، پومودورو، عادت‌ها، رودمپ
- **همکاری:** اسناد شبیه Notion با ویرایش هم‌زمان، چت تیمی، جلسه‌ها، استندآپ
- **هوش مصنوعی (OpenAI):** ساخت تسک از متن، شکستن تسک، خلاصه، دستیار، برنامه‌ی روز
- **تحلیل و انگیزه:** گزارش CFD و زمان چرخه، خروجی CSV، آرنا با XP و نشان
- **یکپارچه‌سازی:** API عمومی، وب‌هوک، گیت‌هاب، ربات تلگرام، iCal، ورود CSV
- **موبایل:** اندروید و iOS با حالت آفلاین، قفل بیومتریک و اعلان

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
pnpm dev   # api: http://localhost:4000 (Swagger: /api/docs) · web: http://localhost:3000
```
موبایل: [apps/mobile/README.md](apps/mobile/README.md)

## انتشار
حالت فعلی تیم (همه‌چیز روی VPS فعلی، یک پورت، بدون دامنه): [deploy/vps/README.md](deploy/vps/README.md)

سرور اختصاصی (همه‌چیز با Docker):
```bash
cd deploy && cp .env.example .env   # دامنه و رمزها
docker compose up -d
docker compose exec api node dist/scripts/seed-team.js
```
جزئیات در [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
