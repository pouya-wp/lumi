'use client';

import { useMutation } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, post } from '@/lib/api';
import { useT } from '@/lib/i18n-client';
import { MarkdownLite } from '@/lib/markdown-lite';
import { useAiStatus } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Avatar, Button, cx, Icon, IconButton } from '../ui';
import { Dialog } from '../ui/dialog';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const AiContext = createContext<{ open: (prompt?: string) => void }>({ open: () => {} });
export const useAiPanel = () => useContext(AiContext);

/** Reveals text progressively so answers feel alive. */
function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) {
      onDone?.();
      return;
    }
    const id = setTimeout(() => setN((x) => Math.min(text.length, x + Math.max(2, Math.round(text.length / 120)))), 16);
    return () => clearTimeout(id);
  }, [n, text, onDone]);
  return <MarkdownLite text={text.slice(0, n)} />;
}

export function AiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; prompt?: string }>({ open: false });
  return (
    <AiContext.Provider value={{ open: (prompt) => setState({ open: true, prompt }) }}>
      {children}
      {state.open && <AiPanel initialPrompt={state.prompt} onClose={() => setState({ open: false })} />}
    </AiContext.Provider>
  );
}

function AiPanel({ initialPrompt, onClose }: { initialPrompt?: string; onClose: () => void }) {
  const { t, raw } = useT();
  const { workspace, user } = useSession();
  const status = useAiStatus().data;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (history: Msg[]) => post<{ reply: string }>(`/workspaces/${workspace!.id}/ai/chat`, { messages: history }),
    onSuccess: (r, history) => {
      setMessages([...history, { role: 'assistant', content: r.reply }]);
      setTyping(history.length);
    },
    onError: (e: Error, history) => {
      setMessages([...history, { role: 'assistant', content: e instanceof ApiError && e.status === 503 ? t('ai.disabled') : `⚠️ ${e.message}` }]);
    },
  });

  const send = (content: string) => {
    if (!content.trim() || ask.isPending) return;
    const history = [...messages, { role: 'user' as const, content: content.trim() }];
    setMessages(history);
    setText('');
    ask.mutate(history);
  };

  useEffect(() => {
    if (initialPrompt) send(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ask.isPending]);

  return (
    <Dialog side onClose={onClose} label={t('ai.assistant')} className="!max-w-xl">
      <div className="flex h-full flex-col">
        <header className="relative overflow-hidden border-b border-line px-5 py-4">
          <div className="pointer-events-none absolute -top-20 -end-10 size-60 rounded-full bg-lumi/25 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[14px] bg-ink text-on-ink">
              <Icon name="sparkle" size={18} />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{t('ai.assistant')}</p>
              <p className="text-[11px] text-muted">{status?.enabled ? status.model : t('ai.disabled').split('.')[0]}</p>
            </div>
            {messages.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
                {t('ai.new')}
              </Button>
            )}
            <IconButton icon="close" label={t('common.close')} onClick={onClose} />
          </div>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="float text-5xl">✨</span>
              <p className="mt-4 text-lg font-semibold">{t('ai.ask')}</p>
              <div className="mt-6 grid w-full gap-2">
                {raw<string[]>('ai.suggestions').map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-[16px] bg-sunken px-4 py-3 text-start text-sm shadow-[inset_0_0_0_1px_var(--line)] transition hover:-translate-y-px hover:shadow-panel">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={cx('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                {m.role === 'user' ? (
                  <Avatar name={user?.name ?? '?'} size={30} />
                ) : (
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-ink text-on-ink">
                    <Icon name="sparkle" size={14} />
                  </span>
                )}
                <div className={cx('max-w-[85%] rounded-[18px] px-4 py-3 text-sm', m.role === 'user' ? 'rounded-se-sm bg-ink text-on-ink' : 'rounded-ss-sm bg-sunken shadow-[inset_0_0_0_1px_var(--line)]')}>
                  {m.role === 'assistant' && i === typing ? <Typewriter text={m.content} onDone={() => setTyping(-1)} /> : <MarkdownLite text={m.content} />}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <span className="grid size-[30px] place-items-center rounded-full bg-ink text-on-ink">
                  <Icon name="sparkle" size={14} className="animate-spin [animation-duration:3s]" />
                </span>
                <span className="light-sweep font-medium">{t('ai.thinking')}</span>
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="border-t border-line p-4"
        >
          <div className="flex items-end gap-2 rounded-[20px] bg-sunken p-2 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--lumi)]">
            <textarea
              autoFocus
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              placeholder={t('ai.placeholder')}
              className="field-sizing-content max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted"
            />
            <Button type="submit" variant="ink" size="sm" disabled={!text.trim() || ask.isPending} className="!size-9 !p-0">
              <Icon name="arrowUp" size={16} />
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
