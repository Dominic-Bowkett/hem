import { useRef } from "react";
import type { WeatherSource } from "../lib/weather";
import { describeSource } from "../lib/weather";

type Props = {
  value: WeatherSource;
  onChange: (next: WeatherSource) => void;
};

export function WeatherPicker({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    onChange({ kind: "upload", filename: f.name, text });
  }

  return (
    <details className="weather">
      <summary className="weather__summary">
        Weather
        <span className="weather__current">{describeSource(value)}</span>
      </summary>
      <div className="weather__body">
        <p className="weather__hint">
          Picks the source of hourly weather the engine sees. Template is the smooth
          sinusoid baked into the archetype JSON; the bundled demo EPW adds realistic
          day-to-day noise (cold snaps, cloudy spells); uploading your own EPW (e.g.
          a CIBSE TRY or DOE EnergyPlus file for the property's region) gives the
          most defensible result.
        </p>

        <fieldset className="weather__choices">
          <label>
            <input
              type="radio"
              name="weather"
              checked={value.kind === "template"}
              onChange={() => onChange({ kind: "template" })}
            />{" "}
            Template (synthesised, smooth)
          </label>
          <label>
            <input
              type="radio"
              name="weather"
              checked={value.kind === "bundled"}
              onChange={() => onChange({ kind: "bundled" })}
            />{" "}
            Bundled London demo EPW (1.3 MB, with daily noise)
          </label>
          <label>
            <input
              type="radio"
              name="weather"
              checked={value.kind === "upload"}
              onChange={() => fileRef.current?.click()}
            />{" "}
            Uploaded EPW{value.kind === "upload" && `: ${value.filename}`}
            <button
              type="button"
              className="weather__upload"
              onClick={() => fileRef.current?.click()}
            >
              Choose file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".epw,text/plain"
              hidden
              onChange={onFile}
            />
          </label>
        </fieldset>
      </div>
    </details>
  );
}
