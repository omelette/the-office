import * as THREE from 'three';
import { mergeStaticSubtree } from './batcher.js';

function isDescendantOf(node, ancestor) {
  let curr = node;
  while (curr) {
    if (curr === ancestor) return true;
    curr = curr.parent;
  }
  return false;
}

const DEFAULT_ERA = 'cos';

const ACCEPTED_PASSWORD_NORMALIZED = new Set([
  'sherbet lemon',
  'sherbet lemons',
  'lemon drop',
  'lemon drops',
  'cockroach cluster',
  'cockroach clusters',
  'fizzing whizzbee',
  'acid pops',
  'acid pop',
  'toffee eclairs',
  'toffee eclair',
  'dumbledore',
]);

const ERA_DEFAULT_PASSWORDS = {
  cos: 'Sherbet lemon',
  gof: 'Cockroach Cluster',
  oop: 'Fizzing Whizzbee',
  hbp: 'Acid Pops',
  dh: 'Dumbledore',
};

const ERA_SKY_PRESETS = {
  cos: {
    zenith: '#14223d',
    mid: '#384664',
    horizon: '#9a6250',
    bandColor: '#f0a669',
    bandStrength: 0.56,
    moonDir: [0.42, 0.34, -0.84],
    moonColor: '#ffe0ad',
    moonSize: 0.032,
    stars: 0.24,
    waterTint: '#1f2b3d',
    waterSheen: '#cc8a5c',
    terrainTint: '#6c5a56',
    mistTint: '#b88b76',
    beamColor: '#ffc886',
    beamOpacity: 0.13,
  },
  gof: {
    zenith: '#050916',
    mid: '#0d172d',
    horizon: '#1d2f4e',
    bandColor: '#4c75ab',
    bandStrength: 0.28,
    moonDir: [-0.45, 0.34, -0.82],
    moonColor: '#dceaff',
    moonSize: 0.038,
    stars: 0.96,
    waterTint: '#0b1526',
    waterSheen: '#8fb8f0',
    terrainTint: '#253147',
    mistTint: '#48628a',
    beamColor: '#9ec0f5',
    beamOpacity: 0.11,
  },
  oop: {
    // OoP Ch. 37: "cool line of pale green along the horizon: dawn was approaching."
    zenith: '#070b18',
    mid: '#132136',
    horizon: '#2a504c',
    bandColor: '#8ef4ba',
    bandStrength: 0.96,
    moonDir: [0.55, 0.38, -0.74],
    moonColor: '#bfead6',
    moonSize: 0.024,
    stars: 0.62,
    waterTint: '#0d1f21',
    waterSheen: '#7be8b0',
    terrainTint: '#223638',
    mistTint: '#65b893',
    beamColor: '#9ee8c2',
    beamOpacity: 0.10,
  },
  hbp: {
    zenith: '#040710',
    mid: '#0b1424',
    horizon: '#172438',
    bandColor: '#476287',
    bandStrength: 0.26,
    moonDir: [-0.36, 0.29, -0.89],
    moonColor: '#cfe0fa',
    moonSize: 0.034,
    stars: 0.88,
    waterTint: '#0a1220',
    waterSheen: '#7c9ec9',
    terrainTint: '#202938',
    mistTint: '#465873',
    beamColor: '#9ab2d9',
    beamOpacity: 0.09,
  },
  dh: {
    // DH Ch. 36: Golden Dawn After the Battle
    zenith: '#2a4472',
    mid: '#876677',
    horizon: '#f0a064',
    bandColor: '#ffda8e',
    bandStrength: 0.92,
    moonDir: [0.46, 0.16, -0.87],
    moonColor: '#ffe3a6',
    moonSize: 0.056,
    stars: 0.04,
    waterTint: '#2c394e',
    waterSheen: '#ffc57a',
    terrainTint: '#7a635e',
    mistTint: '#f2ba88',
    beamColor: '#ffe0a3',
    beamOpacity: 0.20,
  },
};

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function normalizePassword(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[!?.]+$/g, '')
    .replace(/\s+/g, ' ');
}

function tagCanonId(root, canonId) {
  if (!root) return;
  if (root.userData) {
    root.userData.canonId = canonId;
  }
  root.traverse((child) => {
    if (child.userData) {
      child.userData.canonId = canonId;
    }
  });
}

function collectMeshes(root) {
  const meshes = [];
  root.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

function isHierarchyVisible(obj) {
  let curr = obj;
  while (curr) {
    if (!curr.visible) return false;
    curr = curr.parent;
  }
  return true;
}

/**
 * Creates a BoxGeometry whose UVs are scaled proportionally to world face dimensions so
 * tiled textures (like Hogwarts ashlar stone courses) always run horizontally at consistent scale.
 */
function createScaledBoxGeometry(w, h, d, unitU = 11.5, unitV = 4.8) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  const uv = geom.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    let u, v;
    if (nx > 0.5) {
      u = (z + d * 0.5) / unitU;
      v = (y + h * 0.5) / unitV;
    } else if (ny > 0.5) {
      u = (x + w * 0.5) / unitU;
      v = (z + d * 0.5) / unitU;
    } else {
      u = (x + w * 0.5) / unitU;
      v = (y + h * 0.5) / unitV;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geom;
}

/**
 * Generates a matte weathered carved-stone material without brick/mortar lines for sculptures.
 */
function createCarvedStoneMaterial() {
  const size = 128;
  const colorData = new Uint8Array(size * size * 4);
  const bumpData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      const fine = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
      const coarse =
        0.5 +
        0.25 * Math.sin(x * 0.19 + y * 0.11) +
        0.25 * Math.cos(x * 0.08 - y * 0.23);
      const shade = 0.72 + coarse * 0.24 + (fine - 0.5) * 0.14;
      const idx = (y * size + x) * 4;
      colorData[idx] = Math.min(255, Math.max(0, Math.round(92 * shade)));
      colorData[idx + 1] = Math.min(255, Math.max(0, Math.round(89 * shade)));
      colorData[idx + 2] = Math.min(255, Math.max(0, Math.round(83 * shade)));
      colorData[idx + 3] = 255;

      const bv = Math.min(255, Math.max(0, Math.round(110 + fine * 85 + coarse * 40)));
      bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = bv;
      bumpData[idx + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.needsUpdate = true;

  const bumpMap = new THREE.DataTexture(bumpData, size, size, THREE.RGBAFormat);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);
  bumpMap.needsUpdate = true;

  return new THREE.MeshStandardMaterial({
    name: 'carvedGargoyleStone',
    map,
    bumpMap,
    bumpScale: 0.014,
    roughness: 0.89,
    metalness: 0.04,
  });
}

/**
 * Builds a watertight curved wall arc sector geometry matching layout.polarToCartesian
 * (`x = r * sin(theta), z = r * cos(theta)`), with crisp per-face normals and world-aligned UVs.
 */
function createCurvedWallArcGeometry({
  innerR,
  outerR,
  startRad,
  endRad,
  minY = 0,
  maxY = 5.6,
  radialSegs = 8,
  roomHeight = 5.6,
  yFnBottom = null,
  yFnTop = null,
}) {
  const positions = [];
  const uvs = [];
  const segs = Math.max(1, radialSegs);
  const twoPi = Math.PI * 2;

  const pushTri = (a, b, c, ua, ub, uc) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };

  const pushQuad = (v00, v10, v11, v01, u00, u10, u11, u01) => {
    pushTri(v00, v10, v11, u00, u10, u11);
    pushTri(v00, v11, v01, u00, u11, u01);
  };

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const th0 = startRad + (endRad - startRad) * t0;
    const th1 = startRad + (endRad - startRad) * t1;

    const yB0 = yFnBottom ? yFnBottom(t0) : minY;
    const yB1 = yFnBottom ? yFnBottom(t1) : minY;
    const yT0 = yFnTop ? yFnTop(t0) : maxY;
    const yT1 = yFnTop ? yFnTop(t1) : maxY;

    const s0 = Math.sin(th0);
    const c0 = Math.cos(th0);
    const s1 = Math.sin(th1);
    const c1 = Math.cos(th1);

    const u0 = (th0 / twoPi) * 3.0;
    const u1 = (th1 / twoPi) * 3.0;
    const vB0 = yB0 / roomHeight;
    const vB1 = yB1 / roomHeight;
    const vT0 = yT0 / roomHeight;
    const vT1 = yT1 / roomHeight;

    const i0B = [innerR * s0, yB0, innerR * c0];
    const i1B = [innerR * s1, yB1, innerR * c1];
    const i0T = [innerR * s0, yT0, innerR * c0];
    const i1T = [innerR * s1, yT1, innerR * c1];

    const o0B = [outerR * s0, yB0, outerR * c0];
    const o1B = [outerR * s1, yB1, outerR * c1];
    const o0T = [outerR * s0, yT0, outerR * c0];
    const o1T = [outerR * s1, yT1, outerR * c1];

    // Inner curved face (faces radially inward)
    pushQuad(i0B, i0T, i1T, i1B, [u0, vB0], [u0, vT0], [u1, vT1], [u1, vB1]);
    // Outer curved face (faces radially outward)
    pushQuad(o0B, o1B, o1T, o0T, [u0, vB0], [u1, vB1], [u1, vT1], [u0, vT0]);
    // Top cap (+Y)
    pushQuad(o0T, o1T, i1T, i0T, [u0, 0], [u1, 0], [u1, 0.25], [u0, 0.25]);
    // Bottom cap (-Y)
    pushQuad(o0B, i0B, i1B, o1B, [u0, 0], [u0, 0.25], [u1, 0.25], [u1, 0]);

    if (i === 0) {
      pushQuad(o0B, o0T, i0T, i0B, [0, vB0], [0, vT0], [0.22, vT0], [0.22, vB0]);
    }
    if (i === segs - 1) {
      pushQuad(o1B, i1B, i1T, o1T, [0, vB1], [0.22, vB1], [0.22, vT1], [0, vT1]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Computes a Gothic pointed arch height profile for normalized parameter t in [0, 1].
 */
function gothicArchY(t, springY, peakY) {
  const d = Math.abs(t * 2 - 1);
  return springY + (peakY - springY) * Math.pow(Math.max(0, 1 - d * d * 0.88), 0.72);
}

/**
 * Shared forged wrought-iron PBR material for sconces, hinges, andirons, and hearth fender.
 */
function createWroughtIronMaterial() {
  return new THREE.MeshStandardMaterial({
    name: 'forgedWroughtIron',
    color: '#1e2024',
    roughness: 0.48,
    metalness: 0.8,
  });
}

/**
 * Generates a pure-DataTexture smooth radial glow sprite (DOM-free for Node ESM checks).
 */
function createGlowSpriteDataTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1;
      const dy = (y + 0.5) / size * 2 - 1;
      const r = Math.hypot(dx, dy);
      const falloff = Math.pow(Math.max(0, 1 - r), 2.35);
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = Math.round(215 * (0.65 + 0.35 * falloff));
      data[idx + 2] = Math.round(135 * falloff);
      data[idx + 3] = Math.round(255 * falloff);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Fallback procedural Scottish Highlands panorama DataTexture if materials.loadHighlandsPanoramaTexture is absent.
 */
function createFallbackPanoramaDataTexture() {
  const w = 256;
  const h = 128;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 = bottom (loch), 1 = top (sky)
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const th = u * Math.PI * 2;
      const peak = 0.44 + 0.14 * Math.sin(th * 2 + 0.5) + 0.07 * Math.cos(th * 5 - 0.8);
      const shore = 0.34 + 0.03 * Math.sin(th * 3);
      let r, g, b;
      if (v > peak) {
        const st = (v - peak) / (1 - peak);
        r = 128 - st * 68;
        g = 148 - st * 56;
        b = 185 - st * 45;
      } else if (v > shore) {
        const mist = Math.exp(-Math.pow((v - (shore + 0.08)) / 0.05, 2));
        r = 32 + mist * 80;
        g = 46 + mist * 90;
        b = 62 + mist * 100;
      } else {
        const ref = 1 - Math.abs(v - shore * 0.55) * 2.0;
        r = 42 + ref * 36;
        g = 62 + ref * 42;
        b = 88 + ref * 50;
      }
      const idx = (y * w + x) * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a gnarled charred oak bark material with vertical bark fissures (DOM-free DataTexture).
 */
function createGnarledBarkMaterial() {
  const w = 128;
  const h = 128;
  const colorData = new Uint8Array(w * h * 4);
  const bumpData = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const furrow =
        0.5 +
        0.3 * Math.sin(u * Math.PI * 16 + Math.sin(v * Math.PI * 4) * 1.4) +
        0.2 * Math.cos(u * Math.PI * 28 - v * Math.PI * 6);
      const charNoise =
        ((Math.imul(x * 73 + 19, 374761393) ^ Math.imul(y * 151 + 7, 668265263)) >>> 0) / 4294967295;
      const barkVal = clamp01(furrow * 0.72 + charNoise * 0.28);
      const idx = (y * w + x) * 4;
      colorData[idx] = Math.round(28 + barkVal * 52);
      colorData[idx + 1] = Math.round(18 + barkVal * 34);
      colorData[idx + 2] = Math.round(13 + barkVal * 22);
      colorData[idx + 3] = 255;

      const bv = Math.round(45 + barkVal * 200);
      bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = bv;
      bumpData[idx + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(colorData, w, h, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const bumpMap = new THREE.DataTexture(bumpData, w, h, THREE.RGBAFormat);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  return new THREE.MeshStandardMaterial({
    name: 'gnarledLogBark',
    map,
    bumpMap,
    bumpScale: 0.032,
    roughness: 0.92,
    metalness: 0.02,
  });
}

/**
 * Builds a smooth watertight tapered/profiled tube along a 3D CatmullRom spline using
 * twist-free parallel-transport Bishop frames.
 */
function createTaperedTubeGeometry(
  points,
  { tubularSegs = 20, radialSegs = 10, radiusFn = () => 0.04, profileFn = null, closed = false, capEnds = true } = {}
) {
  const vecPts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  const curve = new THREE.CatmullRomCurve3(vecPts, closed);
  const frames = [];
  const centers = [];
  const tangents = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    centers.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let normal = new THREE.Vector3().crossVectors(ref, t0).normalize();
  let binormal = new THREE.Vector3().crossVectors(t0, normal).normalize();
  frames.push({ N: normal.clone(), B: binormal.clone() });

  const rotQ = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    rotQ.setFromUnitVectors(tangents[i - 1], tangents[i]);
    normal = normal.clone().applyQuaternion(rotQ).normalize();
    binormal = new THREE.Vector3().crossVectors(tangents[i], normal).normalize();
    frames.push({ N: normal, B: binormal });
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const c = centers[i];
    const { N, B } = frames[i];
    const baseR = Math.max(0.0005, radiusFn(u));
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const r = profileFn ? Math.max(0.0004, profileFn(u, theta, baseR)) : baseR;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      positions.push(
        c.x + (N.x * ct + B.x * st) * r,
        c.y + (N.y * ct + B.y * st) * r,
        c.z + (N.z * ct + B.z * st) * r
      );
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, d, c, a, c, b);
    }
  }

  if (capEnds && !closed) {
    const startCenterIdx = positions.length / 3;
    positions.push(centers[0].x, centers[0].y, centers[0].z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j, j + 1);
    }

    const endCenterIdx = positions.length / 3;
    const lastC = centers[tubularSegs];
    positions.push(lastC.x, lastC.y, lastC.z);
    uvs.push(1, 0.5);
    const lastRingStart = tubularSegs * ringStride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, lastRingStart + j + 1, lastRingStart + j);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Generates a 3D CatmullRom curve matching the exact Gothic pointed arch height profile `gothicArchY`.
 */
function buildPointedArchCurve(halfW, springY, peakY, zOffset = 0, segs = 22) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = -halfW + t * halfW * 2;
    const y = gothicArchY(t, springY, peakY);
    pts.push(new THREE.Vector3(x, y, zOffset));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/**
 * Creates a closed 2D THREE.Shape for a pointed Gothic lancet arch panel or pane.
 */
function createGothicArchShape(halfW, baseY, springY, peakY, segs = 20) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, baseY);
  shape.lineTo(-halfW, springY);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = -halfW + t * halfW * 2;
    const y = gothicArchY(t, springY, peakY);
    shape.lineTo(x, y);
  }
  shape.lineTo(halfW, baseY);
  shape.closePath();
  return shape;
}

/**
 * Creates a sculpted Gothic trefoil / quatrefoil tracery rosette curve for window spandrels.
 */
function createQuatrefoilTraceryGeometry(radius = 0.16, tubeRadius = 0.02, lobes = 4) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const r = radius * (0.78 + 0.24 * Math.abs(Math.cos(th * lobes * 0.5)));
    pts.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return new THREE.TubeGeometry(curve, 56, tubeRadius, 8, true);
}

/**
 * Builds an ornate medieval wrought-iron wall sconce with carved stone backplate,
 * scrolled iron bracket, dripped beeswax taper candle, dark wick, and teardrop flame + soft glow.
 */
