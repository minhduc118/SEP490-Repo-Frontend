// ─── TeamSpec Monitor — Root Component ───────────────────────────────────────
// Mounted at /teamspec/* — every page has its own URL so links can be shared and survive F5.
import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { TeamSpecLayout, type Page } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ChangesListPage } from './pages/ChangesListPage';
import { ChangeDetailPage } from './pages/ChangeDetailPage';
import { TasksPage } from './pages/TasksPage';
import { SpecsPage } from './pages/SpecsPage';
import { TeamPage } from './pages/TeamPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { TeamSpecLoginPage } from './pages/LoginPage';
import { ApiError, useApiHealth, useMe } from './lib/api';
import { useAuthStore } from './lib/authStore';
import { BASE, teamspecPath } from './lib/routes';
import { cn } from './lib/styles';

function Root({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 antialiased selection:bg-indigo-500/30">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(99,102,241,0.07),transparent)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// ── Server Status Badge ───────────────────────────────────────────────────────
function ServerStatusBadge({ isOnline, sourceLabel }: { isOnline: boolean | undefined; sourceLabel?: string }) {
  if (isOnline === undefined) return null;
  return (
    <div
      title={sourceLabel}
      className={cn(
        'flex items-center gap-2 rounded-full border px-2 py-2 text-[11px] font-semibold md:px-3 md:py-1.5',
        isOnline
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
          : 'border-rose-500/25 bg-rose-500/10 text-rose-700',
      )}
    >
      <span className="relative flex size-2">
        {isOnline && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn('relative inline-flex size-2 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-rose-400')} />
      </span>
      <span className="hidden md:inline">
        {isOnline ? `API Connected${sourceLabel?.startsWith('github') ? ' · GitHub' : ' · Local'}` : 'Mock Data Mode'}
      </span>
    </div>
  );
}

function pageFromPath(pathname: string): Page {
  const seg = pathname.slice(BASE.length).split('/').filter(Boolean)[0];
  return (['changes', 'tasks', 'specs', 'team', 'knowledge'] as const).find(p => p === seg) ?? 'dashboard';
}

function ChangeDetailRoute({ useApi }: { useApi: boolean }) {
  const { name = '' } = useParams();
  const navigate = useNavigate();
  const goBack = () => {
    // idx > 0 means there is an in-app page to return to; otherwise land on the list
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
    else navigate(`${BASE}/changes`);
  };
  return <ChangeDetailPage changeName={name} onBack={goBack} useApi={useApi} />;
}

export function TeamSpecApp() {
  const { isAuthenticated, login, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Health check — detect if Express server is running
  const { data: health, isError: serverOffline } = useApiHealth();
  const isServerOnline = health?.status === 'ok' && !serverOffline;

  // Server online → the server session (password or GitHub) is the source of truth
  const { data: me, error: meError, isLoading: meLoading } = useMe(isServerOnline);
  useEffect(() => {
    if (!isServerOnline) return;
    if (me) login(me);
    else if (meError instanceof ApiError && meError.status === 401) logout();
  }, [isServerOnline, me, meError, login, logout]);

  const openChange = (name: string) => navigate(teamspecPath.change(name));
  const openSpec = (capability: string) => navigate(teamspecPath.spec(capability));

  if (!isAuthenticated) {
    if (isServerOnline && meLoading) return <Root>{null}</Root>;
    return (
      <Root>
        <TeamSpecLoginPage onSuccess={() => navigate(location.pathname + location.search.replace(/[?&]auth_error=[^&]*/g, ''))} serverOnline={isServerOnline} />
      </Root>
    );
  }

  const useApi = isServerOnline;
  return (
    <Root>
      <TeamSpecLayout
        currentPage={pageFromPath(location.pathname)}
        onNavigate={page => navigate(page === 'dashboard' ? BASE : `${BASE}/${page}`)}
        status={<ServerStatusBadge isOnline={isServerOnline} sourceLabel={health?.source?.label} />}
      >
        <Routes>
          <Route index element={<DashboardPage onSelectChange={openChange} useApi={useApi} />} />
          <Route path="changes" element={<ChangesListPage onSelectChange={openChange} useApi={useApi} />} />
          <Route path="changes/:name" element={<ChangeDetailRoute useApi={useApi} />} />
          <Route path="tasks" element={<TasksPage onSelectChange={openChange} useApi={useApi} />} />
          <Route path="specs" element={<SpecsPage onSelectSpec={openSpec} onSelectChange={openChange} useApi={useApi} />} />
          <Route path="specs/:capability" element={<SpecsPage onSelectSpec={openSpec} onSelectChange={openChange} useApi={useApi} />} />
          <Route path="team" element={<TeamPage onSelectChange={openChange} useApi={useApi} />} />
          <Route path="knowledge" element={<KnowledgePage useApi={useApi} />} />
          <Route path="*" element={<Navigate to={BASE} replace />} />
        </Routes>
      </TeamSpecLayout>
    </Root>
  );
}
