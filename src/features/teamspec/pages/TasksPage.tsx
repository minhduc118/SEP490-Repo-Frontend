// ─── TeamSpec Monitor — Tasks theo từng spec ─────────────────────────────────
import { useMemo, useState } from 'react';
import { MOCK_CHANGES } from '../lib/mockData';
import { useChanges } from '../lib/api';
import { useAuthStore } from '../lib/authStore';
import { requirementCoverage } from '../lib/compliance';
import { AssigneeCell, FilterCount, MyChangesToggle, StageBadge, StageOptions } from '../components/SharedComponents';
import { CoverageBadge, NextActionHint, TaskList, TaskProgressCell } from '../components/TaskComponents';
import { Button, Card, EmptyState, PageHeader, SearchInput, Select } from '../components/ui';
import { TONE_TEXT, cn, isBlocked, type Tone } from '../lib/styles';
import type { ChangeWithCompliance, TaskItem } from '../types';

interface Props {
  onSelectChange: (name: string) => void;
  useApi?: boolean;
}

type StatusFilter = 'all' | 'todo' | 'done' | 'issues';

/** Change should already have tasks.md (verify-spec reached or later steps started) */
function expectsTasks(c: ChangeWithCompliance): boolean {
  return c.compliance.stageResults.slice(0, 2).every(sr => sr.passed);
}

function problems(c: ChangeWithCompliance): string[] {
  const out: string[] = [];
  if (!c.taskItems && expectsTasks(c)) out.push('thiếu tasks.md');
  if (c.taskItems && c.taskItems.length === 0) out.push('tasks.md không có checklist');
  const { uncovered } = requirementCoverage(c);
  if (c.taskItems && uncovered.length) out.push(`${uncovered.length} REQ chưa có task`);
  if (c.stage === 'test' || c.stage === 'archived') {
    const left = (c.tasks?.total ?? 0) - (c.tasks?.done ?? 0);
    if (left > 0) out.push(`${left} task chưa tick nhưng đã ở bước ${c.stage}`);
  }
  if (isBlocked(c.compliance)) out.push('BLOCKED');
  return out;
}

function matchesTask(t: TaskItem, q: string): boolean {
  return !q || t.title.toLowerCase().includes(q) || (t.id ?? '').toLowerCase().includes(q)
    || (t.section ?? '').toLowerCase().includes(q) || t.reqs.some(r => r.toLowerCase().includes(q));
}

