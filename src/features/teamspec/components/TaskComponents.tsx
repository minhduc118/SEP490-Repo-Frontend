// ─── TeamSpec — Task / approval components ───────────────────────────────────
import type { ChangeWithCompliance, NextAction, StageResult, TaskItem } from '../types';
import { requirementCoverage, WORKFLOW_STAGES } from '../lib/compliance';
import { TONE_BG, TONE_TEXT, cn, type Tone } from '../lib/styles';
import { Badge } from './ui';

// ─── Task progress ────────────────────────────────────────────────────────────
export function TaskProgressCell({ tasks }: { tasks?: { done: number; total: number } }) {
  if (!tasks) return <span className="text-[11px] text-zinc-400">chưa có tasks.md</span>;
  if (tasks.total === 0) return <Badge tone="warn">0 task</Badge>;
  const pct = Math.round((tasks.done / tasks.total) * 100);
  const tone: Tone = pct === 100 ? 'pass' : pct > 0 ? 'accent' : 'gray';
  return (
    <div className="flex min-w-[96px] flex-col gap-1">
      <span className={cn('text-[11px] tabular-nums', TONE_TEXT[tone])}>{tasks.done}/{tasks.total} task</span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full rounded-full', TONE_BG[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Requirement coverage ─────────────────────────────────────────────────────
export function CoverageBadge({ change }: { change: Pick<ChangeWithCompliance, 'requirements' | 'taskItems'> }) {
  const { requirements, uncovered, covered } = requirementCoverage(change);
  if (requirements.length === 0 || !change.taskItems) return null;
  return (
    <Badge
      tone={uncovered.length === 0 ? 'pass' : 'warn'}
      title={uncovered.length ? `Chưa có task: ${uncovered.join(', ')}` : 'Mọi REQ trong specs.md đều có task'}
    >
      REQ {covered}/{requirements.length}
    </Badge>
  );
}

export function ReqChip({ id, missing }: { id: string; missing?: boolean }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-inset',
        missing ? 'bg-amber-500/10 text-amber-700 ring-amber-500/25' : 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/20',
      )}
    >
      {id}
    </span>
  );
}

// ─── Task list ────────────────────────────────────────────────────────────────
export function TaskRow({ task, unknownReqs }: { task: TaskItem; unknownReqs?: Set<string> }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded text-[10px] font-bold',
          task.done ? 'bg-emerald-500 text-white' : 'border border-zinc-300 text-transparent',
        )}
      >
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <span className={cn('text-[13px] leading-snug', task.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-800')}>
          {task.id && <span className="mr-1.5 font-mono text-xs font-semibold text-zinc-600 no-underline">{task.id}</span>}
          {task.title}
        </span>
        {task.reqs.length > 0 && (
          <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
            {task.reqs.map(r => <ReqChip key={r} id={r} missing={unknownReqs?.has(r)} />)}
          </span>
        )}
      </div>
    </li>
  );
}

/** Tasks grouped by the heading they sit under in tasks.md */
export function TaskList({ tasks, knownReqs }: { tasks: TaskItem[]; knownReqs?: string[] }) {
  const groups = new Map<string, TaskItem[]>();
  for (const t of tasks) {
    const key = t.section ?? '';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const known = knownReqs && knownReqs.length > 0 ? new Set(knownReqs) : undefined;
  const unknownReqs = known && new Set(tasks.flatMap(t => t.reqs).filter(r => !known.has(r)));

  return (
    <div className="flex flex-col gap-3">
      {[...groups].map(([section, items]) => (
        <div key={section || '_'}>
          {section && (
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <span>{section}</span>
              <span className="tabular-nums">{items.filter(t => t.done).length}/{items.length}</span>
            </div>
          )}
          <ul className="divide-y divide-zinc-100">
            {items.map((t, i) => <TaskRow key={`${t.id ?? ''}-${i}`} task={t} unknownReqs={unknownReqs} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RequirementCoverageList({ change }: { change: ChangeWithCompliance }) {
  const { requirements, byReq, uncovered } = requirementCoverage(change);
  if (requirements.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        specs.md chưa khai báo <code className="font-mono text-zinc-600">REQ-xx</code> nên chưa đối chiếu được task với requirement.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {!change.taskItems && <p className="text-xs text-amber-700">Chưa có tasks.md — mọi requirement đều chưa có task.</p>}
      <ul className="flex flex-col gap-1.5">
        {requirements.map(r => {
          const tasks = byReq.get(r) ?? [];
          const done = tasks.filter(t => t.done).length;
          return (
            <li key={r} className="flex items-center gap-2 text-xs">
              <ReqChip id={r} missing={tasks.length === 0} />
              {tasks.length === 0 ? (
                <span className="text-amber-700">chưa có task</span>
              ) : (
                <span className="truncate text-zinc-600" title={tasks.map(t => t.id ?? t.title).join(', ')}>
                  {tasks.map(t => t.id ?? '•').join(', ')} · <span className={done === tasks.length ? 'text-emerald-600' : ''}>{done}/{tasks.length} xong</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {uncovered.length > 0 && change.taskItems && (
        <p className="text-[11px] text-zinc-500">Bổ sung task cho các REQ trên rồi lưu lại tasks.md (sep_luu_artifact).</p>
      )}
    </div>
  );
}

// ─── Approvals ────────────────────────────────────────────────────────────────
export function ApprovalBadge({ sr }: { sr: StageResult }) {
  if (sr.approval === undefined) return null;
  const rejected = sr.rejections ? ` · bị từ chối ${sr.rejections} lần` : '';
  if (sr.approval) {
    return (
      <Badge tone="pass" title={`Duyệt bởi @${sr.approval.by} · ${formatDate(sr.approval.at)}${rejected}`}>
        👍 @{sr.approval.by}
      </Badge>
    );
  }
  if (!sr.passed) return sr.rejections ? <Badge tone="fail">❌ {sr.rejections}×</Badge> : null;
  return <Badge tone="warn" title={`Đủ artifact, chưa được duyệt${rejected}`}>⏳ Chờ duyệt</Badge>;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Next action ──────────────────────────────────────────────────────────────
export function NextActionHint({ action, changeName, compact }: { action: NextAction | null; changeName: string; compact?: boolean }) {
  if (!action) return <span className="text-xs text-emerald-600">🎉 Hoàn tất 6 bước</span>;
  const label = WORKFLOW_STAGES.find(s => s.key === action.stage)?.label ?? action.stage;
  if (action.kind === 'approve') {
    return (
      <span className="text-xs text-amber-700" title="Leader/user Approve hoặc Reject rồi agent gọi sep_duyet_buoc">
        ⏳ Chờ duyệt bước {label}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-zinc-600" title={action.gap}>
      <code className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-indigo-700">
        {action.command}{compact ? '' : ` ${changeName}`}
      </code>
      {!compact && <span className="text-zinc-500">— {action.gap}</span>}
    </span>
  );
}
