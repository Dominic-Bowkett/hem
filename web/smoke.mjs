import { readFile } from "node:fs/promises";
import init, { run, hem_version } from "./public/wasm/hem.js";

const wasmPath = new URL("./public/wasm/hem_bg.wasm", import.meta.url);
const wasmBytes = await readFile(wasmPath);
await init({ module_or_path: wasmBytes });

console.log("HEM version:", hem_version());

const inputJson = await readFile(new URL("./examples/demo_24hrs_august.json", import.meta.url), "utf8");
const t0 = performance.now();
try {
  const out = run(inputJson);
  const ms = (performance.now() - t0).toFixed(0);
  console.log(`run() ok in ${ms} ms; output length:`, out.length);
  const parsed = JSON.parse(out);
  console.log("top-level keys:", Object.keys(parsed));
  console.log("preview:", JSON.stringify(parsed, null, 2).slice(0, 600));
} catch (err) {
  console.error("run() threw:", err);
  process.exit(1);
}
