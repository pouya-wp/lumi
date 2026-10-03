'use client';

import { Extension, Node, mergeAttributes, type Editor, type Range } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, ReactRenderer, type NodeViewProps } from '@tiptap/react';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from 'react';
import { get } from '@/lib/api';
import { useTask } from '@/lib/queries';
import { useUi } from '@/lib/ui-state';
import type { Member, Task } from '@/lib/types';
import { Avatar, cx, PriorityGlyph, StatusDot } from '../ui';

/* ---------- Callout ---------- */

const CALLOUT_EMOJIS = ['💡', '⚠️', '✅', '📌', '🎯', '🔥', '❓', '✨'];

function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const emoji = (node.attrs.emoji as string) ?? '💡';
  return (
    <NodeViewWrapper className="my-2 flex gap-3 rounded-[16px] bg-sunken p-4 shadow-[inset_0_0_0_1px_var(--line)]">
      <button
        contentEditable={false}
        disabled={!editor.isEditable}
        onClick={() => updateAttributes({ emoji: CALLOUT_EMOJIS[(CALLOUT_EMOJIS.indexOf(emoji) + 1) % CALLOUT_EMOJIS.length] })}
        className="h-7 shrink-0 text-xl leading-none select-none"
      >
        {emoji}
      </button>
      <NodeViewContent className="min-w-0 flex-1 [&>p]:my-0" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return { emoji: { default: '💡' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

/* ---------- Live task chip ---------- */

function TaskRefView({ node }: NodeViewProps) {
  const id = node.attrs.id as string;
  const task = useTask(id);
  const { openTask } = useUi();
  const t = task.data;
  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      <button
        contentEditable={false}
        onClick={() => openTask(id)}
        className={cx(
          'mx-0.5 inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-0.5 text-[0.85em] shadow-[inset_0_0_0_1px_var(--line)] transition hover:bg-line',
          t?.status.category === 'DONE' && 'text-muted line-through',
        )}
      >
        {t ? (
          <>
            <StatusDot color={t.status.color} category={t.status.category} size={8} />
            <span className="text-[10px] text-muted" dir="ltr">
              {t.key}
            </span>
            {t.title}
            <PriorityGlyph priority={t.priority} size={10} />
          </>
        ) : (
          <span className="text-muted">{(node.attrs.label as string) || '…'}</span>
        )}
      </button>
    </NodeViewWrapper>
  );
}

export const TaskRef = Node.create({
  name: 'taskRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { id: { default: null }, label: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'span[data-task-ref]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-task-ref': '' })];
  },
  renderText({ node }) {
    return `#${node.attrs.label}`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(TaskRefView);
  },
});

/* ---------- Suggestion popup plumbing ---------- */

export interface MenuItem {
  id: string;
  title: string;
  hint?: string;
  icon: ReactNode;
  group?: string;
  run: (editor: Editor, range: Range) => void;
}

interface MenuHandle {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean;
}

const SuggestionMenu = forwardRef<MenuHandle, SuggestionProps<MenuItem>>(function SuggestionMenu({ items, command, clientRect }, ref) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [items]);
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        setActive((a) => (a + 1) % Math.max(1, items.length));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((a) => (a - 1 + items.length) % Math.max(1, items.length));
        return true;
      }
      if (event.key === 'Enter') {
        if (items[active]) command(items[active]);
        return true;
      }
      return false;
    },
  }));
  const rect = clientRect?.();
  if (!rect || !items.length) return null;
  const below = rect.bottom + 320 < window.innerHeight;
  let lastGroup: string | undefined;
  return (
    <div
      className="panel rise fixed z-[70] max-h-80 w-72 overflow-y-auto p-1.5"
      style={{ left: Math.min(rect.left, window.innerWidth - 300), top: below ? rect.bottom + 8 : undefined, bottom: below ? undefined : window.innerHeight - rect.top + 8 }}
    >
      {items.map((item, i) => {
        const header = item.group && item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        return (
          <div key={item.id}>
            {header && <p className="px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted uppercase">{header}</p>}
            <button
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                command(item);
              }}
              className={cx('flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-start text-sm', i === active ? 'bg-ink text-on-ink' : 'text-ink-2')}
            >
              <span className={cx('grid size-8 shrink-0 place-items-center rounded-[10px] text-base', i === active ? 'bg-on-ink/15' : 'bg-sunken')}>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.title}</span>
                {item.hint && <span className="block truncate text-[11px] opacity-60">{item.hint}</span>}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});

