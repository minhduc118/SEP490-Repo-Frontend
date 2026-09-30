// ─── TeamSpec Monitor — Core Types ──────────────────────────────────────────

export type ChangeMode = 'full' | 'fast' | 'minimal';

export type ChangeSchema = 'feature' | 'bug-fix' | 'refactor';

export type ChangeStage =
  | 'spec'
  | 'brainstorm'
  | 'verify-spec'
  | 'apply'
  | 'test'
  | 'archived';

export interface ArtifactStatus {
  file: string;
  exists: boolean;
  updatedAt?: string;
  author?: string;
  preview?: string;
}

export interface Approval {
  by: string;
  at: string;
}

/** One checklist line of tasks.md */
export interface TaskItem {
  /** Leading code such as T1 or BE-01 */
  id?: string;
  title: string;
  done: boolean;
  /** Nearest heading above the task */
  section?: string;
  /** REQ-xx referenced by the task (normalized, e.g. REQ-1) */
  reqs: string[];
}

export interface OpenSpecChange {
  name: string;
  assignee?: string;
  stage: ChangeStage;
  mode: ChangeMode;
  /** frontmatter `schema` of .session.md — decides required artifacts */
  schema?: ChangeSchema;
  /** openspec/specs/<capability>/spec.md receives specs.md on archive */
  capability?: string;
  startedAt?: string;
  project?: string;
  artifacts: Record<string, ArtifactStatus>;
  /** Optional files that exist (research.md, review/<persona>.md, summary.md, improvements.md) */
  extraArtifacts?: ArtifactStatus[];
  /** Checkbox progress in tasks.md */
  tasks?: { done: number; total: number };
  taskItems?: TaskItem[];
  /** REQ-xx declared in specs.md (REMOVED section excluded) */
  requirements?: string[];
  /** frontmatter `verdict` of test-report.md */
  testVerdict?: 'PASS' | 'FAIL';
  /** Changes created by the kit need an Approve per step (sep_duyet_buoc) */
  gate?: boolean;
  approvals?: Partial<Record<ChangeStage, Approval>>;
  rejections?: Partial<Record<ChangeStage, number>>;
}

export interface Violation {
  stage: string;
  message: string;
  severity: 'critical' | 'warning';
}

export interface StageResult {
  stage: string;
  label: string;
  passed: boolean;
  artifacts: ArtifactStatus[];
  violation?: Violation;
  /** undefined = step has no approval gate; null = not approved yet */
  approval?: Approval | null;
  rejections?: number;
}

export type NextAction =
  | { kind: 'work'; stage: ChangeStage; command: string; gap: string }
  | { kind: 'approve'; stage: ChangeStage; command: string };

export interface ComplianceResult {
  score: number;
  stagesPassed: number;
  stagesTotal: number;
  stageResults: StageResult[];
  violations: Violation[];
  /** null = all 6 steps done */
  nextAction: NextAction | null;
}

export interface ChangeWithCompliance extends OpenSpecChange {
  compliance: ComplianceResult;
}

export interface TeamMember {
  login: string;
  name?: string;
  avatarUrl?: string;
  changesCount: number;
  avgScore: number;
  violations: Violation[];
  changes: string[];
}

export interface DashboardStats {
  total: number;
  inProgress: number;
  archived?: number;
  blocked: number;
  avgScore: number;
}
