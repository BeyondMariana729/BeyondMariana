/* ============================================================
   BEYOND MARIANA – level3.js  (LEVEL 3: MARIANA TRENCH, 11.000 m)

   Echter Tiefsee-Abstieg:
   - Lagune mit Dock an der Oberfläche, dann ein S-förmiger, ca. 1 km langer
     Unterwasser-Canyon (6 Engstellen, Felsvorsprünge, Schelfs, Stufen-Boden)
     bis in eine riesige Boss-Höhle mit hohem Felsdach (11.000 m).
   - Die Wände reichen bis über die Wasserlinie: man MUSS dem Canyon folgen.
   - "Minecraft-Glow": Pflanzen, Korallen, Pilze, Röhrenwürmer, Kristalle und
     Lava leuchten (emissive). Zusätzlich wird Licht in Terrain/Dach/Felsen
     eingebacken (Vertex-Licht) und ein kleiner Pool aus PointLights wandert
     automatisch zu den hellsten Zonen in Spielernähe (performant, konstant 6 Lichter).
   - Sehenswürdigkeiten: 0 = Forschungs-U-Boot auf einem Felsvorsprung (Alkoven),
     1 = leuchtende Kristall-Kluft (Seitenarm), 2 = Tiefsee-Monster in der Boss-Höhle.
   - Das Monster schwimmt eine beim Laden VALIDIERTE Bahn: alle Körperpunkte werden
     gegen Boden, Dach, Säulen und Felsen geprüft; die Bahn wird bei Bedarf
     automatisch verkleinert. Der Höhlen-Innenraum ist frei von Säulen/Felsen.

   Gleiche Schnittstelle wie world.js / level2.js:
     buildLevel3(scene, renderer) -> level
   level.spawn, schools, fauna, sights, sightCount, setViewDistance(v),
   update(dt, ctx), collideSub(p, vel, r), drainEvents(), isAtPlatform(p),
   getPings(pos, yaw, out), visitAll(), dispose()
   WORLD3.depthScale: Anzeige-Tiefe = echte Tiefe * depthScale (≈ 11.000 m am Höhlenboden)
   ============================================================ */

import * as THREE from 'three';

export const WORLD3 = { cameraFar: 1300, darkDepth: 99999, radius: 330, depthScale: 48.25 };

const DENSITY = 1;           // 0.6 = leichter für ältere iPads
const dn = (n) => Math.max(1, Math.round(n * DENSITY));
const LIGHT_POOL = 6;        // wandernde PointLights (konstant, kein Shader-Neukompilieren)

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
const FOG_BASE = 0.0033;
const RIM_HI = 6;                 // Felsmasse reicht über die Wasserlinie
const LAGOON_FLOOR = -48;
const CAVE_FLOOR = -228;          // * depthScale ≈ 11.000 m
const CAVE_ROOF = -50;
const LAG = { x: 0, z: 14, r: 62 };
const CAVE = { x: 0, z: -765, rx: 235, rz: 170 };
const CAVE_W0 = 0.82, CAVE_W1 = 0.97;     // Wandzone der Höhle (normierter Radius)
const BX = 300, ZMIN = -955, ZMAX = 110;

/* Höhenfeld-Gitter (Boden) */
const GX0 = -315, GX1 = 315, GZ0 = -985, GZ1 = 130;
const GNX = 158, GNZ = 279;
const GCX = (GX1 - GX0) / GNX, GCZ = (GZ1 - GZ0) / GNZ;
const GSTRIDE = GNX + 1;

/* Dach-Gitter (nur über der Boss-Höhle) */
const CRX0 = CAVE.x - CAVE.rx - 14, CRX1 = CAVE.x + CAVE.rx + 14;
const CRZ0 = CAVE.z - CAVE.rz - 14, CRZ1 = CAVE.z + CAVE.rz + 14;
const CNX = 110, CNZ = 82;
const CCX = (CRX1 - CRX0) / CNX, CCZ = (CRZ1 - CRZ0) / CNZ;
const CSTRIDE = CNX + 1;

const PAL = [0x19e6ff, 0x2f7bff, 0xa05cff, 0xff3fd0, 0x35ffd8];           // Cyan, Neon-Blau, Violett, Magenta, Türkis
const CRY_PAL = [0x4ff6ff, 0xa05cff, 0xff5ce6, 0x7fc4ff, 0x35ffd8];

const DOCK_BOXES = [
  { x0: -13.2, x1: -9, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: 9, x1: 13.2, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: -13.2, x1: 13.2, z0: 32, z1: 37, y0: -90, y1: 1 }
];
const DOCK_PILLARS = [];
[-1, 1].forEach((s) => { for (let z = -12; z <= 28; z += 8) DOCK_PILLARS.push([s * 11.1, z]); });
[-12, 0, 12].forEach((x) => DOCK_PILLARS.push([x, 35]));

/* ------------------------------------------------------------
   Canyon-Pfade (Catmull-Rom, dicht abgetastet)
   ------------------------------------------------------------ */
function buildChannel(ctrl, widthFn, depthFn, shelf) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(8, Math.ceil(len / 5));
  const pts = curve.getSpacedPoints(n);
  const N = n + 1;
  const ch = {
    n: N, len, shelf: !!shelf,
    x: new Float32Array(N), z: new Float32Array(N), s: new Float32Array(N), d: new Float32Array(N), w: new Float32Array(N),
    bx0: 1e9, bx1: -1e9, bz0: 1e9, bz1: -1e9
  };
  for (let i = 0; i < N; i++) {
    const s = len * i / n;
    ch.x[i] = pts[i].x; ch.z[i] = pts[i].z; ch.s[i] = s;
    ch.d[i] = depthFn(s, len); ch.w[i] = widthFn(s, len);
    const m = ch.w[i] * 1.3 + 4;
    ch.bx0 = Math.min(ch.bx0, ch.x[i] - m); ch.bx1 = Math.max(ch.bx1, ch.x[i] + m);
    ch.bz0 = Math.min(ch.bz0, ch.z[i] - m); ch.bz1 = Math.max(ch.bz1, ch.z[i] + m);
  }
  return ch;
}

const _nr = { q: 0, s: 0, d: 0, w: 0, side: 1 };
function nearestOnChannel(ch, x, z, out) {
  if (x < ch.bx0 || x > ch.bx1 || z < ch.bz0 || z > ch.bz1) return false;
  let best = 1e18, bi = 0, bt = 0, bcx = 0, bcz = 0, btx = 0, btz = 0;
  const N = ch.n - 1;
  for (let i = 0; i < N; i++) {
    const ax = ch.x[i], az = ch.z[i];
    const bx = ch.x[i + 1] - ax, bz = ch.z[i + 1] - az;
    const l2 = bx * bx + bz * bz;
    let t = l2 > 0 ? ((x - ax) * bx + (z - az) * bz) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const dx = x - (ax + bx * t), dz = z - (az + bz * t), d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bi = i; bt = t; bcx = dx; bcz = dz; btx = bx; btz = bz; }
  }
  out.q = Math.sqrt(best);
  out.s = lerp(ch.s[bi], ch.s[bi + 1], bt);
  out.d = lerp(ch.d[bi], ch.d[bi + 1], bt);
  out.w = lerp(ch.w[bi], ch.w[bi + 1], bt);
  out.side = (btx * bcz - btz * bcx) >= 0 ? 1 : -1;
  return true;
}

function chanAt(ch, s, o) {
  const step = ch.len / (ch.n - 1);
  const f = clamp(s / step, 0, ch.n - 1.0001);
  const i = Math.floor(f), t = f - i;
  o.x = lerp(ch.x[i], ch.x[i + 1], t); o.z = lerp(ch.z[i], ch.z[i + 1], t);
  o.d = lerp(ch.d[i], ch.d[i + 1], t); o.w = lerp(ch.w[i], ch.w[i + 1], t);
  const tx = ch.x[i + 1] - ch.x[i], tz = ch.z[i + 1] - ch.z[i], l = Math.hypot(tx, tz) || 1;
  o.tx = tx / l; o.tz = tz / l;
  return o;
}

/* Hauptpfad: S-förmig vom Dock bis in die Boss-Höhle */
const MAIN_CTRL = [
  [0, -24], [0, -100], [-70, -165], [-155, -215], [-190, -290], [-125, -360],
  [-10, -395], [95, -435], [165, -495], [110, -550], [20, -592], [0, -690]
];
const CHOKES = [150, 275, 400, 535, 700, 835];          // Engstellen (Bogenlänge)

function mainWidth(s) {
  let w = 31 + 9 * Math.sin(s * 0.019 + 1.0) + 5 * Math.sin(s * 0.047);
  for (let i = 0; i < CHOKES.length; i++) w *= 1 - 0.58 * Math.exp(-Math.pow((s - CHOKES[i]) / 15, 2));
  w += 14 * (1 - smooth(0, 90, s));
  w += 22 * smooth(900, 990, s);
  return Math.max(12.5, w);
}
function mainDepth(s, L) {
  const u = clamp(s / L, 0, 1), k = 6 * u, i = Math.min(5, Math.floor(k)), f = k - i;
  const stair = (i + smooth(0.25, 0.85, f)) / 6;              // Terrassen-Stufen
  return LAGOON_FLOOR + (CAVE_FLOOR - LAGOON_FLOOR) * (0.55 * u + 0.45 * stair);
}
const MAIN = buildChannel(MAIN_CTRL, mainWidth, mainDepth, true);

/* Seitenarm: die leuchtende Kristall-Kluft */
const BR_CTRL = [[95, -435], [135, -410], [180, -390], [222, -402], [246, -430]];
let BR_J = 640;
{ const tmp = {}; if (nearestOnChannel(MAIN, 95, -435, tmp)) BR_J = tmp.s; }
const D_BR = mainDepth(BR_J, MAIN.len) - 3;
const BRANCH = buildChannel(BR_CTRL,
  (s, L) => 13 + 2 * Math.sin(s * 0.11) + 21 * smooth(L - 50, L - 10, s),
  (s, L) => D_BR - 5 * (s / L), false);

/* Lava-Becken (Boden) */
const POOLS = [];
function addPoolAtS(s, off, r) {
  const o = {}; chanAt(MAIN, s, o);
  POOLS.push({ x: o.x - o.tz * off, z: o.z + o.tx * off, r: Math.min(r, o.w * 0.85) });
}
[[215, 4, 16], [345, -4, 18], [470, 3, 20], [620, -5, 22], [770, 4, 22], [900, -4, 24]].forEach((a) => addPoolAtS(a[0], a[1], a[2]));
[[-120, -735, 55], [100, -715, 46], [-20, -845, 62], [140, -835, 40], [-5, -672, 32], [-170, -815, 38]].forEach((p) => POOLS.push({ x: p[0], z: p[1], r: p[2] }));

