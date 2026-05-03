type WasmModule = {
  default: (options?: { module_or_path?: string | URL | Response }) => Promise<unknown>;
  run: (input_json: string) => string;
  run_with_epw: (input_json: string, epw_text: string) => string;
  hem_version: () => string;
};

const wasmBase = `${import.meta.env.BASE_URL}wasm`;

let cached: Promise<WasmModule> | null = null;

function loadHem(): Promise<WasmModule> {
  if (!cached) {
    cached = (async () => {
      const mod = (await import(/* @vite-ignore */ `${wasmBase}/hem.js`)) as WasmModule;
      await mod.default();
      return mod;
    })();
  }
  return cached;
}

export type HemPayload = {
  hem_version: string;
  response: unknown;
  files: Record<string, string>;
};

export async function hemVersion(): Promise<string> {
  const m = await loadHem();
  return m.hem_version();
}

export async function runHem(inputJson: string): Promise<HemPayload> {
  const m = await loadHem();
  const raw = m.run(inputJson);
  return JSON.parse(raw) as HemPayload;
}

export async function runHemWithEpw(inputJson: string, epwText: string): Promise<HemPayload> {
  const m = await loadHem();
  const raw = m.run_with_epw(inputJson, epwText);
  return JSON.parse(raw) as HemPayload;
}