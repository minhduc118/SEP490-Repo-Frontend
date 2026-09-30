// ─── TeamSpec — Shared UI Components ─────────────────────────────────────────
import type { ArtifactStatus, ComplianceResult, StageResult } from '../types';
import { WORKFLOW_STAGES } from '../lib/compliance';
import { TONE_BG, cn, scoreTone, type Tone } from '../lib/styles';
import { Badge } from './ui';

// ─── Score Badge ─────────────────────────────────────────────────────────────
export function ScoreBadge({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <Badge tone={tone}>
      <span className={cn('size-1.5 rounded-full', TONE_BG[tone])} />
      {score}%
    </Badge>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE_BG[scoreTone(value)])}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function ComplianceCell({ compliance }: { compliance: ComplianceResult }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tabular-nums text-zinc-500">
          {compliance.stagesPassed}/{compliance.stagesTotal} bước
        </span>
        <ScoreBadge score={compliance.score} />
      </div>
      <ProgressBar value={compliance.score} />
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

export function Avatar({ login, src, size = 'sm' }: { login: string; src?: string; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'size-9 text-xs' : 'size-7 text-[10px]';
  if (src) return <img src={src} alt={login} title={`@${login}`} className={cn(dim, 'rounded-full ring-1 ring-zinc-200')} />;
  const color = AVATAR_COLORS[[...login].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      title={`@${login}`}
      className={cn(dim, 'inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ring-1 ring-zinc-200', color)}
    >
      {login.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function AssigneeCell({ login }: { login?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar login={login || '?'} />
      <span className="text-xs text-zinc-600">@{login || 'unassigned'}</span>
    </div>
  );
}

// ─── Stage badge ──────────────────────────────────────────────────────────────
const STAGE_TONES: Record<string, Tone> = {
  spec: 'gray', brainstorm: 'accent', 'verify-spec': 'accent',
  apply: 'warn', test: 'warn', archived: 'pass',
};

export function StageBadge({ stage }: { stage: string }) {
  const info = WORKFLOW_STAGES.find(s => s.key === stage);
  return (
    <Badge tone={STAGE_TONES[stage] ?? 'gray'} title={info?.command}>
      {info?.icon} {info?.label || stage}
    </Badge>
  );
}

// ─── Violation status ─────────────────────────────────────────────────────────
export function ViolationBadges({ compliance }: { compliance: ComplianceResult }) {
  const critical = compliance.violations.filter(v => v.severity === 'critical').length;
  const warn = compliance.violations.length - critical;
  if (compliance.violations.length === 0) return <Badge tone="pass">✓ Clean</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {critical > 0 && <Badge tone="fail">🚨 {critical} critical</Badge>}
      {warn > 0 && <Badge tone="warn">⚠ {warn} warn</Badge>}
    </div>
  );
}

export function BlockedDot() {
  return (
    <span className="relative flex size-2 shrink-0" title="BLOCKED">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
    </span>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export function StageOptions() {
  return (
    <>
      <option value="all">Tất cả bước</option>
      {WORKFLOW_STAGES.map(s => (
        <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
      ))}
    </>
  );
}

export function ScoreOptions() {
  return (
    <>
      <option value="all">Tất cả score</option>
      <option value="excellent">✅ Excellent (≥90%)</option>
      <option value="good">⚡ Good (70–89%)</option>
      <option value="poor">📉 Poor (&lt;70%)</option>
      <option value="blocked">🚨 Blocked only</option>
    </>
  );
}

export function FilterCount({ shown, total, onReset }: { shown: number; total: number; onReset?: () => void }) {
  return (
    <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-xs tabular-nums text-zinc-500">
      {shown} / {total}
      {onReset && (
        <button type="button" onClick={onReset} className="cursor-pointer text-indigo-700 hover:text-indigo-700">
          Reset
        </button>
      )}
    </span>
  );
}

// ─── My Changes Toggle ────────────────────────────────────────────────────────
export function MyChangesToggle({
  active, count, onToggle,
}: { active: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title="Chỉ hiện changes được giao cho bạn"
      className={cn(
        'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-700'
          : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100',
      )}
    >
      📌 My Changes
      <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-indigo-500/30' : 'bg-zinc-200')}>
        {count}
      </span>
    </button>
  );
}

// ─── Mode Badge ───────────────────────────────────────────────────────────────
export function ModeBadge({ mode }: { mode: string }) {
  return (
    <Badge tone="gray">
      {mode === 'full' ? '⚡ Full' : mode === 'fast' ? '🚀 Fast' : '🔧 Minimal'}
    </Badge>
  );
}

// ─── Workflow Timeline ────────────────────────────────────────────────────────
function stepState(sr: StageResult): 'passed' | 'critical' | 'warning' | 'pending' {
  if (sr.passed) return 'passed';
  if (sr.violation?.severity === 'critical') return 'critical';
  if (sr.violation) return 'warning';
  return 'pending';
}

const STEP_DOT: Record<ReturnType<typeof stepState>, string> = {
  passed: 'bg-emerald-500 text-white ring-emerald-500/30',
  critical: 'bg-rose-500 text-white ring-rose-500/30',
  warning: 'bg-amber-500 text-zinc-950 ring-amber-500/30 animate-pulse',
  pending: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
};

export function WorkflowTimeline({ stageResults }: { stageResults: StageResult[] }) {
  return (
    <ol className="flex items-start overflow-x-auto pb-1 scrollbar-thin">
      {stageResults.map((sr, i) => {
        const info = WORKFLOW_STAGES.find(s => s.key === sr.stage);
        const state = stepState(sr);
        return (
          <li key={sr.stage} className="relative flex min-w-[92px] flex-1 flex-col items-center text-center" title={sr.violation?.message}>
            {i > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2',
                  stageResults[i - 1].passed ? 'bg-emerald-500/60' : 'bg-zinc-200',
                )}
              />
            )}
            <span className={cn('relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold ring-4', STEP_DOT[state])}>
              {state === 'passed' ? '✓' : state === 'critical' ? '✕' : state === 'warning' ? '!' : info?.icon}
            </span>
            <span className={cn('mt-2 text-xs font-medium', state === 'pending' ? 'text-zinc-500' : 'text-zinc-800')}>
              {sr.label}
            </span>
            <code className="mt-0.5 font-mono text-[10px] text-zinc-500">{info?.command}</code>
            {sr.approval !== undefined && (
              <span
                className={cn('mt-1 text-[10px]', sr.approval ? 'text-emerald-600' : sr.passed ? 'text-amber-700' : 'text-zinc-400')}
                title={sr.approval ? `Duyệt bởi @${sr.approval.by}` : sr.passed ? 'Chờ user duyệt' : 'Cần duyệt sau khi xong'}
              >
                {sr.approval ? `👍 @${sr.approval.by}` : sr.passed ? '⏳ chờ duyệt' : '○ cần duyệt'}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Artifact List ────────────────────────────────────────────────────────────
export function ArtifactList({
  compliance,
  extra = [],
  onViewArtifact,
}: {
  compliance: ComplianceResult;
  /** Optional files that exist — listed after the required ones */
  extra?: ArtifactStatus[];
  onViewArtifact?: (artifact: ArtifactStatus) => void;
}) {
  const allArtifacts = [...compliance.stageResults.flatMap(sr => sr.artifacts), ...extra];

  return (
    <ul className="flex flex-col gap-1.5">
      {allArtifacts.map(art => {
        const canView = art.exists && !!onViewArtifact;
        return (
          <li key={art.file}>
            <button
              type="button"
              disabled={!canView}
              onClick={canView ? () => onViewArtifact(art) : undefined}
              title={canView ? 'Click để xem nội dung' : art.exists ? art.file : 'File chưa tồn tại'}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                art.exists
                  ? 'border-zinc-200 bg-zinc-50'
                  : 'border-dashed border-rose-500/25 bg-rose-500/[0.03]',
                canView && 'cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/[0.06]',
              )}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-md text-xs', art.exists ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600')}>
                {art.exists ? '✓' : '✕'}
              </span>
              <span className={cn('truncate font-mono text-xs', art.exists ? 'text-zinc-800' : 'text-zinc-500')}>{art.file}</span>
              {extra.includes(art) && <Badge tone="gray">phụ</Badge>}
              {art.author && <span className="ml-auto shrink-0 text-[11px] text-zinc-500">@{art.author}</span>}
              {canView && (
                <span className={cn('shrink-0 text-xs text-indigo-700 opacity-0 transition-opacity group-hover:opacity-100', !art.author && 'ml-auto')}>
                  Xem →
                </span>
              )}
              {!art.exists && <Badge tone="fail" className="ml-auto">MISSING</Badge>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Violation List ───────────────────────────────────────────────────────────
export function ViolationList({ compliance }: { compliance: ComplianceResult }) {
  if (compliance.violations.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.07] px-3 py-2.5 text-sm text-emerald-700">
        ✓ Không có vi phạm — tuân thủ đúng workflow
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {compliance.violations.map((v, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed',
            v.severity === 'critical'
              ? 'border-rose-500/25 bg-rose-500/[0.07] text-rose-700'
              : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-700',
          )}
        >
          <span>{v.severity === 'critical' ? '🚨' : '⚠️'}</span>
          <span>{v.message}</span>
        </div>
      ))}
    </div>
  );
}