export function TasksPage({ onSelectChange, useApi = false }: Props) {
  const { data: apiChanges, isLoading } = useChanges();
  const allChanges: ChangeWithCompliance[] = useApi && apiChanges ? apiChanges : MOCK_CHANGES;
  const login = useAuthStore(s => s.user?.login);

  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const assignees = useMemo(
    () => [...new Set(allChanges.map(c => c.assignee || 'unassigned'))].sort(),
    [allChanges],
  );

  const allTasks = allChanges.flatMap(c => c.taskItems ?? []);
  const doneTasks = allTasks.filter(t => t.done).length;
  const uncoveredReqs = allChanges.reduce((n, c) => n + (c.taskItems ? requirementCoverage(c).uncovered.length : 0), 0);
  const summary: { label: string; value: string | number; tone: Tone; hint?: string }[] = [
    { label: 'Tổng task', value: allTasks.length, tone: 'accent' },
    {
      label: 'Đã xong',
      value: `${doneTasks}${allTasks.length ? ` · ${Math.round((doneTasks / allTasks.length) * 100)}%` : ''}`,
      tone: 'pass',
    },
    { label: 'Thiếu tasks.md', value: allChanges.filter(c => !c.taskItems && expectsTasks(c)).length, tone: 'fail', hint: 'Đã qua Brainstorm nhưng chưa có tasks.md' },
    { label: 'REQ chưa có task', value: uncoveredReqs, tone: 'warn', hint: 'REQ-xx trong specs.md mà không task nào tham chiếu' },
    { label: 'Chờ duyệt', value: allChanges.filter(c => c.compliance.nextAction?.kind === 'approve').length, tone: 'warn' },
  ];

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    return allChanges
      .filter(c => {
        if (mineOnly && c.assignee !== login) return false;
        if (assigneeFilter !== 'all' && (c.assignee || 'unassigned') !== assigneeFilter) return false;
        if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
        if (status === 'issues') return problems(c).length > 0;
        return true;
      })
      .map(c => {
        const nameHit = !!q && c.name.toLowerCase().includes(q);
        const tasks = (c.taskItems ?? []).filter(t =>
          (status === 'todo' ? !t.done : status === 'done' ? t.done : true) && (nameHit || matchesTask(t, q)));
        return { change: c, tasks, nameHit };
      })
      .filter(({ tasks, nameHit }) => {
        if (tasks.length > 0) return true;
        // Keep changes without matching tasks visible unless a task-level filter narrows the list
        if (status === 'todo' || status === 'done') return false;
        return !q || nameHit;
      })
      .sort((a, b) => {
        const pa = problems(a.change).length, pb = problems(b.change).length;
        if (pa !== pb) return pb - pa;
        return a.change.name.localeCompare(b.change.name);
      });
  }, [allChanges, mineOnly, login, assigneeFilter, stageFilter, status, q]);

  const hasFilters = mineOnly || query !== '' || assigneeFilter !== 'all' || stageFilter !== 'all' || status !== 'all';
  function resetFilters() {
    setMineOnly(false); setQuery(''); setAssigneeFilter('all'); setStageFilter('all'); setStatus('all');
  }
  function toggle(name: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Tasks theo spec"
        subtitle="Từng task trong tasks.md của mỗi change — đối chiếu với REQ trong specs.md và 6 bước SEP"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summary.map(s => (
          <div key={s.label} title={s.hint} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <div className={cn('text-2xl font-bold tabular-nums', TONE_TEXT[s.tone])}>{s.value}</div>
            <div className="text-[11px] text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <MyChangesToggle active={mineOnly} count={allChanges.filter(c => c.assignee === login).length} onToggle={() => setMineOnly(v => !v)} />
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm task, mã task, REQ, change..." />
          <Select value={status} onChange={v => setStatus(v as StatusFilter)}>
            <option value="all">Tất cả task</option>
            <option value="todo">☐ Chưa xong</option>
            <option value="done">☑ Đã xong</option>
            <option value="issues">🚨 Change có vấn đề</option>
          </Select>
          <Select value={stageFilter} onChange={setStageFilter}><StageOptions /></Select>
          <Select value={assigneeFilter} onChange={setAssigneeFilter}>
            <option value="all">Tất cả assignee</option>
            {assignees.map(a => <option key={a} value={a}>@{a}</option>)}
          </Select>
          <FilterCount shown={rows.length} total={allChanges.length} onReset={hasFilters ? resetFilters : undefined} />
        </div>
      </Card>

      {useApi && isLoading ? (
        <EmptyState icon="⏳" sub="Đang tải tasks…" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" title="Không có task phù hợp" sub="Thử thay đổi bộ lọc">
            {hasFilters && <Button variant="primary" onClick={resetFilters}>Xóa bộ lọc</Button>}
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ change: c, tasks }) => {
            const issues = problems(c);
            const isCollapsed = collapsed.has(c.name);
            return (
              <Card key={c.name} className={cn('p-0', issues.includes('BLOCKED') && 'border-rose-500/25')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => toggle(c.name)}
                    title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                    className="grid size-6 cursor-pointer place-items-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                  <button type="button" onClick={() => onSelectChange(c.name)} className="min-w-0 cursor-pointer text-left">
                    <div className="truncate font-semibold text-zinc-900 hover:text-indigo-700">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{c.schema ?? 'feature'} · {c.project}</div>
                  </button>
                  <StageBadge stage={c.stage} />
                  <AssigneeCell login={c.assignee} />
                  <div className="w-32"><TaskProgressCell tasks={c.tasks} /></div>
                  <CoverageBadge change={c} />
                  <div className="ml-auto"><NextActionHint action={c.compliance.nextAction} changeName={c.name} compact /></div>
                </div>

                {issues.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-5 py-2">
                    {issues.map(p => (
                      <span key={p} className={cn('rounded-full px-2 py-0.5 text-[11px]', p === 'BLOCKED' ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/10 text-amber-700')}>
                        {p === 'BLOCKED' ? '🚨 BLOCKED — skip bước' : `⚠ ${p}`}
                      </span>
                    ))}
                  </div>
                )}

                {!isCollapsed && (
                  <div className="border-t border-zinc-100 px-5 py-3">
                    {tasks.length > 0 ? (
                      <TaskList tasks={tasks} knownReqs={c.requirements} />
                    ) : (
                      <p className="py-1 text-xs text-zinc-500">
                        {c.taskItems
                          ? 'tasks.md chưa có task dạng “- [ ] …”.'
                          : expectsTasks(c)
                            ? 'Chưa có tasks.md — chạy /sep-verify-spec để review spec và sinh tasks.'
                            : 'Chưa tới bước lập tasks (tasks.md được tạo ở /sep-verify-spec).'}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
