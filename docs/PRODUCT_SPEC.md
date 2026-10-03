# Lumi — Product Spec

> محصول تیم **Beyondex** · سیستم مدیریت کار، برنامه‌ریزی و همکاری تیمی
> پلتفرم‌ها: Web (Next.js) · Android & iOS (Flutter) · API عمومی
> زبان: فارسی/انگلیسی · تقویم: شمسی/میلادی · AI: OpenAI

## چشم‌انداز
یک «دستیار تیمی» که همه چیز یک تیم کوچک (۳ نفر و رشدپذیر) را یک‌جا نگه می‌دارد: تسک‌ها، برنامه‌ریزی، تقویم، اهداف، اسناد، گفتگو و گزارش — با هوش مصنوعی که کار را برنامه‌ریزی می‌کند، نه فقط ثبت.

## پرسوناها
- **مدیر تیم:** اولویت‌بندی، تقسیم کار، دید کلی روی ظرفیت و ریسک.
- **عضو سازنده:** می‌خواهد بداند «امروز چه کنم» و بی‌مزاحمت تمرکز کند.
- **مهمان/مشتری:** فقط پروژه خودش را می‌بیند، تأیید می‌دهد و کامنت می‌گذارد.

## فیچرها

### ۱. ساختار سازمانی و دسترسی
- Workspace → Teams → Spaces/Projects → Lists/Epics → Tasks → Subtasks (عمق نامحدود) → Checklist items
- نقش‌ها: Owner / Admin / Member / Guest / Viewer + نقش‌های سفارشی با permission‌های ریز (per-project، per-field)
- دعوت با لینک/ایمیل، SSO گوگل، 2FA (TOTP)، مدیریت نشست‌ها و دستگاه‌ها، Audit log کامل

### ۲. تسک (قلب سیستم)
- عنوان، توضیحات Rich-text (بلوکی شبیه Notion، Markdown، کد، جدول، mention، embed)
- چند Assignee + Reviewer + Watcher؛ **ساخت تسک برای دیگران با جریان «پیشنهاد/قبول/رد/مذاکره ددلاین»**
- وضعیت‌های سفارشی per-project با Workflow قابل تعریف (state machine + قوانین انتقال + الزام فیلد قبل از انتقال)
- اولویت (Urgent→Low)، Story Point، تخمین زمان، Start/Due/Deadline سخت، برچسب، Component، نسخه/Release
- **فیلدهای سفارشی:** متن، عدد، پول، تاریخ، انتخابی، چندانتخابی، کاربر، فرمول، Rollup، Relation، رأی، رتبه، پیشرفت، فایل، لینک
- **وابستگی‌ها:** blocks / blocked-by / relates / duplicates / parent؛ تشخیص حلقه، هشدار تأخیر زنجیره‌ای
- تسک تکراری (RRULE کامل: هر سه‌شنبه، آخرین روز کاری ماه شمسی، …)
- قالب تسک و قالب پروژه، Bulk edit، Drag&Drop، Archive/Trash با بازیابی، تاریخچه کامل تغییرات (diff)
- پیوست‌ها (آپلود، پیش‌نمایش تصویر/PDF/ویدیو)، ضبط صدا، اسکرین‌شات
- Approval flow (تأیید چندمرحله‌ای)، Definition of Done، Acceptance criteria
- Quick-add با زبان طبیعی: «فردا ساعت ۱۰ گزارش رو به علی بده #مارکتینگ !فوری»

### ۳. نماها (Views)
List · Board (Kanban با WIP limit و swimlane) · Table (اسپردشیتی) · Calendar (شمسی/میلادی، روز/هفته/ماه) · Timeline/Gantt (با وابستگی و critical path) · Workload (ظرفیت هر عضو) · Mind map · Activity feed · Dashboard
- فیلتر پیشرفته (AND/OR تودرتو)، گروه‌بندی، مرتب‌سازی، Saved views شخصی/تیمی، زبان کوئری (`assignee:me status:!done due:<1w`)

