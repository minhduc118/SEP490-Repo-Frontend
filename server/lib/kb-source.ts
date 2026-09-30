/**
 * KB source — đọc team-ai-knowledge từ filesystem (local) hoặc GitHub repo (github).
 *   KB_SOURCE=github|local   (mặc định: github nếu có GITHUB_OWNER + GITHUB_REPO)
 */
import fs from 'fs';
import path from 'path';
import { KB_PATH, getFileGitInfo, getGitHistory, readFileLocal, type GitFileInfo } from './kb-reader.js';
import { GITHUB_CONFIG, githubApi, isGithubRepoConfigured, repoSlug } from './github.js';
import { getRequestContext } from './request-context.js';

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export interface KBSource {
  mode: 'local' | 'github';
  label: string;
  listDir(rel: string): Promise<DirEntry[]>;
  exists(rel: string): Promise<boolean>;
  read(rel: string): Promise<string | null>;
  /** Last commit touching the file; null when unknown */
  lastCommit(rel: string): Promise<GitFileInfo | null>;
  /** Cheap modification time (local only) */
  mtime(rel: string): Promise<string | undefined>;
  /** Newest-first commits touching a file or folder */
  history(rel: string, limit?: number): Promise<GitFileInfo[]>;
}

// ── Local ─────────────────────────────────────────────────────────────────────
const localSource: KBSource = {
  mode: 'local',
  label: `local · ${KB_PATH}`,
  async listDir(rel) {
    const full = path.join(KB_PATH, rel);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full, { withFileTypes: true })
      .map(d => ({ name: d.name, isDirectory: d.isDirectory() }));
  },
  async exists(rel) {
    return fs.existsSync(path.join(KB_PATH, rel));
  },
  async read(rel) {
    return readFileLocal(rel);
  },
  async lastCommit(rel) {
    return getFileGitInfo(rel);
  },
  async mtime(rel) {
    try {
      return fs.statSync(path.join(KB_PATH, rel)).mtime.toISOString();
    } catch {
      return undefined;
    }
  },
  async history(rel, limit) {
    return getGitHistory(rel, limit);
  },
};

// ── GitHub ────────────────────────────────────────────────────────────────────
const TREE_TTL_MS = 60_000;

interface TreeEntry { type: 'blob' | 'tree'; sha: string }
let treeCache: { at: number; entries: Map<string, TreeEntry> } | null = null;
let treeRequest: Promise<Map<string, TreeEntry>> | null = null;
const blobCache = new Map<string, string>();
const commitCache = new Map<string, { at: number; info: GitFileInfo | null }>();
const historyCache = new Map<string, { at: number; items: GitFileInfo[] }>();

interface GithubCommit {
  author: { login: string } | null;
  commit: { author: { name: string; email: string; date: string }; message: string };
}

function toInfo(c: GithubCommit): GitFileInfo {
  return {
    author: c.author?.login ?? c.commit.author.name,
    email: c.commit.author.email,
    date: c.commit.author.date,
    message: c.commit.message.split('\n')[0],
  };
}

function token(): string | undefined {
  return getRequestContext().githubToken || GITHUB_CONFIG.serviceToken || undefined;
}

async function loadTree(): Promise<Map<string, TreeEntry>> {
  if (treeCache && Date.now() - treeCache.at < TREE_TTL_MS) return treeCache.entries;
  treeRequest ??= (async () => {
    try {
      const data = await githubApi<{ tree: Array<{ path: string; type: string; sha: string }>; truncated: boolean }>(
        `/repos/${repoSlug()}/git/trees/${encodeURIComponent(GITHUB_CONFIG.branch)}?recursive=1`,
        token(),
      );
      if (data.truncated) console.warn('[TeamSpec API] GitHub tree truncated — some files may be missing');
      const entries = new Map<string, TreeEntry>();
      for (const item of data.tree) {
        if (item.type === 'blob' || item.type === 'tree') {
          entries.set(item.path, { type: item.type, sha: item.sha });
        }
      }
      treeCache = { at: Date.now(), entries };
      return entries;
    } finally {
      treeRequest = null;
    }
  })();
  return treeRequest;
}

/** KB-relative path → repo path */
function repoPath(rel: string): string {
  return GITHUB_CONFIG.kbDir ? `${GITHUB_CONFIG.kbDir}/${rel}` : rel;
}

const githubSource: KBSource = {
  mode: 'github',
  label: `github · ${repoSlug()}@${GITHUB_CONFIG.branch}${GITHUB_CONFIG.kbDir ? `/${GITHUB_CONFIG.kbDir}` : ''}`,
  async listDir(rel) {
    const prefix = repoPath(rel).replace(/\/$/, '') + '/';
    const tree = await loadTree();
    const out: DirEntry[] = [];
    for (const [p, entry] of tree) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (rest && !rest.includes('/')) out.push({ name: rest, isDirectory: entry.type === 'tree' });
    }
    return out;
  },
  async exists(rel) {
    return (await loadTree()).has(repoPath(rel));
  },
  async read(rel) {
    const entry = (await loadTree()).get(repoPath(rel));
    if (!entry || entry.type !== 'blob') return null;
    const cached = blobCache.get(entry.sha);
    if (cached !== undefined) return cached;
    const content = await githubApi<string>(
      `/repos/${repoSlug()}/git/blobs/${entry.sha}`,
      token(),
      'application/vnd.github.raw+json',
    );
    blobCache.set(entry.sha, content);
    return content;
  },
  async lastCommit(rel) {
    const hit = commitCache.get(rel);
    if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.info;
    const params = new URLSearchParams({ path: repoPath(rel), sha: GITHUB_CONFIG.branch, per_page: '1' });
    const commits = await githubApi<GithubCommit[]>(`/repos/${repoSlug()}/commits?${params}`, token());
    const info: GitFileInfo | null = commits[0] ? toInfo(commits[0]) : null;
    commitCache.set(rel, { at: Date.now(), info });
    return info;
  },
  async mtime() {
    return undefined;
  },
  async history(rel, limit = 50) {
    const key = `history:${rel}:${limit}`;
    const hit = historyCache.get(key);
    if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.items;
    const params = new URLSearchParams({ path: repoPath(rel), sha: GITHUB_CONFIG.branch, per_page: String(Math.min(limit, 100)) });
    const commits = await githubApi<GithubCommit[]>(`/repos/${repoSlug()}/commits?${params}`, token());
    const items = commits.map(toInfo);
    historyCache.set(key, { at: Date.now(), items });
    return items;
  },
};

// ── Selection ─────────────────────────────────────────────────────────────────
const requested = process.env.KB_SOURCE?.toLowerCase();
const useGithub = requested === 'github' || (requested !== 'local' && isGithubRepoConfigured());

if (useGithub && !isGithubRepoConfigured()) {
  throw new Error('KB_SOURCE=github requires GITHUB_OWNER and GITHUB_REPO');
}

export const kbSource: KBSource = useGithub ? githubSource : localSource;
