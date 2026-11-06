// A small model of the GRX930 NPU for the playground, from kubeworkz/grx930:
//   limits      c930/rtl/c930_soc_top.sv (MAX_M/MAX_N/MAX_K as the SoC builds it)
//   registers   c930/sw/c930_npu_driver.h, c930/rtl/c930_npu_csr.sv
//   layout      c930/doc/c930_architecture.md §6 (row-major, packed per word)
//   dataflow    c930/rtl/c930_systolic_array.sv, c930_npu_core.sv
// It models behavior and data, not timing: the RTL's half-rate hops, weight
// settle and registered feed are not reproduced, so no cycle counts here.

export const NPU = {
  ROWS: 8, COLS: 8,            // systolic array (NUM_ROWS x NUM_COLS)
  MAX_M: 8, MAX_N: 12, MAX_K: 16,
  QUEUE_DEPTH: 4,
  BASE: [0x40000000, 0x40000040], // NPU0, NPU1
  DDR_LO: 0x00001000, DDR_HI: 0x0000ffff, // 60 KB DDR stub
};

export type Prec = 0 | 1 | 2 | 3 | 4;
export const PREC: Record<Prec, { name: string; bits: number; perWord: number; int: boolean; min: number; max: number }> = {
  0: { name: 'INT8', bits: 8, perWord: 4, int: true, min: -128, max: 127 },
  1: { name: 'INT16', bits: 16, perWord: 2, int: true, min: -32768, max: 32767 },
  2: { name: 'FP16', bits: 16, perWord: 2, int: false, min: -8, max: 8 },
  3: { name: 'BF16', bits: 16, perWord: 2, int: false, min: -8, max: 8 },
  4: { name: 'INT4', bits: 4, perWord: 8, int: true, min: -8, max: 7 },
};

export const REGS = [
  { off: 0x00, name: 'CTRL', acc: 'W', desc: 'bit 0 START: snapshot the registers into the queue; clears DONE and ERROR' },
  { off: 0x04, name: 'STATUS', acc: 'R', desc: 'bit 0 BUSY, bit 1 DONE (latched), bit 2 ERROR' },
  { off: 0x08, name: 'DIM_M', acc: 'RW', desc: `Output rows, 1–${8}` },
  { off: 0x0c, name: 'DIM_N', acc: 'RW', desc: `Output columns, 1–${12}` },
  { off: 0x10, name: 'DIM_K', acc: 'RW', desc: `Reduction length, 1–${16}` },
  { off: 0x14, name: 'A_BASE', acc: 'RW', desc: 'A matrix address in DDR, word-aligned' },
  { off: 0x18, name: 'B_BASE', acc: 'RW', desc: 'B matrix address in DDR, word-aligned' },
  { off: 0x1c, name: 'C_BASE', acc: 'RW', desc: 'C result address in DDR, word-aligned' },
  { off: 0x20, name: 'PREC', acc: 'RW', desc: 'bits [2:0]: 0 INT8, 1 INT16, 2 FP16, 3 BF16, 4 INT4' },
  { off: 0x24, name: 'CYCLE_LO', acc: 'R', desc: 'Core cycles for the last command (state != IDLE)', counter: true },
  { off: 0x28, name: 'DMA_LAST', acc: 'R', desc: 'DMA busy cycles, latched from the last completed GEMM', counter: true },
  { off: 0x2c, name: 'OP_COUNT', acc: 'R', desc: 'PE firings: NUM_ROWS × NUM_COLS per S_RUN cycle', counter: true },
  { off: 0x30, name: 'STALL_CT', acc: 'R', desc: 'Cycles moving weights (S_WLOAD) and reloading accumulators', counter: true },
  { off: 0x34, name: 'DMA_CT', acc: 'R', desc: 'DMA busy cycles, live', counter: true },
  { off: 0x38, name: 'QUEUE_STAT', acc: 'R', desc: 'Documented as bits [3:0] occupancy, bit 4 full. The RTL returns {full, count}: at depth 4, count in [2:0] and full at bit 3' },
  { off: 0x3c, name: 'QUEUE_MAX', acc: 'R', desc: 'Queue depth: 4' },
] as { off: number; name: string; acc: string; desc: string; counter?: boolean }[];

export const dimsOk = (m: number, n: number, k: number) =>
  m >= 1 && m <= NPU.MAX_M && n >= 1 && n <= NPU.MAX_N && k >= 1 && k <= NPU.MAX_K;

