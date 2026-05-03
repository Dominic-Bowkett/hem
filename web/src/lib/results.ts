export type HemPayload = {
  hem_version: string;
  response: unknown;
  files: Record<string, string>;
};

export type ResultStat = {
  label: string;
  value: string;
  hint?: string;
};

export type ResultsSummary = {
  rows: number;
  stats: ResultStat[];
};

type Row = Record<string, number | null>;

export function summariseResults(payload: HemPayload): ResultsSummary | null {
  const csv = payload.files?.["results.csv"];
  if (!csv) return null;

  const { headers, rows } = parseCsv(csv);
  if (rows.length === 0) return { rows: 0, stats: [] };

  const stats: ResultStat[] = [];

  pushSum(stats, rows, headers, "mains gas: total", "Mains gas total", "kWh");
  pushSum(stats, rows, headers, "mains elec: total", "Mains elec total", "kWh");
  pushSum(
    stats,
    rows,
    headers,
    "zone 1: space heat demand",
    "Space heat demand",
    "kWh",
  );
  pushSum(
    stats,
    rows,
    headers,
    findFirst(headers, (h) => h.startsWith("DHW: demand energy (excluding")) ?? "DHW: demand energy",
    "Hot-water demand",
    "kWh",
  );
  pushPeak(
    stats,
    rows,
    headers,
    "zone 1: space heat demand",
    "Peak space heat",
    "kW (hourly)",
  );
  pushMean(
    stats,
    rows,
    headers,
    "zone 1: internal air temp",
    "Mean indoor temp",
    "°C",
  );
  pushUnmetHours(stats, rows, headers, "_unmet_demand: zone 1");

  return { rows: rows.length, stats };
}

function pushSum(
  out: ResultStat[],
  rows: Row[],
  headers: string[],
  column: string,
  label: string,
  unit: string,
) {
  if (!headers.includes(column)) return;
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const v = row[column];
    if (typeof v === "number") {
      sum += v;
      any = true;
    }
  }
  if (!any) return;
  out.push({
    label,
    value: `${formatNumber(sum)} ${unit}`,
    hint: `Sum of "${column}" across ${rows.length} timesteps.`,
  });
}

function pushPeak(
  out: ResultStat[],
  rows: Row[],
  headers: string[],
  column: string,
  label: string,
  unit: string,
) {
  if (!headers.includes(column)) return;
  let peak = -Infinity;
  let any = false;
  for (const row of rows) {
    const v = row[column];
    if (typeof v === "number") {
      if (v > peak) peak = v;
      any = true;
    }
  }
  if (!any) return;
  out.push({
    label,
    value: `${formatNumber(peak)} ${unit}`,
    hint: `Maximum of "${column}" across ${rows.length} timesteps.`,
  });
}

function pushMean(
  out: ResultStat[],
  rows: Row[],
  headers: string[],
  column: string,
  label: string,
  unit: string,
) {
  if (!headers.includes(column)) return;
  let sum = 0;
  let n = 0;
  for (const row of rows) {
    const v = row[column];
    if (typeof v === "number") {
      sum += v;
      n++;
    }
  }
  if (n === 0) return;
  out.push({
    label,
    value: `${formatNumber(sum / n)} ${unit}`,
    hint: `Mean of "${column}" across ${n} timesteps.`,
  });
}

function pushUnmetHours(
  out: ResultStat[],
  rows: Row[],
  headers: string[],
  column: string,
) {
  if (!headers.includes(column)) return;
  let hours = 0;
  for (const row of rows) {
    const v = row[column];
    if (typeof v === "number" && v > 0.0001) hours++;
  }
  out.push({
    label: "Unmet-demand hours",
    value: `${hours} / ${rows.length}`,
    hint: `Timesteps where "${column}" was non-zero.`,
  });
}

function findFirst(items: string[], pred: (s: string) => boolean): string | undefined {
  return items.find(pred);
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const row: Row = {};
    for (let c = 0; c < headers.length; c++) {
      const raw = cells[c];
      if (raw === undefined || raw === "") {
        row[headers[c]!] = null;
      } else {
        const num = Number(raw);
        row[headers[c]!] = Number.isFinite(num) ? num : null;
      }
    }
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  // HEM doesn't quote fields, so a plain split is sufficient.
  return line.split(",");
}
