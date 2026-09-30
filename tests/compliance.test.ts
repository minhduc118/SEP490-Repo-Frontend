/**
 * Compliance engine tests + parity with the kit (team-ai-knowledge/mcp-server/dist).
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  calculateCompliance, parseRequirements, parseTasks, parseTestVerdict, requirementCoverage,
} from '../src/features/teamspec/lib/compliance.ts';
import { buildActivity, parseSessionLog, parseSummary } from '../src/features/teamspec/lib/activity.ts';
import { parseSpecDoc } from '../src/features/teamspec/lib/specs.ts';
import type { ChangeSchema, ChangeStage, OpenSpecChange } from '../src/features/teamspec/types/index.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────
interface Fixture {
  name: string;
  stage: ChangeStage;
  schema?: ChangeSchema;
  files: string[];
  tasks?: { done: number; total: number };
  verdict?: 'PASS' | 'FAIL';
  gate?: boolean;
  approved?: ChangeStage[];
  expect: { score: number; next: string | null; critical: number };
}

const SPEC = ['.session.md', 'proposal.md'];
const BRAIN = [...SPEC, 'exploration.md', 'design-brief.md', 'specs.md'];
const VERIFY = [...BRAIN, 'review/skeptic.md', 'tasks.md'];
const ALL: ChangeStage[] = ['spec', 'brainstorm', 'verify-spec', 'apply', 'test'];

const FIXTURES: Fixture[] = [
  { name: 'mới tạo', stage: 'spec', files: ['.session.md'], expect: { score: 0, next: 'work:spec', critical: 0 } },
  { name: 'spec xong, không gate', stage: 'spec', files: SPEC, expect: { score: 17, next: 'work:brainstorm', critical: 0 } },
  { name: 'spec xong, gate chờ duyệt', stage: 'spec', files: SPEC, gate: true, expect: { score: 17, next: 'approve:spec', critical: 0 } },
  { name: 'gate: làm brainstorm khi spec chưa duyệt', stage: 'brainstorm', files: [...SPEC, 'exploration.md'], gate: true, expect: { score: 17, next: 'approve:spec', critical: 1 } },
  { name: 'skip design-brief', stage: 'verify-spec', files: [...SPEC, 'exploration.md', 'specs.md', 'tasks.md'], tasks: { done: 0, total: 3 }, expect: { score: 17, next: 'work:brainstorm', critical: 1 } },
  { name: 'bug-fix không cần design-brief', stage: 'brainstorm', schema: 'bug-fix', files: [...SPEC, 'exploration.md', 'specs.md'], expect: { score: 33, next: 'work:verify-spec', critical: 0 } },
  { name: 'apply dở', stage: 'apply', files: VERIFY, tasks: { done: 2, total: 5 }, expect: { score: 50, next: 'work:apply', critical: 0 } },
  { name: 'test FAIL', stage: 'test', files: [...VERIFY, 'test-report.md'], tasks: { done: 5, total: 5 }, verdict: 'FAIL', expect: { score: 67, next: 'work:test', critical: 0 } },
  { name: 'test tick thiếu nhưng có report', stage: 'test', files: [...VERIFY, 'test-report.md'], tasks: { done: 4, total: 5 }, verdict: 'PASS', expect: { score: 67, next: 'work:apply', critical: 1 } },
  { name: 'archive đủ, gate duyệt hết', stage: 'archived', files: [...VERIFY, 'test-report.md'], tasks: { done: 5, total: 5 }, verdict: 'PASS', gate: true, approved: ALL, expect: { score: 100, next: null, critical: 0 } },
];

function toChange(f: Fixture): OpenSpecChange {
  return {
    name: f.name,
    stage: f.stage,
    mode: 'full',
    schema: f.schema ?? 'feature',
    artifacts: Object.fromEntries(f.files.map(file => [file, { file, exists: true }])),
    tasks: f.tasks,
    testVerdict: f.verdict,
    gate: f.gate,
    approvals: Object.fromEntries((f.approved ?? []).map(s => [s, { by: 'lead', at: '2026-09-30T00:00:00Z' }])),
  };
}

const nextKey = (n: { kind: string; stage: string } | null) => (n ? `${n.kind}:${n.stage}` : null);

for (const f of FIXTURES) {
  test(`compliance · ${f.name}`, () => {
    const r = calculateCompliance(toChange(f));
    assert.equal(r.score, f.expect.score, 'score');
    assert.equal(nextKey(r.nextAction), f.expect.next, 'nextAction');
    assert.equal(r.violations.filter(v => v.severity === 'critical').length, f.expect.critical, 'critical violations');
  });
}

// ── Parsers ───────────────────────────────────────────────────────────────────
test('parseTasks · CRLF, mã task, section, REQ', () => {
  const md = '# Tasks\r\n## Backend\r\n- [x] T1 — Tạo API (REQ-01, req-2)\r\n- [ ] BE-02: Service\r\n## Test\r\n* [X] Viết test REQ-3\r\n';
  const tasks = parseTasks(md)!;
  assert.equal(tasks.length, 3);
  assert.deepEqual(tasks[0], { id: 'T1', title: 'Tạo API (REQ-01, req-2)', done: true, section: 'Backend', reqs: ['REQ-1', 'REQ-2'] });
  assert.equal(tasks[1].id, 'BE-02');
  assert.equal(tasks[1].title, 'Service');
  assert.equal(tasks[2].id, undefined);
  assert.equal(tasks[2].section, 'Test');
  assert.equal(parseTasks(null), undefined);
});

test('parseRequirements · bỏ REMOVED + độ phủ task', () => {
  const specs = '## ADDED Requirements\n### Requirement: REQ-01 Đăng nhập\n## MODIFIED Requirements\n### Requirement: REQ-2 Refresh\n## REMOVED Requirements\n### Requirement: REQ-3 Cũ\n';
  const requirements = parseRequirements(specs)!;
  assert.deepEqual(requirements, ['REQ-1', 'REQ-2']);
  const cov = requirementCoverage({ requirements, taskItems: parseTasks('- [ ] T1 làm REQ-1') });
  assert.deepEqual(cov.uncovered, ['REQ-2']);
});

test('parseTestVerdict · chỉ đọc frontmatter', () => {
  assert.equal(parseTestVerdict('---\nverdict: pass\n---\n# Report'), 'PASS');
  assert.equal(parseTestVerdict('# Report\nverdict: PASS'), undefined);
});

test('activity · summary, nhật ký, commit sửa tay', () => {
  const summary = '# Summary: x\n\n## Spec — ✅ Approve bởi @lead · 2026-09-30 08:15\n\nProposal rõ ràng.\n\n## Brainstorm — ❌ Reject bởi @lead · 2026-09-30 09:00\n\nThiếu phương án 2.\n';
  const decisions = parseSummary(summary);
  assert.deepEqual(decisions.map(d => [d.kind, d.actor, d.at]), [
    ['approve', 'lead', '2026-09-30T08:15:00Z'],
    ['reject', 'lead', '2026-09-30T09:00:00Z'],
  ]);
  assert.equal(decisions[0].detail, 'Proposal rõ ràng.');

  const log = parseSessionLog('# S\n\n## Nhật ký\n- 2026-09-30 07:00 · tạo change (feature) · @userA\n- 2026-09-30 07:30 · tạo proposal.md\n');
  assert.equal(log.length, 2);
  assert.equal(log[0].actor, 'userA');

  const items = buildActivity({
    summary,
    commits: [
      { author: 'lead', date: '2026-09-30T08:15:05Z', message: 'sep(x): approve spec' },
      { author: 'userA', date: '2026-09-30T07:30:00Z', message: 'sep(x): add proposal.md' },
      { author: 'userB', date: '2026-09-30T10:00:00Z', message: 'fix typo in tasks' },
    ],
  });
  assert.deepEqual(items.map(i => i.kind), ['manual', 'reject', 'approve', 'commit']);
});

// ── Parity with the kit ───────────────────────────────────────────────────────
const KB = path.resolve(process.env.KB_PATH ?? path.join(process.cwd(), '..', 'ai-team-kit', 'team-ai-knowledge'));
const KIT_DIST = path.join(KB, 'mcp-server', 'dist', 'tools');
const hasKit = fs.existsSync(path.join(KIT_DIST, 'sepWorkflow.js'));

test('parity · stepGap/nextAction giống sepWorkflow.ts của kit', { skip: !hasKit && `không thấy ${KIT_DIST} (chạy npm run build trong mcp-server)` }, async () => {
  const kit = await import(pathToFileURL(path.join(KIT_DIST, 'sepWorkflow.js')).href);
  for (const f of FIXTURES) {
    const change = toChange(f);
    const st = {
      status: f.stage,
      schema: f.schema ?? 'feature',
      gate: !!f.gate,
      approvals: change.approvals,
      files: Object.fromEntries(f.files.map(file => [file, true])),
      tasks: f.tasks ?? (f.files.includes('tasks.md') ? { done: 0, total: 0 } : null),
      verdict: f.verdict ?? null,
    };
    if (f.files.includes('tasks.md') && !f.tasks) change.tasks = { done: 0, total: 0 };
    const web = calculateCompliance(change);
    kit.SEP_STEPS.forEach((step: { key: string }, i: number) => {
      assert.equal(kit.stepGap(step, st) === null, web.stageResults[i].passed, `${f.name} · bước ${step.key}`);
    });
    const kitNext = kit.nextAction(st);
    assert.equal(kitNext ? `${kitNext.kind}:${kitNext.step.key}` : null, nextKey(web.nextAction), `${f.name} · nextAction`);
  }
});

test('parity · parseSpecDoc đọc được spec do specMerge.ts của kit sinh ra', { skip: !hasKit && 'không có kit dist' }, async () => {
  const { mergeDeltaSpec } = await import(pathToFileURL(path.join(KIT_DIST, 'specMerge.js')).href);
  const delta1 = '## ADDED Requirements\n### Requirement: REQ-01 Đăng nhập\nMUST ...\n#### Scenario: đúng mật khẩu\nGIVEN ...\n';
  const first = mergeDeltaSpec(null, delta1, { capability: 'auth', change: 'auth-login', date: '2026-09-01' });
  const delta2 = '## MODIFIED Requirements\n### Requirement: REQ-01 Đăng nhập\nMUST khoá sau 5 lần\n#### Scenario: a\n#### Scenario: b\n## ADDED Requirements\n### Requirement: REQ-02 Đăng xuất\nMUST ...\n';
  const second = mergeDeltaSpec(first.content, delta2, { capability: 'auth', change: 'auth-lockout', date: '2026-09-20' });

  const doc = parseSpecDoc(second.content);
  assert.deepEqual(doc.requirements.map(r => [r.name, r.scenarios]), [['REQ-01 Đăng nhập', 2], ['REQ-02 Đăng xuất', 0]]);
  assert.deepEqual(doc.history, [
    { date: '2026-09-01', change: 'auth-login', added: 1, modified: 0, removed: 0 },
    { date: '2026-09-20', change: 'auth-lockout', added: 1, modified: 1, removed: 0 },
  ]);
});
