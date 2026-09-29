/**
 * TeamSpec Monitor — Express API Server
 * Đọc openspec/changes/ từ team-ai-knowledge (local filesystem hoặc GitHub repo)
 * Chạy trên port 5000, Vite proxy /api → localhost:5000
 */
import './lib/load-env.js';
import express from 'express';
import cors from 'cors';
import { changesRouter } from './routes/changes.js';
import { statsRouter } from './routes/stats.js';
import { complianceRouter } from './routes/compliance.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { authRouter } from './routes/auth.js';
import { requestContextMiddleware, requireAuth } from './lib/request-context.js';
import { kbSource } from './lib/kb-source.js';
import { isGithubOAuthEnabled } from './lib/github.js';

const app = express();
const PORT = process.env.PORT ?? 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json());
app.use(requestContextMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/changes', requireAuth, changesRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/compliance', requireAuth, complianceRouter);
app.use('/api/knowledge', requireAuth, knowledgeRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    source: { mode: kbSource.mode, label: kbSource.label },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[TeamSpec API] Running on http://localhost:${PORT}`);
  console.log(`[TeamSpec API] KB source = ${kbSource.label}`);
  console.log(`[TeamSpec API] GitHub login = ${isGithubOAuthEnabled() ? 'enabled' : 'disabled (set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)'}`);
});
