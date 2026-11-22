/* ============================================================
   BEYOND MARIANA – level3.js  (LEVEL 3: MARIANA TRENCH, 11.000 m)
   Gewaltiger tektonischer Tiefsee-Graben ("Mariana Rift"):
   - Steile, zerklüftete Basalt-Felswände links und rechts, Graben-Ende als Sackgasse
   - Grund mit glühenden Lava-Feldern + Magma-Spalten (animierte Lava-Textur,
     Emissive-Shader, 2 Lava-Punktlichter, warmes Hemisphären-Bodenlicht)
   - Turmhohe hydrothermale Schlote ("Black Smokers") mit Rauch- und Glut-Partikeln
   - Hunderte Biolumineszenz-Schwämme, Pilze, Röhrenwürmer, Laternen-Stängel
     und Fächer (Cyan, Neon-Blau, Violett, Magenta) – alles als Instanzen
   - Leuchtende Laternenfisch-Schwärme + sanfte Leucht-Quallen
   - Sehenswürdigkeiten: 0 = Lava-Feld mit Riesen-Schloten,
     1 = versunkenes Forschungs-U-Boot in einer Felsspalte (mit Scheinwerfern),
     2 = gigantischer Anglerfisch / Tiefsee-Monster
   Lichtstimmung: violett-blauer Nebel mit hoher Sichtweite, viel Umgebungslicht.
   Performance: geteilte Geometrien/Materialien, Instancing, ein Mesh für alle Felsen.

   Gleiche Schnittstelle wie world.js / level2.js:
     buildLevel3(scene, renderer) -> level
   level.spawn, schools, fauna, sights, sightCount, setViewDistance(v),
   update(dt, ctx), collideSub(p, vel, r), drainEvents(), isAtPlatform(p),
   getPings(pos, yaw, out), visitAll(), dispose()
   WORLD3.depthScale: Anzeige-Tiefe = echte Tiefe * depthScale (≈ 11.000 m am Grund)
   ============================================================ */

import * as THREE from 'three';

export const WORLD3 = { cameraFar: 1300, darkDepth: 99999, radius: 330, depthScale: 52 };

const DENSITY = 1;           // 0.6 = leichter für ältere iPads
const dn = (n) => Math.max(1, Math.round(n * DENSITY));

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
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------
   Welt-Layout
   ------------------------------------------------------------ */
const FOG_COL = 0x181c5c;
const FOG_BASE = 0.0036;
const RIM = -48;                 // Hochplateau neben dem Graben
const Z_END_OPEN = -690;         // dahinter schließt sich der Graben
const BX = 290, ZMIN = -790, ZMAX = 120;

const PAL = [0x19e6ff, 0x2f7bff, 0xa05cff, 0xff3fd0, 0x35ffd8];   // Cyan, Neon-Blau, Violett, Magenta, Türkis

function riftC(z) { return 55 * Math.sin(z * 0.0062 + 0.4) + 18 * Math.sin(z * 0.017 + 1.7); }
function riftW(z) { return 62 + 20 * Math.sin(z * 0.0105 + 1.0) + 8 * Math.sin(z * 0.029); }
function riftFloorLevel(z) { return -48 - 164 * smooth(-60, -340, z); }

function mkLava(z, r, off) { return { x: riftC(z) + off, z, r }; }
const LAVA = [mkLava(-165, 34, 6), mkLava(-250, 48, -4), mkLava(-430, 85, 0), mkLava(-600, 52, -8)];
const MAIN_LAVA = LAVA[2];

const WRECK_Z = -565;
const WRECK_X = riftC(WRECK_Z) + riftW(WRECK_Z) * 0.68;

const DOCK_BOXES = [
  { x0: -13.2, x1: -9, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: 9, x1: 13.2, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: -13.2, x1: 13.2, z0: 32, z1: 37, y0: -90, y1: 1 }
];
const DOCK_PILLARS = [];
[-1, 1].forEach((s) => { for (let z = -12; z <= 28; z += 8) DOCK_PILLARS.push([s * 11.1, z]); });
[-12, 0, 12].forEach((x) => DOCK_PILLARS.push([x, 35]));

/* Meeresboden ohne Sonderzonen: Plateau + Graben mit steilen Wänden */
function baseH(x, z) {
  const rim = RIM + 4 * Math.sin(x * 0.021 + 0.7) * Math.cos(z * 0.017) + 2.2 * Math.sin(x * 0.066 + z * 0.051) + 1.2 * Math.sin(x * 0.15 - z * 0.12);
  const dx = x - riftC(z), W = riftW(z);
  const ex = Math.max(0, Z_END_OPEN - z);
  const a = Math.hypot(dx, ex * 1.25) / W;
  const t = smooth(0.62, 1.12, a);
  const fl = riftFloorLevel(z) + (3 * Math.sin(x * 0.05 + z * 0.04) + 1.8 * Math.sin(x * 0.13 - z * 0.09)) * (1 - t);
  let h = lerp(fl, rim, t);
  const bulge = t * (1 - t) * 4;                                   // zerklüftete Wand
  h += bulge * (Math.sin(z * 0.23 + x * 0.17) * Math.sin(x * 0.31 - z * 0.11) * 4.5 + Math.sin(z * 0.61 + x * 0.43) * 1.6) * 2.2;
  h += (smooth(255, 300, Math.abs(x)) + smooth(100, 135, z) + smooth(770, 805, -z)) * 70;   // Welt-Rand
  return h;
}

/* Flache Zone für die Felsspalte mit dem Forschungs-U-Boot */
const ZONES = [{ x: WRECK_X, z: WRECK_Z, r: 20 }];
ZONES.forEach((Z) => { Z.h = baseH(Z.x, Z.z); Z.r2 = Z.r * Z.r; });

function floorH(x, z) {
  let h = baseH(x, z);
  for (let i = 0; i < ZONES.length; i++) {
    const Z = ZONES[i];
    const dx = x - Z.x, dz = z - Z.z, d2 = dx * dx + dz * dz;
    if (d2 >= Z.r2) continue;
    const w = 1 - smooth(Z.r * 0.5, Z.r, Math.sqrt(d2));
    h += (Z.h - h) * w;
  }
  return h;
}

function terrainNormal(x, z, out) {
  const E = 2.0;
  const hx = floorH(x + E, z) - floorH(x - E, z);
  const hz = floorH(x, z + E) - floorH(x, z - E);
  return out.set(-hx / (2 * E), 1, -hz / (2 * E)).normalize();
}

/* Lava-Leuchtstärke 0..1 (Felder + Magma-Spalten am Grund und unteren Wandfuß) */
function lavaGlow(x, z, h) {
  if (z > -90) return 0;
  const dx = x - riftC(z), W = riftW(z), a = Math.abs(dx) / W;
  const inside = 1 - smooth(0.55, 0.95, a);
  if (inside <= 0.001) return 0;
  const fl = riftFloorLevel(z);
  const hf = 1 - smooth(fl + 4, fl + 40, h);
  let g = 0;
  for (let i = 0; i < LAVA.length; i++) {
    const L = LAVA[i];
    const d = Math.hypot(x - L.x, z - L.z);
    if (d < L.r) g = Math.max(g, 1 - smooth(L.r * 0.45, L.r, d));
  }
  const fw = Math.abs(Math.sin(dx * 0.11 + Math.sin(z * 0.027) * 2.5 + Math.sin(z * 0.011) * 3));
  g = Math.max(g, 0.85 * (1 - smooth(0.03, 0.16, fw)));
  return g * inside * hf;
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

/* Liste von Geometrien mit einheitlicher Vertex-Helligkeit (für Instanz-Farbe) */
const mc = (list, v) => mergeColored(list.map((g) => ({ geo: g, col: new THREE.Color(v, v, v) })));

function triGeo(v) {
  const g = new THREE.BufferGeometry();
  const r = [v[6], v[7], v[8], v[3], v[4], v[5], v[0], v[1], v[2]];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.concat(r), 3));
  return g;
}

function cylBetween(a, b, r0, r1, seg) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(a.x, a.y, a.z);
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

