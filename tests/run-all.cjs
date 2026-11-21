// npm test: the short browser tests in parallel (each file boots its own headless Chromium). Quiet: one line per file;
// a failing file's full output is printed, every file's output is kept in tests/.logs/<file>.log.
// npm run test:full adds the slow real-time runs below. Pass names to run a subset: npm test -- routing cactus
// Options: --verbose (print every file's output), TEST_WORKERS=n (default: CPU threads / 2, 2..8).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Whole matches / long real-time scenarios: opt-in only (npm run test:full)
const SLOW = ['boss-finale', 'experience', 'full-match', 'polish', 'cactus'];
// Time budget (seconds, wall clock) on the idle 16-thread test laptop (GPU WebGL); over it the run warns loudly and
// fails in CI. TEST_BUDGET=s overrides (CI: software WebGL on 4 vCPUs). See AGENTS.md.
const BUDGET = { fast: 150, full: 420 }, FILE_BUDGET = 120;
const args = process.argv.slice(2), full = args.includes('--full'), verbose = args.includes('--verbose');
const only = args.filter(a => !a.startsWith('--'));
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.cjs') && f !== path.basename(__filename) && !f.startsWith('_'))
  .filter(f => only.length ? only.some(name => f.startsWith(name)) : full || !SLOW.includes(f.replace(/\.cjs$/, ''))).sort();
if (!files.length) { console.log(`no test file matches: ${only.join(' ')}`); process.exit(1); }
const cpus = os.availableParallelism?.() || os.cpus().length;
const workers = Math.max(1, Math.min(files.length, Number(process.env.TEST_WORKERS) || Math.max(2, Math.min(8, Math.floor(cpus / 2)))));
const logs = path.join(__dirname, '.logs');
fs.mkdirSync(logs, { recursive: true });

// Longest files first so the slow ones never start last
let timing = {};
try { timing = JSON.parse(fs.readFileSync(path.join(logs, 'timing.json'), 'utf8')); } catch { /* first run */ }
const queue = [...files].sort((a, b) => (timing[b] || 60) - (timing[a] || 60));
const results = [], started = Date.now();
const noise = /GPU stall due to ReadPixels|GL Driver Message/;   // driver spam only: keep launch / fallback lines
function run(file) {
  return new Promise(resolve => {
    const t0 = Date.now(), child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += '\n[run-all] killed after 15 min'; child.kill(); }, 15 * 60 * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      const ok = code === 0, s = (Date.now() - t0) / 1000;
      const text = out.split('\n').filter(l => !noise.test(l)).join('\n').trim();
      fs.writeFileSync(path.join(logs, file.replace(/\.cjs$/, '.log')), text + '\n');
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}  ${s.toFixed(1)} s${s > FILE_BUDGET ? '  (SLOW: over the ' + FILE_BUDGET + ' s per-file budget)' : ''}`);
      if (!ok || verbose) console.log(`--- ${file} output\n${text}\n---`);
      results.push({ file, ok, s }); timing[file] = Math.round(s); resolve();
    });
  });
}
(async () => {
  console.log(`${files.length} test files · ${workers} at a time${full || only.length ? '' : ` · slow tier skipped (npm run test:full)`} · logs in tests/.logs/`);
  await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await run(queue.shift()); }));
  fs.writeFileSync(path.join(logs, 'timing.json'), JSON.stringify(timing, null, 1));
  const failed = results.filter(r => !r.ok), total = (Date.now() - started) / 1000;
  const load = os.loadavg()[0].toFixed(1);
  console.log(`${failed.length ? `${failed.length} of ${results.length} failed: ${failed.map(r => r.file).join(', ')}` : `all ${results.length} passed`} in ${total.toFixed(0)} s (load ${load} on ${cpus} threads)`);
  const budget = only.length ? 0 : Number(process.env.TEST_BUDGET) || (full ? BUDGET.full : BUDGET.fast);
  if (budget && total > budget) {
    console.log(`\n!!! TEST TIME BUDGET EXCEEDED: ${total.toFixed(0)} s > ${budget} s. Slowest: ${[...results].sort((a, b) => b.s - a.s).slice(0, 3).map(r => `${r.file} ${r.s.toFixed(0)} s`).join(', ')}.`);
    console.log(os.loadavg()[0] > cpus * 0.75 ? '    The machine is busy (see load), so this may be contention, not the tests.' : '    Make the slow test faster (one boot, simulated steps, no real-time waits) or move it to SLOW.');
    if (process.env.CI) process.exitCode = 1;
  }
  process.exit(failed.length ? 1 : process.exitCode || 0);
})();
