// ─── TeamSpec — Compliance Chart (SVG, no external deps) ─────────────────────
import type { ChangeWithCompliance } from '../types';
import { isBlocked } from '../lib/styles';
import { Card, CardTitle } from './ui';

interface Props {
  changes: ChangeWithCompliance[];
}

const CHART_W = 800;  // viewBox units
const CHART_H = 240;
const AXIS_W = 32;
const TOP_PAD = 20;
const LABEL_H = 28;
const CHART_INNER_H = CHART_H - LABEL_H - TOP_PAD;
const PLOT_W = CHART_W - AXIS_W;

// Tailwind emerald-500 / amber-500 / rose-500 — SVG fills need raw colors
function scoreColor(score: number) {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#f59e0b';
  return '#f43f5e';
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

const LEGEND = [
  { color: 'bg-emerald-500', label: '≥90% Excellent' },
  { color: 'bg-amber-500', label: '70–89% Good' },
  { color: 'bg-rose-500', label: '<70% Needs work' },
];

export function ComplianceChart({ changes }: Props) {
  if (changes.length === 0) return null;

  const n = changes.length;
  const slotW = PLOT_W / n;
  const barW = Math.min(72, slotW * 0.6);
  const avg = Math.round(changes.reduce((s, c) => s + c.compliance.score, 0) / n);

  return (
    <Card className="mb-6">
      <CardTitle extra={<>Avg <span className="font-semibold text-indigo-700">{avg}%</span></>}>
        📊 Compliance Score
      </CardTitle>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
      >
        <defs>
          {changes.map(change => (
            <linearGradient key={change.name} id={`bar-${change.name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={scoreColor(change.compliance.score)} stopOpacity="0.95" />
              <stop offset="100%" stopColor={scoreColor(change.compliance.score)} stopOpacity="0.45" />
            </linearGradient>
          ))}
        </defs>

        {[0, 25, 50, 75, 100].map(val => {
          const y = TOP_PAD + CHART_INNER_H - (val / 100) * CHART_INNER_H;
          return (
            <g key={val}>
              <line x1={AXIS_W} y1={y} x2={CHART_W} y2={y} stroke="rgba(0,0,0,0.08)" strokeDasharray={val ? '4 4' : undefined} />
              <text x={AXIS_W - 8} y={y} fontSize="11" fill="#71717a" textAnchor="end" dominantBaseline="middle">
                {val}
              </text>
            </g>
          );
        })}

        {changes.map((change, i) => {
          const cx = AXIS_W + slotW * (i + 0.5);
          const x = cx - barW / 2;
          const barH = Math.max(2, (change.compliance.score / 100) * CHART_INNER_H);
          const y = TOP_PAD + CHART_INNER_H - barH;
          const color = scoreColor(change.compliance.score);

          return (
            <g key={change.name}>
              <rect x={x} y={TOP_PAD} width={barW} height={CHART_INNER_H} fill="rgba(0,0,0,0.035)" rx="8" />
              <rect x={x} y={y} width={barW} height={barH} fill={`url(#bar-${change.name})`} rx="8">
                <title>{change.name}: {change.compliance.score}%</title>
              </rect>
              {isBlocked(change.compliance) && (
                <rect
                  x={x - 3} y={y - 3} width={barW + 6} height={barH + 6}
                  fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5 4" rx="10"
                />
              )}
              <text x={cx} y={y - 8} fontSize="13" fill={color} textAnchor="middle" fontWeight="700">
                {change.compliance.score}%
              </text>
              <text x={cx} y={CHART_H - 8} fontSize="11" fill="#52525b" textAnchor="middle">
                {truncate(change.name, Math.max(8, Math.floor(slotW / 7)))}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        {LEGEND.map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-sm ${l.color}`} /> {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm border border-dashed border-rose-500" /> Blocked
        </span>
      </div>
    </Card>
  );
}

// ─── Mini Sparkline (for Team page — score trend per member) ──────────────────
export function MiniSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) {
    return <span className="text-[11px] text-zinc-500">{scores[0] ?? 0}%</span>;
  }

  const W = 60, H = 20;
  const step = W / (scores.length - 1);
  const points = scores.map((s, i) => `${i * step},${H - (s / 100) * H}`).join(' ');
  const last = scores[scores.length - 1];
  const color = scoreColor(last);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="inline-block h-5 w-[60px] align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(scores.length - 1) * step} cy={H - (last / 100) * H} r="2" fill={color} />
    </svg>
  );
}
