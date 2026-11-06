// Loads the latest published G100 kernel gallery at build time. It is written
// by kubeworkz/grxgpu's .github/workflows/kernel-gallery.yml to the
// `kernel-gallery` branch: results.json, one log per kernel and the kernel
// sources under src/. KERNEL_GALLERY_URL overrides the base (for testing).
export interface GalleryKernel {
  slug: string; case: string; title: string; about: string; app: string;
  args: string; configs: string; shape: Record<string, number | boolean>; command: string;
  status: 'pass' | 'fail'; exit: number | string; seconds: number;
  instrs: number | null; cycles: number | null; ipc: number | null;
  cores: { core: number; instrs: number; cycles: number; ipc: number }[];
  check: string; tolerance: number | null; known_issue: string;
  log: string; sources: { file: string; path: string; repo_path: string }[];
}
export interface Gallery {
  repo: string; commit: string; run_url: string; generated_at: string;
  driver: string; xlen: number; default_shape: Record<string, number>; kernels: GalleryKernel[];
}
export const GALLERY_BASE = process.env.KERNEL_GALLERY_URL || 'https://raw.githubusercontent.com/kubeworkz/grxgpu/kernel-gallery';
export const GALLERY_BRANCH = 'https://github.com/kubeworkz/grxgpu/tree/kernel-gallery';

const get = async (path: string) => {
  const r = await fetch(`${GALLERY_BASE}/${path}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
};

export async function loadGallery(): Promise<{ gallery: Gallery | null; sources: Record<string, string>; tails: Record<string, string[]>; reason?: string }> {
  try {
    const gallery = JSON.parse(await get('results.json')) as Gallery;
    const sources: Record<string, string> = {};
    const tails: Record<string, string[]> = {};
    await Promise.all(gallery.kernels.flatMap((k) => [
      ...k.sources.map(async (s) => { try { sources[s.path] = await get(s.path); } catch { /* shown as missing */ } }),
      (async () => { try { tails[k.slug] = (await get(k.log)).trimEnd().split('\n').slice(-30); } catch { /* optional */ } })(),
    ]));
    return { gallery, sources, tails };
  } catch (e) {
    return { gallery: null, sources: {}, tails: {}, reason: (e as Error).message };
  }
}

/** The device a kernel ran on, from its shape and its -DVX_CFG_* configs. */
export function device(k: GalleryKernel) {
  const cfg = (name: string) => { const m = k.configs.match(new RegExp(`-DVX_CFG_${name}=(\\d+)`)); return m ? Number(m[1]) : undefined; };
  const sh = (name: string) => (typeof k.shape[name] === 'number' ? (k.shape[name] as number) : undefined);
  return {
    clusters: sh('clusters') ?? cfg('NUM_CLUSTERS'), cores: sh('cores') ?? cfg('NUM_CORES'),
    warps: sh('warps') ?? cfg('NUM_WARPS'), threads: sh('threads') ?? cfg('NUM_THREADS'),
    issue: cfg('ISSUE_WIDTH'), l2: !!k.shape.l2cache,
    tcu: /EXT_TCU_ENABLE/.test(k.configs), dxa: /EXT_DXA_ENABLE/.test(k.configs),
    itype: k.configs.match(/-DITYPE=(\w+)/)?.[1], otype: k.configs.match(/-DOTYPE=(\w+)/)?.[1],
  };
}
