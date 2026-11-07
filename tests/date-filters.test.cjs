const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
process.env.TZ='America/Toronto';
const api=vm.runInNewContext(fs.readFileSync('shared/ui/search-filters.js','utf8')+';({range:imDateRange,matches:imDateMatches,input:imDateInput})');
const now=new Date('2026-11-07T17:00:00Z'),message=date=>({createdAt:date}),date=(preset,extra={})=>api.range({preset,...extra},now);
const today=date('today');assert.equal(today.start,Date.parse('2026-11-07T05:00:00Z'));assert.equal(today.end,Date.parse('2026-11-08T05:00:00Z'));
assert.ok(api.matches(message('2026-11-08T04:59:59.999Z'),today));assert.ok(!api.matches(message('2026-11-08T05:00:00Z'),today));assert.ok(!api.matches(message('2026-11-07T04:59:59.999Z'),today));
const week=date('week');assert.equal(week.start,Date.parse('2026-11-01T04:00:00Z'));assert.equal((week.end-week.start)/3600000,169,'The last seven local calendar days include the 25-hour DST day');
assert.equal(date('yesterday').start,Date.parse('2026-11-06T05:00:00Z'));assert.equal(date('month').start,Date.parse('2026-10-09T04:00:00Z'));
const fall=api.range({preset:'today'},new Date('2026-11-01T17:00:00Z'));assert.equal((fall.end-fall.start)/3600000,25);
const spring=api.range({preset:'today'},new Date('2026-03-08T17:00:00Z'));assert.equal((spring.end-spring.start)/3600000,23);
const exact=date('day',{date:'2026-11-01'});assert.equal(exact.start,fall.start);assert.equal(exact.end,fall.end);assert.equal((exact.end-exact.start)/3600000,25);assert.ok(date('day').error);assert.ok(date('day',{date:'2026-02-30'}).error);
const custom=date('custom',{from:'2026-11-01',to:'2026-11-01'});assert.equal(custom.start,fall.start);assert.equal(custom.end,fall.end);
assert.ok(date('custom',{from:'2026-11-08',to:'2026-11-07'}).error);assert.ok(date('custom',{from:'2026-02-30'}).error);assert.ok(date('custom').error);
assert.ok(!date('custom',{from:'2026-11-07'}).error);assert.equal(date('custom',{to:'2026-11-07'}).end,today.end);
for(const value of [undefined,'garbage','2026-02-30',0,null])assert.equal(api.input(value),null);
for(const value of [undefined,'invalid',null]){assert.ok(!api.matches(message(value),today));assert.ok(api.matches(message(value),date('all')));}
const mutable=message('2026-11-07T15:00:00Z');assert.ok(api.matches(mutable,today));mutable.createdAt='2026-11-05T15:00:00Z';assert.ok(!api.matches(mutable,today));
assert.equal(date('unknown').key,'all');assert.notEqual(api.range({preset:'today'},now).key,api.range({preset:'today'},new Date(+now+86400000)).key);
console.log('PASS: inclusive local dates, exclusive next-day boundary, DST 23/25-hour days, rolling calendar presets, open ranges, validation, missing dates and refreshed timestamp cache');
