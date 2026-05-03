import type { ArchetypeDef, FormParams } from "../lib/forms/types";

type Props = {
  archetype: ArchetypeDef;
  value: FormParams;
  onChange: (next: FormParams) => void;
};

export function CaptureForm({ archetype, value, onChange }: Props) {
  function update(key: string, raw: string) {
    const num = Number(raw);
    if (Number.isFinite(num)) {
      onChange({ ...value, [key]: num });
    }
  }

  return (
    <div className="capture">
      <div className="capture__head">
        <h2 className="capture__title">{archetype.name}</h2>
        <p className="capture__desc">{archetype.description}</p>
      </div>
      <div className="capture__grid">
        {archetype.fields.map((f) => (
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
              value={value[f.key] ?? 0}
              onChange={(e) => update(f.key, e.target.value)}
            />
            <span className="capture__hint">{f.hint}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
