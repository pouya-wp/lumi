'use client';

import type { Priority } from '@lumi/shared';
import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { num, useT } from '@/lib/i18n-client';
import { Icon } from './icons';

export { Icon, type IconName } from './icons';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'ink' | 'lumi' | 'soft' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-on-ink hover:opacity-90 shadow-panel',
  lumi: 'bg-lumi text-white shadow-[0_10px_24px_-10px_var(--lumi)] hover:brightness-110',
  soft: 'bg-sunken text-ink hover:bg-line/70 shadow-[inset_0_0_0_1px_var(--line)]',
  ghost: 'text-ink-2 hover:bg-sunken',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }
>(function Button({ variant = 'soft', size = 'md', loading, className, children, disabled, ...props }, ref) {
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-[15px] gap-2' };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium transition duration-200 ease-[var(--ease-lumi)] active:scale-[.97] disabled:pointer-events-none disabled:opacity-50',
        sizes[size],
        buttonStyles[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
});

export function IconButton({ icon, label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: Parameters<typeof Icon>[0]['name']; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('grid size-9 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-sunken active:scale-95', className)}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-e-transparent', className)} />;
}

export function Panel({
  className,
  aurora,
  aurora2,
  auroraSide = 'end',
  style,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { aurora?: string; aurora2?: string; auroraSide?: 'start' | 'end' }) {
  const vars = {
    ...(aurora ? { '--aurora': aurora } : {}),
    ...(aurora2 ? { '--aurora-2': aurora2 } : {}),
    '--ax': auroraSide === 'end' ? '0%' : '100%',
    ...style,
  } as CSSProperties;
  return (
    <div className={cx('panel', aurora && 'aurora', className)} style={vars} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({ icon, title, children }: { icon?: Parameters<typeof Icon>[0]['name']; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon && (
        <span className="grid size-9 place-items-center rounded-full bg-panel text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">
          <Icon name={icon} size={17} />
        </span>
      )}
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="ms-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}

const pillTones = {
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-sunken text-ink-2',
  ink: 'bg-ink text-on-ink',
  lumi: 'bg-lumi/12 text-lumi',
} as const;

export function Pill({ tone = 'neutral', className, children }: { tone?: keyof typeof pillTones; className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium', pillTones[tone], className)}>{children}</span>;
}

/** Percentage change pill: green up, orange down. */
export function Delta({ value }: { value: number }) {
  const { locale } = useT();
  const up = value >= 0;
  return (
    <Pill tone={up ? 'success' : 'warn'} className="tabular-nums" >
      <span dir="ltr">{up ? '+' : ''}{num(value, locale)}%</span>
    </Pill>
  );
}

const avatarHues = ['#4F5BFF', '#F43F5E', '#16A34A', '#F97316', '#8B5CF6', '#0EA5E9', '#EAB308'];

export function Avatar({ name, src, size = 28, ring }: { name: string; src?: string | null; size?: number; ring?: boolean }) {
  const hue = avatarHues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarHues.length];
  const initials = name.trim().split(/\s+/).map((p) => [...p][0]).slice(0, 2).join('');
  return (
    <span
      className={cx('inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white', ring && 'ring-2 ring-panel')}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${hue}, color-mix(in oklab, ${hue} 60%, #000))` }}
      title={name}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = 28 }: { users: { id: string; name: string; avatarUrl?: string | null }[]; max?: number; size?: number }) {
  const { locale } = useT();
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="flex items-center -space-x-2 rtl:space-x-reverse">
      {shown.map((u) => (
        <Avatar key={u.id} name={u.name} src={u.avatarUrl} size={size} ring />
      ))}
      {rest > 0 && (
        <span className="grid place-items-center rounded-full bg-sunken text-[11px] font-medium text-ink-2 ring-2 ring-panel" style={{ width: size, height: size }}>
          +{num(rest, locale)}
        </span>
      )}
    </span>
  );
}

const priorityColor: Record<Priority, string> = {
  URGENT: 'var(--danger)',
  HIGH: 'var(--warn)',
  MEDIUM: 'var(--lumi)',
  LOW: 'var(--muted)',
  NONE: 'var(--line)',
};

/** Signal-bars glyph; urgent shows a filled alert square. */
export function PriorityGlyph({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const { t } = useT();
  const color = priorityColor[priority];
  if (priority === 'URGENT') {
    return (
      <span title={t('priority.URGENT')} className="grid shrink-0 place-items-center rounded-[4px] font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.7 }}>
        !
      </span>
    );
  }
  const level = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }[priority];
  return (
    <span title={t(`priority.${priority}`)} className="flex shrink-0 items-end gap-[2px]" style={{ height: size, width: size }}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="flex-1 rounded-[1.5px]" style={{ height: `${30 + i * 23}%`, background: i <= level ? color : 'var(--line)' }} />
      ))}
    </span>
  );
}

export function StatusDot({ color, category, size = 10 }: { color: string; category?: string; size?: number }) {
  if (category === 'IN_PROGRESS') return <span className="pulse shrink-0" style={{ background: color, width: size - 2, height: size - 2 }} />;
  if (category === 'DONE') {
    return (
      <span className="grid shrink-0 place-items-center rounded-full text-white" style={{ width: size + 2, height: size + 2, background: color }}>
        <Icon name="check" size={size - 2} strokeWidth={3} />
      </span>
    );
  }
  return <span className="shrink-0 rounded-full border-2" style={{ width: size, height: size, borderColor: color }} />;
}

/** Round checkbox with completion bloom. */
export function CheckCircle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  const [bloom, setBloom] = useState(false);
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (!checked) setBloom(true);
        onChange(!checked);
      }}
      onAnimationEnd={() => setBloom(false)}
      className={cx(
        'grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition duration-200',
        checked ? 'border-success bg-success text-white' : 'border-muted/60 hover:border-success',
        bloom && 'bloom',
      )}
    >
      {checked && <Icon name="check" size={12} strokeWidth={3} />}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: Parameters<typeof Icon>[0]['name'] }>(
  function Input({ className, icon, ...props }, ref) {
    return (
      <label className={cx('flex h-11 items-center gap-2 rounded-[14px] bg-sunken px-3.5 text-sm shadow-[inset_0_0_0_1px_var(--line)] transition focus-within:shadow-[inset_0_0_0_1.5px_var(--lumi)]', className)}>
        {icon && <Icon name={icon} size={17} className="text-muted" />}
        <input ref={ref} className="h-full w-full bg-transparent outline-none placeholder:text-muted" {...props} />
      </label>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx('w-full resize-none rounded-[14px] bg-sunken p-3.5 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none transition placeholder:text-muted focus:shadow-[inset_0_0_0_1.5px_var(--lumi)]', className)}
      {...props}
    />
  );
});

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-sunken p-1 shadow-[inset_0_0_0_1px_var(--line)]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition duration-200',
            o.value === value ? 'bg-ink text-on-ink shadow-panel' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md bg-panel px-1.5 py-0.5 font-sans text-[10px] text-muted shadow-[inset_0_0_0_1px_var(--line)]">{children}</kbd>;
}

export function Empty({ emoji, text, children }: { emoji: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="float text-4xl" style={{ '--r': '-6deg' } as CSSProperties}>
        {emoji}
      </span>
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}

/** Animated number that rolls in when it changes. */
export function Odometer({ value, className }: { value: number | string; className?: string }) {
  const { locale } = useT();
  const text = num(value, locale);
  return (
    <span className={cx('inline-flex tabular-nums', className)} dir="ltr">
      {[...text].map((ch, i) => (
        <span key={`${text}-${i}`} className="roll" style={{ animationDelay: `${i * 45}ms` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