/* Lava-Textur: Voronoi-Risse (kachelbar), leuchtend orange-gelb auf dunkler Kruste */
function lavaTexture() {
  const S = 256, G = 6;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const r = mulberry32(77);
  const pts = [];
  for (let i = 0; i < G * G; i++) pts.push([r(), r()]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S * G, v = y / S * G, cx = Math.floor(u), cy = Math.floor(v);
      let f1 = 9, f2 = 9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i, gy = cy + j;
          const p = pts[(((gy % G) + G) % G) * G + (((gx % G) + G) % G)];
          const dx = gx + p[0] - u, dy = gy + p[1] - v, d = Math.sqrt(dx * dx + dy * dy);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      }
      const k = 1 - smooth(0, 0.16, f2 - f1);
      const base = 0.08 + 0.1 * (1 - smooth(0, 0.8, f1));
      const e = Math.min(1, k + base * 0.5);
      const o = (y * S + x) * 4;
      img.data[o] = Math.min(255, 30 + 225 * e);
      img.data[o + 1] = Math.min(255, 6 + 150 * e * e);
      img.data[o + 2] = Math.min(255, 2 + 30 * e * e * e);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
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
    ctx.fillStyle = '#7a5a40'; ctx.fillRect(0, 0, w, h);
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
    ctx.fillStyle = '#10153a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff5a2a'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8fefff'; ctx.font = 'bold 62px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('MARIANA TOURS', w / 2, 58);
    ctx.fillStyle = '#ffb02e'; ctx.font = 'bold 32px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('MARIANA TRENCH · 11.000 m', w / 2, 112);
  });
}

/* ------------------------------------------------------------
   Material für leuchtende Bio-Pflanzen (Instanzfarbe + Leuchten + Wiegen)
   ------------------------------------------------------------ */
const timeU = { value: 0 };

function bioMat(o) {
  o = o || {};
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide
  });
  const sway = o.sway || 0;
  const glow = o.glow === undefined ? 0.9 : o.glow;
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
         transformed.x += sin(uTime * 1.2 + ph + position.y * 0.9) * amt;
         transformed.z += cos(uTime * 0.95 + ph * 1.3 + position.y * 0.8) * amt * 0.8;
       #endif`
    );
    sh.fragmentShader = 'uniform float uGlow;\nuniform float uTime;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uGlow * (0.9 + 0.1 * sin(uTime * 1.7 + vViewPosition.x * 0.05));'
    );
  };
  m.customProgramCacheKey = () => 'bio-l3';
  return m;
}

/* ------------------------------------------------------------
   Bio-Geometrien (alle mit Vertex-Helligkeit: Spitzen = 1.0 leuchten stärker)
   ------------------------------------------------------------ */
function geoSpongeGlow(r) {
  const items = [];
  [[0, 0, 1.7, 0.55], [0.85, 0.35, 1.15, 0.42], [-0.6, 0.75, 0.95, 0.38], [0.15, -0.9, 1.35, 0.46], [-0.95, -0.35, 0.7, 0.32]].forEach(([x, z, h, rad]) => {
    const wob = 0.9 + r() * 0.2;
    const g = new THREE.CylinderGeometry(rad * 1.05 * wob, rad * 0.7, h, 9, 2, true);
    g.translate(x, h / 2 - 0.1, z);
    items.push({ geo: g, col: new THREE.Color(0.55, 0.55, 0.55) });
    const ring = new THREE.TorusGeometry(rad * 1.05 * wob, 0.08, 5, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(x, h - 0.1, z);
    items.push({ geo: ring, col: new THREE.Color(1, 1, 1) });
  });
  return mergeColored(items);
}

function geoMushroom() {
  const items = [];
  [[0, 0, 1, 0.3], [1.3, 0.7, 0.55, 0.2]].forEach(([x, z, s, rr]) => {
    const stem = new THREE.CylinderGeometry(0.16 * s, 0.28 * s, 1.3 * s, 7);
    stem.translate(x, 0.65 * s, z);
    items.push({ geo: stem, col: new THREE.Color(0.45, 0.45, 0.45) });
    const cap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1.15 * s, 0.55 * s, 1.15 * s);
    cap.translate(x, 1.3 * s, z);
    items.push({ geo: cap, col: new THREE.Color(1, 1, 1) });
    void rr;
  });
  return mergeColored(items);
}

function geoTubes(r) {
  const items = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.283, d = r() * 0.7, h = 1.8 + r() * 1.6, rad = 0.14 + r() * 0.1;
    const g = new THREE.CylinderGeometry(rad * 1.2, rad, h, 5, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.35);
    g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    items.push({ geo: g, col: new THREE.Color(0.5, 0.5, 0.5) });
    const tip = new THREE.SphereGeometry(rad * 1.7, 6, 4);
    tip.translate(Math.cos(a) * d + Math.sin((r() - 0.5) * 0.35) * h * 0.5, h, Math.sin(a) * d);
    items.push({ geo: tip, col: new THREE.Color(1, 1, 1) });
  }
  return mergeColored(items);
}

function geoStalks() {
  const items = [];
  [[0, 0, 3.0, 0.08], [0.45, 0.2, 2.2, -0.14], [-0.4, 0.25, 2.6, 0.12], [0.1, -0.45, 1.8, -0.1]].forEach(([x, z, h, tilt]) => {
    const g = new THREE.CylinderGeometry(0.03, 0.06, h, 4);
    g.translate(0, h / 2, 0);
    g.rotateZ(tilt);
    g.translate(x, 0, z);
    items.push({ geo: g, col: new THREE.Color(0.4, 0.4, 0.4) });
    const b = new THREE.SphereGeometry(0.3, 7, 5);
    b.translate(x - Math.sin(tilt) * h, Math.cos(tilt) * h, z);
    items.push({ geo: b, col: new THREE.Color(1, 1, 1) });
  });
  return mergeColored(items);
}

function geoFanGlow() {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const a = 0.2 + i * (Math.PI - 0.4) / 11;
    const g = new THREE.CylinderGeometry(0.025, 0.04, 1.65, 4);
    g.translate(0, 0.825, 0);
    g.rotateZ(a - Math.PI / 2);
    parts.push(g);
  }
  [0.5, 0.95, 1.4].forEach((rad) => {
    const t = new THREE.TorusGeometry(rad, 0.03, 4, 20, Math.PI - 0.4);
    t.rotateZ(0.2);
    parts.push(t);
  });
  const stalk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5);
  stalk.translate(0, -0.1, 0);
  parts.push(stalk);
  return mc(parts, 0.85);
}

/* Kantige Felsblöcke (Low-Poly) */
function geoRockBlock(rx, ry, rz, taper, yaw, lean, seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const sd = Math.floor(seed * 7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.74 + 0.5 * hash3(Math.round(x * 40) + sd, Math.round(y * 40), Math.round(z * 40));
    const vx = x * k, vy = y * k, vz = z * k;
    const f = 1 - taper * smooth(-1, 1, vy);
    p.setXYZ(i, vx * f * rx, vy * ry, vz * f * rz);
  }
  g.rotateZ(lean);
  g.rotateY(yaw);
  return g;
}

