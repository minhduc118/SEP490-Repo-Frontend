// ─── TeamSpec Monitor — Changes List Page ────────────────────────────────────
import { useState, useMemo } from 'react';
import { MOCK_CHANGES } from '../lib/mockData';
import {
  AssigneeCell, BlockedDot, ComplianceCell, FilterCount, MyChangesToggle, ScoreOptions,
  StageBadge, StageOptions, ViolationBadges,
} from '../components/SharedComponents';
import { CoverageBadge, NextActionHint, TaskProgressCell } from '../components/TaskComponents';
import { Button, Card, EmptyState, PageHeader, SearchInput, Select } from '../components/ui';
import { TONE_TEXT, cn, isBlocked, matchesScoreFilter, table, type Tone } from '../lib/styles';
import { useChanges } from '../lib/api';
import { useAuthStore } from '../lib/authStore';
import type { ChangeWithCompliance } from '../types';

interface Props {
  onSelectChange: (name: string) => void;
  useApi?: boolean;
}

type SortKey = 'name' | 'score' | 'stage' | 'assignee' | 'startedAt';
type SortDir = 'asc' | 'desc';

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV(changes: ChangeWithCompliance[]) {
  const header = ['Name', 'Assignee', 'Stage', 'Schema', 'Mode', 'Score', 'Tasks Done', 'Tasks Total', 'Violations', 'Started At'];
  const rows = changes.map(c => [
    c.name,
    c.assignee || 'unassigned',
    c.stage,
    c.schema ?? 'feature',
    c.mode,
    `${c.compliance.score}%`,
    c.tasks?.done ?? '',
    c.tasks?.total ?? '',
    c.compliance.violations.length,
    c.startedAt ? new Date(c.startedAt).toLocaleDateString('vi-VN') : '',
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teamspec-changes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortableTh({
  label, sortKey, current, dir, onSort,
}: { label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = current === sortKey;
  return (
    <th className={cn(table.th, table.thSortable)} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? 'text-indigo-700' : 'text-zinc-400'}>{active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}</span>
      </span>
    </th>
  );
}

export function ChangesListPage({ onSelectChange, useApi = false }: Props) {
  const { data: apiChanges } = useChanges();
  const allChanges: ChangeWithCompliance[] = useApi && apiChanges ? apiChanges : MOCK_CHANGES;
  const login = useAuthStore(s => s.user?.login);
  const [mineOnly, setMineOnly] = useState(false);
  const myCount = allChanges.filter(c => c.assignee === login).length;

  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const assignees = useMemo(
    () => [...new Set(allChanges.map(c => c.assignee || 'unassigned'))].sort(),
    [allChanges]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const list = allChanges.filter(c => {
      if (mineOnly && c.assignee !== login) return false;
      const matchQuery = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.assignee || '').toLowerCase().includes(q) ||
        (c.project || '').toLowerCase().includes(q);
      const matchStage = stageFilter === 'all' || c.stage === stageFilter;
      const matchAssignee = assigneeFilter === 'all' || (c.assignee || 'unassigned') === assigneeFilter;
      return matchQuery && matchStage && matchAssignee && matchesScoreFilter(c.compliance, scoreFilter);
    });

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'score') cmp = a.compliance.score - b.compliance.score;
      else if (sortKey === 'stage') cmp = a.stage.localeCompare(b.stage);
      else if (sortKey === 'assignee') cmp = (a.assignee || '').localeCompare(b.assignee || '');
      else if (sortKey === 'startedAt') cmp = (a.startedAt || '').localeCompare(b.startedAt || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allChanges, query, stageFilter, assigneeFilter, scoreFilter, sortKey, sortDir, mineOnly, login]);

  const hasFilters = query !== '' || stageFilter !== 'all' || assigneeFilter !== 'all' || scoreFilter !== 'all' || mineOnly;

  function resetFilters() {
    setQuery(''); setStageFilter('all'); setAssigneeFilter('all'); setScoreFilter('all'); setMineOnly(false);
  }

  const summary: { label: string; value: number; tone: Tone }[] = [
    { label: 'Total', value: allChanges.length, tone: 'accent' },
    { label: 'Passed (≥90%)', value: allChanges.filter(c => c.compliance.score >= 90).length, tone: 'pass' },
    { label: 'Warning', value: allChanges.filter(c => c.compliance.score >= 70 && c.compliance.score < 90).length, tone: 'warn' },
    { label: 'Blocked', value: allChanges.filter(c => isBlocked(c.compliance)).length, tone: 'fail' },
  ];
  const sortProps = { current: sortKey, dir: sortDir, onSort: handleSort };

  return (
    <div>
      <PageHeader
        title="All Changes"
        subtitle={`Tất cả OpenSpec changes — ${allChanges.length} changes · MT-GRMS`}
        actions={<Button variant="primary" onClick={() => exportCSV(filtered)}>⬇ Export CSV</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map(stat => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <div className={cn('text-2xl font-bold tabular-nums', TONE_TEXT[stat.tone])}>{stat.value}</div>
            <div className="text-[11px] text-zinc-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MyChangesToggle active={mineOnly} count={myCount} onToggle={() => setMineOnly(v => !v)} />
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm change, assignee, project..." />
          <Select value={stageFilter} onChange={setStageFilter}><StageOptions /></Select>
          <Select value={assigneeFilter} onChange={setAssigneeFilter}>
            <option value="all">Tất cả assignee</option>
            {assignees.map(a => <option key={a} value={a}>@{a}</option>)}
          </Select>
          <Select value={scoreFilter} onChange={setScoreFilter}><ScoreOptions /></Select>
          <FilterCount shown={filtered.length} total={allChanges.length} onReset={hasFilters ? resetFilters : undefined} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="🔍" title="Không có kết quả" sub="Thử thay đổi bộ lọc">
            <Button variant="primary" onClick={resetFilters}>Xóa bộ lọc</Button>
          </EmptyState>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <SortableTh label="Change" sortKey="name" {...sortProps} />
                  <SortableTh label="Bước" sortKey="stage" {...sortProps} />
                  <SortableTh label="Assignee" sortKey="assignee" {...sortProps} />
                  <SortableTh label="Compliance" sortKey="score" {...sortProps} />
                  <th className={table.th}>Tasks</th>
                  <th className={table.th}>Violations</th>
                  <th className={table.th}>Việc tiếp theo</th>
                  <SortableTh label="Started" sortKey="startedAt" {...sortProps} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const blocked = isBlocked(c.compliance);
                  return (
                    <tr key={c.name} onClick={() => onSelectChange(c.name)} className={cn(table.row, blocked && table.rowBlocked)}>
                      <td className={table.td}>
                        <div className="flex items-center gap-2.5">
                          {blocked && <BlockedDot />}
                          <div>
                            <div className="font-semibold text-zinc-900">{c.name}</div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">{c.project} · {c.schema ?? 'feature'} · {c.mode} mode</div>
                          </div>
                        </div>
                      </td>
                      <td className={table.td}><StageBadge stage={c.stage} /></td>
                      <td className={table.td}><AssigneeCell login={c.assignee} /></td>
                      <td className={table.td}><ComplianceCell compliance={c.compliance} /></td>
                      <td className={table.td}>
                        <div className="flex items-center gap-2">
                          <TaskProgressCell tasks={c.tasks} />
                          <CoverageBadge change={c} />
                        </div>
                      </td>
                      <td className={table.td}><ViolationBadges compliance={c.compliance} /></td>
                      <td className={table.td}><NextActionHint action={c.compliance.nextAction} changeName={c.name} compact /></td>
                      <td className={cn(table.td, 'whitespace-nowrap text-xs text-zinc-500')}>
                        {c.startedAt ? new Date(c.startedAt).toLocaleDateString('vi-VN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