function createWallSconce(materials, stoneDarkMat) {
  const sconce = new THREE.Group();
  const carvedStone = materials?.carvedStone || stoneDarkMat;
  const ironMat = createWroughtIronMaterial();

  // Chamfered Gothic stone backplate plaque
  const plaqueShape = createGothicArchShape(0.068, -0.18, 0.06, 0.19, 12);
  const plaqueGeom = new THREE.ExtrudeGeometry(plaqueShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  const backplate = new THREE.Mesh(plaqueGeom, carvedStone);
  backplate.position.set(0, 0.01, 0.01);
  backplate.receiveShadow = true;
  sconce.add(backplate);

  // Iron mounting strap & rivets
  const ironCollar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.14, 0.018), ironMat);
  ironCollar.position.set(0, -0.02, 0.052);
  sconce.add(ironCollar);

  // S-scrolled wrought-iron main bracket arm + lower volute brace
  const armGeom = createTaperedTubeGeometry(
    [
      [0, -0.05, 0.052],
      [0, -0.04, 0.11],
      [0, 0.01, 0.17],
      [0, 0.055, 0.205],
    ],
    { tubularSegs: 14, radialSegs: 8, radiusFn: (u) => 0.014 * (1.1 - 0.28 * u) }
  );
  const arm = new THREE.Mesh(armGeom, ironMat);
  sconce.add(arm);

  const braceGeom = createTaperedTubeGeometry(
    [
      [0, -0.13, 0.052],
      [0, -0.1, 0.125],
      [0, -0.025, 0.16],
      [0, 0.035, 0.19],
    ],
    { tubularSegs: 12, radialSegs: 7, radiusFn: () => 0.009 }
  );
  const brace = new THREE.Mesh(braceGeom, ironMat);
  sconce.add(brace);

  // Flared forged-iron bobeche drip pan (LatheGeometry)
  const bobecheProfile = [
    new THREE.Vector2(0.001, -0.016),
    new THREE.Vector2(0.022, -0.012),
    new THREE.Vector2(0.052, 0.002),
    new THREE.Vector2(0.064, 0.016),
    new THREE.Vector2(0.058, 0.02),
    new THREE.Vector2(0.024, 0.006),
    new THREE.Vector2(0.001, 0.004),
  ];
  const bobeche = new THREE.Mesh(new THREE.LatheGeometry(bobecheProfile, 16), ironMat);
  bobeche.position.set(0, 0.06, 0.205);
  sconce.add(bobeche);

  // Tapered beeswax candle with slightly melted crater rim
  const candlePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.025, 0),
    new THREE.Vector2(0.024, 0.09),
    new THREE.Vector2(0.021, 0.165),
    new THREE.Vector2(0.024, 0.172),
    new THREE.Vector2(0.015, 0.176),
    new THREE.Vector2(0.008, 0.166),
    new THREE.Vector2(0.001, 0.164),
  ];
  const candle = new THREE.Mesh(new THREE.LatheGeometry(candlePts, 14), materials.candleWax);
  candle.position.set(0, 0.066, 0.205);
  sconce.add(candle);

  // Organic melted beeswax drip trails clinging down the candle sides
  const dripOffsets = [
    [0.021, 0.006, 0.11],
    [-0.016, 0.015, 0.08],
    [0.005, -0.021, 0.095],
  ];
  for (const [dx, dz, len] of dripOffsets) {
    const dripGeom = createTaperedTubeGeometry(
      [
        [dx * 0.9, 0.236, 0.205 + dz * 0.9],
        [dx * 1.06, 0.236 - len * 0.45, 0.205 + dz * 1.06],
        [dx * 1.02, 0.236 - len, 0.205 + dz * 1.02],
      ],
      {
        tubularSegs: 8,
        radialSegs: 6,
        radiusFn: (u) => 0.0042 + Math.pow(u, 1.5) * 0.0022,
      }
    );
    const drip = new THREE.Mesh(dripGeom, materials.candleWax);
    sconce.add(drip);
  }

  // Charred dark wick + warm molten core glow
  const wickMat = new THREE.MeshStandardMaterial({ color: '#18120e', roughness: 0.95 });
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0028, 0.022, 6), wickMat);
  wick.position.set(0, 0.24, 0.205);
  sconce.add(wick);

  // Smooth sculpted teardrop candle flame + soft radial glow halo sprite
  const flameAnchor = new THREE.Group();
  flameAnchor.position.set(0, 0.248, 0.205);
  flameAnchor.userData.isCandleFlame = true;
  flameAnchor.userData.noMerge = true;

  const flameProfile = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.016, 0.014),
    new THREE.Vector2(0.017, 0.03),
    new THREE.Vector2(0.01, 0.056),
    new THREE.Vector2(0.003, 0.078),
    new THREE.Vector2(0.0005, 0.088),
  ];
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#ffd884',
    transparent: true,
    opacity: 0.94,
  });
  const flameMesh = new THREE.Mesh(new THREE.LatheGeometry(flameProfile, 10), flameMat);
  flameMesh.raycast = () => {};
  flameMesh.userData.noRaycast = true;
  flameMesh.userData.noShadow = true;
  flameAnchor.add(flameMesh);

  const haloMat = new THREE.SpriteMaterial({
    map: createGlowSpriteDataTexture(64),
    color: '#ffae45',
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloSprite = new THREE.Sprite(haloMat);
  haloSprite.position.set(0, 0.036, 0);
  haloSprite.scale.set(0.16, 0.2, 1);
  haloSprite.raycast = () => {};
  haloSprite.userData.noRaycast = true;
  haloSprite.userData.noShadow = true;
  flameAnchor.add(haloSprite);

  sconce.add(flameAnchor);
  mergeStaticSubtree(sconce, {
    skipFilter: (m) => m.userData?.isCandleFlame || isDescendantOf(m, flameAnchor),
  });
  return sconce;
}

/**
 * Builds a merged dark-lead diamond lattice BufferGeometry clipped cleanly inside either a
 * rectangular casement or a pointed Gothic arch silhouette.
 */
function createDiamondLeadLatticeGeometry({
  halfW,
  minY,
  maxY,
  pitch = 0.21,
  thickness = 0.0085,
  depth = 0.012,
  archSpringY = null,
  archPeakY = null,
}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const yCeilingAt = (x) => {
    if (archSpringY === null || archPeakY === null) return maxY;
    const t = clamp01((x + halfW) / (halfW * 2));
    return Math.min(maxY, gothicArchY(t, archSpringY, archPeakY) - 0.02);
  };

  const pushSegmentBox = (x0, y0, x1, y1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.02) return;
    const nx = (-dy / len) * (thickness * 0.5);
    const ny = (dx / len) * (thickness * 0.5);
    const hz = depth * 0.5;

    const base = positions.length / 3;
    const pts = [
      [x0 - nx, y0 - ny, hz],
      [x1 - nx, y1 - ny, hz],
      [x1 + nx, y1 + ny, hz],
      [x0 + nx, y0 + ny, hz],
      [x0 - nx, y0 - ny, -hz],
      [x1 - nx, y1 - ny, -hz],
      [x1 + nx, y1 + ny, -hz],
      [x0 + nx, y0 + ny, -hz],
    ];
    for (const p of pts) {
      positions.push(p[0], p[1], p[2]);
      normals.push(0, 0, p[2] > 0 ? 1 : -1);
      uvs.push((p[0] + halfW) / (halfW * 2), (p[1] - minY) / Math.max(0.01, maxY - minY));
    }
    const faces = [
      [0, 1, 2, 0, 2, 3],
      [5, 4, 7, 5, 7, 6],
      [3, 2, 6, 3, 6, 7],
      [4, 5, 1, 4, 1, 0],
      [4, 0, 3, 4, 3, 7],
      [1, 5, 6, 1, 6, 2],
    ];
    for (const f of faces) {
      for (const idx of f) indices.push(base + idx);
    }
  };

  const cMin = minY - halfW - pitch;
  const cMax = maxY + halfW + pitch;
  const stepCount = 24;

  for (const slope of [1, -1]) {
    for (let c = cMin; c <= cMax; c += pitch) {
      let segStart = null;
      let prevPt = null;
      for (let s = 0; s <= stepCount; s++) {
        const x = -halfW + (s / stepCount) * (halfW * 2);
        const y = slope * x + c;
        const ceilY = yCeilingAt(x);
        const inside = y >= minY + 0.015 && y <= ceilY && Math.abs(x) <= halfW - 0.012;
        if (inside) {
          if (!segStart) segStart = [x, y];
          prevPt = [x, y];
        } else if (segStart && prevPt) {
          pushSegmentBox(segStart[0], segStart[1], prevPt[0], prevPt[1]);
          segStart = null;
          prevPt = null;
        }
      }
      if (segStart && prevPt) {
        pushSegmentBox(segStart[0], segStart[1], prevPt[0], prevPt[1]);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds soft slanted volumetric sunbeam/moonbeam shafts + flagstone floor pool for a Gothic window.
 */
function buildWindowLightShaft(winSpec, layout) {
  const { ROOM_RADIUS, wallFacingRotation } = layout;
  const shaftGroup = new THREE.Group();
  shaftGroup.name = `${winSpec.id}-light-shaft`;

  const [wx, wy, wz] = layout.polarToCartesian(ROOM_RADIUS - 0.06, winSpec.angleRad, winSpec.sillY);
  shaftGroup.position.set(wx, wy, wz);
  shaftGroup.rotation.y = wallFacingRotation(winSpec.angleRad);

  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(ERA_SKY_PRESETS.cos.beamColor) },
    uOpacity: { value: ERA_SKY_PRESETS.cos.beamOpacity },
  };

  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float fresnel = pow(ndv, 1.55);
        float along = smoothstep(0.0, 0.11, vUv.y) * (1.0 - smoothstep(0.28, 0.96, vUv.y));
        float crossFade = pow(sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265), 1.35);
        float streaks = 0.8 + 0.2 * cos((vUv.x - 0.5) * 25.1327);
        float mote = 0.88 + 0.12 * sin(vUv.y * 12.0 - uTime * 0.55 + vUv.x * 7.0);
        float alpha = fresnel * along * crossFade * streaks * mote * uOpacity;
        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 1.95, 0.04);
  beamPivot.rotation.x = 0.44; // Tilts local +Z diagonally downward into the circular chamber

  const beamLen = 6.5;
  const coneGeom = new THREE.CylinderGeometry(1.12, 0.68, beamLen, 16, 1, true);
  coneGeom.rotateX(Math.PI * 0.5);
  coneGeom.translate(0, 0, beamLen * 0.5);
  const coneMesh = new THREE.Mesh(coneGeom, shaftMat);
  coneMesh.scale.set(1.12, 0.88, 1.0);
  coneMesh.raycast = () => {};
  coneMesh.userData.noRaycast = true;
  coneMesh.userData.noShadow = true;
  coneMesh.renderOrder = 4;
  beamPivot.add(coneMesh);

  for (const tilt of [-0.42, 0.42]) {
    const planeGeom = new THREE.PlaneGeometry(1.52, beamLen, 4, 8);
    planeGeom.rotateX(Math.PI * 0.5);
    planeGeom.translate(0, 0, beamLen * 0.5);
    const planeMesh = new THREE.Mesh(planeGeom, shaftMat);
    planeMesh.rotation.z = tilt;
    planeMesh.raycast = () => {};
    planeMesh.userData.noRaycast = true;
    planeMesh.userData.noShadow = true;
    planeMesh.renderOrder = 4;
    beamPivot.add(planeMesh);
  }
  shaftGroup.add(beamPivot);

  // Soft flagstone window-light pool where the shaft hits the stone floor
  const poolMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(vec2(p.x * 1.15, p.y * 0.85));
        float radial = 1.0 - smoothstep(0.08, 0.98, r);
        float mullion = 0.85 + 0.15 * smoothstep(-0.08, 0.08, abs(p.x) - 0.06);
        float alpha = pow(radial, 1.8) * mullion * uOpacity * 0.52;
        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const poolGeom = new THREE.PlaneGeometry(2.15, 2.75);
  poolGeom.rotateX(-Math.PI * 0.5);
  const poolMesh = new THREE.Mesh(poolGeom, poolMat);
  poolMesh.position.set(0, -winSpec.sillY + 0.015, 3.85);
  poolMesh.raycast = () => {};
  poolMesh.userData.noRaycast = true;
  poolMesh.userData.noShadow = true;
  poolMesh.renderOrder = 3;
  shaftGroup.add(poolMesh);

  return {
    shaftGroup,
    setEra(eraId) {
      const preset = ERA_SKY_PRESETS[eraId] || ERA_SKY_PRESETS[DEFAULT_ERA];
      uniforms.uColor.value.set(preset.beamColor);
      uniforms.uOpacity.value = preset.beamOpacity;
    },
    update(elapsed) {
      uniforms.uTime.value = elapsed;
    },
  };
}

/**
 * Builds the carved stone window assembly with sculpted Gothic trefoil/lancet arch tracery mullions,
 * recessed chamfered sills/jambs, dark-lead diamond lattice panes, and openable casements.
 */
function buildWindowAssembly(winSpec, sector, materials, glassMat, layout) {
  const { ROOM_RADIUS, WALL_THICKNESS, ROOM_HEIGHT, degToRad, polarToCartesian, wallFacingRotation } = layout;
  const innerR = ROOM_RADIUS;
  const outerR = ROOM_RADIUS + WALL_THICKNESS;
  const marginRad = degToRad(1.35);
  const openStart = sector.startRad + marginRad;
  const openEnd = sector.endRad - marginRad;
  const springY = 3.72;
  const stoneTrimMat = materials?.carvedStone || materials.stoneDark;
  const leadMat = createWroughtIronMaterial();

  // Stone wall cut around the Gothic arch window opening
  const sillGeom = createCurvedWallArcGeometry({
    innerR,
    outerR,
    startRad: sector.startRad,
    endRad: sector.endRad,
    minY: 0,
    maxY: winSpec.sillY,
    radialSegs: 6,
    roomHeight: ROOM_HEIGHT,
  });
  const leftJambGeom = createCurvedWallArcGeometry({
    innerR,
    outerR,
    startRad: sector.startRad,
    endRad: openStart,
    minY: winSpec.sillY,
    maxY: ROOM_HEIGHT,
    radialSegs: 2,
    roomHeight: ROOM_HEIGHT,
  });
  const rightJambGeom = createCurvedWallArcGeometry({
    innerR,
    outerR,
    startRad: openEnd,
    endRad: sector.endRad,
    minY: winSpec.sillY,
    maxY: ROOM_HEIGHT,
    radialSegs: 2,
    roomHeight: ROOM_HEIGHT,
  });
  const archLintelGeom = createCurvedWallArcGeometry({
    innerR,
    outerR,
    startRad: openStart,
    endRad: openEnd,
    minY: springY,
    maxY: ROOM_HEIGHT,
    radialSegs: 12,
    roomHeight: ROOM_HEIGHT,
    yFnBottom: (t) => gothicArchY(t, springY, winSpec.archPeakY),
  });

  const wallGroup = new THREE.Group();
  wallGroup.name = `${winSpec.id}-wall`;
  for (const g of [sillGeom, leftJambGeom, rightJambGeom, archLintelGeom]) {
    const m = new THREE.Mesh(g, materials.stoneWall);
    m.castShadow = true;
    m.receiveShadow = true;
    wallGroup.add(m);
  }

  // Moulded stone sill, chamfered jambs, lancet tracery, and leaded diamond-lattice casements
  const winFrame = new THREE.Group();
  winFrame.name = `${winSpec.id}-frame`;
  const [wx, wy, wz] = polarToCartesian(ROOM_RADIUS + WALL_THICKNESS * 0.48, winSpec.angleRad, winSpec.sillY);
  winFrame.position.set(wx, wy, wz);
  winFrame.rotation.y = wallFacingRotation(winSpec.angleRad);

  const clearW = 1.62;
  const clearH = winSpec.archPeakY - winSpec.sillY; // 3.55
  const localSpringY = springY - winSpec.sillY; // 2.67

  // Deeply recessed chamfered stone sill + underside corbel ledge
  const sillTop = new THREE.Mesh(createScaledBoxGeometry(clearW + 0.34, 0.085, 0.58), stoneTrimMat);
  sillTop.position.set(0, -0.015, 0.03);
  sillTop.receiveShadow = true;
  winFrame.add(sillTop);

  const sillApron = new THREE.Mesh(createScaledBoxGeometry(clearW + 0.24, 0.075, 0.46), stoneTrimMat);
  sillApron.position.set(0, -0.09, 0.06);
  winFrame.add(sillApron);

  // Chamfered side jamb pilasters + engaged shafts + bases & capitals
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(createScaledBoxGeometry(0.12, localSpringY + 0.06, 0.42), stoneTrimMat);
    jamb.position.set(sx * (clearW * 0.5 + 0.03), (localSpringY + 0.06) * 0.5, 0);
    jamb.receiveShadow = true;
    winFrame.add(jamb);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, localSpringY - 0.08, 10), stoneTrimMat);
    shaft.position.set(sx * (clearW * 0.5 - 0.025), localSpringY * 0.5, 0.16);
    winFrame.add(shaft);

    for (const cy of [0.06, localSpringY - 0.02]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.046, 0.08, 10), stoneTrimMat);
      cap.position.set(sx * (clearW * 0.5 - 0.025), cy, 0.16);
      winFrame.add(cap);
    }
  }

  // Central carved stone mullion + base/capital + horizontal chamfered transom
  const mullion = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, clearH - 0.45, 8), stoneTrimMat);
  mullion.position.set(0, (clearH - 0.45) * 0.5 + 0.02, 0.02);
  mullion.castShadow = true;
  winFrame.add(mullion);

  const mullionRib = new THREE.Mesh(createScaledBoxGeometry(0.072, clearH - 0.46, 0.17), stoneTrimMat);
  mullionRib.position.set(0, (clearH - 0.46) * 0.5 + 0.02, 0);
  winFrame.add(mullionRib);

  const transomY = 2.15;
  const transom = new THREE.Mesh(createScaledBoxGeometry(clearW, 0.095, 0.22), stoneTrimMat);
  transom.position.set(0, transomY, 0);
  transom.castShadow = true;
  winFrame.add(transom);

  // Outer pointed Gothic lancet arch hood-mould matching exact gothicArchY contour
  const outerArchCurve = buildPointedArchCurve(clearW * 0.5, localSpringY, clearH, 0.02, 24);
  const outerArchMould = new THREE.Mesh(new THREE.TubeGeometry(outerArchCurve, 28, 0.055, 8, false), stoneTrimMat);
  winFrame.add(outerArchMould);

  const innerArchCurve = buildPointedArchCurve(clearW * 0.47, localSpringY - 0.04, clearH - 0.07, 0.11, 24);
  const innerArchRib = new THREE.Mesh(new THREE.TubeGeometry(innerArchCurve, 26, 0.028, 8, false), stoneTrimMat);
  winFrame.add(innerArchRib);

  // Twin pointed Gothic sub-lancet tracery arches above the transom
  const subHalfW = clearW * 0.23;
  for (const sx of [-1, 1]) {
    const subCurve = buildPointedArchCurve(subHalfW, transomY + 0.26, transomY + 0.72, 0.02, 16);
    const subMesh = new THREE.Mesh(new THREE.TubeGeometry(subCurve, 18, 0.026, 7, false), stoneTrimMat);
    subMesh.position.x = sx * (clearW * 0.245);
    winFrame.add(subMesh);
  }

  // Sculpted Gothic quatrefoil / trefoil rosette tracery nestled inside the upper spandrel
  const spandrelRing = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.025, 8, 22), stoneTrimMat);
  spandrelRing.position.set(0, 3.03, 0.02);
  winFrame.add(spandrelRing);

  const quatrefoil = new THREE.Mesh(createQuatrefoilTraceryGeometry(0.165, 0.019, 4), stoneTrimMat);
  quatrefoil.position.set(0, 3.03, 0.02);
  winFrame.add(quatrefoil);

  // Upper fixed pointed-arch leaded glass + dark-lead diamond lattice cames
  const upperShape = createGothicArchShape(clearW * 0.475, transomY + 0.03, localSpringY, clearH - 0.04, 20);
  const upperGlass = new THREE.Mesh(new THREE.ShapeGeometry(upperShape), glassMat);
  upperGlass.renderOrder = 2;
  winFrame.add(upperGlass);

  const upperLatticeGeom = createDiamondLeadLatticeGeometry({
    halfW: clearW * 0.46,
    minY: transomY + 0.04,
    maxY: clearH - 0.05,
    pitch: 0.21,
    thickness: 0.0085,
    depth: 0.012,
    archSpringY: localSpringY,
    archPeakY: clearH - 0.04,
  });
  const upperLattice = new THREE.Mesh(upperLatticeGeom, leadMat);
  upperLattice.userData.noHighlight = true;
  winFrame.add(upperLattice);

  // Lower transom leaded glass (twin openable casements with dark-lead diamond lattice)
  const leafW = (clearW - 0.1) * 0.5;
  const leafH = transomY - 0.06;
  const casements = [];
  const casementLatticeGeom = createDiamondLeadLatticeGeometry({
    halfW: (leafW - 0.05) * 0.5,
    minY: 0.03,
    maxY: leafH - 0.03,
    pitch: 0.2,
    thickness: 0.008,
    depth: 0.012,
  });

  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (clearW * 0.5 - 0.02), 0.04, 0);

    const frameBarMat = materials.darkCarvedOak;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(leafW - 0.04, leafH - 0.04), glassMat);
    pane.position.set(-side * (leafW * 0.5), leafH * 0.5, 0);
    pane.renderOrder = 2;
    pivot.add(pane);

    const lattice = new THREE.Mesh(casementLatticeGeom, leadMat);
    lattice.position.set(-side * (leafW * 0.5), 0, 0);
    lattice.userData.noHighlight = true;
    pivot.add(lattice);

    const stiles = [
      [0, leafH * 0.5, 0.035, leafH],
      [-side * leafW, leafH * 0.5, 0.035, leafH],
      [-side * leafW * 0.5, 0.02, leafW, 0.035],
      [-side * leafW * 0.5, leafH - 0.02, leafW, 0.035],
    ];
    for (const [bx, by, bw, bh] of stiles) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.048), frameBarMat);
      bar.position.set(bx, by, 0);
      pivot.add(bar);
    }

    // Small antique brass casement stay handle
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.08, 0.036), materials.antiqueBrass);
    latch.position.set(-side * (leafW - 0.035), leafH * 0.45, 0.032);
    pivot.add(latch);

    winFrame.add(pivot);
    casements.push({ pivot, side });
  }

  const lightShaft = buildWindowLightShaft(winSpec, layout);

  mergeStaticSubtree(wallGroup);
  for (const c of casements) {
    mergeStaticSubtree(c.pivot);
  }
  mergeStaticSubtree(winFrame, {
    skipFilter: (m) => casements.some((c) => isDescendantOf(m, c.pivot)),
  });

  return {
    wallGroup,
    winFrame,
    casements,
    shaftGroup: lightShaft.shaftGroup,
    setEra: lightShaft.setEra,
    update: lightShaft.update,
  };
}

const SKY_GLSL_HELPERS = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  vec3 computeEraSky(
    vec3 d,
    float uTime,
    vec3 uZenith,
    vec3 uMid,
    vec3 uHorizon,
    vec3 uBandColor,
    float uBandStrength,
    vec3 uMoonDir,
    vec3 uMoonColor,
    float uMoonSize,
    float uStars
  ) {
    float h = clamp(d.y, -0.25, 1.0);
    float t1 = smoothstep(-0.08, 0.22, h);
    float t2 = smoothstep(0.18, 0.78, h);

    vec3 col = mix(uHorizon, uMid, t1);
    col = mix(col, uZenith, t2);

    // Horizon atmospheric band (pale-green pre-dawn OoP Ch. 37 / golden dawn DH Ch. 36)
    float band = exp(-pow((d.y - 0.065) / 0.085, 2.0));
    col = mix(col, uBandColor, clamp(band * uBandStrength * 0.85, 0.0, 1.0));

    float dirGlow = pow(max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(0.15, 0.0, -1.0)))), 2.0);
    col += uBandColor * band * dirGlow * uBandStrength * 0.26;

    // Celestial disc + atmospheric halo
    float sunMoonDot = max(0.0, dot(d, normalize(uMoonDir)));
    float disc = smoothstep(1.0 - uMoonSize * 0.025, 1.0 - uMoonSize * 0.008, sunMoonDot);
    float halo = pow(sunMoonDot, 22.0) * 0.42 + pow(sunMoonDot, 5.0) * 0.11;
    col += uMoonColor * (disc * 1.1 + halo);

    // Crisp twinkling stars above horizon
    if (d.y > 0.05 && uStars > 0.01) {
      vec2 starUv = vec2(atan(d.x, d.z) * 14.0, d.y * 28.0);
      vec2 cell = floor(starUv * 6.0);
      vec2 f = fract(starUv * 6.0) - 0.5;
      float rnd = hash21(cell);
      if (rnd > 0.962) {
        float starDist = length(f);
        float twinkle = 0.65 + 0.35 * sin(uTime * (1.8 + rnd * 4.0) + rnd * 40.0);
        float star = smoothstep(0.22, 0.02, starDist) * twinkle * smoothstep(0.05, 0.25, d.y);
        col += vec3(0.85, 0.91, 1.0) * star * uStars;
      }
    }
    return col;
  }
