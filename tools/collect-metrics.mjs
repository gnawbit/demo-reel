// Maintainer-only aggregate collection; not part of the installed CLI.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  out: { type: 'string' }, traffic: { type: 'boolean', default: false },
}, strict: true, allowPositionals: false });
if (!values.out) throw new Error('Pass --out with a new snapshot filename');
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'tabretake-metrics' };
if (values.traffic) {
  let token = process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      const credential = execFileSync('git', ['-c', 'credential.interactive=never', 'credential', 'fill'], {
        input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
        timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      });
      token = credential.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
    } catch { /* Missing credentials are reported without logging credential output. */ }
  }
  if (!token) throw new Error('Traffic requires GITHUB_TOKEN or an existing GitHub credential');
  headers.Authorization = `Bearer ${token}`;
}
const base = 'https://api.github.com/repos/gnawbit/tabretake';
async function get(suffix) {
  const source = base + suffix;
  try {
    const response = await fetch(source, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { source, status: response.status, data: null };
    return { source, status: 200, data: await response.json() };
  } catch { return { source, status: 'unavailable', data: null }; }
}
const [repo, views, clones, referrers] = await Promise.all([
  get(''), ...['/traffic/views', '/traffic/clones', '/traffic/popular/referrers']
    .map(suffix => values.traffic ? get(suffix) : { source: base + suffix, status: 'not-requested', data: null }),
]);
if (!repo.data) throw new Error(`Repository metrics unavailable (${repo.status}); no snapshot written`);
const now = new Date();
const snapshot = {
  schemaVersion: 1, capturedAt: now.toISOString(),
  date: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }),
  repository: 'gnawbit/tabretake',
  github: { source: repo.source, stars: repo.data.stargazers_count, forks: repo.data.forks_count },
  traffic: { window: 'GitHub rolling 14 days, UTC; may lag capture time', views, clones, referrers },
  externalUsage: {
    firstSuccessfulUsers: null, repeatUsers: null, adoptedProjects: null,
    evidence: [], status: 'Not measured; fill only from reviewed external reports',
  },
  limitations: [
    'Repository traffic is not project-page traffic or a user count',
    'Clones may include maintainer, installation and CI activity',
    'Do not sum unique counts or overlapping 14-day snapshots',
    'No CLI telemetry; unknown usage is null, not zero',
  ],
};
await mkdir(path.dirname(values.out), { recursive: true });
await writeFile(values.out, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ stars: snapshot.github.stars, forks: snapshot.github.forks,
  trafficStatus: [views.status, clones.status, referrers.status] }));
