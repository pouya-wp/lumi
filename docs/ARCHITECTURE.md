# Lumi — Architecture

## نمای کلی

```
 ┌──────────────┐   ┌──────────────┐
 │  Web (Next)  │   │ Mobile (Flut)│── Drift (SQLite) آفلاین
 └──────┬───────┘   └──────┬───────┘
        │ REST + Socket.IO │
 ┌──────▼──────────────────▼───────┐
 │           API (NestJS)          │── OpenAI (AI module)
 │ modules · domain events · RBAC  │── FCM/APNs, SMTP, Telegram
 └──┬─────────┬──────────┬─────────┘
    │         │          │
 Postgres   Redis      S3/MinIO
 +pgvector  (cache,    (files)
            pubsub,
            BullMQ)
```

## مونوریپو
```
apps/api       NestJS + Prisma
apps/web       Next.js App Router + Tailwind + next-intl
apps/mobile    Flutter (Riverpod, go_router, Dio, Drift)
packages/shared  تایپ‌ها، enumها، Zod schema، ابزار تاریخ شمسی، توکن‌های دیزاین
infra          docker-compose برای dev
```
ابزار: pnpm workspaces + Turborepo. Flutter خارج از pnpm و با `melos`‌-free ساختار ساده.

## ماژول‌های API
auth · users · workspaces · teams · projects · tasks · workflows · fields · views · comments · notifications · realtime · calendar · scheduler · time · sprints · goals · automation · ai · chat · docs · search · reports · gamification · integrations · files · audit

هر ماژول: `controller` (REST) → `service` (منطق دامنه) → `PrismaService`؛ تغییرات دامنه `DomainEvent` منتشر می‌کنند (`EventEmitter2`) که شنونده‌ها برای activity log، اعلان، اتوماسیون، realtime و ایندکس جستجو مصرف می‌کنند.

## مدل داده اولیه (Phase 1)
```
User(id, email, name, avatarUrl, locale, calendar[jalali|gregorian], timezone, workHours JSONB)
Workspace(id, name, slug, ownerId, settings JSONB)
Membership(userId, workspaceId, role[OWNER|ADMIN|MEMBER|GUEST|VIEWER], customRoleId?)
Team(id, workspaceId, name, color)
Project(id, workspaceId, teamId?, key "LUM", name, icon, color, methodology[], settings JSONB)
Status(id, projectId, name, category[BACKLOG|TODO|IN_PROGRESS|REVIEW|DONE|CANCELED], color, order)
Task(id, projectId, number, parentId?, title, description JSONB, statusId, priority,
     storyPoints?, estimateMin?, startAt?, dueAt?, deadlineAt?, recurrence RRULE?,
     createdById, proposalState[NONE|PROPOSED|ACCEPTED|DECLINED], customFields JSONB,
     orderKey (LexoRank), completedAt?, archivedAt?, deletedAt?)
TaskAssignee(taskId, userId, role[ASSIGNEE|REVIEWER|WATCHER])
TaskDependency(fromTaskId, toTaskId, type[BLOCKS|RELATES|DUPLICATES])
Label(id, workspaceId, name, color) · TaskLabel(taskId, labelId)
ChecklistItem(id, taskId, text, done, order)
Comment(id, taskId, authorId, body JSONB, parentId?, resolvedAt?)
Activity(id, workspaceId, actorId, entity, entityId, action, diff JSONB, createdAt)
Notification(id, userId, type, payload JSONB, readAt?, snoozedUntil?)
Attachment(id, taskId, key, name, mime, size)
```
فازهای بعد: `Sprint`, `Goal/KeyResult`, `TimeEntry`, `CalendarEvent`, `Automation/AutomationRun`, `Channel/Message`, `Doc`, `Embedding(vector)`, `Badge/XpEvent`, `Integration`.

## تصمیم‌های کلیدی (ADR خلاصه)
1. **Prisma + Postgres** — schema تایپ‌دار، migration؛ JSONB برای انعطاف فیلدهای سفارشی.
2. **LexoRank** برای ترتیب drag&drop بدون بازنویسی کل لیست.
3. **Socket.IO rooms** per workspace/project/task؛ Redis adapter برای scale افقی.
4. **همگام‌سازی موبایل:** endpoint `/sync?since=cursor` بر اساس `updatedAt` + tombstone؛ تعارض per-field LWW.
5. **AI provider abstraction:** `AiProvider` interface با پیاده‌سازی `OpenAiProvider` (کلید `OPENAI_API_KEY`، مدل `OPENAI_MODEL`).
6. **زمان:** ذخیره UTC، نمایش با timezone کاربر؛ شمسی فقط لایه نمایش/ورودی.
7. **Auth:** access JWT کوتاه (15m) + refresh token چرخشی در DB (hash شده).