`;

/**
 * Builds the photorealistic Scottish Highlands panorama cylinder + era-responsive sky dome
 * and exterior Hogwarts grounds visible through the two tall Gothic windows (136° & 224°).
 */
function buildExteriorVista(materials, layout) {
  const vistaGroup = new THREE.Group();
  vistaGroup.name = 'ExteriorGroundsVista';

  const { EXTERIOR_DOME } = layout;
  const skyRadius = EXTERIOR_DOME.radius; // 42
  const groundsRadius = EXTERIOR_DOME.groundsRadius; // 34
  const horizonY = EXTERIOR_DOME.horizonY; // -6

  const panoramaTex =
    typeof materials?.loadHighlandsPanoramaTexture === 'function'
      ? materials.loadHighlandsPanoramaTexture()
      : createFallbackPanoramaDataTexture();
  panoramaTex.wrapS = THREE.RepeatWrapping;
  panoramaTex.wrapT = THREE.ClampToEdgeWrapping;

  const skyUniforms = {
    uTime: { value: 0 },
    uPanorama: { value: panoramaTex },
    uZenith: { value: new THREE.Color(ERA_SKY_PRESETS.cos.zenith) },
    uMid: { value: new THREE.Color(ERA_SKY_PRESETS.cos.mid) },
    uHorizon: { value: new THREE.Color(ERA_SKY_PRESETS.cos.horizon) },
    uBandColor: { value: new THREE.Color(ERA_SKY_PRESETS.cos.bandColor) },
    uBandStrength: { value: ERA_SKY_PRESETS.cos.bandStrength },
    uMoonDir: { value: new THREE.Vector3(...ERA_SKY_PRESETS.cos.moonDir).normalize() },
    uMoonColor: { value: new THREE.Color(ERA_SKY_PRESETS.cos.moonColor) },
    uMoonSize: { value: ERA_SKY_PRESETS.cos.moonSize },
    uStars: { value: ERA_SKY_PRESETS.cos.stars },
    uWaterTint: { value: new THREE.Color(ERA_SKY_PRESETS.cos.waterTint) },
    uWaterSheen: { value: new THREE.Color(ERA_SKY_PRESETS.cos.waterSheen) },
    uTerrainTint: { value: new THREE.Color(ERA_SKY_PRESETS.cos.terrainTint) },
    uMistTint: { value: new THREE.Color(ERA_SKY_PRESETS.cos.mistTint) },
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uBandColor;
      uniform float uBandStrength;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonColor;
      uniform float uMoonSize;
      uniform float uStars;
      varying vec3 vWorldDir;
      ${SKY_GLSL_HELPERS}
      void main() {
        vec3 d = normalize(vWorldDir);
        vec3 col = computeEraSky(d, uTime, uZenith, uMid, uHorizon, uBandColor, uBandStrength, uMoonDir, uMoonColor, uMoonSize, uStars);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(skyRadius, 40, 24), skyMat);
  skyDome.position.set(0, 0, 0);
  skyDome.raycast = () => {};
  skyDome.userData.noRaycast = true;
  skyDome.userData.noShadow = true;
  vistaGroup.add(skyDome);

  // Tall curved exterior Scottish Highlands panorama cylinder (opaque so physical refractive leadedGlass renders it cleanly!)
  const panoramaMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: false,
    depthWrite: true,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldDir;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uPanorama;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uBandColor;
      uniform float uBandStrength;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonColor;
      uniform float uMoonSize;
      uniform float uStars;
      uniform vec3 uWaterTint;
      uniform vec3 uWaterSheen;
      uniform vec3 uTerrainTint;
      uniform vec3 uMistTint;
      varying vec2 vUv;
      varying vec3 vWorldDir;
      ${SKY_GLSL_HELPERS}

      void main() {
        vec3 d = normalize(vWorldDir);
        vec3 skyCol = computeEraSky(d, uTime, uZenith, uMid, uHorizon, uBandColor, uBandStrength, uMoonDir, uMoonColor, uMoonSize, uStars);

        float uCont = vUv.x * 3.0;
        float waterMask = 1.0 - smoothstep(0.30, 0.375, vUv.y);
        float rippleAmp = waterMask * smoothstep(0.36, 0.14, vUv.y);
        float rippleU = sin(vUv.y * 165.0 - uTime * 1.45 + uCont * 40.0) * 0.0018 * rippleAmp;
        float rippleV = cos(uCont * 110.0 + uTime * 1.1) * 0.0011 * rippleAmp;

        vec2 sampleUv = vec2(uCont + rippleU, clamp(vUv.y + rippleV, 0.004, 0.996));
        vec3 texCol = texture2D(uPanorama, sampleUv).rgb;
        float texLum = dot(texCol, vec3(0.2126, 0.7152, 0.0722));

        // Separate sky regions above/between peaks from craggy mountain rock & conifer shoreline
        float skyMask = smoothstep(0.065, 0.21, texLum) * smoothstep(0.41, 0.67, vUv.y);
        skyMask = clamp(skyMask + smoothstep(0.68, 0.84, vUv.y), 0.0, 1.0);

        // Grade mountain & forest terrain using real panorama rock/mist detail
        float mistBand = exp(-pow((vUv.y - 0.45) / 0.055, 2.0)) * smoothstep(0.04, 0.20, texLum);
        vec3 terrainCol = texCol * (uTerrainTint * 2.15 + vec3(0.18));
        terrainCol = mix(terrainCol, uMistTint * (0.55 + texLum * 0.9), clamp(mistBand * 0.72, 0.0, 0.85));

        // Ridge rim glow when pale-green OoP dawn or golden DH sunrise breaks behind the peaks
        float ridgeGlow = exp(-pow((vUv.y - 0.56) / 0.09, 2.0)) * uBandStrength;
        terrainCol += uBandColor * ridgeGlow * 0.08 * smoothstep(0.015, 0.07, texLum);

        // Grade sky & clouds: preserve cloud light/dark structure from panorama over era sky colors
        float cloudDetail = mix(0.62, 1.24, smoothstep(0.05, 0.52, texLum));
        vec3 gradedSky = skyCol * cloudDetail;
        float horizonCloudGlow = exp(-pow((vUv.y - 0.57) / 0.12, 2.0)) * uBandStrength;
        gradedSky = mix(gradedSky, gradedSky + uBandColor * 0.38, clamp(horizonCloudGlow * (0.45 + texLum), 0.0, 0.75));

        // Grade Black Lake loch reflections using real panorama water detail + unbanded micro-shimmer
        float microRipple = pow(0.5 + 0.5 * sin(vUv.y * 1650.0 - uTime * 1.8 + sin(uCont * 18.0) * 1.2), 4.0);
        float moonAzimuth = max(0.0, dot(normalize(vec2(d.x, d.z)), normalize(vec2(uMoonDir.x, uMoonDir.z))));
        float moonGlint = pow(moonAzimuth, 14.0) * (0.35 + 0.65 * microRipple);
        vec3 waterCol = mix(uWaterTint, texCol * (uTerrainTint * 1.45 + uWaterSheen * 0.35), 0.58);
        waterCol += uWaterSheen * (moonGlint * 0.12 + microRipple * 0.018);

        vec3 col = mix(terrainCol, gradedSky, skyMask);
        col = mix(col, waterCol, waterMask);

        // Seamless vertical blend into skyDome at top and cohesive dark loch/grounds disc at bottom
        float topBlend = smoothstep(0.84, 0.985, vUv.y);
        col = mix(col, skyCol, topBlend);
        float bottomBlend = 1.0 - smoothstep(0.03, 0.16, vUv.y);
        col = mix(col, uWaterTint * 0.52, bottomBlend);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const panGeom = new THREE.CylinderGeometry(36.5, 36.5, 28.0, 64, 16, true);
  const panoramaMesh = new THREE.Mesh(panGeom, panoramaMat);
  panoramaMesh.position.set(0, 7.0, 0); // Spans y = -7.0 .. +21.0
  panoramaMesh.raycast = () => {};
  panoramaMesh.userData.noRaycast = true;
  panoramaMesh.userData.noShadow = true;
  vistaGroup.add(panoramaMesh);

  // Grounds disc flush inside panorama cylinder (radius = 36.46 at horizonY = -6) with seamless edge match
  const groundsMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uWaterTint;
      uniform vec3 uTerrainTint;
      varying vec3 vWorldPos;
      void main() {
        float r = length(vWorldPos.xz);
        float edgeMix = smoothstep(14.0, 36.0, r);
        vec3 innerMoor = uTerrainTint * 0.28 + uWaterTint * 0.35;
        vec3 outerLoch = uWaterTint * 0.52;
        vec3 col = mix(innerMoor, outerLoch, edgeMix);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const grounds = new THREE.Mesh(new THREE.CircleGeometry(36.46, 64), groundsMat);
  grounds.rotation.x = -Math.PI * 0.5;
  grounds.position.y = horizonY;
  grounds.raycast = () => {};
  grounds.userData.noRaycast = true;
  grounds.userData.noShadow = true;
  vistaGroup.add(grounds);

  function setEra(eraId, instant = false) {
    const preset = ERA_SKY_PRESETS[eraId] || ERA_SKY_PRESETS[DEFAULT_ERA];
    skyUniforms.uZenith.value.set(preset.zenith);
    skyUniforms.uMid.value.set(preset.mid);
    skyUniforms.uHorizon.value.set(preset.horizon);
    skyUniforms.uBandColor.value.set(preset.bandColor);
    skyUniforms.uBandStrength.value = preset.bandStrength;
    skyUniforms.uMoonDir.value.set(...preset.moonDir).normalize();
    skyUniforms.uMoonColor.value.set(preset.moonColor);
    skyUniforms.uMoonSize.value = preset.moonSize;
    skyUniforms.uStars.value = preset.stars;
    skyUniforms.uWaterTint.value.set(preset.waterTint);
    skyUniforms.uWaterSheen.value.set(preset.waterSheen);
    skyUniforms.uTerrainTint.value.set(preset.terrainTint);
    skyUniforms.uMistTint.value.set(preset.mistTint);

    if (instant) {
      skyUniforms.uTime.value = 0;
    }
  }

  return {
    group: vistaGroup,
    setEra,
    update(elapsed) {
      skyUniforms.uTime.value = elapsed;
    },
  };
}

/**
 * Builds a gnarled bark-textured split log with a glowing ember underside mesh.
 */
function createGnarledSplitLog(barkMat, emberMat, length = 0.62, seed = 1) {
  const logGroup = new THREE.Group();
  const geom = new THREE.CylinderGeometry(0.06, 0.072, length, 14, 8);
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const t = y / length;
    const ridge = 1 + 0.14 * Math.sin(angle * 7 + t * 5.2 + seed) + 0.08 * Math.cos(angle * 13 - t * 9.0);
    x *= ridge;
    z *= ridge;
    // Slight organic gnarl bend & flattened split underside
    x += Math.sin(t * Math.PI + seed) * 0.018;
    if (z < -0.025) z = -0.025 + (z + 0.025) * 0.35;
    pos.setXYZ(i, x, y, z);
  }
  geom.computeVertexNormals();
  const barkMesh = new THREE.Mesh(geom, barkMat);
  barkMesh.castShadow = true;
  barkMesh.receiveShadow = true;
  logGroup.add(barkMesh);

  // Glowing ember crack strip along the split charred underside
  const emberGeom = new THREE.CylinderGeometry(0.036, 0.042, length * 0.82, 8, 4);
  emberGeom.scale(0.85, 1, 0.45);
  const emberMesh = new THREE.Mesh(emberGeom, emberMat);
  emberMesh.position.set(0, 0, -0.024);
  logGroup.add(emberMesh);

  return logGroup;
}

/**
 * Builds the Carved Stone Fireplace (270°) with deeply recessed firebox, sculpted S-corbels,
 * Gothic blind-arcade frieze, wrought-iron andirons & hearth fender, gnarled split logs with
 * glowing ember undersides, multi-layered flames, and emerald Floo flash (`triggerFlooFlash`).
 */
function buildFireplace(materials, layout) {
  const { FIREPLACE } = layout;
  const group = new THREE.Group();
  group.name = 'CarvedStoneFireplace';
  group.position.set(FIREPLACE.pos[0], FIREPLACE.pos[1], FIREPLACE.pos[2]);
  group.rotation.y = FIREPLACE.rotationY;

  const stoneTrimMat = materials?.carvedStone || materials.stoneDark;
  const ironMat = createWroughtIronMaterial();
  const barkMat = createGnarledBarkMaterial();

  // Stepped beveled hearthstone slab (World x = -6.60..-5.45 -> local z = -0.42..+0.73)
  const hearth = new THREE.Mesh(createScaledBoxGeometry(FIREPLACE.width, 0.11, 1.12), stoneTrimMat);
  hearth.position.set(0, 0.055, 0.16);
  hearth.castShadow = true;
  hearth.receiveShadow = true;
  group.add(hearth);

  const hearthCurb = new THREE.Mesh(createScaledBoxGeometry(FIREPLACE.width + 0.08, 0.05, 1.16), stoneTrimMat);
  hearthCurb.position.set(0, 0.118, 0.16);
  hearthCurb.receiveShadow = true;
  group.add(hearthCurb);

  // Carved side jamb piers with stepped plinth bases, engaged pilasters, and sculpted S-corbels
  const corbelShape = new THREE.Shape();
  corbelShape.moveTo(0, 0);
  corbelShape.lineTo(0.22, 0);
  corbelShape.bezierCurveTo(0.24, 0.12, 0.34, 0.18, 0.36, 0.32);
  corbelShape.lineTo(0, 0.32);
  corbelShape.closePath();
  const corbelGeom = new THREE.ExtrudeGeometry(corbelShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  corbelGeom.rotateY(-Math.PI * 0.5);
  corbelGeom.translate(0.12, 0, -0.04);

  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(createScaledBoxGeometry(0.42, 1.82, 0.72), stoneTrimMat);
    jamb.position.set(sx * 0.85, 0.14 + 0.91, -0.02);
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    group.add(jamb);

    const jambBase = new THREE.Mesh(createScaledBoxGeometry(0.48, 0.14, 0.78), stoneTrimMat);
    jambBase.position.set(sx * 0.85, 0.21, 0.0);
    group.add(jambBase);

    const pilaster = new THREE.Mesh(createScaledBoxGeometry(0.18, 1.56, 0.1), stoneTrimMat);
    pilaster.position.set(sx * 0.82, 1.06, 0.34);
    group.add(pilaster);

    const corbelBlock = new THREE.Mesh(createScaledBoxGeometry(0.46, 0.22, 0.78), stoneTrimMat);
    corbelBlock.position.set(sx * 0.85, 1.97, 0.02);
    group.add(corbelBlock);

    const sCorbel = new THREE.Mesh(corbelGeom, stoneTrimMat);
    sCorbel.position.set(sx * 0.83, 1.82, 0.24);
    group.add(sCorbel);
  }

  // Deep firebox recess walls, soot-darkened fireback & cast-iron arched fireback relief plate
  const fireback = new THREE.Mesh(createScaledBoxGeometry(1.42, 1.82, 0.14), materials.fireplaceBrick);
  fireback.position.set(0, 1.05, -0.44);
  fireback.receiveShadow = true;
  group.add(fireback);

  const plateShape = createGothicArchShape(0.44, 0, 0.62, 1.02, 16);
  const plateGeom = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  const ironFireback = new THREE.Mesh(plateGeom, ironMat);
  ironFireback.position.set(0, 0.2, -0.37);
  ironFireback.receiveShadow = true;
  group.add(ironFireback);

  for (const sx of [-1, 1]) {
    const sideBrick = new THREE.Mesh(createScaledBoxGeometry(0.12, 1.72, 0.62), materials.fireplaceBrick);
    sideBrick.position.set(sx * 0.62, 1.0, -0.14);
    sideBrick.receiveShadow = true;
    group.add(sideBrick);
  }

  // Recessed beveled Gothic stone lintel frieze with blind-arch panels & mantelpiece shelf (top y = 2.35)
  const frieze = new THREE.Mesh(createScaledBoxGeometry(FIREPLACE.width - 0.08, 0.36, 0.68), materials.stoneWall);
  frieze.position.set(0, 2.02, 0.0);
  frieze.receiveShadow = true;
  group.add(frieze);

  const lintelSoffit = new THREE.Mesh(createScaledBoxGeometry(1.34, 0.11, 0.74), stoneTrimMat);
  lintelSoffit.position.set(0, 1.86, 0.02);
  group.add(lintelSoffit);

  for (const fx of [-0.46, 0, 0.46]) {
    const panelArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.018, 6, 14, Math.PI),
      stoneTrimMat
    );
    panelArch.position.set(fx, 1.99, 0.35);
    group.add(panelArch);
  }

  const archKey = new THREE.Mesh(createScaledBoxGeometry(0.28, 0.34, 0.74), stoneTrimMat);
  archKey.position.set(0, 1.98, 0.03);
  group.add(archKey);

  const mantelUnder = new THREE.Mesh(createScaledBoxGeometry(FIREPLACE.width + 0.04, 0.06, 0.78), stoneTrimMat);
  mantelUnder.position.set(0, FIREPLACE.height - 0.14, 0.05);
  group.add(mantelUnder);

  const mantelShelf = new THREE.Mesh(createScaledBoxGeometry(FIREPLACE.width + 0.18, 0.09, 0.86), stoneTrimMat);
  mantelShelf.position.set(0, FIREPLACE.height - 0.045, 0.07);
  mantelShelf.castShadow = true;
  mantelShelf.receiveShadow = true;
  group.add(mantelShelf);

  // Tapered stone chimney breast rising to ceiling
  const hoodGeom = new THREE.CylinderGeometry(0.55, 0.96, 3.25, 4);
  const hoodUv = hoodGeom.getAttribute('uv');
  for (let i = 0; i < hoodUv.count; i++) {
    hoodUv.setXY(i, hoodUv.getX(i) * (4.7 / 11.5), hoodUv.getY(i) * (3.25 / 4.8));
  }
  hoodUv.needsUpdate = true;
  const hood = new THREE.Mesh(hoodGeom, materials.stoneWall);
  hood.rotation.y = Math.PI * 0.25;
  hood.position.set(0, 2.35 + 1.625, -0.22);
  hood.castShadow = true;
  hood.receiveShadow = true;
  group.add(hood);

  // Wrought-iron basket grate, twin sculpted iron andirons, and hearth fender bar
  const grateOriginZ = 0.16; // Matches world FIREPLACE.hearthPos.x = -6.02
  const grateBed = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.035, 0.44), ironMat);
  grateBed.position.set(0, FIREPLACE.grateY, grateOriginZ);
  group.add(grateBed);

  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.23, 6), ironMat);
    bar.position.set(i * 0.12, FIREPLACE.grateY + 0.115, grateOriginZ + 0.2);
    group.add(bar);
  }
  const frontRail = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.032, 0.032), ironMat);
  frontRail.position.set(0, FIREPLACE.grateY + 0.195, grateOriginZ + 0.2);
  group.add(frontRail);

  // Sculpted wrought-iron andirons flanking the fire grate
  const andironFinialProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.03, 0.02),
    new THREE.Vector2(0.016, 0.08),
    new THREE.Vector2(0.024, 0.18),
    new THREE.Vector2(0.014, 0.24),
    new THREE.Vector2(0.034, 0.29),
    new THREE.Vector2(0.012, 0.34),
    new THREE.Vector2(0.001, 0.36),
  ];
  const andironStemGeom = new THREE.LatheGeometry(andironFinialProfile, 12);
  for (const sx of [-1, 1]) {
    const andiron = new THREE.Group();
    andiron.position.set(sx * 0.45, 0.145, grateOriginZ + 0.18);

    const stem = new THREE.Mesh(andironStemGeom, ironMat);
    andiron.add(stem);

    const dogBar = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.44), ironMat);
    dogBar.position.set(0, 0.06, -0.2);
    andiron.add(dogBar);

    for (const fx of [-1, 1]) {
      const footGeom = createTaperedTubeGeometry(
        [
          [0, 0.06, 0],
          [fx * 0.055, 0.03, 0.04],
          [fx * 0.085, 0.008, 0.075],
        ],
        { tubularSegs: 6, radialSegs: 6, radiusFn: () => 0.013 }
      );
      andiron.add(new THREE.Mesh(footGeom, ironMat));
    }
    group.add(andiron);
  }

  // Pierced wrought-iron hearth fender bar along the front hearth curb
  const fenderGroup = new THREE.Group();
  fenderGroup.position.set(0, 0.145, 0.62);
  const fenderBase = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.02, 0.04), ironMat);
  fenderBase.position.y = 0.01;
  fenderGroup.add(fenderBase);
  const fenderTop = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.022, 0.026), ironMat);
  fenderTop.position.y = 0.095;
  fenderGroup.add(fenderTop);
  for (let i = -7; i <= 7; i++) {
    const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.085, 6), ironMat);
    picket.position.set(i * 0.105, 0.052, 0);
    fenderGroup.add(picket);
  }
  for (const sx of [-1, 1]) {
    const returnBar = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.24), ironMat);
    returnBar.position.set(sx * 0.77, 0.095, -0.11);
    fenderGroup.add(returnBar);
    const cornerFinial = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), materials.antiqueBrass);
    cornerFinial.position.set(sx * 0.77, 0.118, 0);
    fenderGroup.add(cornerFinial);
  }
  group.add(fenderGroup);

  // Dark ash bed + irregular charred coal & glowing ember chunks (no flat bright oval!)
  const ashBaseMat = new THREE.MeshStandardMaterial({
    color: '#1b1715',
    roughness: 0.97,
    metalness: 0.02,
    emissive: new THREE.Color('#2e0a02'),
    emissiveIntensity: 0.22,
  });
  const ashBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.06, 12), ashBaseMat);
  ashBase.scale.set(1.14, 1.0, 0.64);
  ashBase.position.set(0, FIREPLACE.grateY + 0.03, grateOriginZ - 0.02);
  group.add(ashBase);

  const emberChunks = [];
  const coalChunkMat = new THREE.MeshStandardMaterial({
    color: '#1e1917',
    roughness: 0.95,
    metalness: 0.05,
    emissive: new THREE.Color('#4a1204'),
    emissiveIntensity: 0.28,
  });
  for (let i = 0; i < 16; i++) {
    const phi = i * 2.39996323;
    const rad = 0.09 + 0.26 * Math.sqrt((i + 0.5) / 16);
    const cx = Math.cos(phi) * rad * 1.18;
    const cz = grateOriginZ - 0.02 + Math.sin(phi) * rad * 0.56;
    const size = 0.042 + ((i * 19) % 7) * 0.0055;
    const isHotCoal = i % 2 === 0;
    const mat = isHotCoal
      ? new THREE.MeshStandardMaterial({
          color: '#291510',
          roughness: 0.9,
          metalness: 0.04,
          emissive: new THREE.Color('#d9460a'),
          emissiveIntensity: 0.65,
        })
      : coalChunkMat;
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), mat);
    chunk.scale.set(1.2, 0.68, 0.95);
    chunk.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    chunk.position.set(cx, FIREPLACE.grateY + 0.05 + (i % 3) * 0.012, cz);
    group.add(chunk);
    if (isHotCoal) {
      emberChunks.push({ mat, phase: i * 1.17, baseBoost: 0.55 + (i % 4) * 0.18 });
    }
  }

  // Gnarled bark-textured split logs with glowing orange ember undersides (shifting emerald on Floo)
  const logEmberMat = new THREE.MeshStandardMaterial({
    color: '#2c150c',
    roughness: 0.88,
    metalness: 0.02,
    emissive: new THREE.Color('#e64d0c'),
    emissiveIntensity: 0.72,
  });
  const logConfigs = [
    [-0.16, 0.33, 0.02, 0.18, 0.2, 0.62, 1],
    [0.16, 0.34, -0.02, -0.15, -0.22, 0.6, 2],
    [0.0, 0.41, 0.04, 0.06, 0.05, 0.64, 3],
    [-0.04, 0.38, -0.1, -0.25, 0.35, 0.56, 4],
  ];
  for (const [lx, ly, lz, rx, ry, len, seed] of logConfigs) {
    const log = createGnarledSplitLog(barkMat, logEmberMat, len, seed);
    log.rotation.set(rx, ry, Math.PI * 0.5);
    log.position.set(lx, ly, grateOriginZ + lz);
    group.add(log);
  }

  // Animated multi-layered GLSL flames + Floo emerald shift
  const flameUniforms = {
    uTime: { value: 0 },
    uFlooMix: { value: 0 },
    uIntensity: { value: 1.0 },
  };
  const flameMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: flameUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlooMix;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float sway = sin(uTime * 6.5 + uv.y * 5.0 + p.x * 7.0) * 0.055 * uv.y;
        p.x += sway;
        p.z += cos(uTime * 5.2 + uv.y * 4.5) * 0.035 * uv.y;
        p.y *= (1.0 + uFlooMix * 0.72);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlooMix;
      uniform float uIntensity;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        float x = vUv.x * 2.0 - 1.0;
        float y = vUv.y;
        float n1 = noise(vec2(x * 3.2, y * 4.5 - uTime * 3.8));
        float n2 = noise(vec2(x * 6.0 + 4.0, y * 7.0 - uTime * 5.4));
        float turb = n1 * 0.65 + n2 * 0.35;

        float widthMask = 1.0 - smoothstep(0.08, 0.92 - y * 0.65, abs(x) + (turb - 0.5) * 0.28);
        float heightMask = smoothstep(0.0, 0.16, y) * (1.0 - smoothstep(0.45, 0.98, y + (1.0 - turb) * 0.32));
        float alpha = clamp(widthMask * heightMask * (0.75 + 0.5 * turb) * uIntensity, 0.0, 1.0);

        vec3 orangeCore = vec3(1.0, 0.92, 0.55);
        vec3 orangeTip = vec3(1.0, 0.34, 0.04);
        vec3 flooCore = vec3(0.75, 1.0, 0.82);
        vec3 flooTip = vec3(0.05, 0.92, 0.36);

        vec3 core = mix(orangeCore, flooCore, uFlooMix);
        vec3 tip = mix(orangeTip, flooTip, uFlooMix);
        vec3 col = mix(tip, core, smoothstep(0.15, 0.78, (1.0 - y) * 0.7 + turb * 0.35));

        gl_FragColor = vec4(col * (1.1 + 0.65 * uFlooMix), alpha);
      }
    `,
  });

  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, FIREPLACE.grateY + 0.06, grateOriginZ);
  const flamePlanes = [
    [0, 0, 0.9, 0.95],
    [-0.16, 0.45, 0.62, 0.78],
    [0.16, -0.45, 0.62, 0.78],
    [0.0, Math.PI * 0.5, 0.55, 0.72],
  ];
  for (const [fx, ry, fw, fh] of flamePlanes) {
    const fg = new THREE.PlaneGeometry(fw, fh, 6, 12);
    fg.translate(0, fh * 0.5, 0);
    const fm = new THREE.Mesh(fg, flameMat);
    fm.position.x = fx;
    fm.rotation.y = ry;
    flameGroup.add(fm);
  }
  group.add(flameGroup);

  // Local hearth bounce light shifting emerald during Floo flash
  const localFireLight = new THREE.PointLight('#ff7b24', 1.4, 5.2, 1.8);
  localFireLight.position.set(0, 0.78, grateOriginZ + 0.25);
  group.add(localFireLight);

  // Rising spark embers with golden-angle non-aligned trajectories
  const sparkCount = 26;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkSeeds = [];
  for (let i = 0; i < sparkCount; i++) {
    const phi = i * 2.39996323;
    const baseX = Math.sin(phi) * (0.06 + ((i * 13) % 10) * 0.024);
    const baseZ = grateOriginZ + Math.cos(phi * 1.7) * 0.11;
    const phase = (i * 0.61803398875) % 1;
    const speed = 0.28 + ((i * 7) % 11) * 0.032;
    const freqX = 1.7 + ((i * 5) % 9) * 0.27;
    const freqZ = 2.1 + ((i * 3) % 7) * 0.31;
    sparkSeeds.push({ baseX, baseZ, phase, speed, freqX, freqZ });
    sparkPos[i * 3] = baseX;
    sparkPos[i * 3 + 1] = FIREPLACE.grateY + 0.15 + phase * 1.1;
    sparkPos[i * 3 + 2] = baseZ;
  }
  const sparkGeom = new THREE.BufferGeometry();
  sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: '#ffaa44',
    size: 0.045,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeom, sparkMat);
  group.add(sparks);

  mergeStaticSubtree(group, {
    skipFilter: (m) => isDescendantOf(m, flameGroup) || m === sparks,
  });

  let flooTimer = 0;
  let flooMix = 0;
  let eraIntensity = 1.0;

  function triggerFlooFlash() {
    flooTimer = 3.2;
    return { ok: true, mode: 'emerald-floo', duration: 3.2 };
  }

  function setEra(eraId) {
    eraIntensity = eraId === 'dh' ? 0.55 : eraId === 'oop' ? 1.25 : 1.0;
  }

  const FIREPLACE_ORANGE_COL = new THREE.Color('#ff7b24');
  const FIREPLACE_FLOO_COL = new THREE.Color('#19f272');
  const FIREPLACE_EMBER_ORANGE = new THREE.Color('#d9460a');
  const FIREPLACE_ASH_BASE_COL = new THREE.Color('#2e0a02');
  const FIREPLACE_COAL_BASE_COL = new THREE.Color('#4a1204');
  const FIREPLACE_SPARK_BASE_COL = new THREE.Color('#ffaa44');

  function update(dt, elapsed) {
    flameUniforms.uTime.value = elapsed;

    if (flooTimer > 0) {
      flooTimer = Math.max(0, flooTimer - dt);
      const targetMix = flooTimer > 1.2 ? 1.0 : flooTimer / 1.2;
      flooMix = damp(flooMix, targetMix, 9.0, dt);
    } else {
      flooMix = damp(flooMix, 0.0, 5.0, dt);
    }

    flameUniforms.uFlooMix.value = flooMix;
    flameUniforms.uIntensity.value = eraIntensity + flooMix * 1.25;

    localFireLight.color.copy(FIREPLACE_ORANGE_COL).lerp(FIREPLACE_FLOO_COL, flooMix);
    localFireLight.intensity =
      (1.25 * eraIntensity + flooMix * 4.5) * (0.9 + 0.14 * Math.sin(elapsed * 9.5));
    localFireLight.visible = localFireLight.intensity > 0.01;

    ashBaseMat.emissive.copy(FIREPLACE_ASH_BASE_COL).lerp(FIREPLACE_FLOO_COL, flooMix * 0.75);
    ashBaseMat.emissiveIntensity = 0.2 * eraIntensity + flooMix * 0.7;
    coalChunkMat.emissive.copy(FIREPLACE_COAL_BASE_COL).lerp(FIREPLACE_FLOO_COL, flooMix * 0.75);
    coalChunkMat.emissiveIntensity = 0.25 * eraIntensity + flooMix * 0.9;
    logEmberMat.emissive.copy(FIREPLACE_EMBER_ORANGE).lerp(FIREPLACE_FLOO_COL, flooMix * 0.85);
    logEmberMat.emissiveIntensity = (0.72 * eraIntensity + flooMix * 1.1) * (0.9 + 0.14 * Math.sin(elapsed * 5.2));
    for (const chunk of emberChunks) {
      chunk.mat.emissive.copy(FIREPLACE_EMBER_ORANGE).lerp(FIREPLACE_FLOO_COL, flooMix * 0.85);
      chunk.mat.emissiveIntensity =
        (chunk.baseBoost * eraIntensity + flooMix * 1.25) * (0.85 + 0.22 * Math.sin(elapsed * 4.7 + chunk.phase));
    }

    sparkMat.color.copy(FIREPLACE_SPARK_BASE_COL).lerp(FIREPLACE_FLOO_COL, flooMix);
    const posAttr = sparkGeom.getAttribute('position');
    for (let i = 0; i < sparkCount; i++) {
      const s = sparkSeeds[i];
      const p = (s.phase + elapsed * (s.speed + flooMix * 0.45)) % 1;
      posAttr.setX(i, s.baseX + Math.sin(elapsed * s.freqX + s.phase * 12.0) * (0.06 + p * 0.08));
      posAttr.setY(i, FIREPLACE.grateY + 0.14 + p * (1.2 + flooMix * 0.6));
      posAttr.setZ(i, s.baseZ + Math.cos(elapsed * s.freqZ + s.phase * 9.0) * (0.04 + p * 0.05));
    }
    posAttr.needsUpdate = true;
  }

  return {
    group,
    triggerFlooFlash,
    setEra,
    update,
  };
}

