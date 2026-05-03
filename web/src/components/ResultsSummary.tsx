import type { DetailedSummary, ResultsSummary } from "../lib/results";
import { MonthlyBarsChart } from "./MonthlyBarsChart";
import { TempBandChart } from "./TempBandChart";

type Props = {
  summary: ResultsSummary | null;
  detailed: DetailedSummary | null;
};

export function ResultsSummaryView({ summary, detailed }: Props) {
  if (!summary) return null;
  if (summary.stats.length === 0) {
    return (
      <p className="results__empty">
        Engine returned an empty results.csv ({summary.rows} rows). Check the raw
        output for diagnostics.
      </p>
    );
  }

  return (
    <div className="results">
      <div className="results__head">
        <h3 className="results__title">Headline numbers</h3>
        <span className="results__rows">{summary.rows} timesteps</span>
      </div>
      <ul className="results__grid">
        {summary.stats.map((s) => (
          <li key={s.label} className="results__stat" title={s.hint}>
            <span className="results__stat-label">{s.label}</span>
            <span className="results__stat-value">{s.value}</span>
          </li>
        ))}
      </ul>
      {detailed?.monthly && detailed.monthly.length > 1 && (
        <MonthlyBarsChart data={detailed.monthly} />
      )}
      {detailed?.dailyTemp && detailed.dailyTemp.length > 1 && (
        <TempBandChart data={detailed.dailyTemp} />
      )}
    </div>
  );
}
