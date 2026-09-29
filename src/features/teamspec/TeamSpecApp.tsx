// ─── TeamSpec Monitor — Root Component ───────────────────────────────────────
import { useEffect, useState, type ReactNode } from 'react';
import { TeamSpecLayout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ChangesListPage } from './pages/ChangesListPage';
import { ChangeDetailPage } from './pages/ChangeDetailPage';
import { TeamPage } from './pages/TeamPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { TeamSpecLoginPage } from './pages/LoginPage';
import { ApiError, useApiHealth, useMe } from './lib/api';
import { useAuthStore } from './lib/authStore';
import { cn } from './lib/styles';

type Page = 'dashboard' | 'changes' | 'team' | 'knowledge';

function Root({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-indigo-500/30">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(99,102,241,0.18),transparent)]"
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
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
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

export function TeamSpecApp() {
  const { isAuthenticated, login, logout } = useAuthStore();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedChange, setSelectedChange] = useState<string | null>(null);

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

  function handleSelectChange(name: string) {
    setSelectedChange(name);
    setCurrentPage('changes');
  }

  function handleNavigate(page: Page) {
    setCurrentPage(page);
    if (page !== 'changes') setSelectedChange(null);
  }

  function renderPage() {
    // Change detail — hiển thị khi chọn 1 change từ bất kỳ trang nào
    if (selectedChange) {
      return (
        <ChangeDetailPage
          changeName={selectedChange}
          onBack={() => setSelectedChange(null)}
          useApi={isServerOnline}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onSelectChange={handleSelectChange} useApi={isServerOnline} />;
      case 'changes':
        return <ChangesListPage onSelectChange={handleSelectChange} useApi={isServerOnline} />;
      case 'team':
        return <TeamPage onSelectChange={handleSelectChange} useApi={isServerOnline} />;
      case 'knowledge':
        return <KnowledgePage useApi={isServerOnline} />;
      default:
        return <DashboardPage onSelectChange={handleSelectChange} useApi={isServerOnline} />;
    }
  }

  if (!isAuthenticated) {
    if (isServerOnline && meLoading) return <Root>{null}</Root>;
    return (
      <Root>
        <TeamSpecLoginPage onSuccess={() => setCurrentPage('dashboard')} serverOnline={isServerOnline} />
      </Root>
    );
  }

  return (
    <Root>
      <TeamSpecLayout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        status={<ServerStatusBadge isOnline={isServerOnline} sourceLabel={health?.source?.label} />}
      >
        {renderPage()}
      </TeamSpecLayout>
    </Root>
  );
}