### ۴. متدولوژی‌های مدیریت کار (همه قابل فعال‌سازی per-project)
- **Scrum:** Backlog، Sprint planning، Sprint goal، Burndown/Burnup، Velocity، Retrospective board، Daily standup async
- **Kanban:** WIP limit، Cumulative Flow Diagram، Cycle/Lead time، Aging WIP
- **OKR:** Objective → Key Results (عددی/درصدی) → اتصال به تسک‌ها، Check-in هفتگی، confidence score
- **GTD:** Inbox، Next actions، Waiting for، Someday/Maybe، Context (@خانه، @لپ‌تاپ)، Weekly review
- **Eisenhower Matrix** (فوری/مهم) — اتوماتیک از روی اولویت و ددلاین
- **Time blocking / Pomodoro / Deep work sessions**
- **Shape Up** (Cycles ۶ هفته‌ای، Appetite، Hill chart)
- **Getting-things-on-calendar** شبیه Motion: زمان‌بندی خودکار تسک‌ها در تقویم
- **Habit tracker** و Routine‌های روزانه/هفتگی با streak
- **Milestone / Roadmap / Release planning**

### ۵. برنامه‌ریزی و زمان
- تقویم یکپارچه (تسک + جلسه + بلوک زمانی + مرخصی + تعطیلات ایران)، Sync دوطرفه با Google Calendar
- **Auto-scheduler:** با توجه به اولویت، ددلاین، تخمین، ساعات کاری، وابستگی‌ها و ظرفیت، برنامه روزانه هر نفر رو می‌چینه و با تغییرات re-plan می‌کنه
- ساعات کاری و منطقه زمانی هر عضو، مدیریت مرخصی و در دسترس بودن
- Time tracking: تایمر، ثبت دستی، Timesheet، گزارش ساعت به تفکیک پروژه/نفر، billable
- Daily planner صبحگاهی (Plan my day) و Shutdown ritual شبانه

### ۶. همکاری و ارتباط
- کامنت threaded با mention، reaction، ویرایش/حذف، Resolve
- **چت تیمی** (کانال per-project + DM) و تبدیل پیام به تسک
- همکاری لحظه‌ای: presence، typing، نمایش کسی که داره تسک رو می‌بینه/ویرایش می‌کنه
- **Docs/Wiki** داخلی با ویرایش هم‌زمان (CRDT با Yjs) و لینک به تسک‌ها
- Whiteboard ساده برای brainstorm
- جلسات: agenda، صورت‌جلسه، Action item → تسک خودکار
- Standup async و Check-in هفتگی، Kudos/تشویق اعضا
- Inbox اعلان‌ها (مثل Linear) با Snooze، Mark as read، فیلتر

### ۷. اتوماسیون
- **Rule builder بصری:** Trigger (ساخت، تغییر وضعیت/فیلد، ددلاین نزدیک، زمان‌بندی cron، webhook) → Condition → Action (assign، تغییر فیلد، ساخت ساب‌تسک، اعلان، ارسال webhook، اجرای AI)
- قالب‌های آماده اتوماسیون، لاگ اجرا، شبیه‌ساز (dry-run)
- SLA و Escalation (اگر X ساعت جواب نداد → به مدیر)

### ۸. هوش مصنوعی (OpenAI API)
- ساخت تسک از متن آزاد / صدا (Whisper) / عکس دست‌نویس
- شکستن خودکار تسک بزرگ به ساب‌تسک + تخمین زمان
- خلاصه‌سازی thread کامنت‌ها، جلسات، اسپرینت، گزارش هفتگی تیم
- دستیار چت روی کل workspace (RAG با pgvector): «این هفته علی روی چی کار کرد؟»
- پیشنهاد Assignee بر اساس بار کاری و سابقه، تشخیص تسک تکراری
- پیش‌بینی ریسک تأخیر و Burnout، پیشنهاد اولویت‌بندی
- Auto-scheduler هوشمند و نوشتن توضیحات/Acceptance criteria
- همه قابلیت‌ها با محدودیت مصرف (quota) و قابل خاموش‌کردن

### ۹. گزارش و تحلیل
- داشبوردهای قابل ساخت با ویجت (چارت، KPI، لیست، Heatmap)
- Burndown، Velocity، CFD، Cycle time، بهره‌وری هر نفر، توزیع بار کاری، تسک‌های عقب‌افتاده
- گزارش زمان، گزارش OKR، Goal progress
- Export به CSV/Excel/PDF، گزارش زمان‌بندی‌شده ایمیلی

### ۱۰. گیمیفیکیشن و انگیزه
- XP، Level، Badge، Streak، Leaderboard (قابل خاموش)، چالش‌های تیمی، جشن تکمیل (confetti 🎉)

### ۱۱. شخصی‌سازی و تجربه کاربری
- Command palette (Ctrl/Cmd+K)، میانبرهای کیبورد کامل، Dark/Light/سیستمی، تم رنگی
- فونت فارسی (Vazirmatn)، اعداد فارسی/انگلیسی، RTL/LTR
- Focus mode، My Work (همه تسک‌های من از همه پروژه‌ها)، Favorites، Recent
- جستجوی سراسری Full-text (فارسی-آگاه) + جستجوی معنایی AI

