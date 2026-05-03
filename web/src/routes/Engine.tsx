import { useEffect, useMemo, useState } from "react";
import { hemVersion, runHem } from "../lib/hem";
import { deleteRun, listRuns, renameRun, saveRun, type Run } from "../lib/db";
import { ARCHETYPES, DEFAULT_ARCHETYPE_ID, findArchetype } from "../lib/forms/registry";
import type { FormParams } from "../lib/forms/types";
import { getDemoTemplate } from "../lib/forms/template";
import { CaptureForm } from "../components/CaptureForm";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; ms: number; output: string }
  | { kind: "error"; message: string };

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
      const template = await getDemoTemplate();
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
      const template = await getDemoTemplate();
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
      setRun({ kind: "ok", ms, output: JSON.stringify(result, null, 2) });
    } catch (err) {
      const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
      setRun({ kind: "error", message });
    }
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
    setRun({ kind: "ok", ms: target.runtimeMs, output: target.resultJson });
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
