'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COVER_KEYS, COVERS, PAGE_EMOJIS } from '@/components/docs/covers';
import { DocEditor, type Heading, type Presence, type SyncStatus } from '@/components/docs/editor';
import { useCreateDoc } from '@/components/docs/use-create-doc';
import { Avatar, Button, cx, Empty, Icon, IconButton, Pill, Spinner } from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { del, patch } from '@/lib/api';
import { formatDate, formatTime, timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useDoc, useDocVersions, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import type { DocDetail } from '@/lib/types';

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const doc = useDoc(docId);
  const { t, locale } = useT();

  if (doc.isError) {
    return (
      <div className="grid h-96 place-items-center">
        <Empty emoji="🫥" text="404">
          <Link href={`/${locale}/app/docs`}>
            <Button>{t('docs.title')}</Button>
          </Link>
        </Empty>
      </div>
    );
  }
  if (!doc.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }
  return <Page key={doc.data.id} doc={doc.data} />;
}

function Page({ doc }: { doc: DocDetail }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { create } = useCreateDoc();

  const [status, setStatus] = useState<SyncStatus>('connecting');
  const [presence, setPresence] = useState<Presence[]>([]);
  const [outline, setOutline] = useState<{ heads: Heading[]; words: number }>({ heads: [], words: 0 });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState(doc.title);
  const [icon, setIcon] = useState(doc.icon);
  const [cover, setCover] = useState(doc.cover);
  const [fullWidth, setFullWidth] = useState(doc.fullWidth);
  const [picker, setPicker] = useState<'icon' | 'cover' | null>(null);
  const [menu, setMenu] = useState(false);
  const [versions, setVersions] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = useCallback(
    async (body: Record<string, unknown>) => {
      await patch(`/docs/${doc.id}`, body);
      qc.invalidateQueries({ queryKey: ['docs'] });
    },
    [doc.id, qc],
  );

  const onTitle = (v: string) => {
    setTitle(v);
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => save({ title: v }), 500);
  };
  useEffect(() => () => clearTimeout(titleTimer.current), []);
  useEffect(() => {
    document.title = `${icon ?? ''} ${title || t('docs.untitled')} · Lumi`;
  }, [title, icon, t]);

  const onOutline = useCallback((heads: Heading[], words: number) => setOutline({ heads, words }), []);
  const jump = (index: number) => {
    const el = editor?.view.dom.querySelectorAll('h1,h2,h3')[index];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const remove = async () => {
    await del(`/docs/${doc.id}`);
    qc.invalidateQueries({ queryKey: ['docs'] });
    toast(t('docs.deleted'));
    router.push(doc.parentId ? `/${locale}/app/docs/${doc.parentId}` : `/${locale}/app/docs`);
  };

  const editedBy = doc.people.find((p) => p.id === doc.updatedById)?.name ?? doc.people.find((p) => p.id === doc.createdById)?.name ?? '';
  const statusLabel = !doc.canEdit ? t('docs.readOnly') : status === 'saving' || status === 'connecting' ? t('docs.syncing') : status === 'offline' ? t('docs.offline') : t('docs.saved');

  return (
    <div className="rise -mx-1 flex min-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-[var(--radius-panel)] bg-panel shadow-[var(--shadow-panel),inset_0_0_0_1px_var(--line)]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-panel/85 px-4 py-2.5 backdrop-blur-md">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted">
          <Link href={`/${locale}/app/docs`} className="rounded-full px-2 py-1 hover:bg-sunken hover:text-ink">
            {t('nav2.docs')}
          </Link>
          {doc.breadcrumbs.map((b) => (
            <span key={b.id} className="flex min-w-0 items-center gap-1">
              <span className="opacity-50">/</span>
              <Link href={`/${locale}/app/docs/${b.id}`} className="truncate rounded-full px-2 py-1 hover:bg-sunken hover:text-ink">
                {b.icon} {b.title || t('docs.untitled')}
              </Link>
            </span>
          ))}
          <span className="opacity-50">/</span>
          <span className="truncate px-1 text-ink">{title || t('docs.untitled')}</span>
        </nav>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className={cx('size-1.5 rounded-full', status === 'offline' ? 'bg-danger' : status === 'synced' ? 'bg-success' : 'pulse bg-warn')} />
          {statusLabel}
        </span>
        <div className="flex ps-1" title={t('docs.here')}>
          {presence.slice(0, 5).map((p) => (
            <span key={p.clientId} className="-ms-1.5 rounded-full ring-2 ring-panel first:ms-0" style={{ boxShadow: `0 0 0 3.5px ${p.color}` }} title={p.name}>
              <Avatar name={p.name} size={26} />
            </span>
          ))}
        </div>
        <IconButton icon="history" label={t('docs.versions')} onClick={() => setVersions(true)} className="size-8" />
        <div className="relative">
          <IconButton icon="more" label="more" onClick={() => setMenu(!menu)} className="size-8" />
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="panel rise absolute end-0 z-20 mt-2 w-56 p-1.5 text-sm">
                <button
                  onClick={() => {
                    setFullWidth(!fullWidth);
                    save({ fullWidth: !fullWidth });
                    setMenu(false);
                  }}
                  className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 hover:bg-sunken"
                >
                  {t('docs.fullWidth')}
                  <span className={cx('h-4 w-7 rounded-full p-0.5 transition', fullWidth ? 'bg-ink' : 'bg-line')}>
                    <span className={cx('block size-3 rounded-full bg-panel transition', fullWidth && 'translate-x-3 rtl:-translate-x-3')} />
                  </span>
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    create('blank', doc.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 hover:bg-sunken"
                >
                  <Icon name="plus" size={15} /> {t('docs.blocks.subpage')}
                </button>
                {doc.canEdit && (
                  <button onClick={remove} className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-danger hover:bg-danger-soft">
                    <Icon name="trash" size={15} /> {t('docs.delete')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cover */}
      {cover && COVERS[cover] ? (
        <div className="group relative h-44 shrink-0 md:h-56" style={{ background: COVERS[cover] }}>
          {doc.canEdit && (
            <div className="absolute end-4 bottom-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
              <Button size="sm" variant="soft" className="!bg-panel/80 backdrop-blur" onClick={() => setPicker('cover')}>
                {t('docs.addCover')}
              </Button>
              <Button
                size="sm"
                variant="soft"
                className="!bg-panel/80 backdrop-blur"
                onClick={() => {
                  setCover(null);
                  save({ cover: null });
                }}
              >
                {t('docs.removeCover')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="h-10 shrink-0 md:h-16" />
      )}

      <div className="flex flex-1 gap-8 px-5 md:px-10">
        <article className={cx('mx-auto w-full min-w-0 flex-1 pb-10', fullWidth ? 'max-w-none' : 'max-w-[760px]')}>
          {/* Icon + meta actions */}
          <div className={cx('group relative', cover ? '-mt-11' : '')}>
            <button
              disabled={!doc.canEdit}
              onClick={() => setPicker(picker === 'icon' ? null : 'icon')}
              className="grid size-20 place-items-center rounded-[22px] bg-panel text-5xl shadow-[var(--shadow-panel),inset_0_0_0_1px_var(--line)] transition hover:-rotate-6 hover:scale-105"
            >
              {icon ?? '📄'}
            </button>
            {picker === 'icon' && (
              <div className="panel rise absolute top-24 z-30 grid w-72 grid-cols-6 gap-1 p-2">
                {PAGE_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setIcon(e);
                      save({ icon: e });
                      setPicker(null);
                    }}
                    className="grid size-10 place-items-center rounded-[10px] text-xl hover:bg-sunken"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            {picker === 'cover' && (
              <div className="panel rise absolute top-24 z-30 grid w-80 grid-cols-3 gap-2 p-2">
                {COVER_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setCover(k);
                      save({ cover: k });
                      setPicker(null);
                    }}
                    className={cx('h-14 rounded-[12px] transition hover:scale-105', cover === k && 'ring-2 ring-ink')}
                    style={{ background: COVERS[k] }}
                  />
                ))}
              </div>
            )}
            {!cover && doc.canEdit && (
              <button
                onClick={() => setPicker('cover')}
                className="mt-3 flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted opacity-0 transition group-hover:opacity-100 hover:bg-sunken"
              >
                🖼️ {t('docs.addCover')}
              </button>
            )}
          </div>

          <textarea
            value={title}
            readOnly={!doc.canEdit}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                editor?.commands.focus('start');
              }
            }}
            rows={1}
            placeholder={t('docs.titlePh')}
            dir="auto"
            className="mt-4 w-full resize-none overflow-hidden bg-transparent text-[40px] leading-tight font-bold [field-sizing:content] placeholder:text-line focus:outline-none"
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {editedBy && <span>{t('docs.editedBy', { name: editedBy, when: timeAgo(doc.updatedAt, locale) })}</span>}
            <span className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-line" />
              {t('docs.words', { n: outline.words })}
            </span>
          </p>

          {doc.kind === 'MEETING' && <MeetingMeta doc={doc} members={members} save={save} />}

          <div className="mt-6">
            <DocEditor doc={doc} onStatus={setStatus} onPresence={setPresence} onOutline={onOutline} onEditor={setEditor} />
          </div>

          {doc.children.length > 0 && (
            <div className="mt-4 border-t border-line pt-5">
              <p className="mb-3 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">{t('docs.subpages')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {doc.children.map((c) => (
                  <Link key={c.id} href={`/${locale}/app/docs/${c.id}`} className="flex items-center gap-3 rounded-[16px] p-3 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-sunken">
                    <span className="text-xl">{c.icon ?? '📄'}</span>
                    <span className="truncate text-sm">{c.title || t('docs.untitled')}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Outline rail */}
        {!fullWidth && outline.heads.length > 1 && (
          <aside className="sticky top-20 hidden h-fit w-52 shrink-0 pt-24 2xl:block">
            <p className="mb-3 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">{t('docs.outline')}</p>
            <ol className="flex flex-col gap-0.5 border-s border-line">
              {outline.heads.map((h) => (
                <li key={h.index}>
                  <button
                    onClick={() => jump(h.index)}
                    className="-ms-px block w-full truncate border-s border-transparent py-1 text-start text-xs text-muted transition hover:border-ink hover:text-ink"
                    style={{ paddingInlineStart: `${(h.level - 1) * 12 + 12}px` }}
                  >
                    {h.text || '—'}
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      {versions && <VersionsDialog docId={doc.id} editor={editor} onClose={() => setVersions(false)} canEdit={doc.canEdit} />}
    </div>
  );
}

function MeetingMeta({ doc, members, save }: { doc: DocDetail; members: { id: string; name: string; avatarUrl: string | null }[]; save: (b: Record<string, unknown>) => Promise<void> }) {
  const { t, locale } = useT();
  const [at, setAt] = useState(doc.meetingAt);
  const [attendees, setAttendees] = useState(doc.attendeeIds);
  const setDate = (iso: string | null) => {
    if (!iso) return;
    const d = new Date(iso);
    const prev = at ? new Date(at) : new Date();
    d.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    setAt(d.toISOString());
    save({ meetingAt: d.toISOString() });
  };
  const setTime = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    const d = at ? new Date(at) : new Date();
    d.setHours(h, m, 0, 0);
    setAt(d.toISOString());
    save({ meetingAt: d.toISOString() });
  };
  const toggle = (id: string) => {
    const next = attendees.includes(id) ? attendees.filter((x) => x !== id) : [...attendees, id];
    setAttendees(next);
    save({ attendeeIds: next });
  };
  const hhmm = at ? `${String(new Date(at).getHours()).padStart(2, '0')}:${String(new Date(at).getMinutes()).padStart(2, '0')}` : '';

  return (
    <div className="mt-5 grid gap-2 rounded-[20px] bg-sunken p-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] sm:grid-cols-[120px_1fr]">
      <span className="flex items-center gap-2 text-muted">
        <Icon name="calendar" size={15} /> {t('docs.meetingAt')}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={at}
          onChange={setDate}
          trigger={<span className="rounded-full bg-panel px-3 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{at ? formatDate(at, locale, { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</span>}
        />
        <input
          type="time"
          value={hhmm}
          onChange={(e) => setTime(e.target.value)}
          dir="ltr"
          className="rounded-full bg-panel px-3 py-1 shadow-[inset_0_0_0_1px_var(--line)] focus:outline-none"
          aria-label={at ? formatTime(at, locale) : t('docs.meetingAt')}
        />
      </div>
      <span className="flex items-center gap-2 text-muted">
        <Icon name="users" size={15} /> {t('docs.attendees')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {members.map((m) => {
          const on = attendees.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={cx('flex items-center gap-1.5 rounded-full py-0.5 ps-0.5 pe-3 text-xs transition', on ? 'bg-ink text-on-ink' : 'bg-panel text-muted shadow-[inset_0_0_0_1px_var(--line)]')}
            >
              <Avatar name={m.name} src={m.avatarUrl} size={22} /> {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VersionsDialog({ docId, editor, onClose, canEdit }: { docId: string; editor: Editor | null; onClose: () => void; canEdit: boolean }) {
  const { t, locale } = useT();
  const toast = useToast();
  const versions = useDocVersions(docId);
  const [pick, setPick] = useState<number>(0);
  const list = versions.data ?? [];
  const v = list[pick];
  const preview = v ? textOf(v.content) : [];

  return (
    <Dialog onClose={onClose} side label={t('docs.versions')}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <Icon name="history" />
          <h2 className="flex-1 font-semibold">{t('docs.versions')}</h2>
          <IconButton icon="close" label="close" onClick={onClose} />
        </div>
        {list.length === 0 ? (
          <Empty emoji="🕰️" text={t('docs.noVersions')} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr]">
            <ol className="overflow-y-auto border-e border-line p-2">
              {list.map((x, i) => (
                <li key={x.id}>
                  <button onClick={() => setPick(i)} className={cx('w-full rounded-[12px] px-3 py-2 text-start text-sm', i === pick ? 'bg-ink text-on-ink' : 'hover:bg-sunken')}>
                    <span className="block">{formatDate(x.createdAt, locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[11px] opacity-60">{x.author?.name}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex min-h-0 flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-2xl font-bold">{v?.title}</h3>
                <div className="mt-4 flex flex-col gap-2 text-sm leading-7 text-ink-2">
                  {preview.map((line, i) => (
                    <p key={i} className={cx(line.h && 'text-base font-semibold text-ink')}>
                      {line.text}
                    </p>
                  ))}
                </div>
              </div>
              {canEdit && v && (
                <div className="border-t border-line p-3">
                  <Button
                    variant="ink"
                    className="w-full"
                    disabled={!editor}
                    onClick={() => {
                      editor?.commands.setContent(v.content as never);
                      toast(t('docs.restored'));
                      onClose();
                    }}
                  >
                    {t('docs.restore')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        <p className="border-t border-line p-3 text-center text-[11px] text-muted">{num(list.length, locale)} · {t('docs.versions')}</p>
      </div>
    </Dialog>
  );
}

/** Flattens TipTap JSON to lines for a lightweight read-only preview. */
function textOf(node: Record<string, unknown>): { text: string; h: boolean }[] {
  const out: { text: string; h: boolean }[] = [];
  const walk = (n: Record<string, unknown>): string => {
    if (n.type === 'text') return (n.text as string) ?? '';
    if (n.type === 'mention' || n.type === 'taskRef') return `@${(n.attrs as { label?: string })?.label ?? ''}`;
    const kids = (n.content as Record<string, unknown>[] | undefined) ?? [];
    if (['paragraph', 'heading'].includes(n.type as string)) {
      out.push({ text: kids.map(walk).join(''), h: n.type === 'heading' });
      return '';
    }
    kids.forEach(walk);
    return '';
  };
  walk(node);
  return out.filter((l) => l.text.trim());
}