### ۱۲. موبایل (Flutter) — اختصاصی
- **آفلاین-اول** با همگام‌سازی و حل تعارض، Push notification (FCM/APNs)
- ویجت Home screen (Android/iOS)، Quick actions، Share-to-app، ضبط صدا → تسک
- بیومتریک لاک، اعلان actionable (Done/Snooze از خود نوتیفیکیشن)، Live Activity برای تایمر (iOS)

### ۱۳. یکپارچه‌سازی و API
- REST + WebSocket API عمومی با API key، Webhooks خروجی
- GitHub/GitLab (لینک commit/PR به تسک، بستن خودکار)، Google Calendar، Telegram bot (ساخت تسک و اعلان)، ایمیل-به-تسک
- Import از Trello/Jira/CSV

### ۱۴. امنیت و زیرساخت
- JWT + Refresh token rotation، Rate limiting، رمزنگاری فایل‌ها، Backup خودکار، Soft delete
- Observability: لاگ ساختاریافته، Sentry، متریک Prometheus


## User stories کلیدی و معیار پذیرش

### US-1 ساخت تسک برای هم‌تیمی
> به‌عنوان عضو تیم می‌خواهم برای هم‌تیمی‌ام تسک بسازم تا کار را رسماً واگذار کنم.
- تسک با assignee دیگر در حالت `Proposed` ساخته و برای او اعلان realtime + push ارسال می‌شود.
- گیرنده می‌تواند **قبول**، **رد (با دلیل)** یا **پیشنهاد ددلاین جدید** بدهد؛ سازنده از هر پاسخ مطلع می‌شود.
- مدیر/Admin می‌تواند جریان پیشنهاد را per-project غیرفعال کند (تخصیص مستقیم).
- همه مراحل در تاریخچه تسک ثبت می‌شود.

### US-2 برنامه روز من
> به‌عنوان عضو می‌خواهم صبح ببینم امروز چه کارهایی و به چه ترتیبی انجام دهم.
- صفحه «امروز» تسک‌های سررسید، جلسات و بلوک‌های زمانی را روی تایم‌لاین شمسی نشان می‌دهد.
- دکمه «برنامه‌ریزی کن» (Auto-scheduler) تسک‌ها را در ساعات خالی کاری با احترام به وابستگی و ددلاین می‌چیند.
- تغییر/تأخیر یک تسک، بقیه را re-plan می‌کند و تفاوت را نمایش می‌دهد.

### US-3 Quick-add زبان طبیعی
- ورودی «فردا ساعت ۱۰ گزارش رو به علی بده #مارکتینگ !فوری» به: عنوان، due، assignee، برچسب، اولویت تجزیه می‌شود و قبل از ثبت پیش‌نمایش chip‌ها نمایش داده می‌شود.
- پارسر قاعده‌محور آفلاین کار می‌کند؛ AI فقط برای موارد مبهم.

### US-4 اسپرینت
- ساخت اسپرینت با بازه شمسی، هدف، و کشیدن آیتم از Backlog؛ ظرفیت تیم بر اساس مرخصی محاسبه شود.
- Burndown لحظه‌ای؛ بستن اسپرینت تسک‌های ناتمام را به اسپرینت بعد/Backlog منتقل کند و Retro بسازد.

### US-5 OKR
- Objective با چند KR؛ پیشرفت KR از روی تسک‌های لینک‌شده یا ورود عددی؛ check-in هفتگی با confidence.

### US-6 اتوماسیون
- «وقتی وضعیت به Review رفت → Reviewer را assign کن و در کانال پروژه پیام بده» بدون کد ساخته شود؛ dry-run نتیجه را قبل از فعال‌سازی نشان دهد.

### US-7 آفلاین موبایل
- در حالت آفلاین ساخت/ویرایش/تکمیل تسک ممکن است؛ پس از اتصال همگام می‌شود؛ تعارض‌ها per-field با LWW و نمایش به کاربر حل می‌شوند.

## الزامات غیرعملکردی
- p95 پاسخ API < 200ms برای عملیات CRUD؛ تحویل رویداد realtime < 500ms
- دسترس‌پذیری WCAG 2.2 AA؛ پشتیبانی کامل کیبورد در وب
- تمام متن‌ها i18n؛ هیچ رشته hard-code نشود
- حریم خصوصی: AI قابل خاموش per-workspace؛ داده برای آموزش ارسال نمی‌شود
