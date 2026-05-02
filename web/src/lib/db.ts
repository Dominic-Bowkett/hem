import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Run = {
  id: string;
  name: string;
  inputJson: string;
  resultJson: string;
  runtimeMs: number;
  createdAt: number;
};

interface HemDB extends DBSchema {
  runs: {
    key: string;
    value: Run;
    indexes: { "by-createdAt": number };
  };
}

const DB_NAME = "hem";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HemDB>> | null = null;

function getDb(): Promise<IDBPDatabase<HemDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HemDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const runs = db.createObjectStore("runs", { keyPath: "id" });
        runs.createIndex("by-createdAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

function newId(): string {
  return crypto.randomUUID();
}

function defaultName(when: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Run ${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

export async function saveRun(args: {
  inputJson: string;
  resultJson: string;
  runtimeMs: number;
  name?: string;
}): Promise<Run> {
  const db = await getDb();
  const now = new Date();
  const run: Run = {
    id: newId(),
    name: args.name?.trim() || defaultName(now),
    inputJson: args.inputJson,
    resultJson: args.resultJson,
    runtimeMs: args.runtimeMs,
    createdAt: now.getTime(),
  };
  await db.put("runs", run);
  return run;
}

export async function listRuns(): Promise<Run[]> {
  const db = await getDb();
  const tx = db.transaction("runs", "readonly");
  const idx = tx.store.index("by-createdAt");
  const all = await idx.getAll();
  return all.reverse();
}

export async function getRun(id: string): Promise<Run | undefined> {
  const db = await getDb();
  return db.get("runs", id);
}

export async function deleteRun(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("runs", id);
}

export async function renameRun(id: string, name: string): Promise<Run | undefined> {
  const db = await getDb();
  const existing = await db.get("runs", id);
  if (!existing) return undefined;
  const updated: Run = { ...existing, name: name.trim() || existing.name };
  await db.put("runs", updated);
  return updated;
}
