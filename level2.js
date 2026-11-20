/* ============================================================
   BEYOND MARIANA – level2.js  (LEVEL 2: CORAL REEF)
   Tropisches Korallenriff: türkises Wasser, God Rays, bunter Sand,
   Korallen / Riesen-Anemonen / Seegras, Felsbogen zum Durchtauchen,
   Fisch-Schwärme, Schildkröten, Mantas, Riffhai, leuchtende Quallen
   (schocken das U-Boot), versunkene Piraten-Schatztruhe (Bonus).

   Gleiche Schnittstelle wie world.js (buildLevel1):
     buildLevel2(scene, renderer) -> level
   level.spawn, schools, fauna, sights, sightCount, setViewDistance(v),
   update(dt, ctx), collideSub(p, vel, r), drainEvents(), isAtPlatform(p),
   getPings(pos, yaw, out), visitAll(), dispose()
   Aliase: createLevel2 / updateLevel2
   ============================================================ */

import * as THREE from 'three';

export const WORLD2 = { cameraFar: 1100, darkDepth: 99999, radius: 500 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------
   Welt-Layout
   ------------------------------------------------------------ */
const FOG_COL = 0x20bfd6;
const FOG_BASE = 0.0078;

const PATCHES = [
  { x: 0, z: -95, r: 55 }, { x: -95, z: -215, r: 75 }, { x: 175, z: -300, r: 70 }, { x: 65, z: -335, r: 80 },
  { x: -215, z: -70, r: 70 }, { x: 205, z: -55, r: 65 }, { x: -70, z: -430, r: 70 }, { x: -225, z: -330, r: 60 },
  { x: 120, z: -185, r: 55 }, { x: -20, z: -300, r: 60 }
];

function floorH(x, z) {
  let h = -40 + 5 * Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013) + 2.6 * Math.sin(x * 0.031 + z * 0.027) + 1.4 * Math.sin(x * 0.071 - z * 0.053);
  for (let i = 0; i < PATCHES.length; i++) {
    const p = PATCHES[i];
    const dx = x - p.x, dz = z - p.z, s = p.r * 0.55;
    h += 5 * Math.exp(-(dx * dx + dz * dz) / (2 * s * s));
  }
  h += smooth(420, 580, Math.hypot(x, z)) * 55;
  return h;
}

const ARCH = { x: -95, z: -215, ry: 0.35, R: 20, tube: 6.5 };
const CHEST_XZ = { x: 178, z: -292 };
const SHARK_ORBIT = { cx: 65, cz: -340, Rx: 95, Rz: 60, w: 0.07, ph: 0, h0: 14, hA: 3 };

const DOCK_BOXES = [
  { x0: -13.2, x1: -9, z0: -16, z1: 32, y0: -16, y1: 1 },
  { x0: 9, x1: 13.2, z0: -16, z1: 32, y0: -16, y1: 1 },
  { x0: -13.2, x1: 13.2, z0: 32, z1: 37, y0: -16, y1: 1 }
];

function orbitPos(o, t, out) {
  const a = o.w * t + o.ph;
  out.x = o.cx + Math.sin(a) * o.Rx;
  out.z = o.cz + Math.cos(a) * o.Rz;
  out.y = Math.min(-3, floorH(out.x, out.z) + o.h0 + o.hA * Math.sin(a * 1.7 + o.ph * 2));
  return out;
}

/* ------------------------------------------------------------
   Geometrie-Helfer
   ------------------------------------------------------------ */
function mergeGeos(list) {
  const pos = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i++) pos.push(a[i]);
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.computeVertexNormals();
  return m;
}

function mergeColored(list) {
  const pos = [], col = [], c = new THREE.Color();
  for (const it of list) {
    const g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      pos.push(x, y, z);
      c.set(typeof it.col === 'function' ? it.col(x, y, z) : it.col);
      col.push(c.r, c.g, c.b);
    }
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  m.computeVertexNormals();
  return m;
}

function triGeo(v) {            // beidseitig sichtbares Dreieck
  const g = new THREE.BufferGeometry();
  const r = [v[6], v[7], v[8], v[3], v[4], v[5], v[0], v[1], v[2]];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.concat(r), 3));
  return g;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function causticTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9b9b9'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(7);
    ctx.lineJoin = 'round';
    for (let k = 0; k < 46; k++) {
      const cx = r() * w, cy = r() * h, rad = 14 + r() * 26, n = 6 + Math.floor(r() * 4), ph = r() * 6.28;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = i / n * Math.PI * 2, rr = rad * (0.75 + 0.25 * Math.sin(a * 3 + ph));
          const x = cx + ox + Math.cos(a) * rr, y = cy + oy + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
  }, true);
}

function rippleTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c4f4ff'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(11);
    for (let k = 0; k < 160; k++) {
      const x = r() * w, y = r() * h, l = 10 + r() * 30;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 + r() * 0.3).toFixed(2) + ')';
      ctx.lineWidth = 2 + r() * 3;
      for (const ox of [-w, 0, w]) {
        ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.quadraticCurveTo(x + ox + l / 2, y + 4, x + ox + l, y); ctx.stroke();
      }
    }
  }, true);
}

function rayTexture() {
  return canvasTex(64, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.6, 'rgba(0,0,0,0.45)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
}

function dotTexture() {
  return canvasTex(32, 32, (ctx, w, h) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

function woodTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(5);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(' + (40 + Math.floor(r() * 40)) + ',25,10,0.25)';
      ctx.fillRect(0, i * 16, w, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, i * 16 + 14, w, 2);
    }
  }, true);
}

function signTexture() {
  return canvasTex(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0d3a4a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8fefff'; ctx.font = 'bold 62px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('MARIANA TOURS', w / 2, 58);
    ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 34px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('CORAL REEF · KORALLENRIFF', w / 2, 112);
  });
}

/* ------------------------------------------------------------
   Korallen-Material (Instanzfarbe + Leuchten + Wiegen im Strom)
   ------------------------------------------------------------ */
const timeU = { value: 0 };

function coralMat(o) {
  o = o || {};
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: o.rough === undefined ? 0.55 : o.rough, metalness: 0,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide
  });
  const sway = o.sway || 0;
  const glow = o.glow === undefined ? 0.28 : o.glow;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.uniforms.uSway = { value: sway };
    sh.uniforms.uGlow = { value: glow };
    sh.vertexShader = 'uniform float uTime;\nuniform float uSway;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
         float amt = uSway * max(position.y, 0.0);
         transformed.x += sin(uTime * 1.4 + ph + position.y * 0.9) * amt;
         transformed.z += cos(uTime * 1.1 + ph * 1.3 + position.y * 0.8) * amt * 0.8;
       #endif`
    );
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uGlow;'
    );
  };
  m.customProgramCacheKey = () => 'coral-v1';
  return m;
}

/* ------------------------------------------------------------
   Korallen-Geometrien
   ------------------------------------------------------------ */
function geoBranch(r) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (base, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.72, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    g.translate(base.x, base.y, base.z);
    parts.push(g);
    if (depth <= 0) return;
    const tip = base.clone().addScaledVector(dir, len);
    for (let i = 0; i < 2; i++) {
      const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.2, r() * 0.3, (r() - 0.5) * 1.2)).normalize();
      grow(tip, d, len * 0.74, rad * 0.72, depth - 1);
    }
  };
  for (let i = 0; i < 2; i++) {
    const d = new THREE.Vector3((r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6).normalize();
    grow(new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), d, 1.5, 0.2, 3);
  }
  return mergeGeos(parts);
}

