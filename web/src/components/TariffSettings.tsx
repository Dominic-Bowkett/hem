import { DEFAULT_TARIFF, type Tariff } from "../lib/tariff";

type Props = {
  value: Tariff;
  onChange: (next: Tariff) => void;
};

const FIELDS: { key: keyof Tariff; label: string; unit: string; step: number; max: number }[] = [
  { key: "gasUnit_p_per_kWh", label: "Gas unit", unit: "p/kWh", step: 0.01, max: 30 },
  { key: "gasStanding_p_per_day", label: "Gas standing", unit: "p/day", step: 0.5, max: 100 },
  { key: "elecUnit_p_per_kWh", label: "Elec unit", unit: "p/kWh", step: 0.01, max: 100 },
  { key: "elecStanding_p_per_day", label: "Elec standing", unit: "p/day", step: 0.5, max: 200 },
];

export function TariffSettings({ value, onChange }: Props) {
  function update(key: keyof Tariff, raw: string) {
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
      onChange({ ...value, [key]: num });
    }
  }

  function reset() {
    onChange({ ...DEFAULT_TARIFF });
  }

  const isDefault = (Object.keys(DEFAULT_TARIFF) as (keyof Tariff)[]).every(
    (k) => Math.abs(value[k] - DEFAULT_TARIFF[k]) < 0.001,
  );

  return (
    <details className="tariff">
      <summary className="tariff__summary">
        Tariff
        <span className="tariff__current">
          gas {value.gasUnit_p_per_kWh.toFixed(2)} p · elec {value.elecUnit_p_per_kWh.toFixed(2)} p
          {!isDefault && <span className="tariff__edited"> · edited</span>}
        </span>
      </summary>
      <div className="tariff__body">
        <p className="tariff__hint">
          Used to convert kWh to £ in the headline numbers. Stored locally in this browser.
        </p>
        <div className="tariff__grid">
          {FIELDS.map((f) => (
            <label key={f.key} className="tariff__field">
              <span>
                {f.label} <span className="tariff__unit">({f.unit})</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step={f.step}
                min={0}
                max={f.max}
                value={value[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="tariff__actions">
          <button onClick={reset} disabled={isDefault}>
            Reset to Ofgem default (Apr 2025)
          </button>
        </div>
      </div>
    </details>
  );
}
