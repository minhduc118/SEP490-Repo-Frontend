// ─── Change activity timeline ────────────────────────────────────────────────
// Sources written by the kit (sepWorkflow.ts):
//   git commits          "sep(<change>): add proposal.md" · "sep(<change>): approve spec"
//   summary.md           "## <Step> — ✅ Approve bởi @<by> · YYYY-MM-DD HH:MM" + tóm tắt
//   improvements.md      "## <Step> · YYYY-MM-DD HH:MM" + góp ý cải tiến
//   .session.md          "## Nhật ký" → "- YYYY-MM-DD HH:MM · <việc>" (fallback when git is unavailable)

export type ActivityKind = 'commit' | 'manual' | 'approve' | 'reject' | 'improvement' | 'log';

export interface ActivityItem {
  at: string;
  kind: ActivityKind;
  text: string;
  actor?: string;
  /** Markdown body (approval summary / improvement notes) */
  detail?: string;
}

export interface CommitLike {
  author: string;
  date: string;
  message: string;
}

/** Kit stamps are UTC "YYYY-MM-DD HH:MM" */
function stampToIso(stamp: string): string {
  const m = stamp.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}:00Z` : stamp.trim();
}

function h2Sections(md: string): Array<{ heading: string; body: string }> {
  const out: Array<{ heading: string; body: string[] }> = [];
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h && !line.startsWith('###')) out.push({ heading: h[1], body: [] });
    else out[out.length - 1]?.body.push(line);
  }
  return out.map(s => ({ heading: s.heading, body: s.body.join('\n').trim() }));
}

export function parseSummary(md: string | null | undefined): ActivityItem[] {
  if (!md) return [];
  return h2Sections(md).flatMap(({ heading, body }) => {
    const m = heading.match(/^(.+?)\s+—\s+(?:✅|❌)?\s*(Approve|Reject)\s+bởi\s+@?(\S+)\s+·\s+(.+)$/i);
    if (!m) return [];
    const approve = m[2].toLowerCase() === 'approve';
    return [{
      at: stampToIso(m[4]),
      kind: approve ? 'approve' : 'reject',
      actor: m[3],
      text: `${approve ? 'Duyệt' : 'Từ chối'} bước ${m[1]}`,
      detail: body || undefined,
    } satisfies ActivityItem];
  });
}

export function parseImprovements(md: string | null | undefined): ActivityItem[] {
  if (!md) return [];
  return h2Sections(md).flatMap(({ heading, body }) => {
    const m = heading.match(/^(.+?)\s+·\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})/);
    return m ? [{ at: stampToIso(m[2]), kind: 'improvement', text: `Góp ý cải tiến bước ${m[1]}`, detail: body || undefined } satisfies ActivityItem] : [];
  });
}

export function parseSessionLog(md: string | null | undefined): ActivityItem[] {
  if (!md) return [];
  const idx = md.search(/^##\s+Nhật ký\s*$/m);
  if (idx < 0) return [];
  return md.slice(idx).split(/\r?\n/).flatMap(line => {
    const m = line.match(/^-\s*(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})\s*·\s*(.+)$/);
    if (!m) return [];
    const actor = m[2].match(/@([\w-]+)\s*$/)?.[1];
    return [{ at: stampToIso(m[1]), kind: 'log', text: m[2].replace(/\s*·\s*@[\w-]+\s*$/, ''), actor } satisfies ActivityItem];
  });
}

/** Commits not made by the MCP tools (sep(...)/kb...) mean files were edited outside the workflow */
export function isToolCommit(message: string): boolean {
  return /^(sep|kb)(\(|:)/.test(message.trim());
}

export function buildActivity(input: {
  commits: CommitLike[];
  session?: string | null;
  summary?: string | null;
  improvements?: string | null;
}): ActivityItem[] {
  const decisions = parseSummary(input.summary);
  const items: ActivityItem[] = [...decisions, ...parseImprovements(input.improvements)];

  if (input.commits.length > 0) {
    for (const c of input.commits) {
      // summary.md already carries approve/reject with the reviewer's notes
      if (decisions.length && /^sep\([^)]*\):\s*(approve|reject)\b/.test(c.message)) continue;
      items.push({
        at: c.date,
        kind: isToolCommit(c.message) ? 'commit' : 'manual',
        actor: c.author,
        text: c.message.replace(/^sep\([^)]*\):\s*/, ''),
      });
    }
  } else {
    items.push(...parseSessionLog(input.session));
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
