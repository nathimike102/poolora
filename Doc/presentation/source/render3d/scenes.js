// Poolora deck animations, rendered frame by frame by render.js.
// ?scene=hero|pool|map. window.frame(i) draws frame i and returns a JPEG data URL.
import * as THREE from 'three';

const W = 1280;
const H = 720;
const FPS = 30;
const C = {
  navy: 0x1b1446,
  deep: 0x0e0a2c,
  teal: 0x0b7a75,
  tealLight: 0x3fc1b5,
  mint: 0xe3f2f0,
  pink: 0xd9468f,
  grey: 0x8b8aa6,
  road: 0x2d2766,
};

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') || 'hero';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ── helpers ────────────────────────────────────────────────────────────
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic random, so every render is identical */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function gradientBackground(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}

function label(text, { size = 34, color = '#ffffff', weight = 700 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w;
  c.height = size + 20;
  g.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  g.fillStyle = 'rgba(14,10,44,0.72)';
  const r = 12;
  g.beginPath();
  g.roundRect(0, 0, w, c.height, r);
  g.fill();
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 12, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const k = 0.0058;
  s.scale.set(w * k, c.height * k, 1);
  s.renderOrder = 10;
  return s;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A small low-poly car, facing +x */
function car(bodyColor, cabinColor = 0xffffff) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.32), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.15 }));
  body.position.y = 0.13;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.28), new THREE.MeshStandardMaterial({ color: cabinColor, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 }));
  cabin.position.set(-0.03, 0.27, 0);
  cabin.castShadow = true;
  g.add(body, cabin);
  const wheel = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 14);
  const wm = new THREE.MeshStandardMaterial({ color: 0x15132b, roughness: 0.8 });
  for (const [x, z] of [[0.2, 0.16], [-0.2, 0.16], [0.2, -0.16], [-0.2, -0.16]]) {
    const w = new THREE.Mesh(wheel, wm);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.065, z);
    g.add(w);
  }
  return g;
}

/** A map pin: sphere on a cone */
function pin(color, scale = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, emissive: color, emissiveIntensity: 0.25 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), m);
  head.position.y = 0.34;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 20), m);
  tip.rotation.x = Math.PI;
  tip.position.y = 0.17;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  dot.position.set(0, 0.34, 0.1);
  head.castShadow = tip.castShadow = true;
  g.add(head, tip, dot);
  g.scale.setScalar(scale);
  return g;
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      resolve(t);
    }, undefined, reject);
  });
}

function roundedAlpha(w, h, r) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(0, 0, w, h, r);
  g.fill();
  return new THREE.CanvasTexture(c);
}

