/**
 * Auth routes
 *   GET  /api/auth/config           — login methods available
 *   GET  /api/auth/github           — redirect to GitHub OAuth
 *   GET  /api/auth/github/callback  — OAuth callback → session cookie → /teamspec
 *   POST /api/auth/login            — username/password (team credentials)
 *   GET  /api/auth/me               — current session user
 *   POST /api/auth/logout
 */
import { Router } from 'express';
import { verifyCredentials } from '../../src/features/teamspec/lib/teamMembers.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  githubApi,
  isGithubOAuthEnabled,
  isGithubRepoConfigured,
  repoSlug,
  resolveTeamRole,
  type GithubUser,
} from '../lib/github.js';
import { clearSession, consumeOAuthState, createOAuthState, writeSession } from '../lib/session.js';
import { getRequestContext } from '../lib/request-context.js';
import { kbSource } from '../lib/kb-source.js';

export const authRouter = Router();

const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const APP_HOME = `${APP_URL}/teamspec`;
const CALLBACK_URL = `${APP_URL}/api/auth/github/callback`;

authRouter.get('/config', (_req, res) => {
  res.json({
    github: isGithubOAuthEnabled(),
    password: true,
    repo: isGithubRepoConfigured() ? repoSlug() : null,
    source: kbSource.mode,
  });
});

authRouter.get('/github', (_req, res) => {
  if (!isGithubOAuthEnabled()) {
    return res.redirect(`${APP_HOME}?auth_error=github_not_configured`);
  }
  const state = createOAuthState(res);
  console.log('[TeamSpec API] GitHub login started → redirecting to github.com');
  res.redirect(buildAuthorizeUrl(CALLBACK_URL, state));
});

authRouter.get('/github/callback', async (req, res) => {
  const fail = (code: string) => {
    console.warn(`[TeamSpec API] GitHub login failed: ${code}`);
    res.redirect(`${APP_HOME}?auth_error=${code}`);
  };

  if (req.query['error']) return fail('access_denied');
  if (!consumeOAuthState(req, res, req.query['state'])) return fail('invalid_state');

  const code = req.query['code'];
  if (typeof code !== 'string') return fail('missing_code');

  try {
    const token = await exchangeCodeForToken(code, CALLBACK_URL);
    const ghUser = await githubApi<GithubUser>('/user', token);
    const role = await resolveTeamRole(ghUser, token);
    if (!role) return fail(`not_team_member&user=${encodeURIComponent(ghUser.login)}`);
    console.log(`[TeamSpec API] GitHub login OK: @${ghUser.login} (${role})`);

    writeSession(res, {
      login: ghUser.login,
      name: ghUser.name ?? ghUser.login,
      role,
      avatarUrl: ghUser.avatar_url,
      provider: 'github',
    }, token);
    res.redirect(APP_HOME);
  } catch (error) {
    console.error('[TeamSpec API] GitHub OAuth failed:', error);
    fail('github_error');
  }
});

authRouter.post('/login', (req, res) => {
  const { login, password } = (req.body ?? {}) as { login?: unknown; password?: unknown };

  if (typeof login !== 'string' || typeof password !== 'string' || !login.trim() || !password) {
    return res.status(400).json({ error: 'login and password are required' });
  }

  const member = verifyCredentials(login, password);
  if (!member) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = { ...member, provider: 'password' as const };
  writeSession(res, user);
  res.json({ user });
});

authRouter.get('/me', (_req, res) => {
  const { user } = getRequestContext();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});