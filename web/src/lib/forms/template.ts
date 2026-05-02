import type { DemoTemplate } from "./parametricDemo";

let cache: DemoTemplate | null = null;
let inflight: Promise<DemoTemplate> | null = null;

export function getDemoTemplate(): Promise<DemoTemplate> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    const url = `${import.meta.env.BASE_URL}examples/demo_24hrs_august.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load demo template (HTTP ${res.status})`);
    cache = (await res.json()) as DemoTemplate;
    return cache;
  })();
  return inflight;
}
