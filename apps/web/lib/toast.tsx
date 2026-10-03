'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  text: string;
  icon?: string;
}

const ToastContext = createContext<(text: string, icon?: string) => void>(() => {});

let seq = 0;

/** Black-pill toasts stacked at the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const show = useCallback((text: string, icon?: string) => {
    const id = ++seq;
    setItems((prev) => [...prev.slice(-2), { id, text, icon }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="rise pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2.5 ps-3 pe-5 text-sm text-on-ink shadow-panel">
            <span className="grid size-7 place-items-center rounded-full bg-warn text-white">{t.icon ?? '🔔'}</span>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
