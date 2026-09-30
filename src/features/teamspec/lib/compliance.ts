// ─── TeamSpec Monitor — Compliance Engine ────────────────────────────────────
// 6 bước SEP, mỗi bước = 1 lệnh skill. Phải khớp SEP_STEPS, SCHEMAS, APPROVABLE và stepGap trong
// team-ai-knowledge/mcp-server/src/tools/sepWorkflow.ts. Server dùng chung file này.
import type {
  Approval,
  ChangeSchema,
  ChangeStage,
  OpenSpecChange,
  ComplianceResult,
  NextAction,
  StageResult,
  TaskItem,
  Violation,
} from '../types/index.ts';

export const WORKFLOW_STAGES: Array<{
  key: ChangeStage;
  label: string;
  command: string;
  icon: string;
  artifacts: string[];
  /** Files the step may save without being required */
  optional?: string[];
}> = [
  { key: 'spec',        label: 'Spec',        command: '/sep-spec',        icon: '📝', artifacts: ['.session.md', 'proposal.md'] },
  { key: 'brainstorm',  label: 'Brainstorm',  command: '/sep-brainstorm',  icon: '💡', artifacts: ['exploration.md', 'design-brief.md', 'specs.md'], optional: ['research.md'] },
  { key: 'verify-spec', label: 'Verify Spec', command: '/sep-verify-spec', icon: '🔍', artifacts: ['review/skeptic.md', 'tasks.md'], optional: ['review/guardian.md', 'review/advocate.md', 'review/codebase.md'] },
  { key: 'apply',       label: 'Apply',       command: '/sep-apply',       icon: '🛠️', artifacts: [] },
  { key: 'test',        label: 'Test',        command: '/sep-test',        icon: '🧪', artifacts: ['test-report.md'] },
  { key: 'archived',    label: 'Archive',     command: '/sep-archive',     icon: '📦', artifacts: [] },
];

export const ALL_ARTIFACTS = WORKFLOW_STAGES.flatMap(s => s.artifacts);

/** Optional step files plus the approval log written by sep_duyet_buoc */
export const EXTRA_ARTIFACTS = [...WORKFLOW_STAGES.flatMap(s => s.optional ?? []), 'summary.md', 'improvements.md'];

/** Steps that need an Approve before the next one when the change has `gate: true` */
export const APPROVABLE: ChangeStage[] = ['spec', 'brainstorm', 'verify-spec', 'apply', 'test'];

/** Per-schema overrides of stage artifacts — must match SCHEMAS in sepWorkflow.ts */
export const SCHEMA_ARTIFACTS: Record<ChangeSchema, Partial<Record<ChangeStage, string[]>>> = {
  feature: {},
  'bug-fix': { brainstorm: ['exploration.md', 'specs.md'] },
  refactor: { brainstorm: ['exploration.md', 'specs.md'] },
};

export function normalizeSchema(raw: unknown): ChangeSchema {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'bugfix' || s === 'bug') return 'bug-fix';
  return s in SCHEMA_ARTIFACTS ? (s as ChangeSchema) : 'feature';
}

export function stageArtifacts(stage: ChangeStage, schema: ChangeSchema | undefined): string[] {
  const override = SCHEMA_ARTIFACTS[schema ?? 'feature'][stage];
  return override ?? WORKFLOW_STAGES.find(s => s.key === stage)?.artifacts ?? [];
}

const STAGE_ORDER = WORKFLOW_STAGES.map(s => s.key);

const LEGACY_STATUS: Record<string, ChangeStage> = {
  route: 'spec',
  design: 'brainstorm',
  review: 'verify-spec',
  tasks: 'verify-spec',
};

export function normalizeStage(raw: string | null | undefined): ChangeStage {
  const s = (raw ?? '').trim();
  if ((STAGE_ORDER as string[]).includes(s)) return s as ChangeStage;
  return LEGACY_STATUS[s] ?? 'spec';
}

