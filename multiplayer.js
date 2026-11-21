/* ============================================================
   BEYOND MARIANA – multiplayer.js
   2-Spieler-Multiplayer über PeerJS (WebRTC):
     - Host erstellt einen Raum mit 4-stelligem Code
     - Gast tritt mit dem Code bei
     - 3D-Mitspieler-U-Boot (interpoliert) mit schwebendem Namensschild
     - Live-Geldvergleich (remote.money)

   Passt zu script.js:
     createMultiplayer({ onPeerJoined, onConnected, onStart, onPeerLeft, onError })
     mp.host(name) -> Promise<code>        mp.join(code, name) -> Promise
     mp.sendStart(levelId, seed)           mp.sendState(obj)
     mp.update(dt, camera)                 mp.attachGhost(scene, levelId)
     mp.detachGhost()                      mp.close()
     mp.connected · mp.role · mp.remoteName · mp.remote.money
   Fehlercodes (err.code / err.type): 'peer-unavailable', 'no-lib', 'timeout'
   ============================================================ */

import * as THREE from 'three';

const PEER_PREFIX = 'beyondmariana-';
const PEER_LIB_URLS = [
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'
];
const OPEN_TIMEOUT = 10000;   // ms: Verbindung zum PeerJS-Server
const JOIN_TIMEOUT = 12000;   // ms: Gast wartet auf den Host
const LIB_TIMEOUT = 8000;     // ms: PeerJS-Bibliothek laden
const HOST_CODE_TRIES = 10;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const isNum = (v) => typeof v === 'number' && isFinite(v);

function cleanName(name, fallback) {
  let s = String(name === undefined || name === null ? '' : name)
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim();
  if (s.length > 14) s = s.slice(0, 14);
  return s || fallback;
}

function randomCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

function makeError(code, message) {
  const e = new Error(message || code);
  e.code = code;
  e.type = code;
  return e;
}

/* ------------------------------------------------------------
   PeerJS-Bibliothek sicherstellen (window.Peer), sonst per CDN laden
   ------------------------------------------------------------ */
let libPromise = null;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ok) resolve(); else { try { s.remove(); } catch (e) { /* egal */ } reject(makeError('no-lib')); }
    };
    const timer = setTimeout(() => finish(false), LIB_TIMEOUT);
    s.src = url;
    s.async = true;
    s.onload = () => finish(true);
    s.onerror = () => finish(false);
    document.head.appendChild(s);
  });
}

function loadPeerLib() {
  if (window.Peer) return Promise.resolve();
  if (libPromise) return libPromise;
  libPromise = (async () => {
    for (let i = 0; i < PEER_LIB_URLS.length; i++) {
      try {
        await loadScript(PEER_LIB_URLS[i]);
        if (window.Peer) return;
      } catch (e) { /* nächste URL probieren */ }
    }
    throw makeError('no-lib');
  })();
  libPromise.catch(() => { libPromise = null; });
  return libPromise;
}

/* ------------------------------------------------------------
   Mitspieler-U-Boot (Ghost) + schwebendes Namensschild
   ------------------------------------------------------------ */
