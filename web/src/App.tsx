import { useEffect, useState } from "react";
import { hemVersion, runHem } from "./lib/hem";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; ms: number; output: string }
  | { kind: "error"; message: string };

export function App() {
  const [version, setVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [run, setRun] = useState<RunState>({ kind: "idle" });

  useEffect(() => {
    hemVersion()
      .then(setVersion)
      .catch((err) => setVersionError(String(err)));
  }, []);

  async function loadExample() {
    setRun({ kind: "idle" });
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/demo_24hrs_august.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const obj = (await res.json()) as unknown;
      setInput(JSON.stringify(obj, null, 2));
    } catch (err) {
      setRun({ kind: "error", message: `failed to load example: ${err}` });
    }
  }

  async function runEngine() {
    if (!input.trim()) {
      setRun({ kind: "error", message: "input is empty" });
      return;
    }
    setRun({ kind: "running" });
    const t0 = performance.now();
    try {
      const result = await runHem(input);
      const ms = Math.round(performance.now() - t0);
      setRun({ kind: "ok", ms, output: JSON.stringify(result, null, 2) });
    } catch (err) {
      const message =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      setRun({ kind: "error", message });
    }
  }

  const ready = version !== null;

  return (
    <main className="page">
      <header className="page__header">
        <h1>HEM Field Assessment Tool</h1>
        <p className="page__sub">
          Open-source UK Home Energy Model engine, running in your browser.{" "}
          {version && <span className="page__meta">(HEM {version})</span>}
          {versionError && <span className="page__error">— failed to load WASM: {versionError}</span>}
        </p>
      </header>

      <section className="page__controls">
        <button onClick={loadExample}>Load example input</button>
        <button onClick={runEngine} disabled={!ready || run.kind === "running"}>
          {run.kind === "running" ? "Running…" : "Run engine"}
        </button>
        <span className="page__status">
          {run.kind === "idle" && (ready ? "WASM ready." : "Loading WASM…")}
          {run.kind === "running" && "Running…"}
          {run.kind === "ok" && `OK in ${run.ms} ms.`}
          {run.kind === "error" && <span className="page__error">{run.message}</span>}
        </span>
      </section>

      <section className="page__io">
        <div className="page__col">
          <label htmlFor="input">Input JSON</label>
          <textarea
            id="input"
            spellCheck={false}
            placeholder="Paste HEM input JSON here, or click 'Load example input'."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="page__col">
          <label htmlFor="output">Output</label>
          <pre id="output">
            {run.kind === "ok"
              ? run.output
              : run.kind === "error"
                ? run.message
                : "(no run yet)"}
          </pre>
        </div>
      </section>
    </main>
  );
}