// ─── tasks.md / specs.md parsing ──────────────────────────────────────────────
const TASK_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const TASK_ID = /^\**`?([A-Z]{1,4}-?\d+(?:\.\d+)?)`?\**(?=[\s:.)—–-])\s*(?:[:.)—–-]\s*)?(.*)$/;
const REQ_REF = /\bREQ-?0*(\d+[A-Za-z]?)\b/gi;

/** REQ-01, req-1 and REQ1 all become REQ-1 */
function reqIds(text: string): string[] {
  return [...new Set([...text.matchAll(REQ_REF)].map(m => `REQ-${m[1].toUpperCase()}`))];
}

export function parseTasks(md: string | null | undefined): TaskItem[] | undefined {
  if (md == null) return undefined;
  const items: TaskItem[] = [];
  let section: string | undefined;
  for (const line of md.split(/\r?\n/)) {
    const heading = line.match(/^#{2,6}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1];
      continue;
    }
    const m = line.match(TASK_LINE);
    if (!m) continue;
    const text = m[2].trim();
    const idMatch = text.match(TASK_ID);
    items.push({
      id: idMatch?.[1],
      title: (idMatch ? idMatch[2] : text).trim() || text,
      done: m[1] !== ' ',
      section,
      reqs: reqIds(text),
    });
  }
  return items;
}

export function parseTaskProgress(md: string | null | undefined): { done: number; total: number } | undefined {
  const items = parseTasks(md);
  return items && { done: items.filter(t => t.done).length, total: items.length };
}

/** REQ ids declared in specs.md; requirements under "## REMOVED ..." need no task */
export function parseRequirements(md: string | null | undefined): string[] | undefined {
  if (md == null) return undefined;
  const found = new Set<string>();
  let removed = false;
  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) removed = /\bREMOVED\b/i.test(h2[1]);
    if (!removed) reqIds(line).forEach(r => found.add(r));
  }
  return [...found].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function parseTestVerdict(md: string | null | undefined): 'PASS' | 'FAIL' | undefined {
  const fm = md?.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  const v = fm?.match(/^verdict:\s*["']?(pass|fail)["']?\s*$/im)?.[1];
  return v ? (v.toUpperCase() as 'PASS' | 'FAIL') : undefined;
}

/** Requirements in specs.md vs tasks referencing them */
export function requirementCoverage(change: Pick<OpenSpecChange, 'requirements' | 'taskItems'>) {
  const requirements = change.requirements ?? [];
  const byReq = new Map(requirements.map(r => [r, [] as TaskItem[]]));
  for (const task of change.taskItems ?? []) {
    for (const r of task.reqs) byReq.get(r)?.push(task);
  }
  const uncovered = requirements.filter(r => byReq.get(r)!.length === 0);
  return { requirements, byReq, uncovered, covered: requirements.length - uncovered.length };
}

// ─── .session.md frontmatter ──────────────────────────────────────────────────
function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? '');
}

export function normalizeApprovals(raw: unknown): Partial<Record<ChangeStage, Approval>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<ChangeStage, Approval>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(STAGE_ORDER as string[]).includes(k) || !v || typeof v !== 'object') continue;
    const a = v as Record<string, unknown>;
    out[k as ChangeStage] = { by: String(a.by ?? 'user'), at: toIso(a.at) };
  }
  return out;
}

export function normalizeRejections(raw: unknown): Partial<Record<ChangeStage, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<ChangeStage, number>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if ((STAGE_ORDER as string[]).includes(k) && n > 0) out[k as ChangeStage] = n;
  }
  return out;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
const stageIndex = (key: ChangeStage) => STAGE_ORDER.indexOf(key);

