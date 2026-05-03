import { useMemo } from "react";
import type { Run } from "../lib/db";
import {
  summariseDetailed,
  summariseResults,
  type HemPayload,
  type ResultStat,
} from "../lib/results";
import { findArchetype } from "../lib/forms/registry";
import { MonthlyBarsChart } from "./MonthlyBarsChart";

type Props = {
  a: Run;
  b: Run;
  onClear: () => void;
};

type ComparedStat = {
  label: string;
  unit: string;
  aRaw: number | null;
  bRaw: number | null;
  aText: string;
  bText: string;
  delta: string;
  deltaSign: "improve" | "worsen" | "neutral";
};

const HIGHER_IS_WORSE = new Set([
  "Mains gas total",
  "Mains elec total",
  "Space heat demand",
  "Hot-water demand",
  "Peak space heat",
  "Unmet-demand hours",
]);

export function Compare({ a, b, onClear }: Props) {
  const summaryA = useMemo(() => summarise(a), [a]);
  const summaryB = useMemo(() => summarise(b), [b]);
  const monthlyA = useMemo(() => detailed(a)?.monthly ?? null, [a]);
  const monthlyB = useMemo(() => detailed(b)?.monthly ?? null, [b]);

  const compared = useMemo(() => buildComparedStats(summaryA, summaryB), [
    summaryA,
    summaryB,
  ]);

  const archetypeName = (run: Run): string => {
    if (!run.archetypeId) return "(no archetype)";
    return findArchetype(run.archetypeId)?.name ?? run.archetypeId;
  };

  return (
    <section className="compare">
      <div className="compare__head">
        <h2 className="compare__title">Compare runs</h2>
        <button className="compare__clear" onClick={onClear}>
          Clear comparison
        </button>
      </div>

      <div className="compare__meta">
        <div className="compare__col">
          <span className="compare__col-label">A</span>
          <strong>{a.name}</strong>
          <span className="compare__col-arch">{archetypeName(a)}</span>
        </div>
        <div className="compare__col">
          <span className="compare__col-label">B</span>
          <strong>{b.name}</strong>
          <span className="compare__col-arch">{archetypeName(b)}</span>
        </div>
      </div>

      <table className="compare__table">
        <thead>
          <tr>
            <th>Stat</th>
            <th>A</th>
            <th>B</th>
            <th>Δ (B − A)</th>
          </tr>
        </thead>
        <tbody>
          {compared.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.aText}</td>
              <td>{row.bText}</td>
              <td className={`compare__delta compare__delta--${row.deltaSign}`}>
                {row.delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {monthlyA && monthlyB && (
        <CompareMonthlyChart aLabel={a.name} bLabel={b.name} a={monthlyA} b={monthlyB} />
      )}
    </section>
  );
}

function summarise(run: Run): ResultStat[] {
  try {
    const payload = JSON.parse(run.resultJson) as HemPayload;
    return summariseResults(payload)?.stats ?? [];
  } catch {
    return [];
  }
}

function detailed(run: Run): ReturnType<typeof summariseDetailed> {
  try {
    return summariseDetailed(JSON.parse(run.resultJson) as HemPayload);
  } catch {
    return null;
  }
}

function buildComparedStats(a: ResultStat[], b: ResultStat[]): ComparedStat[] {
  // Union of labels, preserving A's order then any B-only at the end.
  const order: string[] = [];
  const aMap = new Map(a.map((s) => [s.label, s]));
  const bMap = new Map(b.map((s) => [s.label, s]));
  for (const s of a) order.push(s.label);
  for (const s of b) if (!aMap.has(s.label)) order.push(s.label);

  return order.map((label) => {
    const sa = aMap.get(label);
    const sb = bMap.get(label);
    const aText = sa?.value ?? "—";
    const bText = sb?.value ?? "—";
    const aRaw = sa ? extractNumber(sa.value) : null;
    const bRaw = sb ? extractNumber(sb.value) : null;
    let delta = "—";
    let deltaSign: ComparedStat["deltaSign"] = "neutral";
    if (aRaw !== null && bRaw !== null) {
      const diff = bRaw - aRaw;
      const unit = extractUnit(sa?.value ?? sb?.value ?? "");
      const sign = diff > 0 ? "+" : "";
      delta = `${sign}${formatDelta(diff)} ${unit}`.trim();
      if (Math.abs(diff) < 0.01) {
        deltaSign = "neutral";
      } else if (HIGHER_IS_WORSE.has(label)) {
        deltaSign = diff < 0 ? "improve" : "worsen";
      } else {
        deltaSign = "neutral";
      }
    }
    return {
      label,
      unit: extractUnit(sa?.value ?? sb?.value ?? ""),
      aRaw,
      bRaw,
      aText,
      bText,
      delta,
      deltaSign,
    };
  });
}

function extractNumber(s: string): number | null {
  const m = s.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractUnit(s: string): string {
  const m = s.match(/-?\d[\d,]*(?:\.\d+)?\s*(.*)$/);
  return m?.[1]?.trim() ?? "";
}

function formatDelta(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

type Monthly = NonNullable<ReturnType<typeof summariseDetailed>>["monthly"];

function CompareMonthlyChart({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: NonNullable<Monthly>;
  b: NonNullable<Monthly>;
  aLabel: string;
  bLabel: string;
}) {
  const merged = a.map((monthA) => {
    const monthB = b.find((m) => m.idx === monthA.idx);
    return {
      idx: monthA.idx,
      label: monthA.label,
      hours: monthA.hours,
      gas: monthA.gas,
      elec: monthB?.gas ?? 0,
      heat: 0,
    };
  });
  return (
    <MonthlyBarsChart
      data={merged}
      caption="Monthly mains gas (kWh)"
      series={[
        { key: "gas", label: `A · ${aLabel}`, color: "#1f6feb" },
        { key: "elec", label: `B · ${bLabel}`, color: "#22a06b" },
      ]}
    />
  );
}