/**
 * Creates a sculpted scalloped concave Gothic bat-wing membrane spanning between bony wing ribs.
 */
function createGargoyleWingMembraneGeometry(ribCurves) {
  const cols = ribCurves.length; // [rootCurve, outerRib, midRib, innerRib]
  const rows = 10;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let c = 0; c < cols; c++) {
    const curve = ribCurves[c];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const pt = curve.getPoint(t);
      // Slight concave billowing between ribs + scalloped trailing edge recess
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(c / (cols - 1), t);
    }
  }

  const stride = rows + 1;
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows; r++) {
      const a = c * stride + r;
      const b = (c + 1) * stride + r;
      const cc = (c + 1) * stride + (r + 1);
      const d = c * stride + (r + 1);
      indices.push(a, b, cc, a, cc, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Sculpts the enormous, ugly gothic stone gargoyle (STRICTLY a stone gargoyle, NEVER a griffin!).
 * Uses weathered carved stone without brick mortar lines (`materials.carvedStone || createCarvedStoneMaterial()`).
 */
function buildUglyStoneGargoyle(materials) {
  const gargoyle = new THREE.Group();
  gargoyle.name = 'UglyStoneGargoyle';
  const stone = materials?.carvedStone || createCarvedStoneMaterial();
  const socketStone = new THREE.MeshStandardMaterial({
    color: '#22211e',
    roughness: 0.94,
    metalness: 0.02,
  });
  const wingMembraneMat = stone.clone();
  wingMembraneMat.side = THREE.DoubleSide;

  // Stepped chamfered Gothic octagonal stone plinth (y = 0..0.55, max radius 0.43m at any angle)
  const makeChamferedOctagon = (radius, h, bevel = 0.022) => {
    const r = radius - bevel;
    const s = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) s.moveTo(px, py);
      else s.lineTo(px, py);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.02, h - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
    });
    g.rotateX(-Math.PI * 0.5);
    g.translate(0, bevel, 0);
    return g;
  };

  const plinthBase = new THREE.Mesh(makeChamferedOctagon(0.44, 0.14, 0.022), stone);
  plinthBase.castShadow = true;
  plinthBase.receiveShadow = true;
  gargoyle.add(plinthBase);

  const plinthShaft = new THREE.Mesh(makeChamferedOctagon(0.36, 0.3, 0.018), stone);
  plinthShaft.position.y = 0.135;
  plinthShaft.castShadow = true;
  plinthShaft.receiveShadow = true;
  gargoyle.add(plinthShaft);

  const plinthCap = new THREE.Mesh(makeChamferedOctagon(0.42, 0.125, 0.022), stone);
  plinthCap.position.y = 0.425;
  plinthCap.castShadow = true;
  plinthCap.receiveShadow = true;
  gargoyle.add(plinthCap);

  // Body pivot perched atop plinth at y = 0.55
  const body = new THREE.Group();
  body.position.y = 0.55;
  gargoyle.add(body);

  // Sculpted curved spine & hunched muscular torso (broad chest, tucked waist)
  const torsoGeom = createTaperedTubeGeometry(
    [
      [0, 0.16, -0.14],
      [0, 0.36, -0.06],
      [0, 0.62, 0.06],
      [0, 0.84, 0.16],
      [0, 0.96, 0.24],
    ],
    {
      tubularSegs: 22,
      radialSegs: 16,
      radiusFn: (u) => 0.17 + Math.sin(u * Math.PI) * 0.13 - Math.pow(u, 2.2) * 0.08,
      profileFn: (u, theta, r) => {
        const sx = 1.15 + 0.18 * Math.sin(u * Math.PI);
        const sz = 0.88;
        const spineRidge = Math.max(0, -Math.sin(theta)) * 0.055 * Math.sin(u * Math.PI);
        return r * (1 + 0.12 * Math.cos(theta * 2) * (sx - sz)) + spineRidge;
      },
    }
  );
  const torsoMesh = new THREE.Mesh(torsoGeom, stone);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  body.add(torsoMesh);

  // Carved dorsal stone vertebral ridge spikes along the curved spine
  for (let i = 0; i < 6; i++) {
    const f = i / 5;
    const vy = 0.28 + f * 0.62;
    const vz = -0.25 + f * 0.26;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.036 - f * 0.008, 0.12, 5), stone);
    spike.rotation.x = -1.1 + f * 0.35;
    spike.position.set(0, vy, vz);
    spike.castShadow = true;
    body.add(spike);
  }

  // Curled sculpted gargoyle tail wrapping around the rear-left haunch onto the plinth
  const tailGeom = createTaperedTubeGeometry(
    [
      [0, 0.15, -0.18],
      [-0.14, 0.09, -0.32],
      [-0.29, 0.04, -0.28],
      [-0.32, 0.03, -0.08],
      [-0.24, 0.05, 0.02],
    ],
    { tubularSegs: 18, radialSegs: 8, radiusFn: (u) => 0.055 * (1 - 0.65 * u) }
  );
  const tail = new THREE.Mesh(tailGeom, stone);
  tail.castShadow = true;
  body.add(tail);

  // Sculpted crouched haunches, muscular calves, clawed feet & crouched arms gripping plinth edge
  for (const sx of [-1, 1]) {
    // Haunch -> knee -> shin -> ankle
    const legGeom = createTaperedTubeGeometry(
      [
        [sx * 0.14, 0.22, -0.1],
        [sx * 0.25, 0.36, 0.05],
        [sx * 0.22, 0.19, -0.02],
        [sx * 0.21, 0.04, 0.08],
      ],
      {
        tubularSegs: 18,
        radialSegs: 12,
        radiusFn: (u) => 0.12 * (1 - 0.52 * u) + Math.sin(u * Math.PI) * 0.045,
      }
    );
    const legMesh = new THREE.Mesh(legGeom, stone);
    legMesh.castShadow = true;
    body.add(legMesh);

    // 3 sculpted splayed clawed toes resting firmly on plinth top
    for (let t = -1; t <= 1; t++) {
      const toeGeom = createTaperedTubeGeometry(
        [
          [sx * 0.21, 0.04, 0.09],
          [sx * 0.21 + t * 0.045, 0.035, 0.17],
          [sx * 0.21 + t * 0.06, 0.015, 0.23],
        ],
        { tubularSegs: 6, radialSegs: 6, radiusFn: (u) => 0.026 * (1 - 0.68 * u) }
      );
      body.add(new THREE.Mesh(toeGeom, stone));
    }

    // Broad shoulder deltoid -> elbow -> carved forearm gripping forward plinth edge
    const armGeom = createTaperedTubeGeometry(
      [
        [sx * 0.19, 0.78, 0.14],
        [sx * 0.32, 0.66, 0.18],
        [sx * 0.33, 0.42, 0.19],
        [sx * 0.28, 0.16, 0.28],
        [sx * 0.25, 0.02, 0.32],
      ],
      {
        tubularSegs: 20,
        radialSegs: 12,
        radiusFn: (u) => 0.1 * (1 - 0.4 * u) + Math.sin(u * Math.PI * 1.4) * 0.024,
      }
    );
    const armMesh = new THREE.Mesh(armGeom, stone);
    armMesh.castShadow = true;
    body.add(armMesh);

    // Clawed stone hands & curved fingers gripping over the chamfered plinth edge (z = 0.32..0.40)
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.064, 10, 8), stone);
    palm.scale.set(1.12, 0.65, 1.2);
    palm.position.set(sx * 0.25, 0.025, 0.33);
    palm.castShadow = true;
    body.add(palm);

    for (let f = -1; f <= 1; f++) {
      const fx = sx * 0.25 + f * 0.034;
      const fingerGeom = createTaperedTubeGeometry(
        [
          [fx, 0.028, 0.35],
          [fx, 0.02, 0.39],
          [fx, -0.045, 0.4],
        ],
        { tubularSegs: 7, radialSegs: 6, radiusFn: (u) => 0.019 * (1 - 0.62 * u) }
      );
      const finger = new THREE.Mesh(fingerGeom, stone);
      finger.castShadow = true;
      body.add(finger);
    }

    // Articulated bat-like stone wings (swept steeply upward/backward within radius <= 0.42m even when rotated in aside pose)
    const wing = new THREE.Group();
    const s = sx;
    const armPts = [
      [s * 0.16, 0.82, -0.02],
      [s * 0.24, 1.08, -0.12],
      [s * 0.31, 1.36, -0.18],
      [s * 0.33, 1.24, -0.22],
    ];
    const armBone = new THREE.Mesh(
      createTaperedTubeGeometry(armPts, {
        tubularSegs: 14,
        radialSegs: 8,
        radiusFn: (u) => 0.034 * (1 - 0.55 * u),
      }),
      stone
    );
    armBone.castShadow = true;
    wing.add(armBone);

    // Wing-thumb stone spur at wrist apex
    const thumbHook = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.068, 5), stone);
    thumbHook.position.set(s * 0.31, 1.39, -0.16);
    thumbHook.rotation.set(0.35, 0, -s * 0.35);
    wing.add(thumbHook);

    // 3 radiating curved bony stone wing ribs + concave scalloped stone membrane
    const ribTips = [
      [s * 0.33, 0.72, -0.27],
      [s * 0.27, 0.52, -0.26],
      [s * 0.2, 0.38, -0.22],
    ];
    const rootSpinePts = [
      [s * 0.16, 0.82, -0.04],
      [s * 0.15, 0.56, -0.1],
      [s * 0.13, 0.36, -0.15],
    ];
    const rootCurve = new THREE.CatmullRomCurve3(rootSpinePts.map((p) => new THREE.Vector3(...p)));
    const ribCurves = [rootCurve];

    for (let r = 0; r < ribTips.length; r++) {
      const tip = ribTips[r];
      const mid = [
        (s * 0.31 + tip[0]) * 0.5 + s * 0.015,
        (1.34 + tip[1]) * 0.5 + 0.04,
        (-0.18 + tip[2]) * 0.5 - 0.02,
      ];
      const rPts = [[s * 0.31, 1.34, -0.18], mid, tip];
      const rGeom = createTaperedTubeGeometry(rPts, {
        tubularSegs: 12,
        radialSegs: 7,
        radiusFn: (u) => 0.022 * (1 - 0.65 * u),
      });
      const rMesh = new THREE.Mesh(rGeom, stone);
      rMesh.castShadow = true;
      wing.add(rMesh);
      ribCurves.push(new THREE.CatmullRomCurve3(rPts.map((p) => new THREE.Vector3(...p))));
    }

    const membrane = new THREE.Mesh(createGargoyleWingMembraneGeometry(ribCurves), wingMembraneMat);
    membrane.castShadow = true;
    membrane.receiveShadow = true;
    wing.add(membrane);

    body.add(wing);
  }

  // Detailed monstrous gargoyle head (furrowed horned brow, deep-set eye sockets, flared snout, open fanged jaw)
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.27);
  body.add(head);

  const craniumGeom = new THREE.IcosahedronGeometry(0.195, 2);
  const cPos = craniumGeom.getAttribute('position');
  for (let i = 0; i < cPos.count; i++) {
    let x = cPos.getX(i);
    let y = cPos.getY(i);
    let z = cPos.getZ(i);
    // Widen cheekbones, flatten crown, carve deep orbital eye sockets on +Z face
    x *= 1.06 + (y < 0 ? 0.08 : -0.05);
    y *= 0.94;
    z *= 1.12;
    if (z > 0.08 && y > -0.01 && y < 0.08 && Math.abs(x) > 0.04 && Math.abs(x) < 0.13) {
      z -= 0.042; // Deep-set carved eye sockets
    }
    if (z > 0.07 && y >= 0.06 && y < 0.14) {
      z += 0.032; // Heavy overhanging brow bone
    }
    cPos.setXYZ(i, x, y, z);
  }
  craniumGeom.computeVertexNormals();
  const cranium = new THREE.Mesh(craniumGeom, stone);
  cranium.castShadow = true;
  head.add(cranium);

  // Deep-set carved stone eyeballs + furrowed brow ridges + ridged swept horns + pointed ears
  for (const sx of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), socketStone);
    socket.position.set(sx * 0.076, 0.03, 0.155);
    head.add(socket);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), stone);
    eyeball.position.set(sx * 0.076, 0.03, 0.172);
    head.add(eyeball);

    const browGeom = createTaperedTubeGeometry(
      [
        [sx * 0.015, 0.068, 0.195],
        [sx * 0.085, 0.095, 0.192],
        [sx * 0.155, 0.075, 0.13],
      ],
      { tubularSegs: 8, radialSegs: 7, radiusFn: (u) => 0.032 * (1 - 0.35 * u) }
    );
    head.add(new THREE.Mesh(browGeom, stone));

    // Curved ribbed stone horns sweeping back and slightly upward
    const hornGeom = createTaperedTubeGeometry(
      [
        [sx * 0.095, 0.135, 0.06],
        [sx * 0.18, 0.23, -0.05],
        [sx * 0.24, 0.28, -0.19],
        [sx * 0.2, 0.34, -0.29],
      ],
      {
        tubularSegs: 16,
        radialSegs: 9,
        radiusFn: (u) => 0.048 * Math.pow(1 - u * 0.88, 0.85) * (1 + 0.12 * Math.sin(u * Math.PI * 10)),
      }
    );
    const horn = new THREE.Mesh(hornGeom, stone);
    horn.castShadow = true;
    head.add(horn);

    // Pointed sculpted bat ears with recessed inner concha
    const earShape = new THREE.Shape();
    earShape.moveTo(0, -0.03);
    earShape.quadraticCurveTo(0.08, 0.05, 0.05, 0.2);
    earShape.quadraticCurveTo(-0.02, 0.1, -0.02, 0);
    earShape.closePath();
    const earGeom = new THREE.ExtrudeGeometry(earShape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    const ear = new THREE.Mesh(earGeom, stone);
    ear.position.set(sx * 0.16, 0.06, 0.01);
    ear.rotation.set(-0.22, sx * 0.35, -sx * 0.65);
    ear.scale.x = sx;
    ear.castShadow = true;
    head.add(ear);
  }

  // Flared ugly stone snout with sculpted nostrils
  const snout = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 1), stone);
  snout.scale.set(1.25, 0.72, 1.15);
  snout.position.set(0, -0.032, 0.19);
  head.add(snout);

  for (const sx of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), socketStone);
    nostril.position.set(sx * 0.044, -0.025, 0.275);
    head.add(nostril);
  }

  // Dark mouth recess & jutting open snarling lower jaw with upper & lower stone fangs
  const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.075, 0.12), socketStone);
  mouthCavity.position.set(0, -0.09, 0.175);
  head.add(mouthCavity);

  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.105, 0.09);
  jawGroup.rotation.x = 0.24; // Open snarling jaw pose
  const jawMesh = new THREE.Mesh(createTaperedTubeGeometry(
    [
      [-0.1, 0, -0.02],
      [-0.085, -0.02, 0.11],
      [0, -0.025, 0.155],
      [0.085, -0.02, 0.11],
      [0.1, 0, -0.02],
    ],
    { tubularSegs: 12, radialSegs: 8, radiusFn: () => 0.042 }
  ), stone);
  jawMesh.castShadow = true;
  jawGroup.add(jawMesh);

  // Lower stone fangs & jagged teeth rising from open mandible
  for (const tx of [-0.072, -0.035, 0, 0.035, 0.072]) {
    const isCanine = Math.abs(tx) > 0.06;
    const tooth = new THREE.Mesh(
      new THREE.ConeGeometry(isCanine ? 0.016 : 0.011, isCanine ? 0.056 : 0.034, 5),
      stone
    );
    tooth.position.set(tx, 0.035, isCanine ? 0.13 : 0.145);
    jawGroup.add(tooth);
  }
  head.add(jawGroup);

  // Upper stone fangs descending from snout lip
  for (const sx of [-1, 1]) {
    const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.058, 5), stone);
    upperFang.rotation.x = Math.PI;
    upperFang.position.set(sx * 0.068, -0.078, 0.248);
    head.add(upperFang);
  }

  return { root: gargoyle, body, head };
}

