'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Avatar, Button, cx, Empty, Icon, IconButton, Input, Pill, Spinner } from '@/components/ui';
import { Dialog } from '@/components/ui/dialog';
import { del, patch, post } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useChannels, useMessages, useProjects, useThread, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { useUi } from '@/lib/ui-state';
import type { Channel, ChatMessage, Member, Task } from '@/lib/types';

const QUICK = ['👍', '❤️', '🎉', '😂', '👀', '🔥'];

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}

function Chat() {
  const { t } = useT();
  const { workspace, user } = useSession();
  const channels = useChannels(workspace?.id);
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const list = channels.data ?? [];
  const current = list.find((c) => c.id === params.get('c')) ?? list.find((c) => c.kind === 'PUBLIC');
  const select = (id: string) => {
    setThreadId(null);
    router.replace(`${pathname}?c=${id}`);
  };

  const openDm = async (m: Member) => {
    const ch = await post<Channel>(`/workspaces/${workspace!.id}/dm`, { userId: m.id });
    await qc.invalidateQueries({ queryKey: ['channels'] });
    select(ch.id);
  };

  if (!channels.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }

  const publics = list.filter((c) => c.kind === 'PUBLIC');
  const dmWith = (m: Member) => list.find((c) => c.kind === 'DIRECT' && c.members.some((x) => x.id === m.id));

  return (
    <div className="rise grid h-[calc(100dvh-7.5rem)] min-h-[520px] gap-3 md:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_auto]">
      {/* Channel list */}
      <aside className="panel hidden flex-col overflow-hidden md:flex">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-semibold">{t('chat.title')}</h1>
          <IconButton icon="plus" label={t('chat.newChannel')} onClick={() => setCreating(true)} className="size-8 shadow-[inset_0_0_0_1px_var(--line)]" />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-2 pt-3 pb-1.5 text-[10px] font-medium tracking-[0.14em] text-muted uppercase">{t('chat.channels')}</p>
          {publics.map((c) => (
            <ChannelRow key={c.id} active={current?.id === c.id} onClick={() => select(c.id)} icon={c.emoji ?? '#'} name={c.name} unread={c.unread} last={c.last} />
          ))}
          <p className="px-2 pt-4 pb-1.5 text-[10px] font-medium tracking-[0.14em] text-muted uppercase">{t('chat.direct')}</p>
          {members
            .filter((m) => m.id !== user?.id)
            .map((m) => {
              const ch = dmWith(m);
              return (
                <ChannelRow
                  key={m.id}
                  active={!!ch && current?.id === ch.id}
                  onClick={() => (ch ? select(ch.id) : openDm(m))}
                  icon={<Avatar name={m.name} src={m.avatarUrl} size={26} />}
                  name={m.name}
                  unread={ch?.unread ?? 0}
                  last={ch?.last ?? null}
                />
              );
            })}
        </div>
      </aside>

      {/* Mobile channel strip */}
      <div className="flex gap-1.5 overflow-x-auto md:hidden">
        {publics.map((c) => (
          <button key={c.id} onClick={() => select(c.id)} className={cx('shrink-0 rounded-full px-3 py-1.5 text-sm', current?.id === c.id ? 'bg-ink text-on-ink' : 'bg-panel')}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {current ? (
        <Conversation key={current.id} channel={current} members={members} onThread={setThreadId} threadId={threadId} />
      ) : (
        <div className="panel grid place-items-center">
          <Empty emoji="💬" text={t('chat.pick')} />
        </div>
      )}

      {threadId && current && <ThreadPanel id={threadId} channel={current} members={members} onClose={() => setThreadId(null)} />}
      {creating && <NewChannel onClose={() => setCreating(false)} onCreated={select} />}
    </div>
  );
}

function ChannelRow({ active, onClick, icon, name, unread, last }: { active: boolean; onClick: () => void; icon: React.ReactNode; name: string; unread: number; last: ChatMessage | null }) {
  const { locale } = useT();
  return (
    <button onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-[14px] px-2 py-2 text-start transition', active ? 'bg-ink text-on-ink' : 'hover:bg-sunken')}>
      <span className={cx('grid size-8 shrink-0 place-items-center rounded-[10px] text-sm', active ? 'bg-on-ink/15' : 'bg-sunken')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-sm', unread > 0 && 'font-semibold')}>{name}</span>
        {last && !last.deletedAt && <span className="block truncate text-[11px] opacity-60">{last.text}</span>}
      </span>
      {unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-lumi px-1.5 text-[10px] font-semibold text-white">{num(unread, locale)}</span>}
    </button>
  );
}

function channelTitle(c: Channel, meId?: string) {
  if (c.kind === 'DIRECT') return c.members.find((m) => m.id !== meId)?.name ?? '—';
  return c.name;
}

function Conversation({ channel, members, onThread, threadId }: { channel: Channel; members: Member[]; onThread: (id: string) => void; threadId: string | null }) {
  const { t } = useT();
  const { user, workspace } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const messages = useMessages(channel.id);
  const scroller = useRef<HTMLDivElement>(null);
  const [standupBusy, setStandupBusy] = useState(false);
  const items = useMemo(() => messages.data ?? [], [messages.data]);
  const title = channelTitle(channel, user?.id);

  // Stick to the bottom and mark read whenever new messages land.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (items.length) post(`/channels/${channel.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['channels'] }));
  }, [items.length, channel.id, qc]);

  const send = async (text: string, mentionIds: string[]) => {
    await post(`/channels/${channel.id}/messages`, { text, mentionIds });
    qc.invalidateQueries({ queryKey: ['messages', channel.id] });
  };

  const standup = async () => {
    setStandupBusy(true);
    try {
      const res = await post<{ text: string }>(`/workspaces/${workspace!.id}/ai/standup`);
      await send(`🌅 ${t('docs.standup')}\n\n${res.text}`, []);
      toast(t('docs.posted'));
    } finally {
      setStandupBusy(false);
    }
  };

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <span className="grid size-10 place-items-center rounded-[14px] bg-sunken text-lg">
          {channel.kind === 'DIRECT' ? <Avatar name={title} size={30} /> : (channel.emoji ?? '#')}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{channel.kind === 'PUBLIC' ? `# ${title}` : title}</h2>
          <p className="truncate text-xs text-muted">{channel.topic ?? (channel.kind === 'PUBLIC' ? t('chat.members', { n: members.length }) : '')}</p>
        </div>
        {channel.kind === 'PUBLIC' && (
          <Button size="sm" variant="soft" loading={standupBusy} onClick={standup} title={t('docs.standupHint')}>
            🌅 {t('docs.standup')}
          </Button>
        )}
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-4 md:px-5">
        {messages.isLoading && <Spinner />}
        {!messages.isLoading && items.length === 0 && <Empty emoji="👋" text={t('chat.empty')} />}
        {items.map((m, i) => {
          const prev = items[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const grouped = !newDay && prev && prev.author.id === m.author.id && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          return (
            <Fragment key={m.id}>
              {newDay && <DayDivider date={m.createdAt} />}
              <MessageRow message={m} grouped={!!grouped} members={members} onThread={() => onThread(m.id)} highlighted={threadId === m.id} />
            </Fragment>
          );
        })}
      </div>

      <Composer placeholder={t('chat.placeholder', { name: channel.kind === 'PUBLIC' ? `#${title}` : title })} members={members} onSend={send} />
    </section>
  );
}

function DayDivider({ date }: { date: string }) {
  const { t, locale } = useT();
  const d = new Date(date);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  const label = d.toDateString() === today.toDateString() ? t('chat.today') : d.toDateString() === y.toDateString() ? t('chat.yesterday') : formatDate(d, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-muted">
      <span className="h-px flex-1 bg-line" />
      <span className="rounded-full px-3 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Highlights @Name mentions of workspace members inside message text. */
function RichText({ text, members }: { text: string; members: Member[] }) {
  const names = members.map((m) => m.name).sort((a, b) => b.length - a.length);
  if (!names.length) return <>{text}</>;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g');
  return (
    <>
      {text.split(re).map((part, i) =>
        part.startsWith('@') && names.includes(part.slice(1)) ? (
          <span key={i} className="rounded-full bg-lumi/12 px-1.5 font-medium text-lumi">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function MessageRow({ message: m, grouped, members, onThread, highlighted, inThread }: { message: ChatMessage; grouped: boolean; members: Member[]; onThread?: () => void; highlighted?: boolean; inThread?: boolean }) {
  const { t, locale } = useT();
  const { user, workspace } = useSession();
  const { openTask } = useUi();
  const qc = useQueryClient();
  const projects = useProjects(workspace?.id).data ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const [picking, setPicking] = useState(false);
  const mine = m.author.id === user?.id;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['messages', m.channelId] });
    qc.invalidateQueries({ queryKey: ['thread'] });
  };
  const react = async (emoji: string) => {
    await post(`/messages/${m.id}/react`, { emoji });
    refresh();
  };
  const toTask = async (projectId: string) => {
    setPicking(false);
    const task = await post<Task>(`/messages/${m.id}/to-task`, { projectId });
    refresh();
    openTask(task.id);
  };

  if (m.deletedAt) {
    return <p className={cx('py-1 ps-12 text-xs text-muted italic', !grouped && 'mt-3')}>{t('chat.deleted')}</p>;
  }

  return (
    <div className={cx('group relative flex gap-3 rounded-[14px] px-2 py-1 transition hover:bg-sunken/70', !grouped && 'mt-3', highlighted && 'bg-lumi/8')}>
      <div className="w-9 shrink-0">{!grouped && <Avatar name={m.author.name} src={m.author.avatarUrl} size={36} />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{m.author.name}</span>
            <span className="text-[11px] text-muted">{formatTime(m.createdAt, locale)}</span>
          </p>
        )}
        {editing ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await patch(`/messages/${m.id}`, { text: draft });
              setEditing(false);
              refresh();
            }}
            className="mt-1 flex gap-2"
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <Button type="submit" size="sm" variant="ink">
              ✓
            </Button>
          </form>
        ) : (
          <p className="text-[14.5px] leading-7 whitespace-pre-wrap text-ink-2" dir="auto">
            <RichText text={m.text} members={members} />
            {m.editedAt && <span className="ms-1 text-[10px] text-muted">({t('chat.edited')})</span>}
          </p>
        )}
        {m.taskId && (
          <button onClick={() => openTask(m.taskId!)} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs text-success">
            <Icon name="checkCircle" size={13} /> {t('chat.linkedTask')}
          </button>
        )}
        {m.reactions && Object.keys(m.reactions).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(m.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => react(emoji)}
                title={users.map((u) => members.find((x) => x.id === u)?.name).join('، ')}
                className={cx('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition', users.includes(user?.id ?? '') ? 'bg-lumi/12 text-lumi shadow-[inset_0_0_0_1px_var(--lumi)]' : 'bg-sunken shadow-[inset_0_0_0_1px_var(--line)]')}
              >
                {emoji} <span className="tabular-nums">{num(users.length, locale)}</span>
              </button>
            ))}
          </div>
        )}
        {!inThread && m.replyCount > 0 && (
          <button onClick={onThread} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-lumi hover:underline">
            <Icon name="message" size={13} /> {t('chat.replies', { n: m.replyCount })}
          </button>
        )}
      </div>

      {/* Hover toolbar */}
      <div className="absolute -top-4 end-3 z-10 hidden items-center gap-0.5 rounded-full bg-panel p-1 shadow-[var(--shadow-panel),inset_0_0_0_1px_var(--line)] group-hover:flex">
        {QUICK.map((e) => (
          <button key={e} onClick={() => react(e)} className="grid size-7 place-items-center rounded-full text-sm transition hover:scale-125 hover:bg-sunken">
            {e}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-line" />
        {!inThread && <IconButton icon="message" label={t('chat.thread')} onClick={onThread} className="size-7" />}
        {!m.taskId && <IconButton icon="checkCircle" label={t('chat.toTask')} onClick={() => (projects.length === 1 ? toTask(projects[0].id) : setPicking(!picking))} className="size-7" />}
        {mine && <IconButton icon="settings" label={t('chat.edit')} onClick={() => setEditing(true)} className="size-7" />}
        {mine && (
          <IconButton
            icon="trash"
            label={t('chat.delete')}
            onClick={async () => {
              await del(`/messages/${m.id}`);
              refresh();
            }}
            className="size-7"
          />
        )}
      </div>
      {picking && (
        <div className="panel rise absolute end-3 top-8 z-20 w-56 p-1.5">
          <p className="px-2 py-1 text-[11px] text-muted">{t('docs.pickProject')}</p>
          {projects.map((p) => (
            <button key={p.id} onClick={() => toTask(p.id)} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm hover:bg-sunken">
              {p.icon ?? '◆'} {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ placeholder, members, onSend, compact }: { placeholder: string; members: Member[]; onSend: (text: string, mentionIds: string[]) => Promise<void>; compact?: boolean }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const matches = query === null ? [] : members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  const onChange = (v: string) => {
    setText(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const m = /@([^\s@]*)$/.exec(v.slice(0, caret));
    setQuery(m ? m[1] : null);
    setActive(0);
  };
  const pickMention = (name: string) => {
    const caret = ref.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `);
    setText(before + text.slice(caret));
    setQuery(null);
    ref.current?.focus();
  };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const ids = members.filter((m) => v.includes(`@${m.name}`)).map((m) => m.id);
      await onSend(v, ids);
      setText('');
    } finally {
      setBusy(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(matches[active].name);
        return;
      }
      if (e.key === 'Escape') return setQuery(null);
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit();
  };

  return (
    <form onSubmit={submit} className={cx('relative border-t border-line', compact ? 'p-3' : 'p-3 md:p-4')}>
      {matches.length > 0 && (
        <div className="panel rise absolute bottom-full mb-2 w-64 p-1.5">
          {matches.map((m, i) => (
            <button
              type="button"
              key={m.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(m.name);
              }}
              className={cx('flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm', i === active ? 'bg-ink text-on-ink' : 'hover:bg-sunken')}
            >
              <Avatar name={m.name} src={m.avatarUrl} size={22} /> {m.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-[22px] bg-sunken p-1.5 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--ink)]">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          dir="auto"
          placeholder={placeholder}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-3 py-1.5 text-sm [field-sizing:content] focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label={t('chat.send')} className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-on-ink transition active:scale-95 disabled:opacity-30">
          {busy ? <Spinner /> : <Icon name="send" size={16} className="rtl:-scale-x-100" />}
        </button>
      </div>
    </form>
  );
}

function ThreadPanel({ id, channel, members, onClose }: { id: string; channel: Channel; members: Member[]; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const thread = useThread(id);
  const send = async (text: string, mentionIds: string[]) => {
    await post(`/channels/${channel.id}/messages`, { text, mentionIds, parentId: id });
    qc.invalidateQueries({ queryKey: ['thread', id] });
    qc.invalidateQueries({ queryKey: ['messages', channel.id] });
  };
  return (
    <aside className="panel rise fixed inset-2 z-40 flex flex-col overflow-hidden xl:static xl:inset-auto xl:z-auto xl:w-[360px]">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="message" size={17} />
        <h3 className="flex-1 font-semibold">{t('chat.thread')}</h3>
        <IconButton icon="close" label="close" onClick={onClose} className="size-8" />
      </header>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {thread.data ? (
          <>
            <MessageRow message={thread.data.root} grouped={false} members={members} inThread />
            <div className="my-3 flex items-center gap-2 px-3 text-[11px] text-muted">
              <Pill>{t('chat.replies', { n: thread.data.replies.length })}</Pill>
              <span className="h-px flex-1 bg-line" />
            </div>
            {thread.data.replies.map((r, i) => (
              <MessageRow key={r.id} message={r} grouped={i > 0 && thread.data!.replies[i - 1].author.id === r.author.id} members={members} inThread />
            ))}
          </>
        ) : (
          <Spinner />
        )}
      </div>
      <Composer placeholder={t('chat.reply')} members={members} onSend={send} compact />
    </aside>
  );
}

function NewChannel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [emoji, setEmoji] = useState('💬');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ch = await post<Channel>(`/workspaces/${workspace!.id}/channels`, { name: name.trim(), topic: topic.trim() || undefined, emoji });
    await qc.invalidateQueries({ queryKey: ['channels'] });
    onCreated(ch.id);
    onClose();
  };
  return (
    <Dialog onClose={onClose} label={t('chat.newChannel')}>
      <form onSubmit={submit} className="flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">{t('chat.newChannel')}</h2>
        <div className="flex gap-1.5">
          {['💬', '🚀', '🎨', '🐞', '📣', '☕', '🧠', '🎯'].map((e) => (
            <button type="button" key={e} onClick={() => setEmoji(e)} className={cx('grid size-10 place-items-center rounded-[12px] text-lg', emoji === e ? 'bg-ink' : 'bg-sunken')}>
              {e}
            </button>
          ))}
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('chat.channelName')} autoFocus maxLength={40} />
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('chat.topic')} maxLength={200} />
        <Button type="submit" variant="ink" disabled={!name.trim()}>
          {t('chat.create')}
        </Button>
      </form>
    </Dialog>
  );
}
