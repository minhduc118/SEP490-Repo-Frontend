// ─── TeamSpec — Tailwind style tokens & helpers ──────────────────────────────
import type { ComplianceResult } from '../types';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type Tone = 'pass' | 'warn' | 'fail' | 'accent' | 'gray';

export const TONE_TEXT: Record<Tone, string> = {
  pass: 'text-emerald-600',
  warn: 'text-amber-600',
  fail: 'text-rose-600',
  accent: 'text-indigo-700',
  gray: 'text-zinc-500',
};

export const TONE_BG: Record<Tone, string> = {
  pass: 'bg-emerald-500',
  warn: 'bg-amber-500',
  fail: 'bg-rose-500',
  accent: 'bg-indigo-500',
  gray: 'bg-zinc-600',
};

export const BADGE_TONES: Record<Tone, string> = {
  pass: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25',
  warn: 'bg-amber-500/10 text-amber-700 ring-amber-500/25',
  fail: 'bg-rose-500/10 text-rose-700 ring-rose-500/25',
  accent: 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/25',
  gray: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
};

export function scoreTone(score: number): Tone {
  return score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail';
}

export const FIELD =
  'h-9 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-500 ' +
  'transition-colors focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export const inputClass = cn(FIELD, 'h-10 w-full px-3');

export const table = {
  wrap: '-mx-5 overflow-x-auto scrollbar-thin',
  table: 'w-full border-collapse text-sm',
  th: 'whitespace-nowrap border-b border-zinc-200 px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500',
  thSortable: 'cursor-pointer select-none hover:text-zinc-700',
  td: 'border-b border-zinc-100 px-5 py-3 align-middle',
  row: 'cursor-pointer transition-colors hover:bg-zinc-50',
  rowBlocked: 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08]',
};

// ─── Compliance filters ───────────────────────────────────────────────────────
export function isBlocked(compliance: ComplianceResult): boolean {
  return compliance.violations.some(v => v.severity === 'critical');
}

export function matchesScoreFilter(compliance: ComplianceResult, filter: string): boolean {
  const { score } = compliance;
  switch (filter) {
    case 'excellent': return score >= 90;
    case 'good': return score >= 70 && score < 90;
    case 'poor': return score < 70;
    case 'blocked': return isBlocked(compliance);
    default: return true;
  }
}
