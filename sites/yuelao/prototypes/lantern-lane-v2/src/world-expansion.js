import * as THREE from 'three';

/**
 * Lantern Lane V2.3 — connected district extension, isolated prototype.
 * Existing original lane & all story logic stay untouched.
 * Coordinates are arbitrary world units, NOT surveyed real-world metres.
 */
export function createExpandedDistricts(scene,{
  makeBuilding, pathMaterial, lanternLights, low=false
}) {
  const extent={minX:-66,maxX:66,minZ:-93,maxZ:73};
  const locations={
    north: {x:0,z:53, label:'望月台'},
    grove: {x:-33,z:-21,label:'竹影庭'},
    lake: {x:32,z:-22,label:'星愿湖'},
    station: {x:0,z:-74,label:'旧梦驿'},
  };
  const mats={
    walkway:pathMaterial,
    stone:new THREE.MeshStandardMaterial({color:0x5c6070,roughness:.92}),
    stoneEdge:new THREE.MeshStandardMaterial({color:0x373c48,roughness:.86}),
    gilt:new THREE.MeshStandardMaterial({color:0xa98a62,metalness:.43,roughness:.54}),
    timber:new THREE.MeshStandardMaterial({color:0x48333a,roughness:.88}),
    roof:new THREE.MeshStandardMaterial({color:0x454954,roughness:.88}),
    pale:new THREE.MeshStandardMaterial({color:0xc4b2a1,roughness:.95}),
    lantern:new THREE.MeshStandardMaterial({color:0xf9b071,emissive:0xe6884e,emissiveIntensity:.8,roughness:.8}),
    paper:new THREE.MeshStandardMaterial({color:0x9c4245,emissive:0x3d171b,emissiveIntensity:.22,roughness:.83,side:THREE.DoubleSide}),
    water:new THREE.MeshPhysicalMaterial({color:0x244860,metalness:.52,roughness:.21,clearcoat:.8,clearcoatRoughness:.17,transparent:true,opacity:.95}),
    leaf:new THREE.MeshStandardMaterial({color:0x536d60,roughness:1}),
    bamboo:new THREE.MeshStandardMaterial({color:0x506a56,roughness:.94}),
    blush:new THREE.MeshStandardMaterial({color:0xbb8592,roughness:.93}),
  };
  let rng=48129;const rnd=()=>((rng=(rng*1664525+1013904223)>>>0)/4294967296);
  const dynamic=[],landmarkLabels=[],lampCountBefore=lanternLights.length;
  const mapRoads=[],mapPlazas=[];
  function geoBox(w,h,d,x,y,z,mat,parent=scene){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;
  }
  function geoPlane(w,d,x,z,mat=mats.walkway,y=.032){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
    m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);return m;
  }
  function pathRect(x,z,w,d){
    mapRoads.push({x,z,w,d});
    geoPlane(w,d,x,z);
    // Subtle stone seams to make secondary roads actually read as routes.
    if(w<d){for(const side of [-1,1])geoBox(.18,.1,d,x+side*(w/2+.06),.045,z,mats.stoneEdge)}
    else{for(const side of [-1,1])geoBox(w,.1,.18,x,.045,z+side*(d/2+.06),mats.stoneEdge)}
  }
  function disk(x,z,r,mat=mats.walkway){
    mapPlazas.push({x,z,r});
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.12,48),mat);
    m.position.set(x,.04,z);m.receiveShadow=true;scene.add(m);return m;
  }
  // A real connected network: north gate → east/west promenade → southern plaza.
  // Branches form a loop around the existing Yue Lao Temple; no isolated islands.
  pathRect(0,46,11.5,43);
  pathRect(0,18,71,10);
  pathRect(-33,-23.5,9.6,83);
  pathRect(33,-23.5,9.6,83);
  pathRect(0,-55,71,9.6);
  pathRect(0,-70,11.2,34);
  disk(0,54,12.5);disk(-33,-20,12);disk(33,-20,11.4);disk(0,-73,13.5);
  for(const [x,z,w,d] of [[-14,55,19,7],[14,55,19,7],[-46,-20,17,7],[46,-20,17,7],[0,-85,12,9]]){
    geoPlane(w,d,x,z);
  }
  // Plaza mosaic: low-poly emblem rings (single mesh per circle, negligible cost).
  for(const [x,z,r] of [[0,54,7.3],[-33,-20,6.4],[33,-20,6.5],[0,-73,8.2]]){
    const ring=new THREE.Mesh(new THREE.RingGeometry(r-.20,r,64),mats.gilt);
    ring.rotation.x=-Math.PI/2;ring.position.set(x,.116,z);scene.add(ring);
  }
  // Outside the old lane, distinct Song-style anchors. Performance: 3/5 on mobile/desktop.
  const specs=[
    ['north-teahouse',[-17,0,56],'pavilion',10.5,7.8,1,Math.PI/2],
    ['east-gallery',[43,0,-52],'pavilion',11.3,8.1,1,-Math.PI/2],
    ['west-library',[-46,0,-43],'xieshan',10.8,7.7,1,Math.PI/2],
    ['south-station',[0,0,-88],'xieshan',13.3,8.8,1,0],
    ['north-archive',[18,0,57],'xieshan',8.4,6.1,1,-Math.PI/2],
  ];
  for(const [i,record] of specs.entries()){
    if(low && (i===2 || i===4))continue;
    const [name,pos,type,width,depth,stories,rotation]=record;
    makeBuilding(name,pos,type,width,depth,stories,rotation);
  }

  // The Moon Lake is an actual scenic destination with walkable shore path.
  const lakeCenter={x:50,z:-21,r:13.8};
  const water=new THREE.Mesh(new THREE.CircleGeometry(lakeCenter.r,72),mats.water);
  water.rotation.x=-Math.PI/2;water.position.set(lakeCenter.x,-.1,lakeCenter.z);scene.add(water);
  const outerRim=new THREE.Mesh(new THREE.TorusGeometry(14.15,.35,7,72),mats.stone);
  outerRim.rotation.x=-Math.PI/2;outerRim.position.set(lakeCenter.x,.045,lakeCenter.z);scene.add(outerRim);
  for(const i of [-1,1]){
    // Side promenades lead to the north/south shores.
    geoPlane(3.8,8.6,50,-21+i*20,mats.walkway,.04);
  }
  const starRing=new THREE.Mesh(new THREE.RingGeometry(1.9,2.05,40),mats.gilt);
  starRing.rotation.x=-Math.PI/2;starRing.position.set(50,-.045,-21);scene.add(starRing);
  // Floating lanterns as delicate objects, no physically costly screen-wide bloom.
  const floaters=[];
  for(let i=0;i<(low?7:15);i++){
    const a=rnd()*Math.PI*2,rad=2.7+rnd()*10.2,x=50+Math.cos(a)*rad,z=-21+Math.sin(a)*rad;
    const g=new THREE.Group();g.position.set(x,.03,z);scene.add(g);
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.23,.34,.13,8),mats.paper);g.add(cup);
    const core=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),mats.lantern);
    core.position.y=.13;g.add(core);floaters.push({group:g,phase:rnd()*6.3,y:.03});
  }
  // Render a small wooden bridge at the far eastern bank.
  geoBox(4.4,.29,6,37.2,.25,-27.2,mats.timber);
  for(const x of [35.25,39.15]){
    for(const z of [-29.7,-27.2,-24.7])geoBox(.11,1.15,.12,x,.7,z,mats.timber);
    geoBox(.15,.12,6.2,x,1.3,-27.2,mats.gilt);
  }

  // Western bamboo grove: two InstancedMesh types, not hundreds of unique meshes.
  const bambooCount=low?55:115;
  const stalks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.047,.068,1,7),mats.bamboo,bambooCount);
  const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.48,0),mats.leaf,bambooCount);
  const dummy=new THREE.Object3D();
  for(let i=0;i<bambooCount;i++){
    let x=-59+rnd()*22,z=-51+rnd()*72;
    if(Math.abs(x+33)<7.3) x=-50-rnd()*8;
    const h=2.5+rnd()*3.8;
    dummy.position.set(x,h/2,z);dummy.scale.set(1,h,1);dummy.rotation.set(0,rnd()*6.28,0);dummy.updateMatrix();stalks.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,h-.15,z);dummy.scale.set(1.2+rnd()*.85,.65+rnd()*.5,1.1+rnd());dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  }
  stalks.instanceMatrix.needsUpdate=true;leaves.instanceMatrix.needsUpdate=true;
  scene.add(stalks,leaves);

  // Distant garden trees as instancing (visual enclosure without blocking walking).
  const treeCount=low?42:94,treeGeo=new THREE.ConeGeometry(1.6,3.7,7);
  const treeMat=new THREE.MeshStandardMaterial({color:0x435666,roughness:.99});
  const grove=new THREE.InstancedMesh(treeGeo,treeMat,treeCount);
  for(let i=0;i<treeCount;i++){
    let x,z;
    if(i%3===0){x=(rnd()-.5)*146;z=74+rnd()*9}
    else if(i%3===1){x=(rnd()-.5)*146;z=-91-rnd()*14}
    else{x=rnd()>.5?70+rnd()*9:-70-rnd()*9;z=-92+rnd()*174}
    const h=3.5+rnd()*6;
    dummy.position.set(x,h/2-.24,z);dummy.scale.set(.8+rnd()*.9,h/3.7,.8+rnd()*.9);dummy.rotation.y=rnd()*6.28;dummy.updateMatrix();
    grove.setMatrixAt(i,dummy.matrix);
  }
  grove.instanceMatrix.needsUpdate=true;scene.add(grove);

  // Structural lamps add landmarks + follow the player by the existing light-pool manager.
  function poleLamp(x,z,y=3.5,point=false){
    geoBox(.10,y,.10,x,y/2,z,mats.timber);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.28,.3,.52,10),mats.paper);
    c.position.set(x,y+.16,z);scene.add(c);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),mats.lantern);
    lamp.position.set(x,y+.18,z);scene.add(lamp);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.05,10),mats.gilt);
    cap.position.set(x,y+.49,z);scene.add(cap);
    if(point){
      const light=new THREE.PointLight(0xffb87a,low?4.4:5.8,12,2);
      light.position.set(x,y,z);scene.add(light);
      lanternLights.push(light);
    }
  }
  for(const z of [13,0,-13,-27,-40,-55]){
    poleLamp(-37.4,z,3.2,z===13||z===-27);
    poleLamp(37.4,z,3.2,z===13||z===-27);
  }
  for(const x of [-26,-12,12,26]){
    poleLamp(x,19,3.2,x===-26||x===26);
    poleLamp(x,-55,3.2,x===-12||x===12);
  }
  for(const x of [-6,6]){
    poleLamp(x,57,3.8,x===-6);
    poleLamp(x,-72,3.7,x===6);
  }
  // Flowered arbor arches and timber fences at scenic plazas.
  function pergola(x,z,rot=0){
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);
    for(const a of [-3.2,3.2])for(const b of [-2.6,2.6]){
      geoBox(.26,3.2,.26,a,1.6,b,mats.timber,g);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.30,.34,.30,9),mats.stone);
      foot.position.set(a,.14,b);g.add(foot);
    }
    for(const b of [-2.7,0,2.7])geoBox(7.3,.17,.22,0,3.28,b,mats.timber,g);
    for(const a of [-2.4,-.8,.8,2.4])geoBox(.12,.13,6,a,3.43,0,mats.gilt,g);
    for(const [a,b] of [[-2.8,-2.15],[2.8,-2.15],[-2.8,2.15],[2.8,2.15]]){
      const blossom=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,1),mats.blush);
      blossom.position.set(a,3.8,b);g.add(blossom);
    }
  }
  pergola(-33,-20,0);pergola(33,-20,Math.PI/2);pergola(0,-73,0);

  // Five soft direction markers help visitors follow new paths without teleporting.
  const plaques=[
    ['竹影庭',-33,-10],['星愿湖',33,-10],['望月台',0,48],['旧梦驿',0,-64]
  ];
  const signMaterials=new Map();
  function signMat(label){
    if(signMaterials.has(label))return signMaterials.get(label);
    const c=document.createElement('canvas');c.width=256;c.height=92;const g=c.getContext('2d');
    g.fillStyle='#47343c';g.fillRect(0,0,256,92);
    g.strokeStyle='#caa26f';g.lineWidth=4;g.strokeRect(5,5,246,82);
    g.fillStyle='#efdbb5';g.textAlign='center';g.textBaseline='middle';
    g.font='600 42px "Noto Serif SC",serif';g.fillText(label,128,49);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});
    signMaterials.set(label,m);return m;
  }
  for(const [label,x,z] of plaques){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.8,1),signMat(label));
    mesh.position.set(x,2.6,z);mesh.rotation.y=(x<0)?Math.PI/2:(x>0)?-Math.PI/2:0;scene.add(mesh);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,2.2,8),mats.timber);
    beam.position.set(x,1.1,z);scene.add(beam);landmarkLabels.push(label);
  }

  // The lake is not a walkable surface. Other districts remain freely traversable.
  function canWalk(x,z){
    if(x<extent.minX||x>extent.maxX||z<extent.minZ||z>extent.maxZ)return false;
    const dx=x-lakeCenter.x,dz=z-lakeCenter.z;
    return dx*dx+dz*dz > Math.pow(lakeCenter.r+1.0,2);
  }
  return {
    extent, locations, lakeCenter, canWalk,
    mapLayout:{roads:mapRoads,plazas:mapPlazas,lake:lakeCenter},
    stats:{ districts:4, additionalBuildings:low?3:5, bamboo:bambooCount, trees:treeCount, newLightCandidates:lanternLights.length-lampCountBefore, paths:6, lanternBoats:floaters.length },
    update(t){
      for(let i=0;i<floaters.length;i++){
        const f=floaters[i];
        f.group.position.y=f.y+Math.sin(t*.72+f.phase)*.045;
        f.group.rotation.y=Math.sin(t*.3+f.phase)*.14;
      }
    }
  };
}
