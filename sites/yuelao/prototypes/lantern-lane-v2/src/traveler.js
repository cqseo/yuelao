import * as THREE from 'three';

/**
 * Original lightweight visitor / traveler for Yuexia third-person prototype.
 * Root holds actual world position (feet); local forward is -Z.
 * Camera never gets parented to the character; no head-bob / camera roll.
 */
export function createTraveler(scene) {
  const root=new THREE.Group();
  root.name='YuexiaTraveler';
  scene.add(root);

  const robe=new THREE.MeshStandardMaterial({color:0x4c637c,roughness:.88,side:THREE.DoubleSide});
  const underskirt=new THREE.MeshStandardMaterial({color:0x2c3d4f,roughness:.9,side:THREE.DoubleSide});
  const overcoat=new THREE.MeshStandardMaterial({color:0x73889a,roughness:.79,side:THREE.DoubleSide});
  const embroidery=new THREE.MeshStandardMaterial({color:0xbc9c72,roughness:.58,metalness:.24});
  const silk=new THREE.MeshStandardMaterial({color:0xb9ac9d,roughness:.82,side:THREE.DoubleSide});
  const hairMat=new THREE.MeshStandardMaterial({color:0x20202b,roughness:.72});
  const skin=new THREE.MeshStandardMaterial({color:0xcfa891,roughness:.83});
  const darkBoots=new THREE.MeshStandardMaterial({color:0x262932,roughness:.9});
  const leather=new THREE.MeshStandardMaterial({color:0x5e3d3b,roughness:.82});
  const bronze=new THREE.MeshStandardMaterial({color:0xc39b6b,metalness:.45,roughness:.48});

  const mesh=(geo,mat,x,y,z,parent=root)=>{
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  const between=(a,b,r,material,parent=root)=>{
    const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),diff=vb.clone().sub(va);
    const m=mesh(new THREE.CylinderGeometry(r,r,diff.length(),7),material,0,0,0,parent);
    m.position.copy(va.add(vb).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize());
    return m;
  };
  const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
  leftLeg.position.set(-.17,.57,0);
  rightLeg.position.set(.17,.57,0);
  root.add(leftLeg,rightLeg);
  mesh(new THREE.CylinderGeometry(.13,.14,.61,11),underskirt,0,-.29,0,leftLeg);
  mesh(new THREE.BoxGeometry(.27,.16,.47),darkBoots,0,-.64,-.08,leftLeg);
  mesh(new THREE.CylinderGeometry(.13,.14,.61,11),underskirt,0,-.29,0,rightLeg);
  mesh(new THREE.BoxGeometry(.27,.16,.47),darkBoots,0,-.64,-.08,rightLeg);

  const robeLayer=mesh(new THREE.CylinderGeometry(.29,.53,.96,26,1,true),robe,0,.75,0);
  const skirt=mesh(new THREE.CylinderGeometry(.30,.56,.91,24,1,true),underskirt,0,.55,0);
  // Split front overlay, side edges of silk, bronze embroidery and stitched trims.
  const front=mesh(new THREE.ConeGeometry(.37,1.04,20,1,true),overcoat,0,.79,-.08);
  front.scale.z=.9;
  for(const x of [-.22,.22]){
    const stripe=mesh(new THREE.BoxGeometry(.045,1.06,.029),embroidery,x,.92,-.329);
    stripe.rotation.z=x>0?.09:-.09;
  }
  const collar=mesh(new THREE.ConeGeometry(.34,.46,12,1,true),silk,0,1.42,-.04);
  collar.rotation.x=.06;
  mesh(new THREE.CylinderGeometry(.305,.34,.15,16),leather,0,1.23,0);
  const waist=mesh(new THREE.BoxGeometry(.72,.12,.35),leather,0,1.22,0);
  mesh(new THREE.BoxGeometry(.13,.12,.055),embroidery,0,1.22,-.19);
  // Back-slung travel satchel, visible from the third-person camera.
  mesh(new THREE.BoxGeometry(.48,.44,.21),leather,.28,1.08,.30);
  mesh(new THREE.BoxGeometry(.53,.05,.27),embroidery,.28,1.30,.29);
  between([-.22,1.38,.25],[.34,1.09,.41],.024,embroidery);

  const leftArm=new THREE.Group(),rightArm=new THREE.Group();
  leftArm.position.set(-.37,1.37,-.01);
  rightArm.position.set(.37,1.37,-.01);
  root.add(leftArm,rightArm);
  for(const [group,side] of [[leftArm,-1],[rightArm,1]]){
    const upper=mesh(new THREE.CylinderGeometry(.17,.24,.62,14),robe,0,-.31,0,group);
    upper.rotation.z=side*.12;
    mesh(new THREE.CylinderGeometry(.21,.22,.11,12),silk,side*.04,-.65,0,group);
    mesh(new THREE.SphereGeometry(.095,10,9),skin,side*.04,-.75,0,group);
  }

  mesh(new THREE.CylinderGeometry(.13,.16,.22,11),skin,0,1.55,-.04);
  const face=mesh(new THREE.SphereGeometry(.225,20,15),skin,0,1.81,-.025);
  face.scale.set(1,1.23,.90);
  const backHair=mesh(new THREE.SphereGeometry(.255,20,15),hairMat,0,1.91,.09);
  backHair.scale.set(1,1.15,.95);
  // A small bun and hairpin make the traveler readable from behind.
  mesh(new THREE.SphereGeometry(.20,14,12),hairMat,0,2.13,.06);
  between([-.27,2.13,.08],[.31,2.16,.08],.024,bronze);
  mesh(new THREE.SphereGeometry(.035,8,8),embroidery,.32,2.17,.08);
  for(const sx of [-1,1])mesh(new THREE.SphereGeometry(.018,8,6),hairMat,sx*.09,1.83,-.235);

  const groundShadow=new THREE.Mesh(
    new THREE.CircleGeometry(.52,20),
    new THREE.MeshBasicMaterial({color:0x121622,opacity:.20,transparent:true,depthWrite:false})
  );
  groundShadow.rotation.x=-Math.PI/2;
  groundShadow.position.set(0,.028,0);
  root.add(groundShadow);

  let walkPhase=0,heading=0;
  const TURN_SPEED=11;
  const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
  function tick(t,dt,dx=0,dz=0,moving=false) {
    const distance=Math.hypot(dx,dz);
    if(moving&&distance>1e-4){
      const aim=Math.atan2(-dx,-dz);
      heading+=angleDelta(aim,heading)*Math.min(1,TURN_SPEED*dt);
      root.rotation.y=heading;
      walkPhase+=dt*(4.7+Math.min(2,distance/dt*.14));
    }
    const walk=moving?Math.min(1,distance/Math.max(.001,dt)*.22):0;
    const swing=Math.sin(walkPhase)*.24*walk;
    leftLeg.rotation.x=swing;rightLeg.rotation.x=-swing;
    leftArm.rotation.x=-swing*.65;rightArm.rotation.x=swing*.65;
    robeLayer.rotation.z=Math.sin(t*1.1)*.012+swing*.03;
    skirt.rotation.z=-Math.sin(t*1.0)*.013-swing*.024;
    waist.rotation.z=Math.sin(t*.82)*.012;
    front.rotation.z=Math.sin(t*.9)*.014;
  }
  function setHeading(angle) {
    heading=angle;
    root.rotation.y=angle;
  }
  return {group:root,position:root.position,tick,setHeading,
    get heading(){return heading;}
  };
}
