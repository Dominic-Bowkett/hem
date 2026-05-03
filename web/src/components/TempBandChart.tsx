import type { DailyTemp } from "../lib/results";

type Props = {
  data: DailyTemp[];
};

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

export function TempBandChart({ data }: Props) {
  if (data.length < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allMins = data.map((d) => d.min);
  const allMaxs = data.map((d) => d.max);
  const yMin = Math.floor(Math.min(...allMins) - 1);
  const yMax = Math.ceil(Math.max(...allMaxs) + 1);
  const yRange = Math.max(1, yMax - yMin);

  const x = (i: number) => PAD.left + (innerW * i) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD.top + innerH * (1 - (v - yMin) / yRange);

  const bandPath = [
    "M",
    data.map((d, i) => `${x(i)},${y(d.max)}`).join(" L "),
    "L",
    [...data].reverse().map((d, idx) => `${x(data.length - 1 - idx)},${y(d.min)}`).join(" L "),
    "Z",
  ].join(" ");

  const meanPath = "M " + data.map((d, i) => `${x(i)},${y(d.mean)}`).join(" L ");

  const tickStep = niceTickStep(yRange);
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) {
    ticks.push(v);
  }

  // Month labels along x: roughly every 30 days where present
  const monthIndices = data
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.day % 30 === 0)
    .slice(0, 13);

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        Indoor air temperature: daily min/max (band) and mean (line), °C
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily indoor temperature range">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="chart__tick">
              {t}
            </text>
          </g>
        ))}
        <path d={bandPath} fill="rgba(31, 111, 235, 0.18)" stroke="none" />
        <path d={meanPath} fill="none" stroke="#1f6feb" strokeWidth={1.5} />
        {monthIndices.map(({ i, d }) => (
          <text
            key={d.day}
            x={x(i)}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            className="chart__tick"
          >
            d{d.day}
          </text>
        ))}
      </svg>
    </figure>
  );
}

function niceTickStep(range: number): number {
  if (range >= 30) return 5;
  if (range >= 12) return 2;
  if (range >= 6) return 1;
  return 0.5;
}
