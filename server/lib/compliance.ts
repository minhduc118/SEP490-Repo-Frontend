/**
 * Compliance Engine — shared with the frontend so both score the 6 SEP steps identically.
 */
export {
  ALL_ARTIFACTS,
  EXTRA_ARTIFACTS,
  WORKFLOW_STAGES,
  calculateCompliance,
  normalizeApprovals,
  normalizeRejections,
  normalizeSchema,
  normalizeStage,
  parseRequirements,
  parseTasks,
  parseTestVerdict,
} from '../../src/features/teamspec/lib/compliance.ts';

export type {
  ArtifactStatus,
  ChangeWithCompliance,
  ComplianceResult,
  OpenSpecChange,
  StageResult,
  TaskItem,
  Violation,
} from '../../src/features/teamspec/types/index.ts';
