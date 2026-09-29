// ─── TeamSpec Monitor — Core Types ──────────────────────────────────────────

export type ChangeMode = 'full' | 'fast' | 'minimal';

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

export interface OpenSpecChange {
  name: string;
  assignee?: string;
  stage: ChangeStage;
  mode: ChangeMode;
  startedAt?: string;
  project?: string;
  artifacts: Record<string, ArtifactStatus>;
  /** Checkbox progress in tasks.md */
  tasks?: { done: number; total: number };
  /** frontmatter `verdict` of test-report.md */
  testVerdict?: 'PASS' | 'FAIL';
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
}

export interface ComplianceResult {
  score: number;
  stagesPassed: number;
  stagesTotal: number;
  stageResults: StageResult[];
  violations: Violation[];
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
