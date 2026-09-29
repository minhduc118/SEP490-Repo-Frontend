/**
 * GET /api/compliance — team compliance overview (grouped by assignee)
 */
import { Router } from 'express';
import { loadAllChanges } from '../lib/changes.js';
import { sendError } from '../lib/http.js';
import type { Violation } from '../lib/compliance.js';

export const complianceRouter = Router();

complianceRouter.get('/', async (_req, res) => {
  try {
    const changes = await loadAllChanges();

    const memberMap: Record<string, {
      login: string;
      changes: string[];
      scores: number[];
      violations: Violation[];
    }> = {};
    const violationCounts: Record<string, number> = {};

    for (const change of changes) {
      const login = change.assignee ?? 'unassigned';
      memberMap[login] ??= { login, changes: [], scores: [], violations: [] };
      memberMap[login].changes.push(change.name);
      memberMap[login].scores.push(change.compliance.score);
      memberMap[login].violations.push(...change.compliance.violations);

      for (const v of change.compliance.violations) {
        violationCounts[v.message] = (violationCounts[v.message] ?? 0) + 1;
      }
    }

    const members = Object.values(memberMap).map(m => ({
      login: m.login,
      changesCount: m.changes.length,
      avgScore: m.scores.length > 0
        ? Math.round(m.scores.reduce((a, b) => a + b, 0) / m.scores.length)
        : 0,
      violations: m.violations,
      changes: m.changes,
    }));

    const commonViolations = Object.entries(violationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    res.json({ members, commonViolations });
  } catch (error) {
    sendError(res, error);
  }
});