/**
 * Builds the gleaming single oak door (with beveled Gothic arch panels & forged strap hinges)
 * and the sculpted 3D brass griffin-shaped knocker (`0°` / +Z).
 */
function buildOakDoorAndKnocker(materials, layout) {
  const { ENTRANCE } = layout;
  const doorAssembly = new THREE.Group();
  doorAssembly.name = 'OakDoorAssembly';
  const stoneTrimMat = materials?.carvedStone || materials.stoneDark;
  const ironMat = createWroughtIronMaterial();

  // Door stone arch surround on inner/outer face at z = 6.52
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, 6.52);
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(createScaledBoxGeometry(0.18, ENTRANCE.doorHeight + 0.05, 0.48), stoneTrimMat);
    jamb.position.set(sx * (ENTRANCE.doorWidth * 0.5 + 0.09), (ENTRANCE.doorHeight + 0.05) * 0.5, 0);
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    archGroup.add(jamb);
  }
  const threshold = new THREE.Mesh(createScaledBoxGeometry(ENTRANCE.doorWidth + 0.36, 0.04, 0.54), stoneTrimMat);
  threshold.position.set(0, 0.02, 0);
  threshold.receiveShadow = true;
  archGroup.add(threshold);

  const lintelTransom = new THREE.Mesh(
    createScaledBoxGeometry(ENTRANCE.doorWidth + 0.36, 0.09, 0.5),
    stoneTrimMat
  );
  lintelTransom.position.set(0, ENTRANCE.doorHeight + 0.045, 0);
  lintelTransom.castShadow = true;
  archGroup.add(lintelTransom);

  // Pointed Gothic stone arch hood-mould framing the tympanum
  const doorArchCurve = buildPointedArchCurve(ENTRANCE.doorWidth * 0.5 + 0.04, ENTRANCE.doorHeight, ENTRANCE.archHeight + 0.04, 0, 18);
  const doorArchHood = new THREE.Mesh(new THREE.TubeGeometry(doorArchCurve, 22, 0.06, 8, false), stoneTrimMat);
  doorArchHood.position.z = -0.22;
  archGroup.add(doorArchHood);
  const doorArchHoodOut = doorArchHood.clone();
  doorArchHoodOut.position.z = 0.22;
  archGroup.add(doorArchHoodOut);

  const keystone = new THREE.Mesh(createScaledBoxGeometry(0.24, 0.2, 0.54), stoneTrimMat);
  keystone.position.set(0, ENTRANCE.archHeight + 0.04, 0);
  keystone.castShadow = true;
  archGroup.add(keystone);
  doorAssembly.add(archGroup);

  // Door pivot placed at East (+X) jamb hingePos so inward swing opens toward East corner
  const doorPivot = new THREE.Group();
  doorPivot.name = 'OakDoorPivot';
  doorPivot.position.set(...ENTRANCE.hingePos);

  const leafW = ENTRANCE.doorWidth;
  const leafH = ENTRANCE.doorHeight;
  const leafD = 0.075;

  // Normalize oak woodgrain UVs across stiles, rails, and extruded Gothic panels
  const orientWoodUVs = (geom, uScale = 1.36, vScale = 2.65, horizontal = false) => {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const uv = geom.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      let u, v;
      if (nx > 0.5) {
        u = (z + 0.25) / uScale;
        v = (y + 1.0) / vScale;
      } else if (ny > 0.5) {
        u = (x + 1.0) / uScale;
        v = (z + 0.25) / uScale;
      } else if (horizontal) {
        u = (y + 0.5) / uScale;
        v = (x + 1.0) / vScale;
      } else {
        u = (x + 1.0) / uScale;
        v = (y + 1.0) / vScale;
      }
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
    return geom;
  };

  // Single gleaming oak door leaf spanning x = [-leafW, 0] from East hinge
  const doorSlab = new THREE.Mesh(orientWoodUVs(new THREE.BoxGeometry(leafW, leafH, leafD)), materials.gleamingOak);
  doorSlab.position.set(-leafW * 0.5, leafH * 0.5, 0);
  doorSlab.castShadow = true;
  doorSlab.receiveShadow = true;
  doorPivot.add(doorSlab);

  // Vertical oak plank joinery stiles & middle lock rail
  for (const sx of [-0.07, -leafW * 0.5, -leafW + 0.07]) {
    const stile = new THREE.Mesh(
      orientWoodUVs(new THREE.BoxGeometry(0.11, leafH - 0.04, leafD + 0.016)),
      materials.gleamingOak
    );
    stile.position.set(sx, leafH * 0.5, 0);
    doorPivot.add(stile);
  }
  for (const ry of [0.1, 1.06, 2.55]) {
    const rail = new THREE.Mesh(
      orientWoodUVs(new THREE.BoxGeometry(leafW - 0.04, 0.12, leafD + 0.016), 1.36, 2.65, true),
      materials.gleamingOak
    );
    rail.position.set(-leafW * 0.5, ry, 0);
    doorPivot.add(rail);
  }

  // Deeply beveled recessed Gothic arch moldings on upper panels + chamfered lower oak panels
  const upperPanelShape = createGothicArchShape(0.2, 0, 0.85, 1.18, 14);
  const upperPanelGeom = new THREE.ExtrudeGeometry(upperPanelShape, {
    depth: 0.094,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  upperPanelGeom.translate(0, 0, -0.047);
  orientWoodUVs(upperPanelGeom);

  const lowerPanelGeom = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.2, -0.34);
      s.lineTo(0.2, -0.34);
      s.lineTo(0.2, 0.34);
      s.lineTo(-0.2, 0.34);
      s.closePath();
      return s;
    })(),
    { depth: 0.094, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }
  );
  lowerPanelGeom.translate(0, 0, -0.047);
  orientWoodUVs(lowerPanelGeom);

  for (const px of [-leafW * 0.28, -leafW * 0.72]) {
    const up = new THREE.Mesh(upperPanelGeom, materials.gleamingOak);
    up.position.set(px, 1.22, 0);
    up.castShadow = true;
    doorPivot.add(up);

    const low = new THREE.Mesh(lowerPanelGeom, materials.gleamingOak);
    low.position.set(px, 0.58, 0);
    low.castShadow = true;
    doorPivot.add(low);
  }

  // Hammered wrought-iron strap hinges aligned cleanly onto the 3 horizontal oak rails (clear of panels!)
  for (const hy of [0.12, 1.06, 2.53]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.052, 0.104), ironMat);
    strap.position.set(-0.28, hy, 0);
    doorPivot.add(strap);

    const spear = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.095, 4), ironMat);
    spear.rotation.z = Math.PI * 0.5;
    spear.scale.set(1, 1, 0.28);
    spear.position.set(-0.59, hy, 0);
    doorPivot.add(spear);

    for (const rx of [-0.1, -0.26, -0.44]) {
      for (const rz of [-0.055, 0.055]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), ironMat);
        rivet.position.set(rx, hy, rz);
        doorPivot.add(rivet);
      }
    }
  }

  // Keyhole escutcheon & forged latch handles on both sides
  for (const sz of [-1, 1]) {
    const escutcheon = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.014), ironMat);
    escutcheon.position.set(-leafW + 0.16, 1.05, sz * 0.045);
    doorPivot.add(escutcheon);

    const handleRing = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.011, 8, 16), materials.antiqueBrass);
    handleRing.position.set(-leafW + 0.16, 1.05, sz * 0.062);
    doorPivot.add(handleRing);
  }

  // Sculpted Brass Griffin Knocker mounted on the outer (+Z) face at layout.ENTRANCE.knockerLocalOffset
  const knockerRoot = new THREE.Group();
  knockerRoot.name = 'BrassGriffinKnocker';
  knockerRoot.position.set(...ENTRANCE.knockerLocalOffset);

  // Embossed Gothic shield backplate
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0, 0.145);
  shieldShape.quadraticCurveTo(0.115, 0.125, 0.11, 0.02);
  shieldShape.quadraticCurveTo(0.105, -0.095, 0, -0.155);
  shieldShape.quadraticCurveTo(-0.105, -0.095, -0.11, 0.02);
  shieldShape.quadraticCurveTo(-0.115, 0.125, 0, 0.145);
  const backplateGeom = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  const backplate = new THREE.Mesh(backplateGeom, materials.antiqueBrass);
  backplate.castShadow = true;
  knockerRoot.add(backplate);

  // Sculpted Brass Griffin perched in high relief: lion hindquarters, tail, feathered wings, eagle head & beak
  const lionHaunch = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), materials.antiqueBrass);
  lionHaunch.scale.set(1.05, 1.2, 0.85);
  lionHaunch.position.set(0, -0.05, 0.022);
  knockerRoot.add(lionHaunch);

  const lionTail = new THREE.Mesh(
    createTaperedTubeGeometry(
      [
        [0, -0.08, 0.024],
        [-0.048, -0.095, 0.028],
        [-0.072, -0.04, 0.03],
        [-0.052, 0.005, 0.026],
      ],
      { tubularSegs: 10, radialSegs: 6, radiusFn: (u) => 0.009 * (1 - 0.35 * u) }
    ),
    materials.gildedGold
  );
  knockerRoot.add(lionTail);

  const griffinChest = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), materials.gildedGold);
  griffinChest.scale.set(1.02, 1.18, 1.05);
  griffinChest.position.set(0, 0.022, 0.036);
  knockerRoot.add(griffinChest);

  const griffinHead = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), materials.gildedGold);
  griffinHead.scale.set(0.9, 1.0, 1.15);
  griffinHead.position.set(0, 0.078, 0.048);
  knockerRoot.add(griffinHead);

  // Curved hooked brass eagle beak gripping the ring pivot boss
  const hookedBeak = new THREE.Mesh(
    createTaperedTubeGeometry(
      [
        [0, 0.08, 0.072],
        [0, 0.068, 0.1],
        [0, 0.042, 0.106],
      ],
      { tubularSegs: 8, radialSegs: 7, radiusFn: (u) => 0.019 * (1 - 0.82 * u) }
    ),
    materials.gildedGold
  );
  knockerRoot.add(hookedBeak);

  // Feathered arched brass wings & fierce ear tufts + lion foreclaws
  const featherBladeShape = new THREE.Shape();
  featherBladeShape.moveTo(0, 0);
  featherBladeShape.quadraticCurveTo(0.022, 0.045, 0.008, 0.095);
  featherBladeShape.quadraticCurveTo(-0.012, 0.045, 0, 0);
  const featherGeom = new THREE.ExtrudeGeometry(featherBladeShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });

  for (const sx of [-1, 1]) {
    const earTuft = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.042, 5), materials.antiqueBrass);
    earTuft.rotation.set(-0.45, 0, -sx * 0.48);
    earTuft.position.set(sx * 0.028, 0.112, 0.04);
    knockerRoot.add(earTuft);

    const forePaw = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), materials.antiqueBrass);
    forePaw.position.set(sx * 0.036, 0.005, 0.052);
    knockerRoot.add(forePaw);

    for (let w = 0; w < 3; w++) {
      const feather = new THREE.Mesh(featherGeom, w === 0 ? materials.gildedGold : materials.antiqueBrass);
      feather.position.set(sx * (0.042 + w * 0.016), 0.032 - w * 0.018, 0.022);
      feather.rotation.set(-0.18, sx * 0.24, -sx * (0.48 + w * 0.28));
      feather.scale.set(sx, 1 - w * 0.14, 1);
      knockerRoot.add(feather);
    }
  }

  // Pivoting heavy chamfered brass knocker ring with striker boss
  const knockerRingPivot = new THREE.Group();
  knockerRingPivot.position.set(0, 0.018, 0.072);
  const collarBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.028, 10), materials.antiqueBrass);
  collarBoss.rotation.z = Math.PI * 0.5;
  knockerRingPivot.add(collarBoss);

  const knockerRing = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.014, 10, 24), materials.gildedGold);
  knockerRing.position.set(0, -0.072, 0);
  knockerRingPivot.add(knockerRing);

  const strikerKnob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), materials.gildedGold);
  strikerKnob.position.set(0, -0.15, 0);
  knockerRingPivot.add(strikerKnob);

  knockerRoot.add(knockerRingPivot);

  doorPivot.add(knockerRoot);
  doorAssembly.add(doorPivot);

  return {
    doorAssembly,
    doorPivot,
    knockerRingPivot,
  };
}

/**
 * Builds the entire entrance approach: lower corridor (y = -3.6), gargoyle, splitting stone wall,
 * moving spiral stone staircase (y = -3.6 -> 0), upper landing, and oak door with brass griffin knocker.
 */
