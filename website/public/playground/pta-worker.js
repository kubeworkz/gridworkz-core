// Runs the PTA canary harness (WebAssembly, from kubeworkz/grxcp's pta-web
// build) off the page's main thread. Each run gets a fresh module instance,
// so nothing one run leaves in the harness's globals reaches the next; the
// compiled bytes and the unpacked data are fetched once and reused.
/* global PtaMnist */
importScripts('/pta-web/pta_mnist.js');

const DATA = ['train-images-idx3-ubyte', 'train-labels-idx1-ubyte', 't10k-images-idx3-ubyte', 't10k-labels-idx1-ubyte'];
let ready = null;

async function gunzip(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const ds = r.body.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}
async function load() {
  const [wasm, net, ...data] = await Promise.all([
    fetch('/pta-web/pta_mnist.wasm').then((r) => r.arrayBuffer()),
    fetch('/pta-web/canary_seed1.net').then((r) => r.arrayBuffer()),
    ...DATA.map((f) => gunzip(`/pta-web/${f}.gz`)),
  ]);
  return { wasm, net: new Uint8Array(net), data };
}

self.onmessage = async ({ data: { id, args } }) => {
  try {
    if (!ready) { self.postMessage({ id, status: 'loading' }); ready = load(); }
    const { wasm, net, data } = await ready;
    self.postMessage({ id, status: 'running' });
    const out = [];
    const mod = await PtaMnist({ wasmBinary: wasm, print: (t) => out.push(t), printErr: (t) => out.push(t) });
    mod.FS.mkdir('/data');
    DATA.forEach((f, i) => mod.FS.writeFile(`/data/${f}`, data[i]));
    mod.FS.writeFile('/canary.net', net);
    const t0 = performance.now();
    let code = 0;
    try { code = mod.callMain(['eval', '--data', '/data', '--net', '/canary.net', ...args]) ?? 0; }
    catch (e) { if (e && typeof e.status === 'number') code = e.status; else throw e; }
    self.postMessage({ id, status: 'done', code, output: out.join('\n'), ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id, status: 'error', message: String(e && e.message || e) });
  }
};
