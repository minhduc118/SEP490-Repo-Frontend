// ─── TeamSpec Monitor — Specs (openspec/specs/<capability>/spec.md) ──────────
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSpec, useSpecs } from '../lib/api';
import { MARKDOWN_CLASS, markdownToHtml } from '../lib/markdown';
import type { SpecRequirement, SpecSummary } from '../lib/specs';
import { Badge, Card, CardTitle, EmptyState, PageHeader, SearchInput } from '../components/ui';
import { cn, table } from '../lib/styles';

interface Props {
  onSelectSpec: (capability: string) => void;
  onSelectChange: (name: string) => void;
  useApi?: boolean;
}

function when(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('vi-VN');
}

function SpecListItem({ spec, active, onClick }: { spec: SpecSummary; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors',
          active ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 bg-white hover:border-indigo-200 hover:bg-zinc-50',
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[13px] font-semibold text-zinc-900">{spec.capability}</span>
          {spec.exists ? <Badge tone="accent">{spec.requirements.length} REQ</Badge> : <Badge tone="gray">chưa archive</Badge>}
        </span>
        <span className="text-[11px] text-zinc-500">
          {spec.exists ? `${spec.history.length} lần merge · cập nhật ${when(spec.updatedAt)}` : 'Spec gốc sẽ được tạo khi /sep-archive'}
          {spec.openChanges.length > 0 && <> · <span className="text-amber-700">{spec.openChanges.length} change đang làm</span></>}
        </span>
      </button>
    </li>
  );
}

function RequirementItem({ req }: { req: SpecRequirement }) {
  const html = useMemo(() => markdownToHtml(req.text.replace(/^###\s+Requirement:.*\n?/, '')), [req.text]);
  return (
    <details className="group rounded-xl border border-zinc-200 bg-white open:shadow-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-2.5">
        <span className="text-[13px] font-medium text-zinc-900">{req.name}</span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge tone={req.scenarios ? 'pass' : 'warn'}>{req.scenarios} scenario</Badge>
          <span className="text-zinc-400 transition-transform group-open:rotate-90">▸</span>
        </span>
      </summary>
      <div
        className={cn(MARKDOWN_CLASS, 'border-t border-zinc-100 px-4 py-3')}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped by markdownToHtml
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </details>
  );
}

function SpecDetailPanel({ capability, useApi, onSelectChange }: { capability: string; useApi: boolean; onSelectChange: (n: string) => void }) {
  const { data, isLoading, isError } = useSpec(capability, useApi);
  const [showRaw, setShowRaw] = useState(false);

  if (isLoading) return <Card><EmptyState icon="⏳" sub={`Đang tải ${capability}…`} /></Card>;
  if (isError || !data) return <Card><EmptyState icon="🔍" title="Không tìm thấy spec" sub={capability} /></Card>;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-lg font-bold text-zinc-900">{data.capability}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              openspec/specs/{data.capability}/spec.md
              {data.exists && <> · cập nhật {when(data.updatedAt)}{data.author && <> bởi @{data.author}</>}</>}
            </p>
          </div>
          {data.exists && (
            <button type="button" onClick={() => setShowRaw(v => !v)} className="cursor-pointer text-xs text-indigo-700 hover:underline">
              {showRaw ? 'Xem theo requirement' : 'Xem file gốc'}
            </button>
          )}
        </div>
        {data.openChanges.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Change đang làm sẽ merge vào spec này khi archive:
            {data.openChanges.map(n => (
              <button key={n} type="button" onClick={() => onSelectChange(n)} className="cursor-pointer rounded bg-white px-1.5 py-0.5 font-mono text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
                {n}
              </button>
            ))}
          </div>
        )}
      </Card>

      {!data.exists ? (
        <Card>
          <EmptyState icon="📐" title="Chưa có spec gốc" sub="Spec gốc được tạo tự động khi change đầu tiên của capability này chạy /sep-archive (merge specs.md dạng delta)." />
        </Card>
      ) : showRaw ? (
        <Card>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-700">{data.content}</pre>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle extra={`${data.parsed.requirements.length} requirement`}>📋 Requirements</CardTitle>
            {data.parsed.requirements.length === 0 ? (
              <p className="text-xs text-zinc-500">Spec chưa có "### Requirement:" nào.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.parsed.requirements.map(r => <RequirementItem key={r.name} req={r} />)}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>🕒 Lịch sử merge</CardTitle>
            {data.history.length === 0 ? (
              <p className="text-xs text-zinc-500">Chưa có lịch sử.</p>
            ) : (
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.th}>Ngày</th>
                      <th className={table.th}>Change</th>
                      <th className={table.th}>Thêm</th>
                      <th className={table.th}>Sửa</th>
                      <th className={table.th}>Xoá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.history].reverse().map((h, i) => (
                      <tr key={i} onClick={() => onSelectChange(h.change)} className={table.row}>
                        <td className={cn(table.td, 'text-xs text-zinc-600')}>{h.date}</td>
                        <td className={cn(table.td, 'font-mono text-xs text-indigo-700')}>{h.change}</td>
                        <td className={cn(table.td, 'text-xs text-emerald-700')}>+{h.added}</td>
                        <td className={cn(table.td, 'text-xs text-amber-700')}>~{h.modified}</td>
                        <td className={cn(table.td, 'text-xs text-rose-700')}>-{h.removed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export function SpecsPage({ onSelectSpec, onSelectChange, useApi = false }: Props) {
  const { capability } = useParams();
  const { data: specs, isLoading } = useSpecs(useApi);
  const [query, setQuery] = useState('');

  const list = (specs ?? []).filter(s => !query || s.capability.includes(query.toLowerCase().trim()));
  const selected = capability ?? list.find(s => s.exists)?.capability ?? list[0]?.capability;
  const totalReqs = (specs ?? []).reduce((n, s) => n + s.requirements.length, 0);

  return (
    <div>
      <PageHeader
        title="Specs"
        subtitle={`Spec gốc theo capability — cập nhật khi /sep-archive merge specs.md của change${specs ? ` · ${specs.filter(s => s.exists).length} capability · ${totalReqs} requirement` : ''}`}
      />

      {!useApi ? (
        <Card><EmptyState icon="🔌" title="Cần chạy server" sub="Trang Specs đọc openspec/specs/ từ KB — chạy npm run dev:all." /></Card>
      ) : isLoading ? (
        <EmptyState icon="⏳" sub="Đang tải specs…" />
      ) : (specs ?? []).length === 0 ? (
        <Card><EmptyState icon="📐" title="Chưa có capability nào" sub="Tạo change bằng /sep-spec; spec gốc xuất hiện sau /sep-archive." /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit lg:sticky lg:top-6">
            <SearchInput value={query} onChange={setQuery} placeholder="Tìm capability..." className="mb-3" />
            <ul className="flex flex-col gap-2">
              {list.map(s => (
                <SpecListItem key={s.capability} spec={s} active={s.capability === selected} onClick={() => onSelectSpec(s.capability)} />
              ))}
            </ul>
          </Card>
          {selected && <SpecDetailPanel key={selected} capability={selected} useApi={useApi} onSelectChange={onSelectChange} />}
        </div>
      )}
    </div>
  );
}
