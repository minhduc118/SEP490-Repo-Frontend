// ─── TeamSpec Monitor — Sidebar + Layout ─────────────────────────────────────
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../lib/authStore';
import { logoutFromServer } from '../lib/api';
import { Avatar } from './SharedComponents';
import { cn } from '../lib/styles';

export type Page = 'dashboard' | 'changes' | 'tasks' | 'specs' | 'team' | 'knowledge';

interface TeamSpecLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  status?: ReactNode;
}

const NAV_ITEMS: { key: Page; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'changes',   icon: '🔄', label: 'Changes' },
  { key: 'tasks',     icon: '☑️', label: 'Tasks' },
  { key: 'specs',     icon: '📐', label: 'Specs' },
  { key: 'team',      icon: '👥', label: 'Team' },
  { key: 'knowledge', icon: '📚', label: 'Knowledge' },
];

export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 shadow-lg shadow-indigo-500/30',
        size === 'lg' ? 'size-12 text-2xl' : 'size-8 text-base',
      )}
    >
      ⚡
    </span>
  );
}

export function TeamSpecLayout({ children, currentPage, onNavigate, status }: TeamSpecLayoutProps) {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    if (user?.provider !== 'offline') await logoutFromServer();
    queryClient.setQueryData(['auth', 'me'], null);
    logout();
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 z-40 flex shrink-0 flex-row items-center gap-2 border-b border-zinc-200 bg-white/80 px-3 py-2 backdrop-blur-xl md:h-screen md:w-60 md:flex-col md:items-stretch md:gap-0 md:border-b-0 md:border-r md:p-0">
        <div className="flex items-center gap-3 md:border-b md:border-zinc-200 md:px-4 md:py-5">
          <Logo />
          <div className="hidden sm:block">
            <div className="text-sm font-bold tracking-tight text-zinc-900">TeamSpec</div>
            <div className="text-[11px] text-zinc-500">Monitor · G84</div>
          </div>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto scrollbar-thin md:flex-col md:overflow-visible md:p-3">
          {NAV_ITEMS.map(item => {
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-indigo-500 md:block" />}
                <span className="text-base leading-none">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Bottom info ── */}
        <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-3 md:border-t md:border-zinc-200 md:p-3">
          {status && <div className="md:self-start">{status}</div>}
          {user && (
            <div className="flex items-center gap-2 md:rounded-xl md:bg-zinc-50 md:p-2">
              <Avatar login={user.login} src={user.avatarUrl} size="md" />
              <div className="hidden min-w-0 flex-1 md:block" title={`${user.name} · ${user.role}`}>
                <div className="truncate text-sm font-medium text-zinc-900">{user.name}</div>
                <div className="truncate text-[11px] capitalize text-zinc-500">
                  {user.role}{user.provider === 'github' && <> · @{user.login}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-700"
              >
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          <div className="hidden px-1 text-[11px] leading-relaxed text-zinc-500 md:block">
            <div className="font-semibold text-zinc-600">MT-GRMS</div>
            <div>SEP490 · Group 84 · <span className="text-indigo-700">v1.0.0</span></div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-4 py-6 sm:px-6 md:px-8 md:py-8 2xl:px-10">{children}</div>
      </main>
    </div>
  );
}
