// Small GitHub API helper for build-time data. Uses GITHUB_TOKEN when set
// (Netlify environment variable) to avoid the anonymous rate limit.
export async function gh(path: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${path}`, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path.split('?')[0]}`);
  return res;
}

// Total items in a paginated list, read from the Link header of a per_page=1 request.
export async function ghCount(path: string): Promise<number> {
  const res = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=1`);
  const last = res.headers.get('link')?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (last) return Number(last[1]);
  return ((await res.json()) as unknown[]).length;
}

// Every item of a paginated list (up to maxPages × 100).
export async function ghAll<T>(path: string, maxPages = 10): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const items = (await res.json()) as T[];
    out.push(...items);
    if (!res.headers.get('link')?.includes('rel="next"')) break;
  }
  return out;
}