/** Bytes a packed operand occupies, rounded up to whole 32-bit words. */
export const operandBytes = (elems: number, p: Prec) => Math.ceil(elems / PREC[p].perWord) * 4;

/** Seeded PRNG (mulberry32) so a shared link reproduces the same matrices. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random operand values in a precision's range (small floats for FP modes). */
export function randomMatrix(rows: number, cols: number, p: Prec, rand: () => number): number[][] {
  const { int, min, max } = PREC[p];
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => {
    if (int) return Math.floor(rand() * (max - min + 1)) + min;
    return Math.round((rand() * 4 - 2) * 4) / 4; // quarters: exactly representable in FP16 and BF16
  }));
}

/** Reference GEMM. Integers: exact, then the low 32 bits (C holds acc[31:0]).
 *  Floats: products and sums in FP32 in K order; the RTL's own rounding is
 *  not modeled, so treat these as approximate. */
export function gemm(A: number[][], B: number[][], p: Prec): number[][] {
  const M = A.length, K = B.length, N = B[0]?.length ?? 0;
  const C: number[][] = [];
  for (let m = 0; m < M; m++) {
    C.push([]);
    for (let n = 0; n < N; n++) {
      if (PREC[p].int) {
        let s = 0n;
        for (let k = 0; k < K; k++) s += BigInt(A[m][k]) * BigInt(B[k][n]);
        C[m].push(Number(BigInt.asIntN(32, s)));
      } else {
        let s = 0;
        for (let k = 0; k < K; k++) s = Math.fround(s + Math.fround(A[m][k] * B[k][n]));
        C[m].push(s);
      }
    }
  }
  return C;
}

// ---- Packing (little-endian, row-major, elements packed per 32-bit word) ----
function f32Bits(x: number) { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, x, true); return b.getUint32(0, true); }
function f16Bits(x: number) {
  // Round-to-nearest-even FP16 encoding of the (already representable) value.
  const f = f32Bits(x), sign = (f >>> 16) & 0x8000, exp = ((f >>> 23) & 0xff) - 127 + 15, mant = f & 0x7fffff;
  if (x === 0) return sign;
  if (exp <= 0) return sign | ((mant | 0x800000) >>> (14 - exp));
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | (mant >>> 13);
}
const bf16Bits = (x: number) => f32Bits(x) >>> 16;

export function elemBits(x: number, p: Prec): number {
  const { bits } = PREC[p];
  if (p === 2) return f16Bits(x);
  if (p === 3) return bf16Bits(x);
  return x & ((1 << bits) - 1);
}

/** Pack a row-major operand into 32-bit words. */
export function pack(mat: number[][], p: Prec): number[] {
  const flat = mat.flat(), { bits, perWord } = PREC[p], words: number[] = [];
  for (let i = 0; i < flat.length; i += perWord) {
    let w = 0;
    for (let j = 0; j < perWord && i + j < flat.length; j++) w |= elemBits(flat[i + j], p) << (j * bits);
    words.push(w >>> 0);
  }
  return words;
}

/** C words: INT32, or FP32 bit patterns in the float modes. */
export const packC = (C: number[][], p: Prec) => C.flat().map((v) => (PREC[p].int ? v >>> 0 : f32Bits(v)));

export const hex = (v: number, w = 8) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(w, '0');
export const hex4 = (v: number) => '0x' + (v >>> 16).toString(16).toUpperCase().padStart(4, '0') + '_' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');

/** Tile schedule, in the core's loop order: N tiles, then K tiles, then rows. */
export function schedule(M: number, N: number, K: number) {
  const nt = Math.ceil(N / NPU.COLS), kt = Math.ceil(K / NPU.ROWS);
  const passes: { ni: number; ki: number; m: number; n0: number; nc: number; k0: number; kr: number }[] = [];
  for (let ni = 0; ni < nt; ni++) for (let ki = 0; ki < kt; ki++) for (let m = 0; m < M; m++) {
    const n0 = ni * NPU.COLS, k0 = ki * NPU.ROWS;
    passes.push({ ni, ki, m, n0, nc: Math.min(NPU.COLS, N - n0), k0, kr: Math.min(NPU.ROWS, K - k0) });
  }
  return { nt, kt, passes, weightTiles: nt * kt, useful: M * N * K, slots: passes.length * NPU.ROWS * NPU.COLS };
}
