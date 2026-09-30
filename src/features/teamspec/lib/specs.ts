// ─── Source spec parsing — format written by specMerge.ts in the kit ─────────
//   # Spec: <capability>
//   ## Requirements   → "### Requirement: <name>" blocks
//   ## Lịch sử        → "- <date> · `<change>` · +a ~m -r"

export interface SpecRequirement {
  name: string;
  text: string;
  scenarios: number;
}

export interface SpecHistoryEntry {
  date: string;
  change: string;
  added: number;
  modified: number;
  removed: number;
}

export interface SpecSummary {
  capability: string;
  requirements: string[];
  history: SpecHistoryEntry[];
  updatedAt?: string;
  author?: string;
  /** Not yet archived changes that will merge into this capability */
  openChanges: string[];
  /** false = no spec.md yet, only open changes target it */
  exists: boolean;
}

export interface SpecDetail extends SpecSummary {
  content: string;
  parsed: { requirements: SpecRequirement[] };
}

export function parseSpecDoc(md: string): { requirements: SpecRequirement[]; history: SpecHistoryEntry[] } {
  const requirements: SpecRequirement[] = [];
  const history: SpecHistoryEntry[] = [];
  let section = '';
  let cur: { name: string; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.lines.join('\n').trim();
    requirements.push({ name: cur.name, text, scenarios: (text.match(/^####\s+Scenario/gim) ?? []).length });
    cur = null;
  };

  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2 && !line.startsWith('###')) {
      flush();
      section = h2[1].toLowerCase();
      continue;
    }
    if (section.startsWith('requirements')) {
      const req = line.match(/^###\s+Requirement:\s*(.+?)\s*$/);
      if (req) {
        flush();
        cur = { name: req[1], lines: [line] };
      } else if (cur) {
        cur.lines.push(line);
      }
    } else if (section.startsWith('lịch sử')) {
      const m = line.match(/^-\s*(\S+)\s*·\s*`?([^`·]+?)`?\s*·\s*\+(\d+)\s*~(\d+)\s*-(\d+)/);
      if (m) history.push({ date: m[1], change: m[2].trim(), added: +m[3], modified: +m[4], removed: +m[5] });
    }
  }
  flush();
  return { requirements, history };
}
