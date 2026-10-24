// Runs every browser test in tests/ one after another (npm test). Pass names to run a subset: npm test -- routing cactus
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.cjs') && f !== path.basename(__filename))
  .filter(f => !only.length || only.some(name => f.startsWith(name))).sort();
const results = [];
for (const file of files) {
  const started = Date.now();
  console.log(`\n=== ${file}`);
  const run = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 15 * 60 * 1000 });
  results.push({ file, ok: run.status === 0, s: ((Date.now() - started) / 1000).toFixed(1) });
}
console.log('\n=== Summary');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.file}  (${r.s} s)`);
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
