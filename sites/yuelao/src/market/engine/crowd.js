import { createAvatar, HAIRS, OUTFITS } from './avatar.js';
import { rand } from './util.js';

// 廣場上的路人：讓集市不至於空蕩蕩。他們是佈景，不是其他訪客——
// 不帶名字、不算進任何「在線人數」，真人同場另外做。
export function createCrowd(world, count) {
  const R = world.plazaR - 2;
  const spot = () => {
    for (let i = 0; i < 30; i++) {
      const a = rand(6.28);
      const r = Math.sqrt(Math.random()) * R;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (world.walkable(x, z)) return [x, z];
    }
    return [0, R - 2];
  };
  const folk = [];
  for (let i = 0; i < count; i++) {
    const a = createAvatar(true);
    a.root.remove(a.light); // 路人的燈籠只發亮、不照明，省掉十幾盞點光源
    a.apply({ outfit: OUTFITS[i % OUTFITS.length].id, hair: HAIRS[i % HAIRS.length].id });
    const [x, z] = spot();
    a.root.position.set(x, 0, z);
    a.root.rotation.y = rand(6.28);
    a.root.scale.setScalar(rand(0.92, 1.04));
    world.scene.add(a.root);
    folk.push({ a, to: spot(), speed: rand(1.0, 1.6), wait: rand(0, 6), t0: rand(10) });
  }
  return {
    update(dt, t) {
      for (const f of folk) {
        const p = f.a.root.position;
        if (f.wait > 0) {
          f.wait -= dt;
          f.a.update(dt, t + f.t0, 0);
          continue;
        }
        const dx = f.to[0] - p.x;
        const dz = f.to[1] - p.z;
        const d = Math.hypot(dx, dz);
        const nx = p.x + (dx / (d || 1)) * f.speed * dt;
        const nz = p.z + (dz / (d || 1)) * f.speed * dt;
        if (d < 0.4 || !world.walkable(nx, nz)) {
          // 到了，或被池子、鋪子擋住：停一會兒，換個方向
          f.to = spot();
          f.wait = d < 0.4 ? rand(2, 7) : rand(0.3, 1);
          continue;
        }
        p.x = nx;
        p.z = nz;
        let turn = Math.atan2(dx, dz) - f.a.root.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        f.a.root.rotation.y += turn * Math.min(1, dt * 6);
        f.a.update(dt, t + f.t0, f.speed * 2.6); // 步幅按主角的節奏換算
      }
    },
  };
}
