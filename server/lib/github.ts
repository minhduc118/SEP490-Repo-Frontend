/**
 * GitHub REST helpers — OAuth + repository reads for the team KB repo.
 */

export const GITHUB_CONFIG = {
  clientId: process.env.GITHUB_CLIENT_ID ?? '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  scope: process.env.GITHUB_OAUTH_SCOPE ?? 'read:user repo',
  owner: process.env.GITHUB_OWNER ?? '',
  repo: process.env.GITHUB_REPO ?? '',
  branch: process.env.GITHUB_BRANCH ?? 'main',
  /** Folder of the KB inside the repo, e.g. "team-ai-knowledge" for minhduc118/ai-team-kit */
  kbDir: (process.env.GITHUB_KB_DIR ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''),
  serviceToken: process.env.GITHUB_TOKEN ?? '',
  allowedUsers: (process.env.GITHUB_ALLOWED_USERS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
};

export const isGithubOAuthEnabled = () => !!(GITHUB_CONFIG.clientId && GITHUB_CONFIG.clientSecret);
export const isGithubRepoConfigured = () => !!(GITHUB_CONFIG.owner && GITHUB_CONFIG.repo);
export const repoSlug = () => `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;

export class GithubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function githubApi<T>(
  apiPath: string,
  token?: string,
  accept = 'application/vnd.github+json',
): Promise<T> {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: accept,
      'User-Agent': 'teamspec-monitor',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GithubError(res.status, `GitHub ${res.status} ${apiPath}: ${body.slice(0, 200)}`);
  }
  return (accept.includes('raw') ? res.text() : res.json()) as Promise<T>;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CONFIG.clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_CONFIG.scope,
    state,
    allow_signup: 'false',
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CONFIG.clientId,
      client_secret: GITHUB_CONFIG.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description ?? 'OAuth token exchange failed');
  return data.access_token;
}

export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface GithubRepo {
  private: boolean;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean; pull?: boolean };
}

/**
 * Team member = collaborator on the KB repo (push access), or listed in GITHUB_ALLOWED_USERS.
 * Public repos grant everyone "pull", so pull alone only counts for private repos.
 */
export async function resolveTeamRole(
  user: GithubUser,
  token: string,
): Promise<'admin' | 'member' | null> {
  const allowListed = GITHUB_CONFIG.allowedUsers.includes(user.login.toLowerCase());
  if (!isGithubRepoConfigured()) return allowListed ? 'member' : null;

  try {
    const repo = await githubApi<GithubRepo>(`/repos/${repoSlug()}`, token);
    const p = repo.permissions ?? {};
    if (p.admin) return 'admin';
    if (p.maintain || p.push || p.triage || (repo.private && p.pull)) return 'member';
  } catch (err) {
    if (!(err instanceof GithubError && err.status === 404)) throw err;
  }
  return allowListed ? 'member' : null;
}
