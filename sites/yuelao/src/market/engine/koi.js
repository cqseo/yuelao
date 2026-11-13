import * as THREE from 'three';
import { glow, rand } from './util.js';

// 許願池裡的錦鯉：平常繞著許願樹慢慢游；有人在池邊撒飼料，就一起游過來搶。
// 純佈景，不存任何東西。
const COLORS = [
  [0xff6a1a, 0xffffff],
  [0xffffff, 0xe0301e],
  [0xffb02e, 0xffb02e],
  [0xe0301e, 0x111111],
  [0xfff3dc, 0xff7a2a],
  [0xff8c2a, 0xffffff],
  [0x202020, 0xff8c2a],
];
const WATER_Y = 0.5;
const R_MIN = 3.3; // 樹下的小島外緣
const R_MAX = 5.1; // 池壁內側

/** @param {THREE.Scene} scene */
export function createKoi(scene) {
  const fish = [];
  for (let i = 0; i < COLORS.length; i++) {
    const [a, b] = COLORS[i];
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshStandardMaterial({ color: a, roughness: 0.4, emissive: a, emissiveIntensity: 0.25 }),
    );
    body.scale.set(0.75, 0.45, 2.1);
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 6),
      new THREE.MeshStandardMaterial({ color: b, roughness: 0.4, emissive: b, emissiveIntensity: 0.2 }),
    );
    spot.scale.set(1, 0.5, 1.6);
    spot.position.set(0, 0.035, 0.03);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: a, roughness: 0.4, emissive: a, emissiveIntensity: 0.25 }),
    );
    tail.rotation.x = -Math.PI / 2;
    tail.scale.y = 1;
    tail.scale.z = 0.25;
    tail.position.z = -0.3;
    g.add(body, spot, tail);
    g.position.y = WATER_Y;
    scene.add(g);
    fish.push({
      g,
      tail,
      ang: rand(6.28),
      r: rand(R_MIN + 0.2, R_MAX - 0.2),
      dir: Math.random() < 0.5 ? 1 : -1,
      spd: rand(0.18, 0.32),
      ph: rand(10),
      x: 0,
      z: 0,
    });
  }
  for (const f of fish) {
    f.x = Math.cos(f.ang) * f.r;
    f.z = Math.sin(f.ang) * f.r;
  }

  // 撒下去的飼料：浮在水面一會兒，被吃掉就消失
  const pellets = [];
  let feedAt = null; // { x, z, until }

  /** 在池邊 (x, z) 撒一把飼料；鯉魚游過去。 */
  function feed(x, z, t) {
    const d = Math.hypot(x, z) || 1;
    // 落點：池壁內側一點
    const r = R_MAX - 0.4;
    const fx = (x / d) * r;
    const fz = (z / d) * r;
    feedAt = { x: fx, z: fz, until: t + 9 };
    for (let i = 0; i < 9; i++) {
      const p = glow(0xffd27a, 0.16, 0.95);
      p.position.set(fx + rand(-0.5, 0.5), WATER_Y + 0.03, fz + rand(-0.5, 0.5));
      scene.add(p);
      pellets.push({ p, born: t, life: rand(4, 8) });
    }
  }

  function update(dt, t) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const pl = pellets[i];
      const age = t - pl.born;
      pl.p.position.y = WATER_Y + 0.03 + Math.sin(age * 3 + i) * 0.01;
      if (age > pl.life) {
        scene.remove(pl.p);
        pellets.splice(i, 1);
      }
    }
    if (feedAt && t > feedAt.until) feedAt = null;
    for (const f of fish) {
      let tx;
      let tz;
      let spd;
      if (feedAt) {
        // 搶食：往落點游，各自錯開一點
        tx = feedAt.x + Math.sin(f.ph * 3) * 0.45;
        tz = feedAt.z + Math.cos(f.ph * 3) * 0.45;
        spd = 1.1;
      } else {
        f.ang += (f.dir * f.spd * dt) / f.r;
        tx = Math.cos(f.ang) * f.r;
        tz = Math.sin(f.ang) * f.r;
        spd = 0.6;
      }
      const dx = tx - f.x;
      const dz = tz - f.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.02) {
        const step = Math.min(d, spd * dt);
        let nx = f.x + (dx / d) * step;
        let nz = f.z + (dz / d) * step;
        // 不游上島、不穿池壁
        const nr = Math.hypot(nx, nz) || 1;
        const cr = Math.min(R_MAX, Math.max(R_MIN, nr));
        nx = (nx / nr) * cr;
        nz = (nz / nr) * cr;
        const heading = Math.atan2(nx - f.x, nz - f.z);
        let turn = heading - f.g.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        f.g.rotation.y += turn * Math.min(1, dt * 4);
        f.x = nx;
        f.z = nz;
      }
      f.g.position.x = f.x;
      f.g.position.z = f.z;
      f.tail.rotation.y = Math.sin(t * (feedAt ? 14 : 7) + f.ph) * 0.5;
    }
  }

  return { feed, update };
}
