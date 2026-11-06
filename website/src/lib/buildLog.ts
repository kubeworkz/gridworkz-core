// Loads "what shipped" for the build log page, at build time.
// 1. GitHub API: merged pull requests with their summaries. Set GITHUB_TOKEN
//    in the build environment to avoid GitHub's anonymous rate limit.
// 2. Fallback: merge commits from the local git history (titles only).
import { execSync } from 'node:child_process';
import { site } from '../site';
import { gh } from './github';

export interface Shipped {
  number: number;
  title: string;
  mergedAt: Date;
  url: string;
  summary?: string;
}
export interface BuildLog { items: Shipped[]; source: 'github' | 'git' | 'none'; }

// First paragraph of a PR's "## Summary" section, as plain text.
function summarize(body: string | null): string | undefined {
  if (!body) return undefined;
  const m = body.match(/##\s*Summary\s*\n+([\s\S]*?)(\n\s*\n|\n##|$)/);
  if (!m) return undefined;
  let text = m[1]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > 240) text = text.slice(0, 237).replace(/\s+\S*$/, '') + '…';
  return text || undefined;
}

async function fromGitHub(): Promise<Shipped[]> {
  const res = await gh(`repos/${site.repoSlug}/pulls?state=closed&base=main&per_page=100&sort=updated&direction=desc`);
  const pulls = (await res.json()) as any[];
  return pulls
    .filter((p) => p.merged_at)
    .map((p) => ({
      number: p.number,
      title: p.title,
      mergedAt: new Date(p.merged_at),
      url: p.html_url,
      summary: summarize(p.body),
    }));
}

function fromGit(): Shipped[] {
  const out = execSync("git log --merges --first-parent --format='%cI%x1f%s%x1f%b%x1e'", { encoding: 'utf8' });
  return out.split('\x1e').map((r) => r.trim()).filter(Boolean).flatMap((r) => {
    const [date, subject, body] = r.split('\x1f');
    const m = subject.match(/^Merge pull request #(\d+)/);
    if (!m) return [];
    const n = Number(m[1]);
    return [{
      number: n,
      title: (body || '').trim().split('\n')[0] || subject,
      mergedAt: new Date(date),
      url: `${site.repo}/pull/${n}`,
    }];
  });
}

export async function getBuildLog(): Promise<BuildLog> {
  try {
    const items = await fromGitHub();
    if (items.length) return { items: sortDesc(items), source: 'github' };
  } catch (e) {
    console.warn(`[build-log] GitHub API unavailable (${(e as Error).message}); using git history.`);
  }
  try {
    const items = fromGit();
    if (items.length) return { items: sortDesc(items), source: 'git' };
  } catch (e) {
    console.warn(`[build-log] git history unavailable (${(e as Error).message}).`);
  }
  return { items: [], source: 'none' };
}

function sortDesc(items: Shipped[]) {
  return items.sort((a, b) => b.mergedAt.getTime() - a.mergedAt.getTime());
}

// Monday of the week (UTC) a date falls in.
export function weekStart(d: Date): Date {
  const w = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
  return w;
}
