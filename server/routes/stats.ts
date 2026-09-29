/**
 * GET /api/stats — dashboard summary statistics
 */
import { Router } from 'express';
import { loadAllChanges } from '../lib/changes.js';
import { sendError } from '../lib/http.js';

export const statsRouter = Router();

statsRouter.get('/', async (_req, res) => {
  try {
    const changes = await loadAllChanges();
    const archived = changes.filter(c => c.stage === 'archived').length;
    const blocked = changes.filter(c => c.compliance.violations.some(v => v.severity === 'critical')).length;
    const totalScore = changes.reduce((sum, c) => sum + c.compliance.score, 0);

    res.json({
      total: changes.length,
      inProgress: changes.length - archived,
      archived,
      blocked,
      avgScore: changes.length > 0 ? Math.round(totalScore / changes.length) : 0,
    });
  } catch (error) {
    sendError(res, error);
  }
});
