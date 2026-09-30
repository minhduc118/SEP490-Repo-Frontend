/**
 * GET /api/changes                      — list tất cả changes với compliance
 * GET /api/changes/:name                — chi tiết 1 change + preview artifacts
 * GET /api/changes/:name/activity      — timeline (git commits + approvals + improvements)
 * GET /api/changes/:name/artifact?file= — full content 1 artifact
 */
import { Router } from 'express';
import { kbSource } from '../lib/kb-source.js';
import { buildChange, loadAllChanges, safeChangePath } from '../lib/changes.js';
import { sendError } from '../lib/http.js';
import { buildActivity } from '../../src/features/teamspec/lib/activity.ts';

export const changesRouter = Router();

changesRouter.get('/', async (_req, res) => {
  try {
    const changes = await loadAllChanges();
    res.json({
      changes,
      meta: {
        source: kbSource.label,
        total: changes.length,
        ...(changes.length === 0 && {
          hint: 'No changes found. Create openspec/changes/<name>/.session.md to start.',
        }),
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

changesRouter.get('/:name', async (req, res) => {
  try {
    const base = safeChangePath(req.params.name);
    if (!base) return res.status(400).json({ error: 'Invalid change name' });
    if (!(await kbSource.exists(base))) {
      return res.status(404).json({ error: `Change "${req.params.name}" not found` });
    }
    res.json(await buildChange(req.params.name, { detail: true }));
  } catch (error) {
    sendError(res, error);
  }
});

changesRouter.get('/:name/activity', async (req, res) => {
  try {
    const base = safeChangePath(req.params.name);
    if (!base) return res.status(400).json({ error: 'Invalid change name' });
    if (!(await kbSource.exists(base))) {
      return res.status(404).json({ error: `Change "${req.params.name}" not found` });
    }
    const [commits, session, summary, improvements] = await Promise.all([
      kbSource.history(base, 100).catch(() => []),
      kbSource.read(`${base}/.session.md`),
      kbSource.read(`${base}/summary.md`),
      kbSource.read(`${base}/improvements.md`),
    ]);
    res.json({ items: buildActivity({ commits, session, summary, improvements }), source: commits.length ? 'git' : 'session' });
  } catch (error) {
    sendError(res, error);
  }
});

changesRouter.get('/:name/artifact', async (req, res) => {
  try {
    const file = req.query['file'];
    if (typeof file !== 'string' || !file) {
      return res.status(400).json({ error: 'Missing ?file= parameter' });
    }
    const relativePath = safeChangePath(req.params.name, file);
    if (!relativePath) return res.status(403).json({ error: 'Forbidden' });

    const content = await kbSource.read(relativePath);
    if (content === null) return res.status(404).json({ error: 'File not found' });

    const gitInfo = await kbSource.lastCommit(relativePath).catch(() => null);
    res.json({ file, content, gitInfo });
  } catch (error) {
    sendError(res, error);
  }
});
