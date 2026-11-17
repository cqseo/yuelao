import * as THREE from 'three';

/**
 * Yuexia V2.6 rebuild. One authored coordinate system for visuals, roads,
 * accessible waypoints, collision, portal positions and the minimap.
 * NORTH = +Z, EAST = +X. All world dimensions are Three.js units.
 */
export function createExpandedDistricts(scene,{pathMaterial,lanternLights,low=false}) {
  const extent={minX:-63,maxX:63,minZ:-95,maxZ:70};
  const roads=[],plazas=[],obstacles=[],houses=[];
  const nav={
    gate:{x:0,z:13.5},market:{x:0,z:1},pond:{x:31,z:-21},
    temple:{x:0,z:-31},keeper:{x:-3.6,z:-7.8},
    north:{x:0,z:53},grove:{x:-31,z:-21},station:{x:0,z:-74},
  };
  const materials={
    stone:pathMaterial,
    stoneBorder:new THREE.MeshStandardMaterial({color:0x62605f,roughness:.94}),
    gravel:new THREE.MeshStandardMaterial({color:0x303c45,roughness:1}),
    plaster:new THREE.MeshStandardMaterial({color:0xb0a99e,roughness:.98}),
    paper:new THREE.MeshStandardMaterial({color:0xe0c6a1,emissive:0x6f462b,emissiveIntensity:.23,roughness:.95}),
    timber:new THREE.MeshStandardMaterial({color:0x583b3d,roughness:.82}),
    red:new THREE.MeshStandardMaterial({color:0x80433d,roughness:.8}),
    roof:new THREE.MeshStandardMaterial({color:0x444d61,roughness:.87,metalness:.04,side:THREE.DoubleSide}),
    roofTrim:new THREE.MeshStandardMaterial({color:0x6f7b86,roughness:.73}),
    bronze:new THREE.MeshStandardMaterial({color:0xc5a37b,metalness:.34,roughness:.6}),
    lantern:new THREE.MeshStandardMaterial({color:0xf8ad70,emissive:0xf38f45,emissiveIntensity:1.05,roughness:.6}),
    lake:new THREE.MeshStandardMaterial({color:0x30566b,metalness:.34,roughness:.3,transparent:true,opacity:.94,side:THREE.DoubleSide}),
    foliage:new THREE.MeshStandardMaterial({color:0x345d54,roughness:1}),
    blossom:new THREE.MeshStandardMaterial({color:0xc898a1,roughness:1}),
    rock:new THREE.MeshStandardMaterial({color:0x68757a,roughness:.97}),
  };
  let seed=425113;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const worldGroup=new THREE.Group();worldGroup.name='Yuexia_Orderly_District';scene.add(worldGroup);
  function block(parent,w,h,d,mat,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function plane(w,d,x,z,material=materials.stone,y=.025){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);
    mesh.receiveShadow=true;worldGroup.add(mesh);return mesh;
  }
  function route(x,z,w,d){
    roads.push({x,z,w,d});
    plane(w,d,x,z);
    // Few border strokes make each route visibly distinct from surrounding land.
    const alongZ=d>w;
    for(const side of [-1,1]){
      const edge=alongZ?block(worldGroup,.16,.07,d,materials.stoneBorder,x+side*(w*.5+.04),.02,z)
      :block(worldGroup,w,.07,.16,materials.stoneBorder,x,.02,z+side*(d*.5+.04));
      edge.receiveShadow=true;
    }
  }
  function plaza(x,z,r){
    plazas.push({x,z,r});
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.08,48),materials.stone);
    pad.position.set(x,.01,z);pad.receiveShadow=true;worldGroup.add(pad);
    const ring=new THREE.Mesh(new THREE.RingGeometry(r-.17,r-.05,48),materials.bronze);
    ring.rotation.x=-Math.PI/2;ring.position.set(x,.083,z);worldGroup.add(ring);
  }
  // Main spine + two flank lanes + cross streets; all physically connected.
  route(0,-4,11.2,68);                 // lamp lane, -38 to +30, stops before Yue Lao hall
  route(0,46,10,37);                  // +27.5 to +64.5
  route(0,-73,10,36);                 // -91 to -55
  route(0,19,66,8.5);                // northern crossroads
  route(0,-29,66,8.5);               // branch around Yue Lao hall
  route(-31,-19,8.8,85);             // western walk
  route(31,-19,8.8,85);              // eastern walk
  route(0,-56,66,8.5);               // behind the hall
  plaza(0,53,9.5);
  plaza(-31,-21,9.5);
  plaza(31,-21,9.5);
  plaza(0,-74,9.5);
  // Use a small cobbled path to the tea house door. This is an intentional entrance.
  route(-7.2,-5,4.3,4.0);

  // Main hall is off the central spine's southern end, so you cannot walk through it.
  // The road flows around by both side lanes, which connect to the south.
  function plaque(text,w=2.8){
    const c=document.createElement('canvas');c.width=512;c.height=160;
    const g=c.getContext('2d');g.fillStyle='#49323b';g.fillRect(0,0,512,160);
    g.strokeStyle='#bf936c';g.lineWidth=9;g.strokeRect(10,10,492,140);
    g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f3d4a1';
    g.font='600 83px "Noto Serif SC","Songti SC",serif';g.fillText(text,256,82);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w,.82),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  }

  /**
   * A house has actual coherent walls + proportionate pitched roof.
   * Local front = +Z; local X horizontal, rotate to face the pedestrian route.
   * The tea house leaves a functional, visually open doorway.
   */
  function house({id,x,z,w=8.2,d=7,h=3.75,rot=0,sign='',door=false}) {
    const g=new THREE.Group();g.name='Building_'+id;
    g.position.set(x,0,z);g.rotation.y=rot;worldGroup.add(g);
    const wall=(a,b,c,px,py,pz,mat=materials.plaster)=>block(g,a,b,c,mat,px,py,pz);
    const halfW=w/2,halfD=d/2;
    const floor=block(g,w,.16,d,materials.gravel,0,.06,0);floor.receiveShadow=true;
    for(const sx of [-1,1])wall(.26,h,d,sx*(halfW-.13),h*.5,0,materials.plaster);
    wall(w,h,.26,0,h*.5,-halfD+.13);
    // Front has a real opening, with lintel across the door.
    if(door){
      const gap=2.25;
      for(const side of [-1,1]){
        wall((w-gap)/2,h,.25,side*((w+gap)/4),h*.5,halfD-.12);
      }
      wall(gap,h-2.65,.25,0,2.65+(h-2.65)*.5,halfD-.12);
      wall(gap+.36,.19,.4,0,2.77,halfD,materials.timber);
    }else{
      wall(w,h,.25,0,h*.5,halfD-.12);
      wall(1.55,2.42,.16,0,1.35,halfD+.03,materials.red);
    }
    for(const side of [-1,1]){
      wall(.22,h+.18,.32,side*(halfW-.22),h*.5+.10,halfD+.07,materials.timber);
      for(let y=0;y<1;y++){
        const wx=side*halfW*.61;
        wall(1.48,1.43,.08,wx,1.92,halfD+.055,materials.paper);
        wall(.075,1.53,.16,wx,1.92,halfD+.12,materials.timber);
        wall(1.6,.075,.15,wx,1.92,halfD+.13,materials.timber);
        wall(1.62,.085,.15,wx,2.48,halfD+.13,materials.timber);
        wall(1.62,.085,.15,wx,1.36,halfD+.13,materials.timber);
      }
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){
      wall(.23,h+.27,.25,sx*(halfW-.12),h*.5,sz*(halfD-.15),materials.timber);
    }
    // Two roof planes, each rises toward center. No giant cones/oversized roof.
    const overhang=.62,run=halfW+overhang,rise=1.55;
    const slopeWidth=Math.hypot(run,rise),roofD=d+overhang*2;
    for(const side of [-1,1]){
      const r=new THREE.Mesh(new THREE.BoxGeometry(slopeWidth,.16,roofD),materials.roof);
      r.position.set(side*run/2,h+rise/2,0);
      r.rotation.z=side*Math.atan2(rise,run);
      r.receiveShadow=true;g.add(r);
      block(g,.19,.18,roofD,materials.roofTrim,side*(halfW+overhang*.83),h+.17,0);
    }
    block(g,.21,.22,roofD,materials.roofTrim,0,h+rise,0);
    // Horizontal eaves align with front.
    wall(w+1.2,.13,.18,0,h-.12,halfD+.52,materials.timber);
    if(sign){
      const board=plaque(sign,Math.min(w-1.5,3));
      board.position.set(0,h-.38,halfD+.65);g.add(board);
    }
    if(door){
      // Light glows from inside at correct doorway, real access is handled by interior module.
      const light=new THREE.PointLight(0xffbd81,1.6,8,2);
      light.position.set(0,2.4,halfD-1.0);g.add(light);
    }
    const aabbRadius=.42;
    // OBB in world space for collision. Rotate (x,z) around building center.
    const front=(Math.sin(rot)*halfD + x);
    const frontZ=(Math.cos(rot)*halfD + z);
    houses.push({id,x,z,w,d,h,rot,door,frontX:front,frontZ});
    return g;
  }
  // Five small shops deliberately align parallel to the street; no overlapping roofs.
  house({id:'tea',x:-13,z:-5,w:8.4,d:7.8,h:3.75,rot:Math.PI/2,sign:'听月茶馆',door:true});
  house({id:'silk',x:13,z:6,w:8.4,d:7.8,h:3.8,rot:-Math.PI/2,sign:'红笺铺'});
  house({id:'book',x:-13,z:-21,w:8.4,d:7.8,h:3.7,rot:Math.PI/2,sign:'藏书阁'});
  house({id:'fate',x:13,z:-22,w:8.4,d:7.8,h:3.75,rot:-Math.PI/2,sign:'姻缘堂'});
  house({id:'flower',x:-13,z:8,w:8.4,d:7.8,h:3.7,rot:Math.PI/2,sign:'花间集'});
  // The hall is set further south, with a paved approach at z -31.
  house({id:'temple',x:0,z:-43.5,w:14,d:10,h:5,rot:0,sign:'月老殿'});
  // Destination architecture, kept away from walking lanes.
  house({id:'north',x:-16,z:55,w:9.5,d:7.3,h:3.85,rot:Math.PI/2,sign:'听雪亭'});
  house({id:'west',x:-45,z:-23,w:9.5,d:7.3,h:3.85,rot:Math.PI/2,sign:'竹书馆'});
  house({id:'east',x:44,z:-55,w:9.3,d:7.3,h:3.85,rot:-Math.PI/2,sign:'东廊'});
  house({id:'south',x:0,z:-88.5,w:11,d:6.7,h:3.85,rot:0,sign:'旧梦驿'});
  // Gate: columns and horizontal portal; no giant building roof in player's face.
  for(const side of [-1,1]){
    block(worldGroup,.45,4.2,.45,materials.timber,side*5.4,2.1,27);
    block(worldGroup,.81,.22,.81,materials.bronze,side*5.4,4.2,27);
  }
  block(worldGroup,11.6,.38,.7,materials.timber,0,4.55,27);
  const gateSign=plaque('月下灯火',4.6);
  gateSign.position.set(0,3.93,27.43);worldGroup.add(gateSign);
  // Two rows of classic lanterns, no dozens of strong overlapping lights.
  function lanternPost(x,z,lit=false) {
    block(worldGroup,.14,3.6,.14,materials.timber,x,1.8,z);
    const shell=new THREE.Mesh(new THREE.SphereGeometry(.29,12,10),materials.lantern);
    shell.scale.set(.9,1.2,.9);shell.position.set(x,3.47,z);worldGroup.add(shell);
    block(worldGroup,.42,.07,.42,materials.bronze,x,3.83,z);
    if(lit){
      const bulb=new THREE.PointLight(0xffac77,3.2,10,2);
      bulb.position.set(x,3.55,z);worldGroup.add(bulb);lanternLights.push(bulb);
    }
  }
  for(const z of [-28,-17,-5,6,19]){
    for(const side of [-1,1])lanternPost(side*5.9,z,(z===-17||z===6));
  }
  for(const [x,z] of [[-31,19],[31,19],[-31,-29],[31,-29],[-31,-55],[31,-55],[0,53],[0,-74]]){
    lanternPost(x,z,false);
  }
  const lake={x:50,z:-21,r:12.1};
  const lakeShape=new THREE.Mesh(new THREE.CircleGeometry(lake.r,64),materials.lake);
  lakeShape.rotation.x=-Math.PI/2;lakeShape.position.set(lake.x,-.095,lake.z);
  worldGroup.add(lakeShape);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(lake.r+.15,.22,7,64),materials.rock);
  rim.rotation.x=-Math.PI/2;rim.position.set(lake.x,.055,lake.z);worldGroup.add(rim);
  // Benches/flowers near, not on, roads.
  function tree(x,z,type='evergreen'){
    const g=new THREE.Group();g.position.set(x,0,z);worldGroup.add(g);
    block(g,.26,3.6,.26,materials.timber,0,1.8,0);
    const mat=type==='blossom'?materials.blossom:materials.foliage;
    for(let i=0;i<(low?7:12);i++){
      const a=rand()*Math.PI*2,r=rand()*1.7;
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.75+rand()*.45,1),mat);
      crown.position.set(Math.cos(a)*r,3+rand()*2.15,Math.sin(a)*r);g.add(crown);
    }
    obstacles.push({type:'circle',x,z,r:1.5});
  }
  for(const [x,z,type] of [[-20,20,'blossom'],[21,20,'evergreen'],[-43,-7,'evergreen'],
    [-43,-37,'blossom'],[43,-7,'blossom'],[43,-40,'evergreen'],[-17,59,'evergreen'],[17,58,'blossom']]){
    tree(x,z,type);
  }
  // The main stars still sit in the sky; keep the skyline clean without cone mountains.
  const floaters=[];
  for(let i=0;i<(low?5:9);i++){
    const a=rand()*Math.PI*2,r=3+rand()*8;
    const g=new THREE.Group();g.position.set(lake.x+Math.cos(a)*r,.03,lake.z+Math.sin(a)*r);
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(.21,.28,.17,10),materials.red);g.add(shell);
    const core=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),materials.lantern);
    core.position.y=.16;g.add(core);worldGroup.add(g);
    floaters.push({g,y:.03,phase:rand()*6.28});
  }
  // Footpath rules: player cannot leave the stones, enter closed buildings or walk across lake.
  const playerRadius=.42;
  function inRoad(x,z){
    return roads.some(r=>Math.abs(x-r.x)<=r.w/2-playerRadius*.62&&Math.abs(z-r.z)<=r.d/2-playerRadius*.62)||
      plazas.some(p=>Math.hypot(x-p.x,z-p.z)<=p.r-playerRadius*.35);
  }
  function inHouse(x,z,house){
    const dx=x-house.x,dz=z-house.z,s=Math.sin(house.rot),c=Math.cos(house.rot);
    const localX=dx*c-dz*s,localZ=dx*s+dz*c;
    return Math.abs(localX)<=house.w/2+playerRadius&&Math.abs(localZ)<=house.d/2+playerRadius;
  }
  function canWalk(x,z){
    if(x<extent.minX||x>extent.maxX||z<extent.minZ||z>extent.maxZ)return false;
    if(Math.hypot(x-lake.x,z-lake.z)<lake.r+playerRadius)return false;
    if(!inRoad(x,z))return false;
    for(const house of houses)if(inHouse(x,z,house))return false;
    for(const o of obstacles)if(Math.hypot(x-o.x,z-o.z)<o.r+playerRadius)return false;
    return true;
  }
  const door={x:-7.6,z:-5,insideX:0,insideZ:-130};
  return {
    extent,nav,houses,door,lake,
    canWalk,
    isNearTea:(x,z)=>Math.hypot(x-door.x,z-door.z)<2.6,
    mapLayout:{roads,plazas,lake},
    stats:{districts:4,buildings:houses.length,roads:roads.length,plazas:plazas.length,trees:8,collisions:true,walkableSurface:'roads and plazas',hasPortal:true},
    update(t){
      for(const f of floaters){
        f.g.position.y=f.y+.045*Math.sin(t*.75+f.phase);
        f.g.rotation.y=Math.sin(t*.34+f.phase)*.1;
      }
    },
  };
}
