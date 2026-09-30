// ─── TeamSpec Monitor — Knowledge Page ───────────────────────────────────────
// Browse KB documents từ team-ai-knowledge
// Hiện tại dùng mock data — sau kết nối với filesystem reader
import { useState, useMemo } from 'react';
import { CloseButton, EmptyState, Modal, PageHeader, SearchInput } from '../components/ui';
import { cn } from '../lib/styles';

interface KBDocument {
  id: string;
  type: 'pattern' | 'decision' | 'lesson' | 'session' | 'guide';
  title: string;
  scope?: string;
  tags?: string[];
  preview: string;
  updatedAt?: string;
  project?: string;
  path?: string;
}

// ─── Mock KB data (lấy từ team-ai-knowledge structure) ───────────────────────
const MOCK_KB_DOCS: KBDocument[] = [
  {
    id: 'openspec-workflow',
    type: 'guide',
    title: 'OpenSpec Workflow — SBU2 Standard',
    scope: 'global',
    tags: ['workflow', 'openspec', 'compliance'],
    preview: 'OpenSpec là workflow chuẩn của SBU2 để implement các feature. Gồm 6 bước bắt buộc, mỗi bước là một lệnh: /sep-spec → /sep-brainstorm → /sep-verify-spec → /sep-apply → /sep-test → /sep-archive.',
    updatedAt: '2026-09-20T10:00:00Z',
    project: 'MT-GRMS',
    path: 'system_flow.md',
  },
  {
    id: 'fefo-batch-pattern',
    type: 'pattern',
    title: 'FEFO Batch Tracking — Data Pattern',
    scope: 'MT-GRMS',
    tags: ['fefo', 'inventory', 'batch'],
    preview: 'Sử dụng FEFO (First Expired First Out) để quản lý hàng tồn kho theo lô. Mỗi lô phải có batch_id, expiry_date, và quantity_remaining.',
    updatedAt: '2026-09-19T14:00:00Z',
    project: 'MT-GRMS',
    path: 'projects/MT-GRMS/patterns/fefo-batch.md',
  },
  {
    id: 'auth-decision',
    type: 'decision',
    title: 'Authentication Strategy — JWT vs Session',
    scope: 'MT-GRMS',
    tags: ['auth', 'jwt', 'security'],
    preview: 'Quyết định dùng JWT stateless với refresh token pattern. Lý do: hỗ trợ multi-tenant, dễ scale horizontal. Trade-off: cần revoke logic phức tạp hơn.',
    updatedAt: '2026-09-18T08:00:00Z',
    project: 'MT-GRMS',
    path: 'projects/MT-GRMS/decisions/auth-strategy.md',
  },
  {
    id: 'pos-payment-lesson',
    type: 'lesson',
    title: 'POS Payment QR — Lesson Learned',
    scope: 'MT-GRMS',
    tags: ['pos', 'payment', 'qr', 'lesson'],
    preview: 'Bài học: QR code timeout cần xử lý race condition khi người dùng quét đúng lúc token hết hạn. Giải pháp: grace period 30s + polling status.',
    updatedAt: '2026-09-15T09:00:00Z',
    project: 'MT-GRMS',
    path: 'projects/MT-GRMS/lessons/pos-qr-timeout.md',
  },
  {
    id: 'supplier-mgmt-pattern',
    type: 'pattern',
    title: 'Supplier Management — Repository Pattern',
    scope: 'MT-GRMS',
    tags: ['supplier', 'repository', 'ddd'],
    preview: 'SupplierRepository abstraction để decouple business logic khỏi data access. Dùng với Unit of Work pattern để đảm bảo transactional consistency.',
    updatedAt: '2026-09-21T11:00:00Z',
    project: 'MT-GRMS',
    path: 'projects/MT-GRMS/patterns/supplier-repository.md',
  },
  {
    id: 'teamspec-guide',
    type: 'guide',
    title: 'TeamSpec Monitor — Usage Guide',
    scope: 'global',
    tags: ['teamspec', 'guide', 'tool'],
    preview: 'Hướng dẫn sử dụng TeamSpec Monitor để theo dõi compliance của team khi implement feature theo OpenSpec workflow.',
    updatedAt: '2026-09-22T15:00:00Z',
    project: 'META',
    path: 'docs/teamspec-guide.md',
  },
  {
    id: 'inventory-dashboard-session',
    type: 'session',
    title: 'Session: inventory-dashboard',
    scope: 'MT-GRMS',
    tags: ['inventory', 'dashboard', 'session'],
    preview: 'Session notes cho change inventory-dashboard. Assignee: userA. Đang ở stage Review. Target: dashboard tổng hợp tồn kho theo location + category.',
    updatedAt: '2026-09-19T14:30:00Z',
    project: 'MT-GRMS',
    path: 'openspec/changes/inventory-dashboard/.session.md',
  },
  {
    id: 'cart-checkout-session',
    type: 'session',
    title: 'Session: cart-checkout-bug',
    scope: 'MT-GRMS',
    tags: ['cart', 'checkout', 'bug', 'session'],
    preview: 'Session notes cho change cart-checkout-bug. Assignee: userB. CRITICAL VIOLATION: specs.md tồn tại nhưng design-brief.md bị skip.',
    updatedAt: '2026-09-20T09:30:00Z',
    project: 'MT-GRMS',
    path: 'openspec/changes/cart-checkout-bug/.session.md',
  },
];

