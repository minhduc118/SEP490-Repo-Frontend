// ─── TeamSpec Monitor — Dashboard Page (with search, filter, chart, blocked) ──
import { useState, useMemo } from 'react';
import { MOCK_CHANGES, MOCK_STATS } from '../lib/mockData';
import {
  AssigneeCell, BlockedDot, ComplianceCell, FilterCount, MyChangesToggle, ScoreOptions,
  StageBadge, StageOptions, ViolationBadges,
} from '../components/SharedComponents';
import { ComplianceChart } from '../components/ComplianceChart';
import { Card, CardTitle, EmptyState, PageHeader, SearchInput, Select } from '../components/ui';
import { cn, isBlocked, matchesScoreFilter, table, type Tone } from '../lib/styles';
import { useChanges, useStats } from '../lib/api';
import { useAuthStore } from '../lib/authStore';
import type { ChangeWithCompliance } from '../types';

interface Props {
  onSelectChange: (name: string) => void;
  useApi?: boolean;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const STAT_TONES: Record<Tone, string> = {
  accent: 'from-indigo-500/20 text-indigo-300',
  pass: 'from-emerald-500/20 text-emerald-300',
  fail: 'from-rose-500/20 text-rose-300',
  warn: 'from-amber-500/20 text-amber-300',
  gray: 'from-white/10 text-zinc-300',
};

function StatCard({ icon, value, label, tone }: { icon: string; value: string | number; label: string; tone: Tone }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900/60 p-5">
      <div className={cn('pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br to-transparent blur-2xl', STAT_TONES[tone])} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <span className={cn('grid size-8 place-items-center rounded-lg bg-white/5 text-base', STAT_TONES[tone])}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-white">{value}</div>
    </div>
  );
}

// ─── Change Row ───────────────────────────────────────────────────────────────
function ChangeRow({ change, onClick }: { change: ChangeWithCompliance; onClick: () => void }) {
  const blocked = isBlocked(change.compliance);
  return (
    <tr onClick={onClick} className={cn(table.row, blocked && table.rowBlocked)}>
      <td className={table.td}>
        <div className="flex items-center gap-2.5">
          {blocked && <BlockedDot />}
          <div>
            <div className="font-semibold text-zinc-100">{change.name}</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{change.project}</div>
          </div>
        </div>
      </td>
      <td className={table.td}><StageBadge stage={change.stage} /></td>
      <td className={table.td}><AssigneeCell login={change.assignee} /></td>
      <td className={table.td}><ComplianceCell compliance={change.compliance} /></td>
      <td className={table.td}><ViolationBadges compliance={change.compliance} /></td>
    </tr>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export function DashboardPage({ onSelectChange, useApi = false }: Props) {
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const login = useAuthStore(s => s.user?.login);

  const { data: apiChanges, isLoading } = useChanges();
  const { data: apiStats } = useStats();

  const allChanges: ChangeWithCompliance[] = useApi && apiChanges ? apiChanges : MOCK_CHANGES;
  const stats = useApi && apiStats ? apiStats : MOCK_STATS;
  const myCount = allChanges.filter(c => c.assignee === login).length;
  const blockedCount = allChanges.filter(c => isBlocked(c.compliance)).length;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allChanges.filter(c => {
      if (mineOnly && c.assignee !== login) return false;
      const matchQuery = !q || c.name.toLowerCase().includes(q) || (c.assignee || '').toLowerCase().includes(q);
      const matchStage = stageFilter === 'all' || c.stage === stageFilter;
      return matchQuery && matchStage && matchesScoreFilter(c.compliance, scoreFilter);
    });
  }, [allChanges, query, stageFilter, scoreFilter, mineOnly, login]);

  const hasFilters = query !== '' || stageFilter !== 'all' || scoreFilter !== 'all' || mineOnly;
  const resetFilters = () => { setQuery(''); setStageFilter('all'); setScoreFilter('all'); setMineOnly(false); };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Theo dõi compliance của team theo 6 bước SEP — MT-GRMS · SEP490-G84"
      />

      {blockedCount > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/15 to-rose-500/5 px-4 py-3 text-sm text-rose-100">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-500/20">🚨</span>
          <div>
            <strong className="font-semibold">{blockedCount} change{blockedCount > 1 ? 's' : ''} bị BLOCKED</strong>
            <span className="text-rose-200/80"> — có bước bị skip. Cần xử lý ngay!</span>
          </div>
          <button
            type="button"
            onClick={() => setScoreFilter('blocked')}
            className="ml-auto shrink-0 cursor-pointer rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/30"
          >
            Xem ngay
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading && useApi ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[108px] animate-pulse rounded-2xl border border-white/[0.07] bg-zinc-900/60" />
          ))
        ) : (
          <>
            <StatCard icon="🔄" value={stats.total} label="Total Changes" tone="accent" />
            <StatCard icon="⚡" value={stats.inProgress} label="In Progress" tone="pass" />
            <StatCard icon="🚨" value={blockedCount} label="Blocked" tone="fail" />
            <StatCard icon="📈" value={`${stats.avgScore}%`} label="Team Avg Score" tone="warn" />
          </>
        )}
      </div>

      <ComplianceChart changes={filtered.length > 0 ? filtered : allChanges} />

      <Card>
        <CardTitle extra={hasFilters && <span className="text-indigo-300">Đang lọc: {filtered.length} kết quả</span>}>
          Danh sách Changes
        </CardTitle>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MyChangesToggle active={mineOnly} count={myCount} onToggle={() => setMineOnly(v => !v)} />
          <SearchInput value={query} onChange={setQuery} placeholder="Tìm change hoặc assignee..." />
          <Select value={stageFilter} onChange={setStageFilter}><StageOptions /></Select>
          <Select value={scoreFilter} onChange={setScoreFilter}><ScoreOptions /></Select>
          <FilterCount shown={filtered.length} total={allChanges.length} onReset={hasFilters ? resetFilters : undefined} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="🔍" title="Không tìm thấy kết quả" sub="Thử thay đổi từ khóa hoặc bộ lọc" />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Change</th>
                  <th className={table.th}>Bước</th>
                  <th className={table.th}>Assignee</th>
                  <th className={table.th}>Compliance</th>
                  <th className={table.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <ChangeRow key={c.name} change={c} onClick={() => onSelectChange(c.name)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