/* Schlot-Säule: unten verbreitert, nach oben verjüngt, Ringe + Mineral-Bänder */
function pillarGeo(seed) {
  const g = new THREE.CylinderGeometry(0.42, 1, 1, 14, 14, false);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    let k = 1 + 0.16 * Math.sin(a * 3 + y * 6 + seed) + 0.1 * Math.sin(a * 7 - y * 11 + seed * 2) + 0.06 * Math.sin(y * 38 + seed);
    k *= 1 + 0.9 * Math.exp(-y * 7);
    p.setXYZ(i, x * k, y, z * k);
    const band = 0.5 + 0.5 * Math.sin(y * 14 + a * 2 + seed);
    let r = 0.26 + 0.12 * band, gg = 0.24 + 0.1 * band, b = 0.34 + 0.12 * band;
    if (band > 0.82) { r += 0.12; b += 0.12; }
    const top = smooth(0.88, 1, y);
    r = lerp(r, 0.62, top * 0.7); gg = lerp(gg, 0.3, top * 0.7); b = lerp(b, 0.22, top * 0.7);
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------
   Fische
   ------------------------------------------------------------ */
const FISH_KINDS = {
  lantern: { body: 0x2fe8ff, tail: 0x9bf4ff, fin: 0x2fe8ff },
  violet: { body: 0xa05cff, tail: 0xd8b8ff, fin: 0xa05cff },
  magenta: { body: 0xff3fd0, tail: 0xffa0ec, fin: 0xff3fd0 },
  blue: { body: 0x3f7bff, tail: 0x9fc0ff, fin: 0x3f7bff }
};

function fishGeo(sp) {
  const body = new THREE.SphereGeometry(0.5, 10, 7);
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
   Forschungs-U-Boot (Wrack) mit leuchtenden Scheinwerfern
   ------------------------------------------------------------ */
function buildWreckSub() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.55, metalness: 0.2, emissive: 0x1a2030, emissiveIntensity: 0.6 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5, emissive: 0x401800, emissiveIntensity: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x7fe8ff, emissive: 0x2fc8ff, emissiveIntensity: 1.1, roughness: 0.1 });
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), hull); body.scale.set(3.2, 3.0, 5.6); g.add(body);
  const band = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), orange); band.scale.set(3.25, 1.25, 5.65); band.position.y = 1.2; g.add(band);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), glass); dome.scale.set(1.5, 1.3, 1.5); dome.position.set(0, 0.5, 4.6); g.add(dome);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 1.8), orange); fin.position.set(0, 3.4, -3.5); g.add(fin);
  [-1, 1].forEach((s) => {
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.8, 10), dark); th.rotation.x = Math.PI / 2; th.position.set(s * 1.8, 0, -5.8); g.add(th);
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 6.5), dark); skid.position.set(s * 2.4, -2.6, 0.4); g.add(skid);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lampM); lamp.position.set(s * 1.9, -0.3, 5.3); g.add(lamp);
  });
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.4, 6), dark); arm.position.set(1.4, -2.4, 4.6); arm.rotation.set(0.5, 0, 0.9); g.add(arm);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff0b8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const beamGeo = new THREE.ConeGeometry(6.5, 30, 16, 1, true);
  beamGeo.translate(0, -15, 0);
  beamGeo.rotateX(-Math.PI / 2);
  [-1, 1].forEach((s) => { const b = new THREE.Mesh(beamGeo, beamMat); b.position.set(s * 1.9, -0.3, 5.5); g.add(b); });

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
  beacon.position.set(0, 4.6, -3.5); g.add(beacon);

  const light = new THREE.PointLight(0xaee8ff, 1600, 80, 2);
  light.position.set(0, 1.5, 9);
  g.add(light);
  return { g, beamMat, beacon, light };
}

/* ------------------------------------------------------------
   Tiefsee-Monster: riesiger Anglerfisch (Kopf zeigt nach +z)
   ------------------------------------------------------------ */
const _belly = new THREE.Color(0.55, 0.45, 0.48);

function blobGeo(rx, ry, rz, seed, wart) {
  const g = new THREE.SphereGeometry(1, 22, 16);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.10 * Math.sin(x * 5 + seed) * Math.sin(y * 4 + z * 3 + seed) + 0.07 * wart * Math.sin(x * 11 + y * 9 + z * 7 + seed * 2.3);
    const k = 1 + n;
    p.setXYZ(i, x * k * rx, y * k * ry, z * k * rz);
    const w = 0.5 + 0.5 * Math.sin(x * 11 + y * 9 + z * 7 + seed * 2.3);
    c.setRGB(0.24 + 0.2 * w, 0.15 + 0.11 * w, 0.28 + 0.13 * w);
    if (y < -0.35) c.lerp(_belly, smooth(-0.35, -0.9, y) * 0.8);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function teethGeo(n, rx, rz, zc, down, lenMin, lenMax, seed) {
  const parts = [];
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const ang = t * Math.PI;
    const x = Math.cos(ang) * rx, z = zc + Math.sin(ang) * rz;
    const front = Math.sin(ang);
    const len = (lenMin + r() * (lenMax - lenMin)) * (0.7 + 0.7 * front);
    const g = new THREE.ConeGeometry(0.38 + r() * 0.25, len, 6);
    g.translate(0, len / 2, 0);
    if (down) g.rotateX(Math.PI);
    g.rotateZ(-Math.cos(ang) * 0.18 * (down ? -1 : 1));
    g.translate(x, 0, z);
    parts.push(g);
  }
  return mergeGeos(parts);
}

function sidePhotos(items, cz, rx, ry, rz, n, lats, l0, l1, cols, size) {
  for (let s = -1; s <= 1; s += 2) {
    lats.forEach((lat, li) => {
      for (let k = 0; k < n; k++) {
        const l = l0 + (l1 - l0) * k / Math.max(1, n - 1);
        const x = s * rx * Math.cos(lat) * Math.cos(l), y = ry * Math.sin(lat), z = cz + rz * Math.cos(lat) * Math.sin(l);
        const sp = new THREE.SphereGeometry(size * (0.7 + 0.5 * ((k + li) % 3) / 2), 6, 4);
        sp.translate(x * 1.02, y * 1.02, z);
        items.push({ geo: sp, col: cols[(k + li) % cols.length] });
      }
    });
  }
}

function ringItems(items, cz, rx, ry, zs, col) {
  zs.forEach((z) => {
    const t = new THREE.TorusGeometry(1, 0.1, 5, 22);
    t.scale(rx, ry, 1);
    t.translate(0, 0, cz + z);
    items.push({ geo: t, col });
  });
}

function finParts(spikeEnds, membrane) {
  const sp = [], tr = [];
  spikeEnds.forEach((e) => { sp.push(cylBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(e[0], e[1], e[2]), 0.38, 0.06, 5)); });
  if (membrane) {
    for (let i = 0; i < spikeEnds.length - 1; i++) {
      const a = spikeEnds[i], b = spikeEnds[i + 1];
      tr.push(triGeo([0, 0, 0, a[0] * 0.92, a[1] * 0.92, a[2] * 0.92, b[0] * 0.92, b[1] * 0.92, b[2] * 0.92]));
    }
  }
  return { spikes: mergeGeos(sp), mem: tr.length ? mergeGeos(tr) : null };
}

