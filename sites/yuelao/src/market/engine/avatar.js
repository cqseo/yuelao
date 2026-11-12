import * as THREE from 'three';

// 訪客自己的角色（第三人稱時看得到）：程序拼出來的漢服小人，提一盞紙燈籠。
// 外觀分「衣服」和「髮型」兩組，目前全部免費。之後要賣的款式標 free: false，
// 並在 site.config.ts 加一個 id 為 'outfit_<代號>' 的 item 商品，衣櫥就會標價、可試穿、可購買。
export const OUTFITS = [
  { id: 'moon', name: '月白', robe: 0xdfe6ea, trim: 0x2b3a5c, sash: 0x2b3a5c, free: true },
  { id: 'red', name: '朱紅', robe: 0xa3261c, trim: 0xd9b46a, sash: 0xd9b46a, free: true },
  { id: 'teal', name: '黛青', robe: 0x24484a, trim: 0xe6dcc4, sash: 0xb5332b, free: true },
  { id: 'peach', name: '桃夭', robe: 0xf0b7b0, trim: 0xf7ead0, sash: 0xc9a25a, free: true },
  { id: 'ink', name: '墨金', robe: 0x16161a, trim: 0xc9a25a, sash: 0xc9a25a, free: true },
  { id: 'bride', name: '霞帔', robe: 0xc21f1a, trim: 0xf0cf7a, sash: 0xf0cf7a, free: true, veil: true },
];
export const HAIRS = [
  { id: 'bun', name: '單髻', free: true },
  { id: 'twin', name: '雙髻', free: true },
  { id: 'long', name: '披髮', free: true },
];

export function createAvatar(lowQuality) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // leans and bobs
  root.add(body);
  const robeM = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide });
  const trimM = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const sashM = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0xf1d3bd, roughness: 0.7 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.45 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd9b46a, metalness: 0.9, roughness: 0.3 });
  const sh = (m) => {
    m.castShadow = !lowQuality;
    return m;
  };

  // skirt: lathe profile flaring to the hem
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push(new THREE.Vector2(0.17 + 0.25 * t ** 1.5, 0.98 - t * 0.96));
  }
  const skirt = sh(new THREE.Mesh(new THREE.LatheGeometry(prof, 20), robeM));
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 6, 28), trimM);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.03;
  const torso = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.42, 14), robeM));
  torso.position.y = 1.17;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 16), trimM);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.38;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.09, 16), sashM);
  sash.position.y = 0.99;
  const sashTail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.012), sashM);
  sashTail.position.set(0.05, 0.72, 0.19);
  body.add(skirt, hem, torso, collar, sash, sashTail);

  // wide sleeves hanging from the shoulders
  const sleeves = [-1, 1].map((s) => {
    const g = new THREE.Group();
    const sl = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, 0.62, 12, 1, true), robeM));
    sl.position.y = -0.31;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 18), trimM);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.62;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinM);
    hand.position.y = -0.66;
    g.add(sl, cuff, hand);
    g.position.set(s * 0.2, 1.34, 0);
    g.rotation.z = s * 0.16;
    body.add(g);
    return g;
  });

  // head and hair
  const head = new THREE.Group();
  head.position.y = 1.53;
  const face = sh(new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 16), skinM));
  face.scale.set(0.94, 1.06, 0.98);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skinM);
  neck.position.y = -0.13;
  const cap = sh(
    new THREE.Mesh(new THREE.SphereGeometry(0.134, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM),
  );
  cap.position.set(0, 0.012, -0.012);
  cap.rotation.x = -0.25;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeM);
    e.position.set(s * 0.045, 0.005, 0.117);
    e.scale.set(1.3, 0.8, 0.5);
    head.add(e);
  }
  const hairStyles = {
    bun: new THREE.Group(),
    twin: new THREE.Group(),
    long: new THREE.Group(),
  };
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), hairM);
  bun.position.set(0, 0.15, -0.05);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), goldM);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0, 0.16, -0.05);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hairM);
  back.scale.set(1, 1.5, 0.55);
  back.position.set(0, -0.1, -0.1);
  hairStyles.bun.add(bun, pin, back);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), hairM);
    b.position.set(s * 0.1, 0.13, -0.03);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), trimM);
    r.position.set(s * 0.1, 0.085, -0.03);
    r.rotation.x = Math.PI / 2;
    hairStyles.twin.add(b, r);
  }
  hairStyles.twin.add(back.clone());
  const long = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.62, 12), hairM);
  long.scale.z = 0.45;
  long.position.set(0, -0.3, -0.105);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 14), trimM);
  band.rotation.x = Math.PI / 2;
  band.scale.z = 0.5;
  band.position.set(0, -0.42, -0.1);
  hairStyles.long.add(long, band);
  const veil = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({
      color: 0xd4221c,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      roughness: 0.6,
    }),
  );
  veil.position.y = 0.02;
  veil.scale.y = 1.5;
  head.add(face, neck, cap, hairStyles.bun, hairStyles.twin, hairStyles.long, veil);
  body.add(head);

  // paper lantern on a stick, in the right hand; it lights the ground around the walker
  const lamp = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a2416 }),
  );
  stick.rotation.x = Math.PI / 2 - 0.25;
  stick.position.set(0, 0.06, 0.26);
  const paper = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffb968 }),
  );
  paper.scale.y = 1.2;
  paper.position.set(0, -0.12, 0.5);
  const capL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8),
    new THREE.MeshBasicMaterial({ color: 0x1a0d06 }),
  );
  capL.position.copy(paper.position);
  lamp.add(stick, paper, capL);
  lamp.position.set(0, -0.6, 0);
  sleeves[1].add(lamp);
  const light = new THREE.PointLight(0xffa450, 7, 7, 1.7);
  light.position.set(0.25, 0.85, 0.5);
  root.add(light);

  const state = { outfit: 'moon', hair: 'bun' };
  function apply(o = {}) {
    Object.assign(state, o);
    const f = OUTFITS.find((x) => x.id === state.outfit) || OUTFITS[0];
    robeM.color.setHex(f.robe);
    trimM.color.setHex(f.trim);
    sashM.color.setHex(f.sash);
    veil.visible = !!f.veil;
    for (const [k, g] of Object.entries(hairStyles)) g.visible = k === state.hair;
  }
  apply();

  let phase = 0;
  let lean = 0;
  return {
    root,
    light,
    state,
    apply,
    /** speed: metres per second the walker is moving at. */
    update(dt, t, speed) {
      const k = Math.min(1, speed / 4.2);
      phase += dt * (5 + k * 6) * (k > 0.02 ? 1 : 0);
      lean += (k * 0.09 - lean) * Math.min(1, dt * 8);
      body.rotation.x = lean;
      body.position.y = Math.abs(Math.sin(phase)) * 0.035 * k + Math.sin(t * 1.6) * 0.004;
      skirt.rotation.z = Math.sin(phase) * 0.035 * k;
      sashTail.rotation.x = -lean * 2 + Math.sin(phase * 2) * 0.1 * k;
      sleeves[0].rotation.x = Math.sin(phase) * 0.55 * k;
      sleeves[1].rotation.x = -0.75 + Math.sin(phase + Math.PI) * 0.12 * k; // lantern arm held forward
      head.rotation.y = Math.sin(t * 0.5) * 0.06;
    },
  };
}
