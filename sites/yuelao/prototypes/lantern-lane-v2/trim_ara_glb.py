#!/usr/bin/env python3
"""Self-contained GLB optimizer for Ara 3D Gen player: retain Idle/Walk/Run.

No mesh or skin decimation; preserves real textured, skinned human geometry.
Drops 45 unused animation clips, and compacts accessors/bufferViews/BIN.
Usage: python3 trim_ara_glb.py INPUT.glb OUTPUT.glb
License: original script for Yuexia preview.
"""
import json
import struct
import sys
from pathlib import Path

KEEP={"Idle", "Walk", "Run"}
ALIGN=lambda n:(n+3)&~3

def check(cond,message):
    if not cond: raise ValueError(message)

def trim(raw):
    check(raw[:4]==b"glTF","Not a GLB")
    version,total=struct.unpack_from("<II",raw,4)
    check(version==2 and total==len(raw),"Not GLB 2.0")
    p=12
    chunks=[]
    while p<len(raw):
        size,kind=struct.unpack_from("<I4s",raw,p);p+=8
        chunks.append((kind,raw[p:p+size]));p+=size
    json_data=next((b for k,b in chunks if k==b"JSON"),None)
    binary=next((b for k,b in chunks if k==b"BIN\x00"),None)
    check(json_data is not None and binary is not None,"Missing GLB JSON/BIN")
    doc=json.loads(json_data)
    check(len(doc.get("buffers",[]))==1,"Expected one embedded GLB buffer")
    animations=[x for x in doc.get("animations",[]) if x.get("name") in KEEP]
    check({x.get("name") for x in animations}==KEEP,"Missing required Idle/Walk/Run")
    doc["animations"]=animations

    accessed=set()
    for mesh in doc.get("meshes",[]):
        for prim in mesh.get("primitives",[]):
            if "indices" in prim: accessed.add(prim["indices"])
            accessed.update(prim.get("attributes",{}).values())
            for target in prim.get("targets",[]):accessed.update(target.values())
    for skin in doc.get("skins",[]):
        if "inverseBindMatrices" in skin: accessed.add(skin["inverseBindMatrices"])
    for animation in animations:
        for sampler in animation.get("samplers",[]):
            accessed.add(sampler["input"]);accessed.add(sampler["output"])
    accessors=doc.get("accessors",[])
    ordered=sorted(accessed)
    amap={old:i for i,old in enumerate(ordered)}
    doc["accessors"]=[accessors[i] for i in ordered]

    for mesh in doc.get("meshes",[]):
        for prim in mesh.get("primitives",[]):
            if "indices" in prim:prim["indices"]=amap[prim["indices"]]
            prim["attributes"]={key:amap[value] for key,value in prim.get("attributes",{}).items()}
            for target in prim.get("targets",[]):
                for key,val in list(target.items()):target[key]=amap[val]
    for skin in doc.get("skins",[]):
        if "inverseBindMatrices" in skin:skin["inverseBindMatrices"]=amap[skin["inverseBindMatrices"]]
    for animation in animations:
        for sampler in animation["samplers"]:
            sampler["input"]=amap[sampler["input"]]
            sampler["output"]=amap[sampler["output"]]

    bv_used=set()
    for a in doc["accessors"]:
        if "bufferView" in a:bv_used.add(a["bufferView"])
        if "sparse" in a:
            bv_used.add(a["sparse"]["indices"]["bufferView"])
            bv_used.add(a["sparse"]["values"]["bufferView"])
    for img in doc.get("images",[]):
        if "bufferView" in img:bv_used.add(img["bufferView"])

    original_views=doc["bufferViews"]
    bv_old=sorted(bv_used)
    bvmap={old:new for new,old in enumerate(bv_old)}
    out=bytearray()
    compact=[]
    for old in bv_old:
        view=original_views[old]
        offset=view.get("byteOffset",0);length=view["byteLength"]
        check(offset+length<=len(binary),"bufferView out of range")
        while len(out)%4:out.append(0)
        dest=len(out)
        out.extend(binary[offset:offset+length])
        copy=view.copy()
        copy["byteOffset"]=dest
        compact.append(copy)
    while len(out)%4:out.append(0)
    doc["bufferViews"]=compact
    for a in doc["accessors"]:
        if "bufferView" in a:a["bufferView"]=bvmap[a["bufferView"]]
        if "sparse" in a:
            a["sparse"]["indices"]["bufferView"]=bvmap[a["sparse"]["indices"]["bufferView"]]
            a["sparse"]["values"]["bufferView"]=bvmap[a["sparse"]["values"]["bufferView"]]
    for img in doc.get("images",[]):
        if "bufferView" in img:img["bufferView"]=bvmap[img["bufferView"]]
    doc["buffers"][0]["byteLength"]=len(out)
    enc=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode("utf-8")
    enc+=b" "*(ALIGN(len(enc))-len(enc))
    body=bytes(out)
    total=12+8+len(enc)+8+len(body)
    new=struct.pack("<4sII",b"glTF",2,total)+struct.pack("<I4s",len(enc),b"JSON")+enc+struct.pack("<I4s",len(body),b"BIN\x00")+body
    return new,len(accessors),len(doc["accessors"]),len(original_views),len(compact)

if __name__=="__main__":
    inp,out=map(Path,sys.argv[1:3])
    raw=inp.read_bytes()
    model,*stats=trim(raw)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_bytes(model)
    print("Original",len(raw),"bytes; trimmed",len(model),"bytes; reduction",round((1-len(model)/len(raw))*100,1),"%")
    print("Accessors and bufferViews",stats,"retained clips",sorted(KEEP))
