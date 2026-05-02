import { FIELDS, type ParametricForm } from "../lib/forms/parametricDemo";

type Props = {
  value: ParametricForm;
  onChange: (next: ParametricForm) => void;
};

export function CaptureForm({ value, onChange }: Props) {
  function update<K extends keyof ParametricForm>(key: K, raw: string) {
    const num = Number(raw);
    if (Number.isFinite(num)) {
      onChange({ ...value, [key]: num });
    }
  }

  return (
    <div className="capture">
      <h2 className="capture__title">Capture</h2>
      <div className="capture__grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="capture__field">
            <span className="capture__label">
              {f.label} <span className="capture__unit">({f.unit})</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              step={f.step}
              min={f.min}
              max={f.max}
              value={value[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
            />
            <span className="capture__hint">{f.hint}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
