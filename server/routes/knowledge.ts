/**
 * GET /api/knowledge — browse KB documents (patterns, decisions, lessons, sessions)
 * ?type=pattern|decision|lesson|session  (optional filter)
 * ?query=search_term                     (optional text search)
 */
import { Router } from 'express';
import { parseFrontmatter } from '../lib/kb-reader.js';
import { kbSource } from '../lib/kb-source.js';
import { sendError } from '../lib/http.js';

export const knowledgeRouter = Router();

type KBDocType = 'pattern' | 'decision' | 'lesson' | 'session' | 'guide';

interface KBDocument {
  id: string;
  type: KBDocType;
  title: string;
  scope?: string;
  status?: string;
  tags?: string[];
  preview: string;
  updatedAt?: string;
  projectName?: string;
  path: string;
}

const TYPE_DIRS: Record<KBDocType, string[]> = {
  pattern:  ['_global/patterns', 'projects/MT-GRMS/patterns'],
  decision: ['_global/decisions', 'projects/MT-GRMS/decisions'],
  lesson:   ['_global/lessons', 'projects/MT-GRMS/lessons'],
  session:  ['openspec/changes'],  // .session.md files
  guide:    ['docs', '_global/guides'],
};

/** Files to index for a type: *.md in each dir, or <change>/.session.md for sessions */
async function listDocPaths(type: KBDocType): Promise<string[]> {
  const paths: string[] = [];
  for (const dir of TYPE_DIRS[type] ?? []) {
    const entries = await kbSource.listDir(dir);
    for (const entry of entries) {
      if (type === 'session') {
        if (entry.isDirectory && !entry.name.startsWith('.')) {
          const sessionPath = `${dir}/${entry.name}/.session.md`;
          if (await kbSource.exists(sessionPath)) paths.push(sessionPath);
        }
      } else if (!entry.isDirectory && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        paths.push(`${dir}/${entry.name}`);
      }
    }
  }
  return paths;
}

async function readKBDocs(type: KBDocType): Promise<KBDocument[]> {
  const docs: KBDocument[] = [];

  for (const relativePath of await listDocPaths(type)) {
    try {
      const content = await kbSource.read(relativePath);
      if (!content) continue;
      const fileName = type === 'session'
        ? `${relativePath.split('/').slice(-2, -1)[0]}.md`
        : relativePath.split('/').pop()!;

      const { frontmatter, body } = parseFrontmatter(content);

      // Extract title: from frontmatter or first # heading
      let title = (frontmatter.title as string) ?? '';
      if (!title) {
        const headingMatch = body.match(/^#\s+(.+)/m);
        title = headingMatch ? headingMatch[1].trim() : fileName.replace('.md', '');
      }

      // Extract preview: first non-empty paragraph after frontmatter
      const preview = body
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
        .slice(0, 3)
        .join(' ')
        .slice(0, 300);

      const updatedAt = await kbSource.mtime(relativePath);

      docs.push({
        id: `${type}-${fileName.replace(/[^a-z0-9]/gi, '-')}`,
        type,
        title,
        scope: (frontmatter.scope as string) ?? undefined,
        status: (frontmatter.status as string) ?? undefined,
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags as string[] : undefined,
        preview,
        updatedAt,
        projectName: (frontmatter.project as string) ?? undefined,
        path: relativePath,
      });
    } catch { /* skip unreadable file */ }
  }

  return docs;
}

knowledgeRouter.get('/', async (req, res) => {
  try {
    const typeParam = req.query['type'] as KBDocType | undefined;
    const query = String(req.query['query'] ?? '').toLowerCase();

    const types: KBDocType[] = typeParam && typeParam in TYPE_DIRS
      ? [typeParam]
      : ['guide', 'pattern', 'decision', 'lesson', 'session'];

    let docs = (await Promise.all(types.map(t => readKBDocs(t)))).flat();

    if (query) {
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.preview.toLowerCase().includes(query) ||
        (d.tags ?? []).some(t => t.toLowerCase().includes(query))
      );
    }

    // Sort by updatedAt desc
    docs.sort((a, b) => {
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    res.json({ docs, total: docs.length });
  } catch (error) {
    sendError(res, error);
  }
});
