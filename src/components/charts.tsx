// Lightweight dependency-free SVG charts (server-renderable).

export type Series = { label: string; color: string; points: number[] };

export function LineChart({
  series,
  labels,
  height = 140,
  yMax,
  suffix = "",
}: {
  series: Series[];
  labels: string[];
  height?: number;
  yMax?: number;
  suffix?: string;
}) {
  const W = 600;
  const H = height;
  const padL = 30;
  const padB = 18;
  const padT = 8;
  const n = labels.length;
  const max = yMax ?? Math.max(1, ...series.flatMap((s) => s.points));
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {/* gridlines */}
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padL} x2={W - 8} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="#1f2a3d" strokeWidth="1" />
      ))}
      {[0, 0.5, 1].map((f) => (
        <text key={`t${f}`} x={4} y={padT + innerH * (1 - f) + 3} fontSize="9" fill="#6a7da0">
          {Math.round(max * f)}
        </text>
      ))}
      {series.map((s) => {
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
        return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth="2" />;
      })}
      {/* x labels: first, middle, last */}
      {[0, Math.floor((n - 1) / 2), n - 1].filter((i, idx, a) => a.indexOf(i) === idx && i >= 0).map((i) => (
        <text key={`x${i}`} x={x(i)} y={H - 4} fontSize="9" fill="#6a7da0" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
          {labels[i]}
        </text>
      ))}
      <title>{suffix}</title>
    </svg>
  );
}

export function StackedAreaChart({
  stacks,
  labels,
  height = 140,
}: {
  stacks: Series[]; // order = bottom→top
  labels: string[];
  height?: number;
}) {
  const W = 600;
  const H = height;
  const padB = 18;
  const padT = 8;
  const n = labels.length;
  const totals = labels.map((_, i) => stacks.reduce((s, st) => s + (st.points[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const innerH = H - padB - padT;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  // Build cumulative bands bottom→top.
  const cum = labels.map(() => 0);
  const bands = stacks.map((st) => {
    const lower = cum.slice();
    const upper = labels.map((_, i) => {
      cum[i] += st.points[i] ?? 0;
      return cum[i];
    });
    const top = upper.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const bottom = lower
      .map((v, i) => `${x(n - 1 - i).toFixed(1)},${y(lower[n - 1 - i]).toFixed(1)}`)
      .join(" L");
    return { color: st.color, d: `${top} L${bottom} Z`, label: st.label };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {bands.map((b) => (
        <path key={b.label} d={b.d} fill={b.color} fillOpacity="0.85" stroke="none" />
      ))}
      {[0, Math.floor((n - 1) / 2), n - 1].filter((i, idx, a) => a.indexOf(i) === idx && i >= 0).map((i) => (
        <text key={`x${i}`} x={x(i)} y={H - 4} fontSize="9" fill="#6a7da0" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-[#9bb0d4]">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Vertical bars with value labels (when they fit) and thinned x labels.
 * Bars are <title>d so hovering shows the exact count.
 */
export function BarChart({
  items,
  height = 180,
  color = "#8ab4ff",
  suffix = "",
}: {
  items: { label: string; value: number; title?: string }[];
  height?: number;
  color?: string;
  suffix?: string;
}) {
  const W = 800;
  const H = height;
  const padL = 30;
  const padB = 20;
  const padT = 16;
  const n = Math.max(1, items.length);
  const innerW = W - padL - 6;
  const innerH = H - padB - padT;
  const max = Math.max(1, ...items.map((i) => i.value));
  const slot = innerW / n;
  const bw = Math.max(1, slot * 0.72);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const showValues = n <= 40;
  const every = Math.ceil(n / 10); // ~10 x labels
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }} role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - 6} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="#1f2a3d" />
          <text x={2} y={padT + innerH * (1 - f) + 3} fontSize="10" fill="#6a7da0">{Math.round(max * f)}</text>
        </g>
      ))}
      {items.map((it, i) => {
        const x = padL + slot * i + (slot - bw) / 2;
        return (
          <g key={i}>
            <rect x={x} y={y(it.value)} width={bw} height={padT + innerH - y(it.value)} fill={color} rx={bw > 6 ? 2 : 0}>
              <title>{it.title ?? `${it.label}: ${it.value}${suffix}`}</title>
            </rect>
            {showValues && it.value > 0 && (
              <text x={x + bw / 2} y={y(it.value) - 3} fontSize="10" fill="#cfdaee" textAnchor="middle">{it.value}{suffix}</text>
            )}
            {i % every === 0 && (
              <text x={x + bw / 2} y={H - 5} fontSize="10" fill="#6a7da0" textAnchor="middle">{it.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