function buildMonster() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, emissive: 0x2a0f35, emissiveIntensity: 0.9 });
  const jawM = new THREE.MeshStandardMaterial({ color: 0x3a2142, roughness: 0.7, emissive: 0x24102c, emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const toothM = new THREE.MeshStandardMaterial({ color: 0xf1e9c4, roughness: 0.4, emissive: 0x5a5026, emissiveIntensity: 0.8 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xeaff8a, emissive: 0xd8ff60, emissiveIntensity: 1.5, roughness: 0.25 });
  const pupM = new THREE.MeshBasicMaterial({ color: 0x050008 });
  const mouthM = new THREE.MeshStandardMaterial({ color: 0x6a0c28, emissive: 0x50061e, emissiveIntensity: 1.0, roughness: 0.8 });
  const memM = new THREE.MeshStandardMaterial({ color: 0x8a2a9a, emissive: 0x7a1a8a, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const phMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const CY = new THREE.Color(0x4ff0ff), MG = new THREE.Color(0xff3fd0), VI = new THREE.Color(0xa05cff);

  /* Kopf */
  const head = new THREE.Mesh(blobGeo(7, 7.2, 8.5, 1.3, 1), skin); head.position.set(0, 1.2, 0); body.add(head);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mouthM); mouth.scale.set(5.2, 2.3, 5.5); mouth.position.set(0, -2.6, 2.5); body.add(mouth);
  body.add(new THREE.Mesh(teethGeo(15, 5.0, 6.6, 0.3, true, 1.8, 4.6, 11), toothM).translateY(-3.0));

  /* Unterkiefer */
  const jaw = new THREE.Group(); jaw.position.set(0, -3.4, 0); body.add(jaw);
  const bowlG = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  bowlG.rotateX(Math.PI);
  const bowl = new THREE.Mesh(bowlG, jawM); bowl.scale.set(5.4, 2.8, 8.8); bowl.position.set(0, -0.2, 4.3); jaw.add(bowl);
  const lower = new THREE.Mesh(teethGeo(13, 4.9, 8.0, 0.4, false, 3.0, 8.0, 23), toothM); lower.position.y = -0.2; jaw.add(lower);

  /* Glupschaugen */
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 12), eyeM); eye.position.set(s * 4.7, 4.5, 5.0); body.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), pupM);
    pup.position.set(s * 4.7 + s * 0.9, 4.5 + 0.35, 5.0 + 1.3); body.add(pup);
    const brow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 5), skin.clone()); brow.material.vertexColors = false; brow.material.color.set(0x3a2446);
    brow.position.set(s * 4.7, 6.4, 4.8); brow.rotation.z = -s * 0.5; body.add(brow);
  });

  /* Lock-Angel */
  const lure = new THREE.Group(); lure.position.set(0, 7.8, 6.2); body.add(lure);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 4, 1.5), new THREE.Vector3(0, 6.5, 5), new THREE.Vector3(0, 5.5, 10), new THREE.Vector3(0, 2.5, 13)
  ]);
  lure.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.24, 6, false), jawM));
  const bulbPos = curve.getPoint(1);
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xcaffff });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 10), bulbM); bulb.position.copy(bulbPos); lure.add(bulb);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 10), new THREE.MeshBasicMaterial({
    color: 0x5fe8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  halo.position.copy(bulbPos); lure.add(halo);
  const spk = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const cn = new THREE.ConeGeometry(0.2, 1.4, 4);
    cn.translate(0, 0.7, 0);
    cn.rotateZ(-Math.cos(a) * 1.2);
    cn.rotateX(Math.sin(a) * 1.2);
    cn.translate(bulbPos.x, bulbPos.y, bulbPos.z);
    spk.push(cn);
  }
  lure.add(new THREE.Mesh(mergeGeos(spk), bulbM));
  const light = new THREE.PointLight(0x8ff0ff, 2600, 110, 2); light.position.copy(bulbPos); lure.add(light);

  /* Körper-Segmente (Schwanz-Kette) */
  const mkSeg = (rx, ry, rz, seed, parent, z) => {
    const seg = new THREE.Group(); seg.position.set(0, 0, z); parent.add(seg);
    const m = new THREE.Mesh(blobGeo(rx, ry, rz, seed, 1), skin); m.position.z = -rz * 0.55; seg.add(m);
    return seg;
  };
  const tail1 = mkSeg(5.4, 5.8, 8.2, 2.1, body, -6.5);
  const tail2 = mkSeg(3.6, 4.0, 7.2, 3.7, tail1, -8.6);
  const tail3 = mkSeg(2.2, 2.6, 5.5, 5.3, tail2, -7.0);

  /* Rückenstacheln */
  const spineItems = (z0, z1, n, y, h) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const z = lerp(z0, z1, i / Math.max(1, n - 1));
      const cn = new THREE.ConeGeometry(0.55, h * (0.7 + 0.5 * ((i * 7) % 5) / 4), 5);
      cn.translate(0, h / 2, 0);
      cn.rotateX(-0.35);
      cn.translate(0, y, z);
      out.push({ geo: cn, col: new THREE.Color(0.32, 0.16, 0.38) });
    }
    return out;
  };
  body.add(new THREE.Mesh(mergeColored(spineItems(-4, 3, 5, 7.6, 4.5)), skin));
  tail1.add(new THREE.Mesh(mergeColored(spineItems(-1, -10, 4, 5.4, 4.0)), skin));
  tail2.add(new THREE.Mesh(mergeColored(spineItems(-0.5, -7, 3, 3.9, 3.2)), skin));

  /* Leucht-Muster: Photophoren + Ringe */
  const pItems = [];
  sidePhotos(pItems, 0.0, 7.0, 7.2, 8.5, 9, [-0.05, 0.28], -1.0, 1.15, [CY, MG, VI], 0.42);
  body.add(new THREE.Mesh(mergeColored(pItems), phMat));
  const t1 = []; sidePhotos(t1, -4.5, 5.4, 5.8, 8.2, 7, [0.05, 0.4], -0.9, 0.9, [MG, CY], 0.42); ringItems(t1, -4.5, 5.45, 5.85, [-3.5, 0, 3.5], MG);
  tail1.add(new THREE.Mesh(mergeColored(t1), phMat));
  const t2 = []; sidePhotos(t2, -4, 3.6, 4.0, 7.2, 6, [0.1], -0.9, 0.9, [CY, VI], 0.36); ringItems(t2, -4, 3.65, 4.05, [-2.8, 1.5], CY);
  tail2.add(new THREE.Mesh(mergeColored(t2), phMat));
  const t3 = []; sidePhotos(t3, -3, 2.2, 2.6, 5.5, 4, [0.1], -0.8, 0.8, [MG, CY], 0.3); ringItems(t3, -3, 2.25, 2.65, [-1.5], VI);
  tail3.add(new THREE.Mesh(mergeColored(t3), phMat));

  /* Schwanzflosse (senkrecht, zerfranst) */
  const tailEnds = [];
  for (let i = 0; i < 8; i++) {
    const ph = -1.15 + i * (2.3 / 7), L = 8 + ((i * 5) % 4) * 2.5;
    tailEnds.push([0, Math.sin(ph) * L, -Math.cos(ph) * L]);
  }
  const tf = finParts(tailEnds, true);
  const tfG = new THREE.Group(); tfG.position.z = -9; tail3.add(tfG);
  tfG.add(new THREE.Mesh(tf.spikes, skin.clone()));
  tfG.children[0].material.vertexColors = false; tfG.children[0].material.color.set(0x3a2446);
  tfG.add(new THREE.Mesh(tf.mem, memM));

  /* Brustflossen */
  const fins = [];
  [-1, 1].forEach((s) => {
    const ends = [];
    for (let i = 0; i < 6; i++) {
      const ph = -0.9 + i * 0.36, L = 8 + ((i * 3) % 3) * 2;
      ends.push([s * Math.cos(ph) * L, -0.25 * L, -Math.sin(ph) * L * 0.8]);
    }
    const f = finParts(ends, true);
    const fg = new THREE.Group(); fg.position.set(s * 6.8, -1.6, 0.5); body.add(fg);
    const sm = new THREE.MeshStandardMaterial({ color: 0x3a2446, roughness: 0.7 });
    fg.add(new THREE.Mesh(f.spikes, sm));
    fg.add(new THREE.Mesh(f.mem, memM));
    fins.push(fg);
  });

  g.scale.setScalar(2.2);
  return { g, body, jaw, tail1, tail2, tail3, fins, lure, light, bulbM, phMat, halo };
}

/* ============================================================
   buildLevel3
   ============================================================ */
