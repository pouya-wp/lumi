# راه‌اندازی Lumi روی VPS فعلی + Vercel

**چیدمان:**
- **وب‌اپ** روی Vercel: `lumi.beyondex.one`
- **API و دیتابیس** روی VPS فعلی: `lumi-api.beyondex.one`، از طریق Cloudflare Tunnel
- **اندروید** با APK از صفحه‌ی Releases گیت‌هاب
- **آیفون** به‌صورت PWA (Add to Home Screen)

**چرا با سیستم اصلی سرور تداخل ندارد:**
- Lumi هیچ پورتی روی سرور باز نمی‌کند. nginx، 80/443، فایروال و Frappe دست‌نخورده می‌مانند.
- ارتباط فقط از طریق یک تونل خروجی به Cloudflare است.
- همه‌چیز در `/opt/lumi` و کانتینرهای `lumi-vps-*` با شبکه و volume جدا قرار دارد.
- سقف حافظه حدود ۷۰۰ مگابایت است: Postgres ۲۵۶، API ۳۸۴، تونل ۶۴.

---

## ۱. ساخت تونل در Cloudflare (۳ دقیقه)
1. وارد <https://one.dash.cloudflare.com> شوید. اگر بار اول است، پلن رایگان Zero Trust را انتخاب کنید.
2. **Networks → Tunnels → Create a tunnel → Cloudflared**. یک اسم بدهید، مثلاً `lumi`.
3. در صفحه‌ی نصب، توکن طولانی بعد از `--token` را کپی کنید. **دستور نصب آن صفحه را اجرا نکنید**؛ اسکریپت ما خودش تونل را داخل Docker بالا می‌آورد.
4. در تب **Public Hostname**، یک hostname اضافه کنید:
   - Subdomain: `lumi-api`، Domain: `beyondex.one`
   - Service: `HTTP` و `api:4000`

   رکورد DNS خودکار ساخته می‌شود. رکورد `onecafe` و تنظیمات SSL دامنه تغییری نمی‌کنند.

## ۲. نصب روی VPS (۵ دقیقه)
از کامپیوتر خودتان (که کلید SSH رویش است):
```bash
ssh root@95.38.191.245
git clone https://github.com/pouya-wp/lumi.git /opt/lumi-src
bash /opt/lumi-src/deploy/vps/install.sh
```
اسکریپت مرحله‌به‌مرحله می‌پرسد:
- **کانتینرهای hermes / opencode / warp:** فهرست دقیقشان را نشان می‌دهد و فقط با `y` حذفشان می‌کند. غیر از این‌ها به هیچ کانتینری دست نمی‌زند.
- **توکن تونل:** همان توکن مرحله‌ی ۱.
- **ایمیل‌های تیم:** پیش‌فرض `pouya@`، `amirhossein@` و `matin@beyondex.io`.

در آخر سه رمز اولیه را چاپ می‌کند. یک نسخه هم در `/opt/lumi/team-passwords.txt` می‌ماند؛ بعد از تحویل رمزها پاکش کنید.

**نکات:**
- اگر مخزن گیت‌هاب private است، `git clone` نام کاربری و یک توکن گیت‌هاب می‌خواهد. همین توکن (با دسترسی `read:packages`) را وقتی اسکریپت برای دریافت imageها پرسید هم وارد کنید. راه دیگر: در گیت‌هاب در **Packages**، سه پکیج `lumi-api`، `lumi-postgres` و `lumi-cloudflared` را Public کنید.
- اسکریپت قبل از شروع حافظه‌ی آزاد را چک می‌کند. اگر کمتر از ۷۰۰ مگابایت باشد، بدون تأیید شما جلو نمی‌رود.

بررسی: در مرورگر `https://lumi-api.beyondex.one/api/docs` باید صفحه‌ی Swagger را نشان بدهد.

## ۳. وب روی Vercel (۳ دقیقه)
1. در <https://vercel.com/new>، مخزن `pouya-wp/lumi` را Import کنید.
2. **Root Directory** را `apps/web` بگذارید. Framework خودش Next.js تشخیص داده می‌شود و تنظیمات build از `apps/web/vercel.json` خوانده می‌شود.
3. در **Environment Variables** این متغیر را اضافه کنید:
   `NEXT_PUBLIC_API_URL` = `https://lumi-api.beyondex.one`
4. Deploy را بزنید. بعد در **Settings → Domains** دامنه‌ی `lumi.beyondex.one` را اضافه کنید.
5. در Cloudflare یک رکورد `CNAME` بسازید: نام `lumi`، مقدار `cname.vercel-dns.com`، و حتماً **DNS only (ابر خاکستری)**.

اگر از آدرس `*.vercel.app` هم استفاده می‌کنید، آن را در `EXTRA_CORS_ORIGINS` داخل `/opt/lumi/.env` بگذارید و `install.sh` را دوباره اجرا کنید.

## ۴. اپ‌ها
- **اندروید:** از صفحه‌ی **Releases** گیت‌هاب فایل `lumi-v….apk` را دانلود و نصب کنید. به `https://lumi-api.beyondex.one` وصل است.
- **آیفون:** `https://lumi.beyondex.one` را در Safari باز کنید، دکمه‌ی Share و بعد **Add to Home Screen**. لومی تمام‌صفحه و با آیکون خودش باز می‌شود.

## نگهداری
| کار | دستور (روی VPS) |
| --- | --- |
| آپدیت | `cd /opt/lumi-src && git pull && bash deploy/vps/install.sh` |
| لاگ | `docker compose -p lumi-vps logs -f api` |
| وضعیت و مصرف رم | `docker stats --no-stream $(docker ps -q --filter name=lumi-vps)` |
| بکاپ‌ها | `/opt/lumi/backups` (روزانه، ۱۴ روز نگه داشته می‌شود) |
| توقف | `bash /opt/lumi-src/deploy/vps/uninstall.sh` (داده‌ها حفظ می‌شوند) |

## محدودیت‌های سرور داخل ایران
- OpenAI و تلگرام از ایران مسدودند. بخش AI خاموش می‌ماند، مگر `OPENAI_BASE_URL` را به یک پروکسی در دسترس بدهید. ربات تلگرام هم از این سرور کار نمی‌کند.
- Cloudflare Zero Trust ممکن است حتی برای پلن رایگان کارت بانکی بخواهد. اگر این مانع شد، خبر بدهید تا راه جایگزین را آماده کنم.
