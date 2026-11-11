"""Publish the tracked repository plus byte-identical aliases for archived URLs."""
import argparse,json,shutil,subprocess
from pathlib import Path,PurePosixPath
from shared_core import ROOT

def safe_path(value):
    path=PurePosixPath(value)
    if path.is_absolute() or '..' in path.parts or not path.parts:raise ValueError('Unsafe release path: '+value)
    return Path(*path.parts)

def build(output):
    output=output.resolve()
    if output==ROOT or output in ROOT.parents:raise ValueError('Output must not contain the repository')
    if output.is_relative_to(ROOT) and output!=ROOT/'_site':raise ValueError('Only _site may be used as an output inside the repository')
    if output.exists():shutil.rmtree(output)
    output.mkdir(parents=True)
    paths=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    for name in filter(None,paths):
        path=safe_path(name)
        if path.parts[0] in ['.github','.git'] or not (ROOT/path).is_file():continue
        target=output/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/path,target)
    aliases=json.loads((ROOT/'releases/paths.json').read_text())
    for old,new in aliases.items():
        relative,archived=safe_path(old),safe_path(new)
        if archived.parts[0]!='releases':raise ValueError('Alias must point into releases/')
        source,target=ROOT/archived,output/relative
        if target.exists():assert target.read_bytes()==source.read_bytes(),old
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        assert target.read_bytes()==source.read_bytes(),old
    (output/'.nojekyll').touch()
    print(f'Pages site built at {output}; verified {len(aliases)} archived URL aliases.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'_site');build(parser.parse_args().output)