function makeLabelTexture(name) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);

  const r = 40;
  g.beginPath();
  g.moveTo(r, 8);
  g.lineTo(512 - r, 8);
  g.quadraticCurveTo(504, 8, 504, r);
  g.lineTo(504, 128 - r);
  g.quadraticCurveTo(504, 120, 512 - r, 120);
  g.lineTo(r, 120);
  g.quadraticCurveTo(8, 120, 8, 128 - r);
  g.lineTo(8, r);
  g.quadraticCurveTo(8, 8, r, 8);
  g.closePath();
  g.fillStyle = 'rgba(4, 24, 40, 0.78)';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(120, 220, 255, 0.95)';
  g.stroke();

  let size = 60;
  g.font = 'bold ' + size + 'px system-ui, -apple-system, Arial, sans-serif';
  while (g.measureText(name).width > 440 && size > 24) {
    size -= 4;
    g.font = 'bold ' + size + 'px system-ui, -apple-system, Arial, sans-serif';
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(name, 256, 68);

  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createGhost(scene, color, name) {
  const geos = [];
  const mats = [];
  const G = (geo) => { geos.push(geo); return geo; };
  const M = (mat) => { mats.push(mat); return mat; };

  const root = new THREE.Group();     // nur Position (Label hängt hier dran)
  root.name = 'mp-ghost-root';
  const body = new THREE.Group();     // Rotation (Gieren/Nicken)
  root.add(body);

  const hullMat = M(new THREE.MeshStandardMaterial({
    color, roughness: 0.45, metalness: 0.25, emissive: color, emissiveIntensity: 0.22
  }));
  const darkMat = M(new THREE.MeshStandardMaterial({
    color: 0x24323c, roughness: 0.6, metalness: 0.4, emissive: 0x0a1218, emissiveIntensity: 0.3
  }));
  const glassMat = M(new THREE.MeshStandardMaterial({
    color: 0x9fe8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55,
    emissive: 0x2a7090, emissiveIntensity: 0.35
  }));

  // Rumpf (Fahrtrichtung = -Z)
  const hull = new THREE.Mesh(G(new THREE.SphereGeometry(1, 28, 18)), hullMat);
  hull.scale.set(2.1, 1.9, 5.2);
  body.add(hull);

  // Glaskuppel vorne
  const dome = new THREE.Mesh(G(new THREE.SphereGeometry(1.6, 24, 16)), glassMat);
  dome.position.set(0, 0.35, -3.4);
  body.add(dome);

  // Turm oben
  const tower = new THREE.Mesh(G(new THREE.CylinderGeometry(0.55, 0.75, 1.1, 14)), hullMat);
  tower.position.set(0, 1.95, 0.6);
  body.add(tower);
  const periscope = new THREE.Mesh(G(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8)), darkMat);
  periscope.position.set(0, 2.9, 0.4);
  body.add(periscope);

  // Heckflossen
  const finGeo = G(new THREE.BoxGeometry(0.15, 2.2, 1.5));
  const finV = new THREE.Mesh(finGeo, hullMat);
  finV.position.set(0, 0.2, 4.4);
  body.add(finV);
  const finH = new THREE.Mesh(G(new THREE.BoxGeometry(3.6, 0.15, 1.3)), hullMat);
  finH.position.set(0, 0.1, 4.5);
  body.add(finH);

  // Bullaugen seitlich
  const portGeo = G(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12));
  const portMat = M(new THREE.MeshBasicMaterial({ color: 0xbff3ff }));
  [-1, 1].forEach((sx) => {
    [-0.6, 1.2, 2.6].forEach((pz) => {
      const p = new THREE.Mesh(portGeo, portMat);
      p.rotation.z = Math.PI / 2;
      p.position.set(sx * 2.0, 0.2, pz);
      body.add(p);
    });
  });

  // Propeller hinten
  const prop = new THREE.Group();
  prop.position.set(0, 0, 5.4);
  const bladeGeo = G(new THREE.BoxGeometry(0.2, 1.8, 0.08));
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(bladeGeo, darkMat);
    b.rotation.z = (i / 3) * Math.PI * 2;
    b.position.set(0, 0, 0);
    const holder = new THREE.Group();
    holder.rotation.z = (i / 3) * Math.PI * 2;
    b.rotation.z = 0;
    b.position.y = 0.9;
    holder.add(b);
    prop.add(holder);
  }
  const hub = new THREE.Mesh(G(new THREE.SphereGeometry(0.28, 10, 8)), darkMat);
  prop.add(hub);
  body.add(prop);

  // Scheinwerfer: Lampe + sichtbarer Lichtkegel (nur wenn Licht an)
  const lamp = new THREE.Mesh(
    G(new THREE.SphereGeometry(0.32, 12, 10)),
    M(new THREE.MeshBasicMaterial({ color: 0xfff2c0 }))
  );
  lamp.position.set(0, -0.2, -5.0);
  body.add(lamp);

  const coneGeo = new THREE.ConeGeometry(9, 42, 24, 1, true);
  coneGeo.translate(0, -21, 0);   // Spitze im Ursprung
  coneGeo.rotateX(Math.PI / 2);   // Öffnung zeigt nach -Z
  geos.push(coneGeo);
  const beam = new THREE.Mesh(coneGeo, M(new THREE.MeshBasicMaterial({
    color: 0xfff0b0, transparent: true, opacity: 0.13, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  })));
  beam.position.set(0, -0.2, -5.1);
  beam.visible = false;
  body.add(beam);

  // Namensschild
  let labelTex = makeLabelTexture(name);
  const labelMat = new THREE.SpriteMaterial({
    map: labelTex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false
  });
  const label = new THREE.Sprite(labelMat);
  label.renderOrder = 999;
  label.position.set(0, 4.8, 0);
  label.scale.set(8, 2, 1);
  root.add(label);

  root.visible = false;
  scene.add(root);

  const ghost = {
    root, body, prop, beam, label, labelName: name,
    propAngle: 0,
    setName(n) {
      if (n === ghost.labelName) return;
      ghost.labelName = n;
      const old = labelTex;
      labelTex = makeLabelTexture(n);
      labelMat.map = labelTex;
      labelMat.needsUpdate = true;
      old.dispose();
    },
    dispose() {
      if (root.parent) root.parent.remove(root);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      labelTex.dispose();
      labelMat.dispose();
    }
  };
  return ghost;
}