function geoBrain() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.09 * Math.sin(x * 8 + z * 3) * Math.sin(y * 8 + x * 2);
    x *= k; y *= k * 0.62; z *= k;
    p.setXYZ(i, x, Math.max(y, -0.25), z);
  }
  g.translate(0, 0.2, 0);
  g.computeVertexNormals();
  return g;
}

function geoTube(r) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.283, d = r() * 0.7, h = 1 + r() * 2.2, rad = 0.2 + r() * 0.12;
    const g = new THREE.CylinderGeometry(rad * 1.15, rad, h, 7, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.3);
    g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    parts.push(g);
  }
  return mergeGeos(parts);
}

function geoFan() {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const a = 0.2 + i * (Math.PI - 0.4) / 11;
    const g = new THREE.CylinderGeometry(0.025, 0.04, 1.65, 4);
    g.translate(0, 0.825, 0);
    g.rotateZ(a - Math.PI / 2);
    parts.push(g);
  }
  [0.5, 0.95, 1.4].forEach((rad) => {
    const t = new THREE.TorusGeometry(rad, 0.025, 4, 20, Math.PI - 0.4);
    t.rotateZ(0.2);
    parts.push(t);
  });
  const stalk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5);
  stalk.translate(0, -0.1, 0);
  parts.push(stalk);
  return mergeGeos(parts);
}

function geoAnemone(r) {
  const parts = [];
  const base = new THREE.CylinderGeometry(0.8, 1.1, 1.0, 9, 1, true);
  base.translate(0, 0.5, 0);
  parts.push(base);
  [[0.15, 10, 0.15], [0.45, 16, 0.45], [0.75, 20, 0.8]].forEach(([rad, n, tilt]) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * 0.2, len = 1.4 + r() * 1.0;
      const g = new THREE.CylinderGeometry(0.02, 0.07, len, 4, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateZ(-(tilt + r() * 0.25));
      g.rotateY(a);
      g.translate(Math.cos(a) * rad, 1.0, -Math.sin(a) * rad);
      parts.push(g);
    }
  });
  return mergeGeos(parts);
}

function geoRock() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.22 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7 - y * 1.9) + 0.1 * Math.sin(x * 9 + z * 7);
    p.setXYZ(i, x * k, Math.max(y * k, -0.4), z * k);
  }
  g.computeVertexNormals();
  return g;
}

function geoBlade() {
  const g = new THREE.PlaneGeometry(0.32, 2.4, 1, 4);
  g.translate(0, 1.2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 2.4;
    p.setX(i, p.getX(i) * (1 - t * 0.85));
    p.setZ(i, t * t * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------
   Fische
   ------------------------------------------------------------ */
const SPECIES = {
  clown: { size: 1.9, speed: 4.4, body: (x, y, z) => (((z > 0.14 && z < 0.24) || (z < -0.12 && z > -0.22)) ? 0xffffff : 0xff7a1a), tail: 0xff7a1a, fin: 0xff9a3a },
  tang: { size: 2.6, speed: 5.0, body: (x, y, z) => ((z > 0.2 && z < 0.28 && y > -0.2) ? 0x0a1a3a : 0x1f6bff), tail: 0xffe040, fin: 0x1f6bff },
  yellow: { size: 2.4, speed: 5.2, body: () => 0xffe033, tail: 0xffd01a, fin: 0xfff3a0 },
  parrot: { size: 2.8, speed: 4.8, body: (x, y) => (y < -0.1 ? 0xff5cb0 : 0x31f2a0), tail: 0xff5cb0, fin: 0x7dffd0 }
};

function fishGeo(sp) {
  const body = new THREE.SphereGeometry(0.5, 12, 8);
  body.scale(0.36, 0.55, 1);
  return mergeColored([
    { geo: body, col: sp.body },
    { geo: triGeo([0, 0, -0.42, 0, 0.3, -0.82, 0, -0.3, -0.82]), col: sp.tail },
    { geo: triGeo([0, 0.26, 0.22, 0, 0.54, -0.1, 0, 0.2, -0.28]), col: sp.fin },
    { geo: triGeo([0.15, -0.06, 0.2, 0.42, -0.2, -0.02, 0.14, -0.14, -0.04]), col: sp.fin },
    { geo: triGeo([-0.15, -0.06, 0.2, -0.42, -0.2, -0.02, -0.14, -0.14, -0.04]), col: sp.fin }
  ]);
}

/* ------------------------------------------------------------
   Großtiere
   ------------------------------------------------------------ */
function buildTurtle() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const shellM = new THREE.MeshStandardMaterial({ color: 0x4a9a52, roughness: 0.6, flatShading: true });
  const plateM = new THREE.MeshStandardMaterial({ color: 0x2f7a3c, roughness: 0.6, flatShading: true });
  const bellyM = new THREE.MeshStandardMaterial({ color: 0xe9dcae, roughness: 0.7 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0x7bb872, roughness: 0.65 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });

  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellM);
  shell.scale.set(1.15, 0.6, 1.55); body.add(shell);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bellyM);
  belly.scale.set(1.1, 0.28, 1.5); body.add(belly);
  [[0, 0.58, 0], [0.5, 0.5, 0.45], [-0.5, 0.5, 0.45], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]].forEach((q) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 4), plateM);
    p.scale.set(1, 0.35, 1); p.position.set(q[0], q[1], q[2]); body.add(p);
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), skinM);
  head.scale.set(1, 0.9, 1.25); head.position.set(0, 0.05, 1.75); body.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 10), skinM);
  neck.rotation.x = Math.PI / 2; neck.position.set(0, 0.03, 1.4); body.add(neck);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeM);
    e.position.set(s * 0.27, 0.15, 1.95); body.add(e);
  });
  const fl = [];
  [-1, 1].forEach((s) => {
    const pv = new THREE.Group(); pv.position.set(s * 0.95, -0.05, 0.8);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6), skinM);
    f.scale.set(1.3, 0.12, 0.45); f.position.set(s * 1.05, 0, 0.1); f.rotation.y = -s * 0.35;
    pv.add(f); body.add(pv); fl.push(pv);
  });
  [-1, 1].forEach((s) => {
    const pv = new THREE.Group(); pv.position.set(s * 0.75, -0.05, -1.2);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skinM);
    f.scale.set(1.1, 0.12, 0.5); f.position.set(s * 0.5, 0, -0.1);
    pv.add(f); body.add(pv); fl.push(pv);
  });
  return { g, body, fl };
}

function buildManta() {
  const g = new THREE.Group();
  const topM = new THREE.MeshStandardMaterial({ color: 0x26384f, roughness: 0.55, side: THREE.FrontSide });
  const botM = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.6, side: THREE.BackSide });
  const edge = [[0, 1.2], [1.9, 0.55], [4, -0.35], [1.6, -0.55], [0, -0.9]];
  const wingGeo = (sign) => {
    const pts = edge.map((q) => [q[0] * sign, q[1]]);
    const pos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ny = a[1] * b[0] - a[0] * b[1];
      const v = ny >= 0 ? [0, 0.18, 0, a[0], 0, a[1], b[0], 0, b[1]] : [0, 0.18, 0, b[0], 0, b[1], a[0], 0, a[1]];
      for (let k = 0; k < 9; k++) pos.push(v[k]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  };
  const wings = [];
  [-1, 1].forEach((s) => {
    const w = new THREE.Group();
    const geo = wingGeo(s);
    w.add(new THREE.Mesh(geo, topM), new THREE.Mesh(geo, botM));
    g.add(w); wings.push(w);
  });
  const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), topM);
  bodyM.scale.set(0.9, 0.55, 1.5); bodyM.position.set(0, 0.1, 0.2); g.add(bodyM);
  [-1, 1].forEach((s) => {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6).rotateX(Math.PI / 2), topM);
    h.position.set(s * 0.3, 0.05, 1.35); g.add(h);
  });
  const tg = new THREE.CylinderGeometry(0.03, 0.12, 4, 6); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.05, -2.8);
  g.add(new THREE.Mesh(tg, topM));
  return { g, wings };
}

