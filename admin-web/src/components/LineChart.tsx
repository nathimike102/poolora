import { useEffect, useMemo, useRef, useState } from 'react';

export interface Series {
  key: string;
  label: string;
}

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const H = 260;
const LABEL_GAP = 14; // minimum vertical room between two end labels
const PAD = { top: 12, right: 96, bottom: 28, left: 48 };

/** A clean axis: steps of 1, 2 or 5 times a power of ten, at most five of them */
function niceScale(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 1, step: 1 };
  const mag = 10 ** Math.floor(Math.log10(v / 5));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((st) => v / st <= 5) ?? 10 * mag;
  return { max: Math.ceil(v / step) * step, step };
}

/**
 * Up to three series over time on one axis. 2px lines, hairline grid, a
 * legend, the last value labelled at each line's end, and a crosshair
 * tooltip. Series beyond three are not drawn: pass fewer.
 */
export function LineChart({
  rows,
  series,
  xKey = 'period',
  formatX,
  formatY,
  title,
}: {
  rows: Array<Record<string, number | string>>;
  series: Series[];
  xKey?: string;
  formatX: (v: string) => string;
  formatY: (v: number) => string;
  title: string;
}) {
  const shown = series.slice(0, 3);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Draw at the real width so text stays at its CSS size instead of being scaled
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(Math.max(320, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { max, step, x, y } = useMemo(() => {
    const values = rows.flatMap((r) => shown.map((s) => Number(r[s.key]) || 0));
    const { max, step } = niceScale(Math.max(0, ...values));
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (rows.length <= 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
    const y = (v: number) => PAD.top + ih - (v / max) * ih;
    return { max, step, x, y };
  }, [rows, shown, W]);

  if (rows.length === 0) return <div className="empty">No data for this range.</div>;

  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const xLabelEvery = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(W / 110))));
  const last = rows.length - 1;
  // The last period is always labelled; drop a regular label too close to it
  const showX = (i: number) => i === last || (i % xLabelEvery === 0 && last - i >= xLabelEvery / 2 + 0.5);

  // End labels only where they do not collide; the legend and tooltip cover the rest
  const endY = shown.map((s) => y(Number(rows[last]?.[s.key]) || 0));
  const labelled = new Set<number>();
  [...endY.keys()].sort((a, b) => endY[a] - endY[b]).forEach((i, n, order) => {
    const clashes = order.some((j, m) => m !== n && Math.abs(endY[j] - endY[i]) < LABEL_GAP);
    if (!clashes) labelled.add(i);
  });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < rows.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };

  const tipLeft = hover === null ? 0 : x(hover);

  return (
    <div className="chart" ref={box}>
      {shown.length > 1 ? (
        <div className="legend" aria-hidden>
          {shown.map((s, i) => (
            <span key={s.key}><span className="key" style={{ background: COLORS[i] }} />{s.label}</span>
          ))}
        </div>
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. The same figures are in the table below.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{formatY(t)}</text>
          </g>
        ))}
        {rows.map((r, i) =>
          showX(i) ? (
            <text key={i} className="tick" x={x(i)} y={H - 8} textAnchor="middle">{formatX(String(r[xKey]))}</text>
          ) : null,
        )}
        {shown.map((s, si) => {
          const d = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(Number(r[s.key]) || 0).toFixed(1)}`).join(' ');
          const lastValue = Number(rows[last][s.key]) || 0;
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={COLORS[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last)} cy={y(lastValue)} r={4} fill={COLORS[si]} stroke="var(--surface)" strokeWidth={2} />
              {labelled.has(si) ? (
                <text className="tick" x={x(last) + 8} y={y(lastValue) + 4} style={{ fill: 'var(--text-2)' }}>
                  {formatY(lastValue)}
                </text>
              ) : null}
            </g>
          );
        })}
        {hover !== null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--text-3)" strokeWidth={1} />
            {shown.map((s, si) => (
              <circle key={s.key} cx={x(hover)} cy={y(Number(rows[hover][s.key]) || 0)} r={4} fill={COLORS[si]} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        ) : null}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={W - PAD.left - PAD.right}
          height={H - PAD.top - PAD.bottom}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null ? (
        <div className="tooltip" style={{ left: Math.min(tipLeft + 12, W - 170), top: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatX(String(rows[hover][xKey]))}</div>
          {shown.map((s, si) => (
            <div key={s.key} className="t-row">
              <span><span className="dot" style={{ background: COLORS[si] }} />{s.label}</span>
              <strong>{formatY(Number(rows[hover][s.key]) || 0)}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
