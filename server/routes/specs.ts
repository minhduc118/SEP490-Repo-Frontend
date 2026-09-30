/**
 * GET /api/specs              — capabilities in openspec/specs/ (+ open changes targeting each)
 * GET /api/specs/:capability  — full spec.md of one capability
 */
import { Router } from 'express';
import { kbSource } from '../lib/kb-source.js';
import { loadAllChanges } from '../lib/changes.js';
import { sendError } from '../lib/http.js';
import { parseSpecDoc, type SpecDetail, type SpecSummary } from '../../src/features/teamspec/lib/specs.ts';

export const specsRouter = Router();

const SPECS_DIR = 'openspec/specs';
const CAPABILITY = /^[a-z0-9][a-z0-9-]*$/;

async function openChangesByCapability(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const c of await loadAllChanges()) {
    if (c.stage === 'archived') continue;
    const cap = c.capability || c.name;
    map.set(cap, [...(map.get(cap) ?? []), c.name]);
  }
  return map;
}

async function summarize(capability: string, open: string[]): Promise<SpecSummary & { content: string | null }> {
  const rel = `${SPECS_DIR}/${capability}/spec.md`;
  const content = await kbSource.read(rel);
  if (content === null) return { capability, requirements: [], history: [], openChanges: open, exists: false, content };
  const parsed = parseSpecDoc(content);
  const git = await kbSource.lastCommit(rel).catch(() => null);
  return {
    capability,
    requirements: parsed.requirements.map(r => r.name),
    history: parsed.history,
    updatedAt: git?.date ?? await kbSource.mtime(rel),
    author: git?.author,
    openChanges: open,
    exists: true,
    content,
  };
}

specsRouter.get('/', async (_req, res) => {
  try {
    const [entries, open] = await Promise.all([kbSource.listDir(SPECS_DIR), openChangesByCapability()]);
    const caps = new Set([
      ...entries.filter(e => e.isDirectory && CAPABILITY.test(e.name)).map(e => e.name),
      ...open.keys(),
    ]);
    const specs = await Promise.all([...caps].sort().map(async cap => {
      const { content: _content, ...summary } = await summarize(cap, open.get(cap) ?? []);
      return summary;
    }));
    res.json({ specs });
  } catch (error) {
    sendError(res, error);
  }
});

specsRouter.get('/:capability', async (req, res) => {
  try {
    const cap = req.params.capability;
    if (!CAPABILITY.test(cap)) return res.status(400).json({ error: 'Invalid capability' });
    const open = (await openChangesByCapability()).get(cap) ?? [];
    const { content, ...summary } = await summarize(cap, open);
    if (content === null && open.length === 0) return res.status(404).json({ error: `Spec "${cap}" not found` });
    const detail: SpecDetail = {
      ...summary,
      content: content ?? '',
      parsed: { requirements: content ? parseSpecDoc(content).requirements : [] },
    };
    res.json(detail);
  } catch (error) {
    sendError(res, error);
  }
});
