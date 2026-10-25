// npm test: the short browser tests, two at a time (each boots its own headless Chromium; software WebGL is CPU-bound,
// so more workers only slow every test down). TEST_WORKERS overrides.
// npm run test:full adds the slow real-time runs below. Pass names to run a subset: npm test -- routing cactus
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Whole matches / long real-time scenarios (1.5–6 min each): opt-in only
const SLOW = ['boss-finale', 'economy', 'experience', 'full-match', 'polish', 'cactus'];
const args = process.argv.slice(2), full = args.includes('--full'), only = args.filter(a => !a.startsWith('--'));
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.cjs') && f !== path.basename(__filename))
  .filter(f => only.length ? only.some(name => f.startsWith(name)) : full || !SLOW.includes(f.replace(/\.cjs$/, ''))).sort();
const workers = Math.max(1, Math.min(files.length, Number(process.env.TEST_WORKERS) || 2));

const results = [], queue = [...files], started = Date.now();
function run(file) {
  return new Promise(resolve => {
    const t0 = Date.now(), child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      const ok = code === 0, s = ((Date.now() - t0) / 1000).toFixed(1);
      // Print a finished test's output in one block (parallel output never interleaves); drop GPU driver noise
      console.log(`\n=== ${file} · ${ok ? 'PASS' : 'FAIL'} · ${s} s\n${out.split('\n').filter(l => !/GPU stall|GL Driver Message/.test(l)).join('\n').trim()}`);
      results.push({ file, ok, s }); resolve();
    });
  });
}
(async () => {
  console.log(`${files.length} test files · ${workers} at a time${full || only.length ? '' : ` · skipping slow: ${SLOW.join(', ')} (npm run test:full)`}`);
  await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await run(queue.shift()); }));
  console.log('\n=== Summary');
  for (const r of results.sort((a, b) => a.file.localeCompare(b.file))) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.file}  (${r.s} s)`);
  const failed = results.filter(r => !r.ok).length;
  console.log(`${failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  process.exit(failed ? 1 : 0);
})();