/** undefined = bước đã qua; ngược lại là lý do chưa qua */
function stageGap(stage: (typeof WORKFLOW_STAGES)[number], change: OpenSpecChange): string | undefined {
  const missing = stageArtifacts(stage.key, change.schema).filter(f => !change.artifacts[f]?.exists);
  if (missing.length > 0) return `thiếu [${missing.join(', ')}]`;
  const current = normalizeStage(change.stage);
  switch (stage.key) {
    case 'apply': {
      const t = change.tasks;
      if (!t || t.total === 0) return 'tasks.md chưa có task';
      if (t.done < t.total) return `còn ${t.total - t.done}/${t.total} task chưa tick`;
      if (stageIndex(current) < stageIndex('apply')) return 'chưa chuyển sang apply';
      return undefined;
    }
    case 'test':
      return change.testVerdict === 'PASS' ? undefined : `test-report.md verdict = ${change.testVerdict ?? 'chưa có'}`;
    case 'archived':
      return current === 'archived' ? undefined : 'chưa archive';
    default:
      return undefined;
  }
}

/** Có dấu hiệu bước này đã được làm (dùng để phát hiện skip bước trước) */
function stageStarted(stage: (typeof WORKFLOW_STAGES)[number], change: OpenSpecChange): boolean {
  if (stageArtifacts(stage.key, change.schema).some(f => change.artifacts[f]?.exists)) return true;
  const current = normalizeStage(change.stage);
  if (stage.key === 'apply') return stageIndex(current) >= stageIndex('apply') || (change.tasks?.done ?? 0) > 0;
  if (stage.key === 'archived') return current === 'archived';
  return false;
}

export function calculateCompliance(change: OpenSpecChange): ComplianceResult {
  const stageResults: StageResult[] = [];
  const violations: Violation[] = [];
  let stagesPassed = 0;
  let currentFlagged = false;
  let nextAction: NextAction | null = null;

  WORKFLOW_STAGES.forEach((stage, i) => {
    const artifacts = stageArtifacts(stage.key, change.schema).map(file => ({
      file,
      exists: !!change.artifacts[file]?.exists,
      updatedAt: change.artifacts[file]?.updatedAt,
      author: change.artifacts[file]?.author,
      preview: change.artifacts[file]?.preview,
    }));
    const gap = stageGap(stage, change);
    const gated = !!change.gate && APPROVABLE.includes(stage.key);
    const approval = gated ? change.approvals?.[stage.key] ?? null : undefined;
    const laterStarted = WORKFLOW_STAGES.slice(i + 1).some(s => stageStarted(s, change));
    let violation: Violation | undefined;

    if (gap) {
      nextAction ??= { kind: 'work', stage: stage.key, command: stage.command, gap };
      if (laterStarted) {
        violation = { stage: stage.key, message: `"${stage.label}" bị skip: ${gap}`, severity: 'critical' };
      } else if (!currentFlagged) {
        currentFlagged = true;
        violation = {
          stage: stage.key,
          message: `"${stage.label}" chưa hoàn thành: ${gap} — chạy ${stage.command}`,
          severity: 'warning',
        };
      }
    } else {
      stagesPassed++;
      if (approval === null) {
        nextAction ??= { kind: 'approve', stage: stage.key, command: stage.command };
        if (laterStarted) {
          violation = { stage: stage.key, message: `"${stage.label}" chưa được user duyệt nhưng đã làm bước sau`, severity: 'critical' };
        } else if (!currentFlagged) {
          currentFlagged = true;
          violation = { stage: stage.key, message: `"${stage.label}" đã đủ artifact — chờ user Approve/Reject`, severity: 'warning' };
        }
      }
    }
    if (violation) violations.push(violation);

    stageResults.push({
      stage: stage.key,
      label: stage.label,
      passed: !gap,
      artifacts,
      violation,
      approval,
      rejections: change.rejections?.[stage.key],
    });
  });

  const stagesTotal = WORKFLOW_STAGES.length;
  const score = Math.round((stagesPassed / stagesTotal) * 100);
  return { score, stagesPassed, stagesTotal, stageResults, violations, nextAction };
}
