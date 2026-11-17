import * as THREE from 'three';

/** Single fully navigable tea room with physical boundaries and exit trigger.
 * Interior is a separate pocket scene in the same WebGL world (scene transition),
 * not the exterior shop's unmodeled shell.
 */
export function createTeaInterior(scene,{door,low=false}={}) {
  const root=new THREE.Group();
  root.name='TingYue_TeaHouse_Interior';
  root.position.set(0,0,-130);
  root.visible=false;
  scene.add(root);
  const mats={
    wood:new THREE.MeshStandardMaterial({color:0x654b40,roughness:.84}),
    trim:new THREE.MeshStandardMaterial({color:0x9c7550,roughness:.68}),
    plaster:new THREE.MeshStandardMaterial({color:0xbeb0a2,roughness:.95}),
    roof:new THREE.MeshStandardMaterial({color:0x493f45,roughness:.92}),
    linen:new THREE.MeshStandardMaterial({color:0xc6ac8a,roughness:.92}),
    tea:new THREE.MeshStandardMaterial({color:0x506b62,roughness:.4,metalness:.16}),
    ceramics:new THREE.MeshStandardMaterial({color:0x97a8a0,roughness:.25,metalness:.1}),
    lamp:new THREE.MeshBasicMaterial({color:0xf2b973,toneMapped:false}),
    reed:new THREE.MeshStandardMaterial({color:0x586b59,roughness:.98}),
  };
  const floorY=.035;
  function box(w,h,d,x,y,z,material=mats.wood,parent=root){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cylinder(top,bottom,height,x,y,z,mat,seg=12) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,seg),mat);
    mesh.position.set(x,y,z);root.add(mesh);return mesh;
  }
  // x[-5.5,+5.5], local z[-5,+5] — door at local +5.
  box(11,.23,10,0,-.10,0,mats.wood);
  for(let x=-5;x<5;x+=1.15)box(.055,.04,10,x,.045,0,mats.trim);
  box(11,4.8,.28,0,2.4,-4.9,mats.plaster);
  for(const side of [-1,1])box(.28,4.8,10,side*5.43,2.4,0,mats.plaster);
  // Segmented entry wall with real door opening (x +-1.3)
  for(const side of [-1,1]){
    box(4.2,4.8,.28,side*3.4,2.4,4.95,mats.plaster);
    box(.25,4.0,.32,side*1.3,2.0,4.92,mats.trim);
  }
  box(2.6,2.08,.29,0,3.77,4.95,mats.plaster);
  box(11,.25,10,0,4.92,0,mats.roof);
  for(const side of [-1,1])for(const z of [-4.5,4.5]){
    box(.24,4.8,.24,side*5.18,2.4,z,mats.wood);
  }
  for(const x of [-3.2,3.2]){
    box(2.05,1.9,.055,x,2.50,-4.73,mats.linen);
    for(const xx of [-.7,0,.7]){
      box(.055,1.85,.11,x+xx,2.5,-4.68,mats.wood);
    }
    for(const y of [1.6,2.3,3.25])box(2.15,.06,.10,x,y,-4.66,mats.wood);
  }
  // Tea counter with actual props. These objects will also be obstacles.
  const counter={x:3.2,z:-1.25,w:2.45,d:1.20};
  box(counter.w,.85,counter.d,counter.x,.43,counter.z,mats.wood);
  box(2.55,.12,1.32,counter.x,.91,counter.z,mats.trim);
  for(let i=0;i<3;i++){
    cylinder(.32,.36,.32,2.45+i*.65,1.15,-1.25,mats.ceramics,13);
    cylinder(.13,.13,.12,2.45+i*.65,1.32,-1.25,mats.tea,13);
  }
  for(const [x,z] of [[-2.4,-2.3],[-1.9,1.3]]){
    cylinder(.8,.75,.14,x,.73,z,mats.trim,18);
    cylinder(.16,.23,.70,x,.36,z,mats.wood,12);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const px=x+Math.sin(a)*1.15,pz=z+Math.cos(a)*1.15;
      cylinder(.30,.33,.43,px,.27,pz,mats.wood);
    }
    cylinder(.19,.22,.14,x,.91,z,mats.ceramics,12);
  }
  for(const z of [-3,-1.45,.1,1.65,3.2]){
    box(.14,3.55,.85,-4.95,2.00,z,mats.wood);
  }
  for(let j=0;j<4;j++)box(.9,.18,3.7,-4.77,.8+j*.78,0,mats.trim);
  for(let j=0;j<11;j++){
    const z=-1.7+j*.33;
    box(.65,.47,.085,-4.66,1.14+(j%3)*.75,z,(j%2?mats.linen:mats.tea));
  }
  // Warm interior lighting stays with the room, independently from street lighting.
  const light=new THREE.PointLight(0xffd8a3,low?4:6,15,2);
  light.position.set(0,3.55,0);root.add(light);
  const lantern=new THREE.Mesh(new THREE.SphereGeometry(.36,14,12),mats.lamp);
  lantern.position.set(0,3.57,0);root.add(lantern);
  const lanternTop=box(.61,.07,.61,0,3.94,0,mats.trim);
  const decorative=new THREE.Mesh(new THREE.PlaneGeometry(2.8,1.1),
    new THREE.MeshBasicMaterial({color:0xd7b483,side:THREE.DoubleSide}));
  decorative.position.set(0,3.0,-4.69);root.add(decorative);

  const interiorCenterZ=-130;
  const entry={x:0,z:-127.0};
  const exitThreshold={x:0,z:-125.75};
  const external={x:door.x,z:door.z};
  let inside=false,nearEntrance=false;
  const prompt=document.querySelector('#roomPrompt');
  const exit=document.querySelector('#roomExit');
  const banner=document.querySelector('#roomBanner');
  const canMove=(x,z)=>{
    if(Math.abs(x)>5.0||z<interiorCenterZ-4.30||z>interiorCenterZ+4.0)return false;
    const localZ=z-interiorCenterZ;
    // Counter + seating collision; keep a continuous circulation path.
    if(Math.abs(x-3.2)<1.6&&Math.abs(localZ+1.25)<.96)return false;
    for(const [tx,tz] of [[-2.4,-2.3],[-1.9,1.3]]){
      if(Math.hypot(x-tx,localZ-tz)<.85)return false;
    }
    return true;
  };
  function arriveAt(player,cameraRig,x,z,face) {
    player.position.set(x,0,z);player.setHeading(face);
    cameraRig.setIndoor(inside);
    cameraRig.setOrientation(face,.29);cameraRig.snap();
  }
  function enter(player,cameraRig) {
    inside=true;root.visible=true;
    arriveAt(player,cameraRig,entry.x,entry.z,0);
    prompt.hidden=true;exit.hidden=false;
    banner.textContent='听月茶馆 · 真实室内空间';banner.hidden=false;
  }
  function leave(player,cameraRig){
    inside=false;root.visible=false;
    arriveAt(player,cameraRig,external.x,external.z,-Math.PI/2);

    exit.hidden=true;banner.hidden=true;
  }
  function update(player) {
    nearEntrance=!inside&&Math.hypot(player.position.x-door.x,player.position.z-door.z)<2.45;
    prompt.hidden=!nearEntrance;
    if(inside) {
      const n=Math.hypot(player.position.x-exitThreshold.x,player.position.z-exitThreshold.z);
      exit.textContent=n<2.3?'出门 · E':'返回灯火巷 · E';
    }
  }
  return {
    get inside(){return inside},
    get nearEntrance(){return nearEntrance},
    entry,exitThreshold,external,
    enter,leave,update,canMove,
    stats:{name:'听月茶馆',walkableInterior:true,hasFurnitureCollision:true,entry:'portal'},
  };
}
