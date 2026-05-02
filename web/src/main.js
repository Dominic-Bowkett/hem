import init, { run, hem_version } from "../public/wasm/hem.js";

const $ = (id) => document.getElementById(id);
const status = $("status");
const output = $("output");
const input = $("input");
const runBtn = $("run");
const loadBtn = $("load-example");
const versionEl = $("version");

(async () => {
  try {
    await init();
    versionEl.textContent = `(HEM ${hem_version()})`;
    status.textContent = "WASM ready.";
    runBtn.disabled = false;
  } catch (err) {
    status.textContent = `Failed to load WASM: ${err}`;
    status.classList.add("err");
  }
})();

loadBtn.addEventListener("click", async () => {
  status.textContent = "loading example input…";
  try {
    const res = await fetch("./examples/demo_24hrs_august.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const obj = JSON.parse(text);
    input.value = JSON.stringify(obj, null, 2);
    status.textContent = "example loaded.";
  } catch (err) {
    status.textContent = `failed: ${err.message}`;
    status.classList.add("err");
  }
});

runBtn.addEventListener("click", () => {
  if (!input.value.trim()) {
    status.textContent = "input is empty.";
    return;
  }
  status.textContent = "running…";
  output.textContent = "";
  runBtn.disabled = true;
  const t0 = performance.now();
  queueMicrotask(() => {
    try {
      const result = run(input.value);
      const ms = (performance.now() - t0).toFixed(0);
      const parsed = JSON.parse(result);
      output.textContent = JSON.stringify(parsed, null, 2);
      status.textContent = `ok in ${ms} ms.`;
      status.classList.remove("err");
    } catch (err) {
      output.textContent = String(err && err.stack ? err.stack : err);
      status.textContent = "engine returned an error.";
      status.classList.add("err");
    } finally {
      runBtn.disabled = false;
    }
  });
});
