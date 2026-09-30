/**
 * TeamSpec Monitor — Express API Server
 * Đọc openspec/changes/ từ team-ai-knowledge (local filesystem hoặc GitHub repo)
 * Dev: port 5000, Vite proxy /api → localhost:5000
 * Production (NODE_ENV=production): also serves the Vite build in dist/ — one service for UI + API
 */
import './lib/load-env.js';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { changesRouter } from './routes/changes.js';
import { statsRouter } from './routes/stats.js';
import { complianceRouter } from './routes/compliance.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { specsRouter } from './routes/specs.js';
import { authRouter } from './routes/auth.js';
import { requestContextMiddleware, requireAuth } from './lib/request-context.js';
import { kbSource } from './lib/kb-source.js';
import { isGithubOAuthEnabled } from './lib/github.js';

const app = express();
const PORT = Number(process.env.PORT ?? 5000);
const IS_PROD = process.env.NODE_ENV === 'production';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

// Render/Railway terminate HTTPS at a proxy — needed for `secure` cookies and req.protocol
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.APP_URL ? [process.env.APP_URL.replace(/\/$/, '')] : []),
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(requestContextMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/changes', requireAuth, changesRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/compliance', requireAuth, complianceRouter);
app.use('/api/knowledge', requireAuth, knowledgeRouter);
app.use('/api/specs', requireAuth, specsRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    source: { mode: kbSource.mode, label: kbSource.label },
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Frontend (production build) ───────────────────────────────────────────────
if (IS_PROD && fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  if (process.env.TEAMSPEC_ONLY !== 'false') {
    app.get('/', (_req, res) => res.redirect('/teamspec'));
  }
  app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(DIST_DIR, { index: false }));
  // SPA fallback — react-router handles /teamspec/... on the client
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else if (IS_PROD) {
  console.warn('[TeamSpec API] dist/index.html not found — run `npm run build` before `npm start`');
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[TeamSpec API] Running on http://localhost:${PORT}${IS_PROD ? ' (production)' : ''}`);
  console.log(`[TeamSpec API] KB source = ${kbSource.label}`);
  console.log(`[TeamSpec API] GitHub login = ${isGithubOAuthEnabled() ? 'enabled' : 'disabled (set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)'}`);
  if (IS_PROD && !process.env.SESSION_SECRET) {
    console.error('[TeamSpec API] SESSION_SECRET is required in production');
  }
});