function renderMenu(): SuggestionOptions<MenuItem>['render'] {
  return () => {
    let component: ReactRenderer<MenuHandle, SuggestionProps<MenuItem>> | null = null;
    return {
      onStart: (props) => {
        component = new ReactRenderer(SuggestionMenu, { props, editor: props.editor });
        document.body.appendChild(component.element);
        // The suggestion decoration is not in the DOM yet on start, so measure again next frame.
        requestAnimationFrame(() => component?.updateProps({ ...props }));
      },
      onUpdate: (props) => component?.updateProps(props),
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          component?.destroy();
          component?.element.remove();
          component = null;
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        component?.destroy();
        component?.element.remove();
        component = null;
      },
    };
  };
}

/* ---------- Slash commands ---------- */

export function slashItems(t: (k: string) => string): MenuItem[] {
  const block = (id: string, icon: ReactNode, run: MenuItem['run']): MenuItem => ({ id, title: t(`docs.blocks.${id}`), hint: t(`docs.hints.${id}`), icon, run, group: t('docs.basic') });
  return [
    block('text', '¶', (e, r) => e.chain().focus().deleteRange(r).setParagraph().run()),
    block('h1', 'H1', (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run()),
    block('h2', 'H2', (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run()),
    block('h3', 'H3', (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run()),
    block('todo', '☑', (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run()),
    block('bullet', '•', (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run()),
    block('numbered', '1.', (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run()),
    block('quote', '❝', (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run()),
    block('callout', '💡', (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'callout', attrs: { emoji: '💡' }, content: [{ type: 'paragraph' }] }).run()),
    block('code', '</>', (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run()),
    block('divider', '—', (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run()),
    block('table', '▦', (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
  ];
}

export const SlashCommand = Extension.create<{ t: (k: string) => string; extra: () => MenuItem[] }>({
  name: 'slashCommand',
  addOptions() {
    return { t: (k) => k, extra: () => [] };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<MenuItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => {
          const all = [...slashItems(this.options.t), ...this.options.extra()];
          const q = query.toLowerCase();
          return all.filter((i) => !q || i.title.toLowerCase().includes(q) || i.id.includes(q)).slice(0, 14);
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: renderMenu(),
      }),
    ];
  },
});

/* ---------- @ mentions: people and tasks ---------- */

export function createMentions(opts: { members: () => Member[]; workspaceId: () => string | undefined; t: (k: string) => string }) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    renderText: ({ node }) => `@${node.attrs.label}`,
    suggestion: {
      char: '@',
      items: async ({ query }): Promise<MenuItem[]> => {
        const q = query.toLowerCase();
        const people: MenuItem[] = opts
          .members()
          .filter((m) => !q || m.name.toLowerCase().includes(q))
          .slice(0, 5)
          .map((m) => ({
            id: `u:${m.id}`,
            title: m.name,
            icon: <Avatar name={m.name} size={22} />,
            group: opts.t('docs.people'),
            run: (editor, range) => editor.chain().focus().deleteRange(range).insertContent([{ type: 'mention', attrs: { id: m.id, label: m.name } }, { type: 'text', text: ' ' }]).run(),
          }));
        const wid = opts.workspaceId();
        let tasks: Task[] = [];
        if (wid && q.length > 0) tasks = (await get<{ tasks: Task[] }>(`/workspaces/${wid}/search?q=${encodeURIComponent(query)}`).catch(() => ({ tasks: [] }))).tasks;
        return [
          ...people,
          ...tasks.slice(0, 6).map((task) => ({
            id: `t:${task.id}`,
            title: task.title,
            hint: task.key,
            icon: <StatusDot color={task.status.color} category={task.status.category} />,
            group: opts.t('docs.tasks'),
            run: (editor: Editor, range: Range) =>
              editor.chain().focus().deleteRange(range).insertContent([{ type: 'taskRef', attrs: { id: task.id, label: task.title } }, { type: 'text', text: ' ' }]).run(),
          })),
        ];
      },
      command: ({ editor, range, props }) => (props as unknown as MenuItem).run(editor, range),
      render: renderMenu() as never,
    },
  });
}
