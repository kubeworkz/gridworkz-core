// Web Worker: runs the twin's engines in Pyodide, off the page's main thread.
// It loads the browser bundle that kubeworkz/gpdk publishes to twin-data
// (browser/manifest.json), checks every file against its SHA-256, unpacks the
// source and calls fabtwin.browser.run_scenario with the visitor's overrides.
import { PYODIDE_URL } from './pyodide';

interface FileRecord { path: string; sha256: string; bytes: number }
interface Manifest {
  entry: string; root: string; source: FileRecord & { files: number };
  wheels: FileRecord[]; pyodide_packages: string[]; scenarios: Record<string, string>;
}
type Py = { version: string; globals: { set(k: string, v: unknown): void }; FS: { writeFile(p: string, d: Uint8Array): void }; loadPackage(p: string[]): Promise<void>; runPythonAsync(c: string): Promise<string> };

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
let ready: Promise<{ py: Py; manifest: Manifest }> | null = null;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function fetchChecked(base: string, f: FileRecord): Promise<Uint8Array> {
  const r = await fetch(`${base}/${f.path}`);
  if (!r.ok) throw new Error(`${f.path}: HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const sha = hex(await crypto.subtle.digest('SHA-256', buf));
  if (sha !== f.sha256) throw new Error(`${f.path}: SHA-256 ${sha.slice(0, 12)} does not match the manifest`);
  return new Uint8Array(buf);
}

async function init(base: string) {
  post({ type: 'progress', stage: 'Loading Python (Pyodide)…' });
  const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
  const r = await fetch(`${base}/browser/manifest.json`);
  if (!r.ok) throw new Error(`browser/manifest.json: HTTP ${r.status}`);
  const manifest = (await r.json()) as Manifest;
  const py = (await loadPyodide({ indexURL: PYODIDE_URL })) as Py;
  post({ type: 'progress', stage: 'Loading the twin…' });
  await py.loadPackage(manifest.pyodide_packages);
  const files = [manifest.source, ...manifest.wheels];
  const data = await Promise.all(files.map((f) => fetchChecked(base, f)));
  files.forEach((f, i) => py.FS.writeFile(`/tmp/${f.path.split('/').pop()}`, data[i]));
  py.globals.set('root', manifest.root);
  py.globals.set('source', `/tmp/${manifest.source.path.split('/').pop()}`);
  py.globals.set('wheels', manifest.wheels.map((w) => `/tmp/${w.path.split('/').pop()}`));
  await py.runPythonAsync(`
import site, sys, zipfile
for w in wheels:
    zipfile.ZipFile(w).extractall(site.getsitepackages()[0])
zipfile.ZipFile(source).extractall(root)
sys.path.insert(0, root)
import fabtwin.browser
`);
  return { py, manifest };
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type } = e.data;
  try {
    if (type === 'init') {
      ready ??= init(e.data.base);
      const { py } = await ready;
      post({ id, ok: true, version: py.version });
    } else if (type === 'run') {
      if (!ready) throw new Error('runner not initialised');
      const { py, manifest } = await ready;
      const path = manifest.scenarios[e.data.scenario];
      if (!path) throw new Error(`scenario ${e.data.scenario} is not in the browser bundle`);
      py.globals.set('scenario', `${manifest.root}/${path}`);
      py.globals.set('overrides', JSON.stringify(e.data.overrides ?? null));
      const t = performance.now();
      const out = await py.runPythonAsync(`
import json
from fabtwin.browser import run_scenario
json.dumps(run_scenario(scenario, json.loads(overrides)))`);
      post({ id, ok: true, result: JSON.parse(out), ms: Math.round(performance.now() - t), version: py.version });
    }
  } catch (err) {
    ready = type === 'init' ? null : ready;
    post({ id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
