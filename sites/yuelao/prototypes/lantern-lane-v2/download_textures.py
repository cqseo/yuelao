#!/usr/bin/env python3
"""Download verified Poly Haven CC0 PBR 1K textures for Lantern Lane v2."""
import hashlib,json,pathlib,urllib.request,time
root=pathlib.Path(__file__).resolve().parent
files=json.loads((root/'texture-sources.json').read_text(encoding='utf8'))
dest=root/'public'/'tex';dest.mkdir(parents=True,exist_ok=True)
for i,a in enumerate(files,1):
 path=dest/a['name']
 if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest()!=a['expectedMd5']:
  for attempt in range(3):
   try:
    req=urllib.request.Request(a['url'],headers={'User-Agent':'YuexiaPreview-OpenAssets/1.0'})
    with urllib.request.urlopen(req,timeout=45) as src,open(str(path)+'.part','wb') as dst:dst.write(src.read())
    pathlib.Path(str(path)+'.part').replace(path)
    break
   except Exception:
    if attempt==2:raise
    time.sleep(1.5)
 actual=hashlib.md5(path.read_bytes()).hexdigest()
 if actual!=a['expectedMd5']:raise ValueError('MD5 failed: '+a['name'])
 print(f'{i}/{len(files)} verified {a["name"]} ({path.stat().st_size} bytes)',flush=True)
