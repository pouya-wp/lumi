# راهنمای انتشار Lumi برای تیم بیاندکس

این راهنما Lumi را روی یک سرور لینوکسی با دامنه‌ی خودتان بالا می‌آورد. نتیجه این‌هاست:
- وب‌اپ روی `https://<دامنه>` با گواهی HTTPS خودکار؛
- API و سوکت‌های لحظه‌ای روی همان دامنه؛
- PostgreSQL با بکاپ روزانه؛
- اپ اندروید که به همین سرور وصل می‌شود.

> English summary at the end.

## ۱. پیش‌نیازها

| مورد | حداقل |
| --- | --- |
| سرور | Ubuntu 22.04+ با ۲ vCPU، ۲ گیگ رم، ۲۰ گیگ دیسک (برای تیم ۳ نفره کافی است) |
| نرم‌افزار | Docker Engine 24+ با Docker Compose v2 (`curl -fsSL https://get.docker.com \| sh`) |
| دامنه | یک رکورد `A` (و در صورت نیاز `AAAA`) که به IP سرور اشاره کند، مثلاً `lumi.beyondex.io` |
| پورت‌ها | 80 و 443 باز باشند (Caddy از Let's Encrypt گواهی می‌گیرد) |
| اختیاری | کلید OpenAI برای دستیار هوشمند، توکن ربات تلگرام |

> اگر سرور داخل ایران است، دسترسی به `ghcr.io` و Let's Encrypt ممکن است محدود باشد. در این حالت imageها را روی سرور build کنید (بخش ۳-ب) یا از سرور خارج از کشور استفاده کنید. سرور خارج برای ربات تلگرام و OpenAI هم لازم است.

## ۲. دریافت و تنظیم

```bash
git clone https://github.com/pouya-wp/lumi.git && cd lumi/deploy
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
nano .env   # LUMI_DOMAIN، TEAM_EMAILS و (اختیاری) OPENAI_API_KEY را تنظیم کنید
```

| متغیر | توضیح |
| --- | --- |
| `LUMI_DOMAIN` | دامنه بدون `https://` |
| `POSTGRES_PASSWORD`, `JWT_SECRET` | رمزهای تصادفی؛ بعد از راه‌اندازی عوضشان نکنید |
| `ALLOW_SIGNUP` | پیش‌فرض `false`: فقط کسانی که دعوت شده‌اند ثبت‌نام می‌کنند |
| `TEAM_EMAILS` | ایمیل پویا، امیرحسین و متین (به همین ترتیب) |
| `OPENAI_API_KEY` | خالی بماند تا قابلیت‌های AI خاموش باشند؛ بقیه‌ی اپ کامل کار می‌کند |

## ۳. راه‌اندازی

### الف) با imageهای آماده (پیشنهادی)
بعد از هر تگ نسخه (`v1.0.0`)، GitHub Actions imageها را روی `ghcr.io/pouya-wp/lumi-api` و `lumi-web` منتشر می‌کند. اگر مخزن خصوصی است، یک بار روی سرور لاگین کنید:
```bash
echo <GITHUB_TOKEN با دسترسی read:packages> | docker login ghcr.io -u <github-user> --password-stdin
docker compose pull && docker compose up -d
```

### ب) build روی خود سرور
```bash
echo "LUMI_API_IMAGE=lumi-api:local" >> .env && echo "LUMI_WEB_IMAGE=lumi-web:local" >> .env
docker compose build && docker compose up -d
```

API در اولین اجرا migrationها را خودش اعمال می‌کند. وضعیت را با `docker compose ps` و `docker compose logs -f api` ببینید.

## ۴. ساخت حساب‌های تیم

```bash
docker compose exec api node dist/scripts/seed-team.js
```
خروجی چیزی شبیه این است:
```
✅ Workspace «بیاندکس» (…) with 3 members.
  پویا صادق‌پور (Pouya Sadeghpour)      pouya@beyondex.io        sP8-…
  امیرحسین قطبی (Amirhossein Ghotbi)    amirhossein@beyondex.io  n_sc…
  متین ایزدی (Matin Izadi)              matin@beyondex.io        mg4S…
```
هر رمز را خصوصی به صاحبش بدهید. هر نفر بعد از ورود از **تنظیمات ← حساب من** رمزش را عوض کند (بقیه‌ی دستگاه‌ها خودکار خارج می‌شوند). پویا مالک فضای کاری است و امیرحسین و متین ادمین. اجرای دوباره‌ی اسکریپت امن است و چیزی را بازنویسی نمی‌کند.

برای اضافه کردن عضو جدید در آینده: **تیم ← دعوت** با ایمیل. چون ثبت‌نام فقط با دعوت باز است، همان ایمیل می‌تواند ثبت‌نام کند.

## ۵. اپ موبایل

### اندروید
۱. در GitHub: **Settings ← Secrets and variables ← Actions ← Variables** متغیر `LUMI_API_URL` را برابر `https://<دامنه>` بگذارید.
۲. (پیشنهادی) برای امضای ثابت APK یک keystore بسازید و در Secrets بگذارید. بدون آن، APK با کلید debug امضا می‌شود و آپدیت‌ها شاید نیاز به حذف و نصب دوباره داشته باشند.
   ```bash
   keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lumi
   base64 -w0 release.jks   # → ANDROID_KEYSTORE_BASE64
   ```
   Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (=`lumi`), `ANDROID_KEY_PASSWORD`.
۳. تگ بزنید: `git tag v1.0.0 && git push origin v1.0.0`. فایل `lumi-v1.0.0.apk` در صفحه‌ی Releases قرار می‌گیرد؛ همان را برای تیم بفرستید.

ساخت دستی: `cd apps/mobile && flutter build apk --release --dart-define=API_URL=https://<دامنه>`

### iOS
برای نصب روی آیفون، حساب Apple Developer (سالانه ۹۹ دلار) و یک Mac با Xcode لازم است:
```bash
cd apps/mobile && flutter build ipa --dart-define=API_URL=https://<دامنه>
```
خروجی را با Xcode یا Transporter به TestFlight بفرستید و اعضا را دعوت کنید. تا آن موقع اعضای iOS می‌توانند نسخه‌ی وب را از Safari با **Add to Home Screen** نصب کنند.

### اعلان‌ها و قفل
- اعلان سیستمی تا وقتی اپ در پس‌زمینه زنده است کار می‌کند. Push کامل وقتی اپ بسته است به Firebase (FCM) و APNs نیاز دارد که هنوز وصل نشده. پیشنهاد: ربات تلگرام را وصل کنید تا اعلان‌ها همیشه برسند.
- قفل اثر انگشت / Face ID از تنظیمات اپ فعال می‌شود.

## ۶. یکپارچه‌سازی‌ها
همه از **تنظیمات** وب‌اپ (`/fa/app/settings`) فعال می‌شوند. جزئیات کامل در [PUBLIC_API.md](PUBLIC_API.md) است.
- **تلگرام**: ربات را با @BotFather بسازید و توکن را وارد کنید. هر عضو «وصل کردن تلگرام من» را بزند.
- **گیت‌هاب**: آدرس و Secret را در Webhooks مخزن بگذارید. «fixes APP-12» تسک را می‌بندد.
- **تقویم**: لینک iCal را در Google Calendar اضافه کنید.
- **CSV**: برای انتقال کارها از Trello، Jira یا اکسل.

## ۷. نگهداری

| کار | دستور |
| --- | --- |
| به‌روزرسانی | `git pull && docker compose pull && docker compose up -d` (migrationها خودکارند) |
| لاگ‌ها | `docker compose logs -f api web` |
| بکاپ دستی | `docker compose exec postgres pg_dump -U lumi lumi \| gzip > lumi-$(date +%F).sql.gz` |
| بکاپ خودکار | سرویس `backup` هر ۲۴ ساعت در `deploy/backups/` ذخیره می‌کند و فایل‌های قدیمی‌تر از `BACKUP_KEEP_DAYS` را پاک می‌کند. این پوشه را به جای دیگری هم sync کنید. |
| بازگردانی | `gunzip -c backups/<file>.sql.gz \| docker compose exec -T postgres psql -U lumi lumi` (روی دیتابیس خالی) |
| مستندات API | `https://<دامنه>/api/docs` |

## ۸. چک‌لیست بعد از انتشار
- [ ] `https://<دامنه>` باز می‌شود، قفل HTTPS سبز است.
- [ ] هر سه نفر وارد شدند و رمزشان را عوض کردند.
- [ ] یک تسک برای هم‌تیمی ساخته شد و اعلان لحظه‌ای رسید.
- [ ] APK روی اندرویدها نصب شد و به سرور وصل است.
- [ ] (اختیاری) تلگرام، گیت‌هاب و کلید OpenAI تنظیم شدند.
- [ ] اولین فایل بکاپ در `deploy/backups/` ساخته شد.

---

### English summary
1. Point a domain at a Docker host, `cd deploy && cp .env.example .env`, then fill in `LUMI_DOMAIN`, random `POSTGRES_PASSWORD` and `JWT_SECRET`, and `TEAM_EMAILS`.
2. `docker compose pull && docker compose up -d` (or `build` with `LUMI_*_IMAGE=…:local`). Caddy issues HTTPS and migrations run on API start.
3. `docker compose exec api node dist/scripts/seed-team.js` creates the Beyondex workspace (Pouya: owner; Amirhossein, Matin: admins) and prints one-time passwords.
4. Set the `LUMI_API_URL` repository variable (plus optional Android keystore secrets), then push a `v*` tag. CI publishes `ghcr.io/<owner>/lumi-{api,web}` and attaches the APK to the release.
5. Backups land in `deploy/backups/` daily. Update with `git pull && docker compose pull && docker compose up -d`.