/* ------------------------------------------------------------
   Terrain-Funktion (nur beim Laden, danach Gitter-Lookups)
   ------------------------------------------------------------ */
const LEDGES = [];       // flache Felsvorsprünge {x,z,r,h}

function wallT(a, shelf) {
  const t0 = smooth(0.5, 1.0, a);
  if (shelf <= 0.001) return t0;
  const ts = 0.42 * smooth(0.5, 0.62, a) + 0.02 * smooth(0.62, 0.82, a) + 0.56 * smooth(0.82, 1.0, a);
  return lerp(t0, ts, shelf);
}

const _c = { h: 0, mask: 0, s: 0, lat: 0, cw: 1 };
function chanH(ch, x, z, c) {
  if (!nearestOnChannel(ch, x, z, _nr)) return false;
  const q = _nr.q, w = _nr.w, s = _nr.s, side = _nr.side;
  const a0 = q / w;
  if (a0 > 1.25) return false;
  const g0 = smooth(0.5, 1.0, a0);
  const a = a0
    + 0.075 * Math.sin(s * 0.21 + side * 1.3 + x * 0.03) * Math.sin(s * 0.09 - z * 0.02 + 2.0)
    + 0.05 * Math.sin(s * 0.47 + side * 2.1 + z * 0.11)
    + 0.02 * Math.sin(g0 * 70 + s * 0.1);
  const shelf = ch.shelf ? (side > 0 ? smooth(0.3, 0.6, Math.sin(s * 0.017 + 1.0)) : smooth(0.3, 0.6, Math.sin(s * 0.021 + 4.0))) : 0;
  const t = wallT(a, shelf);
  const fl = _nr.d + (2.6 * Math.sin(x * 0.05 + z * 0.04) + 1.6 * Math.sin(x * 0.13 - z * 0.09)) * (1 - t);
  c.h = lerp(fl, RIM_HI + 1.5 * Math.sin(x * 0.08 + z * 0.07), t);
  c.mask = 1 - t; c.s = s; c.lat = q * side; c.cw = w;
  return true;
}

function caveA(x, z) {
  const dx = (x - CAVE.x) / CAVE.rx, dz = (z - CAVE.z) / CAVE.rz;
  const a = Math.sqrt(dx * dx + dz * dz);
  if (a > 1.25) return 9;
  const ang = Math.atan2(dz, dx);
  return a + 0.035 * Math.sin(ang * 5 + 1.3) + 0.025 * Math.sin(ang * 11 + 0.4) + 0.012 * Math.sin(x * 0.09 + z * 0.07);
}
function caveT(a) {
  const t0 = smooth(CAVE_W0, CAVE_W1, a);
  return smooth(CAVE_W0, CAVE_W1, a + 0.01 * Math.sin(t0 * 60));
}
function roofH(x, z) {
  const a = caveA(x, z);
  if (a >= CAVE_W1) return RIM_HI + 6;
  const t = smooth(CAVE_W0 - 0.03, CAVE_W1, a);
  const dome = 7 * Math.sin(x * 0.03 + 1.0) * Math.sin(z * 0.035) + 4 * Math.sin(x * 0.07 - z * 0.05);
  const st = Math.max(0, Math.sin(x * 0.083 + 0.5) * Math.sin(z * 0.097 + 1.1) - 0.45) / 0.55;   // Stalaktiten
  return lerp(CAVE_ROOF + dome - 24 * st * st, RIM_HI, t);
}

function evalTerrain(x, z, o) {
  let h = RIM_HI + 1.8 * Math.sin(x * 0.021 + 0.7) * Math.cos(z * 0.017) + 1.2 * Math.sin(x * 0.066 + z * 0.051);
  let mask = 0, s = -1, lat = 0, ch = -1, cw = 1;

  const ld = Math.hypot(x - LAG.x, z - LAG.z) / LAG.r;                 // Lagune am Dock
  if (ld < 1.15) {
    const t = smooth(0.6, 1.0, ld + 0.04 * Math.sin(Math.atan2(z - LAG.z, x - LAG.x) * 4 + 1.0));
    const hl = lerp(LAGOON_FLOOR + 2.4 * Math.sin(x * 0.07 + z * 0.05) + 1.4 * Math.sin(x * 0.17 - z * 0.13), RIM_HI, t);
    if (hl < h) { h = hl; mask = 1 - t; ch = 3; }
  }
  if (chanH(MAIN, x, z, _c) && _c.h < h) { h = _c.h; mask = _c.mask; s = _c.s; lat = _c.lat; cw = _c.cw; ch = 0; }
  if (chanH(BRANCH, x, z, _c) && _c.h < h) { h = _c.h; mask = _c.mask; s = _c.s; lat = _c.lat; cw = _c.cw; ch = 1; }

  const ca = caveA(x, z);                                               // Boss-Höhle
  if (ca < 1.1) {
    const t = caveT(ca);
    const fl = CAVE_FLOOR + 3.2 * Math.sin(x * 0.04 + z * 0.03) + 2.0 * Math.sin(x * 0.11 - z * 0.08) + 1.5 * Math.sin(x * 0.23 + z * 0.19);
    const hc = lerp(fl, RIM_HI, t);
    if (hc < h) { h = hc; mask = 1 - t; ch = 2; s = -1; }
  }
  for (let i = 0; i < LEDGES.length; i++) {                             // Felsvorsprung einebnen
    const Z = LEDGES[i];
    const dx = x - Z.x, dz = z - Z.z, d2 = dx * dx + dz * dz;
    if (d2 >= Z.r * Z.r) continue;
    const w = 1 - smooth(Z.r * 0.5, Z.r, Math.sqrt(d2));
    h += (Z.h - h) * w;
  }
  o.h = h; o.mask = mask; o.s = s; o.lat = lat; o.ch = ch; o.cw = cw; o.caveA = ca;
}

const _ev = {};
const terrainRaw = (x, z) => { evalTerrain(x, z, _ev); return _ev.h; };

/* Wandpunkt: marschiert vom Pfad seitlich bis die Wand die Höhe y erreicht */
function wallLat(ch, s, side, y, out, hf) {
  chanAt(ch, s, out);
  const lx = -out.tz * side, lz = out.tx * side;
  out.lx = lx; out.lz = lz;
  let lat = 0;
  for (; lat < out.w * 1.4; lat += 0.5) {
    if (hf(out.x + lx * lat, out.z + lz * lat) > y) break;
  }
  out.lat = lat;
  return out;
}

/* Fundort des Forschungs-U-Boots: Felsvorsprung (Schelf) in der Canyon-Wand */
const WS = {};
{
  const o = {};
  const sW = 345, side = 1;
  chanAt(MAIN, sW, o);
  const y = o.d + 44;
  wallLat(MAIN, sW, side, y, o, terrainRaw);
  WS.x = o.x + o.lx * (o.lat + 3);
  WS.z = o.z + o.lz * (o.lat + 3);
  WS.y = y;
  WS.ux = -o.lx; WS.uz = -o.lz;                 // offen zur Canyon-Mitte
  LEDGES.push({ x: WS.x, z: WS.z, r: 22, h: WS.y });
}
/* Kristall-Kluft: Ende des Seitenarms */
const CS = {};
{ const o = {}; chanAt(BRANCH, BRANCH.len - 3, o); CS.x = o.x; CS.z = o.z; }

/* ------------------------------------------------------------
   Gitter bauen (einmalig) + schnelle Lookups
   ------------------------------------------------------------ */
let HG = null, MK = null, GL = null, CG = null;

function lavaGlowAt(x, z, o) {
  if (o.mask < 0.05) return 0;
  let g = 0;
  for (let i = 0; i < POOLS.length; i++) {
    const L = POOLS[i];
    const dx = x - L.x, dz = z - L.z;
    const wob = 1 + 0.14 * Math.sin(Math.atan2(dz, dx) * 5 + i * 1.7) + 0.06 * Math.sin(x * 0.19 + z * 0.23);
    const d = Math.sqrt(dx * dx + dz * dz) / (L.r * wob);
    if (d < 1) g = Math.max(g, 1 - smooth(0.5, 1.0, d));
  }
  if (o.caveA < CAVE_W0 - 0.04) {                                       // Magma-Spalten in der Höhle
    const lx = x - CAVE.x, lz = z - CAVE.z;
    const f1 = Math.abs(Math.sin(lx * 0.085 + Math.sin(lz * 0.031) * 2.6 + Math.sin(lz * 0.013) * 3.1));
    const f2 = Math.abs(Math.sin(lz * 0.07 + Math.sin(lx * 0.026) * 2.2 + 1.3));
    const ck = 1 - smooth(0.025, 0.13, Math.min(f1, f2 * 1.25));
    g = Math.max(g, 0.85 * ck * (1 - smooth(CAVE_W0 - 0.12, CAVE_W0 - 0.04, o.caveA)));
  } else if (o.ch === 0 && o.s > 330) {                                 // Magma-Adern im unteren Canyon
    const fw = Math.abs(Math.sin(o.lat * 0.16 + Math.sin(o.s * 0.045) * 2.8 + o.s * 0.03));
    const ck = 1 - smooth(0.03, 0.15, fw);
    g = Math.max(g, 0.7 * ck * smooth(330, 520, o.s) * (1 - smooth(0.35, 0.8, Math.abs(o.lat) / o.cw)));
  }
  return g * o.mask;
}

function ensureWorld() {
  if (HG) return;
  const N = GSTRIDE * (GNZ + 1);
  HG = new Float32Array(N); MK = new Float32Array(N); GL = new Float32Array(N);
  const o = {};
  for (let j = 0; j <= GNZ; j++) {
    const z = GZ0 + j * GCZ;
    for (let i = 0; i <= GNX; i++) {
      const x = GX0 + i * GCX, k = j * GSTRIDE + i;
      evalTerrain(x, z, o);
      const g = lavaGlowAt(x, z, o);
      HG[k] = o.h - 1.4 * g;                 // Lava-Becken leicht abgesenkt
      MK[k] = o.mask; GL[k] = g;
    }
  }
  CG = new Float32Array(CSTRIDE * (CNZ + 1));
  for (let j = 0; j <= CNZ; j++) {
    for (let i = 0; i <= CNX; i++) CG[j * CSTRIDE + i] = roofH(CRX0 + i * CCX, CRZ0 + j * CCZ);
  }
}

