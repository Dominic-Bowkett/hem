import { useEffect, useMemo, useState } from "react";
import { hemVersion, runHem } from "../lib/hem";
import { deleteRun, listRuns, renameRun, saveRun, type Run } from "../lib/db";
import { ARCHETYPES, DEFAULT_ARCHETYPE_ID, findArchetype } from "../lib/forms/registry";
import type { FormParams } from "../lib/forms/types";
import { loadTemplate } from "../lib/forms/template";
import { summariseResults, type HemPayload, type ResultsSummary } from "../lib/results";
import { CaptureForm } from "../components/CaptureForm";
import { ResultsSummaryView } from "../components/ResultsSummary";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; ms: number; output: string; summary: ResultsSummary | null; payload: HemPayload }
  | { kind: "error"; message: string };

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function Engine() {
  const [version, setVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const [archetypeId, setArchetypeId] = useState<string>(DEFAULT_ARCHETYPE_ID);
  const archetype = useMemo(
    () => findArchetype(archetypeId) ?? ARCHETYPES[0]!,
    [archetypeId],
  );
  const [form, setForm] = useState<FormParams>(() => ({ ...archetype.defaults }));

  const [input, setInput] = useState("");
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [history, setHistory] = useState<Run[]>([]);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  useEffect(() => {
    hemVersion()
      .then(setVersion)
      .catch((err) => setVersionError(String(err)));
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, []);

  async function refreshHistory() {
    setHistory(await listRuns());
  }

  function pickArchetype(id: string) {
    const a = findArchetype(id);
    if (!a) return;
    setArchetypeId(id);
    setForm({ ...a.defaults });
    setInput("");
    setRun({ kind: "idle" });
    setSavedFor(null);
  }

  async function buildFromForm() {
    setSavedFor(null);
    setRun({ kind: "idle" });
    try {
      const url = `${import.meta.env.BASE_URL}${archetype.templatePath}`;
      const template = await loadTemplate(url);
      const next = archetype.applyForm(template, form);
      setInput(JSON.stringify(next, null, 2));
    } catch (err) {
      setRun({ kind: "error", message: `failed to build input: ${err}` });
    }
  }

  async function loadRawExample() {
    setSavedFor(null);
    setRun({ kind: "idle" });
    try {
      const url = `${import.meta.env.BASE_URL}${archetype.templatePath}`;
      const template = await loadTemplate(url);
      setInput(JSON.stringify(template, null, 2));
    } catch (err) {
      setRun({ kind: "error", message: `failed to load example: ${err}` });
    }
  }

  async function runEngine() {
    if (!input.trim()) {
      setRun({ kind: "error", message: "input is empty — click Build from form first." });
      return;
    }
    setSavedFor(null);
    setRun({ kind: "running" });
    const t0 = performance.now();
    try {
      const result = await runHem(input);
      const ms = Math.round(performance.now() - t0);
      const payload = result as HemPayload;
      const summary = summariseResults(payload);
      setRun({ kind: "ok", ms, output: JSON.stringify(result, null, 2), summary, payload });
    } catch (err) {
      const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
      setRun({ kind: "error", message });
    }
  }

  function downloadCsv() {
    if (run.kind !== "ok") return;
    const csv = run.payload.files?.["results.csv"];
    if (!csv) return;
    downloadBlob(`hem-results-${timestamp()}.csv`, "text/csv", csv);
  }

  function downloadJson() {
    if (run.kind !== "ok") return;
    downloadBlob(`hem-output-${timestamp()}.json`, "application/json", run.output);
  }

  function downloadInput() {
    if (!input.trim()) return;
    downloadBlob(`hem-input-${timestamp()}.json`, "application/json", input);
  }

  async function saveCurrentRun() {
    if (run.kind !== "ok") return;
    const stored = await saveRun({
      inputJson: input,
      resultJson: run.output,
      runtimeMs: run.ms,
      archetypeId: archetype.id,
      formParams: form,
    });
    setSavedFor(stored.id);
    void refreshHistory();
  }

  function reload(target: Run) {
    setInput(target.inputJson);
    let summary: ResultsSummary | null = null;
    let payload: HemPayload | null = null;
    try {
      payload = JSON.parse(target.resultJson) as HemPayload;
      summary = summariseResults(payload);
    } catch {
      // older saved runs may have unparsable output; show raw text only
    }
    if (payload) {
      setRun({
        kind: "ok",
        ms: target.runtimeMs,
        output: target.resultJson,
        summary,
        payload,
      });
    } else {
      setRun({ kind: "error", message: "saved output is not valid JSON; raw text:\n" + target.resultJson });
    }
    setSavedFor(target.id);
    if (target.archetypeId) {
      const a = findArchetype(target.archetypeId);
      if (a) {
        setArchetypeId(a.id);
        setForm({ ...a.defaults, ...(target.formParams ?? {}) });
        return;
      }
    }
    if (target.formParams) {
      setForm((prev) => ({ ...prev, ...target.formParams }));
    }
  }

  async function rename(target: Run) {
    const next = window.prompt("Rename run", target.name);
    if (next === null) return;
    await renameRun(target.id, next);
    void refreshHistory();
  }

  async function remove(target: Run) {
    if (!window.confirm(`Delete "${target.name}"?`)) return;
    await deleteRun(target.id);
    if (savedFor === target.id) setSavedFor(null);
    void refreshHistory();
  }

  const ready = version !== null;
  const canSave = run.kind === "ok" && savedFor === null;

  return (
    <>
      <p className="page__sub">
        Open-source UK Home Energy Model engine, running in your browser.{" "}
        {version && <span className="page__meta">(HEM {version})</span>}
        {versionError && (
          <span className="page__error"> — failed to load WASM: {versionError}</span>
        )}
      </p>

      <section className="archetype-picker">
        <label>
          <span>Archetype</span>
          <select value={archetypeId} onChange={(e) => pickArchetype(e.target.value)}>
            {ARCHETYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <CaptureForm archetype={archetype} value={form} onChange={setForm} />

      <section className="page__controls">
        <button onClick={buildFromForm}>Build input from form</button>
        <button onClick={loadRawExample}>Load template as-is</button>
        <button onClick={runEngine} disabled={!ready || run.kind === "running"}>
          {run.kind === "running" ? "Running…" : "Run engine"}
        </button>
        <button onClick={saveCurrentRun} disabled={!canSave}>
          {savedFor ? "Saved ✓" : "Save run"}
        </button>
        <span className="page__status">
          {run.kind === "idle" && (ready ? "WASM ready." : "Loading WASM…")}
          {run.kind === "running" && "Running…"}
          {run.kind === "ok" && `OK in ${run.ms} ms.`}
          {run.kind === "error" && <span className="page__error">{run.message}</span>}
        </span>
      </section>

      {run.kind === "ok" && <ResultsSummaryView summary={run.summary} />}

      <section className="downloads">
        <button onClick={downloadInput} disabled={!input.trim()}>
          Download input JSON
        </button>
        <button onClick={downloadCsv} disabled={run.kind !== "ok"}>
          Download results.csv
        </button>
        <button onClick={downloadJson} disabled={run.kind !== "ok"}>
          Download full output JSON
        </button>
      </section>

      <section className="page__io">
        <div className="page__col">
          <label htmlFor="input">Input JSON</label>
          <textarea
            id="input"
            spellCheck={false}
            placeholder="Click 'Build input from form' to populate this from the capture above."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="page__col">
          <label htmlFor="output">Output (raw)</label>
          <pre id="output">
            {run.kind === "ok"
              ? run.output
              : run.kind === "error"
                ? run.message
                : "(no run yet)"}
          </pre>
        </div>
      </section>

      <section className="history">
        <h2 className="history__title">Saved runs</h2>
        {history.length === 0 ? (
          <p className="history__empty">
            No saved runs yet. Run the engine and click <em>Save run</em> to keep one.
          </p>
        ) : (
          <ul className="history__list">
            {history.map((r) => {
              const a = r.archetypeId ? findArchetype(r.archetypeId) : undefined;
              return (
                <li key={r.id} className="history__item">
                  <div className="history__main">
                    <button className="history__name" onClick={() => reload(r)}>
                      {r.name}
                    </button>
                    <span className="history__meta">
                      {new Date(r.createdAt).toLocaleString()} · {r.runtimeMs} ms
                      {a && ` · ${a.name}`}
                    </span>
                  </div>
                  <div className="history__actions">
                    <button onClick={() => rename(r)}>Rename</button>
                    <button onClick={() => remove(r)}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
