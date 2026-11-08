const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const metadata=JSON.parse(fs.readFileSync('editors-release.json'));
const digest=crypto.createHash('sha256');
for(const name of ['icons.js','menu-position.js','menu.css','controls.css','selection.css','save-feedback.js','accessibility.css','search-filters.js','search-filters.css']){digest.update(name+'\0');digest.update(fs.readFileSync('shared/ui/'+name));}
assert.equal(metadata.shared_ui_sha256,digest.digest('hex'));
let previous;
for(const directory of ['next','mosaic']){
 const html=fs.readFileSync(directory+'/index.html','utf8');
 assert.ok(html.includes('name="im-shared-ui" content="'+metadata.shared_ui_sha256+'"'));
 const js=fs.readFileSync(directory+'/'+/src="\.\/([^"?]+\.js)/.exec(html)[1],'utf8');
 const block=js.slice(js.indexOf('/* IM_SHARED_UI_BEGIN'),js.indexOf('/* IM_SHARED_UI_END */'));
 if(previous)assert.equal(block,previous);previous=block;
 const css=fs.readFileSync(directory+'/'+/href="\.\/([^"?]+\.css)/.exec(html)[1],'utf8');
 for(const name of ['menu.css','controls.css','selection.css','accessibility.css'])assert.ok(css.includes(fs.readFileSync('shared/ui/'+name,'utf8')));
 assert.ok(!css.includes('prefers-color-scheme:dark'),'Both editors ship light-only styles');
 assert.ok(js.includes('ui-tag-panel')&&js.includes('ui-action-panel'));
}
console.log('PASS: identical shared menu vectors/control sources; both editors remain light-only');
