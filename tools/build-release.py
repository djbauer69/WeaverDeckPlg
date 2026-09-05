#!/usr/bin/env python3
"""Build a deterministic plugin ZIP from this checkout, with executable modes."""
import hashlib,json,pathlib,stat,sys,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
plugin=root/'com.pipeweaver.opendeck.sdPlugin'
version=json.loads((plugin/'manifest.json').read_text())['Version']
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else root.parent/f'pipeweaver-opendeck-plugin-v{version}.zip')
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(plugin.rglob('*')):
        if not p.is_file():continue
        info=zipfile.ZipInfo(p.relative_to(root).as_posix(),(2026,1,1,0,0,0))
        info.create_system=3
        mode=0o755 if p.name in ('plugin.js','plugin-core.js') else 0o644
        info.external_attr=(stat.S_IFREG|mode)<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes(),compresslevel=9)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    files={p.relative_to(root).as_posix():p.read_bytes() for p in plugin.rglob('*') if p.is_file()}
    assert set(z.namelist())==set(files)
    assert all(z.read(n)==b for n,b in files.items())
    assert z.getinfo('com.pipeweaver.opendeck.sdPlugin/plugin.js').external_attr>>16&0o111
print(hashlib.sha256(out.read_bytes()).hexdigest(),out)
