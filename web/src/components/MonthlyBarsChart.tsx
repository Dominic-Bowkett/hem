import type { MonthlyBucket } from "../lib/results";

type Props = {
  data: MonthlyBucket[];
};

const SERIES: { key: "gas" | "elec"; label: string; color: string }[] = [
  { key: "gas", label: "Mains gas", color: "#1f6feb" },
  { key: "elec", label: "Mains elec", color: "#e5784f" },
];

const W = 720;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

export function MonthlyBarsChart({ data }: Props) {
  if (data.length === 0) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => SERIES.map((s) => d[s.key])),
  );
  const yTicks = niceTicks(maxVal, 4);
  const yMax = yTicks[yTicks.length - 1] ?? maxVal;

  const groupW = innerW / data.length;
  const barW = (groupW * 0.7) / SERIES.length;

  return (
    <figure className="chart">
      <figcaption className="chart__caption">Monthly energy use (kWh)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly gas and electricity in kWh">
        {/* Y gridlines + labels */}
        {yTicks.map((t) => {
          const y = PAD.top + innerH * (1 - t / yMax);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="chart__grid" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="chart__tick">
                {t}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const groupX = PAD.left + i * groupW;
          return (
            <g key={d.idx}>
              {SERIES.map((s, si) => {
                const v = Math.max(0, d[s.key]);
                const h = innerH * (v / yMax);
                const x = groupX + groupW * 0.15 + si * barW;
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={PAD.top + innerH - h}
                    width={barW}
                    height={h}
                    fill={s.color}
                  >
                    <title>
                      {d.label} · {s.label}: {v.toFixed(0)} kWh
                    </title>
                  </rect>
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                className="chart__tick"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart__legend">
        {SERIES.map((s) => (
          <span key={s.key} className="chart__legend-item">
            <span className="chart__swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

function niceTicks(max: number, target = 4): number[] {
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(round(v));
  return ticks;
}

function round(n: number): number {
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}
