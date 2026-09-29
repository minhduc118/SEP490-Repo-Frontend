// ─── TeamSpec Monitor — Compliance Engine ────────────────────────────────────
// 6 bước SEP, mỗi bước = 1 lệnh skill. Phải khớp SEP_STEPS trong
// team-ai-knowledge/mcp-server/src/tools/sepWorkflow.ts. Server dùng chung file này.
import type {
  ChangeStage,
  OpenSpecChange,
  ComplianceResult,
  StageResult,
  Violation,
} from '../types/index.ts';

export const WORKFLOW_STAGES: Array<{
  key: ChangeStage;
  label: string;
  command: string;
  icon: string;
  artifacts: string[];
}> = [
  { key: 'spec',        label: 'Spec',        command: '/sep-spec',        icon: '📝', artifacts: ['.session.md', 'proposal.md'] },
  { key: 'brainstorm',  label: 'Brainstorm',  command: '/sep-brainstorm',  icon: '💡', artifacts: ['exploration.md', 'design-brief.md', 'specs.md'] },
  { key: 'verify-spec', label: 'Verify Spec', command: '/sep-verify-spec', icon: '🔍', artifacts: ['review/skeptic.md', 'tasks.md'] },
  { key: 'apply',       label: 'Apply',       command: '/sep-apply',       icon: '🛠️', artifacts: [] },
  { key: 'test',        label: 'Test',        command: '/sep-test',        icon: '🧪', artifacts: ['test-report.md'] },
  { key: 'archived',    label: 'Archive',     command: '/sep-archive',     icon: '📦', artifacts: [] },
];

export const ALL_ARTIFACTS = WORKFLOW_STAGES.flatMap(s => s.artifacts);

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

export function parseTaskProgress(md: string | null | undefined): { done: number; total: number } | undefined {
  if (md == null) return undefined;
  const items = md.split('\n').filter(l => /^\s*[-*]\s+\[[ xX]\]/.test(l));
  return { done: items.filter(l => /^\s*[-*]\s+\[[xX]\]/.test(l)).length, total: items.length };
}

export function parseTestVerdict(md: string | null | undefined): 'PASS' | 'FAIL' | undefined {
  const fm = md?.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  const v = fm?.match(/^verdict:\s*["']?(pass|fail)["']?\s*$/im)?.[1];
  return v ? (v.toUpperCase() as 'PASS' | 'FAIL') : undefined;
}

const stageIndex = (key: ChangeStage) => STAGE_ORDER.indexOf(key);

/** undefined = bước đã qua; ngược lại là lý do chưa qua */
function stageGap(stage: (typeof WORKFLOW_STAGES)[number], change: OpenSpecChange): string | undefined {
  const missing = stage.artifacts.filter(f => !change.artifacts[f]?.exists);
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
  if (stage.artifacts.some(f => change.artifacts[f]?.exists)) return true;
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

  WORKFLOW_STAGES.forEach((stage, i) => {
    const artifacts = stage.artifacts.map(file => ({
      file,
      exists: !!change.artifacts[file]?.exists,
      updatedAt: change.artifacts[file]?.updatedAt,
      author: change.artifacts[file]?.author,
      preview: change.artifacts[file]?.preview,
    }));
    const gap = stageGap(stage, change);
    let violation: Violation | undefined;

    if (!gap) {
      stagesPassed++;
    } else if (WORKFLOW_STAGES.slice(i + 1).some(s => stageStarted(s, change))) {
      violation = { stage: stage.key, message: `"${stage.label}" bị skip: ${gap}`, severity: 'critical' };
    } else if (!currentFlagged) {
      currentFlagged = true;
      violation = {
        stage: stage.key,
        message: `"${stage.label}" chưa hoàn thành: ${gap} — chạy ${stage.command}`,
        severity: 'warning',
      };
    }
    if (violation) violations.push(violation);

    stageResults.push({ stage: stage.key, label: stage.label, passed: !gap, artifacts, violation });
  });

  const stagesTotal = WORKFLOW_STAGES.length;
  const score = Math.round((stagesPassed / stagesTotal) * 100);
  return { score, stagesPassed, stagesTotal, stageResults, violations };
}
