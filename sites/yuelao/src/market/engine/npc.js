import * as THREE from 'three';

// 每間房的掌櫃：進門招呼、帶流程、開口解讀。形象都是程序拼出來的，
// 之後換成正式模型時，只要保留 { root, update, talk } 這個介面。

const std = (o) => new THREE.MeshStandardMaterial(o);

function robe(mat, top, bottom, h) {
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    prof.push(new THREE.Vector2(top + (bottom - top) * k ** 1.4, h - k * h));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(prof, 22), mat);
}

function sleeve(mat, trim, skin, side, len = 0.6) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.19, len, 12, 1, true), mat);
  s.position.y = -len / 2;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 18), trim);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -len;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
  hand.position.y = -len - 0.04;
  g.add(s, cuff, hand);
  g.rotation.z = side * 0.2;
  return g;
}

/** 月下老人：白鬚、紅袍、拄杖，杖頭繫著紅線；左手捧姻緣簿。 */
function buildYuelao() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const red = std({ color: 0x9c1f18, roughness: 0.7, side: THREE.DoubleSide });
  const gold = std({ color: 0xd9b46a, roughness: 0.35, metalness: 0.7 });
  const skin = std({ color: 0xe9c3a6, roughness: 0.75 });
  const white = std({ color: 0xf2efe6, roughness: 0.9 });
  const wood = std({ color: 0x4a2d18, roughness: 0.8 });

  const skirt = robe(red, 0.22, 0.5, 1.02);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 30), gold);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.03;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.46, 16), red);
  torso.position.y = 1.23;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.08, 18), gold);
  belt.position.y = 1.03;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 6, 16), gold);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.46;
  body.add(skirt, hem, torso, belt, collar);

  const head = new THREE.Group();
  head.position.y = 1.64;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), skin);
  face.scale.set(0.96, 1.04, 0.98);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 14), white);
  beard.rotation.x = Math.PI;
  beard.scale.z = 0.55;
  beard.position.set(0, -0.3, 0.09);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.158, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    white,
  );
  hair.rotation.x = -0.3;
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), white);
  bun.position.set(0, 0.19, -0.03);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.3, 6), gold);
  pin.rotation.z = Math.PI / 2;
  pin.position.copy(bun.position);
  head.add(face, beard, hair, bun, pin);
  const dark = new THREE.MeshBasicMaterial({ color: 0x241712 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), dark);
    eye.scale.set(1.5, 0.5, 0.5); // 笑瞇瞇
    eye.position.set(s * 0.055, 0.015, 0.14);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.07, 3, 6), white);
    brow.rotation.z = Math.PI / 2 + s * 0.35;
    brow.position.set(s * 0.065, 0.06, 0.135);
    head.add(eye, brow);
  }
  body.add(head);

  // 右手拄杖，杖頭掛葫蘆與紅線
  const right = sleeve(red, gold, skin, 1);
  right.position.set(0.26, 1.42, 0);
  right.rotation.x = -0.5;
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.9, 8), wood);
  staff.position.set(0.44, 0.95, 0.33);
  const gourd = new THREE.Group();
  const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), std({ color: 0xc88a3a, roughness: 0.5 }));
  const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), g1.material);
  g2.position.y = 0.09;
  gourd.add(g1, g2);
  gourd.position.set(0.44, 1.62, 0.4);
  const thread = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.44, 1.86, 0.33),
        new THREE.Vector3(0.52, 1.5, 0.36),
        new THREE.Vector3(0.47, 1.1, 0.34),
        new THREE.Vector3(0.53, 0.75, 0.37),
      ]),
      20,
      0.006,
      6,
    ),
    new THREE.MeshBasicMaterial({ color: 0xe23a2e }),
  );
  // 左手捧姻緣簿
  const left = sleeve(red, gold, skin, -1, 0.5);
  left.position.set(-0.26, 1.42, 0);
  left.rotation.x = -1.0;
  const book = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.035, 0.27),
    std({ color: 0x2b3a5c, roughness: 0.8 }),
  );
  book.position.set(-0.3, 1.08, 0.42);
  book.rotation.set(-0.5, 0.2, 0);
  body.add(right, staff, gourd, thread, left, book);

  let nod = 0;
  return {
    root,
    talk() {
      nod = 1;
    },
    update(dt, t) {
      nod = Math.max(0, nod - dt * 1.4);
      body.position.y = Math.sin(t * 1.3) * 0.006;
      head.rotation.x = Math.sin(nod * Math.PI * 2) * 0.16 * nod + Math.sin(t * 0.7) * 0.02;
      head.rotation.y = Math.sin(t * 0.4) * 0.07;
      left.rotation.x = -1.0 + Math.sin(nod * Math.PI) * 0.12;
      gourd.rotation.z = Math.sin(t * 1.1) * 0.08;
    },
  };
}

