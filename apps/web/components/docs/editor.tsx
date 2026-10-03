'use client';

import { useQueryClient } from '@tanstack/react-query';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import DragHandle from '@tiptap/extension-drag-handle-react';
import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { post } from '@/lib/api';
import { ORIGIN, SocketProvider } from '@/lib/collab';
import { useT } from '@/lib/i18n-client';
import { useProjects, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import type { DocBrief, DocDetail, Project, Task } from '@/lib/types';
import { cx, Icon } from '../ui';
import { Callout, createMentions, SlashCommand, TaskRef, type MenuItem } from './extensions';

export type SyncStatus = 'connecting' | 'synced' | 'offline' | 'saving';
export interface Presence {
  clientId: number;
  name: string;
  color: string;
}
export interface Heading {
  level: number;
  text: string;
  index: number;
}

const CARET_COLORS = ['#4F5BFF', '#F43F5E', '#16A34A', '#F97316', '#8B5CF6', '#0EA5E9'];
const colorFor = (id: string) => CARET_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % CARET_COLORS.length];

/** Opens the Yjs room for a page and renders the editor once the provider exists. */
export function DocEditor(props: { doc: DocDetail; onStatus: (s: SyncStatus) => void; onPresence: (p: Presence[]) => void; onOutline: (h: Heading[], words: number) => void; onEditor?: (e: Editor | null) => void }) {
  const [provider, setProvider] = useState<SocketProvider | null>(null);
  const seed = useRef<(() => void) | null>(null);
  const pendingSeed = useRef(false);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const p = new SocketProvider(props.doc.id, ydoc, () => {
      if (seed.current) seed.current();
      else pendingSeed.current = true;
    });
    setProvider(p);
    return () => {
      p.destroy();
      ydoc.destroy();
      setProvider(null);
    };
  }, [props.doc.id]);

  if (!provider) return <div className="h-64" />;
  return <Inner key={props.doc.id} {...props} provider={provider} seedRef={seed} pendingSeed={pendingSeed} />;
}

