// ─── TeamSpec — UI primitives (Tailwind) ─────────────────────────────────────
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { BADGE_TONES, FIELD, cn, type Tone } from '../lib/styles';

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({
  tone = 'gray', children, title, className,
}: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/[0.07] bg-zinc-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">{children}</h2>
      {extra && <div className="text-xs text-zinc-500">{extra}</div>}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'link';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'h-9 px-4 rounded-lg bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-400 disabled:bg-indigo-500/50',
  outline: 'h-9 px-3.5 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]',
  ghost: 'h-9 px-3 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
  link: 'text-indigo-300 hover:text-indigo-200 hover:underline underline-offset-2',
};

export function Button({
  variant = 'outline', className, type = 'button', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

// ─── Inputs ───────────────────────────────────────────────────────────────────
export function SearchInput({
  value, onChange, placeholder, className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative min-w-[200px] flex-1', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
        viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
      >
        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z" clipRule="evenodd" />
      </svg>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={cn(FIELD, 'w-full pl-9 pr-8')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Xóa"
          className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function Select({
  value, onChange, children, className,
}: { value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(FIELD, 'cursor-pointer px-3 pr-8 [&>option]:bg-zinc-900', className)}
    >
      {children}
    </select>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon, title, sub, children,
}: { icon: ReactNode; title?: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-white/5 text-2xl">{icon}</div>
      {title && <div className="text-sm font-semibold text-zinc-200">{title}</div>}
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  onClose, children, className,
}: { onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex max-h-[85vh] w-full animate-pop-in flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Đóng (Esc)"
      className="grid size-8 cursor-pointer place-items-center rounded-lg text-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100"
    >
      ×
    </button>
  );
}