function buildEntranceAssembly(materials, layout) {
  const { ENTRANCE } = layout;

  // 1. Lower approach corridor, splitting wall, spiral staircase, and upper landing (always visible)
  const approachGroup = new THREE.Group();
  approachGroup.name = 'EntranceApproachGroup';

  const { corridor, wallSplit, spiralStaircase, upperLanding, gargoyle: gargoyleSpec } = ENTRANCE;
  const cWidth = corridor.maxX - corridor.minX;
  const cLen = corridor.maxZ - corridor.minZ;
  const cCenterZ = (corridor.minZ + corridor.maxZ) * 0.5;

  // Corridor group (`y = -3.6` floor)
  const corridorGroup = new THREE.Group();
  corridorGroup.name = 'LowerStoneCorridor';

  const corrFloor = new THREE.Mesh(
    createScaledBoxGeometry(cWidth + 0.4, 0.24, cLen, 14.0, 14.0),
    materials.flagstoneFloor
  );
  corrFloor.position.set(0, corridor.floorY - 0.12, cCenterZ);
  corrFloor.receiveShadow = true;
  corridorGroup.add(corrFloor);

  const corrCeiling = new THREE.Mesh(
    createScaledBoxGeometry(cWidth + 0.5, 0.26, cLen),
    materials.stoneDark
  );
  corrCeiling.position.set(0, corridor.floorY + corridor.height + 0.13, cCenterZ);
  corrCeiling.castShadow = true;
  corrCeiling.receiveShadow = true;
  corridorGroup.add(corrCeiling);

  for (const sx of [-1, 1]) {
    const sideWall = new THREE.Mesh(createScaledBoxGeometry(0.32, corridor.height, cLen), materials.stoneWall);
    sideWall.position.set(sx * (cWidth * 0.5 + 0.16), corridor.floorY + corridor.height * 0.5, cCenterZ);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    corridorGroup.add(sideWall);
  }

  // Gothic rib arches along the corridor (leaving South z = 16.4 open for camera entrance preset)
  for (const az of [11.2, 13.4, 15.8]) {
    for (const sx of [-1, 1]) {
      const pier = new THREE.Mesh(createScaledBoxGeometry(0.18, corridor.height, 0.24), materials.stoneDark);
      pier.position.set(sx * (cWidth * 0.5 - 0.08), corridor.floorY + corridor.height * 0.5, az);
      corridorGroup.add(pier);
    }
    const crossBeam = new THREE.Mesh(createScaledBoxGeometry(cWidth, 0.22, 0.24), materials.stoneDark);
    crossBeam.position.set(0, corridor.floorY + corridor.height - 0.11, az);
    corridorGroup.add(crossBeam);
  }

  // Corridor sconces lighting the ugly stone gargoyle
  const corridorFlames = [];
  for (const sx of [-1, 1]) {
    const sconce = createWallSconce(materials, materials.stoneDark);
    sconce.position.set(sx * (cWidth * 0.5 - 0.02), corridor.floorY + 2.05, 13.0);
    sconce.rotation.y = -sx * Math.PI * 0.5;
    corridorGroup.add(sconce);
    sconce.traverse((c) => {
      if (c.userData?.isCandleFlame) corridorFlames.push(c);
    });
  }
  const corridorLight = new THREE.PointLight('#ffaa58', 2.2, 9.5, 1.5);
  corridorLight.position.set(0, corridor.floorY + 2.35, 13.0);
  corridorGroup.add(corridorLight);

  mergeStaticSubtree(corridorGroup, {
    skipFilter: (m) => m.userData?.isCandleFlame || corridorFlames.some((fl) => isDescendantOf(m, fl)),
  });

  approachGroup.add(corridorGroup);

  // Splitting two-leaf stone wall at z = 10.75
  const wallSplitGroup = new THREE.Group();
  wallSplitGroup.name = 'SplittingStoneWall';

  const leftLeaf = new THREE.Mesh(
    createScaledBoxGeometry(wallSplit.leafWidth, wallSplit.leafHeight, wallSplit.thickness),
    materials.stoneWall
  );
  leftLeaf.position.set(-wallSplit.leafWidth * 0.5, wallSplit.floorY + wallSplit.leafHeight * 0.5, wallSplit.z);
  leftLeaf.castShadow = true;
  leftLeaf.receiveShadow = true;
  wallSplitGroup.add(leftLeaf);

  const rightLeaf = new THREE.Mesh(
    createScaledBoxGeometry(wallSplit.leafWidth, wallSplit.leafHeight, wallSplit.thickness),
    materials.stoneWall
  );
  rightLeaf.position.set(wallSplit.leafWidth * 0.5, wallSplit.floorY + wallSplit.leafHeight * 0.5, wallSplit.z);
  rightLeaf.castShadow = true;
  rightLeaf.receiveShadow = true;
  wallSplitGroup.add(rightLeaf);

  // Surrounding stone casing/pockets for splitting wall leaves
  const lintelH = corridor.height - wallSplit.leafHeight;
  const splitLintel = new THREE.Mesh(
    createScaledBoxGeometry(cWidth + 0.5, Math.max(0.32, lintelH), wallSplit.thickness + 0.12),
    materials.stoneDark
  );
  splitLintel.position.set(0, wallSplit.floorY + wallSplit.leafHeight + Math.max(0.32, lintelH) * 0.5, wallSplit.z);
  wallSplitGroup.add(splitLintel);

  const splitStoneTrimMat = materials?.carvedStone || materials.stoneDark;
  for (const sx of [-1, 1]) {
    const pocketPier = new THREE.Mesh(
      createScaledBoxGeometry(0.85, corridor.height, wallSplit.thickness + 0.2),
      splitStoneTrimMat
    );
    pocketPier.position.set(sx * (cWidth * 0.5 + 0.25), wallSplit.floorY + corridor.height * 0.5, wallSplit.z);
    wallSplitGroup.add(pocketPier);

    // Front & back grooved stone pocket cheeks closing the 32.5cm side gap to ±1.10 while keeping pocket slot open
    for (const sz of [-1, 1]) {
      const cheek = new THREE.Mesh(
        createScaledBoxGeometry(0.62, corridor.height, 0.12),
        splitStoneTrimMat
      );
      cheek.position.set(
        sx * 1.41,
        wallSplit.floorY + corridor.height * 0.5,
        wallSplit.z + sz * (wallSplit.thickness * 0.5 + 0.065)
      );
      cheek.castShadow = true;
      cheek.receiveShadow = true;
      wallSplitGroup.add(cheek);
    }
  }
  mergeStaticSubtree(wallSplitGroup, {
    skipFilter: (m) => m === leftLeaf || m === rightLeaf,
  });
  approachGroup.add(wallSplitGroup);

  // Gargoyle entity (interactive canon object 'stone-gargoyle')
  const gargoyleRig = buildUglyStoneGargoyle(materials);
  gargoyleRig.root.position.set(...gargoyleSpec.guardPos);
  gargoyleRig.root.rotation.y = gargoyleSpec.facingRotY;
  approachGroup.add(gargoyleRig.root);

  // Moving Spiral Stone Staircase ('spiral-staircase')
  const stairGroup = new THREE.Group();
  stairGroup.name = 'MovingSpiralStaircase';

  const { centerX, centerZ, radius, innerColumnRadius, topY, bottomY, stepCount, turns } = spiralStaircase;
  const shaftHeight = topY - bottomY + 3.2;

  // Lower stair floor slab
  const stairPitFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.35, radius + 0.35, 0.24, 24),
    materials.flagstoneFloor
  );
  stairPitFloor.position.set(centerX, bottomY - 0.12, centerZ);
  stairPitFloor.receiveShadow = true;
  stairGroup.add(stairPitFloor);

  // Central stone newel column
  const newel = new THREE.Mesh(
    new THREE.CylinderGeometry(innerColumnRadius, innerColumnRadius, shaftHeight, 16),
    materials.stoneDark
  );
  newel.position.set(centerX, bottomY + shaftHeight * 0.5 - 0.1, centerZ);
  newel.castShadow = true;
  newel.receiveShadow = true;
  stairGroup.add(newel);

  // Open-arcade stone shaft wall around West/rear side so treads are visible from overview/side
  const shaftArcGeom = createCurvedWallArcGeometry({
    innerR: radius + 0.08,
    outerR: radius + 0.38,
    startRad: Math.PI * 0.72,
    endRad: Math.PI * 1.78,
    minY: bottomY,
    maxY: topY + 2.85,
    radialSegs: 14,
    roomHeight: 5.6,
  });
  const shaftWall = new THREE.Mesh(shaftArcGeom, materials.stoneWall);
  shaftWall.position.set(centerX, 0, centerZ);
  shaftWall.castShadow = true;
  shaftWall.receiveShadow = true;
  stairGroup.add(shaftWall);

  // Stone arcade columns on East side of stair tower supporting upper landing roof
  for (const angDeg of [35, 78, 122]) {
    const a = (angDeg * Math.PI) / 180;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, shaftHeight, 10), materials.stoneDark);
    col.position.set(centerX + (radius + 0.2) * Math.sin(a), bottomY + shaftHeight * 0.5, centerZ + (radius + 0.2) * Math.cos(a));
    col.castShadow = true;
    stairGroup.add(col);
  }

  // Helical stone wedge treads revolving smoothly upward like an escalator
  const treadSpanAngle = (turns * Math.PI * 2) / stepCount;
  const treadShape = new THREE.Shape();
  const rIn = innerColumnRadius + 0.02;
  const rOut = radius - 0.04;
  treadShape.moveTo(rIn * Math.sin(-treadSpanAngle * 0.48), rIn * Math.cos(-treadSpanAngle * 0.48));
  treadShape.lineTo(rOut * Math.sin(-treadSpanAngle * 0.48), rOut * Math.cos(-treadSpanAngle * 0.48));
  treadShape.lineTo(rOut * Math.sin(treadSpanAngle * 0.48), rOut * Math.cos(treadSpanAngle * 0.48));
  treadShape.lineTo(rIn * Math.sin(treadSpanAngle * 0.48), rIn * Math.cos(treadSpanAngle * 0.48));
  treadShape.closePath();

  const treadGeom = new THREE.ExtrudeGeometry(treadShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  treadGeom.rotateX(Math.PI * 0.5);
  treadGeom.translate(0, 0.14, 0);
  const treadUv = treadGeom.getAttribute('uv');
  for (let i = 0; i < treadUv.count; i++) {
    treadUv.setXY(i, treadUv.getX(i) / 11.5, treadUv.getY(i) / 4.8);
  }
  treadUv.needsUpdate = true;

  const treads = [];
  for (let i = 0; i < stepCount; i++) {
    const treadGroup = new THREE.Group();
    const treadMesh = new THREE.Mesh(treadGeom, materials.stoneWall);
    treadMesh.castShadow = true;
    treadMesh.receiveShadow = true;
    treadGroup.add(treadMesh);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 6), materials.antiqueBrass);
    post.position.set(0, 0.38, rOut - 0.07);
    treadGroup.add(post);

    treadGroup.position.set(centerX, bottomY, centerZ);
    stairGroup.add(treadGroup);
    treads.push(treadGroup);
  }

  // Helical wrought-iron/brass outer handrail guide
  const railPoints = [];
  for (let i = 0; i <= 48; i++) {
    const p = i / 48;
    const y = bottomY + p * (topY - bottomY) + 0.78;
    const th = p * turns * Math.PI * 2;
    railPoints.push(new THREE.Vector3(centerX + (rOut - 0.07) * Math.sin(th), y, centerZ + (rOut - 0.07) * Math.cos(th)));
  }
  const railCurve = new THREE.CatmullRomCurve3(railPoints);
  const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 64, 0.028, 8, false), materials.antiqueBrass);
  stairGroup.add(railMesh);

  const stairLight = new THREE.PointLight('#ffb766', 1.5, 8.0, 1.6);
  stairLight.position.set(centerX, -1.6, centerZ);
  stairGroup.add(stairLight);

  mergeStaticSubtree(stairGroup, {
    skipFilter: (m) => treads.some((t) => isDescendantOf(m, t)),
  });

  approachGroup.add(stairGroup);

  // Upper stone landing bridging stair top (z = 7.55) to oak door (z = 6.5)
  const landingGroup = new THREE.Group();
  landingGroup.name = 'UpperDoorLanding';
  const landW = upperLanding.maxX - upperLanding.minX;
  const landD = upperLanding.maxZ - upperLanding.minZ;
  const landCenterZ = (upperLanding.minZ + upperLanding.maxZ) * 0.5;

  const landingSlab = new THREE.Mesh(
    createScaledBoxGeometry(landW, 0.24, landD + 0.2, 14.0, 14.0),
    materials.flagstoneFloor
  );
  landingSlab.position.set(0, upperLanding.floorY - 0.12, landCenterZ);
  landingSlab.receiveShadow = true;
  landingSlab.castShadow = true;
  landingGroup.add(landingSlab);

  for (const sx of [-1, 1]) {
    const parapet = new THREE.Mesh(createScaledBoxGeometry(0.22, 1.05, landD), materials.stoneWall);
    parapet.position.set(sx * (landW * 0.5 - 0.11), upperLanding.floorY + 0.525, landCenterZ);
    parapet.castShadow = true;
    landingGroup.add(parapet);
  }
  mergeStaticSubtree(landingGroup);
  approachGroup.add(landingGroup);

  // 2. Oak door & brass griffin knocker (mounted inside sector-entrance-door so cutaway works smoothly)
  const oakDoor = buildOakDoorAndKnocker(materials, layout);

  // Animation state
  let gargoyleMode = 'guard';
  let gargoylePosT = 0; // 0 = guard, 1 = aside, 2 = lopsided
  let wallSplitTarget = 0;
  let wallSplitCurrent = 0;
  let doorOpen = false;
  let doorTargetRad = 0;
  let doorCurrentRad = 0;
  let stairPhase = 0;
  let stairBoostTimer = 0;
  let shakeTimer = 0;
  let knockTimer = 0;
  let sequenceTimer = -1;
  let currentEra = DEFAULT_ERA;

  const guardPos = new THREE.Vector3(...gargoyleSpec.guardPos);
  const asidePos = new THREE.Vector3(...gargoyleSpec.asidePos);
  const lopsidedPos = new THREE.Vector3(...gargoyleSpec.lopsidedPos);

  function setGargoyleState(mode = 'guard') {
    if (mode === 'aside') {
      gargoyleMode = 'aside';
      wallSplitTarget = 1;
    } else if (mode === 'lopsided') {
      gargoyleMode = 'lopsided';
      wallSplitTarget = 1;
    } else {
      gargoyleMode = 'guard';
      wallSplitTarget = 0;
    }
    return gargoyleMode;
  }

  function setDoorOpen(open) {
    doorOpen = Boolean(open);
    doorTargetRad = doorOpen ? ENTRANCE.openSwingRad : 0;
    return doorOpen;
  }

  function triggerKnock() {
    knockTimer = 1.05;
    return { knocked: true };
  }

  function triggerEntranceSequence(password) {
    // In DH Ch. 36 era, gargoyle is already lopsided ("Feel free," groaned the statue)
    if (currentEra === 'dh' && (password === undefined || password === null || password === '')) {
      setGargoyleState('lopsided');
      setDoorOpen(true);
      stairBoostTimer = 4.0;
      return {
        accepted: true,
        password: null,
        gargoyleState: 'lopsided',
        message: '“Feel free,” groaned the lopsided stone gargoyle.',
      };
    }

    const spoken = password === undefined || password === null || password === ''
      ? ERA_DEFAULT_PASSWORDS[currentEra] || 'Sherbet lemon'
      : String(password);

    const norm = normalizePassword(spoken);
    if (!ACCEPTED_PASSWORD_NORMALIZED.has(norm)) {
      shakeTimer = 0.65;
      return {
        accepted: false,
        password: spoken,
        gargoyleState: gargoyleMode,
        message: 'The large and extremely ugly stone gargoyle stays motionless.',
      };
    }

    if (currentEra === 'dh') {
      setGargoyleState('lopsided');
    } else {
      setGargoyleState('aside');
    }
    wallSplitTarget = 1;
    stairBoostTimer = 4.8;
    sequenceTimer = 0;
    return {
      accepted: true,
      password: spoken,
      gargoyleState: gargoyleMode,
      message: `Password "${spoken}" accepted — the gargoyle hops aside and the spiral staircase rises.`,
    };
  }

  function setEra(eraId) {
    currentEra = eraId;
    sequenceTimer = -1;
    if (eraId === 'dh') {
      setGargoyleState('lopsided');
      setDoorOpen(true);
    } else {
      setGargoyleState('guard');
      setDoorOpen(false);
    }
  }

  function update(dt, elapsed) {
    // Choreography timeline for entrance sequence
    if (sequenceTimer >= 0) {
      sequenceTimer += dt;
      if (sequenceTimer >= 0.9) {
        setDoorOpen(true);
        sequenceTimer = -1;
      }
    }

    // Gargoyle position & hop arc interpolation
    const targetT = gargoyleMode === 'guard' ? 0 : gargoyleMode === 'aside' ? 1 : 2;
    const prevT = gargoylePosT;
    gargoylePosT = damp(gargoylePosT, targetT, 6.2, dt);

    if (gargoylePosT <= 1) {
      gargoyleRig.root.position.lerpVectors(guardPos, asidePos, gargoylePosT);
      const hopArc = Math.sin(Math.min(1, Math.max(0, gargoylePosT)) * Math.PI) * 0.48;
      // Add hop elevation only while actively transitioning between guard and aside
      const movingFactor = clamp01(Math.abs(targetT - prevT) * 3.0);
      gargoyleRig.root.position.y = guardPos.y + hopArc * movingFactor;
      gargoyleRig.root.rotation.y = gargoylePosT * 0.42;
      gargoyleRig.root.rotation.z = 0;
      gargoyleRig.head.rotation.x = 0;
    } else {
      const f = gargoylePosT - 1;
      gargoyleRig.root.position.lerpVectors(asidePos, lopsidedPos, f);
      gargoyleRig.root.rotation.y = 0.42 * (1 - f * 0.3);
      gargoyleRig.root.rotation.z = gargoyleSpec.lopsidedTiltZ * f;
      gargoyleRig.head.rotation.x = 0.18 * f;
    }

    if (shakeTimer > 0) {
      shakeTimer = Math.max(0, shakeTimer - dt);
      gargoyleRig.head.rotation.y = Math.sin(shakeTimer * 28.0) * 0.25 * (shakeTimer / 0.65);
    } else {
      gargoyleRig.head.rotation.y = damp(gargoyleRig.head.rotation.y, 0, 10, dt);
    }

    // Splitting stone wall leaves
    wallSplitCurrent = damp(wallSplitCurrent, wallSplitTarget, 5.5, dt);
    leftLeaf.position.x = -wallSplit.leafWidth * 0.5 - wallSplit.slideOffset * wallSplitCurrent;
    rightLeaf.position.x = wallSplit.leafWidth * 0.5 + wallSplit.slideOffset * wallSplitCurrent;

    // Moving spiral staircase (continuous escalator upward revolution)
    if (stairBoostTimer > 0) {
      stairBoostTimer = Math.max(0, stairBoostTimer - dt);
    }
    const stairSpeed = stairBoostTimer > 0 ? 0.17 : 0.042;
    stairPhase = (stairPhase + dt * stairSpeed) % 1;

    for (let i = 0; i < stepCount; i++) {
      const p = (i / stepCount + stairPhase) % 1;
      const y = bottomY + p * (topY - bottomY);
      const th = p * turns * Math.PI * 2;
      const tread = treads[i];
      tread.position.y = y;
      tread.rotation.y = th;
      // Smoothly emerge from lower floor and retract at top landing threshold
      const edgeScale = p < 0.06 ? p / 0.06 : p > 0.94 ? (1 - p) / 0.06 : 1;
      tread.scale.y = Math.max(0.05, edgeScale);
    }

    // Gleaming oak door swing
    doorCurrentRad = damp(doorCurrentRad, doorTargetRad, 4.8, dt);
    oakDoor.doorPivot.rotation.y = doorCurrentRad;

    // Brass griffin knocker knock animation
    if (knockTimer > 0) {
      knockTimer = Math.max(0, knockTimer - dt);
      const strike = Math.abs(Math.sin(knockTimer * Math.PI * 3.0));
      oakDoor.knockerRingPivot.rotation.x = -0.58 * strike;
    } else {
      oakDoor.knockerRingPivot.rotation.x = damp(oakDoor.knockerRingPivot.rotation.x, 0, 14, dt);
    }

    // Corridor sconces flicker
    for (let i = 0; i < corridorFlames.length; i++) {
      const fl = corridorFlames[i];
      fl.scale.y = 0.88 + 0.2 * Math.sin(elapsed * 11 + i * 2.3);
    }
    corridorLight.intensity = 2.15 + Math.sin(elapsed * 8.2) * 0.16;
  }

  return {
    approachGroup,
    gargoyleGroup: gargoyleRig.root,
    stairGroup,
    doorGroup: oakDoor.doorAssembly,
    setGargoyleState,
    setDoorOpen,
    toggleDoor: () => setDoorOpen(!doorOpen),
    triggerKnock,
    triggerEntranceSequence,
    boostStairs: () => {
      stairBoostTimer = 4.5;
    },
    setEra,
    update,
    getState: () => ({
      gargoyleMode,
      wallSplit: wallSplitTarget > 0.5,
      doorOpen,
    }),
  };
}

