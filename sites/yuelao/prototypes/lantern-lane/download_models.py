#!/usr/bin/env python3
"""Download pinned, CC0 GLBs for isolated Yuexia Lantern Lane demo."""
import hashlib
import json
import pathlib
import sys
import time
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parent
DEST=ROOT/'public'/'models'
DEST.mkdir(parents=True,exist_ok=True)
assets=json.loads((ROOT/'model-sources.json').read_text(encoding='utf-8'))
lock={}
for i,info in enumerate(assets,1):
    target=DEST/info['filename']
    if target.is_file() and target.stat().st_size==info['size']:
        print(f"{i:02d}/{len(assets)} cached {info['filename']}",flush=True)
    else:
        for attempt in range(3):
            try:
                print(f"{i:02d}/{len(assets)} fetching {info['filename']}",flush=True)
                req=urllib.request.Request(info['url'],headers={'User-Agent':'Yuexia-CC0-Preview/1.0'})
                with urllib.request.urlopen(req,timeout=50) as src,open(str(target)+'.part','wb') as out:
                    while True:
                        chunk=src.read(1024*1024)
                        if not chunk:break
                        out.write(chunk)
                pathlib.Path(str(target)+'.part').replace(target)
                assert target.stat().st_size==info['size'],f"bad size {target.stat().st_size} != {info['size']}"
                break
            except Exception as exc:
                print(f" retry: {exc}",file=sys.stderr,flush=True)
                if attempt>=2:raise
                time.sleep(1.5)
    lock[info['filename']]={'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':info['url']}
(ROOT/'models-lock.json').write_text(json.dumps(lock,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"OK: {len(assets)} GLBs ({sum(x['bytes'] for x in lock.values())/1024/1024:.1f} MiB)",flush=True)
