/**
 * KB source — đọc team-ai-knowledge từ filesystem (local) hoặc GitHub repo (github).
 *   KB_SOURCE=github|local   (mặc định: github nếu có GITHUB_OWNER + GITHUB_REPO)
 */
import fs from 'fs';
import path from 'path';
import { KB_PATH, getFileGitInfo, readFileLocal, type GitFileInfo } from './kb-reader.js';
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
};

// ── GitHub ────────────────────────────────────────────────────────────────────
const TREE_TTL_MS = 60_000;

interface TreeEntry { type: 'blob' | 'tree'; sha: string }
let treeCache: { at: number; entries: Map<string, TreeEntry> } | null = null;
let treeRequest: Promise<Map<string, TreeEntry>> | null = null;
const blobCache = new Map<string, string>();
const commitCache = new Map<string, { at: number; info: GitFileInfo | null }>();

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

const githubSource: KBSource = {
  mode: 'github',
  label: `github · ${repoSlug()}@${GITHUB_CONFIG.branch}`,
  async listDir(rel) {
    const prefix = rel.replace(/\/$/, '') + '/';
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
    return (await loadTree()).has(rel);
  },
  async read(rel) {
    const entry = (await loadTree()).get(rel);
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
    const params = new URLSearchParams({ path: rel, sha: GITHUB_CONFIG.branch, per_page: '1' });
    const commits = await githubApi<Array<{
      author: { login: string } | null;
      commit: { author: { name: string; email: string; date: string }; message: string };
    }>>(`/repos/${repoSlug()}/commits?${params}`, token());
    const c = commits[0];
    const info: GitFileInfo | null = c
      ? {
          author: c.author?.login ?? c.commit.author.name,
          email: c.commit.author.email,
          date: c.commit.author.date,
          message: c.commit.message.split('\n')[0],
        }
      : null;
    commitCache.set(rel, { at: Date.now(), info });
    return info;
  },
  async mtime() {
    return undefined;
  },
};

// ── Selection ─────────────────────────────────────────────────────────────────
const requested = process.env.KB_SOURCE?.toLowerCase();
const useGithub = requested === 'github' || (requested !== 'local' && isGithubRepoConfigured());

if (useGithub && !isGithubRepoConfigured()) {
  throw new Error('KB_SOURCE=github requires GITHUB_OWNER and GITHUB_REPO');
}

export const kbSource: KBSource = useGithub ? githubSource : localSource;