/**
 * Builds the recessed opaque Black Cabinet (`90°`) with double paneled doors and GoF Ch. 30
 * silvery volumetric light beam directed at the Sword of Gryffindor glass case (`201°`).
 */
function buildBlackCabinet(materials, layout) {
  const { BLACK_CABINET } = layout;
  const group = new THREE.Group();
  group.name = 'BlackCabinet';
  group.position.set(BLACK_CABINET.pos[0], BLACK_CABINET.pos[1], BLACK_CABINET.pos[2]);
  group.rotation.y = BLACK_CABINET.rotationY;

  const w = BLACK_CABINET.width; // 1.28
  const h = BLACK_CABINET.height; // 2.45
  const d = BLACK_CABINET.depth; // 0.68
  const mat = materials.blackCabinet;

  // Carcass shifted slightly proud (-z is toward wall, +z is toward center) so Pensieve (x=6.12, r=0.28)
  // clears closed front doors cleanly at world x = 5.79
  const zBack = -0.32;
  const zFront = 0.39;
  const bodyDepth = zFront - zBack; // 0.71
  const zMid = (zBack + zFront) * 0.5;

  // Plinth base & top crown cornice
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.12, bodyDepth + 0.04), mat);
  plinth.position.set(0, 0.06, zMid);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const topBoard = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, bodyDepth), mat);
  topBoard.position.set(0, h - 0.14, zMid);
  topBoard.castShadow = true;
  group.add(topBoard);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, bodyDepth + 0.1), mat);
  cornice.position.set(0, h - 0.05, zMid + 0.02);
  cornice.castShadow = true;
  group.add(cornice);

  // Back panel & side walls
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.24, 0.05), mat);
  backPanel.position.set(0, h * 0.5 - 0.02, zBack + 0.025);
  backPanel.receiveShadow = true;
  group.add(backPanel);

  for (const sx of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.24, bodyDepth), mat);
    sideWall.position.set(sx * (w * 0.5 - 0.03), h * 0.5 - 0.02, zMid);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    group.add(sideWall);
  }

  // Interior shelf whose top surface is at exact layout.BLACK_CABINET.interiorShelfY (1.08)
  const shelfThick = 0.04;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, shelfThick, bodyDepth - 0.08), mat);
  shelf.position.set(0, BLACK_CABINET.interiorShelfY - shelfThick * 0.5, zMid);
  shelf.receiveShadow = true;
  group.add(shelf);

  // Lower solid cupboard compartment (below Pensieve shelf)
  const lowerApron = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.92, bodyDepth - 0.1), mat);
  lowerApron.position.set(0, 0.58, zMid - 0.02);
  group.add(lowerApron);

  // Double opaque black wooden doors (NO glass panels!)
  const doorW = (w - 0.12) * 0.5; // 0.58
  const doorH = h - 0.34;
  const doorY = 0.14 + doorH * 0.5;

  const makeDoorLeaf = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (w * 0.5 - 0.06), 0, zFront);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.045), mat);
    leaf.position.set(-side * (doorW * 0.5), doorY, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    pivot.add(leaf);

    // Recessed opaque raised-molding panels on outer (+Z) leaf face only so open doors show clean inner wood
    for (const py of [0.64, 1.62]) {
      const ph = py < 1 ? 0.68 : 0.94;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.14, ph, 0.018), mat);
      panel.position.set(-side * (doorW * 0.5), py, 0.026);
      pivot.add(panel);
    }

    // Antique brass door pull near center seam
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), materials.antiqueBrass);
    knob.position.set(-side * (doorW - 0.06), 1.24, 0.04);
    pivot.add(knob);

    return pivot;
  };

  const leftDoorPivot = makeDoorLeaf(-1); // North side (-Z)
  const rightDoorPivot = makeDoorLeaf(1); // South side (+Z)
  group.add(leftDoorPivot, rightDoorPivot);

  // Volumetric silvery sliver beam (GoF Ch. 30) from beamOrigin to beamTarget (SWORD_CASE)
  const originVec = new THREE.Vector3(...BLACK_CABINET.beamOrigin);
  const targetVec = new THREE.Vector3(...BLACK_CABINET.beamTarget);
  const beamVec = targetVec.clone().sub(originVec);
  const beamLength = beamVec.length();

  const beamGroup = new THREE.Group();
  beamGroup.name = 'PensieveCabinetBeam';
  beamGroup.position.copy(originVec);
  beamGroup.lookAt(targetVec);
  beamGroup.visible = false;

  const beamUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  };
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: beamUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float fresnel = pow(ndv, 2.2);
        float along = clamp(1.0 - vUv.y, 0.0, 1.0);
        float distFade = (1.0 - smoothstep(0.08, 0.92, along)) * smoothstep(0.0, 0.06, along);
        float shimmer = 0.85 + 0.15 * sin(along * 16.0 - uTime * 2.4 + vUv.x * 7.0);
        float alpha = fresnel * distFade * shimmer * uOpacity * 0.18;
        if (alpha <= 0.001) discard;
        vec3 col = mix(vec3(0.74, 0.86, 1.0), vec3(0.92, 0.97, 1.0), fresnel);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  // Narrow vertical slit beam matching an ajar cabinet crack
  const slitGeom = new THREE.CylinderGeometry(0.025, 0.22, beamLength, 12, 1, true);
  slitGeom.rotateX(Math.PI * 0.5);
  slitGeom.translate(0, 0, beamLength * 0.5);
  const beamCone = new THREE.Mesh(slitGeom, beamMat);
  beamCone.scale.set(0.32, 1.35, 1.0);
  beamCone.raycast = () => {};
  beamGroup.add(beamCone);

  const sliverLight = new THREE.SpotLight('#d8ebff', 0, 13.5, 0.22, 0.96, 1.4);
  sliverLight.position.copy(originVec);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.copy(targetVec);
  sliverLight.target = spotTarget;

  // Interior silver glow illuminating inside of cabinet when ajar/open
  const interiorGlow = new THREE.PointLight('#cde3ff', 0, 2.8, 2.0);
  interiorGlow.position.set(0, 1.45, 0.05);
  group.add(interiorGlow);

  let state = 'closed';
  let leftAngle = 0;
  let rightAngle = 0;
  let beamAlpha = 0;

  function setState(nextState) {
    if (nextState === 'ajar' || nextState === 'open' || nextState === 'closed') {
      state = nextState;
    } else {
      state = state === 'closed' ? 'ajar' : state === 'ajar' ? 'open' : 'closed';
    }
    return state;
  }

  function setEra(eraId) {
    if (eraId === 'gof') setState('ajar');
    else if (eraId === 'dh') setState('open');
    else setState('closed');
  }

  function update(dt, elapsed) {
    const targetL = state === 'open' ? -1.55 : state === 'ajar' ? -0.26 : 0;
    const targetR = state === 'open' ? 1.55 : 0;

    leftAngle = damp(leftAngle, targetL, 6.0, dt);
    rightAngle = damp(rightAngle, targetR, 6.0, dt);
    leftDoorPivot.rotation.y = leftAngle;
    rightDoorPivot.rotation.y = rightAngle;

    if (!isHierarchyVisible(group)) {
      beamAlpha = 0;
      beamGroup.visible = false;
      beamUniforms.uOpacity.value = 0;
      sliverLight.intensity = 0;
      sliverLight.visible = false;
      interiorGlow.intensity = 0;
      interiorGlow.visible = false;
      return;
    }

    const wantBeam = state === 'ajar';
    beamAlpha = damp(beamAlpha, wantBeam ? 1.0 : 0.0, 5.5, dt);
    beamGroup.visible = beamAlpha > 0.01;
    beamUniforms.uTime.value = elapsed;
    beamUniforms.uOpacity.value = beamAlpha;

    sliverLight.intensity = beamAlpha * (1.35 + 0.18 * Math.sin(elapsed * 2.7));
    sliverLight.visible = sliverLight.intensity > 0.01;
    interiorGlow.intensity = state === 'closed' ? 0 : state === 'ajar' ? 0.95 : 0.45;
    interiorGlow.visible = interiorGlow.intensity > 0.01;
  }

  return {
    group,
    beamGroup,
    sliverLight,
    spotTarget,
    setState,
    setEra,
    update,
    getState: () => state,
  };
}

/**
 * Builds the complete architectural shell of Dumbledore's Office strictly from canonData.js & layout.js.
 *
 * @param {THREE.Scene} scene
 * @param {object} materials
 * @param {import('./registry.js').CanonSceneRegistry} registry
 * @param {object} layout
 * @param {object} canonData
 */