function floorH(x, z) {
  let fx = (x - GX0) / GCX, fz = (z - GZ0) / GCZ;
  if (fx < 0) fx = 0; else if (fx > GNX - 0.0001) fx = GNX - 0.0001;
  if (fz < 0) fz = 0; else if (fz > GNZ - 0.0001) fz = GNZ - 0.0001;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * GSTRIDE + i;
  const ha = HG[k], hb = HG[k + GSTRIDE], hc = HG[k + 1], hd = HG[k + GSTRIDE + 1];
  return tx + tz <= 1 ? ha + tx * (hc - ha) + tz * (hb - ha) : hd + (1 - tx) * (hb - hd) + (1 - tz) * (hc - hd);
}
function ceilH(x, z) {
  if (x < CRX0 || x > CRX1 || z < CRZ0 || z > CRZ1) return 99;
  let fx = (x - CRX0) / CCX, fz = (z - CRZ0) / CCZ;
  if (fx > CNX - 0.0001) fx = CNX - 0.0001;
  if (fz > CNZ - 0.0001) fz = CNZ - 0.0001;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * CSTRIDE + i;
  const ha = CG[k], hb = CG[k + CSTRIDE], hc = CG[k + 1], hd = CG[k + CSTRIDE + 1];
  return tx + tz <= 1 ? ha + tx * (hc - ha) + tz * (hb - ha) : hd + (1 - tx) * (hb - hd) + (1 - tz) * (hc - hd);
}
function gridNearest(arr, x, z) {
  const i = clamp(Math.round((x - GX0) / GCX), 0, GNX), j = clamp(Math.round((z - GZ0) / GCZ), 0, GNZ);
  return arr[j * GSTRIDE + i];
}
function terrainNormal(x, z, out) {
  const E = 2.0;
  const hx = floorH(x + E, z) - floorH(x - E, z);
  const hz = floorH(x, z + E) - floorH(x, z - E);
  return out.set(-hx / (2 * E), 1, -hz / (2 * E)).normalize();
}

const _o2 = {};
function chanSpot(ch, s, side, latFrac, out) {
  chanAt(ch, s, _o2);
  const lat = latFrac * _o2.w;
  out.x = _o2.x - _o2.tz * side * lat;
  out.z = _o2.z + _o2.tx * side * lat;
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

/* Gitter-Netz: flip=false → Normalen nach oben (Boden), flip=true → nach unten (Höhlendach) */
function makeGridGeo(nx, nz, x0, z0, cx, cz, H, flip) {
  const stride = nx + 1, n = stride * (nz + 1);
  const pos = new Float32Array(n * 3);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const k = j * stride + i;
      pos[k * 3] = x0 + i * cx; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z0 + j * cz;
    }
  }
  const idx = new Uint32Array(nx * nz * 6);
  let q = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * stride + i, b = (j + 1) * stride + i, c = j * stride + i + 1, d = (j + 1) * stride + i + 1;
      if (!flip) { idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c; }
      else { idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
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
   Materialien
   ------------------------------------------------------------ */
const timeU = { value: 0 };

/* Leuchtende Bio-Pflanzen / Kristalle (Instanzfarbe + starkes Emissive + Wiegen) */
function bioMat(o) {
  o = o || {};
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: o.rough === undefined ? 0.5 : o.rough, metalness: 0, side: THREE.DoubleSide
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
  m.customProgramCacheKey = () => 'bio-l3b';
  return m;
}

/* Fels/Boden/Dach mit eingebackenem Vertex-Licht (aLight) und optional Lava-Emissive */
function bakedMat(lavaTex, flat) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: !!flat });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    let vHead = 'attribute vec3 aLight;\nvarying vec3 vLight;\n';
    let vBody = '#include <begin_vertex>\n vLight = aLight;';
    let fHead = 'varying vec3 vLight;\n';
    let fBody = '#include <emissivemap_fragment>\n totalEmissiveRadiance += vLight * (diffuseColor.rgb * 1.5 + 0.05);';
    if (lavaTex) {
      sh.uniforms.uLava = { value: lavaTex };
      vHead += 'attribute float aGlow;\nvarying float vGlow;\nvarying vec2 vLavaUv;\nuniform float uTime;\n';
      vBody += ' vGlow = aGlow; vLavaUv = position.xz * 0.035 + vec2(uTime * 0.004, uTime * 0.0025);';
      fHead += 'uniform sampler2D uLava;\nuniform float uTime;\nvarying float vGlow;\nvarying vec2 vLavaUv;\n';
      fBody += `
       vec3 lv = texture2D(uLava, vLavaUv).rgb;
       float pulse = 0.85 + 0.15 * sin(uTime * 1.3 + vLavaUv.x * 20.0);
       totalEmissiveRadiance += (lv * 1.9 + vec3(0.35, 0.08, 0.01) * vGlow) * vGlow * pulse;`;
    }
    sh.vertexShader = vHead + sh.vertexShader.replace('#include <begin_vertex>', vBody);
    sh.fragmentShader = fHead + sh.fragmentShader.replace('#include <emissivemap_fragment>', fBody);
  };
  m.customProgramCacheKey = () => (lavaTex ? 'baked-l3-lava' : (flat ? 'baked-l3-flat' : 'baked-l3'));
  return m;
}

/* ------------------------------------------------------------
   Bio-Geometrien (Vertex-Helligkeit: Spitzen = 1.0 leuchten stärker)
   ------------------------------------------------------------ */
function geoSpongeGlow(r) {
  const items = [];
  [[0, 0, 1.7, 0.55], [0.85, 0.35, 1.15, 0.42], [-0.6, 0.75, 0.95, 0.38], [0.15, -0.9, 1.35, 0.46], [-0.95, -0.35, 0.7, 0.32]].forEach(([x, z, h, rad]) => {
    const wob = 0.9 + r() * 0.2;
    const g = new THREE.CylinderGeometry(rad * 1.05 * wob, rad * 0.7, h, 8, 1, true);
    g.translate(x, h / 2 - 0.1, z);
    items.push({ geo: g, col: new THREE.Color(0.55, 0.55, 0.55) });
    const ring = new THREE.TorusGeometry(rad * 1.05 * wob, 0.08, 3, 8);
    ring.rotateX(Math.PI / 2);
    ring.translate(x, h - 0.1, z);
    items.push({ geo: ring, col: new THREE.Color(1, 1, 1) });
  });
  return mergeColored(items);
}

function geoMushroom() {
  const items = [];
  [[0, 0, 1], [1.3, 0.7, 0.55]].forEach(([x, z, s]) => {
    const stem = new THREE.CylinderGeometry(0.16 * s, 0.28 * s, 1.3 * s, 6);
    stem.translate(x, 0.65 * s, z);
    items.push({ geo: stem, col: new THREE.Color(0.45, 0.45, 0.45) });
    const cap = new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1.15 * s, 0.55 * s, 1.15 * s);
    cap.translate(x, 1.3 * s, z);
    items.push({ geo: cap, col: new THREE.Color(1, 1, 1) });
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
    const b = new THREE.SphereGeometry(0.3, 6, 4);
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
    const t = new THREE.TorusGeometry(rad, 0.03, 3, 14, Math.PI - 0.4);
    t.rotateZ(0.2);
    parts.push(t);
  });
  const stalk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5);
  stalk.translate(0, -0.1, 0);
  parts.push(stalk);
  return mc(parts, 0.85);
}

/* Verzweigte Leucht-Koralle */
function geoCoral(r) {
  const items = [];
  const branch = (p, dir, len, rad, depth) => {
    const q = p.clone().addScaledVector(dir, len);
    items.push({ geo: cylBetween(p, q, rad, rad * 0.7, 5), col: new THREE.Color(0.45, 0.45, 0.45) });
    if (depth <= 0) {
      const b = new THREE.SphereGeometry(rad * 1.7, 5, 3);
      b.translate(q.x, q.y, q.z);
      items.push({ geo: b, col: new THREE.Color(1, 1, 1) });
      return;
    }
    const n = 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const d = dir.clone();
      d.x += (r() - 0.5) * 1.1; d.z += (r() - 0.5) * 1.1; d.y += 0.25;
      d.normalize();
      branch(q, d, len * 0.74, rad * 0.72, depth - 1);
    }
  };
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 1.1, 0.13, 2);
  return mergeColored(items);
}

/* Kristall-Cluster (sechskantige Säulen mit Spitzen) */
function geoCrystal(r) {
  const items = [];
  [[0, 0, 1.0, 0.5], [0.7, 0.3, 0.7, 0.38], [-0.6, 0.4, 0.8, 0.4], [0.2, -0.7, 0.6, 0.32], [-0.3, -0.4, 0.5, 0.28]].forEach(([x, z, h, rad]) => {
    const hh = h * 3.2;
    const body = new THREE.CylinderGeometry(rad * 0.85, rad, hh, 6, 1);
    body.translate(0, hh / 2, 0);
    const tip = new THREE.ConeGeometry(rad * 0.85, hh * 0.38, 6);
    tip.translate(0, hh + hh * 0.19, 0);
    const t1 = (r() - 0.5) * 0.55, t2 = (r() - 0.5) * 0.55;
    [body, tip].forEach((g) => { g.rotateZ(t1); g.rotateX(t2); g.translate(x * 1.6, 0, z * 1.6); });
    items.push({ geo: body, col: new THREE.Color(0.55, 0.55, 0.55) });
    items.push({ geo: tip, col: new THREE.Color(1, 1, 1) });
  });
  return mergeColored(items);
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
  blue: { body: 0x3f7bff, tail: 0x9fc0ff, fin: 0x3f7bff },
  teal: { body: 0x35ffd8, tail: 0xb0fff0, fin: 0x35ffd8 },
  gold: { body: 0xffb02e, tail: 0xffe0a0, fin: 0xffb02e }
};
const FISH_ORDER = ['lantern', 'violet', 'magenta', 'blue', 'teal', 'gold'];

function fishGeo(sp) {
  const body = new THREE.SphereGeometry(0.5, 8, 5);
  body.scale(0.36, 0.55, 1);
  const lure = new THREE.SphereGeometry(0.07, 4, 3);
  lure.translate(0, -0.15, 0.34);
  return mergeColored([
    { geo: body, col: sp.body },
    { geo: lure, col: 0xffffff },
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
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.55, metalness: 0.2, emissive: 0x1a2030, emissiveIntensity: 0.9 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5, emissive: 0x401800, emissiveIntensity: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.4, emissive: 0x0a0c12, emissiveIntensity: 0.6 });
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
  return { g, beamMat, beacon };
}

/* ------------------------------------------------------------
   Tiefsee-Monster: riesiger Anglerfisch (Kopf zeigt nach +z)
   ------------------------------------------------------------ */
