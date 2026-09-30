/**
 * Build OpenSpec change objects (with compliance) from the active KB source.
 */
import path from 'path';
import { kbSource } from './kb-source.js';
import { parseFrontmatter, type Frontmatter } from './kb-reader.js';
import {
  ALL_ARTIFACTS,
  EXTRA_ARTIFACTS,
  calculateCompliance,
  normalizeApprovals,
  normalizeRejections,
  normalizeSchema,
  normalizeStage,
  parseRequirements,
  parseTasks,
  parseTestVerdict,
  type ArtifactStatus,
  type ChangeWithCompliance,
  type OpenSpecChange,
} from './compliance.js';

export const CHANGES_DIR = 'openspec/changes';

export async function listChangeNames(): Promise<string[]> {
  const entries = await kbSource.listDir(CHANGES_DIR);
  return entries
    .filter(e => e.isDirectory && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort();
}

/** Rejects names/paths that could escape openspec/changes/<name>/ */
export function safeChangePath(name: string, file?: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return null;
  const base = `${CHANGES_DIR}/${name}`;
  if (file === undefined) return base;
  const normalized = path.posix.normalize(`${base}/${file.replace(/\\/g, '/')}`);
  return normalized.startsWith(`${base}/`) ? normalized : null;
}

export async function buildChange(
  name: string,
  { detail = false }: { detail?: boolean } = {},
): Promise<ChangeWithCompliance> {
  const base = `${CHANGES_DIR}/${name}`;

  const [sessionContent, statusContent, tasksContent, testReportContent, specsContent] = await Promise.all([
    kbSource.read(`${base}/.session.md`),
    kbSource.read(`${base}/.status`),
    kbSource.read(`${base}/tasks.md`),
    kbSource.read(`${base}/test-report.md`),
    kbSource.read(`${base}/specs.md`),
  ]);
  const frontmatter: Frontmatter = sessionContent ? parseFrontmatter(sessionContent).frontmatter : {};

  // Commit lookups cost one API call per file on GitHub, so only do them for the detail view there
  const withGitInfo = detail || kbSource.mode === 'local';

  const artifactStatus = async (file: string): Promise<ArtifactStatus> => {
    const rel = `${base}/${file}`;
    const exists = await kbSource.exists(rel);
    if (!exists) return { file, exists };

    const [gitInfo, content] = await Promise.all([
      withGitInfo ? kbSource.lastCommit(rel).catch(() => null) : Promise.resolve(null),
      detail ? kbSource.read(rel) : Promise.resolve(null),
    ]);
    return {
      file,
      exists,
      author: gitInfo?.author,
      updatedAt: gitInfo?.date ?? await kbSource.mtime(rel),
      preview: content?.slice(0, 500),
    };
  };

  const [artifactList, extraList] = await Promise.all([
    Promise.all(ALL_ARTIFACTS.map(artifactStatus)),
    Promise.all(EXTRA_ARTIFACTS.map(async file =>
      (await kbSource.exists(`${base}/${file}`)) ? artifactStatus(file) : null)),
  ]);

  const taskItems = parseTasks(tasksContent);
  const started = frontmatter.started_at as unknown;
  const change: OpenSpecChange = {
    name,
    assignee: frontmatter.assignee,
    stage: normalizeStage(statusContent),
    mode: frontmatter.mode ?? 'full',
    schema: normalizeSchema(frontmatter.schema),
    capability: typeof frontmatter.capability === 'string' && frontmatter.capability ? frontmatter.capability : name,
    startedAt: started instanceof Date ? started.toISOString() : frontmatter.started_at,
    project: frontmatter.project ?? 'MT-GRMS',
    artifacts: Object.fromEntries(artifactList.map(a => [a.file, a])),
    extraArtifacts: extraList.filter((a): a is ArtifactStatus => a !== null),
    tasks: taskItems && { done: taskItems.filter(t => t.done).length, total: taskItems.length },
    taskItems,
    requirements: parseRequirements(specsContent),
    testVerdict: parseTestVerdict(testReportContent),
    gate: frontmatter.gate === true,
    approvals: normalizeApprovals(frontmatter.approvals),
    rejections: normalizeRejections(frontmatter.rejections),
  };

  return { ...change, compliance: calculateCompliance(change) };
}

export async function loadAllChanges(): Promise<ChangeWithCompliance[]> {
  const names = await listChangeNames();
  return Promise.all(names.map(name => buildChange(name)));
}
