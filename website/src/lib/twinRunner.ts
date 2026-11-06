// Client side of the in-browser twin: one shared worker per page.
export interface RunResult {
  scenario_id: string;
  overrides: { role: string; path: string; from: number; to: number }[];
  engines: { name: string; version: string; fidelity: string; model_version: string; metadata: Record<string, unknown> }[];
  observations: { entity_type: string; entity_id: string; metric: string; value: number; unit: string; uncertainty: number | null; evidence_class: string }[];
  artifacts: Record<string, string>;
  warnings: string[];
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
const listeners = new Set<(stage: string) => void>();

function get(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./twinWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'progress') { listeners.forEach((l) => l(m.stage)); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.ok ? p.resolve(m) : p.reject(new Error(m.error));
  };
  worker.onerror = (e) => { pending.forEach((p) => p.reject(new Error(e.message || 'worker error'))); pending.clear(); };
  return worker;
}
const call = (msg: Record<string, unknown>) => new Promise<any>((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  get().postMessage({ ...msg, id });
});

export function onProgress(fn: (stage: string) => void) { listeners.add(fn); return () => listeners.delete(fn); }
export async function ensureRunner(base: string): Promise<string> {
  return (await call({ type: 'init', base })).version;
}
export async function runTwin(base: string, scenario: string, overrides: Record<string, Record<string, number>>):
  Promise<{ result: RunResult; ms: number; version: string }> {
  await ensureRunner(base);
  return call({ type: 'run', scenario, overrides });
}
export const value = (r: RunResult, entityType: string, entityId: string, metric: string) => {
  const o = r.observations.find((x) => x.entity_type === entityType && x.entity_id === entityId && x.metric === metric);
  if (!o) throw new Error(`no ${entityType}/${entityId}/${metric} in the run`);
  return o.value;
};
