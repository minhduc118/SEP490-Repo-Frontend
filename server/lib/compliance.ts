/**
 * Compliance Engine — shared with the frontend so both score the 6 SEP steps identically.
 */
export {
  ALL_ARTIFACTS,
  WORKFLOW_STAGES,
  calculateCompliance,
  normalizeStage,
  parseTaskProgress,
  parseTestVerdict,
} from '../../src/features/teamspec/lib/compliance.ts';

export type {
  ArtifactStatus,
  ChangeWithCompliance,
  ComplianceResult,
  OpenSpecChange,
  StageResult,
  Violation,
} from '../../src/features/teamspec/types/index.ts';
