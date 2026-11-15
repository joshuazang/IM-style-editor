const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const spacing=vm.runInNewContext(fs.readFileSync('shared/ui/paragraph-spacing.js','utf8')+';imParagraphSpacing');
const f=vm.runInNewContext(fs.readFileSync('shared/core/note-format.js','utf8')+';imFormat',{crypto,btoa});
assert.equal(spacing.value(), 'medium');assert.equal(spacing.style({})['--paragraph-gap'],'1em');
assert.equal(spacing.value({paragraphSpacing:'unknown'}),'medium');
for(const [id,gap] of [['none','0em'],['small','0.5em'],['medium','1em'],['large','1.5em']]){
 const settings={paragraphSpacing:id};assert.equal(spacing.style(settings)['--paragraph-gap'],gap);
 const text=f.portable([],settings,'Unsent draft');const parsed=f.inspect(text);
 assert.equal(parsed.settings.paragraphSpacing,id);assert.equal(parsed.draft,'Unsent draft');
 assert.ok(text.includes(JSON.stringify({paragraphSpacing:id}).slice(1,-1)));
}
assert.throws(()=>f.portable([],{paragraphSpacing:4}));
console.log('PASS: shared paragraph presets, Medium default, fallback and saved setting round trips without changing draft text');