/** 塔羅師：坐在桌子另一頭，兜帽壓得低，只露下半張臉，雙手擱在桌沿。 */
function buildReader() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const cloak = std({ color: 0x2e2266, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x0c0820 });
  const trim = std({ color: 0xc9a25a, roughness: 0.4, metalness: 0.7 });
  const skin = std({ color: 0xe6c7b2, roughness: 0.75 });

  const lower = robe(cloak, 0.26, 0.5, 0.95);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.5, 16), cloak);
  torso.position.y = 1.18;
  const shawl = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.34, 20, 1, true), cloak);
  shawl.position.y = 1.36;
  const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), trim);
  clasp.position.set(0, 1.36, 0.23);
  body.add(lower, torso, shawl, clasp);

  const head = new THREE.Group();
  head.position.y = 1.62;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), skin);
  face.scale.set(0.92, 1.06, 0.95);
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    cloak,
  );
  hood.position.set(0, 0.035, -0.05);
  hood.rotation.x = -0.32; // 兜帽往後披，露出臉
  hood.scale.set(1, 1.08, 1.1);
  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.146, 0.008, 6, 24, Math.PI), trim);
  circlet.rotation.set(Math.PI / 2 - 0.25, 0, Math.PI);
  circlet.position.set(0, 0.03, 0.02);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.02),
    new THREE.MeshBasicMaterial({ color: 0xb9a8ff }),
  );
  gem.position.set(0, 0.06, 0.15);
  const lips = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x8c3040 }),
  );
  lips.scale.set(1.5, 0.45, 0.5);
  lips.position.set(0, -0.07, 0.125);
  head.add(face, hood, circlet, gem, lips);
  const dark = new THREE.MeshBasicMaterial({ color: 0x1b1024 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), dark);
    eye.scale.set(1.5, 0.7, 0.5);
    eye.position.set(s * 0.05, 0.0, 0.128);
    head.add(eye);
  }
  body.add(head);

  const hands = [-1, 1].map((s) => {
    const a = sleeve(cloak, trim, skin, s, 0.5);
    a.position.set(s * 0.27, 1.4, 0.02);
    a.rotation.x = -0.9;
    a.rotation.z = s * -0.2;
    a.scale.set(0.62, 1, 0.62);
    body.add(a);
    return a;
  });

  let lift = 0;
  return {
    root,
    talk() {
      lift = 1;
    },
    update(dt, t) {
      lift = Math.max(0, lift - dt * 1.1);
      body.position.y = Math.sin(t * 1.1) * 0.005;
      head.rotation.x = 0.12 - Math.sin(lift * Math.PI) * 0.2; // 開口時抬一下頭
      head.rotation.y = Math.sin(t * 0.35) * 0.05;
      hands[1].rotation.x = -0.9 - Math.sin(lift * Math.PI) * 0.35;
      gem.material.color.setHSL(0.7, 0.8, 0.72 + Math.sin(t * 2) * 0.08);
    },
  };
}

/** 知客：灰袍、光頭、掛一串念珠，站在殿門邊招呼。 */
function buildKeeper() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const grey = std({ color: 0x6f6a60, roughness: 0.85, side: THREE.DoubleSide });
  const ochre = std({ color: 0xb07a22, roughness: 0.7 });
  const skin = std({ color: 0xe6c4a8, roughness: 0.75 });
  const lower = robe(grey, 0.2, 0.45, 1.02);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.46, 16), grey);
  torso.position.y = 1.23;
  const sashM = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 20), ochre);
  sashM.rotation.set(Math.PI / 2 - 0.5, 0.6, 0);
  sashM.position.y = 1.25;
  const head = new THREE.Group();
  head.position.y = 1.62;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), skin);
  face.scale.set(0.95, 1.05, 0.98);
  head.add(face);
  const dark = new THREE.MeshBasicMaterial({ color: 0x241712 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dark);
    eye.scale.set(1.5, 0.5, 0.5);
    eye.position.set(s * 0.052, 0.01, 0.136);
    head.add(eye);
  }
  const beads = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.014, 6, 24),
    std({ color: 0x3a2416, roughness: 0.5 }),
  );
  beads.rotation.x = Math.PI / 2 - 0.9;
  beads.position.set(0, 1.3, 0.1);
  const arms = [-1, 1].map((s) => {
    const a = sleeve(grey, grey, skin, s, 0.5);
    a.position.set(s * 0.24, 1.42, 0);
    a.rotation.x = -0.95;
    a.rotation.z = s * -0.35; // 合十
    a.scale.set(0.7, 1, 0.7);
    body.add(a);
    return a;
  });
  body.add(lower, torso, sashM, head, beads);
  let nod = 0;
  return {
    root,
    talk() {
      nod = 1;
    },
    update(dt, t) {
      nod = Math.max(0, nod - dt * 1.3);
      body.position.y = Math.sin(t * 1.2) * 0.005;
      body.rotation.x = Math.sin(nod * Math.PI) * 0.22; // 開口時欠身
      head.rotation.y = Math.sin(t * 0.4) * 0.06;
      arms[0].rotation.x = -0.95 - Math.sin(nod * Math.PI) * 0.1;
    },
  };
}

export const NPCS = {
  keeper: { name: '知客', build: buildKeeper },
  yuelao: { name: '月老', build: buildYuelao },
  tarot: { name: '塔羅師', build: buildReader },
};

export function createNpc(id) {
  const def = NPCS[id];
  const npc = def.build();
  npc.name = def.name;
  npc.root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return npc;
}