const MON_SCALE = 2.0;
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
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, emissive: 0x2a0f35, emissiveIntensity: 1.0 });
  const jawM = new THREE.MeshStandardMaterial({ color: 0x3a2142, roughness: 0.7, emissive: 0x24102c, emissiveIntensity: 1.0, side: THREE.DoubleSide });
  const toothM = new THREE.MeshStandardMaterial({ color: 0xf1e9c4, roughness: 0.4, emissive: 0x5a5026, emissiveIntensity: 0.9 });
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

  g.scale.setScalar(MON_SCALE);
  return { g, body, jaw, tail1, tail2, tail3, fins, lure, bulb, bulbM, phMat, halo };
}

/* Körperpunkte des Monsters (lokal, vor Skalierung) + Radius – für die Kollisions-Validierung */
const MON_PROBES = [
  [0, 10.5, 19.5, 3.8], [0, 0, 9.5, 8.5], [0, -7, 12, 5.5], [0, 1.2, 0, 9.5], [0, 8, -4, 5],
  [-15, -2, 0.5, 5], [15, -2, 0.5, 5], [0, 0, -10, 8.5], [0, 0, -20, 6.5], [6, 0, -30, 6.5], [-6, 0, -30, 6.5],
  [0, 12, -40, 6], [0, -12, -40, 6], [0, 0, -46, 6], [8, 0, -46, 5], [-8, 0, -46, 5]
];

/* ============================================================
   buildLevel3
   ============================================================ */
