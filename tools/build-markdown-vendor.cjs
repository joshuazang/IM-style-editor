/* Rebuild pinned official-source modules with Playwright 1.62.1's Babel toolchain.
 * Normal release builds use the checked-in bundle and require no vendor fetch.
 * Usage: node tools/build-markdown-vendor.cjs SOURCE_DIRECTORY [BABEL_BUNDLE]
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.resolve(process.argv[2]);
const tool=process.argv[3]||path.join(path.dirname(require.resolve('playwright/package.json')),'lib/transform/babelBundle.js');
const {babelTransform}=require(tool),manifest=JSON.parse(fs.readFileSync(path.join(source,'sources.json'),'utf8'));
const packages=new Map(manifest.packages.map(p=>[p.name,p])),modules=new Map();
for(const p of manifest.packages)for(const [file,hash] of Object.entries(p.files))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(source,p.name,file))).digest('hex')!==hash)throw Error('Source checksum mismatch: '+p.name+'/'+file);
function resolve(request,from){
  let id;
  if(request.startsWith('.'))id=path.posix.normalize(path.posix.join(path.posix.dirname(from),request));
  else{
    const pkg=packages.get(request);if(!pkg)throw Error('Unpinned dependency: '+request);
    const json=JSON.parse(fs.readFileSync(path.join(source,request,'package.json'),'utf8'));
    const entry=/\bsrc\/[\w-]+\.ts\b/.exec(json.scripts?.prepare||'')?.[0];
    id=request+'/'+(entry||'index.js');
  }
  const candidates=[id,id.replace(/\.js$/,'.ts'),id+'.ts',id+'.js',id+'/index.ts'];
  const found=candidates.find(p=>fs.existsSync(path.join(source,p)));if(!found)throw Error('Missing module '+request+' from '+from);
  return found;
}
function visit(id){
  if(modules.has(id))return;
  const file=path.join(source,id),raw=fs.readFileSync(file,'utf8'),[name,...parts]=id.split('/');
  const expected=packages.get(name)?.files[parts.join('/')];
  if(!expected||crypto.createHash('sha256').update(raw).digest('hex')!==expected)throw Error('Source checksum mismatch: '+id);
  modules.set(id,'');
  let code=babelTransform(raw,file,false,[],[]).code.replace(/\n?\/\/# sourceMappingURL=.*$/m,'');
  // Normalize trailing spaces in upstream triple-slash documentation comments.
  // Keep executable code and literal contents unchanged.
  code=code.replace(/^([\t ]*\/\/\/[^\r\n]*?)[\t ]+$/gm,'$1');
  code=code.replace(/\brequire\((["'])([^"']+)\1\)/g,(whole,q,request)=>{
    const target=resolve(request,id);visit(target);return '__require('+JSON.stringify(target)+')';
  });
  modules.set(id,code);
}
const entries={model:'prosemirror-model',state:'prosemirror-state',view:'prosemirror-view',commands:'prosemirror-commands',keymap:'prosemirror-keymap',history:'prosemirror-history',lists:'prosemirror-schema-list',inputrules:'prosemirror-inputrules'};
const entryIds=Object.fromEntries(Object.entries(entries).map(([key,name])=>[key,resolve(name,'entry.js')]));
entryIds.serializer='prosemirror-markdown/src/to_markdown.ts';entryIds.lexer='marked/src/Lexer.ts';
Object.values(entryIds).forEach(visit);
let output='/* Local editor dependencies; pinned official source and licenses in shared/vendor/markdown-sources.json and THIRD-PARTY-NOTICES.md. */\nconst imRichDeps=(()=>{\nconst modules={\n';
output+=[...modules].sort(([a],[b])=>a.localeCompare(b)).map(([id,code])=>JSON.stringify(id)+':function(module,exports,__require){\n'+code+'\n}').join(',\n');
output+='\n},cache=Object.create(null);function __require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};if(!modules[id])throw Error("Missing editor module "+id);modules[id](module,module.exports,__require);return module.exports;}\nreturn Object.freeze({'+Object.entries(entryIds).map(([k,id])=>k+':__require('+JSON.stringify(id)+')').join(',')+'});\n})();\n';
const target=path.join(root,'shared/vendor');fs.mkdirSync(target,{recursive:true});
fs.writeFileSync(path.join(target,'markdown-editor.js'),output);
const notices=['# Third-party editor sources\n\nThese libraries are bundled locally; the editor performs no runtime package downloads.\n'];
for(const p of manifest.packages){
  const license=Object.keys(p.files).find(n=>/^(LICENSE|LICENCE|COPYING)(\.md|\.txt)?$/i.test(n));
  if(!license)throw Error('Missing license: '+p.name);
  notices.push('## '+p.name+' '+p.tag+'\n\nhttps://github.com/'+p.repository+'/tree/'+p.commit+'\n\n'+fs.readFileSync(path.join(source,p.name,license),'utf8'));
}
fs.writeFileSync(path.join(target,'THIRD-PARTY-NOTICES.md'),notices.join('\n\n'));
fs.writeFileSync(path.join(target,'markdown-sources.json'),JSON.stringify({...manifest,toolchain:'Playwright 1.62.1 Babel TypeScript/CommonJS transform',modules:[...modules.keys()].sort(),bundle_sha256:crypto.createHash('sha256').update(output).digest('hex')},null,2)+'\n');
console.log('Bundled',modules.size,'verified source modules;',Buffer.byteLength(output),'bytes');
