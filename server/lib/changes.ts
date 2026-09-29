/**
 * Build OpenSpec change objects (with compliance) from the active KB source.
 */
import path from 'path';
import { kbSource } from './kb-source.js';
import { parseFrontmatter, type Frontmatter } from './kb-reader.js';
import {
  ALL_ARTIFACTS,
  calculateCompliance,
  normalizeStage,
  parseTaskProgress,
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

  const [sessionContent, statusContent, tasksContent, testReportContent] = await Promise.all([
    kbSource.read(`${base}/.session.md`),
    kbSource.read(`${base}/.status`),
    kbSource.read(`${base}/tasks.md`),
    kbSource.read(`${base}/test-report.md`),
  ]);
  const frontmatter: Frontmatter = sessionContent ? parseFrontmatter(sessionContent).frontmatter : {};

  // Commit lookups cost one API call per file on GitHub, so only do them for the detail view there
  const withGitInfo = detail || kbSource.mode === 'local';

  const artifactList = await Promise.all(ALL_ARTIFACTS.map(async (file): Promise<ArtifactStatus> => {
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
  }));

  const change: OpenSpecChange = {
    name,
    assignee: frontmatter.assignee,
    stage: normalizeStage(statusContent),
    mode: frontmatter.mode ?? 'full',
    startedAt: frontmatter.started_at,
    project: frontmatter.project ?? 'MT-GRMS',
    artifacts: Object.fromEntries(artifactList.map(a => [a.file, a])),
    tasks: parseTaskProgress(tasksContent),
    testVerdict: parseTestVerdict(testReportContent),
  };

  return { ...change, compliance: calculateCompliance(change) };
}

export async function loadAllChanges(): Promise<ChangeWithCompliance[]> {
  const names = await listChangeNames();
  return Promise.all(names.map(name => buildChange(name)));
}
