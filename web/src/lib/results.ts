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

export type MonthlyBucket = {
  idx: number;          // 0..11
  label: string;        // "Jan" .. "Dec"
  hours: number;
  gas: number;          // kWh
  elec: number;         // kWh
  heat: number;         // kWh
};

export type DailyTemp = {
  day: number;          // day index from sim start
  min: number;
  max: number;
  mean: number;
};

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthOfHour(hourFromYearStart: number): number {
  const day = Math.floor(hourFromYearStart / 24) % 365;
  for (let m = 11; m >= 0; m--) if (day >= DAYS_BEFORE_MONTH[m]!) return m;
  return 0;
}

export type DetailedSummary = {
  rows: number;
  monthly: MonthlyBucket[] | null;
  dailyTemp: DailyTemp[] | null;
};

export function summariseDetailed(payload: HemPayload): DetailedSummary | null {
  const csv = payload.files?.["results.csv"];
  if (!csv) return null;
  const { headers, rows } = parseCsv(csv);
  const idxOf = (name: string): number => headers.indexOf(name);

  const gasIdx = idxOf("mains gas: total");
  const elecIdx = idxOf("mains elec: total");
  const heatIdx = idxOf("zone 1: space heat demand");
  const tempIdx = idxOf("zone 1: internal air temp");

  // Monthly bars: only meaningful with at least 30 days of simulation
  const monthly =
    rows.length >= 24 * 30
      ? bucketMonthly(rows, gasIdx, elecIdx, heatIdx, headers)
      : null;

  // Daily temp band: only meaningful with at least 7 days
  const dailyTemp =
    rows.length >= 24 * 7 && tempIdx >= 0 ? bucketDailyTemp(rows, tempIdx, headers) : null;

  return { rows: rows.length, monthly, dailyTemp };
}

function bucketMonthly(
  rows: Record<string, number | null>[],
  gasIdx: number,
  elecIdx: number,
  heatIdx: number,
  headers: string[],
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = MONTH_LABELS.map((label, idx) => ({
    idx,
    label,
    hours: 0,
    gas: 0,
    elec: 0,
    heat: 0,
  }));
  for (let h = 0; h < rows.length; h++) {
    const row = rows[h]!;
    const m = monthOfHour(h);
    const bucket = buckets[m]!;
    bucket.hours += 1;
    if (gasIdx >= 0) bucket.gas += numAt(row, headers, gasIdx);
    if (elecIdx >= 0) bucket.elec += numAt(row, headers, elecIdx);
    if (heatIdx >= 0) bucket.heat += numAt(row, headers, heatIdx);
  }
  return buckets.filter((b) => b.hours > 0);
}

function bucketDailyTemp(
  rows: Record<string, number | null>[],
  tempIdx: number,
  headers: string[],
): DailyTemp[] {
  const days: DailyTemp[] = [];
  let day = -1;
  let sum = 0;
  let count = 0;
  let mn = Infinity;
  let mx = -Infinity;
  const flush = () => {
    if (day < 0 || count === 0) return;
    days.push({ day, min: mn, max: mx, mean: sum / count });
  };
  for (let h = 0; h < rows.length; h++) {
    const d = Math.floor(h / 24);
    if (d !== day) {
      flush();
      day = d;
      sum = 0;
      count = 0;
      mn = Infinity;
      mx = -Infinity;
    }
    const v = numAt(rows[h]!, headers, tempIdx);
    if (Number.isFinite(v)) {
      sum += v;
      count += 1;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  flush();
  return days;
}

function numAt(
  row: Record<string, number | null>,
  headers: string[],
  idx: number,
): number {
  const key = headers[idx];
  if (!key) return 0;
  const v = row[key];
  return typeof v === "number" ? v : 0;
}
