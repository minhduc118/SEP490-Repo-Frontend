// ─── TeamSpec Monitor — Login Page ───────────────────────────────────────────
import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../lib/authStore';
import { TEAM_MEMBERS, verifyCredentials } from '../lib/teamMembers';
import { ApiError, GITHUB_LOGIN_URL, loginWithPassword, useAuthConfig } from '../lib/api';
import { Logo } from '../components/Layout';
import { Button } from '../components/ui';
import { cn, inputClass } from '../lib/styles';

interface TeamSpecLoginPageProps {
  onSuccess: () => void;
  serverOnline: boolean;
}

const OAUTH_ERRORS: Record<string, string> = {
  not_team_member: 'Tài khoản GitHub này không phải collaborator của repo nhóm',
  access_denied: 'Bạn đã huỷ đăng nhập GitHub',
  invalid_state: 'Phiên đăng nhập GitHub hết hạn, thử lại',
  github_not_configured: 'Server chưa cấu hình GitHub OAuth (GITHUB_CLIENT_ID / SECRET)',
  github_error: 'Không kết nối được GitHub, thử lại sau',
  missing_code: 'GitHub không trả về mã xác thực, thử lại',
};

function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('auth_error');
  if (!code) return null;
  const message = OAUTH_ERRORS[code] ?? 'Đăng nhập GitHub thất bại';
  const user = params.get('user');
  return user ? `${message} (@${user})` : message;
}

function clearOAuthErrorParam(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('auth_error')) return;
  params.delete('auth_error');
  params.delete('user');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function TeamSpecLoginPage({ onSuccess, serverOnline }: TeamSpecLoginPageProps) {
  const login = useAuthStore(s => s.login);
  const queryClient = useQueryClient();
  const { data: config } = useAuthConfig(serverOnline);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(readOAuthError);
  const [submitting, setSubmitting] = useState(false);

  useEffect(clearOAuthErrorParam, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập username và password');
      return;
    }

    if (!serverOnline) {
      const user = verifyCredentials(username, password);
      if (!user) {
        setError('Sai username hoặc password');
        return;
      }
      login({ ...user, provider: 'offline' });
      onSuccess();
      return;
    }

    setSubmitting(true);
    try {
      const user = await loginWithPassword(username, password);
      queryClient.setQueryData(['auth', 'me'], user);
      login(user);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được server');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePick(memberLogin: string) {
    setUsername(memberLogin);
    setPassword('');
    setError(null);
    document.getElementById('ts-login-password')?.focus();
  }

  const githubReady = serverOnline && !!config?.github;

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative w-full max-w-sm animate-pop-in rounded-3xl border border-white/10 bg-zinc-900/70 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white">TeamSpec Monitor</h1>
          <p className="mt-1 text-xs text-zinc-500">MT-GRMS · SEP490 Group 84</p>
        </div>

        <a
          href={githubReady ? GITHUB_LOGIN_URL : undefined}
          aria-disabled={!githubReady}
          title={
            !serverOnline ? 'Cần chạy API server (npm run server)'
            : !config?.github ? 'Server chưa cấu hình GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET'
            : `Chỉ collaborator của ${config.repo ?? 'repo nhóm'}`
          }
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition-all',
            githubReady
              ? 'bg-white text-zinc-900 shadow-lg shadow-white/10 hover:bg-zinc-200'
              : 'cursor-not-allowed bg-white/10 text-zinc-500',
          )}
        >
          <GithubIcon /> Sign in with GitHub
        </a>
        {githubReady && config?.repo && (
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            Dành cho collaborator của <code className="font-mono text-zinc-400">{config.repo}</code>
          </p>
        )}

        <Divider>hoặc tài khoản nhóm</Divider>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Username</span>
            <input
              id="ts-login-username"
              className={inputClass}
              autoComplete="username"
              placeholder="userA"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(null); }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Password</span>
            <input
              id="ts-login-password"
              className={inputClass}
              type="password"
              autoComplete="current-password"
              placeholder="sgms2026"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
            />
          </label>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              ⚠ {error}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={submitting} className="mt-1 h-10 w-full rounded-xl">
            {submitting ? 'Signing in…' : 'Sign in →'}
          </Button>
        </div>

        <Divider>Quick pick</Divider>
        <div className="flex flex-wrap justify-center gap-1.5">
          {TEAM_MEMBERS.map(m => (
            <button
              key={m.login}
              type="button"
              onClick={() => handlePick(m.login)}
              title={`${m.name} · ${m.role}`}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                username === m.login
                  ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-200'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200',
              )}
            >
              {m.login}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

function Divider({ children }: { children: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-600">
      <span className="h-px flex-1 bg-white/10" />
      {children}
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
