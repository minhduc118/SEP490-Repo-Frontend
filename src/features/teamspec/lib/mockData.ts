// ─── TeamSpec Monitor — Mock Data ────────────────────────────────────────────
// Dữ liệu mẫu để demo — sau này thay bằng API đọc từ openspec/changes/
import { calculateCompliance, WORKFLOW_STAGES } from '../lib/compliance';
import type { ChangeStage, ChangeWithCompliance, OpenSpecChange, TeamMember, DashboardStats } from '../types';

const ALL_ARTIFACT_FILES = WORKFLOW_STAGES.flatMap(s => s.artifacts);

const SPEC = ['.session.md', 'proposal.md'];
const BRAINSTORM = [...SPEC, 'exploration.md', 'design-brief.md', 'specs.md'];
const VERIFIED = [...BRAINSTORM, 'review/skeptic.md', 'tasks.md'];

function makeChange(
  name: string,
  assignee: string,
  existingArtifacts: string[],
  stage: ChangeStage,
  mode: 'full' | 'fast' | 'minimal' = 'full',
  startedAt = '2026-09-20T10:00:00Z',
  extra: Pick<OpenSpecChange, 'tasks' | 'testVerdict'> = {},
  project = 'MT-GRMS'
): ChangeWithCompliance {
  const artifacts = Object.fromEntries(
    ALL_ARTIFACT_FILES.map(file => [
      file,
      {
        file,
        exists: existingArtifacts.includes(file),
        updatedAt: existingArtifacts.includes(file)
          ? new Date(Date.now() - Math.random() * 86400000 * 3).toISOString()
          : undefined,
        author: existingArtifacts.includes(file) ? assignee : undefined,
      },
    ])
  );

  const change: OpenSpecChange = { name, assignee, stage, mode, startedAt, project, artifacts, ...extra };
  const compliance = calculateCompliance(change);
  return { ...change, compliance };
}

export const MOCK_CHANGES: ChangeWithCompliance[] = [
  makeChange('auth-login-feature', 'userA', VERIFIED, 'apply', 'full', '2026-09-18T08:00:00Z',
    { tasks: { done: 5, total: 8 } }),
  // Skip verify-spec: tasks.md written without review/skeptic.md
  makeChange('cart-checkout-bug', 'userB', [...BRAINSTORM, 'tasks.md'], 'verify-spec', 'fast', '2026-09-20T09:00:00Z',
    { tasks: { done: 0, total: 4 } }),
  makeChange('inventory-dashboard', 'userA', [...VERIFIED, 'test-report.md'], 'test', 'full', '2026-09-19T14:00:00Z',
    { tasks: { done: 6, total: 6 }, testVerdict: 'FAIL' }),
  makeChange('supplier-management', 'userC', BRAINSTORM, 'brainstorm', 'minimal', '2026-09-21T10:00:00Z'),
  makeChange('pos-payment-qr', 'userB', [...VERIFIED, 'test-report.md'], 'archived', 'full', '2026-09-10T08:00:00Z',
    { tasks: { done: 7, total: 7 }, testVerdict: 'PASS' }),
  makeChange('fefo-batch-tracking', 'userC', SPEC, 'spec', 'full', '2026-09-22T15:00:00Z'),
];

export const MOCK_STATS: DashboardStats = {
  total: MOCK_CHANGES.length,
  inProgress: MOCK_CHANGES.filter(c => c.stage !== 'archived').length,
  blocked: MOCK_CHANGES.filter(c =>
    c.compliance.violations.some(v => v.severity === 'critical')
  ).length,
  avgScore: Math.round(
    MOCK_CHANGES.reduce((s, c) => s + c.compliance.score, 0) / MOCK_CHANGES.length
  ),
};

export function getMockTeamMembers(): TeamMember[] {
  const memberMap: Record<string, TeamMember> = {};

  for (const change of MOCK_CHANGES) {
    const login = change.assignee || 'unassigned';
    if (!memberMap[login]) {
      memberMap[login] = {
        login,
        changesCount: 0,
        avgScore: 0,
        violations: [],
        changes: [],
      };
    }
    memberMap[login].changesCount++;
    memberMap[login].changes.push(change.name);
    memberMap[login].violations.push(...change.compliance.violations);
  }

  return Object.values(memberMap).map(m => ({
    ...m,
    avgScore: Math.round(
      MOCK_CHANGES.filter(c => c.assignee === m.login)
        .reduce((s, c) => s + c.compliance.score, 0) /
        Math.max(m.changesCount, 1)
    ),
  }));
}
