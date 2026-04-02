/**
 * Destruction Test Suite Runner
 *
 * Runs all destruction test files in sequence and reports aggregate results.
 * Exits non-zero if any test fails.
 *
 * Prerequisites:
 *   - Local server running on port 8080: npx http-server -p 8080 -c-1
 *   - Playwright installed: npm install playwright
 *
 * Usage:
 *   node tests/run-destruction-suite.js
 *
 * Exit: 0 = all pass, 1 = any failure
 */

const { execFileSync } = require('child_process');
const path = require('path');

var tests = [
  'destruction-correctness-test.js',
  'destruction-integration-test.js',
  'destruction-perf-regression-test.js',
];

var results = [];

process.stderr.write('\n========================================\n');
process.stderr.write('  Destruction Test Suite\n');
process.stderr.write('========================================\n');

for (var i = 0; i < tests.length; i++) {
  var testPath = path.join(__dirname, tests[i]);
  process.stderr.write('\n--- Running: ' + tests[i] + ' ---\n');

  try {
    execFileSync('node', [testPath], {
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: 180000, // 3 min per test
    });
    results.push({ name: tests[i], passed: true });
  } catch (err) {
    results.push({ name: tests[i], passed: false, exitCode: err.status || 1 });
  }
}

// Summary
process.stderr.write('\n========================================\n');
process.stderr.write('  Suite Summary\n');
process.stderr.write('========================================\n');

var failed = results.filter(function(r) { return !r.passed; });

results.forEach(function(r) {
  process.stderr.write((r.passed ? 'PASS' : 'FAIL') + '  ' + r.name + '\n');
});

process.stderr.write('\nPassed: ' + (results.length - failed.length) + '/' + results.length + '\n');

process.exit(failed.length > 0 ? 1 : 0);
