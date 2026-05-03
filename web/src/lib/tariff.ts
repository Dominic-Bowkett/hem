export type Tariff = {
  gasUnit_p_per_kWh: number;
  gasStanding_p_per_day: number;
  elecUnit_p_per_kWh: number;
  elecStanding_p_per_day: number;
};

// Ofgem default tariff cap, April 2025, England average dual-fuel direct debit.
// Standing charges differ by region; these are illustrative averages.
export const DEFAULT_TARIFF: Tariff = {
  gasUnit_p_per_kWh: 6.34,
  gasStanding_p_per_day: 32,
  elecUnit_p_per_kWh: 27.03,
  elecStanding_p_per_day: 53.8,
};

const STORAGE_KEY = "hem.tariff";

export function loadTariff(): Tariff {
  if (typeof localStorage === "undefined") return { ...DEFAULT_TARIFF };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TARIFF };
    const parsed = JSON.parse(raw) as Partial<Tariff>;
    return {
      gasUnit_p_per_kWh: numOr(parsed.gasUnit_p_per_kWh, DEFAULT_TARIFF.gasUnit_p_per_kWh),
      gasStanding_p_per_day: numOr(parsed.gasStanding_p_per_day, DEFAULT_TARIFF.gasStanding_p_per_day),
      elecUnit_p_per_kWh: numOr(parsed.elecUnit_p_per_kWh, DEFAULT_TARIFF.elecUnit_p_per_kWh),
      elecStanding_p_per_day: numOr(parsed.elecStanding_p_per_day, DEFAULT_TARIFF.elecStanding_p_per_day),
    };
  } catch {
    return { ...DEFAULT_TARIFF };
  }
}

export function saveTariff(t: Tariff): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
}

function numOr(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
