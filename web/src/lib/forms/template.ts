import type { HemInput } from "./types";

const cache = new Map<string, HemInput>();
const inflight = new Map<string, Promise<HemInput>>();

export function loadTemplate(url: string): Promise<HemInput> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(url);
  if (pending) return pending;
  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load template (HTTP ${res.status}): ${url}`);
    const json = (await res.json()) as HemInput;
    cache.set(url, json);
    inflight.delete(url);
    return json;
  })();
  inflight.set(url, promise);
  return promise;
}
