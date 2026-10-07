import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const BRANCH = 'codex/rudy-contribution-art';
export const ART_ID = 'rudy-code-2026';
export const START = '2026-01-04'; // Sunday; rows are Sunday through Saturday.
export const BACKGROUND_START = '2025-10-08';
export const BACKGROUND_END = '2026-10-06'; // Completed days only; no future commits.
export const BACKGROUND_COMMITS = 1;
export const PIXEL_COMMITS = 50; // Total per painted day, including its background.
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
  const layout = [['left', 0], ['R', 6], ['U', 12], ['D', 18], ['Y', 24], ['slash', 31], ['right', 35]];
  const byDate = new Map();
  for (let day = new Date(`${BACKGROUND_START}T12:00:00Z`); day <= new Date(`${BACKGROUND_END}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    byDate.set(day.toISOString().slice(0, 10), { date: day.toISOString().slice(0, 10), count: BACKGROUND_COMMITS, glyph: 'background' });
  }
  const paintedDates = new Set();
  for (const [name, offset] of layout) {
    const glyph = GLYPHS[name];
    if (glyph.length !== 7 || glyph.some(row => row.length !== glyph[0].length)) throw new Error('Invalid glyph');
    for (let y = 0; y < 7; y++) for (let x = 0; x < glyph[y].length; x++) {
      if (glyph[y][x] !== '#') continue;
      const date = dateAt(START, offset + x, y);
      if (!byDate.has(date)) throw new Error(`Pixel outside background range: ${date}`);
      if (paintedDates.has(date)) throw new Error('Overlapping pixels');
      paintedDates.add(date);
      byDate.set(date, { date, count: PIXEL_COMMITS, glyph: name, x: offset + x, y });
    }
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!days.length || days.some(d => new Date(`${d.date}T12:01:00Z`) > now)) throw new Error('Future date in plan');
  return { version: 2, id: ART_ID, start: START, width: 39, branch: BRANCH,
    backgroundStart: BACKGROUND_START, backgroundEnd: BACKGROUND_END,
    backgroundCommits: BACKGROUND_COMMITS, pixelCommits: PIXEL_COMMITS, paintedDays: paintedDates.size,
    disclosure: 'Intentional contribution pixel art; backdated commits do not represent historical development activity.',
    totalCommits: days.reduce((n, d) => n + d.count, 0), days };
}

export function missingPlan(plan, existing) {
  const targets = new Map(plan.days.map(d => [d.date, d.count]));
  for (const [date, count] of existing) {
    if (!Number.isInteger(count) || count < 0 || count > (targets.get(date) ?? 0)) {
      throw new Error(`Existing art exceeds the target on ${date}; refusing to rewrite history`);
    }
  }
  return plan.days.map(d => ({ ...d, existing: existing.get(d.date) || 0, missing: d.count - (existing.get(d.date) || 0) })).filter(d => d.missing > 0);
}

function git(args, input) {
  const result = spawnSync('git', args, { input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}

function assertRepo({ clean = true } = {}) {
  if (git(['remote', 'get-url', 'origin']) !== 'https://github.com/Radishoux/business.git') throw new Error('Unexpected repository');
  if (git(['branch', '--show-current']) !== BRANCH) throw new Error(`Checkout ${BRANCH} first`);
  if (clean && git(['status', '--porcelain'])) throw new Error('Commit your script changes first; see README.md');
}

function existingCounts() {
  const lines = git(['log', '--format=%aI|%cI|%s', `--grep=^pixel-art: ${ART_ID} `]).split('\n').filter(Boolean);
  const counts = new Map();
  for (const line of lines) {
    const [author, committer, message] = line.split('|');
    const date = author.slice(0, 10);
    if (author !== committer || !message.startsWith(`pixel-art: ${ART_ID} ${date} `)) throw new Error('Invalid existing artwork timestamps');
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  return counts;
}

function report(plan) {
  const existing = existingCounts();
  const missing = missingPlan(plan, existing);
  const additional = missing.reduce((n, d) => n + d.missing, 0);
  console.log(`${plan.paintedDays} painted days at ${PIXEL_COMMITS} commits; ${plan.days.length - plan.paintedDays} background days at ${BACKGROUND_COMMITS} commit.`);
  console.log(`Target: ${plan.totalCommits} art commits. Already present: ${plan.totalCommits - additional}. Still to generate: ${additional}.`);
  return missing;
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
    const level = count === PIXEL_COMMITS ? 4 : count || real ? 1 : 0;
    cells += `<rect x="${18 + x * 18}" y="${18 + y * 18}" width="14" height="14" rx="2" fill="${colors[level]}"><title>${date}: ${count} art commits + ${real} other contributions</title></rect>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width * 18 + 32} 158" role="img" aria-label="RUDY inside code brackets with a closing slash on a light contribution background"><rect width="100%" height="100%" rx="12" fill="${light ? '#ffffff' : '#0d1117'}"/>${cells}</svg>`;
}

