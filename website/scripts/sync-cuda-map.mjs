#!/usr/bin/env node
// Builds src/data/cuda-map.json for the CUDA porting checker from a local
// grxcp checkout:
//
//   node scripts/sync-cuda-map.mjs ../../grxcp
//
// What it reads, so the checker can never claim more than GRXCP provides:
//   include/grx/grx_cuda_compat.h   cudaX -> grxX renames (the host API)
//   include/grx/device/*.h          CUDA-spelled device built-ins grxcc supplies
//   include/grx/grxblas.h           which cuBLAS routines have a grxBLAS twin
// Everything else (differences, out-of-scope items) is the CURATED table
// below, each entry citing its section of docs/designs/cuda_mapping.md.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2];
if (!root) { console.error('usage: sync-cuda-map.mjs <path-to-grxcp>'); process.exit(1); }
const read = (p) => readFileSync(join(root, p), 'utf8');
const git = (args) => execSync(`git -C "${root}" ${args}`, { encoding: 'utf8' }).trim();
const [commit, date] = git('log -1 --format=%h,%cs').split(',');

const entries = {};
const set = (name, e) => { entries[name] = { ...(entries[name] || {}), ...e }; };

// 1. Host API renames. Handles function-like macros and line continuations.
const compat = read('include/grx/grx_cuda_compat.h').replace(/\\\n\s*/g, ' ');
let section = '';
for (const line of compat.split('\n')) {
  const sec = line.match(/^\/\/ --- ([a-z ]+?) -/);
  if (sec) section = sec[1].trim();
  const m = line.match(/^#define\s+(cuda\w+)(\([^)]*\))?\s+([A-Za-z_]\w*)/);
  if (!m) continue;
  const [, cuda, , grx] = m;
  const group = /Memcpy|Pointer/.test(cuda) ? 'memory' : section.replace('launch and occupancy', 'launch');
  set(cuda, { status: 'direct', grx, group });
}

// 2. Device built-ins with CUDA spelling that grxcc's device pass supplies.
const devDir = join(root, 'include/grx/device');
const devSrc = readdirSync(devDir).filter((f) => f.endsWith('.h')).map((f) => readFileSync(join(devDir, f), 'utf8')).join('\n');
const DEVICE = ['__syncthreads', '__syncwarp', '__threadfence', '__threadfence_block', '__threadfence_system',
  '__shfl_sync', '__shfl_up_sync', '__shfl_down_sync', '__shfl_xor_sync', '__ballot_sync', '__any_sync',
  '__all_sync', '__activemask', '__popc', '__clz', '__brev', '__ffs'];
for (const n of DEVICE) if (new RegExp(`\\b${n}\\b`).test(devSrc)) set(n, { status: 'same', group: 'device' });
for (const n of ['atomicAdd', 'atomicSub', 'atomicExch', 'atomicMin', 'atomicMax', 'atomicAnd', 'atomicOr', 'atomicXor', 'atomicCAS', 'atomicInc', 'atomicDec']) {
  set(n, new RegExp(`\\b${n}\\b`).test(devSrc)
    ? { status: 'config', group: 'device', note: 'Compiles to a clear error on the current G100 build (no RISC-V atomic extension); works on builds with it enabled. Float forms use a compare-and-swap loop.', ref: '7.16' }
    : { status: 'notyet', group: 'device' });
}

// 3. cuBLAS routines with a grxBLAS twin (renamed by hand; check signatures).
const blas = read('include/grx/grxblas.h');
for (const [, fn] of blas.matchAll(/\bgrxblas([A-Z]\w*)\s*\(/g)) {
  // Skip GRX-only debug hooks that have no cuBLAS counterpart.
  if (/Cycle|Engine|KernelPath|LoadedKernel|LastSgemmKernel|TensorTile|TensorTypes|TensorMapSlots/.test(fn)) continue;
  set(`cublas${fn}`, { status: 'library', grx: `grxblas${fn}`, group: 'libraries', note: 'grxBLAS equivalent. Rename by hand and check the signature.' });
  set(`cublas${fn}_v2`, { status: 'library', grx: `grxblas${fn}`, group: 'libraries', note: 'grxBLAS equivalent. Rename by hand and check the signature.' });
}

// cuBLAS types and constants with a grxBLAS twin (cublasHandle_t, CUBLAS_OP_N…).
for (const [, t] of blas.matchAll(/\bgrxblas(Handle|Status|Operation)_t\b/g)) {
  set(`cublas${t}_t`, { status: 'library', grx: `grxblas${t}_t`, group: 'libraries' });
}
for (const [, c] of blas.matchAll(/\bGRXBLAS_((?:OP|STATUS)_[A-Z_]+)\b/g)) {
  set(`CUBLAS_${c}`, { status: 'library', grx: `GRXBLAS_${c}`, group: 'libraries' });
}

// 4. Curated: differences and out-of-scope items, from cuda_mapping.md.
const C = (status, group, note, ref, grx) => ({ status, group, note, ref, ...(grx ? { grx } : {}) });
const CURATED = {
  __global__: C('same', 'language'), __device__: C('same', 'language'), __host__: C('same', 'language'),
  __restrict__: C('same', 'language'), __ldg: C('same', 'language'), __launch_bounds__: C('same', 'language'),
  __shared__: C('same', 'language', 'Static and dynamic (extern) shared memory both work; grxcc carves the per-block slot.', '7.10'),
  __constant__: C('differs', 'language', 'Works, but lowers to read-only global memory: there is no broadcast constant cache.', '7.2'),
  '<<<>>>': C('same', 'language', 'Same launch syntax: grid, block, shared bytes, stream.'),
  threadIdx: C('same', 'device'), blockIdx: C('same', 'device'), blockDim: C('same', 'device'), gridDim: C('same', 'device'),
  warpSize: C('same', 'device', 'Read it rather than assuming 32: the warp width is a build option.'),
  printf: C('same', 'device'), assert: C('same', 'device'),
  clock: C('differs', 'device', 'Use grx::clock64().', null, 'grx::clock64'),
  clock64: C('differs', 'device', 'Use grx::clock64().', null, 'grx::clock64'),
  __syncthreads: C('same', 'device', 'Keep it out of divergent branches: the toolchain can duplicate it into a deadlock.', '7.20'),
  __match_any_sync: C('out', 'device', 'No match instruction; out of scope for v1.'),
  __match_all_sync: C('out', 'device', 'No match instruction; out of scope for v1.'),
  wmma: C('differs', 'tensor', 'Use grx::wmma. Fragment shapes come from the build (8×4×8 for fp16 in the development configuration), not 16×16×16.', '7.9', 'grx::wmma'),
  'nvcuda::wmma': C('differs', 'tensor', 'Use grx::wmma. Fragment shapes come from the build (8×4×8 for fp16 in the development configuration), not 16×16×16.', '7.9', 'grx::wmma'),
  cooperative_groups: C('same', 'device', 'The namespace forwards to grx::cg; tiles must be no wider than a warp.'),
  this_grid: C('differs', 'device', 'grid.sync() is cluster-scoped: grid-wide only on a single-cluster device.', '7.17'),
  grid_group: C('differs', 'device', 'grid.sync() is cluster-scoped: grid-wide only on a single-cluster device.', '7.17'),
  labeled_partition: C('out', 'device', 'Out of scope for v1.'), binary_partition: C('out', 'device', 'Out of scope for v1.'),
  tex1Dfetch: C('differs', 'textures', 'Use grx::tex<>: textures are sampled in software from global memory.', '7.8', 'grx::tex'),
  tex1D: C('differs', 'textures', 'Use grx::tex<>: textures are sampled in software from global memory.', '7.8', 'grx::tex'),
  tex2D: C('differs', 'textures', 'Use grx::tex<>: textures are sampled in software from global memory.', '7.8', 'grx::tex'),
  tex3D: C('differs', 'textures', 'Use grx::tex<>: textures are sampled in software from global memory.', '7.8', 'grx::tex'),
  cudaGraph: C('out', 'runtime', 'CUDA graphs are out of scope for v1.', '7.15'),
  cudaIpc: C('out', 'runtime', 'IPC handles are out of scope for v1.', '7.15'),
  cudaMemcpyPeer: C('out', 'memory', 'Peer-to-peer copies are out of scope for v1.', '7.15'),
  cudaMemcpyPeerAsync: C('out', 'memory', 'Peer-to-peer copies are out of scope for v1.', '7.15'),
  cudnn: C('partial', 'libraries', 'grxDNN has a different API covering softmax, layer norm, GELU, bias add and attention forward.', null, 'grxDNN'),
  cufft: C('planned', 'libraries', 'grxFFT is planned; not in GRXCP yet.', null, 'grxFFT'),
  curand: C('planned', 'libraries', 'grxRAND is planned; not in GRXCP yet.', null, 'grxRAND'),
  cusparse: C('planned', 'libraries', 'grxSPARSE is planned; not in GRXCP yet.', null, 'grxSPARSE'),
  thrust: C('planned', 'libraries', 'grx::par (header-only) is planned; not in GRXCP yet.', null, 'grx::par'),
  cub: C('planned', 'libraries', 'grx::par (header-only) is planned; not in GRXCP yet.', null, 'grx::par'),
};
for (const [k, v] of Object.entries(CURATED)) set(k, v);

// Notes on renames whose behavior differs, from the mapping tables.
const NOTE = {
  cudaDeviceEnablePeerAccess: ['differs', 'Renamed, but returns NotSupported: no peer access in v1.'],
  cudaMallocManaged: ['differs', 'Needs a G100 build with virtual memory; not available on FPGA paths.'],
  cudaHostAlloc: ['same', 'Write-combining hints are ignored in v1.', '7.15'],
  cudaMemcpyToSymbol: ['differs', 'Works for __constant__ variables; refuses __device__ ones.', '7.23'],
  cudaMemcpyFromSymbol: ['differs', 'Works for __constant__ variables; refuses __device__ ones.', '7.23'],
  cudaEventElapsedTime: ['same', 'Falls back to the host clock where the driver has no device timestamps.'],
  cudaFuncGetAttributes: ['same', 'numRegs comes from grxcc metadata, not an occupancy input.', '7.21'],
  cudaCreateTextureObject: ['differs', 'Textures are sampled in software from global memory.', '7.8'],
};
for (const [k, [kind, note, ref]] of Object.entries(NOTE)) {
  if (!entries[k]) continue;
  entries[k].note = note; if (ref) entries[k].ref = ref;
  if (kind === 'differs') entries[k].status = 'differs';
}

const out = {
  source: { repo: 'kubeworkz/grxcp', commit, date },
  docs: `https://github.com/kubeworkz/grxcp/blob/${commit}/docs/designs/cuda_mapping.md`,
  header: `https://github.com/kubeworkz/grxcp/blob/${commit}/include/grx/grx_cuda_compat.h`,
  entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
};
const dest = join(dirname(fileURLToPath(import.meta.url)), '../src/data/cuda-map.json');
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
const counts = {};
for (const e of Object.values(entries)) counts[e.status] = (counts[e.status] || 0) + 1;
console.log(`wrote ${Object.keys(entries).length} entries from grxcp@${commit} (${date}):`, counts);
