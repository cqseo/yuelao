import * as THREE from 'three';

/**
 * Yuexia V2.1: streamlined architecture and atmosphere.
 * Artwork is assembled from lightweight planes, instanced foliage, and a few
 * geometry ornaments. This file is preview-only and does not touch the live site.
 */
export function addStreetDetails(scene,{low=false}={}) {
  const charcoal=new THREE.MeshStandardMaterial({color:0x372b30,roughness:.86});
  const reddish=new THREE.MeshStandardMaterial({color:0x7d3537,roughness:.76});
  const bronze=new THREE.MeshStandardMaterial({color:0xc5a372,metalness:.42,roughness:.52});
  const paleGold=new THREE.MeshBasicMaterial({color:0xe9c994,toneMapped:false,side:THREE.DoubleSide});
  const silk=new THREE.MeshStandardMaterial({color:0xa64242,roughness:.72,side:THREE.DoubleSide});
  let seed=67363;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const staticRoots=[];
  function addBox(parent,w,h,d,material,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function attachShop(x,z,rotation,floors,name) {
    const group=new THREE.Group();
    group.position.set(x,0,z);group.rotation.y=rotation;scene.add(group);
    const front=3.58;
    for(let floor=0;floor<floors;floor++){
      const offset=floor*3.65;
      for(let xpos of [-3.35,-1.7,1.7,3.35]) {
        addBox(group,.16,3.0,.22,charcoal,xpos,2.1+offset,front+.14);
        addBox(group,.38,.21,.48,bronze,xpos,3.82+offset,front+.14);
      }
      addBox(group,7.95,.17,.42,charcoal,0,3.95+offset,front+.13);
      addBox(group,8.05,.045,.44,bronze,0,4.04+offset,front+.13);
      const positions=floor===0?[-2.55,2.55]:[-2.6,0,2.6];
      for(let q of positions){
        const m=new THREE.Mesh(new THREE.PlaneGeometry(1.74,1.63),windowMat);
        m.position.set(q,2.23+offset,front+.275);group.add(m);
      }
    }
    addBox(group,1.8,2.48,.04,charcoal,0,1.95,front+.3);
    addBox(group,1.68,2.34,.08,reddish,0,1.95,front+.39);
    for(let side of [-1,1]){
      addBox(group,.59,2.19,.06,reddish,side*.35,1.97,front+.46);
      addBox(group,.07,2.45,.13,bronze,side*.86,1.95,front+.44);
      addBox(group,.04,2.42,.13,bronze,side*.05,1.95,front+.50);
      addBox(group,.22,.08,.11,bronze,side*.16,2.0,front+.55);
    }
    const shopSign=makeSign(name);
    shopSign.position.set(0,3.33,front+.39);
    group.add(shopSign);
    // Lantern shells are both shaded and visibly lit (no expensive point lights).
    for(const side of [-1,1]){
      const lx=side*1.23;
      addBox(group,.035,.43,.035,bronze,lx,3.61,front+.69);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.32,12,10),lanternMat);
      lamp.scale.set(.83,1.16,.83);lamp.position.set(lx,3.2,front+.69);group.add(lamp);
      addBox(group,.43,.055,.43,bronze,lx,3.57,front+.69);
      addBox(group,.43,.055,.43,bronze,lx,2.85,front+.69);
      addBox(group,.015,.29,.015,bronze,lx,2.65,front+.69);
    }
    staticRoots.push(group);return group;
  }

  const can=document.createElement('canvas');can.width=256;can.height=256;
  const c=can.getContext('2d');
  const light=c.createRadialGradient(128,150,15,128,128,170);
  light.addColorStop(0,'#ffda99');light.addColorStop(.5,'#eaa969');light.addColorStop(1,'#84533e');
  c.fillStyle=light;c.fillRect(0,0,256,256);
  c.strokeStyle='#422a2e';c.lineWidth=13;c.strokeRect(12,8,232,240);
  c.fillStyle='#3d2b32';c.fillRect(115,12,19,232);
  for(let x=44;x<=212;x+=42){c.fillStyle='#55383a';c.fillRect(x,12,7,232)}
  for(let y=39;y<=233;y+=40){c.fillStyle='#543940';c.fillRect(15,y,225,7)}
  c.strokeStyle='rgba(236,202,150,.8)';c.lineWidth=3;
  for(let q=0;q<4;q++){
    const x=(q%2)*117+21,y=Math.floor(q/2)*123+15;
    c.beginPath();c.moveTo(x+10,y+10);c.lineTo(x+103,y+103);c.moveTo(x+103,y+10);c.lineTo(x+10,y+103);c.stroke();
  }
  const windowTexture=new THREE.CanvasTexture(can);windowTexture.colorSpace=THREE.SRGBColorSpace;
  const windowMat=new THREE.MeshBasicMaterial({map:windowTexture,side:THREE.DoubleSide,toneMapped:false});
  const lanternMat=new THREE.MeshStandardMaterial({color:0xd47f53,emissive:0xf28d45,emissiveIntensity:.62,roughness:.82});
  const signs=new Map();
  function makeSign(text){
    if(!signs.has(text)){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=156;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#4b292c';ctx.fillRect(0,0,512,156);
      ctx.strokeStyle='#c49a62';ctx.lineWidth=8;ctx.strokeRect(10,10,492,136);
      ctx.fillStyle='#f3d6a3';ctx.font='600 82px "Noto Serif SC","Songti SC",serif';
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,84);
      const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
      signs.set(text,new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
    }
    return new THREE.Mesh(new THREE.PlaneGeometry(1.86,.57),signs.get(text));
  }

  for(const [x,z,rot,floors,label] of [
    [-10,-.5,Math.PI/2,1,'茶肆'],[10,-1.5,-Math.PI/2,2,'红笺'],
    [-10,-14.5,Math.PI/2,2,'书屋'],[10,-14,-Math.PI/2,1,'姻缘'],
    [-10,-26.5,Math.PI/2,1,'药香'],[10,-26,-Math.PI/2,1,'许愿'],
  ]) attachShop(x,z,rot,floors,label);

  const temple=new THREE.Group();temple.position.set(0,0,-39);scene.add(temple);
  for(const x of [-5.3,-3.2,3.2,5.3]){
    addBox(temple,.18,4.3,.2,charcoal,x,3.45,5.37);
    addBox(temple,.48,.19,.52,bronze,x,5.67,5.4);
  }
  for(const x of [-5.2,5.2]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(2,1.8),windowMat);
    m.position.set(x,3.05,5.56);temple.add(m);
  }
  for(const x of [-4.15,4.15]){
    const fabric=new THREE.Mesh(new THREE.PlaneGeometry(.75,1.8),silk);
    fabric.position.set(x,4.4,5.67);temple.add(fabric);
  }

  const plantGeometry=new THREE.IcosahedronGeometry(.36,1);
  const branchMaterial=new THREE.MeshStandardMaterial({color:0x43323c,roughness:1});
  const pinkMats=[
    new THREE.MeshStandardMaterial({color:0xd3a5b1,roughness:1}),
    new THREE.MeshStandardMaterial({color:0xf2c5cc,roughness:1}),
  ];
  const forestPositions=[[-15,9,.9],[16,-11,1],[-16,-20,1.1],[16,-32,1.15]];
  for(const [x,z,scale] of forestPositions){
    const tree=new THREE.Group();tree.position.set(x,0,z);tree.scale.setScalar(scale);scene.add(tree);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.34,4.8,8),branchMaterial);
    trunk.position.y=2.4;tree.add(trunk);
    for(let i=0;i<12;i++){
      const ang=random()*Math.PI*2,h=3.3+random()*2.3,r=1.8+random()*2.1;
      const tip=new THREE.Vector3(Math.cos(ang)*r,h,Math.sin(ang)*r);
      const dir=tip.clone().sub(new THREE.Vector3(0,3.2,0));
      const m=new THREE.Mesh(new THREE.CylinderGeometry(.035,.095,dir.length(),6),branchMaterial);
      m.position.copy(tip.clone().add(new THREE.Vector3(0,3.2,0)).multiplyScalar(.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());tree.add(m);
    }
    const n=low?25:55;
    for(let layer=0;layer<2;layer++){
      const inst=new THREE.InstancedMesh(plantGeometry,pinkMats[layer],n);
      const tmp=new THREE.Object3D();
      for(let i=0;i<n;i++){
        const angle=random()*Math.PI*2,radius=.7+random()*3.4;
        tmp.position.set(Math.cos(angle)*radius,3.7+random()*2.6,Math.sin(angle)*radius);
        tmp.scale.setScalar(.28+random()*.9);tmp.rotation.set(random()*2,random()*6,random()*2);
        tmp.updateMatrix();inst.setMatrixAt(i,tmp.matrix);
      }
      inst.instanceMatrix.needsUpdate=true;tree.add(inst);
    }
  }
  // Low reflective patches: use a handful of low-cost transparent planes.
  const wetMaterial=new THREE.MeshPhysicalMaterial({color:0x283947,metalness:.28,roughness:.23,transparent:true,opacity:.31,depthWrite:false,clearcoat:.9});
  for(let i=0;i<(low?7:13);i++){
    const patch=new THREE.Mesh(new THREE.CircleGeometry(.45+random()*.7,12),wetMaterial);
    patch.rotation.x=-Math.PI/2;patch.scale.y=.35+random()*.35;
    patch.position.set((random()-.5)*7.6,.037,-32+random()*55);scene.add(patch);
  }

  const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=128;
  const ctx=fogCanvas.getContext('2d'),fogGradient=ctx.createRadialGradient(64,64,4,64,64,64);
  fogGradient.addColorStop(0,'rgba(190,202,223,.24)');fogGradient.addColorStop(1,'rgba(190,202,223,0)');
  ctx.fillStyle=fogGradient;ctx.fillRect(0,0,128,128);
  const fogTexture=new THREE.CanvasTexture(fogCanvas);const fogSprites=[];
  for(let i=0;i<(low?3:6);i++){
    const fog=new THREE.Sprite(new THREE.SpriteMaterial({map:fogTexture,transparent:true,opacity:.2,depthWrite:false}));
    fog.position.set((random()-.5)*35,1+random(),-27+random()*40);
    fog.scale.set(16+random()*15,5+random()*2,1);scene.add(fog);fogSprites.push(fog);
  }
  return {
    shopCount:6,floweringTrees:4,wetPatches:low?7:13,drawGroups:0,
    tick(t){
      for(let i=0;i<fogSprites.length;i++)
        fogSprites[i].position.x+=Math.sin(t*.2+i)*.0003;
    },
  };
}
