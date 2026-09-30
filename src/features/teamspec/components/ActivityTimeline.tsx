// ─── TeamSpec — Change activity timeline ─────────────────────────────────────
import { useActivity } from '../lib/api';
import type { ActivityItem, ActivityKind } from '../lib/activity';
import { cn } from '../lib/styles';
import { EmptyState } from './ui';

const KIND: Record<ActivityKind, { icon: string; dot: string; label?: string }> = {
  approve: { icon: '👍', dot: 'bg-emerald-100 ring-emerald-300' },
  reject: { icon: '❌', dot: 'bg-rose-100 ring-rose-300' },
  improvement: { icon: '💡', dot: 'bg-amber-100 ring-amber-300' },
  commit: { icon: '•', dot: 'bg-zinc-100 ring-zinc-300' },
  manual: { icon: '✎', dot: 'bg-orange-100 ring-orange-300', label: 'sửa ngoài MCP' },
  log: { icon: '•', dot: 'bg-zinc-100 ring-zinc-300' },
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function Item({ item, last }: { item: ActivityItem; last: boolean }) {
  const k = KIND[item.kind];
  return (
    <li className="relative flex gap-3 pb-4">
      {!last && <span className="absolute left-3 top-7 h-[calc(100%-1.25rem)] w-px bg-zinc-200" />}
      <span className={cn('relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-[11px] ring-1', k.dot)}>{k.icon}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className={cn('font-medium', item.kind === 'reject' ? 'text-rose-700' : item.kind === 'approve' ? 'text-emerald-700' : 'text-zinc-800')}>
            {item.text}
          </span>
          {k.label && <span className="rounded bg-orange-100 px-1.5 text-[10px] text-orange-700">{k.label}</span>}
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-500">
          {item.actor && <>@{item.actor} · </>}{when(item.at)}
        </div>
        {item.detail && (
          <details className="mt-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <summary className="cursor-pointer select-none text-zinc-500">Nội dung</summary>
            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{item.detail}</p>
          </details>
        )}
      </div>
    </li>
  );
}

export function ActivityTimeline({ changeName, useApi }: { changeName: string; useApi: boolean }) {
  const { data, isLoading, isError } = useActivity(changeName, useApi);

  if (!useApi) return <p className="text-xs text-zinc-500">Cần chạy server để xem lịch sử (git log + summary.md).</p>;
  if (isLoading) return <EmptyState icon="⏳" sub="Đang tải lịch sử…" />;
  if (isError || !data) return <p className="text-xs text-rose-700">Không tải được lịch sử.</p>;
  if (data.items.length === 0) return <p className="text-xs text-zinc-500">Chưa có hoạt động nào.</p>;

  const manual = data.items.filter(i => i.kind === 'manual').length;
  return (
    <div>
      {manual > 0 && (
        <p className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          ✎ {manual} commit sửa file trực tiếp, không qua MCP <code className="font-mono">sep_*</code> — kiểm tra xem có bỏ qua bước duyệt không.
        </p>
      )}
      <ol className="max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
        {data.items.map((item, i) => <Item key={`${item.at}-${i}`} item={item} last={i === data.items.length - 1} />)}
      </ol>
      {data.source === 'session' && (
        <p className="mt-2 text-[11px] text-zinc-500">Không đọc được git — đang dùng nhật ký trong .session.md.</p>
      )}
    </div>
  );
}
