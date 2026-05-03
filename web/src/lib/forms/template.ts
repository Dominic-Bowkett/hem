import type { HemInput } from "./types";

let cache: HemInput | null = null;
let inflight: Promise<HemInput> | null = null;

export function getDemoTemplate(): Promise<HemInput> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    const url = `${import.meta.env.BASE_URL}examples/demo_24hrs_august.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load demo template (HTTP ${res.status})`);
    cache = (await res.json()) as HemInput;
    return cache;
  })();
  return inflight;
}
