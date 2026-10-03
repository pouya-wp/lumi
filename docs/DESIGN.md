# Lumi Design Language — «Playful Pro»

> محصول تیم **Beyondex** · الهام اصلی: dastyar.io + حس Dribbble (bento، استیکر، 3D، میکروانیمیشن)
> این سند منبع حقیقت توکن‌های دیزاین برای وب (Tailwind) و موبایل (Flutter ThemeExtension) است.

## ۱. روح دیزاین
- **صمیمی ولی حرفه‌ای:** سفید و تمیز مثل دستیار، اما با جسارت Dribbble — کارت‌های bento، استیکرهای کج، ایموجی سه‌بعدی، سایه‌های رنگی نرم.
- **«ابزار ساده نیست، دستیار است»:** هر صفحه یک «صحنه» دارد: هدر با سلام شخصی + آب‌وهوا/ساعت، ویجت‌ها، و یک لحظه شادی (confetti، شخصیت).
- **فارسی-اول:** RTL، اعداد فارسی، تقویم شمسی، تایپوگرافی درشت و گرد.

## ۲. رنگ

### Brand
| توکن | Light | Dark | کاربرد |
|---|---|---|---|
| `primary` | `#3D5AFE` | `#6C83FF` | دکمه اصلی، لینک، فوکوس (آبی رویال دستیار) |
| `primary-soft` | `#EEF1FF` | `#1C2250` | پس‌زمینه انتخاب |
| `ink` | `#0E1330` | `#F2F4FF` | متن اصلی |
| `ink-muted` | `#6B7194` | `#9AA0C3` | متن ثانویه |
| `surface` | `#FFFFFF` | `#0B0E22` | پس‌زمینه |
| `surface-raised` | `#F7F8FC` | `#141838` | کارت‌ها |
| `night` | `#0A0F3C → #1B1F6B` | — | باند CTA ستاره‌ای / Focus mode |

### Pastel Bento (هر ماژول یک رنگ)
| ماژول | bg | accent |
|---|---|---|
| Tasks / تودولیست | `#EEF0FF` lavender | `#5B5BF0` |
| Calendar / تقویم | `#FFEFF1` blush | `#F2557A` |
| Notes & Docs | `#FFF8DB` butter | `#E8A300` |
| Daily / روزانه | `#E6F8FB` sky | `#14A8C8` |
| Goals / OKR | `#E9F9EF` mint | `#1DB46A` |
| Time / Pomodoro | `#FFF0E6` peach | `#FF7A2F` |

### Priority
Urgent `#FF4D4F` · High `#FF8A00` · Medium `#3D5AFE` · Low `#9AA0C3`

## ۳. تایپوگرافی
- فونت: **Peyda** (نمایشی، تیترها) + **Vazirmatn** (بدنه، رایگان/OFL) ؛ لاتین: **Inter / Plus Jakarta Sans**
- مقیاس: Display 48/56 ExtraBlack · H1 32/40 Black · H2 24/32 Bold · H3 18/26 Bold · Body 15/24 · Caption 12/18
- اعداد: `font-feature-settings: "ss01"` و تبدیل به ارقام فارسی در UI

## ۴. شکل و عمق
- Radius: `sm 10` · `md 16` · `lg 24` · `xl 32` (کارت bento) · `full`
- سایه رنگی (Dribbble): `0 12px 32px -12px rgb(61 90 254 / .35)` برای دکمه اصلی؛ کارت‌ها `0 1px 0 rgb(14 19 48/.04), 0 8px 24px -16px rgb(14 19 48/.15)`
- Glass: `backdrop-blur(20px)` + `bg-white/70` روی هدرها و شیت‌های موبایل
- Border: `1px` با `ink/6%`

## ۵. امضاهای بصری (Signature elements)
1. **Sticker chips:** برچسب‌های کج (`rotate(-6deg)`) با سایه، رنگ پاستلی تند — برای «جدید»، «AI»، «فوری».
2. **3D emoji icons:** ایموجی‌های Fluent 3D (MIT) کنار تیترها و در empty state‌ها.
3. **Scene header:** داشبورد بالای صفحه با پس‌زمینه گرادیانی متغیر با ساعت روز (صبح آسمانی، عصر نارنجی، شب ستاره‌ای) + سلام شخصی و آب‌وهوا.
4. **Bento dashboard:** ویجت‌های با اندازه‌های متفاوت (1×1, 2×1, 2×2) قابل جابه‌جایی.
5. **Starry night band:** Focus mode و CTA ها روی سرمه‌ای با ستاره‌های چشمک‌زن.
6. **Mascot «لومی»:** یک شخصیت نورانی کوچک (ستاره/کرم شب‌تاب) برای empty state، onboarding و جشن‌ها.

## ۶. حرکت
- Spring: `stiffness 380, damping 30`؛ مدت‌ها 120/200/320ms
- Check-off تسک: خط‌خوردگی انیمیشنی + ذرات کوچک؛ تکمیل اسپرینت/هدف: confetti
- Hover کارت: `translateY(-2px)` + سایه عمیق‌تر؛ Drag: tilt `2deg` + scale `1.02`
- همیشه `prefers-reduced-motion` رعایت شود.

## ۷. کامپوننت‌های کلیدی
Button (primary/soft/ghost/danger) · Sticker · Avatar stack · Priority pill · Status dot · Task card · Bento widget · Command palette · Sheet (موبایل) · Toast · Empty state با mascot · Jalali date picker · Progress ring

## ۸. مرجع‌ها
- dastyar.io (اسکرین‌شات ارسالی کاربر): آبی رویال، کارت‌های پاستلی، استیکر کج، ویجت روی صحنه طبیعت، باند ستاره‌ای، فوتر تیره گرد
- مرجع‌های Dribbble / Pinterest: کاربر اسکرین‌شات می‌فرستد و این بخش به‌روز می‌شود.