/* ------------------------------------------------------------
   createMultiplayer
   ------------------------------------------------------------ */
export function createMultiplayer(callbacks) {
  const cb = callbacks || {};
  const call = (fn, a, b) => {
    if (typeof fn !== 'function') return;
    try { fn(a, b); } catch (err) { console.error('[Multiplayer] Callback-Fehler', err); }
  };

  let sid = 0;                 // Sitzungs-Token (close() macht laufende Vorgänge ungültig)
  let role = null;             // 'host' | 'guest' | null
  let myName = '';
  let roomCode = '';
  let peer = null;
  let conn = null;
  let connected = false;
  let remoteName = '';
  let closing = false;
  let joinSettle = null;       // { resolve, reject, timer } des laufenden join()

  const remote = {
    has: false, age: 0, snap: true,
    lv: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
    vx: 0, vy: 0, vz: 0,
    light: false, thr: 0, steer: 0, vert: 0,
    money: 0
  };

  let ghost = null;
  let ghostLevel = 0;

  function resetRemote() {
    remote.has = false; remote.age = 0; remote.snap = true;
    remote.lv = 0; remote.x = remote.y = remote.z = 0;
    remote.yaw = remote.pitch = 0;
    remote.vx = remote.vy = remote.vz = 0;
    remote.light = false;
    remote.thr = remote.steer = remote.vert = 0;
    remote.money = 0;
  }

  function sendRaw(obj) {
    if (!conn || !conn.open) return false;
    try { conn.send(obj); return true; } catch (err) { return false; }
  }

  function clearJoinSettle() {
    if (joinSettle) { clearTimeout(joinSettle.timer); joinSettle = null; }
  }

  function destroyConn() {
    if (conn) {
      const c = conn;
      conn = null;
      try { c.removeAllListeners && c.removeAllListeners(); } catch (e) { /* egal */ }
      try { c.close(); } catch (e) { /* egal */ }
    }
  }

  function destroyPeer() {
    if (peer) {
      const p = peer;
      peer = null;
      try { p.removeAllListeners && p.removeAllListeners(); } catch (e) { /* egal */ }
      try { p.destroy(); } catch (e) { /* egal */ }
    }
  }

  /* Mitspieler ist weg (Verbindung zu) */
  function peerGone() {
    if (closing) return;
    const wasConnected = connected;
    const name = remoteName;
    connected = false;
    detachGhost();
    resetRemote();
    destroyConn();
    if (role === 'guest') destroyPeer();
    if (joinSettle) {
      const j = joinSettle;
      clearJoinSettle();
      j.reject(makeError('peer-unavailable'));
      return;
    }
    remoteName = '';
    if (wasConnected) call(cb.onPeerLeft, name);
  }

  function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'hello': {
        if (connected) break;
        remoteName = cleanName(msg.name, role === 'host' ? 'Gast' : 'Host');
        connected = true;
        if (role === 'host') {
          call(cb.onPeerJoined, remoteName);
        } else {
          if (joinSettle) {
            const j = joinSettle;
            clearJoinSettle();
            j.resolve();
          }
          call(cb.onConnected);
        }
        break;
      }
      case 'start': {
        if (!connected || role !== 'guest') break;
        call(cb.onStart, Number(msg.level) === 2 ? 2 : 1, (Number(msg.seed) >>> 0) || 1);
        break;
      }
      case 's': {
        if (!connected) break;
        const keys = ['x', 'y', 'z', 'yaw', 'pitch', 'vx', 'vy', 'vz', 'thr', 'steer', 'vert', 'money'];
        for (let i = 0; i < keys.length; i++) {
          if (isNum(msg[keys[i]])) remote[keys[i]] = msg[keys[i]];
        }
        if (isNum(msg.lv)) remote.lv = msg.lv;
        remote.light = !!msg.light;
        remote.age = 0;
        if (!remote.has) { remote.has = true; remote.snap = true; }
        break;
      }
      case 'busy': {
        if (joinSettle) {
          const j = joinSettle;
          clearJoinSettle();
          j.reject(makeError('peer-unavailable', 'Raum ist voll'));
        }
        break;
      }
      default: break;
    }
  }

  function setupConn(c) {
    conn = c;
    c.on('open', () => {
      if (conn !== c) return;
      sendRaw({ t: 'hello', name: myName });
    });
    c.on('data', (data) => {
      if (conn !== c) return;
      handleMessage(data);
    });
    c.on('close', () => { if (conn === c) peerGone(); });
    c.on('error', (err) => {
      if (conn !== c) return;
      call(cb.onError, err);
    });
  }

  /* Peer erzeugen und auf 'open' warten */
  function openPeer(id, mySid) {
    return new Promise((resolve, reject) => {
      let done = false;
      let p;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { p && p.destroy(); } catch (e) { /* egal */ }
        reject(makeError('timeout'));
      }, OPEN_TIMEOUT);

      try {
        p = id ? new window.Peer(id, { debug: 0 }) : new window.Peer({ debug: 0 });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }

      p.on('open', () => {
        if (done) { try { p.destroy(); } catch (e) { /* egal */ } return; }
        done = true;
        clearTimeout(timer);
        if (mySid !== sid) { try { p.destroy(); } catch (e) { /* egal */ } return; }
        resolve(p);
      });
      p.on('error', (err) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          try { p.destroy(); } catch (e) { /* egal */ }
          reject(err);
          return;
        }
        // Fehler nach dem Öffnen
        if (peer !== p) return;
        if (err && err.type === 'peer-unavailable' && joinSettle) {
          const j = joinSettle;
          clearJoinSettle();
          j.reject(err);
          return;
        }
        call(cb.onError, err);
      });
      p.on('disconnected', () => {
        if (!done || peer !== p || closing) return;
        try { p.reconnect(); } catch (e) { /* egal */ }
      });
    });
  }

  /* ---------------- Host ---------------- */
  async function host(name) {
    closeInternal();
    closing = false;
    const mySid = sid;
    role = 'host';
    myName = cleanName(name, 'Host');

    await loadPeerLib();
    if (mySid !== sid) return new Promise(() => {});

    let lastErr = null;
    for (let i = 0; i < HOST_CODE_TRIES; i++) {
      const code = randomCode();
      try {
        const p = await openPeer(PEER_PREFIX + code, mySid);
        if (mySid !== sid) { try { p.destroy(); } catch (e) { /* egal */ } return new Promise(() => {}); }
        peer = p;
        roomCode = code;
        p.on('connection', (c) => {
          if (peer !== p) return;
          if (conn || connected) {
            // Raum ist schon belegt
            c.on('open', () => {
              try { c.send({ t: 'busy' }); } catch (e) { /* egal */ }
              setTimeout(() => { try { c.close(); } catch (e) { /* egal */ } }, 400);
            });
            return;
          }
          setupConn(c);
        });
        return code;
      } catch (err) {
        if (mySid !== sid) return new Promise(() => {});
        lastErr = err;
        if (err && err.type === 'unavailable-id') continue;   // Code schon vergeben -> neuer Code
        throw err;
      }
    }
    throw lastErr || makeError('timeout');
  }

  /* ---------------- Gast ---------------- */
  async function join(code, name) {
    closeInternal();
    closing = false;
    const mySid = sid;
    role = 'guest';
    myName = cleanName(name, 'Gast');

    const clean = String(code === undefined || code === null ? '' : code).replace(/\D/g, '');
    if (clean.length !== 4) throw makeError('peer-unavailable', 'Ungültiger Raum-Code');

    await loadPeerLib();
    if (mySid !== sid) return new Promise(() => {});

    const p = await openPeer(null, mySid);
    if (mySid !== sid) { try { p.destroy(); } catch (e) { /* egal */ } return new Promise(() => {}); }
    peer = p;
    roomCode = clean;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!joinSettle) return;
        joinSettle = null;
        destroyConn();
        destroyPeer();
        role = null;
        reject(makeError('timeout'));
      }, JOIN_TIMEOUT);

      joinSettle = {
        timer,
        resolve: () => resolve(),
        reject: (err) => {
          destroyConn();
          destroyPeer();
          role = null;
          reject(err);
        }
      };

      let c;
      try {
        c = p.connect(PEER_PREFIX + clean, { reliable: true, serialization: 'json' });
      } catch (err) {
        clearJoinSettle();
        destroyPeer();
        role = null;
        reject(err);
        return;
      }
      setupConn(c);
    });
  }

  /* ---------------- Senden ---------------- */
  function sendStart(levelId, seed) {
    if (!connected) return;
    sendRaw({ t: 'start', level: Number(levelId) === 2 ? 2 : 1, seed: (Number(seed) >>> 0) || 1 });
  }

  function sendState(state) {
    if (!connected || !state) return;
    sendRaw(Object.assign({ t: 's' }, state));
  }

  /* ---------------- Ghost (Mitspieler-U-Boot) ---------------- */
  function attachGhost(scene, levelId) {
    detachGhost();
    if (!scene) return;
    ghostLevel = Number(levelId) === 2 ? 2 : 1;
    // Host sieht den Gast in Orange, der Gast sieht den Host in Gelb
    const color = role === 'host' ? 0xff7a2e : 0xffd23a;
    ghost = createGhost(scene, color, remoteName || (role === 'host' ? 'Gast' : 'Host'));
    remote.snap = true;
  }

  function detachGhost() {
    if (ghost) {
      try { ghost.dispose(); } catch (err) { console.error('[Multiplayer] Ghost entsorgen', err); }
      ghost = null;
    }
  }

  function update(dt, camera) {
    if (!ghost) return;
    remote.age += dt;

    const visible = connected && remote.has && remote.lv === ghostLevel;
    ghost.root.visible = visible;
    if (!visible) return;

    if (remoteName && remoteName !== ghost.labelName) ghost.setName(remoteName);

    // Zielposition: letztes Paket + Geschwindigkeit (begrenzt extrapoliert)
    const ex = Math.min(remote.age, 0.3);
    const tx = remote.x + remote.vx * ex;
    const ty = remote.y + remote.vy * ex;
    const tz = remote.z + remote.vz * ex;

    const r = ghost.root;
    const dx = tx - r.position.x, dy = ty - r.position.y, dz = tz - r.position.z;
    if (remote.snap || (dx * dx + dy * dy + dz * dz) > 1600) {
      r.position.set(tx, ty, tz);
      ghost.body.rotation.set(remote.pitch, remote.yaw, 0, 'YXZ');
      remote.snap = false;
    } else {
      const k = damp(12, dt);
      r.position.x += dx * k;
      r.position.y += dy * k;
      r.position.z += dz * k;

      const rot = ghost.body.rotation;
      const dyaw = Math.atan2(Math.sin(remote.yaw - rot.y), Math.cos(remote.yaw - rot.y));
      rot.set(rot.x + (remote.pitch - rot.x) * k, rot.y + dyaw * k, 0, 'YXZ');
    }

    // Propeller + Scheinwerfer
    ghost.propAngle += (2.5 + Math.abs(remote.thr) * 28) * dt;
    ghost.prop.rotation.z = ghost.propAngle;
    ghost.beam.visible = !!remote.light;

    // Namensschild: bleibt auf dem Bildschirm ungefähr gleich groß
    if (camera) {
      const dist = camera.position.distanceTo(r.position);
      const h = clamp(dist * 0.055, 1.4, 22);
      ghost.label.scale.set(h * 4, h, 1);
      ghost.label.position.y = 4.8 + h * 0.15;
    }
  }

  /* ---------------- Schließen ---------------- */
  function closeInternal() {
    sid++;
    closing = true;
    clearJoinSettle();
    connected = false;
    detachGhost();
    destroyConn();
    destroyPeer();
    resetRemote();
    remoteName = '';
    roomCode = '';
    role = null;
    closing = false;
  }

  function close() {
    closeInternal();
  }

  /* ---------------- öffentliches Objekt ---------------- */
  return {
    host,
    join,
    close,
    sendStart,
    sendState,
    update,
    attachGhost,
    detachGhost,
    get connected() { return connected; },
    get role() { return role; },
    get remoteName() { return remoteName; },
    get remote() { return remote; },
    get code() { return roomCode; },
    get myName() { return myName; }
  };
}
