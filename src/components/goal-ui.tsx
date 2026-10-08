import type { GoalStatus } from "@/lib/performance";

export const STATUS_STYLE: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  stretch: { label: "Stretch met", color: "#22c55e", bg: "#22c55e22" },
  met: { label: "Goal met", color: "#8ab4ff", bg: "#8ab4ff22" },
  below: { label: "Below goal", color: "#fb923c", bg: "#fb923c22" },
  none: { label: "No goal", color: "#6a7da0", bg: "#6a7da022" },
};

export function StatusPill({ status, label }: { status: GoalStatus; label?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: s.color, background: s.bg }}>
      {label ?? s.label}
    </span>
  );
}

/**
 * Progress toward a goal range: the bar fills to `actual`, with tick marks at
 * the goal and the stretch goal. `expected` (optional) marks where the
 * period's pace says you should be by now.
 */
export function GoalBar({
  actual,
  goal,
  stretch,
  unit = "",
  expected,
}: {
  actual: number;
  goal: number | null;
  stretch: number | null;
  unit?: string;
  expected?: number | null;
}) {
  if (!goal) {
    return (
      <div className="text-[12px] text-[#6a7da0]">
        <b className="text-[18px] text-white tabular-nums">{fmt(actual)}{unit}</b> · no goal set
      </div>
    );
  }
  const top = Math.max(stretch ?? goal, actual, goal) * 1.08;
  const pos = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
  const color = stretch != null && actual >= stretch ? "#22c55e" : actual >= goal ? "#8ab4ff" : "#fb923c";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span>
          <b className="text-[20px] tabular-nums text-white">{fmt(actual)}{unit}</b>
          <span className="ml-1.5 text-[#9bb0d4]">
            of {fmt(goal)}{unit} goal{stretch != null && stretch !== goal ? ` · ${fmt(stretch)}${unit} stretch` : ""}
          </span>
        </span>
        <span className="tabular-nums text-[#9bb0d4]">{Math.round((actual / goal) * 100)}% of goal</span>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-[#0b0f17]">
        <div className="h-full rounded-full" style={{ width: pos(actual), background: color }} />
        <Tick at={pos(goal)} color="#cfdaee" title="Goal" />
        {stretch != null && stretch !== goal && <Tick at={pos(stretch)} color="#22c55e" title="Stretch" />}
        {expected != null && expected > 0 && <Tick at={pos(expected)} color="#facc15" title="Pace" dashed />}
      </div>
    </div>
  );
}

function Tick({ at, color, title, dashed }: { at: string; color: string; title: string; dashed?: boolean }) {
  return (
    <span
      title={title}
      className="absolute -top-1 h-[18px] w-0"
      style={{ left: at, borderLeft: `2px ${dashed ? "dotted" : "solid"} ${color}` }}
    />
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

/** Bars per period: actual vs goal (outline) and stretch (dotted line). */
export function PeriodBars({
  items,
  height = 120,
  unit = "",
}: {
  items: { label: string; actual: number; goal: number | null; stretch: number | null; partial?: boolean }[];
  height?: number;
  unit?: string;
}) {
  const W = 600;
  const H = height;
  const padB = 30;
  const padT = 14;
  const innerH = H - padB - padT;
  const max = Math.max(1, ...items.flatMap((i) => [i.actual, i.goal ?? 0, i.stretch ?? 0])) * 1.08;
  const slot = W / Math.max(1, items.length);
  const bw = Math.min(70, slot * 0.5);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
      <line x1={0} x2={W} y1={padT + innerH} y2={padT + innerH} stroke="#1f2a3d" />
      {items.map((it, i) => {
        const cx = slot * i + slot / 2;
        const color = it.goal ? (it.stretch != null && it.actual >= it.stretch ? "#22c55e" : it.actual >= it.goal ? "#8ab4ff" : "#fb923c") : "#8ab4ff";
        return (
          <g key={it.label}>
            {it.goal ? (
              <rect x={cx - bw / 2} y={y(it.goal)} width={bw} height={padT + innerH - y(it.goal)} fill="none" stroke="#2d3d5c" strokeDasharray="3 3" />
            ) : null}
            <rect x={cx - bw / 2 + 4} y={y(it.actual)} width={bw - 8} height={padT + innerH - y(it.actual)} fill={color} opacity={it.partial ? 0.6 : 0.9} rx={2} />
            {it.stretch != null && it.goal ? (
              <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={y(it.stretch)} y2={y(it.stretch)} stroke="#22c55e" strokeDasharray="2 3" strokeWidth={1.5} />
            ) : null}
            <text x={cx} y={y(it.actual) - 4} fontSize="11" fill="#e8eefc" textAnchor="middle">
              {fmt(it.actual)}{unit}
            </text>
            <text x={cx} y={H - 14} fontSize="11" fill="#9bb0d4" textAnchor="middle">
              {it.label}
            </text>
            <text x={cx} y={H - 2} fontSize="10" fill="#6a7da0" textAnchor="middle">
              {it.goal ? `goal ${fmt(it.goal)}${unit}` : "no goal"}{it.partial ? " · to date" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GoalLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#6a7da0]">
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#fb923c]" />Below goal</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#8ab4ff]" />Goal met</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />Stretch met</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dotted border-[#22c55e]" />Stretch goal</span>
    </div>
  );
}