export function buildArchitecture(scene, materials, registry, layout, canonData) {
  const {
    ROOM_RADIUS,
    WALL_THICKNESS,
    ROOM_HEIGHT,
    FLOOR_Y,
    WALL_SECTORS,
    WINDOWS,
    SORTING_HAT_SHELF,
    HIDDEN_CAVITY,
    HORCRUX_BOOKS_ANCHOR,
    CARPET,
    CAMERA_PRESETS,
    ENTRANCE,
    BLACK_CABINET,
    FIREPLACE,
    degToRad,
    polarToCartesian,
    wallFacingRotation,
  } = layout;

  const CANON = canonData?.CANON_OBJECTS || {};
  const innerR = ROOM_RADIUS;
  const outerR = ROOM_RADIUS + WALL_THICKNESS;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'ArchitectureRoot';
  scene.add(rootGroup);

  const roomGroup = new THREE.Group();
  roomGroup.name = 'CircularStoneRoom';
  rootGroup.add(roomGroup);

  // 1. Flagstone Floor (FLOOR_Y = 0) & Subtle Woven Rug (CARPET)
  const floorGeom = new THREE.CylinderGeometry(outerR, outerR, 0.24, 64);
  const floorMesh = new THREE.Mesh(floorGeom, materials.flagstoneFloor);
  floorMesh.position.y = FLOOR_Y - 0.12;
  floorMesh.receiveShadow = true;
  roomGroup.add(floorMesh);

  const rugGeom = new THREE.CylinderGeometry(1, 1, 0.012, 40);
  const rugMesh = new THREE.Mesh(rugGeom, materials.wovenCarpet);
  rugMesh.scale.set(CARPET.radiusX, 1, CARPET.radiusZ);
  rugMesh.position.set(CARPET.x, CARPET.y, CARPET.z);
  rugMesh.receiveShadow = true;
  roomGroup.add(rugMesh);

  // Lower Hogwarts tower exterior masonry skirt (y = -6..0) with opening for entrance stairs
  const towerSkirtGeom = createCurvedWallArcGeometry({
    innerR: ROOM_RADIUS - 0.1,
    outerR,
    startRad: degToRad(14),
    endRad: degToRad(346),
    minY: -6.0,
    maxY: -0.02,
    radialSegs: 40,
    roomHeight: ROOM_HEIGHT,
  });
  const towerSkirt = new THREE.Mesh(towerSkirtGeom, materials.stoneDark);
  towerSkirt.receiveShadow = true;
  towerSkirt.castShadow = true;
  rootGroup.add(towerSkirt);

  // 2. Ceiling Group (timber-ribbed vault & stone parapet, hidden in cutaway mode)
  const ceilingGroup = new THREE.Group();
  ceilingGroup.name = 'TimberStoneCeiling';

  const ceilingConeGeom = new THREE.ConeGeometry(outerR + 0.1, 1.35, 48, 1, true);
  const ceilingShell = new THREE.Mesh(ceilingConeGeom, materials.darkCarvedOak);
  ceilingShell.position.y = ROOM_HEIGHT + 0.675;
  ceilingShell.material = materials.darkCarvedOak.clone();
  ceilingShell.material.side = THREE.DoubleSide;
  ceilingShell.castShadow = true;
  ceilingShell.receiveShadow = true;
  ceilingGroup.add(ceilingShell);

  const oculusBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 0.2, 12), materials.stoneDark);
  oculusBoss.position.y = ROOM_HEIGHT + 1.18;
  ceilingGroup.add(oculusBoss);

  const corniceCapRing = new THREE.Mesh(
    new THREE.TorusGeometry(ROOM_RADIUS + 0.22, 0.24, 8, 56),
    materials.stoneDark
  );
  corniceCapRing.rotation.x = Math.PI * 0.5;
  corniceCapRing.position.y = ROOM_HEIGHT + 0.08;
  ceilingGroup.add(corniceCapRing);

  const ribAngles = [18, 78, 102, 123, 147, 169, 191, 211, 236, 257, 285, 345];
  for (const deg of ribAngles) {
    const rad = degToRad(deg);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, ROOM_RADIUS), materials.darkCarvedOak);
    rib.position.set((ROOM_RADIUS * 0.48) * Math.sin(rad), ROOM_HEIGHT + 0.58, (ROOM_RADIUS * 0.48) * Math.cos(rad));
    rib.rotation.order = 'YXZ';
    rib.rotation.y = rad;
    rib.rotation.x = 0.19;
    ceilingGroup.add(rib);
  }
  mergeStaticSubtree(ceilingGroup);
  rootGroup.add(ceilingGroup);

  // 3. Exterior Grounds Dome & Photorealistic Highlands Vista + Windows (136° & 224°)
  const vista = buildExteriorVista(materials, layout);
  rootGroup.add(vista.group);

  const glassMat = materials.leadedGlass.clone();
  if (glassMat.transmission > 0) {
    glassMat.transparent = false;
    glassMat.opacity = 1.0;
    glassMat.depthWrite = true;
  } else {
    glassMat.transparent = true;
    glassMat.opacity = 0.36;
    glassMat.depthWrite = false;
  }

  const windowAssemblies = [];
  const windowHitMeshes = [];

  // 4. Entrance Assembly (Corridor, Gargoyle, Splitting Wall, Spiral Stairs, Oak Door & Knocker)
  const entrance = buildEntranceAssembly(materials, layout);
  rootGroup.add(entrance.approachGroup);

  // 5. Carved Stone Fireplace (270°)
  const fireplace = buildFireplace(materials, layout);

  // 6. Recessed Black Cabinet (90°)
  const cabinet = buildBlackCabinet(materials, layout);
  rootGroup.add(cabinet.beamGroup);
  rootGroup.add(cabinet.sliverLight);
  rootGroup.add(cabinet.spotTarget);

  // 7. Build all 14 Segmented Curved Wall Sectors matching layout.WALL_SECTORS
  const cutawaySectors = [];
  const roomHitMeshes = [];
  const wallFlames = [];

  let cavitySealMesh = null;
  let nicheBoxGroup = null;
  let cavityHighlightLight = null;
  let horcruxCorbelGroup = null;

  const pilasterAnglesBySector = {
    'sector-se-1': [18],
    'sector-se-2': [78],
    'sector-ene': [102, 123],
    'sector-north-east': [147],
    'sector-north-center': [169, 191],
    'sector-north-west': [211],
    'sector-wnw': [236, 257],
    'sector-sw-1': [285],
    'sector-sw-2': [345],
  };

  const sconceAnglesBySector = {
    'sector-se-1': [18],
    'sector-ene': [102],
    'sector-wnw': [257],
    'sector-sw-2': [345],
  };

  for (const sector of WALL_SECTORS) {
    const sectorGroup = new THREE.Group();
    sectorGroup.name = `WallSector_${sector.id}`;

    if (sector.hasDoorOpening) {
      // Doorway cutout (-8.5°..+8.5°, opening half-angle ~6.005°)
      const halfOpen = Math.asin((ENTRANCE.doorWidth * 0.5) / ROOM_RADIUS);
      const parts = [
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: sector.startRad,
          endRad: -halfOpen,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 2,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: halfOpen,
          endRad: sector.endRad,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 2,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: -halfOpen,
          endRad: halfOpen,
          minY: ENTRANCE.doorHeight,
          maxY: ROOM_HEIGHT,
          radialSegs: 8,
          roomHeight: ROOM_HEIGHT,
          yFnBottom: (t) => gothicArchY(t, ENTRANCE.doorHeight, ENTRANCE.archHeight),
        }),
      ];
      for (const g of parts) {
        const m = new THREE.Mesh(g, materials.stoneWall);
        m.castShadow = true;
        m.receiveShadow = true;
        sectorGroup.add(m);
        roomHitMeshes.push(m);
      }
      // Tympanum stone plug filling pointed arch above rectangular door top (2.65..2.95)
      const tympShape = new THREE.Shape();
      const halfDoorW = ENTRANCE.doorWidth * 0.5;
      tympShape.moveTo(-halfDoorW, 0);
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const tx = -halfDoorW + t * ENTRANCE.doorWidth;
        const ty = gothicArchY(t, ENTRANCE.doorHeight, ENTRANCE.archHeight) - ENTRANCE.doorHeight;
        tympShape.lineTo(tx, ty);
      }
      tympShape.lineTo(halfDoorW, 0);
      tympShape.closePath();
      const tympGeom = new THREE.ExtrudeGeometry(tympShape, { depth: 0.42, bevelEnabled: false });
      tympGeom.translate(0, 0, -0.21);
      const tymp = new THREE.Mesh(tympGeom, materials.stoneDark);
      tymp.position.set(0, ENTRANCE.doorHeight, 6.68);
      sectorGroup.add(tymp);

      sectorGroup.add(entrance.doorGroup);
    } else if (sector.hasWindowOpening && sector.windowSpec) {
      const win = buildWindowAssembly(sector.windowSpec, sector, materials, glassMat, layout);
      sectorGroup.add(win.wallGroup);
      sectorGroup.add(win.winFrame);
      if (win.shaftGroup) {
        sectorGroup.add(win.shaftGroup);
      }
      windowAssemblies.push(win);
      windowHitMeshes.push(...collectMeshes(win.winFrame).filter((m) => !m.userData?.noHighlight));
    } else if (sector.id === 'sector-east-cabinet') {
      // Recessed alcove for Black Cabinet (84°..96°, y = 0..2.52)
      const cabEndRad = degToRad(96);
      const parts = [
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: cabEndRad,
          endRad: sector.endRad,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 3,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: sector.startRad,
          endRad: cabEndRad,
          minY: 2.52,
          maxY: ROOM_HEIGHT,
          radialSegs: 6,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR: 6.62,
          outerR,
          startRad: sector.startRad,
          endRad: cabEndRad,
          minY: 0,
          maxY: 2.52,
          radialSegs: 6,
          roomHeight: ROOM_HEIGHT,
        }),
      ];
      for (const g of parts) {
        const m = new THREE.Mesh(g, materials.stoneWall);
        m.castShadow = true;
        m.receiveShadow = true;
        sectorGroup.add(m);
        roomHitMeshes.push(m);
      }
      sectorGroup.add(cabinet.group);
    } else if (sector.id === 'sector-west-fireplace') {
      // Hearth cutout (264°..276°, y = 0..1.88) backed by exterior chimney breast
      const fpStart = degToRad(264);
      const fpEnd = degToRad(276);
      const parts = [
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: sector.startRad,
          endRad: fpStart,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 3,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: fpEnd,
          endRad: sector.endRad,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 3,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: fpStart,
          endRad: fpEnd,
          minY: 1.88,
          maxY: ROOM_HEIGHT,
          radialSegs: 6,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR: 6.76,
          outerR: 7.25,
          startRad: fpStart - 0.02,
          endRad: fpEnd + 0.02,
          minY: 0,
          maxY: ROOM_HEIGHT + 0.9,
          radialSegs: 6,
          roomHeight: ROOM_HEIGHT,
        }),
      ];
      for (const g of parts) {
        const m = new THREE.Mesh(g, materials.stoneWall);
        m.castShadow = true;
        m.receiveShadow = true;
        sectorGroup.add(m);
        roomHitMeshes.push(m);
      }
      sectorGroup.add(fireplace.group);
    } else if (sector.id === 'sector-north-center') {
      // North Central Pier (180°): Sorting Hat Shelf (y=2.02) + Hidden Cavity behind Dumbledore Portrait (y=3.06..4.30)
      const cavHalfRad = Math.atan((HIDDEN_CAVITY.width * 0.5) / ROOM_RADIUS);
      const cavStart = HIDDEN_CAVITY.angleRad - cavHalfRad;
      const cavEnd = HIDDEN_CAVITY.angleRad + cavHalfRad;
      const cavMinY = HIDDEN_CAVITY.y - HIDDEN_CAVITY.height * 0.5;
      const cavMaxY = HIDDEN_CAVITY.y + HIDDEN_CAVITY.height * 0.5;

      const parts = [
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: sector.startRad,
          endRad: cavStart,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 4,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: cavEnd,
          endRad: sector.endRad,
          minY: 0,
          maxY: ROOM_HEIGHT,
          radialSegs: 4,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: cavStart,
          endRad: cavEnd,
          minY: 0,
          maxY: cavMinY,
          radialSegs: 3,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR,
          outerR,
          startRad: cavStart,
          endRad: cavEnd,
          minY: cavMaxY,
          maxY: ROOM_HEIGHT,
          radialSegs: 3,
          roomHeight: ROOM_HEIGHT,
        }),
        createCurvedWallArcGeometry({
          innerR: 6.78,
          outerR: 7.12,
          startRad: cavStart - 0.02,
          endRad: cavEnd + 0.02,
          minY: cavMinY - 0.1,
          maxY: cavMaxY + 0.1,
          radialSegs: 4,
          roomHeight: ROOM_HEIGHT,
        }),
      ];
      for (const g of parts) {
        const m = new THREE.Mesh(g, materials.stoneWall);
        m.castShadow = true;
        m.receiveShadow = true;
        sectorGroup.add(m);
        roomHitMeshes.push(m);
      }

      // Dark stone cavity interior lining (0.62 x 1.24 x 0.30), recessed behind ROOM_RADIUS = 6.50
      nicheBoxGroup = new THREE.Group();
      nicheBoxGroup.name = 'HiddenSwordCavity';
      nicheBoxGroup.position.set(0, HIDDEN_CAVITY.y, -6.655);
      const backPlate = new THREE.Mesh(createScaledBoxGeometry(0.64, 1.26, 0.05), materials.stoneDark);
      backPlate.position.z = -0.13;
      nicheBoxGroup.add(backPlate);
      for (const sx of [-1, 1]) {
        const side = new THREE.Mesh(createScaledBoxGeometry(0.04, 1.24, 0.3), materials.stoneDark);
        side.position.x = sx * 0.31;
        nicheBoxGroup.add(side);
      }
      for (const sy of [-1, 1]) {
        const cap = new THREE.Mesh(createScaledBoxGeometry(0.66, 0.04, 0.3), materials.stoneDark);
        cap.position.y = sy * 0.62;
        nicheBoxGroup.add(cap);
      }
      // Subtle brass hook at swordRestPos
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.09, 8), materials.antiqueBrass);
      hook.rotation.x = Math.PI * 0.5;
      hook.position.set(0, 0.25, -0.025);
      nicheBoxGroup.add(hook);

      cavityHighlightLight = new THREE.PointLight('#ffe2a6', 0, 2.6, 1.8);
      cavityHighlightLight.position.set(0, 0.12, 0.22);
      cavityHighlightLight.visible = false;
      nicheBoxGroup.add(cavityHighlightLight);
      nicheBoxGroup.visible = false;
      sectorGroup.add(nicheBoxGroup);

      // Flush curved stone seal matching sector-north-center curvature & ashlar UVs (cos/gof/oop)
      const sealGeom = createCurvedWallArcGeometry({
        innerR,
        outerR: innerR + 0.14,
        startRad: cavStart + 0.0005,
        endRad: cavEnd - 0.0005,
        minY: cavMinY + 0.0005,
        maxY: cavMaxY - 0.0005,
        radialSegs: 4,
        roomHeight: ROOM_HEIGHT,
      });
      cavitySealMesh = new THREE.Mesh(sealGeom, materials.stoneWall);
      cavitySealMesh.castShadow = true;
      cavitySealMesh.receiveShadow = true;
      sectorGroup.add(cavitySealMesh);
      roomHitMeshes.push(cavitySealMesh);

      // Sorting Hat Shelf at 180°, y = 2.02 (top surface at exact y = 2.06)
      const shelfGroup = new THREE.Group();
      shelfGroup.name = 'SortingHatShelf';
      shelfGroup.position.set(SORTING_HAT_SHELF.pos[0], SORTING_HAT_SHELF.y, SORTING_HAT_SHELF.pos[2]);
      shelfGroup.rotation.y = SORTING_HAT_SHELF.rotationY;

      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(SORTING_HAT_SHELF.width, SORTING_HAT_SHELF.thickness, SORTING_HAT_SHELF.depth),
        materials.darkCarvedOak
      );
      plank.castShadow = true;
      plank.receiveShadow = true;
      shelfGroup.add(plank);

      const corbelMat = materials?.carvedStone || materials.stoneDark;
      for (const sx of [-0.38, 0.38]) {
        const corbel = new THREE.Mesh(createScaledBoxGeometry(0.11, 0.24, 0.32), corbelMat);
        corbel.position.set(sx, -0.16, -0.04);
        corbel.castShadow = true;
        shelfGroup.add(corbel);
      }
      sectorGroup.add(shelfGroup);
      roomHitMeshes.push(plank);
    } else {
      // Standard solid curved stone wall arc
      const wallGeom = createCurvedWallArcGeometry({
        innerR,
        outerR,
        startRad: sector.startRad,
        endRad: sector.endRad,
        minY: 0,
        maxY: ROOM_HEIGHT,
        radialSegs: Math.max(4, Math.ceil(sector.spanDeg / 6)),
        roomHeight: ROOM_HEIGHT,
      });
      const wallMesh = new THREE.Mesh(wallGeom, materials.stoneWall);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      sectorGroup.add(wallMesh);
      roomHitMeshes.push(wallMesh);

      // Modest minimal-bridging stone wall corbel bracket at 155° strictly behind Horcrux books stand (HBP/DH only)
      if (sector.id === 'sector-north-east') {
        const corbelStoneMat = materials?.carvedStone || materials.stoneDark;
        horcruxCorbelGroup = new THREE.Group();
        horcruxCorbelGroup.name = 'HorcruxBooksWallLedgeAnchor';
        const [bx, , bz] = polarToCartesian(6.41, HORCRUX_BOOKS_ANCHOR.angleRad, FLOOR_Y);
        horcruxCorbelGroup.position.set(bx, 0, bz);
        horcruxCorbelGroup.rotation.y = wallFacingRotation(HORCRUX_BOOKS_ANCHOR.angleRad);

        const backPlinth = new THREE.Mesh(createScaledBoxGeometry(0.98, 0.12, 0.16), corbelStoneMat);
        backPlinth.position.set(0, 0.06, 0);
        backPlinth.receiveShadow = true;
        horcruxCorbelGroup.add(backPlinth);

        const rearRail = new THREE.Mesh(createScaledBoxGeometry(1.0, 0.07, 0.15), corbelStoneMat);
        rearRail.position.set(0, 0.78, 0);
        rearRail.castShadow = true;
        horcruxCorbelGroup.add(rearRail);

        horcruxCorbelGroup.visible = false;
        sectorGroup.add(horcruxCorbelGroup);
      }
    }

    // Upper cornice & baseboard stone molding per sector
    const corniceGeom = createCurvedWallArcGeometry({
      innerR: ROOM_RADIUS - 0.1,
      outerR: ROOM_RADIUS + 0.02,
      startRad: sector.startRad,
      endRad: sector.endRad,
      minY: ROOM_HEIGHT - 0.22,
      maxY: ROOM_HEIGHT,
      radialSegs: Math.max(3, Math.ceil(sector.spanDeg / 8)),
      roomHeight: ROOM_HEIGHT,
    });
    const corniceMesh = new THREE.Mesh(corniceGeom, materials.stoneDark);
    corniceMesh.receiveShadow = true;
    sectorGroup.add(corniceMesh);

    if (!sector.hasDoorOpening && sector.id !== 'sector-west-fireplace' && sector.id !== 'sector-east-cabinet') {
      const baseGeom = createCurvedWallArcGeometry({
        innerR: ROOM_RADIUS - 0.06,
        outerR: ROOM_RADIUS + 0.01,
        startRad: sector.startRad,
        endRad: sector.endRad,
        minY: 0,
        maxY: 0.22,
        radialSegs: Math.max(3, Math.ceil(sector.spanDeg / 8)),
        roomHeight: ROOM_HEIGHT,
      });
      const baseMesh = new THREE.Mesh(baseGeom, materials.stoneDark);
      baseMesh.receiveShadow = true;
      sectorGroup.add(baseMesh);
    }

    // Safe slim vertical stone pilasters clear of all portraits & fixtures
    const pilAngles = pilasterAnglesBySector[sector.id] || [];
    for (const deg of pilAngles) {
      const rad = degToRad(deg);
      const [px, , pz] = polarToCartesian(ROOM_RADIUS - 0.04, rad, 0);
      const pilaster = new THREE.Mesh(
        createScaledBoxGeometry(0.22, ROOM_HEIGHT - 0.22, 0.1),
        materials.stoneDark
      );
      pilaster.position.set(px, (ROOM_HEIGHT - 0.22) * 0.5, pz);
      pilaster.rotation.y = wallFacingRotation(rad);
      pilaster.castShadow = true;
      pilaster.receiveShadow = true;
      sectorGroup.add(pilaster);
    }

    // Warm brass wall candle sconces on pilasters
    const sconceAngles = sconceAnglesBySector[sector.id] || [];
    for (const deg of sconceAngles) {
      const rad = degToRad(deg);
      const [sx, , sz] = polarToCartesian(ROOM_RADIUS - 0.1, rad, 0);
      const sconce = createWallSconce(materials, materials.stoneDark);
      sconce.position.set(sx, 2.55, sz);
      sconce.rotation.y = wallFacingRotation(rad);
      sconce.traverse((c) => {
        if (c.userData?.isCandleFlame) wallFlames.push(c);
      });
      sectorGroup.add(sconce);
    }

    for (const rm of roomHitMeshes) {
      if (rm && rm.userData && !rm.userData.canonId) {
        rm.userData.canonId = 'circular-room';
      }
    }

    if (sector.id === 'sector-north-center' && nicheBoxGroup) {
      mergeStaticSubtree(nicheBoxGroup);
    }

    const skipRoots = [
      entrance.doorGroup,
      cabinet.group,
      fireplace.group,
      nicheBoxGroup,
      cavitySealMesh,
      horcruxCorbelGroup,
      ...windowAssemblies.flatMap((w) => [w.winFrame, w.shaftGroup]),
    ].filter(Boolean);

    const sectorBatch = mergeStaticSubtree(sectorGroup, {
      skipFilter: (m) =>
        Boolean(m.userData?.isCandleFlame) ||
        skipRoots.some((root) => isDescendantOf(m, root)),
    });

    if (sectorBatch.mergedMeshes.length > 0) {
      for (let i = roomHitMeshes.length - 1; i >= 0; i--) {
        if (!roomHitMeshes[i].parent) {
          roomHitMeshes.splice(i, 1);
        }
      }
      for (const mm of sectorBatch.mergedMeshes) {
        if (mm.userData?.canonId === 'circular-room') {
          roomHitMeshes.push(mm);
        }
      }
    }

    roomGroup.add(sectorGroup);
    cutawaySectors.push({
      id: sector.id,
      object: sectorGroup,
      normal: [...sector.normal],
    });
  }

  // Controller state
  let cutawayEnabled = true;
  let windowsOpen = false;
  let swordCavityOpen = false;
  let currentEra = DEFAULT_ERA;

  function setWindowsOpen(open) {
    windowsOpen = Boolean(open);
    return windowsOpen;
  }

  function setSwordCavityOpen(open) {
    swordCavityOpen = Boolean(open);
    const showCavity = swordCavityOpen || currentEra === 'hbp' || currentEra === 'dh';
    if (cavitySealMesh) {
      cavitySealMesh.visible = !showCavity;
    }
    if (nicheBoxGroup) {
      nicheBoxGroup.visible = showCavity;
    }
    if (cavityHighlightLight) {
      cavityHighlightLight.intensity = swordCavityOpen ? 2.6 : 0;
      cavityHighlightLight.visible = swordCavityOpen;
    }
    return swordCavityOpen;
  }

  function setCutaway(enabled) {
    cutawayEnabled = Boolean(enabled);
    if (!cutawayEnabled) {
      for (const s of cutawaySectors) {
        s.object.visible = true;
      }
      ceilingGroup.visible = true;
    } else {
      ceilingGroup.visible = false;
    }
    return cutawayEnabled;
  }

  function applyEra(eraId) {
    const key = typeof eraId === 'string' && eraId in ERA_SKY_PRESETS ? eraId : DEFAULT_ERA;
    currentEra = key;
    vista.setEra(key);
    fireplace.setEra(key);
    cabinet.setEra(key);
    entrance.setEra(key);
    for (const win of windowAssemblies) {
      win.setEra?.(key);
    }
    setWindowsOpen(key === 'dh');
    if (horcruxCorbelGroup) {
      horcruxCorbelGroup.visible = key === 'hbp' || key === 'dh';
    }
    setSwordCavityOpen(key === 'dh');
    return key;
  }

  // Tag hit meshes and register interactive canon objects
  const roomHitAll = [floorMesh, rugMesh, ...roomHitMeshes];
  for (const m of roomHitAll) tagCanonId(m, 'circular-room');

  tagCanonId(entrance.gargoyleGroup, 'stone-gargoyle');
  tagCanonId(entrance.stairGroup, 'spiral-staircase');
  tagCanonId(entrance.doorGroup, 'oak-door-knocker');
  tagCanonId(cabinet.group, 'black-cabinet');
  tagCanonId(fireplace.group, 'fireplace');
  for (const m of windowHitMeshes) tagCanonId(m, 'windows-grounds');

  let windowAngle = 0;

  if (registry && typeof registry.register === 'function') {
    registry.register({
      id: 'circular-room',
      name: CANON['circular-room']?.name || 'Circular Tower Chamber',
      category: CANON['circular-room']?.category || 'architecture',
      group: roomGroup,
      hitMeshes: roomHitAll,
      cameraPos: CAMERA_PRESETS.overview.pos,
      cameraTarget: CAMERA_PRESETS.overview.target,
      actions: (CANON['circular-room']?.actions || [{ id: 'overview', label: 'Room Overview' }]).map((a) => a.id),
      interact: (actionName, context = {}) => {
        if (actionName === 'overview' && context?.engine?.setCameraPreset) {
          return context.engine.setCameraPreset('overview');
        }
        return { id: 'circular-room', era: currentEra, cutaway: cutawayEnabled };
      },
      onUpdate: (dt, elapsed) => {
        for (let i = 0; i < wallFlames.length; i++) {
          const fl = wallFlames[i];
          fl.scale.y = 0.88 + 0.18 * Math.sin(elapsed * 9.8 + i * 1.9);
          fl.rotation.z = Math.sin(elapsed * 6.4 + i * 2.1) * 0.055;
        }
        fireplace.update(dt, elapsed);
        cabinet.update(dt, elapsed);
        entrance.update(dt, elapsed);
        vista.update(elapsed);

        const targetWinAngle = windowsOpen ? 0.36 : 0;
        windowAngle = damp(windowAngle, targetWinAngle, 5.2, dt);
        for (const win of windowAssemblies) {
          win.update?.(elapsed);
          for (const casement of win.casements) {
            casement.pivot.rotation.y = casement.side * windowAngle;
          }
        }
      },
      setEra: (eraId) => {
        applyEra(eraId);
      },
    });

    registry.register({
      id: 'windows-grounds',
      name: CANON['windows-grounds']?.name || 'Tower Windows Overlooking Grounds',
      category: CANON['windows-grounds']?.category || 'architecture',
      group: vista.group,
      hitMeshes: windowHitMeshes,
      cameraPos: [-1.15, 2.05, -0.35],
      cameraTarget: [-5.8, 2.45, -5.8],
      actions: (CANON['windows-grounds']?.actions || [{ id: 'look-out-window', label: 'Look Across Grounds' }]).map(
        (a) => a.id
      ),
      interact: (actionName) => {
        if (actionName === 'toggle-windows' || actionName === 'look-out-window') {
          const next = setWindowsOpen(!windowsOpen);
          return { windowsOpen: next, era: currentEra };
        }
        return { windowsOpen, era: currentEra };
      },
    });

    registry.register({
      id: 'fireplace',
      name: CANON.fireplace?.name || 'Stone Fireplace (Floo-Connected)',
      category: CANON.fireplace?.category || 'architecture',
      group: fireplace.group,
      hitMeshes: collectMeshes(fireplace.group),
      cameraPos: CAMERA_PRESETS.fireplace.pos,
      cameraTarget: CAMERA_PRESETS.fireplace.target,
      actions: (CANON.fireplace?.actions || [{ id: 'floo-flare', label: 'Trigger Emerald Floo Flame' }]).map(
        (a) => a.id
      ),
      interact: (actionName) => {
        if (!actionName || actionName === 'floo-flare') {
          return fireplace.triggerFlooFlash();
        }
        return { ok: true };
      },
    });

    registry.register({
      id: 'stone-gargoyle',
      name: CANON['stone-gargoyle']?.name || 'Stone Gargoyle Guardian',
      category: CANON['stone-gargoyle']?.category || 'entrance',
      group: entrance.gargoyleGroup,
      hitMeshes: collectMeshes(entrance.gargoyleGroup),
      cameraPos: CAMERA_PRESETS.entrance.pos,
      cameraTarget: CAMERA_PRESETS.entrance.target,
      actions: (CANON['stone-gargoyle']?.actions || [
        { id: 'speak-password' },
        { id: 'inspect' },
      ]).map((a) => a.id),
      interact: (actionName, context = {}) => {
        if (actionName === 'speak-password') {
          if (context?.password !== undefined) {
            return entrance.triggerEntranceSequence(context.password);
          }
          const st = entrance.getState();
          if (st.gargoyleMode === 'aside') {
            entrance.setGargoyleState('guard');
            entrance.setDoorOpen(false);
            return { accepted: true, gargoyleState: 'guard' };
          }
          return entrance.triggerEntranceSequence();
        }
        return entrance.getState();
      },
    });

    registry.register({
      id: 'spiral-staircase',
      name: CANON['spiral-staircase']?.name || 'Moving Spiral Stone Staircase',
      category: CANON['spiral-staircase']?.category || 'entrance',
      group: entrance.stairGroup,
      hitMeshes: collectMeshes(entrance.stairGroup),
      cameraPos: [2.6, -0.55, 11.4],
      cameraTarget: [0, -1.65, 9.1],
      actions: (CANON['spiral-staircase']?.actions || [{ id: 'ascend' }]).map((a) => a.id),
      interact: (actionName) => {
        if (!actionName || actionName === 'ascend') {
          entrance.boostStairs();
          if (entrance.getState().gargoyleMode === 'guard') {
            return entrance.triggerEntranceSequence();
          }
          return { ascending: true };
        }
        return { ascending: true };
      },
    });

    registry.register({
      id: 'oak-door-knocker',
      name: CANON['oak-door-knocker']?.name || 'Gleaming Oak Door & Brass Griffin Knocker',
      category: CANON['oak-door-knocker']?.category || 'entrance',
      group: entrance.doorGroup,
      hitMeshes: collectMeshes(entrance.doorGroup),
      cameraPos: [0.0, 1.72, 4.3],
      cameraTarget: [0.0, 1.52, 6.5],
      actions: (CANON['oak-door-knocker']?.actions || [
        { id: 'knock-door' },
        { id: 'toggle-door' },
      ]).map((a) => a.id),
      interact: (actionName) => {
        if (actionName === 'knock-door') {
          return entrance.triggerKnock();
        }
        if (actionName === 'toggle-door') {
          return { doorOpen: entrance.toggleDoor() };
        }
        return { doorOpen: entrance.getState().doorOpen };
      },
    });

    registry.register({
      id: 'black-cabinet',
      name: CANON['black-cabinet']?.name || 'Black Cabinet (Pensieve Cabinet)',
      category: CANON['black-cabinet']?.category || 'furniture',
      group: cabinet.group,
      hitMeshes: collectMeshes(cabinet.group),
      cameraPos: [2.6, 1.55, 0.25],
      cameraTarget: [6.05, 1.32, 0.0],
      actions: (CANON['black-cabinet']?.actions || [{ id: 'toggle-cabinet' }]).map((a) => a.id),
      interact: (actionName) => {
        if (actionName === 'closed' || actionName === 'ajar' || actionName === 'open') {
          return { state: cabinet.setState(actionName) };
        }
        return { state: cabinet.setState() };
      },
    });
  }

  // Initialize default era
  applyEra(DEFAULT_ERA);

  return {
    group: rootGroup,
    cutawaySectors,
    cutawayCeiling: ceilingGroup,
    getCutawaySectors: () => cutawaySectors,
    getCutawayCeiling: () => ceilingGroup,
    getCutawayCeilings: () => [ceilingGroup],
    setCutaway,
    triggerEntranceSequence: (password) => entrance.triggerEntranceSequence(password),
    setCabinetState: (state) => cabinet.setState(state),
    setSwordCavityOpen,
    setGargoyleState: (mode) => entrance.setGargoyleState(mode),
    triggerFlooFlash: () => fireplace.triggerFlooFlash(),
    setWindowsOpen,
    setDoorOpen: (open) => entrance.setDoorOpen(open),
    applyEra,
  };
}
