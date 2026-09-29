// ─── TeamSpec Monitor — Change Detail Page ───────────────────────────────────
import { useState, type ReactNode } from 'react';
import { MOCK_CHANGES } from '../lib/mockData';
import { WORKFLOW_STAGES } from '../lib/compliance';
import { useChange } from '../lib/api';
import {
  WorkflowTimeline, ArtifactList, ViolationList,
  ScoreBadge, StageBadge, ModeBadge, Avatar, ProgressBar,
} from '../components/SharedComponents';
import { ContentViewer } from '../components/ContentViewer';
import { Badge, Button, Card, CardTitle, EmptyState } from '../components/ui';
import { TONE_TEXT, cn, scoreTone, type Tone } from '../lib/styles';
import type { ArtifactStatus, StageResult } from '../types';

interface Props {
  changeName: string;
  onBack: () => void;
  useApi?: boolean;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="-ml-3 mb-4">
      ← Quay lại
    </Button>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
      {icon} {children}
    </span>
  );
}

function stageStatus(sr: StageResult): { tone: Tone; label: string } {
  if (sr.passed) return { tone: 'pass', label: '✓ Pass' };
  if (sr.violation?.severity === 'critical') return { tone: 'fail', label: '✕ Critical' };
  if (sr.violation) return { tone: 'warn', label: '! Đang làm' };
  return { tone: 'gray', label: '○ Pending' };
}

export function ChangeDetailPage({ changeName, onBack, useApi = false }: Props) {
  const { data: apiChange, isLoading } = useChange(useApi ? changeName : '');
  const change = useApi ? apiChange : MOCK_CHANGES.find(c => c.name === changeName);
  const [viewingArtifact, setViewingArtifact] = useState<(ArtifactStatus & { file: string }) | null>(null);

  if (useApi && isLoading) {
    return (
      <div>
        <BackButton onClick={onBack} />
        <EmptyState icon="⏳" sub={`Đang tải ${changeName}…`} />
      </div>
    );
  }

  if (!change) {
    return (
      <div>
        <BackButton onClick={onBack} />
        <EmptyState icon="🔍" title="Không tìm thấy change" sub={changeName} />
      </div>
    );
  }

  const { compliance } = change;
  const started = change.startedAt ? new Date(change.startedAt).toLocaleDateString('vi-VN') : 'Unknown';
  const nextStage = compliance.stageResults.find(sr => !sr.passed);
  const nextCommand = WORKFLOW_STAGES.find(s => s.key === nextStage?.stage)?.command;

  return (
    <div>
      {viewingArtifact && (
        <ContentViewer
          artifact={viewingArtifact}
          changeName={changeName}
          onClose={() => setViewingArtifact(null)}
          useApi={useApi}
        />
      )}

      <BackButton onClick={onBack} />

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="mr-1 text-2xl font-bold tracking-tight text-white">{change.name}</h1>
          <StageBadge stage={change.stage} />
          <ModeBadge mode={change.mode} />
          <ScoreBadge score={compliance.score} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Meta icon={<Avatar login={change.assignee || '?'} />}>@{change.assignee || 'unassigned'}</Meta>
          <Meta icon="📅">Bắt đầu {started}</Meta>
          <Meta icon="🏢">{change.project}</Meta>
          {change.tasks && change.tasks.total > 0 && (
            <Meta icon="☑">{change.tasks.done}/{change.tasks.total} tasks</Meta>
          )}
        </div>
      </header>

      <Card className="mb-6">
        <CardTitle
          extra={nextCommand && (
            <span>Bước tiếp theo: <code className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-indigo-300">{nextCommand} {change.name}</code></span>
          )}
        >
          🗺️ Workflow Progress
        </CardTitle>
        <WorkflowTimeline stageResults={compliance.stageResults} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardTitle extra="Click để xem nội dung">📁 Artifacts</CardTitle>
          <ArtifactList
            compliance={compliance}
            onViewArtifact={art => setViewingArtifact(art as ArtifactStatus & { file: string })}
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="text-center">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Compliance Score</div>
            <div className={cn('mt-2 text-5xl font-extrabold tabular-nums tracking-tight', TONE_TEXT[scoreTone(compliance.score)])}>
              {compliance.score}%
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {compliance.stagesPassed} / {compliance.stagesTotal} bước hoàn thành
            </div>
            <div className="mt-4"><ProgressBar value={compliance.score} /></div>
          </Card>

          <Card>
            <CardTitle>🚨 Violations ({compliance.violations.length})</CardTitle>
            <ViolationList compliance={compliance} />
          </Card>

          <Card>
            <CardTitle>📋 Chi tiết từng bước</CardTitle>
            <ul className="divide-y divide-white/[0.05]">
              {compliance.stageResults.map(sr => {
                const status = stageStatus(sr);
                return (
                  <li key={sr.stage} className="flex items-center justify-between py-2">
                    <span className="text-xs text-zinc-300">{sr.label}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
