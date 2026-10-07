import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const BRANCH = 'codex/rudy-contribution-art';
export const START = '2026-01-04';
export const GLYPHS = {
  left: ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  slash: ['..#', '..#', '.#.', '.#.', '.#.', '#..', '#..'],
  right: ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
};

export function dateAt(start, week, row) {
  const day = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(+day) || day.getUTCDay() !== 0) throw new Error('Start must be a Sunday');
  day.setUTCDate(day.getUTCDate() + week * 7 + row);
  return day.toISOString().slice(0, 10);
}

export function makePlan(now = new Date()) {
  const layout = [['left', 0, 40], ['R', 6, 40], ['U', 12, 40], ['D', 18, 40], ['Y', 24, 40], ['slash', 31, 40], ['right', 35, 40]];
  const days = [];
  for (const [name, offset, count] of layout) {
    const glyph = GLYPHS[name];
    if (glyph.length !== 7 || glyph.some(row => row.length !== glyph[0].length)) throw new Error('Invalid glyph');
    for (let y = 0; y < 7; y++) for (let x = 0; x < glyph[y].length; x++) {
      if (glyph[y][x] !== '#') continue;
      const date = dateAt(START, offset + x, y);
      if (new Date(`${date}T12:00:00Z`) > now) throw new Error(`Future pixel: ${date}`);
      days.push({ date, count, glyph: name, x: offset + x, y });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(days.map(d => d.date)).size !== days.length) throw new Error('Overlapping pixels');
  return { version: 1, id: 'rudy-code-2026', start: START, width: 39, branch: BRANCH,
    disclosure: 'Intentional contribution pixel art, generated 2026-10-07; dates do not represent software work.',
    totalCommits: days.reduce((n, d) => n + d.count, 0), days };
}

function git(args, input) {
  const result = spawnSync('git', args, { input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}

function assertRepo() {
  if (git(['remote', 'get-url', 'origin']) !== 'https://github.com/Radishoux/business.git') throw new Error('Unexpected repository');
  if (git(['branch', '--show-current']) !== BRANCH) throw new Error(`Checkout ${BRANCH} first`);
  if (git(['status', '--porcelain'])) throw new Error('Commit or stash working changes first');
}

export function renderSvg(plan, { full = false, background = {}, light = false } = {}) {
  const colors = light ? ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] : ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const start = full ? '2025-10-05' : START;
  const width = full ? 53 : plan.width;
  const counts = new Map(plan.days.map(d => [d.date, d.count]));
  let cells = '';
  for (let x = 0; x < width; x++) for (let y = 0; y < 7; y++) {
    const date = dateAt(start, x, y);
    if (date > '2026-10-07') continue;
    const count = counts.get(date) || 0;
    const real = background[date] || 0;
    const level = count === 40 ? 4 : count === 24 ? 3 : real ? 1 : 0;
    cells += `<rect x="${18 + x * 18}" y="${18 + y * 18}" width="14" height="14" rx="2" fill="${colors[level]}"><title>${date}: ${count} art commits + ${real} existing contributions</title></rect>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width * 18 + 32} 158" role="img" aria-label="RUDY inside code brackets with a closing slash"><rect width="100%" height="100%" rx="12" fill="${light ? '#ffffff' : '#0d1117'}"/>${cells}</svg>`;
}

function preview(plan) {
  mkdirSync('art', { recursive: true });
  writeFileSync('art/plan.json', JSON.stringify(plan, null, 2) + '\n');
  writeFileSync('art/rudy-code.svg', renderSvg(plan));
  let background = {};
  if (existsSync('.git/calendar-before.json')) {
    const weeks = JSON.parse(readFileSync('.git/calendar-before.json', 'utf8')).data.user.contributionsCollection.contributionCalendar.weeks;
    background = Object.fromEntries(weeks.flatMap(w => w.contributionDays).map(d => [d.date, d.contributionCount]));
    // The previous calendar indexed only the last 1,000 generated commits.
    for (const date of git(['log', 'master', '-1000', '--format=%ad', '--date=format:%Y-%m-%d']).split('\n')) {
      background[date] = Math.max(0, (background[date] || 0) - 1);
    }
  }
  const dark = renderSvg(plan, { full: true, background });
  const light = renderSvg(plan, { full: true, background, light: true });
  writeFileSync('art/preview.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rudy — code contribution art</title><style>body{margin:0;background:#0d1117;color:#f0f6fc;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:7vh auto;padding:28px}small{color:#39d353;letter-spacing:.16em}h1{font-size:clamp(36px,6vw,68px);line-height:1.1;margin:18px 0}p{color:#8b949e;max-width:750px}svg{width:100%;display:block;margin:24px 0}button{background:#21262d;color:#f0f6fc;border:1px solid #30363d;border-radius:8px;padding:10px 16px;cursor:pointer}.light{display:none}body.show-light .dark{display:none}body.show-light .light{display:block}.meta{display:flex;gap:28px;flex-wrap:wrap;border-top:1px solid #30363d;padding-top:20px}.meta strong{color:#f0f6fc}footer{color:#8b949e;margin-top:32px;font-size:13px}</style><main><small>RADISHOUX / CONTRIBUTION PIXEL ART</small><h1>&lt;RUDY/&gt;</h1><p>Your original code signature, rebuilt in crisp green pixels. Each square is one day.</p><button onclick="document.body.classList.toggle('show-light')">Toggle calendar theme</button><div class="dark">${dark}</div><div class="light">${light}</div><div class="meta"><span><strong>RUDY</strong> / your code signature</span><span><strong>39 weeks</strong> / one continuous design</span><span><strong>Original history</strong> / preserved on master</span></div><p>${plan.days.length} painted days · ${plan.totalCommits.toLocaleString('en-US')} art commits · 4 January–3 October 2026.</p><footer>Preview of the rolling year on 7 October 2026. Small background marks are existing contributions. GitHub chooses its own color thresholds and may need up to 24 hours to refresh. This is openly labeled decorative art; the commit dates do not represent development activity. Original history remains on master.</footer></main></html>`);
  console.log(`${plan.days.length} pixels, ${plan.totalCommits} commits. Preview: art/preview.html`);
}

function generate(plan) {
  assertRepo();
  if (git(['log', '--all', '--format=%s', '--grep=^pixel-art: rudy-code-2026']).length) throw new Error('This artwork already exists; refusing duplicate generation');
  const base = git(['rev-parse', 'HEAD']);
  const name = git(['config', 'user.name']);
  const email = git(['config', 'user.email']);
  if (/[\r\n<>]/.test(name) || /[\r\n<>]/.test(email) || !email.includes('@')) throw new Error('Invalid commit identity');
  let stream = '';
  for (const day of plan.days) for (let i = 1; i <= day.count; i++) {
    const timestamp = Math.floor(new Date(`${day.date}T12:00:00Z`).getTime() / 1000) + i;
    const message = `pixel-art: ${plan.id} ${day.date} ${i}/${day.count}\n\nDecorative pixel art, generated 2026-10-07; not historical development activity.\n`;
    stream += `commit refs/heads/${BRANCH}\nauthor ${name} <${email}> ${timestamp} +0000\ncommitter ${name} <${email}> ${timestamp} +0000\ndata ${Buffer.byteLength(message)}\n${message}${stream ? '' : `from ${base}\n`}\n`;
  }
  git(['fast-import', '--quiet'], stream + 'done\n');
  const tip = git(['rev-parse', 'HEAD']);
  writeFileSync('.git/art-run.json', JSON.stringify({ base, tip, branch: BRANCH, totalCommits: plan.totalCommits }, null, 2));
  verify(plan, base);
  console.log(`Generated ${plan.totalCommits} art commits. Original master unchanged.`);
}

function verify(plan, base) {
  const lines = git(['log', '--format=%aI|%cI|%s', `${base}..HEAD`]).split('\n');
  if (lines.length !== plan.totalCommits) throw new Error(`Unexpected total: ${lines.length}`);
  const actual = new Map();
  for (const line of lines) {
    const [author, committer, message] = line.split('|');
    if (author !== committer || !message.startsWith(`pixel-art: ${plan.id} `)) throw new Error('Unexpected commit');
    const date = author.slice(0, 10);
    actual.set(date, (actual.get(date) || 0) + 1);
  }
  if (actual.size !== plan.days.length || plan.days.some(d => actual.get(d.date) !== d.count)) throw new Error('Dates do not match the pixel plan');
  if (git(['rev-parse', `${base}^{tree}`]) !== git(['rev-parse', 'HEAD^{tree}'])) throw new Error('Art commits changed repository files');
  console.log('Verified every pixel count, author/committer date, total, and unchanged file tree.');
}

function publish(plan) {
  assertRepo();
  const run = JSON.parse(readFileSync('.git/art-run.json', 'utf8'));
  if (git(['rev-parse', 'HEAD']) !== run.tip) throw new Error('HEAD changed after generation');
  verify(plan, run.base);
  git(['fetch', 'origin', BRANCH]);
  const remote = git(['rev-parse', `origin/${BRANCH}`]);
  git(['merge-base', '--is-ancestor', remote, run.tip]);
  const pending = git(['rev-list', '--reverse', `${remote}..${run.tip}`]).split('\n').filter(Boolean);
  for (let i = 0; i < pending.length; i += 500) {
    const last = Math.min(i + 500, pending.length) - 1;
    git(['push', 'origin', `${pending[last]}:refs/heads/${BRANCH}`]);
    console.log(`Published ${last + 1}/${pending.length} pending art commits`);
  }
  console.log('Publication complete; no force pushes or deleted branches.');
}

if (import.meta.main) {
  const plan = makePlan();
  const action = process.argv[2] || 'preview';
  if (action === 'preview') preview(plan);
  else if (action === 'generate') generate(plan);
  else if (action === 'verify') verify(plan, JSON.parse(readFileSync('.git/art-run.json', 'utf8')).base);
  else if (action === 'publish') publish(plan);
  else throw new Error('Usage: bun index.js [preview|generate|verify|publish]');
}