function buildShark() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const gray = new THREE.MeshStandardMaterial({ color: 0x72879a, roughness: 0.5, metalness: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeef3f6, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), gray); torso.scale.set(0.95, 0.85, 4.0); body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), white); belly.scale.set(0.9, 0.6, 3.9); belly.position.y = -0.32; body.add(belly);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dark); e.position.set(s * 0.62, 0.25, 3.0); body.add(e);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2, 3), gray);
    f.scale.set(1, 1, 0.3); f.position.set(s * 0.9, -0.4, 1.3); f.rotation.set(0.3, 0, -s * 1.25); body.add(f);
  });
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 4), gray);
  dorsal.scale.set(1, 1, 0.35); dorsal.position.set(0, 1.0, 0.6); dorsal.rotation.x = -0.35; body.add(dorsal);
  const dTip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), white);
  dTip.scale.set(1, 1, 0.35); dTip.position.set(0, 1.62, 0.43); dTip.rotation.x = -0.35; body.add(dTip);
  const tail = new THREE.Group(); tail.position.set(0, 0, -3.7); body.add(tail);
  const up = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), gray);
  up.scale.set(0.25, 1, 1); up.position.set(0, 0.8, -0.4); up.rotation.x = -0.6; tail.add(up);
  const low = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 4), gray);
  low.scale.set(0.25, 1, 1); low.position.set(0, -0.5, -0.3); low.rotation.x = Math.PI + 0.64; tail.add(low);
  g.scale.setScalar(1.25);
  return { g, body, tail };
}

/* ============================================================
   buildLevel2
   ============================================================ */
