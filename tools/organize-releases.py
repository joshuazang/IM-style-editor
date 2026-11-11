"""Keep current distributions at the root; archive historical bytes and URL paths."""
import argparse,json,re
from pathlib import Path
from shared_core import ROOT,release_config

INDEX=ROOT/'releases/paths.json'
def archive_plan():
    current=release_config()
    keep={('im',current['im_version']),('mosaic',current['mosaic_version']),('archive',json.loads((ROOT/'im-style-editor.ext.json').read_text())['version'])}
    plan={}
    for path in ROOT.iterdir():
        match=re.fullmatch(r'(IM-style-editor-|im-style-editor-|Mosaic-|mosaic-)(\d+\.\d+\.\d+)(\.zip|\.ext\.json)',path.name)
        if not match:continue
        prefix,version,_=match.groups()
        family='mosaic' if prefix.lower()=='mosaic-' else 'archive' if int(version.split('.')[0])<4 else 'im'
        if (family,version) not in keep:plan[path.relative_to(ROOT).as_posix()]=f'releases/{family}/{version}/{path.name}'
    for directory in ['next','mosaic']:
        html=(ROOT/directory/'index.html').read_text()
        active=set(re.findall(r'(?:src|href)="\./(assets/[^"?]+)"',html))
        for path in (ROOT/directory/'assets').iterdir():
            relative=path.relative_to(ROOT/directory).as_posix()
            if re.fullmatch(r'assets/(?:index|mosaic)-[0-9a-f]+\.(?:js|css)',relative) and relative not in active:
                plan[f'{directory}/{relative}']=f'releases/assets/{directory}/{path.name}'
    return plan

def organize(check=False):
    plan=archive_plan()
    if check:
        if plan:raise SystemExit('Historical files still need archiving: '+', '.join(plan))
        return
    aliases=json.loads(INDEX.read_text()) if INDEX.exists() else {}
    for old,new in sorted(plan.items()):
        source,target=ROOT/old,ROOT/new
        target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():
            assert target.read_bytes()==source.read_bytes(),new
            source.unlink()
        else:source.rename(target)
        aliases[old]=new
    INDEX.parent.mkdir(exist_ok=True)
    INDEX.write_text(json.dumps(dict(sorted(aliases.items())),indent=2)+'\n')
    lines=['# Release history','','Current install manifests and distribution packages stay at the repository root.','Older files are grouped below; no historical package or manifest is discarded.','','The Pages build restores original URLs from [paths.json](paths.json), so existing','installation links and cached editor assets continue to work. Do not edit archived','file contents: their original bytes are retained.','','`tools/package-editors.py` archives superseded releases automatically.','']
    for family,label in [('im','IM'),('mosaic','Mosaic'),('archive','Archive editor')]:
        folder=ROOT/'releases'/family
        versions=sorted((p.name for p in folder.iterdir() if p.is_dir()),key=lambda v:tuple(map(int,v.split('.'))),reverse=True) if folder.exists() else []
        lines+=['## '+label,'']+[f'- [{version}]({family}/{version}/)' for version in versions]+['']
    lines+=['## Historical runtime assets','','Fingerprint-named JS/CSS used by previously loaded pages are retained in','[assets](assets/). Their original website URLs remain available.','']
    (ROOT/'releases/README.md').write_text('\n'.join(lines))
    print(f'Archived {len(plan)} historical files; {len(aliases)} original URL paths retained.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');organize(parser.parse_args().check)
