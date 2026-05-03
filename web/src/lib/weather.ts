const EPW_KEYS = [
  "air_temperatures",
  "wind_speeds",
  "wind_directions",
  "direct_beam_radiation",
  "diffuse_horizontal_radiation",
  "solar_reflectivity_of_ground",
] as const;

export type WeatherSource =
  | { kind: "template" }
  | { kind: "bundled" }
  | { kind: "upload"; filename: string; text: string };

let bundledCache: string | null = null;
let bundledInflight: Promise<string> | null = null;

export function fetchBundledEpw(): Promise<string> {
  if (bundledCache) return Promise.resolve(bundledCache);
  if (bundledInflight) return bundledInflight;
  bundledInflight = (async () => {
    const url = `${import.meta.env.BASE_URL}weather/london_demo.epw`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load bundled EPW (HTTP ${res.status})`);
    bundledCache = await res.text();
    return bundledCache;
  })();
  return bundledInflight;
}

/**
 * Strip ExternalConditions arrays from a HEM input so an EPW supplied
 * alongside is unambiguously the source of truth. Lat/long/shading are kept.
 */
export function stripWeatherArrays(input: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(input) as Record<string, unknown>;
  const ec = next.ExternalConditions;
  if (ec && typeof ec === "object") {
    const ecObj = ec as Record<string, unknown>;
    for (const k of EPW_KEYS) delete ecObj[k];
  }
  return next;
}

export function describeSource(s: WeatherSource): string {
  switch (s.kind) {
    case "template":
      return "Template (synthesised, smooth)";
    case "bundled":
      return "Bundled London EPW (with noise)";
    case "upload":
      return `Uploaded: ${s.filename}`;
  }
}
