#!/usr/bin/env node
/**
 * Bundle Budget Check — fails if entrypoint JavaScript exceeds threshold.
 * Reads webpack --json output (stats.json) and sums JS modules in initial chunks.
 */

const fs = require('fs');
const path = require('path');

const STATS_PATH = path.resolve(__dirname, '../dist/stats.json');
const MAX_ENTRYPOINT_JS_KB = 190; // early warning buffer (hard limit is 200 KB in webpack.config.js)

function main() {
  if (!fs.existsSync(STATS_PATH)) {
    console.error(`❌  stats.json not found at ${STATS_PATH}`);
    console.error('   Run webpack with --json to generate it.');
    process.exit(1);
  }

  const stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));

  let totalJsBytes = 0;
  const chunkDetails = [];

  for (const chunk of stats.chunks || []) {
    if (!chunk.initial) continue;

    const names = chunk.names || ['(unnamed)'];
    let chunkJsBytes = 0;

    for (const module of chunk.modules || []) {
      if (module.moduleType === 'javascript/auto') {
        chunkJsBytes += module.size || 0;
      }
    }

    if (chunkJsBytes > 0) {
      chunkDetails.push({ name: names[0], kb: chunkJsBytes / 1024 });
      totalJsBytes += chunkJsBytes;
    }
  }

  const totalKb = totalJsBytes / 1024;

  console.log('📦  Entrypoint JavaScript Budget Check');
  console.log('═══════════════════════════════════════');
  for (const c of chunkDetails) {
    console.log(`  ${c.kb.toFixed(1).padStart(6)} KB  ${c.name}`);
  }
  console.log('═══════════════════════════════════════');
  console.log(`  ${totalKb.toFixed(1).padStart(6)} KB  TOTAL (limit: ${MAX_ENTRYPOINT_JS_KB} KB)`);
  console.log('');

  if (totalKb > MAX_ENTRYPOINT_JS_KB) {
    console.error(`❌  FAIL: Entrypoint JS ${totalKb.toFixed(1)} KB exceeds ${MAX_ENTRYPOINT_JS_KB} KB budget`);
    console.error('   → Check for accidental eager imports (Three.js, gl/, large deps)');
    console.error('   → Use dynamic import() for lazy-loaded features');
    process.exit(1);
  }

  const headroom = MAX_ENTRYPOINT_JS_KB - totalKb;
  console.log(`✅  PASS: ${headroom.toFixed(1)} KB headroom remaining`);
  process.exit(0);
}

main();