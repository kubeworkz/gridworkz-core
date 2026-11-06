#!/usr/bin/env node
// Fetches the WebAssembly modules the playground runs, before a build, into
// public/<name>/. Each is published to a branch by its own repository's CI
// only when it printed the same bytes as its native build:
//   pta-web  kubeworkz/grxcp  .github/workflows/pta-web.yml  -> /playground/photonic
//   npu-web  kubeworkz/grx930 .github/workflows/npu-web.yml  -> /playground/npu-registers
// Every file is checked against that branch's manifest.json. On any failure the
// module is left out, its page says so, and the build goes on.
// PTA_WEB_URL / NPU_WEB_URL override a source (for testing).
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULES = [
  { name: 'pta-web', base: process.env.PTA_WEB_URL || 'https://raw.githubusercontent.com/kubeworkz/grxcp/pta-web' },
  { name: 'npu-web', base: process.env.NPU_WEB_URL || 'https://raw.githubusercontent.com/kubeworkz/grx930/npu-web' },
];
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '../public');

async function fetchModule({ name, base }) {
  const out = join(PUBLIC, name);
  const get = async (f) => {
    const r = await fetch(`${base}/${f}`, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  };
  try {
    const manifestBytes = await get('manifest.json');
    const manifest = JSON.parse(manifestBytes.toString());
    if (manifest.identical_to_native !== true) throw new Error('manifest does not say the build matched its native build');
    const files = {};
    for (const [f, { sha256 }] of Object.entries(manifest.files)) {
      const b = await get(f);
      const got = createHash('sha256').update(b).digest('hex');
      if (got !== sha256) throw new Error(`${f}: sha256 ${got} != manifest ${sha256}`);
      files[f] = b;
    }
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    for (const [f, b] of Object.entries(files)) writeFileSync(join(out, f), b);
    writeFileSync(join(out, 'manifest.json'), manifestBytes);
    console.log(`[${name}] ${Object.keys(files).length} files from ${manifest.repo}@${manifest.commit.slice(0, 7)}, checked against its manifest`);
  } catch (e) {
    rmSync(out, { recursive: true, force: true });
    console.warn(`[${name}] not fetched (${e.message}); its playground page will say so`);
  }
}
await Promise.all(MODULES.map(fetchModule));
