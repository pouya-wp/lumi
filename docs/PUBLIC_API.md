# Lumi public API & integrations

Everything here is configured per workspace under **Settings** (`/app/settings`).

## API keys and REST v1

Create a key in Settings → API keys. The full key (`lumi_…`) is shown once; only its SHA-256 hash is stored.
A key acts as the member who created it, limited to that workspace, so normal role checks still apply.

```bash
curl -H "Authorization: Bearer $LUMI_KEY" https://api.example.com/api/v1/me
```

| Method | Path | Body / notes |
| --- | --- | --- |
| GET | `/api/v1/me` | key owner and workspace |
| GET | `/api/v1/projects` | projects with their statuses |
| GET | `/api/v1/projects/:id/tasks` | same filters as the app (`status`, `assigneeId`, …) |
| POST | `/api/v1/projects/:id/tasks` | `{ title, description?, priority?, dueAt?, assigneeIds?, labelNames?, statusId? }` |
| GET | `/api/v1/tasks/:id` | full task |
| PATCH | `/api/v1/tasks/:id` | any task field, e.g. `{ statusId }` |
| POST | `/api/v1/tasks/:id/comments` | `{ text }` |

`X-Api-Key: lumi_…` works as well as the `Authorization` header. Keys are not accepted by the app's own JWT routes.

## Outgoing webhooks

Events: `task.created`, `task.updated`, `task.completed`, `task.deleted`, `comment.created`, `chat.message` (public channels only).

Each delivery is a JSON `POST`:

```json
{ "id": "…", "event": "task.completed", "workspaceId": "…", "createdAt": "…", "data": { "task": { "key": "APP-12", "title": "…" } } }
```

Headers: `X-Lumi-Event`, `X-Lumi-Delivery`, and `X-Lumi-Signature: sha256=<hex>`, the HMAC-SHA256 of the raw body with the webhook's secret.
Verify it before trusting a payload:

```js
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-lumi-signature']));
```

Deliveries time out after 8 seconds and are not retried; the last 50 per webhook are kept and shown in Settings.

## GitHub

Settings → GitHub → Connect gives a payload URL and secret. In the repository, add a webhook with content type `application/json` and the **Push** and **Pull requests** events.

- Any commit or PR that mentions a task key (`APP-12`) adds a comment with the link.
- An opened PR moves the task to the project's *Review* status; a merged PR moves it to *Done*.
- A commit on the default branch saying `fixes APP-12` / `closes` / `resolves` (or «حل شد») moves it to *Done*.

## Telegram bot

1. Create a bot with [@BotFather](https://t.me/BotFather) and paste its token in Settings → Telegram (admins).
   Lumi calls `setWebhook` automatically; this needs `PUBLIC_API_URL` to be a public HTTPS URL.
2. Each member clicks **Connect my Telegram**, which opens `t.me/<bot>?start=<one-time code>`.

Then:
- any message becomes a task assigned to the sender, using the quick-add syntax (`فردا ساعت ۱۰ گزارش !فوری #مارکتینگ`);
- `/today` lists today's tasks and `/help` shows usage;
- Lumi notifications (assignments, mentions, proposals, badges) are forwarded to the chat.

## Calendar feed (iCal)

Settings → Calendar feed shows a private URL (`/api/ical/<token>.ics`) with your dated tasks (all-day, or timed when they have a start) and the meetings you attend.
Subscribe from Google Calendar (*Other calendars → From URL*) or Apple Calendar. **New token** invalidates the old URL.

## CSV import

Settings → Import from CSV (or `POST /api/projects/:id/import` with `{ csv, dryRun? }`). Headers are matched case-insensitively against common names from Jira, Trello, Asana, ClickUp and Persian spreadsheets:

| Field | Accepted headers |
| --- | --- |
| title (required) | title, summary, name, task, card name, عنوان |
| description | description, notes, details, توضیحات |
| priority | priority, اولویت (urgent/highest/critical, high, medium/normal, low) |
| due date | due, due date, deadline, ددلاین, موعد |
| assignees | assignee, owner, assigned to, مسئول (emails or names, `;` or `,` separated) |
| labels | labels, tags, برچسب |
| status | status, state, list, column, وضعیت (status name, or words like done / in progress) |
| estimate / points | estimate (minutes), story points |

Comma, semicolon and tab separated files are detected automatically; up to 1,000 rows per import.
