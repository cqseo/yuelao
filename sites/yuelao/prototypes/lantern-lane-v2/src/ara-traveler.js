import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTraveler } from './traveler.js';

const MODEL_URL = './models/yuexia-ara-wanderer.glb';

/**
 * Yuexia player: real Ara 3D Gen / MakeHuman CC0 skinned 3D humanoid.
 * The GLB is generated from ara-traveler.params.json, separately from source.
 * Keep the previous geometry prototype only as a clearly reported offline fallback.
 */
export async function createAraTraveler(scene,{onStatus=()=>{},low=false}={}) {
  onStatus({status:'loading',source:'Ara 3D Gen',url:MODEL_URL});
  let gltf;
  try {
    gltf=await new GLTFLoader().loadAsync(MODEL_URL);
  } catch (e) {
    console.error('Ara 3D Gen traveler GLB could not be loaded; fallback active',e);
    const fallback=createTraveler(scene);
    onStatus({status:'fallback',source:'V2.4 procedural placeholder',error:String(e),url:MODEL_URL});
    return fallback;
  }

  const root=new THREE.Group();
  root.name='Yuexia_Ara3DGen_Player';
  scene.add(root);
  const visual=gltf.scene;
  visual.name='Ara3DGen_Traveler_Visual';
  root.add(visual);
  // Ara / MakeHuman standard faces +Z; Yuexia actor root forward is -Z.
  visual.rotation.y=Math.PI;
  visual.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(visual);
  const originalHeight=box.max.y-box.min.y;
  const scale=originalHeight>0.5?1.85/originalHeight:1;
  visual.scale.setScalar(scale);
  visual.position.y=-box.min.y*scale;

  let tris=0,draws=0,skins=0;
  visual.traverse(o=>{
    if(!o.isMesh)return;
    draws++;
    if(o.isSkinnedMesh)skins++;
    o.frustumCulled=false; // skinned animation bounds vary, avoid disappearance on slow WebGL
    o.renderOrder=60; // Render after world static meshes, keeping correct depth testing.
    const geo=o.geometry;
    tris+=geo.index?geo.index.count/3:(geo.attributes.position?.count||0)/3;
    o.castShadow=!low;
    o.receiveShadow=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){
      if(!m)continue;
      m.side=THREE.DoubleSide; // protects against winding differences from imported rig
      m.depthTest=true;m.depthWrite=true;
      m.needsUpdate=true;
      if(m.map)m.map.anisotropy=4;
    }
  });

  const mixer=new THREE.AnimationMixer(visual);
  const sourceClips=gltf.animations||[];
  const clip=(term)=>sourceClips.find(c=>c.name.toLowerCase()===term)||
      sourceClips.find(c=>c.name.toLowerCase().includes(term));
  const idleClip=clip('idle'),walkClip=clip('walk'),runClip=clip('run');
  const animations=new Map();
  for(const [name,c] of [['idle',idleClip],['walk',walkClip],['run',runClip]]){
    if(!c)continue;
    const action=mixer.clipAction(c);action.setLoop(THREE.LoopRepeat,Infinity);
    action.clampWhenFinished=false;
    animations.set(name,action);
  }
  let current='idle';
  animations.get('idle')?.play();
  if(!animations.has('idle')&&animations.has('walk')){current='walk';animations.get('walk').play();}
  let heading=0;
  const turnSpeed=10;
  function tick(t,dt,dx=0,dz=0,moving=false){
    const distance=Math.hypot(dx,dz);
    if(moving&&distance>1e-5){
      const target=Math.atan2(-dx,-dz);
      const d=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
      heading+=d*Math.min(1,turnSpeed*dt);
      root.rotation.y=heading;
    }
    const speed=distance/Math.max(.001,dt);
    const next=moving?(speed>6.2&&animations.has('run')?'run':'walk'):'idle';
    if(next!==current&&animations.has(next)){
      const prev=animations.get(current),now=animations.get(next);
      now.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
      now.play();
      if(prev)now.crossFadeFrom(prev,.25,true);
      current=next;
    }
    mixer.update(dt);
  }
  function setHeading(value){heading=value;root.rotation.y=value;}
  onStatus({
    status:'loaded',
    source:'Ara 3D Gen · MakeHuman CC0',
    bodyHeight:+originalHeight.toFixed(3),
    renderHeight:+((box.max.y-box.min.y)*scale).toFixed(3),
    triangles:Math.round(tris),
    meshes:draws,
    skinnedMeshes:skins,
    clipCount:sourceClips.length,
    clips:sourceClips.map(c=>c.name).slice(0,60),
    locomotion:[...animations.keys()],
    url:MODEL_URL
  });
  return {group:root,position:root.position,tick,setHeading,
    get heading(){return heading;},
    get currentAction(){return current;},
  };
}
