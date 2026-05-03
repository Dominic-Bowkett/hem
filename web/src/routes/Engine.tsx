import { useEffect, useMemo, useState } from "react";
import { hemVersion, runHem } from "../lib/hem";
import { deleteRun, listRuns, renameRun, saveRun, type Run } from "../lib/db";
import { ARCHETYPES, DEFAULT_ARCHETYPE_ID, findArchetype } from "../lib/forms/registry";
import type { FormParams } from "../lib/forms/types";
import { loadTemplate } from "../lib/forms/template";
import { summariseDetailed, summariseResults, type DetailedSummary, type HemPayload, type ResultsSummary } from "../lib/results";
import { CaptureForm } from "../components/CaptureForm";
import { ResultsSummaryView } from "../components/ResultsSummary";
import { Compare } from "../components/Compare";
import { TariffSettings } from "../components/TariffSettings";
import { loadTariff, saveTariff, type Tariff } from "../lib/tariff";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | {
      kind: "ok";
      ms: number;
      output: string;
      summary: ResultsSummary | null;
      detailed: DetailedSummary | null;
      payload: HemPayload;
    }
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
  const [wholeYear, setWholeYear] = useState(false);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [history, setHistory] = useState<Run[]>([]);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [tariff, setTariffState] = useState<Tariff>(() => loadTariff());

  function setTariff(next: Tariff) {
    setTariffState(next);
    saveTariff(next);
    // Re-run the summariser on the current run so cost cards refresh live
    setRun((prev) => {
      if (prev.kind !== "ok") return prev;
      const summary = summariseResults(prev.payload, next);
      return { ...prev, summary };
    });
  }

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
      const next = archetype.applyForm(template, form) as Record<string, unknown>;
      if (wholeYear) {
        next.SimulationTime = { start: 0, end: 8760, step: 1 };
      }
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
      const summary = summariseResults(payload, tariff);
      const detailed = summariseDetailed(payload);
      setRun({
        kind: "ok",
        ms,
        output: JSON.stringify(result, null, 2),
        summary,
        detailed,
        payload,
      });
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
    let detailed: DetailedSummary | null = null;
    let payload: HemPayload | null = null;
    try {
      payload = JSON.parse(target.resultJson) as HemPayload;
      summary = summariseResults(payload, tariff);
      detailed = summariseDetailed(payload);
    } catch {
      // older saved runs may have unparsable output; show raw text only
    }
    if (payload) {
      setRun({
        kind: "ok",
        ms: target.runtimeMs,
        output: target.resultJson,
        summary,
        detailed,
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
    setCompareIds((s) => {
      if (!s.has(target.id)) return s;
      const n = new Set(s);
      n.delete(target.id);
      return n;
    });
    void refreshHistory();
  }

  function toggleCompare(id: string) {
    setCompareIds((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        // Cap the comparison at 2 runs; remove the oldest selection if needed.
        if (n.size >= 2) {
          const first = n.values().next().value;
          if (first) n.delete(first);
        }
        n.add(id);
      }
      return n;
    });
  }

  const comparePair = useMemo<[Run, Run] | null>(() => {
    if (compareIds.size !== 2) return null;
    const ids = [...compareIds];
    const a = history.find((r) => r.id === ids[0]);
    const b = history.find((r) => r.id === ids[1]);
    return a && b ? [a, b] : null;
  }, [compareIds, history]);

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

      <TariffSettings value={tariff} onChange={setTariff} />

      <section className="page__controls">
        <button onClick={buildFromForm}>Build input from form</button>
        <button onClick={loadRawExample}>Load template as-is</button>
        <button onClick={runEngine} disabled={!ready || run.kind === "running"}>
          {run.kind === "running" ? "Running…" : "Run engine"}
        </button>
        <button onClick={saveCurrentRun} disabled={!canSave}>
          {savedFor ? "Saved ✓" : "Save run"}
        </button>
        <label className="page__toggle" title="When on, Build will overwrite SimulationTime to {start: 0, end: 8760, step: 1}.">
          <input
            type="checkbox"
            checked={wholeYear}
            onChange={(e) => setWholeYear(e.target.checked)}
          />
          <span>Whole year (8760 h, ~5–10 s)</span>
        </label>
        <span className="page__status">
          {run.kind === "idle" && (ready ? "WASM ready." : "Loading WASM…")}
          {run.kind === "running" && "Running…"}
          {run.kind === "ok" && `OK in ${run.ms} ms.`}
          {run.kind === "error" && <span className="page__error">{run.message}</span>}
        </span>
      </section>

      {run.kind === "ok" && (
        <ResultsSummaryView summary={run.summary} detailed={run.detailed} />
      )}

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
              const checked = compareIds.has(r.id);
              return (
                <li key={r.id} className="history__item">
                  <input
                    type="checkbox"
                    className="history__check"
                    checked={checked}
                    onChange={() => toggleCompare(r.id)}
                    aria-label={`Compare ${r.name}`}
                    title="Tick two runs to compare them below"
                  />
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
        {history.length > 1 && compareIds.size < 2 && (
          <p className="history__hint">
            Tick two runs to compare their headline numbers and monthly gas use.
          </p>
        )}
      </section>

      {comparePair && (
        <Compare
          a={comparePair[0]}
          b={comparePair[1]}
          tariff={tariff}
          onClear={() => setCompareIds(new Set())}
        />
      )}
    </>
  );
}
