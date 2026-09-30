// ─── TeamSpec Monitor — Team Page ────────────────────────────────────────────
import { getMockTeamMembers, MOCK_CHANGES } from '../lib/mockData';
import { Avatar, ScoreBadge, ProgressBar } from '../components/SharedComponents';
import { Badge, Card, CardTitle, PageHeader } from '../components/ui';
import { cn, isBlocked, table } from '../lib/styles';

interface Props {
  onSelectChange: (name: string) => void;
  useApi?: boolean;
}

export function TeamPage({ onSelectChange }: Props) {
  const members = getMockTeamMembers().sort((a, b) => b.avgScore - a.avgScore);

  const violationCounts: Record<string, number> = {};
  for (const change of MOCK_CHANGES) {
    for (const v of change.compliance.violations) {
      violationCounts[v.message] = (violationCounts[v.message] || 0) + 1;
    }
  }
  const commonViolations = Object.entries(violationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const teamStats = [
    { label: 'Total changes', value: MOCK_CHANGES.length },
    { label: 'Changes bị BLOCKED', value: MOCK_CHANGES.filter(c => isBlocked(c.compliance)).length },
    { label: 'Changes hoàn toàn sạch', value: MOCK_CHANGES.filter(c => c.compliance.violations.length === 0).length },
    {
      label: 'Avg team score',
      value: `${Math.round(MOCK_CHANGES.reduce((s, c) => s + c.compliance.score, 0) / MOCK_CHANGES.length)}%`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team Compliance"
        subtitle={`Điểm compliance theo từng thành viên — ${members.length} members · ${MOCK_CHANGES.length} changes`}
      />

      <Card className="mb-6">
        <CardTitle>Member Overview</CardTitle>
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                {['Member', 'Changes', 'Avg Score', 'Progress', 'Violations', 'Status'].map(h => (
                  <th key={h} className={table.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const critical = m.violations.filter(v => v.severity === 'critical').length;
                const warn = m.violations.length - critical;
                return (
                  <tr key={m.login} className="transition-colors hover:bg-zinc-50">
                    <td className={table.td}>
                      <div className="flex items-center gap-2.5">
                        <Avatar login={m.login} />
                        <span className="font-semibold text-zinc-900">@{m.login}</span>
                      </div>
                    </td>
                    <td className={cn(table.td, 'tabular-nums text-zinc-700')}>{m.changesCount}</td>
                    <td className={table.td}><ScoreBadge score={m.avgScore} /></td>
                    <td className={cn(table.td, 'min-w-[140px]')}><ProgressBar value={m.avgScore} /></td>
                    <td className={table.td}>
                      <div className="flex gap-1">
                        {critical > 0 && <Badge tone="fail">🚨 {critical}</Badge>}
                        {warn > 0 && <Badge tone="warn">⚠ {warn}</Badge>}
                        {m.violations.length === 0 && <Badge tone="pass">Clean</Badge>}
                      </div>
                    </td>
                    <td className={table.td}>
                      {m.avgScore >= 90
                        ? <Badge tone="pass">🌟 Excellent</Badge>
                        : m.avgScore >= 70
                          ? <Badge tone="warn">⚡ Good</Badge>
                          : <Badge tone="fail">📉 Needs work</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Changes theo Member</CardTitle>
          <div className="flex flex-col gap-5">
            {members.map(m => (
              <div key={m.login}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar login={m.login} />
                  <span className="text-sm font-semibold text-zinc-900">@{m.login}</span>
                  <ScoreBadge score={m.avgScore} />
                </div>
                <ul className="ml-3.5 border-l border-zinc-200 pl-5">
                  {m.changes.map(cname => {
                    const change = MOCK_CHANGES.find(c => c.name === cname);
                    if (!change) return null;
                    return (
                      <li key={cname}>
                        <button
                          type="button"
                          onClick={() => onSelectChange(cname)}
                          className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100"
                        >
                          <span className="text-indigo-700">{cname}</span>
                          <ScoreBadge score={change.compliance.score} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>🔥 Vi phạm phổ biến nhất</CardTitle>
            {commonViolations.length === 0 ? (
              <div className="text-sm text-emerald-700">✓ Không có vi phạm nào!</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {commonViolations.map(([msg, count]) => (
                  <li key={msg} className="flex items-start gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                    <span className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-indigo-700">
                      ×{count}
                    </span>
                    <span className="text-xs leading-relaxed text-zinc-700">{msg}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>📊 Thống kê</CardTitle>
            <dl className="divide-y divide-zinc-100">
              {teamStats.map(stat => (
                <div key={stat.label} className="flex justify-between py-2 text-sm">
                  <dt className="text-zinc-600">{stat.label}</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
