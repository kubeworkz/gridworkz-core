// Loads the latest published GRX930 simulation results at build time.
// They are written by kubeworkz/grx930's .github/workflows/sim-replays.yml to
// the `sim-results` branch: results.json plus one log per simulation.
// SIM_RESULTS_URL overrides the base (used to test against local files).
export interface SimRun {
  id: string; command: string; checks: string;
  status: 'pass' | 'fail' | 'timeout'; exit_code: number; seconds: number;
  pass_lines: number; fail_lines: number; finish: string | null; log: string;
}
export interface SimResults {
  repo: string; commit: string | null; ref: string | null; run_url: string | null;
  generated_at: string; simulator: string | null; runs: SimRun[];
}
export const RESULTS_BASE = process.env.SIM_RESULTS_URL || 'https://raw.githubusercontent.com/kubeworkz/grx930/sim-results';
export const BRANCH_URL = 'https://github.com/kubeworkz/grx930/tree/sim-results';

export async function loadSimResults(): Promise<{ results: SimResults | null; tails: Record<string, string[]>; reason?: string }> {
  try {
    const res = await fetch(`${RESULTS_BASE}/results.json`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { results: null, tails: {}, reason: `results.json: HTTP ${res.status}` };
    const results = (await res.json()) as SimResults;
    const tails: Record<string, string[]> = {};
    await Promise.all(results.runs.map(async (r) => {
      try {
        const lr = await fetch(`${RESULTS_BASE}/${r.log}`, { signal: AbortSignal.timeout(10000) });
        if (lr.ok) tails[r.id] = (await lr.text()).trimEnd().split('\n').slice(-24);
      } catch { /* the excerpt is optional; the full-log link still works */ }
    }));
    return { results, tails };
  } catch (e) {
    return { results: null, tails: {}, reason: (e as Error).message };
  }
}