const TYPE_CONFIG: Record<KBDocument['type'], { icon: string; label: string; badge: string; accent: string }> = {
  guide:    { icon: '📘', label: 'Guide',    badge: 'bg-sky-500/10 text-sky-700 ring-sky-500/25',             accent: 'border-sky-400' },
  pattern:  { icon: '🔷', label: 'Pattern',  badge: 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/25',    accent: 'border-indigo-400' },
  decision: { icon: '⚖️', label: 'Decision', badge: 'bg-amber-500/10 text-amber-700 ring-amber-500/25',       accent: 'border-amber-400' },
  lesson:   { icon: '📖', label: 'Lesson',   badge: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25', accent: 'border-emerald-400' },
  session:  { icon: '🎯', label: 'Session',  badge: 'bg-zinc-100 text-zinc-700 ring-zinc-200',                 accent: 'border-zinc-500' },
};

const TYPE_ORDER: KBDocument['type'][] = ['guide', 'pattern', 'decision', 'lesson', 'session'];

function TypeBadge({ type }: { type: KBDocument['type'] }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', cfg.badge)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => (
        <span key={tag} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-700">#{tag}</span>
      ))}
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────
function DocCard({ doc, onClick }: { doc: KBDocument; onClick: () => void }) {
  const updated = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('vi-VN') : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <TypeBadge type={doc.type} />
        {updated && <span className="text-[11px] text-zinc-500">{updated}</span>}
      </div>
      <div className="mb-1.5 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-zinc-900">{doc.title}</div>
      <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600">{doc.preview}</p>
      {doc.tags && doc.tags.length > 0 && <div className="mt-3"><Tags tags={doc.tags} /></div>}
      {doc.path && (
        <div className="mt-auto pt-3">
          <div className="truncate border-t border-zinc-100 pt-2.5 font-mono text-[10px] text-zinc-500">📁 {doc.path}</div>
        </div>
      )}
    </button>
  );
}

// ─── Doc Modal ────────────────────────────────────────────────────────────────
function DocModal({ doc, onClose }: { doc: KBDocument; onClose: () => void }) {
  const cfg = TYPE_CONFIG[doc.type];
  const updated = doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('vi-VN') : null;

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <TypeBadge type={doc.type} />
        <CloseButton onClick={onClose} />
      </div>
      <div className="overflow-y-auto px-6 py-5 scrollbar-thin">
        <h2 className="text-xl font-bold leading-snug text-zinc-900">{doc.title}</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {doc.project && <span>🏢 {doc.project}</span>}
          {doc.scope && <span>🌐 {doc.scope}</span>}
          {updated && <span>🕐 {updated}</span>}
        </div>
        {doc.tags && <div className="mt-4"><Tags tags={doc.tags} /></div>}

        <div className={cn('mt-5 rounded-xl border-l-2 bg-zinc-50 p-4 text-sm leading-7 text-zinc-700', cfg.accent)}>
          {doc.preview}
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs italic text-zinc-500">
            💡 Nội dung đầy đủ sẽ được load từ filesystem sau khi kết nối với team-ai-knowledge.
          </p>
        </div>

        {doc.path && (
          <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-500">📁 {doc.path}</div>
        )}
      </div>
    </Modal>
  );
}

// ─── Knowledge Page ───────────────────────────────────────────────────────────
export function KnowledgePage({ useApi: _useApi }: { useApi?: boolean } = {}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | KBDocument['type']>('all');
  const [selectedDoc, setSelectedDoc] = useState<KBDocument | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return MOCK_KB_DOCS.filter(doc => {
      const matchQuery = !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.preview.toLowerCase().includes(q) ||
        (doc.tags || []).some(t => t.toLowerCase().includes(q));
      return matchQuery && (typeFilter === 'all' || doc.type === typeFilter);
    });
  }, [query, typeFilter]);

  const tabs = [
    { key: 'all' as const, icon: '📂', label: 'All', count: MOCK_KB_DOCS.length },
    ...TYPE_ORDER.map(k => ({
      key: k, icon: TYPE_CONFIG[k].icon, label: TYPE_CONFIG[k].label,
      count: MOCK_KB_DOCS.filter(d => d.type === k).length,
    })),
  ];

  return (
    <div>
      {selectedDoc && <DocModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}

      <PageHeader
        title="Knowledge Base"
        subtitle={`Patterns, decisions, lessons, sessions — ${MOCK_KB_DOCS.length} documents · team-ai-knowledge`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Tìm pattern, lesson, quyết định..." />
        <span className="ml-auto text-xs tabular-nums text-zinc-500">{filtered.length} / {MOCK_KB_DOCS.length}</span>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTypeFilter(tab.key)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === tab.key
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-700'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:text-zinc-800',
            )}
          >
            {tab.icon} {tab.label}
            <span className="tabular-nums opacity-60">{tab.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📚" title="Không tìm thấy tài liệu" sub="Thử thay đổi từ khóa tìm kiếm" />
      ) : (
        TYPE_ORDER
          .map(type => ({ type, docs: filtered.filter(d => d.type === type) }))
          .filter(g => g.docs.length > 0)
          .map(({ type, docs }) => (
            <section key={type} className="mb-8">
              <div className="mb-3 flex items-center gap-2 border-b border-zinc-200 pb-2">
                <span>{TYPE_CONFIG[type].icon}</span>
                <h2 className="text-sm font-semibold text-zinc-900">{TYPE_CONFIG[type].label}s</h2>
                <span className="rounded-full bg-zinc-100 px-2 text-[11px] tabular-nums text-zinc-500">{docs.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {docs.map(doc => <DocCard key={doc.id} doc={doc} onClick={() => setSelectedDoc(doc)} />)}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
