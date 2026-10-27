const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const gap = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/message-spacing.js'), 'utf8') + ';imMessageGap');
const before = { createdAt: '2026-01-01T08:00:00Z' };
const at = ms => ({ createdAt: new Date(Date.parse(before.createdAt) + ms).toISOString() });
for (const [delay, expected] of [[0,2],[300000,2],[300001,7],[3540000,7],[3600000,12],[18000000,12],[-1,2]])
  assert.equal(gap(before, at(delay), false), expected);
assert.equal(gap(null, before, true), 0);
assert.equal(gap({}, before, false), 2);
assert.equal(gap({ createdAt: 'invalid' }, before, false), 2);
assert.equal(gap(before, at(43200000), true), 0);
console.log('PASS: grouping thresholds, equal/missing/reversed dates, and day boundaries');