function Inner({
  doc,
  provider,
  seedRef,
  pendingSeed,
  onStatus,
  onPresence,
  onOutline,
  onEditor,
}: {
  doc: DocDetail;
  provider: SocketProvider;
  seedRef: React.MutableRefObject<(() => void) | null>;
  pendingSeed: React.MutableRefObject<boolean>;
  onStatus: (s: SyncStatus) => void;
  onPresence: (p: Presence[]) => void;
  onOutline: (h: Heading[], words: number) => void;
  onEditor?: (e: Editor | null) => void;
}) {
  const { t, locale } = useT();
  const { user, workspace } = useSession();
  const ws = useWorkspace(workspace?.id);
  const projects = useProjects(workspace?.id);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  // Extensions read these lazily, so they always see fresh data without re-creating the editor.
  const live = useRef({ members: ws.data?.members ?? [], projects: projects.data ?? [], wid: workspace?.id });
  live.current = { members: ws.data?.members ?? [], projects: projects.data ?? [], wid: workspace?.id };

  const defaultProject = (): Project | undefined => live.current.projects.find((p) => p.id === doc.projectId) ?? live.current.projects[0];

  const createTask = async (title: string, projectId?: string) => {
    const pid = projectId ?? defaultProject()?.id;
    if (!pid) return null;
    const task = await post<Task>(`/projects/${pid}/tasks`, { title: title.slice(0, 300) || t('docs.untitled') });
    qc.invalidateQueries({ queryKey: ['tasks', pid] });
    toast(`${t('docs.taskCreated')} · ${task.key}`);
    return task;
  };

  const extra = (): MenuItem[] => [
    {
      id: 'task',
      title: t('docs.blocks.task'),
      hint: t('docs.hints.task'),
      icon: '◎',
      group: t('docs.basic'),
      run: async (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        const { $from } = editor.state.selection;
        const line = $from.parent.textContent.trim();
        const task = await createTask(line);
        if (!task) return;
        const start = $from.start();
        editor
          .chain()
          .focus()
          .insertContentAt({ from: start, to: start + $from.parent.content.size }, [{ type: 'taskRef', attrs: { id: task.id, label: task.title } }, { type: 'text', text: ' ' }])
          .run();
      },
    },
    {
      id: 'subpage',
      title: t('docs.blocks.subpage'),
      hint: t('docs.hints.subpage'),
      icon: '📄',
      group: t('docs.basic'),
      run: async (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        const page = await post<DocBrief>(`/workspaces/${live.current.wid}/docs`, { parentId: doc.id });
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'text', text: `📄 ${t('docs.untitled')}`, marks: [{ type: 'link', attrs: { href: `/${locale}/app/docs/${page.id}` } }] },
            { type: 'text', text: ' ' },
          ])
          .run();
        qc.invalidateQueries({ queryKey: ['docs'] });
        router.push(`/${locale}/app/docs/${page.id}`);
      },
    },
  ];

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: doc.canEdit,
      extensions: [
        StarterKit.configure({ undoRedo: false, link: { openOnClick: true, autolink: true } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight.configure({ multicolor: false }),
        TableKit.configure({ table: { resizable: false } }),
        Placeholder.configure({
          placeholder: ({ node }) => (node.type.name === 'heading' ? t('docs.blocks.h' + node.attrs.level) : t('docs.placeholder')),
          showOnlyCurrent: true,
        }),
        Callout,
        TaskRef,
        SlashCommand.configure({ t, extra }),
        createMentions({ members: () => live.current.members, workspaceId: () => live.current.wid, t }),
        Collaboration.configure({ document: provider.doc }),
        CollaborationCaret.configure({
          provider,
          user: { name: user?.name ?? '…', color: colorFor(user?.id ?? 'x') },
          render: (u: { name: string; color: string }) => {
            const caret = document.createElement('span');
            caret.className = 'lumi-caret';
            caret.style.setProperty('--c', u.color);
            const label = document.createElement('span');
            label.className = 'lumi-caret-label';
            label.textContent = u.name;
            caret.append(label);
            return caret;
          },
        }),
      ],
      editorProps: { attributes: { class: 'lumi-prose focus:outline-none', dir: 'auto' } },
    },
    [provider],
  );

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  // Seed a brand-new page from its template exactly once (the server picks one client).
  useEffect(() => {
    if (!editor) return;
    seedRef.current = () => editor.commands.setContent(doc.content as never);
    if (pendingSeed.current) {
      pendingSeed.current = false;
      seedRef.current();
    }
    return () => {
      seedRef.current = null;
    };
  }, [editor, doc.content, seedRef, pendingSeed]);

  // Debounced snapshot of local edits: JSON for search/versions, plain text for full-text search.
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      post(`/docs/${doc.id}/snapshot`, { content: editor.getJSON(), text: editor.getText() })
        .then(() => {
          onStatus(provider.status === 'offline' ? 'offline' : 'synced');
          qc.invalidateQueries({ queryKey: ['docs'] });
        })
        .catch(() => onStatus('offline'));
    };
    const onUpdate = (_: Uint8Array, origin: unknown) => {
      if (origin === ORIGIN || !doc.canEdit) return;
      onStatus('saving');
      clearTimeout(timer);
      timer = setTimeout(flush, 1500);
    };
    provider.doc.on('update', onUpdate);
    const off = provider.onStatus((s) => onStatus(s));
    return () => {
      provider.doc.off('update', onUpdate);
      off();
      if (timer) {
        clearTimeout(timer);
        flush();
      }
    };
  }, [editor, provider, doc.id, doc.canEdit, onStatus, qc]);

  // Presence avatars from awareness.
  useEffect(() => {
    const emit = () =>
      onPresence(
        [...provider.awareness.getStates().entries()]
          .filter(([, s]) => s.user)
          .map(([clientId, s]) => ({ clientId, name: s.user.name as string, color: s.user.color as string })),
      );
    provider.awareness.on('change', emit);
    emit();
    return () => provider.awareness.off('change', emit);
  }, [provider, onPresence]);

  // Outline + word count.
  useEffect(() => {
    if (!editor) return;
    const emit = () => {
      const heads: Heading[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') heads.push({ level: node.attrs.level, text: node.textContent, index: heads.length });
        return node.type.name !== 'heading';
      });
      const text = editor.getText().trim();
      onOutline(heads, text ? text.split(/\s+/).length : 0);
    };
    emit();
    editor.on('update', emit);
    return () => {
      editor.off('update', emit);
    };
  }, [editor, onOutline]);

  if (!editor) return <div className="h-64" />;
  return (
    <div className="relative">
      {doc.canEdit && (
        <DragHandle editor={editor} computePositionConfig={{ placement: locale === 'fa' ? 'right-start' : 'left-start', strategy: 'absolute' }}>
          <span className="grid h-6 w-5 cursor-grab place-items-center rounded-md text-muted hover:bg-sunken">
            <Icon name="grip" size={16} strokeWidth={3} />
          </span>
        </DragHandle>
      )}
      <Bubble editor={editor} projects={projects.data ?? []} createTask={createTask} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Bubble({ editor, projects, createTask }: { editor: Editor; projects: Project[]; createTask: (title: string, projectId?: string) => Promise<Task | null> }) {
  const { t } = useT();
  const [picking, setPicking] = useState(false);
  const mark = (name: string, label: string, run: () => void, cls = '') => (
    <button
      key={name}
      onMouseDown={(e) => {
        e.preventDefault();
        run();
      }}
      className={cx('grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm transition', editor.isActive(name) ? 'bg-on-ink text-ink' : 'hover:bg-on-ink/15', cls)}
    >
      {label}
    </button>
  );

  const toTask = async (projectId: string) => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ').trim();
    setPicking(false);
    const task = await createTask(text, projectId);
    if (task) editor.chain().focus().insertContentAt({ from, to }, { type: 'taskRef', attrs: { id: task.id, label: task.title } }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, from, to }) => e.isEditable && from !== to && !e.isActive('taskRef')}
      options={{ placement: 'top', offset: 8, onHide: () => setPicking(false) }}
    >
      <div className="flex items-center gap-0.5 rounded-full bg-ink p-1 text-on-ink shadow-[0_18px_40px_-12px_rgb(0_0_0/.5)]">
        {picking ? (
          <>
            <span className="px-2 text-[11px] opacity-60">{t('docs.pickProject')}</span>
            {projects.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toTask(p.id);
                }}
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs hover:bg-on-ink/15"
              >
                {p.icon ?? '◆'} {p.name}
              </button>
            ))}
          </>
        ) : (
          <>
            {mark('bold', 'B', () => editor.chain().focus().toggleBold().run(), 'font-bold')}
            {mark('italic', 'I', () => editor.chain().focus().toggleItalic().run(), 'italic')}
            {mark('strike', 'S', () => editor.chain().focus().toggleStrike().run(), 'line-through')}
            {mark('code', '</>', () => editor.chain().focus().toggleCode().run(), 'text-xs')}
            {mark('highlight', '✦', () => editor.chain().focus().toggleHighlight().run())}
            {mark('heading', 'H', () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            <span className="mx-1 h-5 w-px bg-on-ink/20" />
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (projects.length <= 1) toTask(projects[0]?.id);
                else setPicking(true);
              }}
              className="flex h-8 items-center gap-1.5 rounded-full bg-lumi px-3 text-xs font-medium text-white"
            >
              <Icon name="checkCircle" size={14} /> {t('docs.toTask')}
            </button>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
