// Loads the published digital-twin bundle at build time. It is written by
// kubeworkz/gpdk's .github/workflows/twin-data.yml (`python -m fabtwin
// export-site`) to the `twin-data` branch: index.json, and under
// runs/<scenario>/ each fresh run's manifest, observations and artifacts.
// TWIN_DATA_URL overrides the base (for testing against a local bundle).

export const TWIN_BASE =
  process.env.TWIN_DATA_URL || 'https://raw.githubusercontent.com/kubeworkz/gpdk/twin-data';
export const TWIN_REPO = 'https://github.com/kubeworkz/gpdk';
export const TWIN_BRANCH = `${TWIN_REPO}/tree/twin-data`;

export type Evidence = 'measured' | 'vendor' | 'literature' | 'proxy' | 'assumed';

export interface Observation {
  observation_id: string;
  run_id: string;
  entity_type: string;
  entity_id: string;
  metric: string;
  value: number | string | null;
  unit: string;
  uncertainty: number | string | null;
  evidence_class: Evidence;
  source_artifact: string;
  model_version: string;
}

export interface TwinEngine { name: string; version: string; fidelity: string; model_version: string }
export interface TwinFile { path: string; media_type: string; bytes: number; sha256: string }
export interface TwinRun {
  scenario_id: string; run_id: string; description: string; product: string; process: string;
  seed: number; samples: number; started_at: string; engines: TwinEngine[];
  observation_count: number; evidence_classes: Partial<Record<Evidence, number>>;
  fingerprint_sha256: string; warnings: string[]; files: TwinFile[];
}
export interface TwinIndex {
  schema_version: string; generated_at: string; commit: string | null; run_url: string | null;
  claim: string; runs: TwinRun[];
}
export interface Manifest {
  inputs: { role: string; path: string; sha256: string; bytes?: number }[];
  toolchain: Record<string, string>;
  [key: string]: unknown;
}

// The four domains of the architecture (gpdk docs/fab-sim-architecture.md §3).
export const DOMAINS = [
  { id: 'process', label: 'Process & device' },
  { id: 'yield', label: 'Layout, patterning & yield' },
  { id: 'package', label: 'Photonics & package' },
  { id: 'factory', label: 'Factory & ATP' },
] as const;
export type Domain = (typeof DOMAINS)[number]['id'];
export const FIDELITIES = [
  { id: 'F0', label: 'Analytical' },
  { id: 'F1', label: 'Stochastic / surrogate' },
  { id: 'F2', label: 'Layout-aware' },
  { id: 'F3', label: 'Physics' },
] as const;
const ENGINE_DOMAIN: Record<string, Domain> = {
  gpdk: 'process',
  yield: 'yield', yield_sensitivity: 'yield', yield_variation: 'yield', yield_wafer_map: 'yield',
  pta: 'package', pta_photonic: 'package', mcm_yield: 'package',
  factory_atp: 'factory',
};
export const engineDomain = (name: string): Domain | undefined => ENGINE_DOMAIN[name];

const cache = new Map<string, Promise<string>>();
const get = (path: string) => {
  if (!cache.has(path)) {
    cache.set(path, (async () => {
      const r = await fetch(`${TWIN_BASE}/${path}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.text();
    })());
  }
  return cache.get(path)!;
};

export async function loadTwin(): Promise<{ index: TwinIndex | null; reason?: string }> {
  try {
    return { index: JSON.parse(await get('index.json')) as TwinIndex };
  } catch (e) {
    return { index: null, reason: String((e as Error).message ?? e) };
  }
}

export interface TwinScenario {
  run: TwinRun;
  observations: Observation[];
  manifest: Manifest;
}

/** One scenario's run, observations and manifest, or null when unpublished. */
export async function loadScenario(index: TwinIndex | null, id: string): Promise<TwinScenario | null> {
  const run = index?.runs.find((r) => r.scenario_id === id);
  if (!run) return null;
  try {
    const [obs, manifest] = await Promise.all([
      get(`runs/${id}/observations.json`),
      get(`runs/${id}/run.json`),
    ]);
    return { run, observations: JSON.parse(obs), manifest: JSON.parse(manifest) };
  } catch {
    return null;
  }
}

export const loadArtifact = (id: string, name: string) => get(`runs/${id}/${name}`);
export const fileUrl = (id: string, name: string) => `${TWIN_BRANCH.replace('/tree/', '/blob/')}/runs/${id}/${name}`;
export const rawUrl = (id: string, name: string) => `${TWIN_BASE}/runs/${id}/${name}`;

/** Find one observation; throws if the published run lacks it, so a renamed metric fails the build. */
export function obs(rows: Observation[], entityType: string, entityId: string, metric: string): Observation {
  const row = rows.find((r) => r.entity_type === entityType && r.entity_id === entityId && r.metric === metric);
  if (!row) throw new Error(`twin: no ${entityType}/${entityId}/${metric} in ${rows[0]?.run_id ?? 'run'}`);
  return row;
}
export const num = (o: Observation) => {
  if (typeof o.value !== 'number') throw new Error(`twin: ${o.metric} is not numeric`);
  return o.value;
};

// Display helpers. Observations are stored in SI units.
const WEEK = 7 * 24 * 3600;
export const fmt = {
  pct: (v: number, d = 2) => `${(v * 100).toFixed(d)}%`,
  hours: (s: number, d = 1) => `${(s / 3600).toFixed(d)} h`,
  perWeek: (perS: number, d = 0) => (perS * WEEK).toLocaleString('en-US', { maximumFractionDigits: d }),
  usd: (v: number, d = 2) => `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`,
  musd: (v: number, d = 2) => `${v < 0 ? '−' : ''}$${Math.abs(v / 1e6).toFixed(d)}M`,
  int: (v: number) => Math.round(v).toLocaleString('en-US'),
  fixed: (v: number, d = 2) => v.toFixed(d),
  mm2: (m2: number, d = 2) => `${(m2 * 1e6).toFixed(d)} mm²`,
};
export const WEEK_S = WEEK;
