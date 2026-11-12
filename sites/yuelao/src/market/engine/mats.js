import * as THREE from 'three';
import { canvasTex } from './util.js';

// Procedural PBR texture sets: every surface gets colour + normal (+ roughness) maps
// generated from a height field, so light rakes across stone joints, roof tiles and wood grain.

function heightCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  draw(g, size);
  return c;
}

function normalFromHeight(hc, strength = 2) {
  const s = hc.width;
  const src = hc.getContext('2d').getImageData(0, 0, s, s).data;
  const out = document.createElement('canvas');
  out.width = out.height = s;
  const og = out.getContext('2d');
  const img = og.createImageData(s, s);
  const h = (x, y) => src[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * s + x) * 4;
      img.data[i] = (-dx / l) * 127 + 128;
      img.data[i + 1] = (dy / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  og.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(g, s, n, a) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

function rep(t, x, y) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.anisotropy = 8;
  return t;
}

/** Big irregular flagstones with dark joints. */
function stoneSet() {
  const S = 512;
  const stones = [];
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -S / 6 : 0;
    while (x < S) {
      const w = S / 3 + (Math.random() - 0.5) * 40;
      stones.push([x, (r * S) / rows, w, S / rows, Math.random()]);
      x += w;
    }
  }
  const paint = (g, col) => {
    for (const [x, y, w, h, k] of stones)
      for (const ox of [0, S, -S]) {
        g.fillStyle = col(k);
        g.fillRect(x + ox + 3, y + 3, w - 6, h - 6);
      }
  };
  const hc = heightCanvas(S, (g) => {
    g.fillStyle = '#202020';
    g.fillRect(0, 0, S, S);
    paint(g, (k) => `rgb(${150 + k * 60},${150 + k * 60},${150 + k * 60})`);
    speckle(g, S, 14000, 0.25);
  });
  const map = canvasTex(S, S, (g) => {
    g.fillStyle = '#16130f';
    g.fillRect(0, 0, S, S);
    paint(g, (k) => `rgb(${58 + k * 22},${54 + k * 20},${50 + k * 18})`);
    speckle(g, S, 16000, 0.1);
  });
  return { map, normalMap: normalFromHeight(hc, 3.2) };
}

/** Roof tiles: half-round rows running down the slope. */
function tileSet() {
  const S = 256;
  const cols = 8;
  const hc = heightCanvas(S, (g) => {
    for (let x = 0; x < cols; x++) {
      const gr = g.createLinearGradient((x * S) / cols, 0, ((x + 1) * S) / cols, 0);
      gr.addColorStop(0, '#000');
      gr.addColorStop(0.5, '#fff');
      gr.addColorStop(1, '#000');
      g.fillStyle = gr;
      g.fillRect((x * S) / cols, 0, S / cols, S);
    }
    g.fillStyle = 'rgba(0,0,0,.55)';
    for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 5);
  });
  const map = canvasTex(S, S, (g) => {
    g.fillStyle = '#1b2026';
    g.fillRect(0, 0, S, S);
    for (let x = 0; x < cols; x++) {
      g.fillStyle = `rgba(90,110,125,${0.1 + Math.random() * 0.12})`;
      g.fillRect((x * S) / cols + 6, 0, S / cols - 12, S);
    }
    speckle(g, S, 5000, 0.12);
  });
  return { map, normalMap: normalFromHeight(hc, 4) };
}

function woodSet(base) {
  const S = 256;
  const lines = [];
  for (let i = 0; i < 70; i++) lines.push([Math.random() * S, 1 + Math.random() * 2.5, Math.random()]);
  const hc = heightCanvas(S, (g) => {
    for (const [x, w, k] of lines) {
      g.fillStyle = `rgba(${k < 0.5 ? '0,0,0' : '255,255,255'},.35)`;
      g.fillRect(x, 0, w, S);
    }
    g.fillStyle = 'rgba(0,0,0,.8)';
    for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 3, S);
  });
  const map = canvasTex(S, S, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (const [x, w, k] of lines) {
      g.fillStyle = `rgba(${k < 0.5 ? '0,0,0' : '255,200,150'},${0.06 + k * 0.08})`;
      g.fillRect(x, 0, w, S);
    }
    g.fillStyle = 'rgba(0,0,0,.5)';
    for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 3, S);
  });
  return { map, normalMap: normalFromHeight(hc, 2) };
}

