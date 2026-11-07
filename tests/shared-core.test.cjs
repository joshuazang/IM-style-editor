const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const config=JSON.parse(fs.readFileSync('editors-release.json','utf8'));
const appFiles=['next/index.html','mosaic/index.html'];
const blocks=appFiles.map(path=>{
 const html=fs.readFileSync(path,'utf8'),base=path.slice(0,path.lastIndexOf('/')+1);
 assert.ok(html.includes('name="im-shared-core" content="'+config.shared_core_sha256+'"'));
 const file=base+/src="\.\/([^\"]+\.js)"/.exec(html)[1],source=fs.readFileSync(file,'utf8');
 assert.equal(source.split('/* IM_SHARED_CORE_BEGIN ').length,2);
 const block=source.slice(source.indexOf('/* IM_SHARED_CORE_BEGIN '),source.indexOf('/* IM_SHARED_CORE_END */')+'/* IM_SHARED_CORE_END */'.length);
 assert.ok(!source.includes('spellCheck:!0'));
 return block;
});
assert.equal(blocks[0],blocks[1],'The two shipped interfaces must contain the identical shared core');
const names=['note-format.js','host-bridge.js','note-storage.js','message-transfer.js','privacy.js','clipboard.js','reply-record.js'];
const digest=crypto.createHash('sha256');
for(const name of names){
 assert.ok(!fs.existsSync('next/src/'+name)&&!fs.existsSync('mosaic/src/'+name),'No independent modern core copy: '+name);
 digest.update(name+'\0');digest.update(fs.readFileSync('shared/core/'+name));
}
assert.equal(digest.digest('hex'),config.shared_core_sha256);
assert.notEqual(JSON.parse(fs.readFileSync('mosaic.ext.json')).identifier,JSON.parse(fs.readFileSync('im-style-editor-next.ext.json')).identifier);
assert.equal(JSON.parse(fs.readFileSync('im-style-editor.ext.json')).name,'IM-style-editor Archive');
console.log('PASS: one canonical core, byte-identical compiled core in both interfaces, separate plugin identifiers, Archive remains independent');