export function buildLevel2(scene, renderer) {
  void renderer;
  const root = new THREE.Group();
  root.name = 'level2-coral-reef';
  scene.add(root);

  const prevFog = scene.fog, prevBg = scene.background;
  scene.background = new THREE.Color(FOG_COL);
  scene.fog = new THREE.FogExp2(FOG_COL, FOG_BASE);

  const rng = mulberry32(20261120);
  const events = [];
  const ev = (type, data) => events.push(Object.assign({ type }, data));
  let time = 0;
  const dummy = new THREE.Object3D();
  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();

  /* ---------- Licht ---------- */
  root.add(new THREE.HemisphereLight(0xb8f4ff, 0xffe0a8, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.6);
  sun.position.set(-80, 220, 60);
  root.add(sun); root.add(sun.target);

  /* ---------- Wasseroberfläche (von unten sichtbar) ---------- */
  const rippleTex = rippleTexture();
  rippleTex.repeat.set(60, 60);
  const surfGeo = new THREE.PlaneGeometry(3000, 3000); surfGeo.rotateX(-Math.PI / 2);
  const surface = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({
    map: rippleTex, color: 0xdffcff, side: THREE.BackSide, transparent: true, opacity: 0.9
  }));
  surface.position.y = 0;
  root.add(surface);

  /* ---------- Meeresboden ---------- */
  const _pink = new THREE.Color(0.98, 0.78, 0.78), _mint = new THREE.Color(0.78, 0.92, 0.80), _rubble = new THREE.Color(0.80, 0.72, 0.84);
  function floorColor(x, z, c) {
    c.setRGB(0.95, 0.86, 0.66);
    const n1 = Math.sin(x * 0.007 + 1) * Math.sin(z * 0.009 + 2);
    if (n1 > 0.15) c.lerp(_pink, smooth(0.15, 0.7, n1) * 0.6);
    else if (n1 < -0.15) c.lerp(_mint, smooth(0.15, 0.7, -n1) * 0.55);
    let t = 0;
    for (let i = 0; i < PATCHES.length; i++) {
      const p = PATCHES[i], dx = x - p.x, dz = z - p.z, s = p.r * 0.7;
      t = Math.max(t, Math.exp(-(dx * dx + dz * dz) / (2 * s * s)));
    }
    c.lerp(_rubble, t * 0.55);
    c.multiplyScalar(0.9 + 0.1 * (0.5 + 0.5 * Math.sin(x * 0.35 + Math.sin(z * 0.21) * 2.2)));
  }
  const causticTex = causticTexture();
  causticTex.repeat.set(60, 60);
  {
    const fg = new THREE.PlaneGeometry(1300, 1300, 130, 130);
    fg.rotateX(-Math.PI / 2);
    const p = fg.attributes.position;
    const col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, floorH(x, z));
      floorColor(x, z, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    fg.computeVertexNormals();
    root.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, map: causticTex, roughness: 0.95 })));
  }

  /* ---------- God Rays ---------- */
  const rayTex = rayTexture();
  const rays = [];
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: rayTex, color: 0xfff0b8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const geo = new THREE.PlaneGeometry(6 + rng() * 14, 150); geo.translate(0, -75, 0);
    const m = new THREE.Mesh(geo, mat); m.rotation.y = rng() * Math.PI; m.renderOrder = 4;
    const holder = new THREE.Group(); holder.rotation.z = 0.3; holder.add(m);
    root.add(holder);
    rays.push({ holder, mat, bx: rng() * 360, bz: rng() * 360, ph: rng() * 6.28 });
  }

  /* ---------- Schwebeteilchen ---------- */
  const dotTex = dotTexture();
  const PLK = 600, PLK_S = 120;
  const plkBase = new Float32Array(PLK * 3);
  for (let i = 0; i < PLK * 3; i++) plkBase[i] = rng() * PLK_S;
  const plkGeo = new THREE.BufferGeometry();
  const plkPos = new Float32Array(PLK * 3);
  plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
  const plankton = new THREE.Points(plkGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.45, color: 0xeaffff, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true
  }));
  plankton.frustumCulled = false;
  root.add(plankton);

  /* ---------- Luftblasen vom Propeller ---------- */
  const BUB = 80;
  const bubPos = new Float32Array(BUB * 3).fill(-9999);
  const bubLife = new Float32Array(BUB);
  const bubGeo = new THREE.BufferGeometry();
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.7, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true
  }));
  bubbles.frustumCulled = false;
  root.add(bubbles);
  let bubAcc = 0, bubIdx = 0;

  /* ==========================================================
     Platzierung von Korallen, Felsen, Seegras
     ========================================================== */
  const spheres = [];       // Kollisionskugeln {x,y,z,r}
  const addSphere = (x, y, z, r) => spheres.push({ x, y, z, r });
  const pl = { branch: [], brain: [], tube: [], fan: [], anem: [], rock: [], grass: [] };
  const BRANCH_COLS = [0xff4f9a, 0xff8a2a, 0xa05cff, 0x57ff8a, 0xff3fd0, 0x2fe8ff, 0xffd23a];
  const BRAIN_COLS = [0xff9ac4, 0xffc27a, 0xc9a3ff, 0x8dffb8, 0xffe27a];
  const TUBE_COLS = [0x2fe8ff, 0xff4fd8, 0xffd23a, 0x7dffa0];
  const FAN_COLS = [0xc060ff, 0xff5fa0, 0xff8a50];
  const ANEM_COLS = [0xff6ad5, 0xb67bff, 0x7dffb0, 0xffa94d];
  const ROCK_COLS = [0x9c8b76, 0x8a7a68, 0xb09a80, 0x7c7266];
  const GRASS_COLS = [0x3fae4a, 0x5cd35a, 0x2e9a5a, 0x7ce06a];

  const archC = Math.cos(ARCH.ry), archS = Math.sin(ARCH.ry);
  function blocked(x, z) {
    if (x > -24 && x < 24 && z > -30 && z < 46) return true;                                   // Dock
    const dx = x - ARCH.x, dz = z - ARCH.z;
    const lx = dx * archC - dz * archS, lz = dx * archS + dz * archC;
    if (Math.abs(lx) < 17 && Math.abs(lz) < 13) return true;                                   // Durchfahrt Felsbogen
    if (Math.hypot(x - CHEST_XZ.x, z - CHEST_XZ.z) < 16) return true;                          // Schatztruhe
    return false;
  }

  function put(type, x, z, s, cols, extra) {
    if (blocked(x, z)) return null;
    const o = { x, y: floorH(x, z) - 0.12, z, s, ry: rng() * 6.283, tx: (rng() - 0.5) * 0.14, tz: (rng() - 0.5) * 0.14, c: cols[Math.floor(rng() * cols.length)] };
    if (extra) Object.assign(o, extra);
    pl[type].push(o);
    return o;
  }
  const polar = (p, spread) => {
    const a = rng() * 6.283, r = p.r * spread * Math.sqrt(rng());
    return [p.x + Math.cos(a) * r, p.z + Math.sin(a) * r];
  };
  const anemSpots = [];

  PATCHES.forEach((p) => {
    let x, z, o;
    for (let i = 0; i < 46; i++) { [x, z] = polar(p, 1); put('branch', x, z, 0.8 + rng() * 1.1, BRANCH_COLS); }
    for (let i = 0; i < 22; i++) {
      [x, z] = polar(p, 1.05);
      const s = 0.9 + rng() * 2.1;
      o = put('brain', x, z, s, BRAIN_COLS);
      if (o && s > 2.3) addSphere(x, o.y + s * 0.35, z, s * 0.8);
    }
    for (let i = 0; i < 18; i++) { [x, z] = polar(p, 1); put('tube', x, z, 0.8 + rng() * 0.8, TUBE_COLS); }
    for (let i = 0; i < 14; i++) { [x, z] = polar(p, 1); put('fan', x, z, 1.2 + rng() * 1.4, FAN_COLS); }
    for (let i = 0; i < 6; i++) { [x, z] = polar(p, 0.9); o = put('anem', x, z, 1.6 + rng() * 1.8, ANEM_COLS); if (o) anemSpots.push(o); }
    for (let i = 0; i < 8; i++) {
      [x, z] = polar(p, 1.1);
      const s = 2.5 + rng() * 6.5;
      o = put('rock', x, z, s, ROCK_COLS, { sy: s * (0.7 + rng() * 0.4) });
      if (o) addSphere(x, o.y + s * 0.25, z, s * 0.78);
    }
    for (let i = 0; i < 110; i++) {
      [x, z] = polar(p, 1.4);
      if (blocked(x, z)) continue;
      for (let k = 0; k < 6; k++) {
        const gx = x + (rng() - 0.5) * 1.4, gz = z + (rng() - 0.5) * 1.4;
        pl.grass.push({ x: gx, y: floorH(gx, gz) - 0.05, z: gz, s: 0.7 + rng() * 0.9, sy: 0.8 + rng() * 0.9, ry: rng() * 6.283, tx: 0, tz: 0, c: GRASS_COLS[Math.floor(rng() * GRASS_COLS.length)] });
      }
    }
  });
  // verstreute Felsen und Seegras-Felder auf freiem Sand
  for (let i = 0; i < 40; i++) {
    const a = rng() * 6.283, r = 40 + rng() * 380;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 1.5 + rng() * 3;
    const o = put('rock', x, z, s, ROCK_COLS, { sy: s * 0.8 });
    if (o && s > 2.5) addSphere(x, o.y + s * 0.25, z, s * 0.78);
  }
  for (let i = 0; i < 70; i++) {
    const a = rng() * 6.283, r = 40 + rng() * 400;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    for (let k = 0; k < 6; k++) {
      const gx = x + (rng() - 0.5) * 2, gz = z + (rng() - 0.5) * 2;
      pl.grass.push({ x: gx, y: floorH(gx, gz) - 0.05, z: gz, s: 0.7 + rng() * 0.9, sy: 0.8 + rng() * 0.9, ry: rng() * 6.283, tx: 0, tz: 0, c: GRASS_COLS[Math.floor(rng() * GRASS_COLS.length)] });
    }
  }

  /* ---------- Felsbogen ---------- */
  const archToWorld = (lx, ly, lz, ay) => new THREE.Vector3(
    ARCH.x + lx * archC + lz * archS, ay + ly, ARCH.z - lx * archS + lz * archC
  );
  const archAY = Math.max(
    floorH(ARCH.x + ARCH.R * archC, ARCH.z - ARCH.R * archS),
    floorH(ARCH.x - ARCH.R * archC, ARCH.z + ARCH.R * archS),
    floorH(ARCH.x, ARCH.z)
  ) - 4;
  const archGroup = new THREE.Group();
  archGroup.position.set(ARCH.x, archAY, ARCH.z);
  archGroup.rotation.y = ARCH.ry;
  root.add(archGroup);
  {
    const ag = new THREE.TorusGeometry(ARCH.R, ARCH.tube, 14, 28, Math.PI);
    const p = ag.attributes.position, n = ag.attributes.normal;
    const col = new Float32Array(p.count * 3), c = new THREE.Color(), algae = new THREE.Color(0.25, 0.5, 0.3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.9 * Math.sin(x * 0.35 + z * 0.5) * Math.cos(y * 0.3 - z * 0.4) + 0.5 * Math.sin(x * 0.9 + y * 0.7 + z * 0.6);
      p.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k, z + n.getZ(i) * k);
      c.setRGB(0.80, 0.66, 0.48);
      c.multiplyScalar(0.82 + 0.18 * Math.sin(y * 0.4 + x * 0.2));
      if (y < 3) c.lerp(algae, 0.5 * (1 - y / 3));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    ag.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ag.computeVertexNormals();
    archGroup.add(new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })));
  }
  for (let k = 0; k <= 16; k++) {
    const th = k / 16 * Math.PI;
    const w = archToWorld(ARCH.R * Math.cos(th), ARCH.R * Math.sin(th), 0, archAY);
    addSphere(w.x, w.y, w.z, ARCH.tube * 0.95);
  }
  [-1, 1].forEach((s) => {
    const w = archToWorld(s * 24, -3, 0, archAY);
    pl.rock.push({ x: w.x, y: w.y, z: w.z, s: 8.5, sy: 7, ry: rng() * 6.283, tx: 0, tz: 0, c: ROCK_COLS[0] });
    addSphere(w.x, w.y + 2, w.z, 7.2);
  });
  for (let i = 0; i < 70; i++) {            // Korallen-Bewuchs auf dem Bogen
    const th = (0.12 + rng() * 0.76) * Math.PI, phi = (rng() - 0.5) * 2.6;
    const lx = ARCH.R * Math.cos(th) + Math.cos(th) * Math.cos(phi) * ARCH.tube * 0.95;
    const ly = ARCH.R * Math.sin(th) + Math.sin(th) * Math.cos(phi) * ARCH.tube * 0.95;
    const lz = Math.sin(phi) * ARCH.tube * 0.95;
    const w = archToWorld(lx, ly, lz, archAY);
    const r = rng();
    const type = r < 0.4 ? 'branch' : (r < 0.75 ? 'brain' : (r < 0.9 ? 'anem' : 'tube'));
    const cols = type === 'branch' ? BRANCH_COLS : (type === 'brain' ? BRAIN_COLS : (type === 'anem' ? ANEM_COLS : TUBE_COLS));
    pl[type].push({ x: w.x, y: w.y, z: w.z, s: 0.7 + rng() * 0.9, ry: rng() * 6.283, tx: 0, tz: 0, c: cols[Math.floor(rng() * cols.length)] });
  }
  const archPos = new THREE.Vector3(ARCH.x, archAY + 6, ARCH.z);

  /* ---------- Instanzierte Meshes ---------- */
  function makeInst(geo, mat, list) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((o, i) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(o.tx || 0, o.ry || 0, o.tz || 0);
      dummy.scale.set(o.s, o.sy || o.s, o.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(o.c);
      col.offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.12);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  }
  makeInst(geoBranch(rng), coralMat({ sway: 0.03, glow: 0.3 }), pl.branch);
  makeInst(geoBrain(), coralMat({ glow: 0.22 }), pl.brain);
  makeInst(geoTube(rng), coralMat({ double: true, glow: 0.32 }), pl.tube);
  makeInst(geoFan(), coralMat({ double: true, sway: 0.05, glow: 0.3 }), pl.fan);
  makeInst(geoAnemone(rng), coralMat({ sway: 0.1, glow: 0.4 }), pl.anem);
  makeInst(geoRock(), coralMat({ glow: 0, rough: 0.95 }), pl.rock);
  makeInst(geoBlade(), coralMat({ double: true, sway: 0.12, glow: 0.15, rough: 0.8 }), pl.grass);

  /* ==========================================================
     Dock (Plattform an der Oberfläche)
     ========================================================== */
  const buoys = [];
  {
    const dock = new THREE.Group(); root.add(dock);
    const woodTex = woodTexture();
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x46535f, roughness: 0.45, metalness: 0.7 });
    const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); dock.add(b); return b; };
    const pillarGeo = new THREE.CylinderGeometry(0.55, 0.55, 16, 8);
    [-1, 1].forEach((s) => {
      add(4.2, 1.0, 48, wood, s * 11.1, 0.3, 8);
      add(0.2, 0.2, 48, darkWood, s * 13.0, 1.9, 8);
      for (let z = -12; z <= 28; z += 8) {
        const pil = new THREE.Mesh(pillarGeo, darkWood); pil.position.set(s * 11.1, -7.5, z); dock.add(pil);
      }
      for (let z = -14; z <= 30; z += 6) add(0.2, 1.4, 0.2, darkWood, s * 13.0, 1.3, z);
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 8), steel);
      lampPost.position.set(s * 12.4, 2.2, -14); dock.add(lampPost);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
      bulb.position.set(s * 12.4, 4.1, -14); dock.add(bulb);
    });
    add(26.4, 1.0, 5, wood, 0, 0.3, 34.5);
    [-12, 0, 12].forEach((x) => { const pil = new THREE.Mesh(pillarGeo, darkWood); pil.position.set(x, -7.5, 35); dock.add(pil); });
    // Schild
    [-8, 8].forEach((x) => add(0.4, 8, 0.4, darkWood, x, 4.8, 36.6));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.rotation.y = Math.PI; sign.position.set(0, 7.2, 36.3); dock.add(sign);
    add(14.6, 5, 0.3, darkWood, 0, 7.2, 36.7);
    // Kisten und Fässer
    add(1.4, 1.2, 1.4, darkWood, -9, 1.4, 33);
    add(1.2, 1.0, 1.2, darkWood, -7.4, 1.3, 33.4);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.5 }));
    barrel.position.set(8.5, 1.5, 33.2); dock.add(barrel);
    // Palmen
    const palmM = new THREE.MeshStandardMaterial({ color: 0x2e9a4a, roughness: 0.7, side: THREE.DoubleSide });
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.8 });
    const nutM = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.6 });
    [[-11, 35], [11, 35], [-4.5, 36], [4.5, 36]].forEach(([x, z], i) => {
      const palm = new THREE.Group(); palm.position.set(x, 0.8, z); palm.rotation.z = (i % 2 ? -1 : 1) * 0.12; dock.add(palm);
      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 7, 8); trunkGeo.translate(0, 3.5, 0);
      palm.add(new THREE.Mesh(trunkGeo, trunkM));
      const top = new THREE.Group(); top.position.y = 7; palm.add(top);
      for (let k = 0; k < 7; k++) {
        const lg = new THREE.Group(); lg.rotation.y = k / 7 * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 4), palmM);
        leaf.position.set(0, 0, 2); leaf.rotation.x = 0.5; lg.add(leaf); top.add(lg);
      }
      for (let k = 0; k < 3; k++) {
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), nutM);
        nut.position.set(Math.cos(k * 2.1) * 0.35, -0.2, Math.sin(k * 2.1) * 0.35); top.add(nut);
      }
    });
    // Bojen
    [[-9, -19], [9, -19], [0, -24]].forEach(([x, z], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff3a3a, roughness: 0.4 }));
      b.position.set(x, 0.1, z); dock.add(b); buoys.push({ m: b, ph: i * 1.7 });
    });
  }

  /* ==========================================================
     Fisch-Schwärme
     ========================================================== */
  const fishMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x222222 });
  const fishGeos = {};
  Object.keys(SPECIES).forEach((k) => { fishGeos[k] = fishGeo(SPECIES[k]); });
  const schools = [];
  function centerAt(s, t, out) {
    const a = t * s.w + s.ph;
    out.x = s.base.x + Math.sin(a) * s.R;
    out.z = s.base.z + Math.cos(a * 0.83) * s.R * 0.8;
    out.y = Math.min(-3, floorH(out.x, out.z) + s.h + Math.sin(a * 0.7) * 2.5);
    return out;
  }
  function addSchool(spKey, base, R, n, h, w) {
    const sp = SPECIES[spKey];
    const mesh = new THREE.InstancedMesh(fishGeos[spKey], fishMat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    root.add(mesh);
    const s = { sp: spKey, base, R, h, w, ph: rng() * 6.28, mesh, fish: [], c: new THREE.Vector3(), cvel: new THREE.Vector3(), maxSp: sp.speed };
    centerAt(s, 0, s.c);
    const spread = spKey === 'clown' ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(spread * Math.cbrt(rng()));
      s.fish.push({
        pos: s.c.clone().add(off), vel: new THREE.Vector3((rng() - 0.5) * 2, 0, (rng() - 0.5) * 2),
        off, ph: rng() * 6.28, size: sp.size * (0.85 + rng() * 0.3)
      });
    }
    schools.push(s);
  }
  const aSpot = (i) => anemSpots[Math.min(i, anemSpots.length - 1)] || { x: PATCHES[0].x, z: PATCHES[0].z };
  addSchool('clown', aSpot(2), 8, 28, 4, 0.3);
  addSchool('clown', aSpot(14), 8, 28, 4, 0.28);
  addSchool('clown', aSpot(30), 8, 28, 4, 0.32);
  addSchool('yellow', PATCHES[0], 40, 30, 8, 0.12);
  addSchool('yellow', PATCHES[8], 45, 30, 9, 0.1);
  addSchool('tang', PATCHES[1], 45, 30, 9, 0.11);
  addSchool('tang', PATCHES[4], 50, 30, 10, 0.1);
  addSchool('parrot', PATCHES[3], 60, 26, 11, 0.09);
  addSchool('parrot', PATCHES[6], 55, 26, 11, 0.1);

  function updateSchool(s, dt) {
    _tmp.copy(s.c);
    centerAt(s, time, s.c);
    s.cvel.copy(s.c).sub(_tmp).multiplyScalar(1 / Math.max(dt, 0.001));
    const kv = 1 - Math.exp(-2.2 * dt);
    for (let i = 0; i < s.fish.length; i++) {
      const f = s.fish[i];
      const k = 1 + 0.25 * Math.sin(time * 0.9 + f.ph);
      const tx = s.c.x + f.off.x * k, ty = s.c.y + f.off.y * k, tz = s.c.z + f.off.z * k;
      f.vel.x += ((s.cvel.x + (tx - f.pos.x) * 0.8) - f.vel.x) * kv;
      f.vel.y += ((s.cvel.y + (ty - f.pos.y) * 0.8) - f.vel.y) * kv;
      f.vel.z += ((s.cvel.z + (tz - f.pos.z) * 0.8) - f.vel.z) * kv;
      const spd = f.vel.length();
      if (spd > s.maxSp) f.vel.multiplyScalar(s.maxSp / spd);
      f.pos.addScaledVector(f.vel, dt);
      const fl = floorH(f.pos.x, f.pos.z) + 1.2;
      if (f.pos.y < fl) f.pos.y = fl;
      if (f.pos.y > -2) f.pos.y = -2;
      dummy.position.copy(f.pos);
      if (spd > 0.05) { _look.copy(f.pos).add(f.vel); dummy.lookAt(_look); }
      dummy.rotateY(Math.sin(time * 8 + f.ph) * 0.12);
      dummy.scale.setScalar(f.size);
      dummy.updateMatrix();
      s.mesh.setMatrixAt(i, dummy.matrix);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ==========================================================
     Schildkröten, Mantas, Riffhai
     ========================================================== */
  const turtles = [];
  [[1, 1.8], [3, 2.2], [4, 1.6], [8, 2.0], [6, 1.9]].forEach(([pi, size], i) => {
    const t = buildTurtle();
    t.g.scale.setScalar(size);
    root.add(t.g);
    const o = { cx: PATCHES[pi].x, cz: PATCHES[pi].z, Rx: 40 + i * 9, Rz: 30 + i * 7, w: 0.06 + i * 0.006, ph: i * 1.9, h0: 9 + i * 2, hA: 4 };
    turtles.push({ t, o, ph: i * 1.3, pos: t.g.position });
  });
  const mantas = [];
  [[-100, -200, 1.2], [140, -330, 2.0], [-170, -380, 1.5]].forEach(([cx, cz, size], i) => {
    const m = buildManta();
    m.g.scale.setScalar(size);
    root.add(m.g);
    const o = { cx, cz, Rx: 150, Rz: 110, w: 0.045 - i * 0.005, ph: i * 2.3, h0: 18, hA: 8 };
    mantas.push({ m, o, ph: i * 1.1, w: { pos: m.g.position } });
  });
  const sharkB = buildShark();
  root.add(sharkB.g);
  const shark = { b: sharkB, pos: sharkB.g.position };
  orbitPos(SHARK_ORBIT, 0, shark.pos);

  /* ==========================================================
     Quallen
     ========================================================== */
  const JELLY_COLS = [0xff5fd0, 0x6fd8ff, 0xb48cff, 0x7dffb0];
  const jellyBell = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const tentParts = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.283, len = 2.6 + (i % 3) * 0.8;
    const g = new THREE.CylinderGeometry(0.03, 0.05, len, 4, 1, true);
    g.translate(Math.cos(a) * 0.55, -len / 2, Math.sin(a) * 0.55);
    tentParts.push(g);
  }
  const jellyTent = mergeGeos(tentParts);
  const jellyMats = JELLY_COLS.map((c) => new THREE.MeshStandardMaterial({
    color: c, emissive: c, emissiveIntensity: 1.1, transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.3, depthWrite: false
  }));
  const jellies = [];
  for (let i = 0, tries = 0; i < 30 && tries < 300; tries++) {
    const p = PATCHES[Math.floor(rng() * PATCHES.length)];
    const x = p.x + (rng() - 0.5) * p.r * 1.6, z = p.z + (rng() - 0.5) * p.r * 1.6;
    if (blocked(x, z)) continue;
    const s = 1.4 + rng() * 1.8, mat = jellyMats[i % jellyMats.length];
    const g = new THREE.Group();
    const bell = new THREE.Mesh(jellyBell, mat); bell.scale.set(s, s * 0.8, s); g.add(bell);
    const tent = new THREE.Mesh(jellyTent, mat); tent.scale.set(s, s, s); g.add(tent);
    const base = new THREE.Vector3(x, floorH(x, z) + 8 + rng() * 14, z);
    g.position.copy(base);
    root.add(g);
    jellies.push({ g, pos: g.position, base, bell, tent, ph: rng() * 6.28, s, r: s * 1.25 + 0.3 });
    i++;
  }

  /* ==========================================================
     Piraten-Schatztruhe + Schiffswrack (Bonus-Spot)
     ========================================================== */
  const chestY = floorH(CHEST_XZ.x, CHEST_XZ.z) - 0.3;
  const chest = { open: 0, target: 0 };
  const chestG = new THREE.Group();
  chestG.position.set(CHEST_XZ.x, chestY, CHEST_XZ.z);
  chestG.rotation.set(0, 0.6, 0.08);
  chestG.scale.setScalar(2.2);
  root.add(chestG);
  {
    const woodTex = woodTexture();
    const woodM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const ironM = new THREE.MeshStandardMaterial({ color: 0x2c2c33, roughness: 0.4, metalness: 0.6 });
    const goldM = new THREE.MeshStandardMaterial({ color: 0xffc933, emissive: 0xff9a00, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.25 });
    const lidM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, side: THREE.DoubleSide });
    const bx = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.5), woodM); bx.position.y = 0.5; chestG.add(bx);
    [-0.8, 0, 0.8].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.04, 1.56), ironM); b.position.set(x, 0.5, 0); chestG.add(b); });
    const lid = new THREE.Group(); lid.position.set(0, 1.0, -0.75); chestG.add(lid);
    const lg = new THREE.CylinderGeometry(0.75, 0.75, 2.4, 14, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2);
    const lm = new THREE.Mesh(lg, lidM); lm.position.z = 0.75; lid.add(lm);
    [-0.8, 0, 0.8].forEach((x) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.77, 0.16, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), ironM); b.position.set(x, 0, 0.75); lid.add(b); });
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.1), goldM); lock.position.set(0, 0.98, 0.78); chestG.add(lock);
    const pile = new THREE.Group(); pile.visible = false; chestG.add(pile);
    const pm = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 8), goldM); pm.scale.set(1.0, 0.35, 0.6); pm.position.y = 0.95; pile.add(pm);
    const coinG = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10);
    for (let i = 0; i < 25; i++) {
      const c = new THREE.Mesh(coinG, goldM);
      c.position.set((rng() - 0.5) * 1.6, 1.1 + rng() * 0.2, (rng() - 0.5) * 0.8);
      c.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      pile.add(c);
    }
    const light = new THREE.PointLight(0xffc860, 0, 35, 2); light.position.set(0, 1.6, 0); chestG.add(light);
    const spkGeo = new THREE.BufferGeometry();
    const spkPos = new Float32Array(28 * 3);
    spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3));
    const spk = new THREE.Points(spkGeo, new THREE.PointsMaterial({
      map: dotTex, size: 0.5, color: 0xffd860, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    spk.frustumCulled = false; spk.visible = false; chestG.add(spk);
    const spkSeed = Array.from({ length: 28 }, () => [rng() - 0.5, rng(), rng() - 0.5]);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.2, 28, 12, 1, true), new THREE.MeshBasicMaterial({
      color: 0xffd060, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    beam.position.y = 14; chestG.add(beam);
    Object.assign(chest, { lid, pile, light, spk, spkPos, spkSeed, beam });
  }
  {   // Münzen auf dem Sand + Wrack-Rippen
    const goldM = new THREE.MeshStandardMaterial({ color: 0xffc933, emissive: 0xff9a00, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.25 });
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), goldM, 40);
    for (let i = 0; i < 40; i++) {
      const a = rng() * 6.283, r = 1.5 + rng() * 5;
      const x = CHEST_XZ.x + Math.cos(a) * r, z = CHEST_XZ.z + Math.sin(a) * r;
      dummy.position.set(x, floorH(x, z) + 0.05, z);
      dummy.rotation.set((rng() - 0.5) * 0.6, rng() * 6, (rng() - 0.5) * 0.6);
      dummy.scale.setScalar(1); dummy.updateMatrix();
      coins.setMatrixAt(i, dummy.matrix);
    }
    coins.frustumCulled = false; root.add(coins);

    const wreck = new THREE.Group();
    wreck.position.set(CHEST_XZ.x + 16, floorH(CHEST_XZ.x + 16, CHEST_XZ.z + 4), CHEST_XZ.z + 4);
    wreck.rotation.y = 0.5; root.add(wreck);
    const wm = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9 });
    for (let k = 0; k < 8; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.3, 5, 16, Math.PI), wm);
      rib.rotation.z = Math.PI; rib.position.set(0, 4.3, k * 2.1 - 7); rib.scale.y = 0.6 + rng() * 0.4;
      wreck.add(rib);
    }
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 17), wm); keel.position.set(0, -0.8, 0); wreck.add(keel);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 13, 8), wm);
    mast.rotation.z = 1.35; mast.position.set(-5, 1.2, -2); wreck.add(mast);
    addSphere(wreck.position.x, wreck.position.y + 1, wreck.position.z, 3);
  }
  const chestPos = new THREE.Vector3(CHEST_XZ.x, chestY + 1.5, CHEST_XZ.z);

  /* ==========================================================
     Sehenswürdigkeiten
     ========================================================== */
  const sights = [
    { kind: 'arch', visited: false },
    { kind: 'treasure', visited: false },
    { kind: 'shark', visited: false }
  ];
  let sightCount = 0, archPrev = 0, sharkSeen = false, shockCd = -10;

  function mark(i) {
    if (sights[i].visited) return;
    sights[i].visited = true;
    sightCount++;
    ev('sight', { kind: sights[i].kind, count: sightCount });
    if (i === 1) { chest.target = 1; ev('bonus', { eur: 150 }); }
    if (sightCount === 3) ev('all-sights');
  }

  /* ==========================================================
     Kollision
     ========================================================== */
  function collideSub(p, vel, R) {
    const isSub = R > 2;
    let impact = 0;

    const rr = Math.hypot(p.x, p.z);
    if (rr > WORLD2.radius) {
      const nx = p.x / rr, nz = p.z / rr;
      p.x = nx * WORLD2.radius; p.z = nz * WORLD2.radius;
      const vr = vel.x * nx + vel.z * nz;
      if (vr > 0) { vel.x -= nx * vr; vel.z -= nz * vr; impact = Math.max(impact, vr); }
    }

    let fh = floorH(p.x, p.z);
    if (isSub) {
      const q = R * 0.7;
      fh = Math.max(fh, floorH(p.x + q, p.z), floorH(p.x - q, p.z), floorH(p.x, p.z + q), floorH(p.x, p.z - q));
    }
    if (p.y < fh + R) {
      p.y = fh + R;
      if (vel.y < 0) { impact = Math.max(impact, -vel.y); vel.y = 0; }
    }
    const maxY = isSub ? 0.5 : -0.8;
    if (p.y > maxY) { p.y = maxY; if (vel.y > 0 && isSub) vel.y = 0; }

    for (let i = 0; i < spheres.length; i++) {
      const c = spheres[i];
      const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
      const lim = c.r + R;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= lim * lim) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      p.x = c.x + nx * lim; p.y = c.y + ny * lim; p.z = c.z + nz * lim;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }

    for (let i = 0; i < DOCK_BOXES.length; i++) {
      const b = DOCK_BOXES[i];
      const cx = clamp(p.x, b.x0, b.x1), cy = clamp(p.y, b.y0, b.y1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R * R) continue;
      let nx, ny, nz, d;
      if (d2 > 1e-8) { d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; }
      else { nx = p.x < (b.x0 + b.x1) / 2 ? -1 : 1; ny = 0; nz = 0; d = 0; }
      const push = R - d;
      p.x += nx * push; p.y += ny * push; p.z += nz * push;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }

    if (isSub) {
      for (let i = 0; i < jellies.length; i++) {
        const j = jellies[i];
        const dx = p.x - j.pos.x, dy = p.y - j.pos.y, dz = p.z - j.pos.z;
        const lim = j.r + R * 0.55;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= lim * lim) continue;
        const d = Math.sqrt(d2) || 0.0001;
        p.x = j.pos.x + dx / d * lim; p.y = j.pos.y + dy / d * lim; p.z = j.pos.z + dz / d * lim;
        impact = Math.max(impact, 4);
        if (time - shockCd > 2.5) { shockCd = time; ev('jelly-shock'); }
      }
    }
    return impact;
  }

  /* ==========================================================
     Update pro Frame
     ========================================================== */
  const _cam = new THREE.Vector3();
  function wrap(v, size) { return (((v % size) + size) % size) - size / 2; }

  function update(dt, ctx) {
    ctx = ctx || {};
    dt = Math.min(dt, 0.1);
    time += dt;
    timeU.value = time;
    const cam = ctx.camPos || _cam;
    const sp = ctx.subPos || cam;

    causticTex.offset.set(time * 0.006, time * 0.004);
    rippleTex.offset.set(time * 0.01, time * 0.007);

    // God Rays
    for (let i = 0; i < rays.length; i++) {
      const r = rays[i];
      const dx = ((r.bx - cam.x) % 360 + 540) % 360 - 180;
      const dz = ((r.bz - cam.z) % 360 + 540) % 360 - 180;
      r.holder.position.set(cam.x + dx, 0, cam.z + dz);
      const edge = Math.max(Math.abs(dx), Math.abs(dz)) / 180;
      r.mat.opacity = 0.16 * (0.65 + 0.35 * Math.sin(time * 0.5 + r.ph)) * (1 - edge * edge * edge);
    }

    // Schwebeteilchen
    for (let i = 0; i < PLK; i++) {
      plkPos[i * 3] = cam.x + wrap(plkBase[i * 3] - cam.x + Math.sin(time * 0.2 + i) * 2, PLK_S);
      plkPos[i * 3 + 1] = cam.y + wrap(plkBase[i * 3 + 1] - cam.y + time * 0.4, PLK_S);
      plkPos[i * 3 + 2] = cam.z + wrap(plkBase[i * 3 + 2] - cam.z, PLK_S);
    }
    plkGeo.attributes.position.needsUpdate = true;

    // Blasen
    for (let i = 0; i < BUB; i++) {
      if (bubLife[i] > 0) {
        bubLife[i] -= dt;
        bubPos[i * 3] += Math.sin(time * 3 + i) * 0.4 * dt;
        bubPos[i * 3 + 1] += 3 * dt;
        bubPos[i * 3 + 2] += Math.cos(time * 2.7 + i) * 0.4 * dt;
        if (bubLife[i] <= 0 || bubPos[i * 3 + 1] > 0) { bubLife[i] = 0; bubPos[i * 3 + 1] = -9999; }
      }
    }
    if (ctx.bubblePos && sp.y < -0.5) {
      bubAcc += dt * (6 + (ctx.thrust || 0) * 50);
      while (bubAcc >= 1) {
        bubAcc -= 1;
        const i = bubIdx++ % BUB;
        bubLife[i] = 4 + Math.random() * 2;
        bubPos[i * 3] = ctx.bubblePos.x + (Math.random() - 0.5) * 1.2;
        bubPos[i * 3 + 1] = ctx.bubblePos.y + (Math.random() - 0.5) * 1.2;
        bubPos[i * 3 + 2] = ctx.bubblePos.z + (Math.random() - 0.5) * 1.2;
      }
    }
    bubGeo.attributes.position.needsUpdate = true;

    // Bojen
    buoys.forEach((b) => { b.m.position.y = 0.1 + Math.sin(time * 1.3 + b.ph) * 0.15; });

    // Fische
    for (let i = 0; i < schools.length; i++) updateSchool(schools[i], dt);

    // Schildkröten
    turtles.forEach((T) => {
      orbitPos(T.o, time, T.pos);
      orbitPos(T.o, time + 0.6, _tmp);
      T.t.g.lookAt(_tmp);
      const f = Math.sin(time * 1.8 + T.ph);
      T.t.fl[0].rotation.z = -f * 0.45; T.t.fl[1].rotation.z = f * 0.45;
      T.t.fl[2].rotation.z = -f * 0.2; T.t.fl[3].rotation.z = f * 0.2;
      T.t.body.rotation.z = Math.sin(time * 0.9 + T.ph) * 0.06;
    });

    // Mantas
    mantas.forEach((M) => {
      orbitPos(M.o, time, M.m.g.position);
      orbitPos(M.o, time + 0.6, _tmp);
      M.m.g.lookAt(_tmp);
      const f = Math.sin(time * 1.6 + M.ph) * 0.32;
      M.m.wings[0].rotation.z = -f; M.m.wings[1].rotation.z = f;
    });

    // Riffhai
    orbitPos(SHARK_ORBIT, time, shark.pos);
    orbitPos(SHARK_ORBIT, time + 0.6, _tmp);
    shark.b.g.lookAt(_tmp);
    shark.b.tail.rotation.y = Math.sin(time * 3.2) * 0.35;
    shark.b.body.rotation.y = Math.sin(time * 3.2 + 1) * 0.06;

    // Quallen
    jellies.forEach((j) => {
      j.pos.set(j.base.x + Math.sin(time * 0.2 + j.ph) * 3, j.base.y + Math.sin(time * 0.6 + j.ph) * 2, j.base.z + Math.cos(time * 0.17 + j.ph) * 3);
      const pulse = Math.sin(time * 2.2 + j.ph);
      j.bell.scale.set(j.s * (1 - pulse * 0.06), j.s * (0.8 + pulse * 0.16), j.s * (1 - pulse * 0.06));
      j.tent.scale.y = j.s * (1 - pulse * 0.1);
    });

    // Schatztruhe
    chest.open += clamp(chest.target - chest.open, -dt * 0.9, dt * 0.9);
    const eo = smooth(0, 1, chest.open);
    chest.lid.rotation.x = -eo * 1.9;
    chest.pile.visible = chest.open > 0.2;
    chest.light.intensity = 70 * eo * (0.8 + 0.2 * Math.sin(time * 5));
    chest.beam.material.opacity = 0.1 + 0.05 * Math.sin(time * 2) + 0.1 * eo;
    chest.spk.visible = chest.open > 0.5;
    if (chest.spk.visible) {
      for (let i = 0; i < 28; i++) {
        const s = chest.spkSeed[i], q = (time * 0.7 + s[1]) % 1;
        chest.spkPos[i * 3] = s[0] * 2.4; chest.spkPos[i * 3 + 1] = 1.1 + q * 4; chest.spkPos[i * 3 + 2] = s[2] * 1.4;
      }
      chest.spk.geometry.attributes.position.needsUpdate = true;
    }

    // Sehenswürdigkeiten
    if (!sights[0].visited) {
      const dx = sp.x - ARCH.x, dz = sp.z - ARCH.z;
      const lx = dx * archC - dz * archS, lz = dx * archS + dz * archC, ly = sp.y - archAY;
      if (Math.abs(lz) < 45) {
        const s = lz >= 0 ? 1 : -1;
        if (archPrev !== 0 && s !== archPrev && Math.hypot(lx, ly) < ARCH.R - ARCH.tube) mark(0);
        archPrev = s;
      } else archPrev = 0;
    }
    if (!sights[1].visited && sp.distanceTo(chestPos) < 24) mark(1);
    const dShark = sp.distanceTo(shark.pos);
    if (!sights[2].visited && dShark < 36) mark(2);
    if (!sharkSeen && dShark < 150) { sharkSeen = true; ev('shark-found'); }
  }

  /* ==========================================================
     Öffentliche Schnittstelle
     ========================================================== */
  const pingTargets = [archPos, chestPos, shark.pos];
  const level = {
    group: root,
    WORLD: WORLD2,
    meta: {
      icons: ['🌉', '💰', '🦈'],
      names: { de: ['Felsbogen', 'Schatz', 'Riffhai'], en: ['Arch', 'Treasure', 'Reef shark'] }
    },
    spawn: { position: new THREE.Vector3(0, -3.2, 12), yaw: 0 },
    schools,
    fauna: { pods: [{ members: turtles.map((T) => ({ pos: T.pos })) }, { members: [{ pos: shark.pos }] }], rays: mantas.map((M) => ({ w: M.w })), jellies },
    sights,
    get sightCount() { return sightCount; },
    get time() { return time; },

    setViewDistance(v) { scene.fog.density = FOG_BASE / Math.max(0.3, v); },
    update,
    collideSub,
    drainEvents() { const out = events.slice(); events.length = 0; return out; },
    isAtPlatform(p) { return Math.abs(p.x) < 16 && p.z > -22 && p.z < 36 && p.y > -12; },

    getPings(pos, yaw, out) {
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      out.length = 3;
      for (let i = 0; i < 3; i++) {
        const t = pingTargets[i];
        const dx = t.x - pos.x, dz = t.z - pos.z;
        const fwd = -sy * dx - cy * dz, right = cy * dx - sy * dz;
        let o = out[i];
        if (!o || typeof o !== 'object') o = out[i] = {};
        o.id = i;
        o.ang = Math.atan2(right, fwd);
        o.dist = Math.hypot(dx, t.y - pos.y, dz);
        o.done = sights[i].visited;
      }
      return out;
    },

    visitAll() { for (let i = 0; i < 3; i++) mark(i); },

    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
        if (o.isInstancedMesh && o.dispose) o.dispose();
      });
      scene.remove(root);
      scene.fog = prevFog || null;
      scene.background = prevBg || null;
      events.length = 0;
    }
  };
  return level;
}

/* Aliase im Stil von world.js */
export const createLevel2 = buildLevel2;
export function updateLevel2(level, dt, ctx) { level.update(dt, ctx); }