export function buildLevel3(scene, renderer) {
  void renderer;
  ensureWorld();

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
  const _v = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const DOWN = new THREE.Vector3(0, -1, 0);
  const SP = {};                                  // Temp für chanSpot

  /* ---------- Licht: viel Grundhelligkeit ---------- */
  root.add(new THREE.HemisphereLight(0x8a9cff, 0xff6a30, 2.3));
  root.add(new THREE.AmbientLight(0x4a4ab0, 1.5));
  const sun = new THREE.DirectionalLight(0xa8b8ff, 1.0);
  sun.position.set(-60, 220, 40);
  root.add(sun); root.add(sun.target);

  /* ---------- Wasseroberfläche ---------- */
  const surfGeo = new THREE.PlaneGeometry(3000, 3000); surfGeo.rotateX(-Math.PI / 2);
  const surfBack = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({ color: 0x4a66d8, side: THREE.BackSide, transparent: true, opacity: 0.85 }));
  const surfTop = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({ color: 0x2a64b8, side: THREE.FrontSide, transparent: true, opacity: 0.8, depthWrite: false }));
  root.add(surfBack); root.add(surfTop);

  /* ==========================================================
     Hydrothermale Schlote (Daten)
     ========================================================== */
  const pillars = [];
  const addPillar = (x, z, r, h) => {
    const fy = floorH(x, z);
    const y0 = fy - 3;
    let y1 = Math.min(fy + h, -26);
    const cl = ceilH(x, z);
    if (cl < 90) y1 = Math.min(y1, cl - 8);
    if (y1 - y0 < 14) return;
    pillars.push({ x, z, r, y0, y1, h: y1 - y0 });
  };
  // Canyon: seitlich versetzt, nur in breiten Abschnitten
  for (let s = 100; s < MAIN.len - 120; s += 52 + rng() * 26) {
    if (CHOKES.some((c) => Math.abs(s - c) < 32)) continue;
    chanAt(MAIN, s, _o2);
    if (_o2.w < 24) continue;
    chanSpot(MAIN, s, rng() < 0.5 ? 1 : -1, 0.38 + rng() * 0.32, SP);
    addPillar(SP.x, SP.z, Math.min(3.2 + rng() * 2.6, _o2.w * 0.15), 45 + rng() * 45);
  }
  // Boss-Höhle: hohe Schlot-Säulen NUR am Rand (innen bleibt frei)
  for (let i = 0; i < 15; i++) {
    const ang = i / 15 * Math.PI * 2 + 0.2;
    if (Math.abs(Math.atan2(Math.sin(ang - Math.PI / 2), Math.cos(ang - Math.PI / 2))) < 0.45) continue;      // Eingang freihalten
    const a = 0.88 + rng() * 0.05;
    addPillar(CAVE.x + Math.cos(ang) * CAVE.rx * a, CAVE.z + Math.sin(ang) * CAVE.rz * a, 4.2 + rng() * 2.2, 70 + rng() * 45);
  }
  const pillarR = (P, t) => P.r * (1 - 0.58 * t) * (1 + 0.9 * Math.exp(-7 * t)) * 1.05;

  const blocked = (x, z) => {
    if (x > -24 && x < 24 && z > -30 && z < 46) return true;                                  // Dock
    for (let i = 0; i < pillars.length; i++) {
      const P = pillars[i];
      if (Math.hypot(x - P.x, z - P.z) < P.r * 1.3 + 2) return true;
    }
    if (Math.hypot(x - WS.x, z - WS.z) < 24) return true;                                     // Alkoven
    if (Math.hypot(x - CS.x, z - CS.z) < 6) return true;                                      // Herz-Kristall
    return false;
  };

  /* ==========================================================
     Felsen: Vorsprünge, Boulder, Alkoven (Kugel-Kollision)
     ========================================================== */
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
  /* Block relativ zu einer Blickrichtung u (lx = seitlich, lz = entlang u) */
  function rockLocal(cx, cy, cz, u, lx, lz, rx, ry, rz, taper, lean, seed) {
    const px = u.z, pz = -u.x;
    addRock(cx + px * lx + u.x * lz, cy, cz + pz * lx + u.z * lz, rx, ry, rz, Math.atan2(-pz, px), taper, lean, seed);
  }

  /* Felsvorsprung in einer Canyon-Wand (ragt ca. 5 Einheiten in den Gang) */
  function outcrop(ch, s, side, y, rx, ry, rz, seed) {
    const o = {};
    wallLat(ch, s, side, y, o, floorH);
    const lc = o.lat + rx - 5;
    const cx = o.x + o.lx * lc, cz = o.z + o.lz * lc;
    if (Math.hypot(cx - WS.x, cz - WS.z) < 32 || blocked(cx, cz)) return;
    addRock(cx, y, cz, rx, ry, rz, Math.atan2(-o.lz, o.lx), 0.25, (rng() - 0.5) * 0.2, seed);
  }
  // Vorsprünge entlang des ganzen Abstiegs (verschiedene Höhen)
  for (let i = 0, s = 55; s < MAIN.len - 110; i++, s += 30 + rng() * 14) {
    chanAt(MAIN, s, _o2);
    const flat = rng() < 0.3;                       // flache Felsplatten (Schelf-Optik)
    outcrop(MAIN, s, (i + (rng() < 0.3 ? 1 : 0)) % 2 ? 1 : -1, _o2.d + 8 + rng() * 85,
      flat ? 9 + rng() * 4 : 6 + rng() * 4, flat ? 2.5 + rng() * 1.5 : 4 + rng() * 5, flat ? 9 + rng() * 5 : 6 + rng() * 6, rng() * 50);
  }
  // Engstellen: abwechselnd links/rechts Felsvorsprünge → Slalom
  CHOKES.forEach((c, i) => {
    chanAt(MAIN, c - 11, _o2); outcrop(MAIN, c - 11, i % 2 ? 1 : -1, _o2.d + 12 + rng() * 22, 6.5, 6, 8, rng() * 50);
    chanAt(MAIN, c + 11, _o2); outcrop(MAIN, c + 11, i % 2 ? -1 : 1, _o2.d + 12 + rng() * 22, 6.5, 6, 8, rng() * 50);
  });
  // Boulder auf dem Canyon-Boden
  for (let i = 0, tries = 0; i < dn(34) && tries < 600; tries++) {
    const s = 90 + rng() * (MAIN.len - 200);
    chanAt(MAIN, s, _o2);
    if (CHOKES.some((c) => Math.abs(s - c) < 22)) continue;
    chanSpot(MAIN, s, rng() < 0.5 ? 1 : -1, rng() * 0.62, SP);
    if (blocked(SP.x, SP.z)) continue;
    const h = floorH(SP.x, SP.z);
    if (h > -60 || gridNearest(GL, SP.x, SP.z) > 0.3) continue;
    const r = 3 + rng() * 4.5;
    addRock(SP.x, h + r * 0.3, SP.z, r, r * 0.9, r * (0.8 + rng() * 0.4), rng() * 6.283, 0.2, 0, rng() * 50);
    i++;
  }
  // Höhlen-Rand: Felsbrocken nur am äußeren Rand (innen frei!)
  for (let i = 0, tries = 0; i < dn(18) && tries < 300; tries++) {
    const ang = rng() * 6.283;
    if (Math.abs(Math.atan2(Math.sin(ang - Math.PI / 2), Math.cos(ang - Math.PI / 2))) < 0.5) continue;
    const a = 0.84 + rng() * 0.1;
    const x = CAVE.x + Math.cos(ang) * CAVE.rx * a, z = CAVE.z + Math.sin(ang) * CAVE.rz * a;
    if (blocked(x, z)) continue;
    const h = floorH(x, z), r = 4 + rng() * 5;
    addRock(x, h + r * 0.3, z, r, r * 0.9, r, rng() * 6.283, 0.2, 0, rng() * 50);
    i++;
  }
  // Alkoven für das Forschungs-U-Boot (offen zur Canyon-Mitte)
  const wgy = floorH(WS.x, WS.z);
  {
    const u = { x: WS.ux, z: WS.uz };
    rockLocal(WS.x, wgy + 13, WS.z, u, 0, -13, 13, 17, 4.5, 0.15, 0, 3.3);
    rockLocal(WS.x, wgy + 12, WS.z, u, 12.5, -3, 3.5, 15, 11, 0.2, 0.02, 8.1);
    rockLocal(WS.x, wgy + 12, WS.z, u, -12.5, -3, 3.5, 14, 11, 0.2, -0.02, 12.7);
    rockLocal(WS.x, wgy + 25, WS.z, u, 0, -3, 14, 3, 12, 0.1, 0, 5.9);
  }

  /* ==========================================================
     Biolumineszenz-Pflanzen + Kristalle (Daten)
     ========================================================== */
  const pl = { sponge: [], mush: [], tube: [], stalk: [], fan: [], coral: [], giant: [] };
  const target = {
    sponge: dn(150), mush: dn(220), tube: dn(190), stalk: dn(330), fan: dn(120), coral: dn(170), giant: dn(70)
  };
  const cnt = { sponge: 0, mush: 0, tube: 0, stalk: 0, fan: 0, coral: 0, giant: 0 };
  const SCALE = {
    sponge: [1.5, 3.5], mush: [1.4, 3.5], tube: [1.5, 3.2], stalk: [1.5, 3.0], fan: [1.5, 3.0], coral: [1.6, 3.4], giant: [4, 7.5]
  };
  const addPlant = (type, x, y, z, q, s) => {
    pl[type].push({ x, y, z, q, s: s === undefined ? lerp(SCALE[type][0], SCALE[type][1], rng()) : s, c: PAL[Math.floor(rng() * PAL.length)] });
    cnt[type]++;
  };
  const qFromNormal = (n, tilt, toward) => {
    _nrm2.copy(n).lerp(toward || UP, tilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, _nrm2);
    return q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * 6.283));
  };
  const TYPES_ALL = ['stalk', 'stalk', 'mush', 'tube', 'sponge', 'fan', 'coral', 'coral', 'stalk', 'mush'];
  const TYPES_WALL = ['sponge', 'mush', 'tube', 'fan', 'coral', 'coral'];
  const total = () => cnt.sponge + cnt.mush + cnt.tube + cnt.stalk + cnt.fan + cnt.coral;
  const goal = target.sponge + target.mush + target.tube + target.stalk + target.fan + target.coral;

  function tryPlant(x, z) {
    if (blocked(x, z)) return false;
    const h = floorH(x, z);
    if (h > -12) return false;
    if (gridNearest(GL, x, z) > 0.5) return false;
    terrainNormal(x, z, _nrm);
    const slope = 1 - _nrm.y;
    const list = slope > 0.45 ? TYPES_WALL : TYPES_ALL;
    const type = list[Math.floor(rng() * list.length)];
    if (cnt[type] >= target[type]) return false;
    addPlant(type, x, h - 0.15, z, qFromNormal(_nrm, 0.4));
    return true;
  }
  // 1) Canyon: Wände, Vorsprünge, Boden
  for (let tries = 0; tries < 14000 && total() < goal * 0.55; tries++) {
    chanSpot(MAIN, 14 + rng() * (MAIN.len - 14), rng() < 0.5 ? 1 : -1, 0.04 + rng() * 0.98, SP);
    tryPlant(SP.x, SP.z);
  }
  // 2) Boss-Höhle: Boden + Randwände
  for (let tries = 0; tries < 9000 && total() < goal * 0.88; tries++) {
    const ang = rng() * 6.283, a = Math.sqrt(rng()) * 0.95;
    tryPlant(CAVE.x + Math.cos(ang) * CAVE.rx * a, CAVE.z + Math.sin(ang) * CAVE.rz * a);
  }
  // 3) Kristall-Kluft
  for (let tries = 0; tries < 3000 && total() < goal * 0.96; tries++) {
    chanSpot(BRANCH, 4 + rng() * (BRANCH.len - 4), rng() < 0.5 ? 1 : -1, 0.1 + rng() * 0.9, SP);
    tryPlant(SP.x, SP.z);
  }
  // 4) Lagune + Rest
  for (let tries = 0; tries < 3000 && total() < goal; tries++) {
    const ang = rng() * 6.283, r = 14 + rng() * 44;
    tryPlant(LAG.x + Math.cos(ang) * r, LAG.z + Math.sin(ang) * r * 0.9);
  }
  // Riesen-Röhrenwürmer um die Lava-Becken
  POOLS.forEach((L) => {
    const k = L.r > 30 ? 4 : 2;
    for (let n = 0, tries = 0; n < k && tries < 50; tries++) {
      const a = rng() * 6.283, rr = L.r * (1.0 + rng() * 0.35);
      const x = L.x + Math.cos(a) * rr, z = L.z + Math.sin(a) * rr;
      if (cnt.giant >= target.giant || blocked(x, z)) continue;
      if (gridNearest(GL, x, z) > 0.35 || gridNearest(MK, x, z) < 0.8) continue;
      terrainNormal(x, z, _nrm);
      addPlant('giant', x, floorH(x, z) - 0.2, z, qFromNormal(_nrm, 0.7));
      n++;
    }
  });
  // Röhrenwürmer, Pilze und Riesenwürmer direkt an den Schloten
  pillars.forEach((P) => {
    for (let k = 0; k < 9; k++) {
      const a = rng() * 6.283, t = k < 5 ? rng() * 0.12 : 0.15 + rng() * 0.55;
      const rr = pillarR(P, t) * 0.92;
      _nrm.set(Math.cos(a), 0.5, Math.sin(a)).normalize();
      const type = k % 3 === 0 ? 'mush' : (k % 3 === 1 ? 'tube' : 'sponge');
      addPlant(type, P.x + Math.cos(a) * rr, P.y0 + t * P.h, P.z + Math.sin(a) * rr, qFromNormal(_nrm, 0.1), lerp(1.2, 2.6, rng()));
    }
    const ga = rng() * 6.283, gr = pillarR(P, 0) + 3.5;
    const gx = P.x + Math.cos(ga) * gr, gz = P.z + Math.sin(ga) * gr;
    terrainNormal(gx, gz, _nrm);
    addPlant('giant', gx, floorH(gx, gz) - 0.2, gz, qFromNormal(_nrm, 0.6));
  });
  // Hängende Leucht-Stängel/Korallen am Höhlendach
  for (let k = 0, tries = 0; k < dn(110) && tries < 3000; tries++) {
    const ang = rng() * 6.283, a = Math.sqrt(rng()) * 0.92;
    const x = CAVE.x + Math.cos(ang) * CAVE.rx * a, z = CAVE.z + Math.sin(ang) * CAVE.rz * a;
    const y = ceilH(x, z);
    if (y > -20 || y < -120) continue;
    const E = 3;
    _nrm.set((ceilH(x + E, z) - ceilH(x - E, z)) / (2 * E), -1, (ceilH(x, z + E) - ceilH(x, z - E)) / (2 * E)).normalize();
    const type = ['stalk', 'stalk', 'mush', 'coral'][k % 4];
    addPlant(type, x, y + 0.2, z, qFromNormal(_nrm, 0.25, DOWN), lerp(2, 4, rng()));
    k++;
  }

  /* Kristalle: Seitenarm (Kluft) + Hinweise am Eingang */
  const crystals = [];
  const addCrystal = (x, y, z, q, s) => crystals.push({ x, y, z, q, s, c: CRY_PAL[Math.floor(rng() * CRY_PAL.length)] });
  for (let tries = 0; crystals.length < dn(150) && tries < 5000; tries++) {
    const s = 4 + rng() * (BRANCH.len - 4);
    chanSpot(BRANCH, s, rng() < 0.5 ? 1 : -1, 0.2 + rng() * 0.85, SP);
    const h = floorH(SP.x, SP.z);
    if (h > -14 || Math.hypot(SP.x - CS.x, SP.z - CS.z) < 5) continue;
    terrainNormal(SP.x, SP.z, _nrm);
    addCrystal(SP.x, h - 0.3, SP.z, qFromNormal(_nrm, 0.3), lerp(1.4, 3.8, rng()) * (s > BRANCH.len - 60 ? 1.4 : 1));
  }
  for (let tries = 0, k = 0; k < dn(14) && tries < 600; tries++) {          // Hinweis-Kristalle am Abzweig
    chanSpot(MAIN, clamp(BR_J + (rng() - 0.5) * 120, 20, MAIN.len - 20), rng() < 0.5 ? 1 : -1, 0.5 + rng() * 0.5, SP);
    const h = floorH(SP.x, SP.z);
    if (h > -14 || blocked(SP.x, SP.z)) continue;
    terrainNormal(SP.x, SP.z, _nrm);
    addCrystal(SP.x, h - 0.3, SP.z, qFromNormal(_nrm, 0.3), lerp(1.6, 3.2, rng()));
    k++;
  }

  /* ==========================================================
     Licht-Zonen: eingebackenes Licht + wandernde PointLights
     ========================================================== */
  const zones = [];
  const addZone = (x, y, z, col, r, pl_, bk, flick) => {
    const Z = {
      x, y, z, col: col instanceof THREE.Color ? col.clone() : new THREE.Color(col),
      r, rb: r * 2.2, pl: pl_, bk, flick: flick || 0, ph: rng() * 6.28, mul: 1, lit: false
    };
    zones.push(Z);
    return Z;
  };
  // Lava-Becken
  POOLS.forEach((L) => {
    const Z = addZone(L.x, floorH(L.x, L.z) + 7, L.z, 0xff6a24, L.r * 1.3 + 10, 2200 + L.r * 60, 0.75, 0.08);
    Z.rb = L.r * 2.6 + 30;
  });
  // Pflanzen/Kristall-Cluster → Zonen
  {
    const bins = new Map();
    const addBin = (x, y, z, hex, big) => {
      const key = Math.floor(x / 22) + '|' + Math.floor(y / 22) + '|' + Math.floor(z / 22);
      let b = bins.get(key);
      if (!b) { b = { x: 0, y: 0, z: 0, n: 0, r: 0, g: 0, b: 0, big: !!big }; bins.set(key, b); }
      const c = _cc.setHex(hex);
      b.x += x; b.y += y; b.z += z; b.n += 1; b.r += c.r; b.g += c.g; b.b += c.b;
      if (big) b.big = true;
    };
    Object.keys(pl).forEach((k) => pl[k].forEach((o) => addBin(o.x, o.y + 1.5, o.z, o.c, false)));
    crystals.forEach((o) => addBin(o.x, o.y + 2, o.z, o.c, true));
    Array.from(bins.values()).filter((b) => b.n >= 3)
      .sort((a, b) => b.n * (b.big ? 2 : 1) - a.n * (a.big ? 2 : 1)).slice(0, 230)
      .forEach((b) => {
        const n = b.n, big = b.big;
        addZone(b.x / n, b.y / n + 2, b.z / n, new THREE.Color(b.r / n, b.g / n, b.b / n), big ? 22 : 16,
          (big ? 700 : 170) + (big ? 60 : 38) * Math.min(n, 14), clamp(0.05 * n, 0.1, 0.55) * (big ? 1.3 : 1), 0.05);
      });
  }
  // Füll-Licht entlang des Canyons (damit nie dunkle Löcher entstehen)
  for (let s = 40, i = 0; s < MAIN.len; s += 62, i++) {
    chanAt(MAIN, s, _o2);
    addZone(_o2.x, _o2.d + 26, _o2.z, PAL[i % PAL.length], 46, 520, 0.22, 0.04);
  }
  // Füll-Licht in der Boss-Höhle
  [[-110, -735, 0x8a5cff], [110, -720, 0x19e6ff], [0, -840, 0xff3fd0], [-150, -800, 0x2f7bff], [150, -820, 0x35ffd8], [0, -700, 0xff6a24]]
    .forEach((c) => addZone(c[0], -110, c[1], c[2], 80, 1400, 0.28, 0.04));

  /* ==========================================================
     Meeresboden / Canyon (ein Mesh, Lava-Emissive-Shader + Vertex-Licht)
     ========================================================== */
  const bakeAt = (x, y, z, out, k) => {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < zones.length; i++) {
      const Z = zones[i];
      if (Z.bk <= 0) continue;
      const R = Z.rb;
      const dx = x - Z.x; if (dx > R || dx < -R) continue;
      const dz = z - Z.z; if (dz > R || dz < -R) continue;
      const dy = y - Z.y; if (dy > R || dy < -R) continue;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R * R) continue;
      const q = 1 - Math.sqrt(d2) / R, f = Z.bk * q * q;
      r += Z.col.r * f; g += Z.col.g * f; b += Z.col.b * f;
    }
    out[k] = Math.min(r, 1.3); out[k + 1] = Math.min(g, 1.3); out[k + 2] = Math.min(b, 1.3);
  };

  const lavaTex = lavaTexture();
  const _vio = new THREE.Color(0.34, 0.26, 0.5), _sed = new THREE.Color(0.34, 0.42, 0.5), _scorch = new THREE.Color(0.32, 0.14, 0.1);
  function floorColor(x, z, h, sl, g, mask, c) {
    c.setRGB(0.26, 0.27, 0.4);
    const n = Math.sin(x * 0.045 + 1) * Math.sin(z * 0.05 + 2);
    c.lerp(_vio, 0.35 * smooth(-0.2, 0.8, n));
    c.multiplyScalar(0.85 + 0.3 * (0.5 + 0.5 * Math.sin(h * 0.45 + x * 0.03)));
    c.lerp(_sed, smooth(0.7, 1.0, mask) * (1 - smooth(0.15, 0.6, sl)) * 0.7);
    c.multiplyScalar(1 - 0.3 * smooth(0.5, 1.6, sl));
    c.lerp(_scorch, clamp(g * 1.2, 0, 1) * 0.8);
  }
  {
    const fg = makeGridGeo(GNX, GNZ, GX0, GZ0, GCX, GCZ, HG, false);
    const n = HG.length;
    const col = new Float32Array(n * 3), glow = new Float32Array(n), lgt = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let j = 0; j <= GNZ; j++) {
      const z = GZ0 + j * GCZ;
      for (let i = 0; i <= GNX; i++) {
        const k = j * GSTRIDE + i, x = GX0 + i * GCX, h = HG[k];
        const hx = HG[j * GSTRIDE + Math.min(i + 1, GNX)] - h, hz = HG[Math.min(j + 1, GNZ) * GSTRIDE + i] - h;
        const sl = Math.hypot(hx, hz) / GCX;
        floorColor(x, z, h, sl, GL[k], MK[k], c);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        glow[k] = GL[k];
        bakeAt(x, h + 1, z, lgt, k * 3);
      }
    }
    fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    fg.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    fg.setAttribute('aLight', new THREE.BufferAttribute(lgt, 3));
    fg.computeVertexNormals();
    const floorMesh = new THREE.Mesh(fg, bakedMat(lavaTex, false));
    floorMesh.frustumCulled = false;
    root.add(floorMesh);
  }

  /* ---------- Höhlendach (Normalen nach unten) ---------- */
  {
    const rg = makeGridGeo(CNX, CNZ, CRX0, CRZ0, CCX, CCZ, CG, true);
    const n = CG.length;
    const col = new Float32Array(n * 3), lgt = new Float32Array(n * 3);
    for (let j = 0; j <= CNZ; j++) {
      for (let i = 0; i <= CNX; i++) {
        const k = j * CSTRIDE + i, x = CRX0 + i * CCX, z = CRZ0 + j * CCZ, y = CG[k];
        const band = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(y * 0.4 + x * 0.05 + z * 0.04));
        col[k * 3] = 0.25 * band; col[k * 3 + 1] = 0.24 * band; col[k * 3 + 2] = 0.37 * band;
        bakeAt(x, Math.min(y, 0) - 2, z, lgt, k * 3);
      }
    }
    rg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    rg.setAttribute('aLight', new THREE.BufferAttribute(lgt, 3));
    rg.computeVertexNormals();
    const roofMesh = new THREE.Mesh(rg, bakedMat(null, false));
    roofMesh.frustumCulled = false;
    root.add(roofMesh);
  }

  /* ---------- Felsen-Mesh (alle Blöcke in einem) ---------- */
  {
    const cg = mergeColored(cragItems);
    const p = cg.attributes.position, lgt = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) bakeAt(p.getX(i), p.getY(i), p.getZ(i), lgt, i * 3);
    cg.setAttribute('aLight', new THREE.BufferAttribute(lgt, 3));
    const cragMesh = new THREE.Mesh(cg, bakedMat(null, true));
    cragMesh.frustumCulled = false;
    root.add(cragMesh);
  }

  /* ---------- Schlote (Instanzen) + glühende Öffnungen ---------- */
  {
    const dm = new THREE.Object3D();
    const geos = [pillarGeo(1.7), pillarGeo(4.1), pillarGeo(7.3)];
    const groups = [[], [], []];
    pillars.forEach((P, i) => groups[i % 3].push(P));
    const pillarMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0x2c2250, emissiveIntensity: 1.0 });
    groups.forEach((list, gi) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geos[gi], pillarMat, list.length);
      list.forEach((P, i) => {
        dm.position.set(P.x, P.y0, P.z);
        dm.rotation.set(0, rng() * 6.283, 0);
        dm.scale.set(P.r, P.h, P.r);
        dm.updateMatrix();
        mesh.setMatrixAt(i, dm.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    });
    if (pillars.length) {
      const ventG = new THREE.CircleGeometry(0.34, 12); ventG.rotateX(-Math.PI / 2);
      const vent = new THREE.InstancedMesh(ventG, new THREE.MeshBasicMaterial({ color: 0xff7a30, side: THREE.DoubleSide }), pillars.length);
      pillars.forEach((P, i) => {
        dm.position.set(P.x, P.y1 + 0.15, P.z);
        dm.rotation.set(0, 0, 0);
        dm.scale.set(P.r, 1, P.r);
        dm.updateMatrix();
        vent.setMatrixAt(i, dm.matrix);
      });
      vent.instanceMatrix.needsUpdate = true;
      vent.frustumCulled = false;
      root.add(vent);
    }
  }

  /* ---------- Pflanzen + Kristalle (Instanzen, starkes Emissive) ---------- */
  {
    const mats = {
      sponge: bioMat({ glow: 1.0 }), mush: bioMat({ glow: 1.05 }), tube: bioMat({ glow: 1.05, sway: 0.05 }),
      stalk: bioMat({ glow: 1.15, sway: 0.1 }), fan: bioMat({ glow: 1.0, sway: 0.05 }), coral: bioMat({ glow: 1.05, sway: 0.03 }),
      giant: bioMat({ glow: 1.1, sway: 0.03 })
    };
    const geos = {
      sponge: geoSpongeGlow(rng), mush: geoMushroom(), tube: geoTubes(rng), stalk: geoStalks(), fan: geoFanGlow(),
      coral: geoCoral(rng), giant: geoTubes(mulberry32(991))
    };
    const col = new THREE.Color();
    Object.keys(pl).forEach((k) => {
      const list = pl[k];
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geos[k], mats[k], list.length);
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
    if (crystals.length) {
      const cm = new THREE.InstancedMesh(geoCrystal(rng), bioMat({ glow: 1.25, rough: 0.25 }), crystals.length);
      crystals.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z);
        dummy.quaternion.copy(o.q);
        dummy.scale.setScalar(o.s);
        dummy.updateMatrix();
        cm.setMatrixAt(i, dummy.matrix);
        col.setHex(o.c);
        col.offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.1);
        cm.setColorAt(i, col);
      });
      cm.instanceMatrix.needsUpdate = true;
      if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
      cm.frustumCulled = false;
      root.add(cm);
    }
  }

  /* ---------- Herz-Kristall in der Kluft (Sehenswürdigkeit 2) ---------- */
  const crystalPos = new THREE.Vector3(CS.x, floorH(CS.x, CS.z) + 11, CS.z);
  const heart = new THREE.Group();
  const heartMat = new THREE.MeshStandardMaterial({
    color: 0x9ff0ff, emissive: 0x3fd6ff, emissiveIntensity: 1.7, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92
  });
  const heartMat2 = new THREE.MeshStandardMaterial({
    color: 0xd9b8ff, emissive: 0xa05cff, emissiveIntensity: 1.5, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9
  });
  const octa = new THREE.OctahedronGeometry(1, 0);
  {
    const m = new THREE.Mesh(octa, heartMat); m.scale.set(4.2, 11, 4.2); heart.add(m);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.283;
      const s = new THREE.Mesh(octa, heartMat2);
      s.position.set(Math.cos(a) * 9, -6 + (i % 3) * 1.5, Math.sin(a) * 9);
      s.scale.set(1.7, 4.5 + (i % 3) * 1.5, 1.7);
      s.rotation.set(Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35);
      heart.add(s);
    }
    const hh = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), new THREE.MeshBasicMaterial({
      color: 0x5fe8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    heart.add(hh);
    heart.position.copy(crystalPos);
    root.add(heart);
    addSphere(crystalPos.x, crystalPos.y, crystalPos.z, 6.5);
  }
  const zHeart = addZone(crystalPos.x, crystalPos.y + 2, crystalPos.z, 0x6fe8ff, 60, 3600, 0.6, 0.1);

  /* ---------- Versunkenes Forschungs-U-Boot auf dem Felsvorsprung ---------- */
  const wreck = buildWreckSub();
  const wy = wgy + 3.0;
  wreck.g.position.set(WS.x - WS.ux * 1.0, wy, WS.z - WS.uz * 1.0);
  wreck.g.rotation.set(0.1, Math.atan2(WS.ux, WS.uz) + 0.15, 0.28, 'YXZ');
  root.add(wreck.g);
  [-3.2, 0, 3.2].forEach((o) => addSphere(WS.x + WS.ux * o, wy, WS.z + WS.uz * o, 3.6));
  const wreckPos = new THREE.Vector3(WS.x + WS.ux * 2, wgy + 4, WS.z + WS.uz * 2);
  const zWreck = addZone(WS.x + WS.ux * 8, wgy + 5, WS.z + WS.uz * 8, 0xfff0b8, 34, 1900, 0.35, 0.25);

  /* ---------- Licht-Pool: 6 PointLights wandern zu den hellsten Zonen ---------- */
  const poolLights = [];
  for (let i = 0; i < LIGHT_POOL; i++) {
    const L = new THREE.PointLight(0xffffff, 0, 100, 2);
    root.add(L);
    poolLights.push({ L, zi: -1, fade: 0, retire: false });
  }
  const topIdx = new Int32Array(LIGHT_POOL), topSc = new Float32Array(LIGHT_POOL);
  function updatePool(dt, cam) {
    for (let k = 0; k < LIGHT_POOL; k++) { topIdx[k] = -1; topSc[k] = -1; }
    for (let i = 0; i < zones.length; i++) {
      const Z = zones[i];
      const dx = cam.x - Z.x, dy = cam.y - Z.y, dz = cam.z - Z.z;
      let sc = Z.pl * Z.mul / (dx * dx + dy * dy + dz * dz + Z.r * Z.r);
      if (Z.lit) sc *= 1.35;
      if (sc <= topSc[LIGHT_POOL - 1]) continue;
      let k = LIGHT_POOL - 1;
      while (k > 0 && sc > topSc[k - 1]) { topSc[k] = topSc[k - 1]; topIdx[k] = topIdx[k - 1]; k--; }
      topSc[k] = sc; topIdx[k] = i;
    }
    const kf = 1 - Math.exp(-7 * dt);
    for (let p = 0; p < LIGHT_POOL; p++) {
      const P = poolLights[p];
      if (P.zi >= 0) {
        let keep = false;
        for (let k = 0; k < LIGHT_POOL; k++) if (topIdx[k] === P.zi) keep = true;
        P.retire = !keep;
      }
      P.fade += ((P.retire || P.zi < 0 ? 0 : 1) - P.fade) * kf;
      if (P.zi >= 0 && P.retire && P.fade < 0.04) { zones[P.zi].lit = false; P.zi = -1; P.retire = false; P.fade = 0; }
    }
    for (let k = 0; k < LIGHT_POOL; k++) {
      const id = topIdx[k];
      if (id < 0 || zones[id].lit) continue;
      let P = null;
      for (let p = 0; p < LIGHT_POOL; p++) if (poolLights[p].zi < 0) { P = poolLights[p]; break; }
      if (!P) break;
      const Z = zones[id];
      P.zi = id; Z.lit = true; P.fade = 0; P.retire = false;
      P.L.color.copy(Z.col); P.L.distance = Z.r * 3.6; P.L.position.set(Z.x, Z.y, Z.z);
    }
    for (let p = 0; p < LIGHT_POOL; p++) {
      const P = poolLights[p];
      if (P.zi < 0) { P.L.intensity = 0; continue; }
      const Z = zones[P.zi];
      P.L.position.set(Z.x, Z.y, Z.z);
      const fl = 1 + Z.flick * Math.sin(time * 2.4 + Z.ph) * Math.sin(time * 0.7 + Z.ph * 1.9);
      P.L.intensity = Z.pl * Z.mul * P.fade * fl;
    }
  }

  /* ---------- Partikel: Meeresschnee, Rauch, Glut, Blasen ---------- */
  const dotTex = dotTexture();
  const PLK = 700, PLK_S = 120;
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

  /* ==========================================================
     Tiefsee-Monster in der Boss-Höhle (validierte Bahn)
     ========================================================== */
  const monster = buildMonster();
  root.add(monster.g);
  const monsterPos = monster.g.position;
  const MON = { cx: CAVE.x, cz: CAVE.z, rx: 95, rz: 55, y0: -142, ay: 12, rate: 0.07 };
  function monsterPath(t, out) {
    const a = t * MON.rate;
    out.x = MON.cx + MON.rx * Math.sin(a);
    out.z = MON.cz + MON.rz * Math.cos(a);
    out.y = MON.y0 + MON.ay * Math.sin(a * 1.7 + 1.0);
    return out;
  }
  function monsterClear(px, py, pz, r) {
    if (floorH(px, pz) > py - r) return false;
    if (floorH(px + r, pz) > py - r * 0.6 || floorH(px - r, pz) > py - r * 0.6 ||
        floorH(px, pz + r) > py - r * 0.6 || floorH(px, pz - r) > py - r * 0.6) return false;
    if (ceilH(px, pz) < py + r) return false;
    for (let i = 0; i < pillars.length; i++) {
      const P = pillars[i];
      const ty = clamp(py, P.y0, P.y1);
      const lim = pillarR(P, (ty - P.y0) / P.h) + r;
      const dx = px - P.x, dy = py - ty, dz = pz - P.z;
      if (dx * dx + dy * dy + dz * dz < lim * lim) return false;
    }
    for (let i = 0; i < spheres.length; i++) {
      const c = spheres[i], lim = c.r + r;
      const dx = px - c.x, dy = py - c.y, dz = pz - c.z;
      if (dx * dx + dy * dy + dz * dz < lim * lim) return false;
    }
    return true;
  }
  function validateMonster(sc, margin) {
    const o = new THREE.Object3D(), p = new THREE.Vector3(), nx = new THREE.Vector3(), w = new THREE.Vector3();
    const T = Math.PI * 2 / MON.rate;
    for (let t = 0; t < T; t += 0.6) {
      monsterPath(t, p); monsterPath(t + 0.8, nx);
      o.position.copy(p); o.lookAt(nx); o.updateMatrixWorld(true);
      for (let i = 0; i < MON_PROBES.length; i++) {
        const pr = MON_PROBES[i];
        w.set(pr[0] * sc, pr[1] * sc, pr[2] * sc).applyMatrix4(o.matrixWorld);
        if (!monsterClear(w.x, w.y, w.z, pr[3] * sc + margin)) return false;
      }
    }
    return true;
  }
  {
    const bx = MON.rx, bz = MON.rz;
    let k = 1;
    for (let it = 0; it < 16 && !validateMonster(MON_SCALE, 4); it++) {
      k *= 0.92;
      MON.rx = bx * k; MON.rz = bz * k;
    }
  }
  monsterPath(0, monsterPos);
  const zMon = addZone(monsterPos.x, monsterPos.y, monsterPos.z, 0x8ff0ff, 70, 3200, 0, 0.15);

  /* ==========================================================
     Leucht-Fischschwärme: auf allen Tiefen
     ========================================================== */
  const fishMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const fishGeos = {};
  Object.keys(FISH_KINDS).forEach((k) => { fishGeos[k] = fishGeo(FISH_KINDS[k]); });
  const schools = [];
  const _co = {};
  function schoolCenter(S, t, out) {
    const a = t * S.w + S.ph;
    if (S.mode === 0) {                         // Canyon / Seitenarm
      const ss = clamp(S.s0 + Math.sin(a) * S.amp, 10, S.ch.len - 6);
      chanAt(S.ch, ss, _co);
      const lat = Math.sin(a * 1.7 + 1.0) * _co.w * 0.3;
      out.x = _co.x - _co.tz * lat; out.z = _co.z + _co.tx * lat;
      out.y = floorH(out.x, out.z) + S.h + Math.sin(a * 0.7) * 4;
    } else if (S.mode === 1) {                  // Boss-Höhle
      out.x = CAVE.x + Math.sin(a) * CAVE.rx * S.rf;
      out.z = CAVE.z + Math.cos(a * 1.3) * CAVE.rz * S.rf;
      out.y = CAVE_FLOOR + S.h + Math.sin(a * 0.7) * 6;
    } else {                                    // Lagune
      out.x = LAG.x + Math.sin(a) * 34;
      out.z = LAG.z + Math.cos(a * 1.2) * 30;
      out.y = -14 - S.h + Math.sin(a * 0.7) * 3;
    }
    if (out.y > -8) out.y = -8;
    return out;
  }
  function addSchool(kind, mode, o) {
    const n = dn(o.n);
    const mesh = new THREE.InstancedMesh(fishGeos[kind], fishMat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    root.add(mesh);
    const S = {
      kind, mode, ch: o.ch || MAIN, s0: o.s0 || 0, amp: o.amp || 24, rf: o.rf || 0.5, h: o.h || 20, w: o.w || 0.1, ph: rng() * 6.28,
      mesh, fish: [], c: new THREE.Vector3(), cvel: new THREE.Vector3(), maxSp: 5.2, spread: o.spread || 6
    };
    schoolCenter(S, 0, S.c);
    const sz = o.sz || 3.0;
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(S.spread * Math.cbrt(rng()));
      S.fish.push({ pos: S.c.clone().add(off), vel: new THREE.Vector3((rng() - 0.5) * 2, 0, (rng() - 0.5) * 2), off, ph: rng() * 6.28, size: sz * (0.85 + rng() * 0.3) });
    }
    schools.push(S);
  }
  for (let i = 0; i < 3; i++) addSchool(FISH_ORDER[(i * 2) % 6], 2, { n: 20, h: 6 + i * 10, w: 0.12 + i * 0.02, sz: 2.4, spread: 6 });
  for (let i = 0; i < 26; i++) {
    addSchool(FISH_ORDER[i % 6], 0, { n: 18, s0: 70 + i * 36 + rng() * 10, amp: 18 + rng() * 14, h: 8 + rng() * 34, w: 0.09 + rng() * 0.05, sz: 2.6 + rng() * 0.8, spread: 6 });
  }
  for (let i = 0; i < 8; i++) {
    addSchool(FISH_ORDER[(i + 2) % 6], 0, { n: 30, s0: 100 + i * 105, amp: 40, h: 15 + rng() * 30, w: 0.13, sz: 1.5, spread: 5 });
  }
  for (let i = 0; i < 5; i++) {
    addSchool(FISH_ORDER[(i + 1) % 6], 1, { n: 26, rf: 0.3 + rng() * 0.25, h: 30 + rng() * 70, w: 0.07 + rng() * 0.03, sz: 3.4, spread: 9 });
  }
  addSchool('teal', 0, { ch: BRANCH, n: 16, s0: BRANCH.len * 0.5, amp: 45, h: 18, w: 0.12, sz: 2.2, spread: 5 });

  let frame = 0;
  function updateSchool(s, dt, cam) {
    _tmp.copy(s.c);
    schoolCenter(s, time, s.c);
    s.cvel.copy(s.c).sub(_tmp).multiplyScalar(1 / Math.max(dt, 0.001));
    const far = Math.abs(s.c.x - cam.x) + Math.abs(s.c.z - cam.z) + Math.abs(s.c.y - cam.y) > 620;
    if (far) {                                  // weit weg: nur rigide mitschieben
      const dx = s.c.x - _tmp.x, dy = s.c.y - _tmp.y, dz = s.c.z - _tmp.z;
      for (let i = 0; i < s.fish.length; i++) { const p = s.fish[i].pos; p.x += dx; p.y += dy; p.z += dz; }
      return;
    }
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
      const cl = ceilH(f.pos.x, f.pos.z) - 4;
      if (f.pos.y > cl) f.pos.y = cl;
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
    color: c, emissive: c, emissiveIntensity: 1.4, transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.3, depthWrite: false
  }));
  const jellies = [];
  const addJelly = (x, z, y, i) => {
    const s = 2.0 + rng() * 2.6, mat = jellyMats[i % jellyMats.length];
    const gj = new THREE.Group();
    const bell = new THREE.Mesh(jellyBell, mat); bell.scale.set(s, s * 0.8, s); gj.add(bell);
    const tent = new THREE.Mesh(jellyTent, mat); tent.scale.set(s, s, s); gj.add(tent);
    const base = new THREE.Vector3(x, Math.min(-12, y), z);
    gj.position.copy(base);
    root.add(gj);
    jellies.push({ g: gj, pos: gj.position, base, bell, tent, ph: rng() * 6.28, s });
  };
  for (let i = 0; i < dn(22); i++) {
    chanSpot(MAIN, 60 + rng() * (MAIN.len - 120), rng() < 0.5 ? 1 : -1, rng() * 0.45, SP);
    addJelly(SP.x, SP.z, floorH(SP.x, SP.z) + 15 + rng() * 45, i);
  }
  for (let i = 0; i < dn(8); i++) {
    const ang = rng() * 6.283, a = Math.sqrt(rng()) * 0.6;
    addJelly(CAVE.x + Math.cos(ang) * CAVE.rx * a, CAVE.z + Math.sin(ang) * CAVE.rz * a, -100 - rng() * 40, i + 22);
  }

  /* ==========================================================
     Sehenswürdigkeiten
     ========================================================== */
  const sights = [
    { kind: 'subwreck', visited: false },
    { kind: 'crystal', visited: false },
    { kind: 'monster', visited: false }
  ];
  let sightCount = 0, wreckSeen = false, crystalSeen = false, monsterSeen = false, caveSeen = false;

  function mark(i) {
    if (sights[i].visited) return;
    sights[i].visited = true;
    sightCount++;
    ev('sight', { kind: sights[i].kind, count: sightCount });
    if (sightCount === 3) ev('all-sights');
  }

  /* ==========================================================
     Kollision (Höhenfeld inkl. steiler Wände, Dach, Säulen, Felsen, Dock)
     ========================================================== */
  const RING = [[0, 0, 0]];
  [0.25, 0.5, 0.75, 1.0].forEach((f, ri) => {
    for (let k = 0; k < 8; k++) {
      const a = (k + ri * 0.5) / 8 * Math.PI * 2;
      RING.push([Math.cos(a) * f, Math.sin(a) * f, f]);
    }
  });

  function collideTerrain(p, vel, R) {
    let impact = 0;
    for (let it = 0; it < 4; it++) {
      const hc = floorH(p.x, p.z);
      if (p.y < hc + 0.05) {                     // Mittelpunkt im Fels → entlang der Normalen heraus
        terrainNormal(p.x, p.z, _nrm);
        p.addScaledVector(_nrm, Math.min((hc - p.y) * _nrm.y + R, 60));
        const vn = vel.x * _nrm.x + vel.y * _nrm.y + vel.z * _nrm.z;
        if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= _nrm.x * vn; vel.y -= _nrm.y * vn; vel.z -= _nrm.z * vn; }
        continue;
      }
      let pen = 0, nx = 0, ny = 1, nz = 0;
      for (let k = 0; k < RING.length; k++) {
        const ox = RING[k][0] * R, oz = RING[k][1] * R;
        const h = k === 0 ? hc : floorH(p.x + ox, p.z + oz);
        const dy = p.y - Math.min(p.y, h);       // 0, wenn die Fels-Säule den Mittelpunkt überragt (Wand)
        const d2 = ox * ox + oz * oz + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2), pn = R - d;
        if (pn > pen) {
          pen = pn;
          if (d > 1e-4) { nx = -ox / d; ny = dy / d; nz = -oz / d; } else { nx = 0; ny = 1; nz = 0; }
        }
      }
      if (pen <= 0) break;
      p.x += nx * pen; p.y += ny * pen; p.z += nz * pen;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }
    return impact;
  }

  function collideRoof(p, vel, R) {
    if (p.y + R < -85) return 0;
    if (p.x < CRX0 - R || p.x > CRX1 + R || p.z < CRZ0 - R || p.z > CRZ1 + R) return 0;
    let impact = 0;
    for (let it = 0; it < 3; it++) {
      const cc = ceilH(p.x, p.z);
      if (p.y > cc - 0.05) {                     // Mittelpunkt im Dach → nach unten heraus
        p.y = cc - R;
        if (vel.y > 0) { impact = Math.max(impact, vel.y); vel.y = 0; }
        continue;
      }
      let pen = 0, nx = 0, ny = -1, nz = 0;
      for (let k = 0; k < RING.length; k++) {
        const ox = RING[k][0] * R, oz = RING[k][1] * R;
        const c = k === 0 ? cc : ceilH(p.x + ox, p.z + oz);
        const dy = Math.max(p.y, c) - p.y;
        const d2 = ox * ox + oz * oz + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2), pn = R - d;
        if (pn > pen) {
          pen = pn;
          if (d > 1e-4) { nx = -ox / d; ny = -dy / d; nz = -oz / d; } else { nx = 0; ny = -1; nz = 0; }
        }
      }
      if (pen <= 0) break;
      p.x += nx * pen; p.y += ny * pen; p.z += nz * pen;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }
    return impact;
  }

  function collideSub(p, vel, R) {
    const isSub = R > 2;
    let impact = 0;

    // Welt-Grenzen
    if (p.x > BX) { p.x = BX; if (vel.x > 0) { impact = Math.max(impact, vel.x); vel.x = 0; } }
    if (p.x < -BX) { p.x = -BX; if (vel.x < 0) { impact = Math.max(impact, -vel.x); vel.x = 0; } }
    if (p.z > ZMAX) { p.z = ZMAX; if (vel.z > 0) { impact = Math.max(impact, vel.z); vel.z = 0; } }
    if (p.z < ZMIN) { p.z = ZMIN; if (vel.z < 0) { impact = Math.max(impact, -vel.z); vel.z = 0; } }

    impact = Math.max(impact, collideTerrain(p, vel, R));
    impact = Math.max(impact, collideRoof(p, vel, R));

    // Felskugeln (Vorsprünge, Boulder, Alkoven, Wrack, Herz-Kristall)
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
  function wrap(v, size) { return (((v % size) + size) % size) - size / 2; }

  function update(dt, ctx) {
    ctx = ctx || {};
    dt = Math.min(dt, 0.1);
    time += dt;
    frame++;
    timeU.value = time;
    const cam = ctx.camPos || _cam;
    const sp = ctx.subPos || cam;

    // Monster: majestätisch durch die Höhle, Kiefer / Schwanz / Flossen / Angel animiert
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
      M.halo.material.opacity = 0.18 + 0.08 * Math.sin(time * 2.6);
      M.phMat.color.setScalar(0.75 + 0.25 * Math.sin(time * 1.9));
      M.g.updateMatrixWorld(true);
      M.bulb.getWorldPosition(_v);
      zMon.x = _v.x; zMon.y = _v.y; zMon.z = _v.z;
      zMon.mul = 0.85 + 0.15 * Math.sin(time * 2.6);
    }

    // Wrack: flackernde Scheinwerfer + SOS-Leuchte
    {
      const fl = 0.8 + 0.2 * Math.sin(time * 7) * Math.sin(time * 2.3) + (Math.sin(time * 0.9) > 0.93 ? -0.4 : 0);
      wreck.beamMat.opacity = 0.16 * clamp(fl, 0.3, 1.1);
      zWreck.mul = clamp(fl, 0.3, 1.1);
      wreck.beacon.visible = Math.sin(time * 4) > 0;
    }

    // Herz-Kristall: dreht sich, pulsiert
    heart.rotation.y = time * 0.25;
    heart.position.y = crystalPos.y + Math.sin(time * 0.8) * 0.8;
    heartMat.emissiveIntensity = 1.5 + 0.35 * Math.sin(time * 1.9);
    zHeart.mul = 0.9 + 0.1 * Math.sin(time * 1.9);

    // Wandernde PointLights
    updatePool(dt, cam);

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
    for (let i = 0; i < schools.length; i++) updateSchool(schools[i], dt, cam);
    jellies.forEach((j) => {
      j.pos.set(j.base.x + Math.sin(time * 0.2 + j.ph) * 3, j.base.y + Math.sin(time * 0.5 + j.ph) * 2.5, j.base.z + Math.cos(time * 0.17 + j.ph) * 3);
      const pulse = Math.sin(time * 2.0 + j.ph);
      j.bell.scale.set(j.s * (1 - pulse * 0.06), j.s * (0.8 + pulse * 0.16), j.s * (1 - pulse * 0.06));
      j.tent.scale.y = j.s * (1 - pulse * 0.1);
    });

    // Sehenswürdigkeiten
    const dWreck = sp.distanceTo(wreckPos);
    if (!sights[0].visited && dWreck < 30) mark(0);
    if (!wreckSeen && dWreck < 130) { wreckSeen = true; ev('wreck-found'); }
    const dCry = sp.distanceTo(crystalPos);
    if (!sights[1].visited && dCry < 32) mark(1);
    if (!crystalSeen && dCry < 140) { crystalSeen = true; ev('crystal-found'); }
    const dMon = sp.distanceTo(monsterPos);
    if (!sights[2].visited && dMon < 80) mark(2);
    if (!monsterSeen && dMon < 260) { monsterSeen = true; ev('monster-found'); }
    if (!caveSeen && sp.y < -150 && caveA(sp.x, sp.z) < 0.9) { caveSeen = true; ev('lava-found'); }
  }

  /* ==========================================================
     Öffentliche Schnittstelle
     ========================================================== */
  const pingTargets = [wreckPos, crystalPos, monsterPos];
  const level = {
    group: root,
    WORLD: WORLD3,
    meta: {
      icons: ['🔬', '💎', '👹'],
      names: { de: ['Forschungs-U-Boot', 'Kristall-Kluft', 'Tiefsee-Monster'], en: ['Research sub', 'Crystal cleft', 'Deep-sea monster'] }
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
