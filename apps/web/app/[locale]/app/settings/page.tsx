'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, cx, Empty, Icon, IconButton, Input, Panel, Pill, Spinner } from '@/components/ui';
import { del, get, patch, post, tokens } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useProjects } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';

interface Overview {
  admin: boolean;
  webhookEvents: string[];
  github: { connected: boolean; webhookUrl?: string; secret?: string };
  telegram: { connected: boolean; username?: string; defaultProjectId?: string; linked: boolean };
}
interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}
interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  deliveries: { id: string; event: string; ok: boolean; status: number | null; durationMs: number; createdAt: string; error: string | null }[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function useCopy() {
  const toast = useToast();
  const { t } = useT();
  return (text: string) => copyText(text).then((ok) => ok && toast(t('integ.copied'), '📋'));
}

function CopyField({ value, secret }: { value: string; secret?: boolean }) {
  const { t } = useT();
  const copy = useCopy();
  const [shown, setShown] = useState(!secret);
  return (
    <div className="flex items-center gap-1.5 rounded-[14px] bg-sunken p-1.5 ps-3 shadow-[inset_0_0_0_1px_var(--line)]" dir="ltr">
      <code className="min-w-0 flex-1 truncate text-xs">{shown ? value : '•'.repeat(Math.min(32, value.length))}</code>
      {secret && <IconButton icon={shown ? 'lock' : 'search'} label="reveal" onClick={() => setShown(!shown)} className="size-7" />}
      <Button size="sm" variant="ink" onClick={() => copy(value)}>
        {t('integ.copy')}
      </Button>
    </div>
  );
}

function Section({ emoji, title, hint, status, children, tone }: { emoji: string; title: string; hint: string; status?: ReactNode; children: ReactNode; tone?: string }) {
  return (
    <Panel className="rise p-5 md:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[16px] text-2xl" style={{ background: `color-mix(in oklab, ${tone ?? 'var(--lumi)'} 14%, var(--panel))` }}>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {status}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">{hint}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

export default function SettingsPage() {
  const { t } = useT();
  const { workspace } = useSession();
  const wid = workspace?.id;
  const overview = useQuery({ queryKey: ['integrations', wid], queryFn: () => get<Overview>(`/workspaces/${wid}/integrations`), enabled: !!wid });

  if (!overview.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }
  const o = overview.data;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3">
      <Panel aurora="#4F5BFF" aurora2="#16A34A" className="rise p-6 md:p-8">
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">{workspace?.name}</p>
        <h1 className="mt-2 text-3xl font-semibold">{t('integ.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('integ.subtitle')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['🐙', 'GitHub', o.github.connected],
            ['✈️', 'Telegram', o.telegram.connected],
          ].map(([e, n, on]) => (
            <span key={n as string} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs', on ? 'bg-ink text-on-ink' : 'bg-sunken text-muted')}>
              {e} {n} <span className={cx('size-1.5 rounded-full', on ? 'bg-success' : 'bg-line')} />
            </span>
          ))}
        </div>
      </Panel>
      <AccountSection />
      <ImportSection />
      <TelegramSection o={o} />
      <GithubSection o={o} />
      <IcalSection />
      <KeysSection />
      <WebhooksSection o={o} />
    </div>
  );
}

function KeysSection() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ['apiKeys', workspace?.id], queryFn: () => get<ApiKey[]>(`/workspaces/${workspace!.id}/api-keys`), enabled: !!workspace });
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const res = await post<{ key: string }>(`/workspaces/${workspace!.id}/api-keys`, { name: name.trim() });
    setFresh(res.key);
    setName('');
    qc.invalidateQueries({ queryKey: ['apiKeys'] });
  };
  return (
    <Section emoji="🔑" title={t('integ.keys.title')} hint={t('integ.keys.hint')} tone="#EAB308">
      <form onSubmit={create} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('integ.keys.name')} maxLength={60} />
        <Button type="submit" variant="ink" disabled={!name.trim()}>
          <Icon name="plus" size={15} /> {t('integ.keys.create')}
        </Button>
      </form>
      {fresh && (
        <div className="rise mt-3 rounded-[18px] bg-warn-soft p-3">
          <p className="mb-2 text-xs font-medium text-warn">⚠️ {t('integ.keys.once')}</p>
          <CopyField value={fresh} />
          <p className="mt-3 mb-1 text-[11px] text-muted">{t('integ.keys.example')}</p>
          <pre className="overflow-x-auto rounded-[12px] bg-[#0b0c0f] p-3 text-[11px] leading-5 text-[#e6e8ee]" dir="ltr">
            {`curl -H "Authorization: Bearer ${fresh.slice(0, 12)}…" \\\n  ${API_BASE}/api/v1/projects`}
          </pre>
        </div>
      )}
      <div className="mt-3 flex flex-col">
        {keys.data?.map((k) => (
          <div key={k.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
            <span className="grid size-8 place-items-center rounded-[10px] bg-sunken">🔑</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{k.name}</span>
              <span className="text-[11px] text-muted" dir="ltr">
                {k.prefix}…
              </span>
            </span>
            <span className="text-[11px] text-muted">{k.lastUsedAt ? t('integ.keys.lastUsed', { when: timeAgo(k.lastUsedAt, locale) }) : t('integ.keys.never')}</span>
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                await del(`/api-keys/${k.id}`);
                qc.invalidateQueries({ queryKey: ['apiKeys'] });
              }}
            >
              {t('integ.keys.revoke')}
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function WebhooksSection({ o }: { o: Overview }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const hooks = useQuery({ queryKey: ['webhooks', workspace?.id], queryFn: () => get<Webhook[]>(`/workspaces/${workspace!.id}/webhooks`), enabled: !!workspace && o.admin });
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['task.created', 'task.completed']);
  const refresh = () => qc.invalidateQueries({ queryKey: ['webhooks'] });
  if (!o.admin) {
    return (
      <Section emoji="🪝" title={t('integ.hooks.title')} hint={t('integ.hooks.hint')} tone="#8B5CF6">
        <p className="text-sm text-muted">{t('integ.adminOnly')}</p>
      </Section>
    );
  }
  const toggle = (e: string) => setEvents((xs) => (xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e]));
  return (
    <Section emoji="🪝" title={t('integ.hooks.title')} hint={t('integ.hooks.hint')} tone="#8B5CF6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await post(`/workspaces/${workspace!.id}/webhooks`, { url: url.trim(), events });
          setUrl('');
          refresh();
        }}
        className="flex flex-col gap-3 rounded-[18px] bg-sunken p-3 shadow-[inset_0_0_0_1px_var(--line)]"
      >
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('integ.hooks.url')} dir="ltr" type="url" />
          <Button type="submit" variant="ink" disabled={!url.trim() || !events.length}>
            {t('integ.hooks.add')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {o.webhookEvents.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => toggle(e)}
              className={cx('rounded-full px-2.5 py-1 font-mono text-[11px] transition', events.includes(e) ? 'bg-ink text-on-ink' : 'bg-panel text-muted shadow-[inset_0_0_0_1px_var(--line)]')}
              dir="ltr"
            >
              {e}
            </button>
          ))}
        </div>
      </form>
      <div className="mt-3 flex flex-col gap-2">
        {hooks.data?.length === 0 && <Empty emoji="🪝" text={t('integ.hooks.none')} />}
        {hooks.data?.map((h) => (
          <div key={h.id} className="rounded-[18px] p-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('size-2 rounded-full', h.active ? 'bg-success' : 'bg-line')} />
              <code className="min-w-0 flex-1 truncate text-xs" dir="ltr">
                {h.url}
              </code>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={h.active}
                  onChange={async (e) => {
                    await patch(`/webhooks/${h.id}`, { active: e.target.checked });
                    refresh();
                  }}
                />
                {t('integ.hooks.active')}
              </label>
              <Button
                size="sm"
                onClick={async () => {
                  const d = await post<{ ok: boolean; status: number | null }>(`/webhooks/${h.id}/ping`);
                  toast(d.ok ? `✓ ${d.status}` : `✗ ${d.status ?? '—'}`, d.ok ? '🟢' : '🔴');
                  refresh();
                }}
              >
                {t('integ.hooks.ping')}
              </Button>
              <IconButton
                icon="trash"
                label={t('integ.delete')}
                className="size-8"
                onClick={async () => {
                  await del(`/webhooks/${h.id}`);
                  refresh();
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {h.events.map((e) => (
                <Pill key={e} className="font-mono">
                  {e}
                </Pill>
              ))}
            </div>
            <div className="mt-2">
              <p className="mb-1 text-[11px] text-muted">{t('integ.hooks.secret')}</p>
              <CopyField value={h.secret} secret />
            </div>
            {h.deliveries.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] text-muted">{t('integ.hooks.deliveries')}</p>
                <div className="flex flex-col gap-1">
                  {h.deliveries.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-[11px]" dir="ltr">
                      <span className={cx('size-1.5 rounded-full', d.ok ? 'bg-success' : 'bg-danger')} />
                      <span className="font-mono">{d.event}</span>
                      <span className="text-muted">{d.status ?? d.error}</span>
                      <span className="ms-auto text-muted">
                        {num(d.durationMs, locale)}ms · {timeAgo(d.createdAt, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function GithubSection({ o }: { o: Overview }) {
  const { t } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['integrations'] });
  return (
    <Section
      emoji="🐙"
      title={t('integ.github.title')}
      hint={t('integ.github.hint')}
      tone="#0B0C0F"
      status={<Pill tone={o.github.connected ? 'success' : 'neutral'}>{t(o.github.connected ? 'integ.connected' : 'integ.notConnected')}</Pill>}
    >
      {!o.admin ? (
        <p className="text-sm text-muted">{t('integ.adminOnly')}</p>
      ) : o.github.connected ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-[14px] bg-sunken p-3 text-xs leading-6 text-ink-2">{t('integ.github.steps')}</p>
          <div>
            <p className="mb-1 text-[11px] text-muted">{t('integ.github.payload')}</p>
            <CopyField value={o.github.webhookUrl!} />
          </div>
          {o.github.secret && (
            <div>
              <p className="mb-1 text-[11px] text-muted">{t('integ.github.secret')}</p>
              <CopyField value={o.github.secret} secret />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await post(`/workspaces/${workspace!.id}/integrations/github`);
                refresh();
              }}
            >
              {t('integ.rotate')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await del(`/workspaces/${workspace!.id}/integrations/github`);
                refresh();
              }}
            >
              {t('integ.disconnect')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ink"
          onClick={async () => {
            await post(`/workspaces/${workspace!.id}/integrations/github`);
            refresh();
          }}
        >
          🐙 {t('integ.connect')}
        </Button>
      )}
    </Section>
  );
}

function TelegramSection({ o }: { o: Overview }) {
  const { t } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const projects = useProjects(workspace?.id).data ?? [];
  const [botToken, setBotToken] = useState('');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['integrations'] });

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post<{ webhookError?: string }>(`/workspaces/${workspace!.id}/integrations/telegram`, { botToken: botToken.trim(), defaultProjectId: projectId || undefined });
      if (res.webhookError) toast(t('integ.telegram.webhookError', { error: res.webhookError }), '⚠️');
      setBotToken('');
      refresh();
    } catch (err) {
      toast((err as Error).message, '⚠️');
    } finally {
      setBusy(false);
    }
  };
  const link = async () => {
    const res = await post<{ deepLink: string }>(`/workspaces/${workspace!.id}/integrations/telegram/link`);
    window.open(res.deepLink, '_blank', 'noopener');
  };

  return (
    <Section
      emoji="✈️"
      title={t('integ.telegram.title')}
      hint={t('integ.telegram.hint')}
      tone="#0EA5E9"
      status={
        o.telegram.connected ? (
          <Pill tone="info" className="font-mono">
            @{o.telegram.username}
          </Pill>
        ) : (
          <Pill>{t('integ.notConnected')}</Pill>
        )
      }
    >
      {o.telegram.connected && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[18px] bg-[color-mix(in_oklab,#0EA5E9_10%,var(--panel))] p-3">
          {o.telegram.linked ? (
            <span className="text-sm font-medium">{t('integ.telegram.linked')}</span>
          ) : (
            <Button variant="ink" onClick={link}>
              ✈️ {t('integ.telegram.link')}
            </Button>
          )}
          <a href={`https://t.me/${o.telegram.username}`} target="_blank" rel="noreferrer" className="text-sm text-info hover:underline" dir="ltr">
            t.me/{o.telegram.username}
          </a>
          <code className="ms-auto rounded-full bg-panel px-3 py-1 text-[11px] text-muted" dir="ltr">
            /today · /help
          </code>
        </div>
      )}
      {o.admin ? (
        <form onSubmit={connect} className="flex flex-wrap gap-2">
          <Input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={t('integ.telegram.token')} dir="ltr" className="min-w-64 flex-1" />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none">
            <option value="">{t('integ.telegram.project')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="ink" loading={busy} disabled={botToken.trim().length < 20}>
            {t('integ.connect')}
          </Button>
          {o.telegram.connected && (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                await del(`/workspaces/${workspace!.id}/integrations/telegram`);
                refresh();
              }}
            >
              {t('integ.disconnect')}
            </Button>
          )}
        </form>
      ) : (
        !o.telegram.connected && <p className="text-sm text-muted">{t('integ.adminOnly')}</p>
      )}
    </Section>
  );
}

function IcalSection() {
  const { t } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const feed = useQuery({ queryKey: ['ical', workspace?.id], queryFn: () => get<{ url: string }>(`/workspaces/${workspace!.id}/calendar-feed`), enabled: !!workspace });
  return (
    <Section emoji="📆" title={t('integ.ical.title')} hint={t('integ.ical.hint')} tone="#F43F5E">
      {feed.data ? (
        <div className="flex flex-col gap-2">
          <CopyField value={feed.data.url} secret />
          <div className="flex flex-wrap items-center gap-2">
            <a href={feed.data.url.replace(/^https?:/, 'webcal:')} className="rounded-full bg-ink px-4 py-2 text-xs text-on-ink">
              🍎 webcal://
            </a>
            <span className="text-[11px] text-muted">{t('integ.ical.how')}</span>
            <Button
              size="sm"
              className="ms-auto"
              onClick={async () => {
                await post(`/workspaces/${workspace!.id}/calendar-feed/rotate`);
                qc.invalidateQueries({ queryKey: ['ical'] });
              }}
            >
              {t('integ.rotate')}
            </Button>
          </div>
        </div>
      ) : (
        <Spinner />
      )}
    </Section>
  );
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  columns: Record<string, number>;
  preview: { row: number; title: string; priority?: string; dueAt?: string; labelNames: string[]; assigneeIds: string[] }[];
}

function ImportSection() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const projects = useProjects(workspace?.id).data ?? [];
  const [projectId, setProjectId] = useState('');
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pid = projectId || projects[0]?.id;

  const load = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    if (pid) setPreview(await post<ImportResult>(`/projects/${pid}/import`, { csv: text, dryRun: true }));
  };
  const run = async () => {
    if (!csv || !pid) return;
    setBusy(true);
    try {
      const res = await post<ImportResult>(`/projects/${pid}/import`, { csv });
      toast(t('integ.import.done', { n: res.created }), '📥');
      qc.invalidateQueries({ queryKey: ['tasks', pid] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setPreview({ ...res, preview: [] });
      setCsv(null);
    } finally {
      setBusy(false);
    }
  };
  const rows = preview ? preview.preview.length : 0;

  return (
    <Section emoji="📥" title={t('integ.import.title')} hint={t('integ.import.hint')} tone="#16A34A">
      <div className="flex flex-wrap items-center gap-2">
        <label className="hatch flex h-10 cursor-pointer items-center gap-2 rounded-full bg-sunken px-4 text-sm shadow-[inset_0_0_0_1px_var(--line)] hover:bg-line/60">
          <Icon name="arrowUp" size={15} /> {fileName || t('integ.import.pick')}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
        <span className="text-xs text-muted">{t('integ.import.project')}</span>
        <select
          value={pid ?? ''}
          onChange={async (e) => {
            setProjectId(e.target.value);
            if (csv) setPreview(await post<ImportResult>(`/projects/${e.target.value}/import`, { csv, dryRun: true }));
          }}
          className="h-10 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        {csv && preview && (
          <Button variant="ink" className="ms-auto" loading={busy} onClick={run}>
            {t('integ.import.run', { n: rows >= 8 ? `${num(8, locale)}+` : rows })}
          </Button>
        )}
      </div>
      {preview && (
        <div className="rise mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted">{t('integ.import.columns')}:</span>
            {Object.keys(preview.columns).map((c) => (
              <Pill key={c} tone="success">
                {c}
              </Pill>
            ))}
            {preview.skipped > 0 && <Pill tone="warn">{t('integ.import.skipped', { n: preview.skipped })}</Pill>}
          </div>
          {preview.preview.length > 0 && (
            <div className="overflow-x-auto rounded-[16px] shadow-[inset_0_0_0_1px_var(--line)]">
              <table className="w-full text-sm">
                <tbody>
                  {preview.preview.map((r) => (
                    <tr key={r.row} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-[11px] text-muted tabular-nums">{num(r.row, locale)}</td>
                      <td className="px-3 py-2 font-medium">{r.title}</td>
                      <td className="px-3 py-2">{r.priority && <Pill>{t(`priority.${r.priority}`)}</Pill>}</td>
                      <td className="px-3 py-2 text-xs text-muted">{r.labelNames.join('، ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.errors.length > 0 && (
            <div className="rounded-[14px] bg-danger-soft p-3 text-xs text-danger">
              <p className="mb-1 font-medium">{t('integ.import.errors')}</p>
              {preview.errors.slice(0, 6).map((e, i) => (
                <p key={i}>
                  #{num(e.row, locale)} — {e.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function AccountSection() {
  const { t } = useT();
  const { user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const save = async (body: Record<string, unknown>) => {
    await patch('/auth/me', body);
    qc.invalidateQueries({ queryKey: ['me'] });
    toast(t('integ.account.saved'), '✓');
  };
  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await post<{ accessToken: string; refreshToken: string }>('/auth/password', { currentPassword: current, newPassword: next });
      tokens.set(res.accessToken, res.refreshToken);
      setCurrent('');
      setNext('');
      toast(t('integ.account.changed'), '🔒');
    } catch (err) {
      toast((err as Error).message, '⚠️');
    }
  };
  if (!user) return null;
  return (
    <Section emoji="👤" title={t('integ.account.title')} hint={t('integ.account.hint')} tone="#4F5BFF">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] text-muted">{t('integ.account.name')}</label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <Button variant="ink" disabled={name.trim().length < 2 || name === user.name} onClick={() => save({ name: name.trim() })}>
              {t('integ.save')}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['fa', 'en'] as const).map((l) => (
              <Button key={l} size="sm" variant={user.locale === l ? 'ink' : 'soft'} onClick={() => save({ locale: l })}>
                {l === 'fa' ? 'فارسی' : 'English'}
              </Button>
            ))}
            {(['jalali', 'gregorian'] as const).map((c) => (
              <Button key={c} size="sm" variant={user.calendar === c ? 'ink' : 'soft'} onClick={() => save({ calendar: c })}>
                {t(`integ.account.${c}`)}
              </Button>
            ))}
          </div>
        </div>
        <form onSubmit={changePassword} className="flex flex-col gap-2">
          <label className="text-[11px] text-muted">{t('integ.account.password')}</label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={t('integ.account.current')} autoComplete="current-password" />
          <div className="flex gap-2">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={t('integ.account.new')} autoComplete="new-password" minLength={8} />
            <Button type="submit" variant="ink" disabled={!current || next.length < 8}>
              {t('integ.save')}
            </Button>
          </div>
        </form>
      </div>
    </Section>
  );
}