function preview(plan) {
  mkdirSync('art', { recursive: true });
  writeFileSync('art/plan.json', JSON.stringify(plan, null, 2) + '\n');
  writeFileSync('art/rudy-code.svg', renderSvg(plan));
  let background = {};
  if (existsSync('.git/calendar-before.json')) {
    const weeks = JSON.parse(readFileSync('.git/calendar-before.json', 'utf8')).data.user.contributionsCollection.contributionCalendar.weeks;
    background = Object.fromEntries(weeks.flatMap(w => w.contributionDays).map(d => [d.date, d.contributionCount]));
    // The old master calendar indexed only its final 1,000 generated commits.
    for (const date of git(['log', 'master', '-1000', '--format=%ad', '--date=format:%Y-%m-%d']).split('\n')) background[date] = Math.max(0, (background[date] || 0) - 1);
  }
  const dark = renderSvg(plan, { full: true, background });
  const light = renderSvg(plan, { full: true, background, light: true });
  writeFileSync('art/preview.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rudy — code contribution art</title><style>body{margin:0;background:#0d1117;color:#f0f6fc;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:7vh auto;padding:28px}small{color:#39d353;letter-spacing:.16em}h1{font-size:clamp(36px,6vw,68px);line-height:1.1;margin:18px 0}p{color:#8b949e;max-width:750px}svg{width:100%;display:block;margin:24px 0}button{background:#21262d;color:#f0f6fc;border:1px solid #30363d;border-radius:8px;padding:10px 16px;cursor:pointer}.light{display:none}body.show-light .dark{display:none}body.show-light .light{display:block}.meta{display:flex;gap:28px;flex-wrap:wrap;border-top:1px solid #30363d;padding-top:20px}.meta strong{color:#f0f6fc}footer{color:#8b949e;margin-top:32px;font-size:13px}</style><main><small>RADISHOUX / CONTRIBUTION PIXEL ART</small><h1>&lt;RUDY/&gt;</h1><p>Your code signature in bold pixels, over a quiet green canvas.</p><button onclick="document.body.classList.toggle('show-light')">Toggle calendar theme</button><div class="dark">${dark}</div><div class="light">${light}</div><div class="meta"><span><strong>1 commit</strong> / background day</span><span><strong>50 commits</strong> / painted day, total</span><span><strong>39 weeks</strong> / your code signature</span></div><p>${plan.paintedDays} painted days · ${plan.days.length - plan.paintedDays} background days · ${plan.totalCommits.toLocaleString('en-US')} target art commits.</p><footer>Preview for 7 October 2026. Background: 8 October 2025–6 October 2026. Lettering: January–October 2026. Your other contributions may darken individual cells; GitHub chooses the exact color thresholds. These are decorative, backdated art commits. Previewing does not generate or publish commits.</footer></main></html>`);
  report(plan);
  console.log('Preview saved to art/preview.html. No commits created or pushed.');
}

function generate(plan) {
  assertRepo();
  const missing = report(plan);
  if (!missing.length) { console.log('Artwork is already complete; nothing generated.'); return; }
  const base = git(['rev-parse', 'HEAD']);
  const name = git(['config', 'user.name']);
  const email = git(['config', 'user.email']);
  if (/[\r\n<>]/.test(name) || /[\r\n<>]/.test(email) || !email.includes('@')) throw new Error('Invalid commit identity');
  const generatedOn = new Date().toISOString().slice(0, 10);
  let stream = '';
  for (const day of missing) for (let i = day.existing + 1; i <= day.count; i++) {
    const timestamp = Math.floor(new Date(`${day.date}T12:00:00Z`).getTime() / 1000) + i;
    const message = `pixel-art: ${plan.id} ${day.date} ${i}/${day.count}\n\nDecorative pixel art, generated ${generatedOn}; not historical development activity.\n`;
    stream += `commit refs/heads/${BRANCH}\nauthor ${name} <${email}> ${timestamp} +0000\ncommitter ${name} <${email}> ${timestamp} +0000\ndata ${Buffer.byteLength(message)}\n${message}${stream ? '' : `from ${base}\n`}\n`;
  }
  git(['fast-import', '--quiet'], stream + 'done\n');
  const tip = git(['rev-parse', 'HEAD']);
  const added = missing.reduce((n, d) => n + d.missing, 0);
  writeFileSync('.git/art-run.json', JSON.stringify({ base, tip, branch: BRANCH, added, target: plan.totalCommits }, null, 2));
  verify(plan);
  console.log(`Generated ${added} missing commits locally. Run bun run publish when ready.`);
}

function verify(plan) {
  const missing = missingPlan(plan, existingCounts());
  if (missing.length) throw new Error(`${missing.reduce((n, d) => n + d.missing, 0)} commits still need to be generated`);
  if (existsSync('.git/art-run.json')) {
    const run = JSON.parse(readFileSync('.git/art-run.json', 'utf8'));
    if (git(['rev-parse', 'HEAD']) !== run.tip) throw new Error('HEAD changed since generation; inspect before publishing');
    if (Number(git(['rev-list', '--count', `${run.base}..${run.tip}`])) !== run.added) throw new Error('Generated range count mismatch');
    if (git(['rev-parse', `${run.base}^{tree}`]) !== git(['rev-parse', `${run.tip}^{tree}`])) throw new Error('Art commits changed files');
  }
  console.log('Verified exact daily targets, author/committer dates, generated count, and file tree.');
}

function publish(plan) {
  assertRepo();
  verify(plan);
  const run = JSON.parse(readFileSync('.git/art-run.json', 'utf8'));
  const remoteHead = git(['ls-remote', '--symref', 'origin', 'HEAD']);
  if (!remoteHead.startsWith(`ref: refs/heads/${BRANCH}\tHEAD`)) throw new Error(`GitHub default branch must be ${BRANCH}; see README.md`);
  git(['fetch', 'origin', `refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
  const remote = git(['rev-parse', `origin/${BRANCH}`]);
  git(['merge-base', '--is-ancestor', remote, run.tip]);
  const pending = git(['rev-list', '--reverse', `${remote}..${run.tip}`]).split('\n').filter(Boolean);
  for (let i = 0; i < pending.length; i += 500) {
    const last = Math.min(i + 500, pending.length) - 1;
    git(['push', 'origin', `${pending[last]}:refs/heads/${BRANCH}`]);
    console.log(`Published ${last + 1}/${pending.length} pending commits`);
  }
  console.log('Publication complete. No force pushes or deleted branches.');
}

if (import.meta.main) {
  try {
    const plan = makePlan();
    const action = process.argv[2] || 'preview';
    if (action === 'preview') preview(plan);
    else if (action === 'status') { assertRepo({ clean: false }); report(plan); }
    else if (action === 'generate') generate(plan);
    else if (action === 'verify') verify(plan);
    else if (action === 'publish') publish(plan);
    else throw new Error('Usage: bun index.js [preview|status|generate|verify|publish]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