export function buildLevel3(scene, renderer) {
  void renderer;
  const root = new THREE.Group();
  root.name = 'level3-mariana-trench';
  scene.add(root);

  const prevFog = scene.fog, prevBg = scene.background;
  scene.background = new THREE.Color(FOG_COL);
  scene.fog = new THREE.FogExp2(FOG_COL, FOG_BASE);

  const rng = mulberry32(20261122);
  const events = [];
  const ev = (type, data) => events.push(Object.assign({ type }, data));
  let time = 0;
  const dummy = new THREE.Object3D();
  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _nrm = new THREE.Vector3();
  const _nrm2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* ---------- Licht: viel Umgebungslicht, warmes Licht von unten ---------- */
  root.add(new THREE.HemisphereLight(0x8a9cff, 0xff6a30, 1.9));
  root.add(new THREE.AmbientLight(0x4a4ab0, 1.0));
  const sun = new THREE.DirectionalLight(0xa8b8ff, 1.4);
  sun.position.set(-60, 220, 40);
  root.add(sun); root.add(sun.target);
  const lavaLights = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff6a24, 4200, 170, 2);
    l.position.set(LAVA[1].x, -150, LAVA[1].z);
    root.add(l);
    return l;
  });

  /* ---------- Wasseroberfläche ---------- */
  const surfGeo = new THREE.PlaneGeometry(3000, 3000); surfGeo.rotateX(-Math.PI / 2);
  const surfBack = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({ color: 0x4a66d8, side: THREE.BackSide, transparent: true, opacity: 0.85 }));
  const surfTop = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({ color: 0x2a64b8, side: THREE.FrontSide, transparent: true, opacity: 0.8, depthWrite: false }));
  root.add(surfBack); root.add(surfTop);

  /* ---------- Meeresboden / Graben (ein Mesh, Lava-Emissive-Shader) ---------- */
  const lavaTex = lavaTexture();
  const _vio = new THREE.Color(0.34, 0.26, 0.5), _sed = new THREE.Color(0.34, 0.42, 0.5), _scorch = new THREE.Color(0.32, 0.14, 0.1);
  function floorColor(x, z, h, sl, g, c) {
    c.setRGB(0.24, 0.25, 0.36);
    const n = Math.sin(x * 0.045 + 1) * Math.sin(z * 0.05 + 2);
    c.lerp(_vio, 0.35 * smooth(-0.2, 0.8, n));
    c.multiplyScalar(0.85 + 0.3 * (0.5 + 0.5 * Math.sin(h * 0.45 + x * 0.03)));
    c.lerp(_sed, smooth(-60, -49, h) * 0.8);
    c.multiplyScalar(1 - 0.35 * smooth(0.5, 1.4, sl));
    c.lerp(_scorch, clamp(g * 1.2, 0, 1) * 0.8);
  }
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.uniforms.uLava = { value: lavaTex };
    sh.vertexShader = 'attribute float aGlow;\nvarying float vGlow;\nvarying vec2 vLavaUv;\nuniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n vGlow = aGlow; vLavaUv = position.xz * 0.035 + vec2(uTime * 0.004, uTime * 0.0025);'
    );
    sh.fragmentShader = 'uniform sampler2D uLava;\nuniform float uTime;\nvarying float vGlow;\nvarying vec2 vLavaUv;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       vec3 lv = texture2D(uLava, vLavaUv).rgb;
       float pulse = 0.85 + 0.15 * sin(uTime * 1.3 + vLavaUv.x * 20.0);
       totalEmissiveRadiance += (lv * 1.9 + vec3(0.35, 0.08, 0.01) * vGlow) * vGlow * pulse;`
    );
  };
  floorMat.customProgramCacheKey = () => 'floor-l3';
  {
    const fg = new THREE.PlaneGeometry(620, 970, 155, 243);
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, 0, -335);
    const p = fg.attributes.position;
    const col = new Float32Array(p.count * 3), glow = new Float32Array(p.count), c = new THREE.Color();
    const E = 3.0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = floorH(x, z);
      const sl = Math.hypot(floorH(x + E, z) - h, floorH(x, z + E) - h) / E;
      const gl = lavaGlow(x, z, h);
      p.setY(i, h);
      floorColor(x, z, h, sl, gl, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      glow[i] = gl;
    }
    fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    fg.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    fg.computeVertexNormals();
    const floorMesh = new THREE.Mesh(fg, floorMat);
    floorMesh.frustumCulled = false;
    root.add(floorMesh);
  }

  /* ---------- Hydrothermale Schlote (Black Smokers) ---------- */
  const pillars = [];
  const addPillar = (x, z, r, h) => {
    const fy = floorH(x, z);
    const y0 = fy - 3, y1 = Math.min(fy + h, -26);
    if (y1 - y0 < 12) return;
    pillars.push({ x, z, r, y0, y1, h: y1 - y0 });
  };
  for (let i = 0; i < 9; i++) {                                // riesiger Ring um das Haupt-Lavafeld
    const a = i / 9 * Math.PI * 2 + 0.3, rad = 22 + rng() * 32;
    addPillar(MAIN_LAVA.x + Math.cos(a) * rad, MAIN_LAVA.z + Math.sin(a) * rad, 4.5 + rng() * 4.5, 60 + rng() * 45);
  }
  [1, 3, 0].forEach((li) => {
    const L = LAVA[li];
    for (let i = 0; i < 3; i++) {
      const a = rng() * 6.283, rad = 8 + rng() * L.r * 0.6;
      addPillar(L.x + Math.cos(a) * rad, L.z + Math.sin(a) * rad, 3.5 + rng() * 3.5, 40 + rng() * 40);
    }
  });
  for (let i = 0; i < 7; i++) {                                // einzelne Säulen entlang des Grabens
    const z = -150 - i * 85 - rng() * 30, x = riftC(z) + (rng() - 0.5) * riftW(z) * 1.0;
    addPillar(x, z, 3.5 + rng() * 3, 45 + rng() * 40);
  }
  {
    const geos = [pillarGeo(1.7), pillarGeo(4.1), pillarGeo(7.3)];
    const groups = [[], [], []];
    pillars.forEach((P, i) => groups[i % 3].push(P));
    const pillarMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0x201830, emissiveIntensity: 0.8 });
    groups.forEach((list, gi) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geos[gi], pillarMat, list.length);
      list.forEach((P, i) => {
        dummy.position.set(P.x, P.y0, P.z);
        dummy.rotation.set(0, rng() * 6.283, 0);
        dummy.scale.set(P.r, P.h, P.r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    });
    // glühende Schlot-Öffnungen
    const ventG = new THREE.CircleGeometry(0.34, 12); ventG.rotateX(-Math.PI / 2);
    const vent = new THREE.InstancedMesh(ventG, new THREE.MeshBasicMaterial({ color: 0xff7a30, side: THREE.DoubleSide }), pillars.length);
    pillars.forEach((P, i) => {
      dummy.position.set(P.x, P.y1 + 0.15, P.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(P.r, 1, P.r);
      dummy.updateMatrix();
      vent.setMatrixAt(i, dummy.matrix);
    });
    vent.instanceMatrix.needsUpdate = true;
    vent.frustumCulled = false;
    root.add(vent);
  }
  const pillarR = (P, t) => P.r * (1 - 0.58 * t) * (1 + 0.9 * Math.exp(-7 * t)) * 1.05;

  /* ---------- Felsen: Boulder + Felsspalte (ein Mesh, Kugel-Kollision) ---------- */
  const spheres = [];
  const addSphere = (x, y, z, r) => spheres.push({ x, y, z, r });
  const cragItems = [];
  const _cc = new THREE.Color();
  function rockColor(baseY, topY, seed) {
    const span = Math.max(1, topY - baseY);
    return (x, y, z) => {
      const t = clamp((y - baseY) / span, 0, 1);
      const band = 0.5 + 0.5 * Math.sin(y * 0.85 + x * 0.04 + z * 0.03 + seed);
      let r = 0.34 + 0.12 * band, g = 0.32 + 0.1 * band, b = 0.46 + 0.1 * band;
      const tp = smooth(0.75, 1, t) * 0.3;
      r = lerp(r, 0.6, tp); g = lerp(g, 0.58, tp); b = lerp(b, 0.7, tp);
      const hv = 0.92 + 0.16 * hash3(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3));
      return _cc.setRGB(r * hv, g * hv, b * hv);
    };
  }
  function addRock(cx, cy, cz, rx, ry, rz, yaw, taper, lean, seed) {
    const gg = geoRockBlock(rx, ry, rz, taper, yaw, lean, seed);
    gg.translate(cx, cy, cz);
    cragItems.push({ geo: gg, col: rockColor(cy - ry, cy + ry, seed) });
    const rs = Math.max(1.5, Math.min(rx, rz, ry) * 0.8), st = rs * 1.15;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    for (let ox = -rx * 0.8; ox <= rx * 0.8 + 0.01; ox += st) {
      for (let oy = -ry * 0.8; oy <= ry * 0.8 + 0.01; oy += st) {
        for (let oz = -rz * 0.8; oz <= rz * 0.8 + 0.01; oz += st) {
          if ((ox / rx) * (ox / rx) + (oy / ry) * (oy / ry) + (oz / rz) * (oz / rz) <= 0.85) {
            addSphere(cx + ox * cyw + oz * syw, cy + oy, cz - ox * syw + oz * cyw, rs);
          }
        }
      }
    }
  }

  const archWreckGy = floorH(WRECK_X, WRECK_Z);
  const blocked = (x, z) => {
    if (x > -24 && x < 24 && z > -30 && z < 46) return true;                                  // Dock
    for (let i = 0; i < pillars.length; i++) {
      const P = pillars[i];
      if (Math.hypot(x - P.x, z - P.z) < P.r * 1.2 + 2) return true;
    }
    if (Math.hypot(x - WRECK_X, z - WRECK_Z) < 22) return true;                               // Felsspalte
    return false;
  };

  // Boulder auf dem Grabenboden
  for (let i = 0, tries = 0; i < 26 && tries < 400; tries++) {
    const z = -130 - rng() * 560, x = riftC(z) + (rng() - 0.5) * riftW(z) * 1.1;
    if (blocked(x, z)) continue;
    const h = floorH(x, z);
    if (h > -60) continue;
    const r = 3 + rng() * 5;
    addRock(x, h + r * 0.3, z, r, r * 0.9, r * (0.8 + rng() * 0.4), rng() * 6.283, 0.2, 0, rng() * 50);
    i++;
  }
  // Felsspalte für das Forschungs-U-Boot (offen zur Grabenmitte hin, Richtung -x)
  addRock(WRECK_X + 13, archWreckGy + 15, WRECK_Z, 4, 17, 14, 0, 0.15, 0, 3.3);
  addRock(WRECK_X + 3, archWreckGy + 13, WRECK_Z - 12.5, 10, 15, 3.5, 0, 0.2, 0.02, 8.1);
  addRock(WRECK_X + 3, archWreckGy + 12, WRECK_Z + 12.5, 10, 14, 3.5, 0, 0.2, -0.02, 12.7);
  addRock(WRECK_X + 3, archWreckGy + 25, WRECK_Z, 10, 3, 14, 0, 0.1, 0, 5.9);
  {
    const cragMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, emissive: 0x141028, emissiveIntensity: 0.7 });
    const cragMesh = new THREE.Mesh(mergeColored(cragItems), cragMat);
    cragMesh.frustumCulled = false;
    root.add(cragMesh);
  }

  /* ---------- Biolumineszenz-Pflanzen (Instanzen) ---------- */
  const pl = { sponge: [], mush: [], tube: [], stalk: [], fan: [] };
  const target = { sponge: dn(120), mush: dn(160), tube: dn(150), stalk: dn(250), fan: dn(90) };
  const cnt = { sponge: 0, mush: 0, tube: 0, stalk: 0, fan: 0 };
  const SCALE = { sponge: [1.5, 3.5], mush: [1.4, 3.5], tube: [1.5, 3.2], stalk: [1.5, 3.0], fan: [1.5, 3.0] };
  const addPlant = (type, x, y, z, q, s) => {
    pl[type].push({ x, y, z, q, s: s === undefined ? lerp(SCALE[type][0], SCALE[type][1], rng()) : s, c: PAL[Math.floor(rng() * PAL.length)] });
    cnt[type]++;
  };
  const qFromNormal = (n, tilt) => {
    _nrm2.copy(n).lerp(UP, tilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, _nrm2);
    return q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * 6.283));
  };
  const TYPES_ALL = ['stalk', 'stalk', 'mush', 'tube', 'sponge', 'fan', 'stalk', 'mush'];
  const TYPES_WALL = ['sponge', 'mush', 'tube', 'fan'];
  const total = () => cnt.sponge + cnt.mush + cnt.tube + cnt.stalk + cnt.fan;
  const goal = target.sponge + target.mush + target.tube + target.stalk + target.fan;
  for (let tries = 0; tries < 9000 && total() < goal; tries++) {
    let x, z;
    if (rng() < 0.35) {
      const L = LAVA[Math.floor(rng() * LAVA.length)], a = rng() * 6.283, r = L.r * (0.4 + rng() * 1.2);
      x = L.x + Math.cos(a) * r; z = L.z + Math.sin(a) * r;
    } else {
      z = -60 - rng() * 640; x = riftC(z) + (rng() * 2 - 1) * riftW(z) * 1.25;
    }
    if (blocked(x, z)) continue;
    const h = floorH(x, z);
    if (h > -44) continue;
    terrainNormal(x, z, _nrm);
    const slope = 1 - _nrm.y;
    const list = slope > 0.5 ? TYPES_WALL : TYPES_ALL;
    const type = list[Math.floor(rng() * list.length)];
    if (cnt[type] >= target[type]) continue;
    addPlant(type, x, h - 0.15, z, qFromNormal(_nrm, 0.45));
  }
  // Röhrenwürmer und Pilze direkt an den Schloten
  pillars.forEach((P) => {
    for (let k = 0; k < 9; k++) {
      const a = rng() * 6.283, t = k < 5 ? rng() * 0.12 : 0.15 + rng() * 0.55;
      const rr = pillarR(P, t) * 0.92;
      _nrm.set(Math.cos(a), 0.5, Math.sin(a)).normalize();
      const type = k % 3 === 0 ? 'mush' : (k % 3 === 1 ? 'tube' : 'sponge');
      addPlant(type, P.x + Math.cos(a) * rr, P.y0 + t * P.h, P.z + Math.sin(a) * rr, qFromNormal(_nrm, 0.1), lerp(1.2, 2.6, rng()));
    }
  });
  {
    const mats = {
      sponge: bioMat({ glow: 0.95 }), mush: bioMat({ glow: 1.0 }), tube: bioMat({ glow: 1.0, sway: 0.05 }),
      stalk: bioMat({ glow: 1.1, sway: 0.1 }), fan: bioMat({ glow: 0.95, sway: 0.05 })
    };
    const geos = { sponge: geoSpongeGlow(rng), mush: geoMushroom(), tube: geoTubes(rng), stalk: geoStalks(), fan: geoFanGlow() };
    Object.keys(pl).forEach((k) => {
      const list = pl[k];
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geos[k], mats[k], list.length);
      const col = new THREE.Color();
      list.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z);
        dummy.quaternion.copy(o.q);
        dummy.scale.setScalar(o.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        col.setHex(o.c);
        col.offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.1);
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    });
  }

  /* ---------- Partikel: Meeresschnee, Rauch, Glut, Blasen ---------- */
  const dotTex = dotTexture();
  const PLK = 600, PLK_S = 120;
  const plkBase = new Float32Array(PLK * 3);
  for (let i = 0; i < PLK * 3; i++) plkBase[i] = rng() * PLK_S;
  const plkGeo = new THREE.BufferGeometry();
  const plkPos = new Float32Array(PLK * 3);
  plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
  const plankton = new THREE.Points(plkGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.5, color: 0xb8c4ff, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true
  }));
  plankton.frustumCulled = false;
  root.add(plankton);

  const SMK = Math.max(1, pillars.length) * 12;
  const smokePos = new Float32Array(SMK * 3), smokeAge = new Float32Array(SMK);
  const smokeInfo = [];
  for (let i = 0; i < SMK; i++) {
    smokeInfo.push({ pi: i % Math.max(1, pillars.length), ph: rng() * 6.28, sp: 0.05 + rng() * 0.04 });
    smokeAge[i] = rng();
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute('aAge', new THREE.BufferAttribute(smokeAge, 1));
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: dotTex }, uColor: { value: new THREE.Color(0x6a6694) } },
    vertexShader: `attribute float aAge; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
        vA = (1.0 - aAge) * smoothstep(0.0, 0.08, aAge) * 0.55;
        gl_PointSize = (4.0 + aAge * 11.0) * 450.0 / max(1.0, -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(uColor, a); }`,
    transparent: true, depthWrite: false
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  if (pillars.length) root.add(smoke);

  const EMB = Math.max(1, pillars.length) * 5;
  const embPos = new Float32Array(EMB * 3), embAge = new Float32Array(EMB);
  const embInfo = [];
  for (let i = 0; i < EMB; i++) { embInfo.push({ pi: i % Math.max(1, pillars.length), ph: rng() * 6.28, sp: 0.15 + rng() * 0.15 }); embAge[i] = rng(); }
  const embGeo = new THREE.BufferGeometry();
  embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
  const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.9, color: 0xff8a3a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  }));
  embers.frustumCulled = false;
  if (pillars.length) root.add(embers);

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

  /* ---------- Dock / Station an der Oberfläche ---------- */
  const buoys = [];
  {
    const dock = new THREE.Group(); root.add(dock);
    const woodTex = woodTexture();
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a3a4a, roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x46535f, roughness: 0.45, metalness: 0.7 });
    const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); dock.add(b); return b; };
    DOCK_PILLARS.forEach(([x, z]) => {
      const fl = floorH(x, z), top = 0.5, bot = fl - 1.5, h = top - bot;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, h, 10), darkWood);
      pil.position.set(x, (top + bot) / 2, z);
      dock.add(pil);
    });
    [-1, 1].forEach((s) => {
      add(4.2, 1.0, 48, wood, s * 11.1, 0.3, 8);
      add(0.2, 0.2, 48, darkWood, s * 13.0, 1.9, 8);
      [-3, -12, -22, -34].forEach((y) => add(0.35, 0.35, 48, darkWood, s * 11.1, y, 8));
      for (let z = -14; z <= 30; z += 6) add(0.2, 1.4, 0.2, darkWood, s * 13.0, 1.3, z);
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 8), steel);
      lampPost.position.set(s * 12.4, 2.2, -14); dock.add(lampPost);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
      bulb.position.set(s * 12.4, 4.1, -14); dock.add(bulb);
    });
    add(26.4, 1.0, 5, wood, 0, 0.3, 34.5);
    [-3, -12, -22, -34].forEach((y) => add(26.4, 0.35, 0.35, darkWood, 0, y, 35));
    [-8, 8].forEach((x) => add(0.4, 8, 0.4, darkWood, x, 4.8, 36.6));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.rotation.y = Math.PI; sign.position.set(0, 7.2, 36.3); dock.add(sign);
    add(14.6, 5, 0.3, darkWood, 0, 7.2, 36.7);
    add(1.4, 1.2, 1.4, darkWood, -9, 1.4, 33);
    add(1.2, 1.0, 1.2, darkWood, -7.4, 1.3, 33.4);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.5 }));
    barrel.position.set(8.5, 1.5, 33.2); dock.add(barrel);
    [[-9, -19], [9, -19], [0, -24]].forEach(([x, z], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff3a3a, roughness: 0.4 }));
      b.position.set(x, 0.1, z); dock.add(b); buoys.push({ m: b, ph: i * 1.7 });
    });
  }

  /* ---------- Versunkenes Forschungs-U-Boot ---------- */
  const wreck = buildWreckSub();
  wreck.g.position.set(WRECK_X - 1, archWreckGy + 3.0, WRECK_Z);
  wreck.g.rotation.set(0.1, -Math.PI / 2 + 0.15, 0.28, 'YXZ');
  root.add(wreck.g);
  addSphere(WRECK_X - 1, archWreckGy + 3.0, WRECK_Z, 4.2);
  const wreckPos = new THREE.Vector3(WRECK_X - 4, archWreckGy + 4, WRECK_Z);

  /* ---------- Tiefsee-Monster ---------- */
  const monster = buildMonster();
  root.add(monster.g);
  const monsterPos = monster.g.position;
  function monsterPath(t, out) {
    const a = t * 0.045;
    const z = -455 + 235 * Math.cos(a);
    out.x = riftC(z) + 30 * Math.sin(a);
    out.z = z;
    out.y = Math.max(-190, floorH(out.x, out.z) + 42 + 7 * Math.sin(a * 3.1));
    return out;
  }
  monsterPath(0, monsterPos);

  /* ---------- Leucht-Fischschwärme ---------- */
  const fishMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const fishGeos = {};
  Object.keys(FISH_KINDS).forEach((k) => { fishGeos[k] = fishGeo(FISH_KINDS[k]); });
  const schools = [];
  function centerAt(s, t, out) {
    const a = t * s.w + s.ph;
    const z = s.bz + Math.cos(a * 0.83) * s.R;
    out.z = z;
    out.x = riftC(z) + Math.sin(a) * s.RX;
    out.y = clamp(floorH(out.x, out.z) + s.h + Math.sin(a * 0.7) * 4, -190, -8);
    return out;
  }
  function addSchool(kind, bz, R, RX, n, h, w) {
    const mesh = new THREE.InstancedMesh(fishGeos[kind], fishMat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    root.add(mesh);
    const s = { kind, bz, R, RX, h, w, ph: rng() * 6.28, mesh, fish: [], c: new THREE.Vector3(), cvel: new THREE.Vector3(), maxSp: 5.2 };
    centerAt(s, 0, s.c);
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(7 * Math.cbrt(rng()));
      s.fish.push({ pos: s.c.clone().add(off), vel: new THREE.Vector3((rng() - 0.5) * 2, 0, (rng() - 0.5) * 2), off, ph: rng() * 6.28, size: 3.0 * (0.85 + rng() * 0.3) });
    }
    schools.push(s);
  }
  [['lantern', -140], ['violet', -205], ['magenta', -280], ['blue', -350], ['lantern', -445], ['magenta', -520], ['violet', -610], ['blue', -680]]
    .forEach(([k, bz], i) => addSchool(k, bz, 38 + rng() * 14, 20 + rng() * 14, 22, 14 + rng() * 22, 0.1 + rng() * 0.04 + i * 0.001));

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
      const fl = floorH(f.pos.x, f.pos.z) + 1.5;
      if (f.pos.y < fl) f.pos.y = fl;
      if (f.pos.y > -8) f.pos.y = -8;
      dummy.position.copy(f.pos);
      if (spd > 0.05) { _look.copy(f.pos).add(f.vel); dummy.lookAt(_look); }
      dummy.rotateY(Math.sin(time * 8 + f.ph) * 0.12);
      dummy.scale.setScalar(f.size);
      dummy.updateMatrix();
      s.mesh.setMatrixAt(i, dummy.matrix);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Sanfte Leucht-Quallen (harmlos) ---------- */
  const JELLY_COLS = [0x35e8ff, 0xb48cff, 0xff5fd0, 0x5f9bff];
  const jellyBell = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const tentParts = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283, len = 2.8 + (i % 3) * 0.9;
    const tg = new THREE.CylinderGeometry(0.03, 0.05, len, 4, 1, true);
    tg.translate(Math.cos(a) * 0.55, -len / 2, Math.sin(a) * 0.55);
    tentParts.push(tg);
  }
  const jellyTent = mergeGeos(tentParts);
  const jellyMats = JELLY_COLS.map((c) => new THREE.MeshStandardMaterial({
    color: c, emissive: c, emissiveIntensity: 1.3, transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.3, depthWrite: false
  }));
  const jellies = [];
  for (let i = 0; i < 16; i++) {
    const z = -120 - rng() * 570, x = riftC(z) + (rng() - 0.5) * riftW(z) * 0.9;
    const s = 2.0 + rng() * 2.6, mat = jellyMats[i % jellyMats.length];
    const gj = new THREE.Group();
    const bell = new THREE.Mesh(jellyBell, mat); bell.scale.set(s, s * 0.8, s); gj.add(bell);
    const tent = new THREE.Mesh(jellyTent, mat); tent.scale.set(s, s, s); gj.add(tent);
    const base = new THREE.Vector3(x, Math.min(-12, floorH(x, z) + 15 + rng() * 45), z);
    gj.position.copy(base);
    root.add(gj);
    jellies.push({ g: gj, pos: gj.position, base, bell, tent, ph: rng() * 6.28, s });
  }

  /* ==========================================================
     Sehenswürdigkeiten
     ========================================================== */
  const lavaPos = new THREE.Vector3(MAIN_LAVA.x, floorH(MAIN_LAVA.x, MAIN_LAVA.z) + 22, MAIN_LAVA.z);
  const sights = [
    { kind: 'lava', visited: false },
    { kind: 'subwreck', visited: false },
    { kind: 'monster', visited: false }
  ];
  let sightCount = 0, lavaSeen = false, wreckSeen = false, monsterSeen = false;

  function mark(i) {
    if (sights[i].visited) return;
    sights[i].visited = true;
    sightCount++;
    ev('sight', { kind: sights[i].kind, count: sightCount });
    if (sightCount === 3) ev('all-sights');
  }

  /* ==========================================================
     Kollision (Höhenfeld mit steilen Wänden, Säulen, Felsen, Dock)
     ========================================================== */
  function collideSub(p, vel, R) {
    const isSub = R > 2;
    let impact = 0;

    // Welt-Grenzen
    if (p.x > BX) { p.x = BX; if (vel.x > 0) { impact = Math.max(impact, vel.x); vel.x = 0; } }
    if (p.x < -BX) { p.x = -BX; if (vel.x < 0) { impact = Math.max(impact, -vel.x); vel.x = 0; } }
    if (p.z > ZMAX) { p.z = ZMAX; if (vel.z > 0) { impact = Math.max(impact, vel.z); vel.z = 0; } }
    if (p.z < ZMIN) { p.z = ZMIN; if (vel.z < 0) { impact = Math.max(impact, -vel.z); vel.z = 0; } }

    // Gelände: Abstand zur Tangentialebene, Auswurf entlang der Normalen
    for (let it = 0; it < 3; it++) {
      const fh = floorH(p.x, p.z);
      const d0 = p.y - fh;
      if (d0 >= R * 6) break;
      terrainNormal(p.x, p.z, _nrm);
      const dist = d0 * _nrm.y;
      if (dist >= R) break;
      const push = Math.min(R - dist, 40);
      p.addScaledVector(_nrm, push);
      const vn = vel.x * _nrm.x + vel.y * _nrm.y + vel.z * _nrm.z;
      if (vn < 0) {
        impact = Math.max(impact, -vn);
        vel.x -= _nrm.x * vn; vel.y -= _nrm.y * vn; vel.z -= _nrm.z * vn;
      }
    }

    // Felskugeln
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

    // Schlot-Säulen (senkrechte Kapseln mit Kuppel)
    for (let i = 0; i < pillars.length; i++) {
      const P = pillars[i];
      const ty = clamp(p.y, P.y0, P.y1);
      const t = (ty - P.y0) / P.h;
      const rr = pillarR(P, t);
      const dx = p.x - P.x, dy = p.y - ty, dz = p.z - P.z;
      const lim = rr + R;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= lim * lim) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      p.x = P.x + nx * lim; p.y = ty + ny * lim; p.z = P.z + nz * lim;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }

    // Dock
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

    // Wasseroberfläche
    const maxY = isSub ? 0.5 : -0.8;
    if (p.y > maxY) { p.y = maxY; if (vel.y > 0 && isSub) vel.y = 0; }
    return impact;
  }

  /* ==========================================================
     Update pro Frame
     ========================================================== */
  const _cam = new THREE.Vector3();
  const _lt = new THREE.Vector3();
  function wrap(v, size) { return (((v % size) + size) % size) - size / 2; }

  function update(dt, ctx) {
    ctx = ctx || {};
    dt = Math.min(dt, 0.1);
    time += dt;
    timeU.value = time;
    const cam = ctx.camPos || _cam;
    const sp = ctx.subPos || cam;

    // Lava-Lichter: die zwei nächsten Felder, weich nachgeführt
    {
      const order = LAVA.map((L, i) => ({ i, d: Math.hypot(L.x - cam.x, L.z - cam.z) })).sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) {
        const L = LAVA[order[k].i];
        _lt.set(L.x, floorH(L.x, L.z) + 14, L.z);
        lavaLights[k].position.lerp(_lt, 1 - Math.exp(-2 * dt));
        lavaLights[k].intensity = 4200 * (0.92 + 0.08 * Math.sin(time * 2.1 + k * 2));
      }
    }

    // Meeresschnee
    for (let i = 0; i < PLK; i++) {
      plkPos[i * 3] = cam.x + wrap(plkBase[i * 3] - cam.x + Math.sin(time * 0.2 + i) * 2, PLK_S);
      plkPos[i * 3 + 1] = cam.y + wrap(plkBase[i * 3 + 1] - cam.y - time * 0.5, PLK_S);
      plkPos[i * 3 + 2] = cam.z + wrap(plkBase[i * 3 + 2] - cam.z, PLK_S);
    }
    plkGeo.attributes.position.needsUpdate = true;

    // Schlot-Rauch + Glut
    for (let i = 0; i < SMK && pillars.length; i++) {
      const I = smokeInfo[i], P = pillars[I.pi];
      smokeAge[i] += dt * I.sp;
      if (smokeAge[i] > 1) smokeAge[i] -= 1;
      const a = smokeAge[i];
      smokePos[i * 3] = P.x + Math.sin(I.ph + time * 0.5) * a * 7;
      smokePos[i * 3 + 1] = P.y1 + 1 + a * 38;
      smokePos[i * 3 + 2] = P.z + Math.cos(I.ph * 1.3 + time * 0.4) * a * 7;
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.aAge.needsUpdate = true;
    for (let i = 0; i < EMB && pillars.length; i++) {
      const I = embInfo[i], P = pillars[I.pi];
      embAge[i] += dt * I.sp;
      if (embAge[i] > 1) embAge[i] -= 1;
      const a = embAge[i];
      embPos[i * 3] = P.x + Math.sin(I.ph + time) * a * 3;
      embPos[i * 3 + 1] = P.y1 + 0.5 + a * 12;
      embPos[i * 3 + 2] = P.z + Math.cos(I.ph * 1.7 + time * 0.8) * a * 3;
    }
    embGeo.attributes.position.needsUpdate = true;

    // Propeller-Blasen
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

    buoys.forEach((b) => { b.m.position.y = 0.1 + Math.sin(time * 1.3 + b.ph) * 0.15; });

    // Fische + Quallen
    for (let i = 0; i < schools.length; i++) updateSchool(schools[i], dt);
    jellies.forEach((j) => {
      j.pos.set(j.base.x + Math.sin(time * 0.2 + j.ph) * 3, j.base.y + Math.sin(time * 0.5 + j.ph) * 2.5, j.base.z + Math.cos(time * 0.17 + j.ph) * 3);
      const pulse = Math.sin(time * 2.0 + j.ph);
      j.bell.scale.set(j.s * (1 - pulse * 0.06), j.s * (0.8 + pulse * 0.16), j.s * (1 - pulse * 0.06));
      j.tent.scale.y = j.s * (1 - pulse * 0.1);
    });

    // Forschungs-U-Boot: flackernde Scheinwerfer + SOS-Leuchte
    {
      const fl = 0.8 + 0.2 * Math.sin(time * 7) * Math.sin(time * 2.3) + (Math.sin(time * 0.9) > 0.93 ? -0.4 : 0);
      wreck.beamMat.opacity = 0.16 * clamp(fl, 0.3, 1.1);
      wreck.light.intensity = 1600 * clamp(fl, 0.3, 1.1);
      wreck.beacon.visible = Math.sin(time * 4) > 0;
    }

    // Monster: majestätisch durch den Graben, Kiefer / Schwanz / Flossen / Angel animiert
    {
      const M = monster;
      monsterPath(time, monsterPos);
      monsterPath(time + 0.8, _tmp);
      M.g.lookAt(_tmp);
      M.jaw.rotation.x = 0.32 + 0.22 * Math.sin(time * 0.8);
      M.tail1.rotation.y = Math.sin(time * 1.1) * 0.16;
      M.tail2.rotation.y = Math.sin(time * 1.1 - 0.9) * 0.24;
      M.tail3.rotation.y = Math.sin(time * 1.1 - 1.8) * 0.32;
      M.fins[0].rotation.z = Math.sin(time * 1.3) * 0.22;
      M.fins[1].rotation.z = -Math.sin(time * 1.3) * 0.22;
      M.lure.rotation.x = Math.sin(time * 0.9) * 0.1;
      M.lure.rotation.z = Math.sin(time * 0.7 + 1) * 0.08;
      const pu = 0.85 + 0.15 * Math.sin(time * 2.6);
      M.light.intensity = 2600 * pu;
      M.halo.material.opacity = 0.18 + 0.08 * Math.sin(time * 2.6);
      M.phMat.color.setScalar(0.75 + 0.25 * Math.sin(time * 1.9));
    }

    // Sehenswürdigkeiten
    const dLava = sp.distanceTo(lavaPos);
    if (!sights[0].visited && dLava < 70) mark(0);
    if (!lavaSeen && dLava < 260) { lavaSeen = true; ev('lava-found'); }
    const dWreck = sp.distanceTo(wreckPos);
    if (!sights[1].visited && dWreck < 30) mark(1);
    if (!wreckSeen && dWreck < 130) { wreckSeen = true; ev('wreck-found'); }
    const dMon = sp.distanceTo(monsterPos);
    if (!sights[2].visited && dMon < 55) mark(2);
    if (!monsterSeen && dMon < 220) { monsterSeen = true; ev('monster-found'); }
  }

  /* ==========================================================
     Öffentliche Schnittstelle
     ========================================================== */
  const pingTargets = [lavaPos, wreckPos, monsterPos];
  const level = {
    group: root,
    WORLD: WORLD3,
    meta: {
      icons: ['🌋', '🔬', '👹'],
      names: { de: ['Lavafeld', 'Forschungs-U-Boot', 'Tiefsee-Monster'], en: ['Lava field', 'Research sub', 'Deep-sea monster'] }
    },
    spawn: { position: new THREE.Vector3(0, -3.2, 12), yaw: 0 },
    schools,
    fauna: {
      pods: [{ members: [{ pos: monsterPos }] }],
      rays: [],
      jellies
    },
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
      lavaTex.dispose();
      dotTex.dispose();
      scene.remove(root);
      scene.fog = prevFog || null;
      scene.background = prevBg || null;
      events.length = 0;
    }
  };
  return level;
}

/* Aliase im Stil von world.js / level2.js */
export const createLevel3 = buildLevel3;
export function updateLevel3(level, dt, ctx) { level.update(dt, ctx); }
