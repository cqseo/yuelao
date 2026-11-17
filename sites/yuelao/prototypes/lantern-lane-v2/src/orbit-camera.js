import * as THREE from 'three';

/**
 * Stable third-person follow rig, independent from player movement.
 * Aimed at the upper torso; angle and zoom clamped to prevent vertigo.
 * Collision blockers approximate solid buildings by authored bounding boxes.
 */
export function createFollowCamera(camera,player,{mobile=false}={}) {
  const state={yaw:-.03,pitch:.35,zoom:mobile?5.4:6.0,desiredZoom:mobile?5.4:6.0,clipped:false,mode:'third-person'};
  const target=new THREE.Vector3(),desired=new THREE.Vector3();
  const ray=new THREE.Ray(),tmpNear=new THREE.Vector3();
  // Boxes reflect the actual rebuilt V2.6 geometry; no stale V2.1 collision proxies.
  const buildings=[
    [-13,-5,7.8,8.4,6], [13,6,7.8,8.4,6],
    [-13,-21,7.8,8.4,6],[13,-22,7.8,8.4,6],
    [-13,8,7.8,8.4,6],[0,-43.5,14,10,7],
    [-16,55,7.3,9.5,6],[-45,-23,7.3,9.5,6],
    [44,-55,7.3,9.3,6],[0,-88.5,11,6.7,6],
  ];
  const blockers=buildings.map(([x,z,w,d,h])=>new THREE.Box3(
    new THREE.Vector3(x-w/2,-.1,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)
  ));
  let indoor=false;
  const actual=new THREE.Vector3();
  let initial=true;

  function setOrientation(yaw,pitch=.35) {
    state.yaw=yaw;
    state.pitch=THREE.MathUtils.clamp(pitch,.14,.64);
  }
  function rotate(dx,dy) {
    state.yaw=THREE.MathUtils.euclideanModulo(state.yaw-dx,Math.PI*2);
    state.pitch=THREE.MathUtils.clamp(state.pitch+dy,.14,.64);
  }
  function zoom(delta) {
    state.desiredZoom=THREE.MathUtils.clamp(state.desiredZoom+delta,3.65,7.65);
  }
  function update(dt,{snap=false}={}) {
    state.zoom+=(state.desiredZoom-state.zoom)*Math.min(1,dt*7);
    if(snap)state.zoom=state.desiredZoom;
    target.set(player.position.x,1.55,player.position.z);
    // Shoulder camera remains behind the character and above their head.
    const horizontal=Math.cos(state.pitch)*state.zoom;
    desired.set(
      target.x+Math.sin(state.yaw)*horizontal,
      target.y+Math.sin(state.pitch)*state.zoom,
      target.z+Math.cos(state.yaw)*horizontal
    );
    const lookRay=desired.clone().sub(target);
    const length=lookRay.length();
    ray.set(target,lookRay.normalize());
    let nearest=length;
    for(const obstacle of (indoor?[]:blockers)) {
      const hit=ray.intersectBox(obstacle,tmpNear);
      if(hit) {
        const d=target.distanceTo(hit);
        if(d<nearest&&d>.48)nearest=Math.max(1.55,d-.38);
      }
    }
    state.clipped=nearest<length-.2;
    if(state.clipped)desired.copy(target).addScaledVector(ray.direction,nearest);
    if(initial||snap){
      camera.position.copy(desired);
      initial=false;
    }else{
      // Gentle positional smoothing that is independent from framerate.
      const t=1-Math.exp(-dt*11);
      camera.position.lerp(desired,t);
    }
    camera.lookAt(target);
    actual.copy(camera.position);
  }
  function snap(){update(1/60,{snap:true})}
  function setIndoor(active) {indoor=!!active;state.zoom=active?2.85:6;state.desiredZoom=state.zoom;}
  return {state,update,setOrientation,rotate,zoom,snap,setIndoor,get heading(){return state.yaw}};
}