function plasterSet() {
  const S = 256;
  const hc = heightCanvas(S, (g) => {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},.06)`;
      g.beginPath();
      g.arc(Math.random() * S, Math.random() * S, 4 + Math.random() * 26, 0, 6.283);
      g.fill();
    }
    speckle(g, S, 6000, 0.2);
  });
  const map = canvasTex(S, S, (g) => {
    g.fillStyle = '#8a7f72';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(40,30,20,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * S, 0, 3 + Math.random() * 14, S);
    }
    speckle(g, S, 5000, 0.08);
  });
  return { map, normalMap: normalFromHeight(hc, 1.6) };
}

/** Large-scale wetness: dark = puddle (mirror-like), light = dry stone. */
function wetnessTex() {
  const t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#b8b8b8';
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * w;
      const y = Math.random() * w;
      const r = 10 + Math.random() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(58,58,58,.95)');
      gr.addColorStop(0.7, 'rgba(64,64,64,.6)');
      gr.addColorStop(1, 'rgba(60,60,60,0)');
      g.fillStyle = gr;
      for (const ox of [0, w, -w])
        for (const oy of [0, w, -w]) {
          g.beginPath();
          g.ellipse(x + ox, y + oy, r, r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, 6.283);
          g.fill();
        }
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createMaterials() {
  const stone = stoneSet();
  const tile = tileSet();
  const wood = woodSet('#3b2217');
  const redWood = woodSet('#6b1a14');
  const plaster = plasterSet();
  const wet = wetnessTex();
  const stdMat = (o) => new THREE.MeshStandardMaterial(o);
  const groundMap = stone.map.clone();
  const groundN = stone.normalMap.clone();
  rep(groundMap, 46, 46);
  rep(groundN, 46, 46);
  rep(wet, 9, 9);
  return {
    ground: stdMat({
      map: groundMap,
      normalMap: groundN,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: wet,
      roughness: 1,
      metalness: 0.0,
      envMapIntensity: 1.25,
    }),
    stone: stdMat({ map: stone.map, normalMap: stone.normalMap, roughness: 0.85 }),
    tile: stdMat({
      map: rep(tile.map, 5, 2),
      normalMap: rep(tile.normalMap, 5, 2),
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.42,
      metalness: 0.15,
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
    }),
    wood: stdMat({ map: rep(wood.map, 2, 1), normalMap: rep(wood.normalMap, 2, 1), roughness: 0.78 }),
    red: stdMat({ map: redWood.map, normalMap: redWood.normalMap, roughness: 0.38, envMapIntensity: 0.7 }),
    plaster: stdMat({
      map: rep(plaster.map, 2, 1),
      normalMap: rep(plaster.normalMap, 2, 1),
      roughness: 0.95,
    }),
    dark: stdMat({ color: 0x0d0f12, roughness: 0.6 }),
    bronze: stdMat({ color: 0x6f5a36, metalness: 0.9, roughness: 0.38, envMapIntensity: 1.2 }),
    gold: stdMat({ color: 0xc9a25a, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 }),
  };
}

/** Curved Chinese roof slope pair: sags toward the eaves, corners sweep up. */
export function roofGeometry(w, d, rise, lift = 0.5) {
  const g = new THREE.PlaneGeometry(w, d, 14, 10);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const u = Math.abs(z) / (d / 2);
    const cx = Math.abs(x) / (w / 2);
    p.setY(i, rise * (1 - u) ** 1.7 + lift * cx ** 4 * u ** 1.5);
  }
  g.computeVertexNormals();
  return g;
}