// ── scenes ─────────────────────────────────────────────────────────────
const scenes = {
  /** The phone, turning slowly, showing home, search results and a live ride */
  async hero() {
    const seconds = 9;
    const scene = new THREE.Scene();
    scene.background = gradientBackground('#241b5c', '#0b0826');
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.05, 5.5);
    camera.lookAt(0, -0.05, 0);

    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x1b1446, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rimT = new THREE.PointLight(C.tealLight, 30, 12);
    rimT.position.set(-3, 1.5, -1.5);
    const rimP = new THREE.PointLight(C.pink, 24, 12);
    rimP.position.set(3.2, -1.2, -1.2);
    scene.add(rimT, rimP);

    const phone = new THREE.Group();
    scene.add(phone);
    const pw = 1.02;
    const ph = 2.2;
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(pw, ph, 0.15), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 6, curveSegments: 24 });
    bodyGeo.translate(0, 0, -0.08);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({ color: 0x17152b, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }));
    phone.add(body);

    const sw = pw - 0.07;
    const sh = sw / 0.448;
    const scale = Math.min(1, (ph - 0.07) / sh);
    const names = ['home', 'results', 'live_2'];
    const alpha = roundedAlpha(256, 571, 26);
    const screens = [];
    for (const [i, n] of names.entries()) {
      const tex = await loadTexture(`/screens/clean/${n}.png`);
      const m = new THREE.MeshBasicMaterial({ map: tex, alphaMap: alpha, transparent: true, opacity: i === 0 ? 1 : 0, toneMapped: false });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(sw * scale, sh * scale), m);
      s.position.z = 0.03 + i * 0.001;
      phone.add(s);
      screens.push(m);
    }

    // Soft shadow under the phone
    const shadow = glowSprite('rgba(0,0,0,0.9)', 2.6);
    shadow.material.blending = THREE.NormalBlending;
    shadow.position.set(0, -1.55, -0.4);
    shadow.scale.set(2.6, 0.5, 1);
    scene.add(shadow);

    const pins = [pin(C.pink, 0.9), pin(C.tealLight, 0.8), pin(0xffffff, 0.7)];
    for (const p of pins) scene.add(p);
    const orbitCar = car(C.teal);
    orbitCar.scale.setScalar(0.9);
    scene.add(orbitCar);
    const glows = [glowSprite('rgba(63,193,181,0.35)', 2.4), glowSprite('rgba(217,70,143,0.3)', 2.0)];
    glows[0].position.set(-1.5, 0.7, -1.8);
    glows[1].position.set(1.5, -0.6, -1.8);
    scene.add(...glows);

    return {
      frames: seconds * FPS,
      draw(f) {
        const t = f / FPS;
        const p = t / seconds;
        phone.rotation.y = 0.42 * Math.sin(2 * Math.PI * p);
        phone.rotation.x = -0.06 + 0.035 * Math.sin(4 * Math.PI * p);
        phone.position.y = 0.06 * Math.sin(4 * Math.PI * p);
        // Three screens, three seconds each, cross-fading
        const seg = seconds / names.length;
        screens.forEach((m, i) => {
          const start = i * seg;
          const inT = i === 0 ? 1 : smooth(start - 0.35, start + 0.35, t);
          const outT = i === names.length - 1 ? 1 - smooth(seconds - 0.35, seconds, t) : 1 - smooth(start + seg - 0.35, start + seg + 0.35, t);
          m.opacity = i === 0 ? Math.max(outT, smooth(seconds - 0.35, seconds, t)) : Math.min(inT, outT);
        });
        pins.forEach((pn, i) => {
          const a = 2 * Math.PI * (p + i / 3);
          pn.position.set(1.5 * Math.cos(a), -0.15 + 0.25 * Math.sin(a * 2), 0.8 * Math.sin(a) - 0.2);
          pn.rotation.y = a * 2;
        });
        const ca = 2 * Math.PI * (p + 0.15);
        orbitCar.position.set(1.7 * Math.cos(-ca), -1.08, 0.95 * Math.sin(-ca));
        orbitCar.rotation.y = ca + Math.PI / 2 + Math.PI;
        renderer.render(scene, camera);
      },
    };
  },

  /** Three cars with one person each fade out; one Poolora car picks all three up */
  async pool() {
    const seconds = 10;
    const scene = new THREE.Scene();
    scene.background = gradientBackground('#1d1650', '#0a0722');
    scene.fog = new THREE.Fog(0x0e0a2c, 14, 26);
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x140f3a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-5, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x19134a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // The main road: an S-curve from the suburbs into town
    const main = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7, 0, 3.2), new THREE.Vector3(-3.5, 0, 2.2), new THREE.Vector3(-1, 0, -0.2),
      new THREE.Vector3(1.8, 0, -1.4), new THREE.Vector3(4.5, 0, -1), new THREE.Vector3(7.2, 0, -2.6),
    ]);
    function ribbon(curve, width, color, y = 0.005) {
      const pts = curve.getSpacedPoints(160);
      const pos = [];
      const idx = [];
      pts.forEach((p, i) => {
        const tn = curve.getTangentAt(i / 160);
        const n = new THREE.Vector3(-tn.z, 0, tn.x).multiplyScalar(width / 2);
        pos.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z);
        if (i > 0) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      scene.add(m);
      return m;
    }
    ribbon(main, 0.75, C.road);
    // Dashes
    const dashGeo = new THREE.BoxGeometry(0.18, 0.01, 0.03);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x8c86c9 });
    for (let i = 0; i < 60; i++) {
      const u = i / 60;
      const p = main.getPointAt(u);
      const tn = main.getTangentAt(u);
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(p.x, 0.012, p.z);
      d.rotation.y = -Math.atan2(tn.z, tn.x);
      scene.add(d);
    }
    // Where each rider waits, and the side street their solo car would have taken
    const stops = [0.28, 0.52, 0.76];
    const branches = stops.map((u, i) => {
      const p = main.getPointAt(u);
      const side = i % 2 === 0 ? 1 : -1;
      const start = new THREE.Vector3(p.x - 1.2, 0, p.z + side * 3.4);
      const curve = new THREE.CatmullRomCurve3([start, new THREE.Vector3(p.x - 0.5, 0, p.z + side * 1.6), new THREE.Vector3(p.x + 1.6, 0, p.z + side * 0.2 - 0.3), new THREE.Vector3(7.5, 0, -2.4 + side * 0.4)]);
      ribbon(curve, 0.42, 0x241f58, 0.003);
      return curve;
    });

    // Town: blocks either side
    const rand = rng(7);
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    const palette = [0x2a2270, 0x322a84, 0x3b3196, 0x25205e, 0x0f5f6c];
    for (let i = 0; i < 46; i++) {
      const x = -8 + rand() * 16;
      const z = -6 + rand() * 11;
      const u = Math.min(0.999, Math.max(0, (x + 7) / 14.2));
      const near = main.getPointAt(u);
      if (Math.hypot(near.x - x, near.z - z) < 1.5) continue;
      if (branches.some((b) => b.getSpacedPoints(40).some((p) => Math.hypot(p.x - x, p.z - z) < 1.0))) continue;
      const h = 0.25 + rand() * (x > 3 ? 1.9 : 0.8);
      const m = new THREE.Mesh(blockGeo, new THREE.MeshStandardMaterial({ color: palette[Math.floor(rand() * palette.length)], roughness: 0.7 }));
      m.scale.set(0.45 + rand() * 0.5, h, 0.45 + rand() * 0.5);
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }

    const riders = stops.map((u) => {
      const p = main.getPointAt(u);
      const tn = main.getTangentAt(u);
      const side = new THREE.Vector3(-tn.z, 0, tn.x).multiplyScalar(0.62);
      const pn = pin(C.pink, 1.7);
      pn.position.copy(p).add(side);
      scene.add(pn);
      return { pin: pn, u, home: pn.position.clone() };
    });

    const solo = branches.map((b) => {
      const c = car(C.grey, 0xd8d8e8);
      c.scale.setScalar(1.5);
      c.traverse((o) => {
        if (o.material) {
          o.material = o.material.clone();
          o.material.transparent = true;
        }
      });
      scene.add(c);
      return { car: c, curve: b };
    });

    const poolCar = car(C.teal, C.mint);
    poolCar.scale.setScalar(1.9);
    scene.add(poolCar);
    const seats = [0, 1, 2, 3].map((i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5a5680, emissive: 0x000000 }));
      s.position.set(-0.24 + i * 0.16, 0.62, 0);
      poolCar.add(s);
      return s;
    });
    const carGlow = glowSprite('rgba(63,193,181,0.7)', 1.6);
    scene.add(carGlow);

    const riderLabel = label('4 people · 1 car', { size: 40, color: '#e3f2f0' });
    scene.add(riderLabel);
    const soloLabel = label('3 solo trips', { size: 40, color: '#d9d8ea' });
    scene.add(soloLabel);

    return {
      frames: seconds * FPS,
      draw(f) {
        const t = f / FPS;
        const orbit = 0.18 * Math.sin((2 * Math.PI * t) / seconds);
        camera.position.set(6.6 * Math.sin(orbit) - 0.4, 6.6, 7.8 * Math.cos(orbit));
        camera.lookAt(0.3, 0, -0.1);

        // 0–3.4 s: the solo cars drive their own streets, then fade
        const soloFade = 1 - smooth(2.6, 3.4, t);
        const soloIn = smooth(0, 0.5, t);
        solo.forEach(({ car: c, curve }, i) => {
          const u = Math.min(0.999, 0.05 + ((t + i * 0.25) / 3.6) * 0.85);
          const p = curve.getPointAt(u);
          const tn = curve.getTangentAt(u);
          c.position.copy(p);
          c.rotation.y = -Math.atan2(tn.z, tn.x);
          c.traverse((o) => {
            if (o.material) o.material.opacity = soloFade * soloIn;
          });
          c.visible = soloFade * soloIn > 0.02;
        });
        soloLabel.material.opacity = soloFade * soloIn;
        soloLabel.position.set(-1.2, 2.2, 1.6);

        // 3.2–9.4 s: the Poolora car collects each rider
        const drive = smooth(3.2, 9.3, t) * 0.98 + 0.01;
        const pc = main.getPointAt(drive);
        const tn = main.getTangentAt(drive);
        poolCar.position.copy(pc);
        poolCar.rotation.y = -Math.atan2(tn.z, tn.x);
        const carIn = smooth(2.8, 3.4, t) * (1 - smooth(9.5, 10, t));
        poolCar.scale.setScalar(1.9 * carIn);
        carGlow.position.set(pc.x, 0.2, pc.z);
        carGlow.material.opacity = carIn * 0.8;
        let picked = 0;
        riders.forEach((r) => {
          const k = smooth(r.u - 0.05, r.u + 0.005, drive);
          if (k >= 0.99) picked++;
          const hop = Math.sin(k * Math.PI) * 0.8;
          r.pin.position.set(lerp(r.home.x, pc.x, k), r.home.y + hop, lerp(r.home.z, pc.z, k));
          r.pin.scale.setScalar(1.7 * (1 - k) * smooth(0.2, 0.9, t) * (t > 9.6 ? 0 : 1) + (t > 9.6 ? 1.7 * smooth(9.6, 10, t) : 0));
          r.pin.rotation.y = k * 6;
        });
        seats.forEach((s, i) => {
          const on = i === 0 || i <= picked;
          s.material.color.set(on ? C.pink : 0x5a5680);
          s.material.emissive.set(on ? C.pink : 0x000000);
          s.material.emissiveIntensity = on ? 0.6 : 0;
        });
        riderLabel.material.opacity = smooth(8.2, 8.8, t) * (1 - smooth(9.6, 10, t));
        riderLabel.position.set(pc.x - 0.6, 2.1, pc.z);
        renderer.render(scene, camera);
      },
    };
  },

  /** Zimbabwe in 3D with the intercity corridors lighting up from Harare */
  async map() {
    const seconds = 8;
    const scene = new THREE.Scene();
    scene.background = gradientBackground('#211a58', '#0a0722');
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xd6ecff, 0x140f3a, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-4, 8, 6);
    scene.add(sun);

    const geo = await (await fetch('./zwe.geo.json')).json();
    const ring = geo.features[0].geometry.coordinates[0];
    // Degrees to scene units, centred on the country
    const cx = 29.8;
    const cy = -19.0;
    const k = 0.95;
    const proj = (lng, lat) => new THREE.Vector2((lng - cx) * k, (lat - cy) * k);
    const shape = new THREE.Shape(ring.map(([lng, lat]) => proj(lng, lat)));
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
    slabGeo.rotateX(-Math.PI / 2);
    const slab = new THREE.Mesh(slabGeo, [
      new THREE.MeshStandardMaterial({ color: 0x0f6f6b, roughness: 0.55, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x0a4d4a, roughness: 0.7 }),
    ]);
    scene.add(slab);
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ring.map(([lng, lat]) => {
        const p = proj(lng, lat);
        return new THREE.Vector3(p.x, 0.27, -p.y);
      })),
      new THREE.LineBasicMaterial({ color: C.tealLight }),
    );
    scene.add(edge);

    const cities = {
      Harare: [31.05, -17.83], Bulawayo: [28.58, -20.15], Mutare: [32.67, -18.97], Gweru: [29.82, -19.45],
      Masvingo: [30.83, -20.07], Chinhoyi: [30.2, -17.36], 'Victoria Falls': [25.84, -17.93], Beitbridge: [30.0, -22.22],
    };
    const at = (name) => {
      const p = proj(...cities[name]);
      return new THREE.Vector3(p.x, 0.27, -p.y);
    };
    const nodeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
    for (const name of Object.keys(cities)) {
      const p = at(name);
      const big = name === 'Harare';
      const n = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.09 : 0.06, big ? 0.09 : 0.06, big ? 0.34 : 0.16, 20), big ? new THREE.MeshStandardMaterial({ color: C.pink, emissive: C.pink, emissiveIntensity: 0.6 }) : nodeMat);
      n.position.set(p.x, p.y + (big ? 0.17 : 0.08), p.z);
      scene.add(n);
      const g = glowSprite(big ? 'rgba(217,70,143,0.9)' : 'rgba(255,255,255,0.6)', big ? 1.1 : 0.55);
      g.position.set(p.x, p.y + 0.05, p.z);
      scene.add(g);
      const l = label(name, { size: big ? 34 : 26, color: big ? '#ffd3ea' : '#ffffff' });
      l.position.set(p.x, p.y + (big ? 0.62 : 0.4), p.z);
      scene.add(l);
    }
    const routes = ['Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Chinhoyi', 'Victoria Falls', 'Beitbridge'].map((to, i) => {
      const a = at('Harare');
      const b = at(to);
      const mid = a.clone().lerp(b, 0.5);
      mid.y += 0.35 + a.distanceTo(b) * 0.18;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.018, 8), new THREE.MeshBasicMaterial({ color: C.tealLight, transparent: true, opacity: 0.85 }));
      tube.geometry.setDrawRange(0, 0);
      scene.add(tube);
      const pulses = [0, 1, 2].map(() => {
        const s = glowSprite('rgba(255,255,255,0.95)', 0.28);
        scene.add(s);
        return s;
      });
      return { curve, tube, pulses, delay: 0.25 + i * 0.28 };
    });

    return {
      frames: seconds * FPS,
      draw(f) {
        const t = f / FPS;
        const a = 0.22 * Math.sin((2 * Math.PI * t) / seconds) - 0.1;
        camera.position.set(7.4 * Math.sin(a), 6.6, 7.4 * Math.cos(a));
        camera.lookAt(0.2, 0, 0.25);
        routes.forEach((r) => {
          const grow = smooth(r.delay, r.delay + 1.1, t) * (1 - smooth(7.4, 8, t));
          const total = r.tube.geometry.index.count;
          r.tube.geometry.setDrawRange(0, Math.floor(total * grow));
          r.pulses.forEach((s, j) => {
            const u = (((t - r.delay) * 0.32 + j / 3) % 1 + 1) % 1;
            s.position.copy(r.curve.getPointAt(Math.min(u, grow)));
            s.material.opacity = grow > 0.98 ? 1 : 0;
          });
        });
        renderer.render(scene, camera);
      },
    };
  },
};

let current;
window.ready = (async () => {
  current = await scenes[sceneName]();
  current.draw(0);
  return { frames: current.frames, fps: FPS, width: W, height: H };
})();
window.frame = (i) => {
  current.draw(i);
  return renderer.domElement.toDataURL('image/jpeg', 0.94);
};
