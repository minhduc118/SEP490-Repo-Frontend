// ─── TeamSpec Monitor — Mock Data ────────────────────────────────────────────
// Dữ liệu mẫu khi server offline — cùng cấu trúc với API đọc từ openspec/changes/
import { calculateCompliance, parseTasks, WORKFLOW_STAGES } from '../lib/compliance';
import type { Approval, ChangeStage, ChangeWithCompliance, OpenSpecChange, TeamMember, DashboardStats } from '../types';

const ALL_ARTIFACT_FILES = WORKFLOW_STAGES.flatMap(s => s.artifacts);

const SPEC = ['.session.md', 'proposal.md'];
const BRAINSTORM = [...SPEC, 'exploration.md', 'design-brief.md', 'specs.md'];
const VERIFIED = [...BRAINSTORM, 'review/skeptic.md', 'tasks.md'];

type Extra = Pick<OpenSpecChange, 'testVerdict' | 'gate' | 'rejections' | 'requirements' | 'schema'> & {
  tasksMd?: string;
  approved?: ChangeStage[];
};

function makeChange(
  name: string,
  assignee: string,
  existingArtifacts: string[],
  stage: ChangeStage,
  mode: 'full' | 'fast' | 'minimal' = 'full',
  startedAt = '2026-09-20T10:00:00Z',
  { tasksMd, approved = [], ...extra }: Extra = {},
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
  const taskItems = parseTasks(tasksMd);
  const approvals = Object.fromEntries(
    approved.map(s => [s, { by: 'leader', at: startedAt } satisfies Approval]),
  );

  const change: OpenSpecChange = {
    name, assignee, stage, mode, startedAt, project, artifacts,
    capability: name,
    taskItems,
    tasks: taskItems && { done: taskItems.filter(t => t.done).length, total: taskItems.length },
    approvals,
    ...extra,
  };
  const compliance = calculateCompliance(change);
  return { ...change, compliance };
}

const REQ = (n: number) => Array.from({ length: n }, (_, i) => `REQ-${i + 1}`);

export const MOCK_CHANGES: ChangeWithCompliance[] = [
  makeChange('auth-login-feature', 'userA', VERIFIED, 'apply', 'full', '2026-09-18T08:00:00Z', {
    gate: true,
    approved: ['spec', 'brainstorm', 'verify-spec'],
    requirements: REQ(4),
    tasksMd: `## Backend
- [x] T1 — AuthModule + UserEntity (REQ-1)
- [x] T2 — POST /auth/login trả JWT + refresh token (REQ-1)
- [x] T3 — POST /auth/refresh xoay vòng token (REQ-2)
- [ ] T4 — Rate limit 5 lần sai / 15 phút (REQ-4)
## Frontend
- [x] T5 — Form đăng nhập + auth store (REQ-1)
- [ ] T6 — Axios interceptor tự refresh (REQ-2)
## Test
- [ ] T7 — E2E luồng đăng nhập`,
  }),
  // Skip verify-spec: tasks.md written without review/skeptic.md
  makeChange('cart-checkout-bug', 'userB', [...BRAINSTORM, 'tasks.md'], 'verify-spec', 'fast', '2026-09-20T09:00:00Z', {
    schema: 'bug-fix',
    requirements: REQ(2),
    tasksMd: `- [ ] T1 - Tái hiện lỗi tổng tiền âm khi xoá item (REQ-1)
- [ ] T2 - Sửa CartService.recalculate
- [ ] T3 - Regression test`,
  }),
  makeChange('inventory-dashboard', 'userA', [...VERIFIED, 'test-report.md'], 'test', 'full', '2026-09-19T14:00:00Z', {
    gate: true,
    approved: ['spec', 'brainstorm', 'verify-spec', 'apply'],
    rejections: { test: 1 },
    requirements: REQ(3),
    testVerdict: 'FAIL',
    tasksMd: `- [x] T1 — API GET /inventory/dashboard (REQ-1)
- [x] T2 — Widget tồn kho thấp (REQ-2)
- [x] T3 — Widget sắp hết hạn (REQ-3)
- [x] T4 — Test scenario`,
  }),
  makeChange('supplier-management', 'userC', BRAINSTORM, 'brainstorm', 'minimal', '2026-09-21T10:00:00Z', {
    gate: true,
    approved: ['spec'],
    requirements: REQ(3),
  }),
  makeChange('pos-payment-qr', 'userB', [...VERIFIED, 'test-report.md'], 'archived', 'full', '2026-09-10T08:00:00Z', {
    testVerdict: 'PASS',
    requirements: REQ(2),
    tasksMd: `- [x] T1 — Sinh mã QR VietQR (REQ-1)
- [x] T2 — Webhook xác nhận thanh toán (REQ-2)
- [x] T3 — Test`,
  }),
  makeChange('fefo-batch-tracking', 'userC', SPEC, 'spec', 'full', '2026-09-22T15:00:00Z', { gate: true }),
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
