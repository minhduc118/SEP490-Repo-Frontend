// ─── TeamSpec — Tailwind style tokens & helpers ──────────────────────────────
import type { ComplianceResult } from '../types';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export type Tone = 'pass' | 'warn' | 'fail' | 'accent' | 'gray';

export const TONE_TEXT: Record<Tone, string> = {
  pass: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-rose-400',
  accent: 'text-indigo-300',
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
  pass: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
  warn: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
  fail: 'bg-rose-500/10 text-rose-300 ring-rose-500/25',
  accent: 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/25',
  gray: 'bg-white/5 text-zinc-300 ring-white/10',
};

export function scoreTone(score: number): Tone {
  return score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail';
}

export const FIELD =
  'h-9 rounded-lg border border-white/10 bg-zinc-900/80 text-sm text-zinc-100 placeholder:text-zinc-500 ' +
  'transition-colors focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export const inputClass = cn(FIELD, 'h-10 w-full px-3');

export const table = {
  wrap: '-mx-5 overflow-x-auto scrollbar-thin',
  table: 'w-full border-collapse text-sm',
  th: 'whitespace-nowrap border-b border-white/[0.06] px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500',
  thSortable: 'cursor-pointer select-none hover:text-zinc-300',
  td: 'border-b border-white/[0.04] px-5 py-3 align-middle',
  row: 'cursor-pointer transition-colors hover:bg-white/[0.03]',
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
