import * as THREE from 'three';
import * as defaultLayout from './layout.js';
import * as defaultCanonData from '../canon/canonData.js';

/**
 * Recursively assigns `.userData.canonId` on a root Object3D and all descendants.
 * @param {THREE.Object3D} root
 * @param {string} canonId
 */
function tagCanonId(root, canonId) {
  if (!root) return;
  root.userData.canonId = canonId;
  root.traverse((child) => {
    child.userData.canonId = canonId;
  });
}

/**
 * Collects all solid Meshes under root for explicit raycast hitMeshes registration.
 * Excludes meshes tagged `userData.noRaycast = true` (smoke wisps, flames, embers, contact shadows).
 * @param {THREE.Object3D} root
 * @returns {THREE.Mesh[]}
 */
function collectHitMeshes(root) {
  const meshes = [];
  root.traverse((child) => {
    if (child.isMesh && !child.userData?.noRaycast && !child.userData?.isHighlightOverlay) {
      meshes.push(child);
    }
  });
  return meshes;
}

/**
 * Enables castShadow / receiveShadow on solid meshes under a root.
 * @param {THREE.Object3D} root
 * @param {boolean} [cast=true]
 * @param {boolean} [receive=true]
 */
function enableShadows(root, cast = true, receive = true) {
  root.traverse((child) => {
    if (child.isMesh && !child.userData?.noShadow) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

/**
 * Resolves a soft radial ground contact-shadow material, compatible with both
 * upgraded materials.js (`createContactShadowMaterial`) and fallback mocks.
 * @param {object} materials
 * @returns {THREE.Material}
 */
function getContactShadowMaterial(materials) {
  if (typeof materials?.createContactShadowMaterial === 'function') {
    return materials.createContactShadowMaterial();
  }
  return new THREE.MeshBasicMaterial({
    color: '#070605',
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
}

/**
 * Creates a clear reflective display-case glazing material (`transparent: true`, `transmission: 0`)
 * so transmissive gems (`materials.rubyGem`) inside the case remain crisp and never get occluded
 * by nested transmission FBO passes.
 * @param {number} [opacity=0.22]
 * @returns {THREE.MeshPhysicalMaterial}
 */
function createCaseGlassMaterial(opacity = 0.22) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e6f2fc'),
    roughness: 0.05,
    metalness: 0.06,
    ior: 1.52,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

/**
 * Creates a subtle soft ground contact shadow disc at y = 0.003.
 * @param {object} materials
 * @param {number} radius
 * @param {number} [opacity=0.68]
 */
function createContactShadowMesh(materials, radius = 0.45, opacity = 0.68) {
  const mat = getContactShadowMaterial(materials);
  if (typeof mat.opacity === 'number') {
    mat.opacity = Math.min(mat.opacity, opacity);
  }
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.position.y = 0.003;
  mesh.userData.noRaycast = true;
  mesh.userData.noShadow = true;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Creates a soft billowing smoke-puff ShaderMaterial for subtle silver instrument wisps
 * and pale-green smoke serpent vapors.
 * @param {{ color?: string, edgeColor?: string, opacity?: number }} [opts]
 */
function createSmokeWispMaterial({
  color = '#d9e3ec',
  edgeColor = '#8ea1b5',
  opacity = 0.38,
} = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color(color) },
      uColorEdge: { value: new THREE.Color(edgeColor) },
      uOpacity: { value: opacity },
      uSeed: { value: Math.random() * 10 },
    },
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
      uniform vec3 uColorCore;
      uniform vec3 uColorEdge;
      uniform float uOpacity;
      uniform float uSeed;

      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float soft = pow(clamp(ndv, 0.0, 1.0), 1.45);
        float swirl = 0.5 + 0.5 * sin(vUv.y * 12.0 - uTime * 2.2 + uSeed) * cos(vUv.x * 8.0 + uTime * 1.4);
        vec3 col = mix(uColorEdge, uColorCore, soft * 0.75 + swirl * 0.25);
        float alpha = soft * (0.65 + 0.35 * swirl) * uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * Creates a shimmering pale-green tubular smoke shader for the OoP Ch. 22 splitting serpents.
 */
function createSerpentSmokeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColorCore: { value: new THREE.Color('#b6ffd0') },
      uColorMid: { value: new THREE.Color('#66d992') },
      uColorEdge: { value: new THREE.Color('#2d8a56') },
    },
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
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorEdge;

      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float bodySoft = pow(clamp(ndv, 0.0, 1.0), 1.15);
        float band = 0.5 + 0.5 * sin(vUv.x * 26.0 - uTime * 4.5 + sin(vUv.y * 6.2831) * 1.5);
        float endFade = smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));

        vec3 col = mix(uColorEdge, uColorMid, bodySoft * 0.7 + band * 0.3);
        col = mix(col, uColorCore, pow(bodySoft, 1.6) * (0.55 + 0.45 * band));

        float alpha = (0.35 + 0.65 * bodySoft) * (0.72 + 0.28 * band) * endFade * uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * Checks whether a wall sector with outward normal (normalX, normalZ) is currently
 * hidden by the engine's wall cutaway heuristic (mirrors engine.js updateCutawayVisibility).
 * @param {object|null|undefined} state
 * @param {number} normalX
 * @param {number} normalZ
 * @param {number} [roomRadius=6.5]
 * @returns {boolean}
 */
function isWallSectorCutAway(state, normalX, normalZ, roomRadius = 6.5) {
  if (!state || !state.cutaway || state.mode === 'first-person' || !state.camera) {
    return false;
  }
  const dx = state.camera.position.x;
  const dz = state.camera.position.z;
  const distXZ = Math.hypot(dx, dz);
  if (distXZ <= roomRadius * 0.85 || distXZ <= 1e-5) {
    return false;
  }
  const dot = (dx / distXZ) * normalX + (dz / distXZ) * normalZ;
  return dot > 0.14;
}

/**
 * Creates a procedural Burning Day phoenix flame ShaderMaterial with carved
 * swirling scarlet-amber flame tongues (no white additive blowout).
 */
function createPhoenixFlameMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
      uSeed: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vUv;
      varying float vHeight;

      void main() {
        vUv = uv;
        vHeight = uv.y;
        vec3 pos = position;
        float sway = sin(uTime * 7.8 + pos.y * 6.5 + uSeed) * 0.045 * pow(uv.y, 1.3);
        float twist = cos(uTime * 5.9 + pos.y * 7.5 - uSeed * 1.7) * 0.038 * pow(uv.y, 1.2);
        pos.x += sway;
        pos.z += twist;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uSeed;
      varying vec2 vUv;
      varying float vHeight;

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
        float angle = vUv.x * 6.2831853;
        vec2 nUv = vec2(vUv.x * 5.0 + uSeed, vUv.y * 3.4 - uTime * 3.6);
        float n = noise(nUv) * 0.65 + noise(nUv * 2.2 + 1.9) * 0.35;
        float tongues = 0.5 + 0.5 * sin(angle * 4.0 + vHeight * 4.5 - uTime * 5.2 + uSeed);
        float fineLick = 0.5 + 0.5 * sin(angle * 7.0 - vHeight * 6.0 - uTime * 7.4 + uSeed * 1.7);

        float shape = smoothstep(0.36, 0.88, tongues * 0.52 + fineLick * 0.24 + n * 0.48 - vHeight * 0.64);
        float baseFade = smoothstep(0.0, 0.14, vHeight);
        float tipFade = 1.0 - smoothstep(0.55, 1.0, vHeight);

        vec3 outer = vec3(0.72, 0.08, 0.015);
        vec3 mid = vec3(0.94, 0.34, 0.03);
        vec3 core = vec3(1.0, 0.68, 0.16);

        vec3 col = mix(outer, mid, smoothstep(0.15, 0.62, shape));
        col = mix(col, core, smoothstep(0.62, 0.95, shape) * (1.0 - vHeight * 0.65));

        float alpha = shape * baseFade * tipFade * 0.44 * uIntensity;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.46));
      }
    `,
  });
}

/**
 * Helper building a rising puff emitter of soft 3D smoke spheres above a nozzle.
 */
function createSmokeEmitter(parent, origin, {
  count = 7,
  color = '#dbe4ed',
  edgeColor = '#8fa4b8',
  baseScale = 0.022,
  riseHeight = 0.38,
  speed = 0.45,
  opacity = 0.34,
} = {}) {
  const group = new THREE.Group();
  group.position.copy(origin);
  parent.add(group);

  const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mat = createSmokeWispMaterial({ color, edgeColor, opacity });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(baseScale);
    mesh.userData.noRaycast = true;
    mesh.userData.noShadow = true;
    mesh.renderOrder = 3;
    group.add(mesh);
    puffs.push({
      mesh,
      mat,
      phase: i / count,
      driftX: ((i % 3) - 1) * 0.028,
      driftZ: (((i * 7) % 3) - 1) * 0.028,
    });
  }

  return {
    group,
    update(dt, elapsed, boost = 1.0) {
      for (const p of puffs) {
        p.phase = (p.phase + dt * speed * boost) % 1;
        const t = p.phase;
        const y = t * riseHeight;
        const swayX = Math.sin(elapsed * 2.1 + t * 5.0 + p.phase) * 0.028 * t + p.driftX * t;
        const swayZ = Math.cos(elapsed * 1.7 + t * 4.5 + p.phase) * 0.028 * t + p.driftZ * t;
        const s = baseScale * (0.7 + t * 2.4) * (0.85 + 0.25 * boost);
        p.mesh.position.set(swayX, y, swayZ);
        p.mesh.scale.set(s, s * 1.15, s);
        const fade = Math.sin(Math.min(1, t) * Math.PI);
        p.mat.uniforms.uTime.value = elapsed;
        p.mat.uniforms.uOpacity.value = opacity * fade * Math.min(1.4, boost);
      }
    },
    setVisible(v) {
      group.visible = v;
    },
  };
}

/**
 * Generates a real watchmaker toothed gear using `THREE.ExtrudeGeometry` with beveled teeth
 * and pierced spoked wheel cutouts (centered in XZ plane).
 * @param {number} outerRadius
 * @param {number} teeth
 * @param {number} [thickness=0.008]
 * @param {number} [spokeCount=5]
 * @returns {THREE.ExtrudeGeometry}
 */
function createToothedGearGeometry(outerRadius, teeth = 16, thickness = 0.008, spokeCount = 5) {
  const toothDepth = Math.max(0.0038, outerRadius * 0.16);
  const rootR = Math.max(0.008, outerRadius - toothDepth);
  const step = (Math.PI * 2) / teeth;

  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.16;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.56;
    const a4 = a0 + step * 0.74;

    const p0x = Math.cos(a0) * rootR;
    const p0y = Math.sin(a0) * rootR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * rootR, Math.sin(a1) * rootR);
    shape.lineTo(Math.cos(a2) * outerRadius, Math.sin(a2) * outerRadius);
    shape.lineTo(Math.cos(a3) * outerRadius, Math.sin(a3) * outerRadius);
    shape.lineTo(Math.cos(a4) * rootR, Math.sin(a4) * rootR);
  }
  shape.closePath();

  // Center axle bore hole
  const hubR = Math.max(0.0035, rootR * 0.24);
  const bore = new THREE.Path();
  bore.absarc(0, 0, hubR * 0.48, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  // Pierced radial spoke cutouts on larger gears
  if (spokeCount >= 3 && rootR > 0.022) {
    const innerRimR = hubR * 1.15;
    const outerRimR = rootR * 0.77;
    const spokeStep = (Math.PI * 2) / spokeCount;
    const marginAng = Math.min(0.24, spokeStep * 0.19);
    for (let s = 0; s < spokeCount; s++) {
      const sa0 = s * spokeStep + marginAng;
      const sa1 = (s + 1) * spokeStep - marginAng;
      if (sa1 - sa0 <= 0.08) continue;

      const win = new THREE.Path();
      // Draw CW for hole
      win.moveTo(Math.cos(sa1) * innerRimR, Math.sin(sa1) * innerRimR);
      for (let k = 1; k <= 5; k++) {
        const ang = THREE.MathUtils.lerp(sa1, sa0, k / 5);
        win.lineTo(Math.cos(ang) * innerRimR, Math.sin(ang) * innerRimR);
      }
      for (let k = 0; k <= 5; k++) {
        const ang = THREE.MathUtils.lerp(sa0, sa1, k / 5);
        win.lineTo(Math.cos(ang) * outerRimR, Math.sin(ang) * outerRimR);
      }
      win.closePath();
      shape.holes.push(win);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: Math.min(0.0012, thickness * 0.16),
    bevelThickness: Math.min(0.0012, thickness * 0.18),
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.rotateX(-Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an engraved silver astrolabe, clock, or lunar dial CanvasTexture.
 * Safely returns null in headless Node environments without a DOM `document`.
 * @param {'astrolabe'|'clock'|'lunar'|'gauge'} [style='astrolabe']
 * @returns {THREE.CanvasTexture|null}
 */
function createEngravedDialTexture(style = 'astrolabe') {
  if (typeof document === 'undefined') return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const cx = size * 0.5;
  const cy = size * 0.5;
  const R = size * 0.46;

  // Radial brushed silver / pale parchment-enamel dial background
  const bg = ctx.createRadialGradient(cx, cy, 12, cx, cy, R);
  if (style === 'clock') {
    bg.addColorStop(0, '#f4efe2');
    bg.addColorStop(0.76, '#e2dac8');
    bg.addColorStop(1, '#b8aa8f');
  } else {
    bg.addColorStop(0, '#eef3f7');
    bg.addColorStop(0.7, '#c7d2dc');
    bg.addColorStop(1, '#8c99a6');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Fine concentric brushed lathe lines
  ctx.strokeStyle = 'rgba(40, 48, 58, 0.08)';
  ctx.lineWidth = 1;
  for (let r = 24; r < R; r += 9) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer engraved bezel circles
  ctx.strokeStyle = '#252930';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.84, 0, Math.PI * 2);
  ctx.stroke();

  // 60 fine graduation ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI * 0.5;
    const isMajor = i % 5 === 0;
    const rIn = isMajor ? R * 0.84 : R * 0.89;
    const rOut = R * 0.95;
    ctx.strokeStyle = isMajor ? '#181a1f' : '#3a414d';
    ctx.lineWidth = isMajor ? 3.2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
    ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
    ctx.stroke();
  }

  if (style === 'clock') {
    const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.fillStyle = '#1b1d22';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI * 0.5;
      const rx = cx + Math.cos(a) * (R * 0.69);
      const ry = cy + Math.sin(a) * (R * 0.69);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(a + Math.PI * 0.5);
      ctx.fillText(romans[i], 0, 0);
      ctx.restore();
    }
    // Inner star rosette
    ctx.strokeStyle = '#735b2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? R * 0.34 : R * 0.14;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (style === 'lunar') {
    // 8 waxing/waning moon glyphs & star hairlines
    ctx.strokeStyle = '#333b48';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI * 0.5;
      const mx = cx + Math.cos(a) * (R * 0.64);
      const my = cy + Math.sin(a) * (R * 0.64);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx, my);
      ctx.stroke();

      ctx.fillStyle = '#202836';
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.fill();
      if (i > 0) {
        ctx.fillStyle = '#e7edf5';
        ctx.beginPath();
        ctx.arc(mx + (i <= 4 ? 5 : -5), my, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'gauge') {
    ctx.strokeStyle = '#27313d';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
      const rIn = i % 5 === 0 ? R * 0.66 : R * 0.74;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
      ctx.lineTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84);
      ctx.stroke();
    }
  } else {
    // Astrolabe off-center ecliptic circles & 8-point celestial star lines
    ctx.strokeStyle = '#253140';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - R * 0.14, R * 0.54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + R * 0.08, cy + R * 0.08, R * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82);
      ctx.stroke();

      // Tiny 4-point star
      const sx = cx + Math.cos(a + 0.25) * R * 0.64;
      const sy = cy + Math.sin(a + 0.25) * R * 0.64;
      ctx.fillStyle = '#1e2835';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a parallel-transported variable-radius elliptical curve tube (for Fawkes's neck,
 * curved raptor beak, and organic scroll tubes without cone primitives or Frenet flips).
 * @param {THREE.Curve} curve
 * @param {number} tubularSegs
 * @param {number} radialSegs
 * @param {(u: number) => number|{ rx: number, ry: number }} radiusFn
 * @param {boolean} [closedEnds=true]
 * @returns {THREE.BufferGeometry}
 */
function createTaperedCurveGeometry(curve, tubularSegs = 22, radialSegs = 12, radiusFn, closedEnds = true) {
  const ringVerts = radialSegs + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  const tangent = new THREE.Vector3();
  const prevTangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const refZ = new THREE.Vector3(0, 0, 1);
  const altX = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const p = curve.getPointAt(u);
    tangent.copy(curve.getTangentAt(u)).normalize();

    if (i === 0) {
      const ref = Math.abs(tangent.z) > 0.9 ? altX : refZ;
      binormal.crossVectors(tangent, ref).normalize();
      normal.crossVectors(binormal, tangent).normalize();
    } else {
      axis.crossVectors(prevTangent, tangent);
      const axisLen = axis.length();
      if (axisLen > 1e-6) {
        axis.divideScalar(axisLen);
        const cosA = THREE.MathUtils.clamp(prevTangent.dot(tangent), -1, 1);
        normal.applyAxisAngle(axis, Math.acos(cosA));
      }
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      binormal.crossVectors(tangent, normal).normalize();
    }
    prevTangent.copy(tangent);

    const radSpec = radiusFn(u);
    const rx = typeof radSpec === 'number' ? radSpec : radSpec.rx;
    const ry = typeof radSpec === 'number' ? radSpec : radSpec.ry;

    for (let j = 0; j <= radialSegs; j++) {
      const theta = (j / radialSegs) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const px = p.x + (normal.x * cosT * ry + binormal.x * sinT * rx);
      const py = p.y + (normal.y * cosT * ry + binormal.y * sinT * rx);
      const pz = p.z + (normal.z * cosT * ry + binormal.z * sinT * rx);
      positions.push(px, py, pz);
      uvs.push(j / radialSegs, u);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }

  if (closedEnds) {
    const startPt = curve.getPointAt(0);
    const startCenterIdx = positions.length / 3;
    positions.push(startPt.x, startPt.y, startPt.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }

    const endPt = curve.getPointAt(1);
    const endCenterIdx = positions.length / 3;
    const lastRingStart = tubularSegs * ringVerts;
    positions.push(endPt.x, endPt.y, endPt.z);
    uvs.push(0.5, 1);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, lastRingStart + j, lastRingStart + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a sculpted, cambered curved avian feather blade with thin 3D front/back faces
 * extending from origin along -Y, curving gracefully in Z with raised central rachis ridge
 * and UV `v` pointing toward tip.
 */
function createSculptedFeatherGeometry({
  length = 0.15,
  width = 0.036,
  arch = 0.02,
  cup = 0.0045,
  segsU = 6,
  segsV = 10,
} = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const cols = segsU + 1;
  const rows = segsV + 1;
  const sideVerts = cols * rows;
  const halfThick = 0.0009;

  for (const sideSign of [1, -1]) {
    for (let iv = 0; iv <= segsV; iv++) {
      const v = iv / segsV;
      const profileW = width * Math.pow(Math.sin(Math.pow(v, 0.72) * Math.PI), 0.82);
      const y = -v * length;
      const zCurve = Math.sin(v * Math.PI) * arch - v * v * arch * 0.35;

      for (let iu = 0; iu <= segsU; iu++) {
        const u = iu / segsU;
        const lat = u * 2 - 1; // [-1..1]
        const x = lat * profileW * 0.5;
        const rachis = Math.exp(-Math.pow(lat * 4.5, 2)) * 0.0028 * (1 - v * 0.6);
        const camber = -cup * (1 - lat * lat) * Math.sin(v * Math.PI);
        const z = zCurve + rachis + camber + sideSign * halfThick * (1 - Math.abs(lat) * 0.7);

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }
  }

  for (let iv = 0; iv < segsV; iv++) {
    for (let iu = 0; iu < segsU; iu++) {
      const a = iv * cols + iu;
      const b = (iv + 1) * cols + iu;
      const c = (iv + 1) * cols + (iu + 1);
      const d = iv * cols + (iu + 1);
      // Front face
      indices.push(a, b, d, b, c, d);
      // Back face (opposite winding)
      const ba = sideVerts + a;
      const bb = sideVerts + b;
      const bc = sideVerts + c;
      const bd = sideVerts + d;
      indices.push(ba, bd, bb, bb, bd, bc);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a long sweeping thin-3D ribbon-shaped tail feather blade along a 3D CatmullRomCurve3
 * with outward-facing front and back surfaces so it renders cleanly from all 360° angles.
 */
function createFeatherRibbonGeometry(curve, lengthSegs = 22, widthFn, cupDepth = 0.005) {
  const cols = 5;
  const rows = lengthSegs + 1;
  const sideVerts = cols * rows;
  const halfThick = 0.0009;
  const positions = [];
  const uvs = [];
  const indices = [];

  const tangent = new THREE.Vector3();
  const upRef = new THREE.Vector3(0, 0, 1);
  const lateral = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const frames = [];
  for (let i = 0; i <= lengthSegs; i++) {
    const v = i / lengthSegs;
    const p = curve.getPointAt(v);
    tangent.copy(curve.getTangentAt(v)).normalize();
    lateral.crossVectors(upRef, tangent);
    if (lateral.lengthSq() < 1e-5) lateral.set(1, 0, 0);
    else lateral.normalize();
    normal.crossVectors(tangent, lateral).normalize();
    frames.push({
      v,
      p: p.clone(),
      lateral: lateral.clone(),
      normal: normal.clone(),
      halfW: widthFn(v) * 0.5,
    });
  }

  for (const sideSign of [1, -1]) {
    for (let i = 0; i <= lengthSegs; i++) {
      const f = frames[i];
      for (let j = 0; j < cols; j++) {
        const u = j / (cols - 1);
        const lat = u * 2 - 1;
        const rachis = j === 2 ? 0.003 * (1 - f.v * 0.5) : 0;
        const camber = -cupDepth * (1 - lat * lat) * Math.sin(f.v * Math.PI);
        const thick = sideSign * halfThick * (1 - Math.abs(lat) * 0.7);
        const offsetN = rachis + camber + thick;
        positions.push(
          f.p.x + f.lateral.x * lat * f.halfW + f.normal.x * offsetN,
          f.p.y + f.lateral.y * lat * f.halfW + f.normal.y * offsetN,
          f.p.z + f.lateral.z * lat * f.halfW + f.normal.z * offsetN
        );
        uvs.push(u, f.v);
      }
    }
  }

  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, b, d, b, c, d);
      const ba = sideVerts + a;
      const bb = sideVerts + b;
      const bc = sideVerts + c;
      const bd = sideVerts + d;
      indices.push(ba, bd, bb, bb, bd, bc);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a faceted brilliant-cut oval/octagonal crimson ruby gemstone (`flatShading` facets).
 */
function createBrilliantCutRubyGeometry(radius = 0.022, height = 0.024) {
  const segs = 8;
  const crownZ = height * 0.36;
  const girdleZ = 0;
  const culetZ = -height * 0.64;
  const tableR = radius * 0.58;

  const positions = [];
  const tableCenter = [0, 0, crownZ];
  const culetPt = [0, 0, culetZ];
  const tablePts = [];
  const girdlePts = [];

  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    tablePts.push([Math.cos(a) * tableR, Math.sin(a) * tableR, crownZ]);
    girdlePts.push([Math.cos(a) * radius, Math.sin(a) * radius, girdleZ]);
  }

  const pushTri = (a, b, c) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  for (let i = 0; i < segs; i++) {
    const ni = (i + 1) % segs;
    // Flat octagonal table
    pushTri(tableCenter, tablePts[i], tablePts[ni]);
    // Beveled crown facets
    pushTri(tablePts[i], girdlePts[i], girdlePts[ni]);
    pushTri(tablePts[i], girdlePts[ni], tablePts[ni]);
    // Deep pavilion facets converging to culet point
    pushTri(girdlePts[i], culetPt, girdlePts[ni]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates mottled charcoal & powdery wood-ash textures for Fawkes's Burning Day ash mound.
 * Safely returns null in headless Node environments without a DOM `document`.
 */
function createAshMoundTextures() {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = size;
  diffCanvas.height = size;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;

  const dCtx = diffCanvas.getContext('2d', { willReadFrequently: true });
  const bCtx = bumpCanvas.getContext('2d', { willReadFrequently: true });
  if (!dCtx || !bCtx) return null;

  dCtx.fillStyle = '#484a4f';
  dCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Deterministic mottled ash clouds & charred flakes
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 4 + rand() * 20;
    const v = rand();
    if (v < 0.35) {
      dCtx.fillStyle = `rgba(34, 34, 38, ${0.22 + rand() * 0.25})`;
      bCtx.fillStyle = `rgba(45, 45, 45, ${0.3 + rand() * 0.3})`;
    } else if (v < 0.88) {
      const g = Math.floor(115 + rand() * 55);
      dCtx.fillStyle = `rgba(${g}, ${g + 2}, ${g + 6}, ${0.18 + rand() * 0.24})`;
      bCtx.fillStyle = `rgba(205, 205, 205, ${0.25 + rand() * 0.3})`;
    } else {
      // Subtle glowing ember speck trapped in charred ash
      dCtx.fillStyle = `rgba(188, 86, 26, ${0.18 + rand() * 0.22})`;
      bCtx.fillStyle = 'rgba(230, 230, 230, 0.35)';
    }
    dCtx.beginPath();
    dCtx.arc(x, y, r, 0, Math.PI * 2);
    dCtx.fill();

    bCtx.beginPath();
    bCtx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Fine granular soot & powdery cinder speckles
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const s = 1 + rand() * 2.2;
    const shade = rand() > 0.45 ? 168 + Math.floor(rand() * 55) : 26 + Math.floor(rand() * 28);
    dCtx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 4}, 0.55)`;
    dCtx.fillRect(x, y, s, s);
    const bShade = rand() > 0.5 ? 235 : 30;
    bCtx.fillStyle = `rgba(${bShade}, ${bShade}, ${bShade}, 0.6)`;
    bCtx.fillRect(x, y, s, s);
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

/**
 * Creates a true diamond-cross-section tapering double-edged goblin-made silver blade
 * (`y = -0.56` needle tip up to `y = +0.18` hilt shoulder) with a crisp central fuller groove and UVs.
 */
function createGoblinBladeGeometry() {
  const segsY = 28;
  const yTop = 0.18;
  const yTip = -0.56;
  const length = yTop - yTip;

  const positions = [];
  const uvs = [];
  const indices = [];

  const slices = [];
  for (let i = 0; i <= segsY; i++) {
    const u = i / segsY;
    const y = yTop - u * length;
    const tipTaper = u > 0.78 ? 1 - Math.pow((u - 0.78) / 0.22, 1.55) : 1.0 - u * 0.22;
    const halfW = Math.max(0.0004, 0.029 * tipTaper);
    const halfT = Math.max(0.0003, 0.0082 * (1 - u * 0.72));

    const fullerEnv = u > 0.04 && u < 0.72
      ? Math.sin(((u - 0.04) / 0.68) * Math.PI)
      : 0;
    const ridgeW = halfW * 0.26;
    const fullerCenterZ = halfT * (1.0 - 0.58 * fullerEnv);

    slices.push({
      v: 1 - u,
      leftEdge: { p: [-halfW, y, 0], u: 0.0 },
      frontLeftRidge: { p: [-ridgeW, y, halfT], u: 0.32 },
      frontCenter: { p: [0, y, fullerCenterZ], u: 0.5 },
      frontRightRidge: { p: [ridgeW, y, halfT], u: 0.68 },
      rightEdge: { p: [halfW, y, 0], u: 1.0 },
      backRightRidge: { p: [ridgeW, y, -halfT], u: 0.68 },
      backCenter: { p: [0, y, -fullerCenterZ], u: 0.5 },
      backLeftRidge: { p: [-ridgeW, y, -halfT], u: 0.32 },
    });
  }

  const strips = [
    ['leftEdge', 'frontLeftRidge'],
    ['frontLeftRidge', 'frontCenter'],
    ['frontCenter', 'frontRightRidge'],
    ['frontRightRidge', 'rightEdge'],
    ['rightEdge', 'backRightRidge'],
    ['backRightRidge', 'backCenter'],
    ['backCenter', 'backLeftRidge'],
    ['backLeftRidge', 'leftEdge'],
  ];

  for (const [kA, kB] of strips) {
    const baseVertex = positions.length / 3;
    for (let i = 0; i <= segsY; i++) {
      const a = slices[i][kA];
      const b = slices[i][kB];
      positions.push(a.p[0], a.p[1], a.p[2], b.p[0], b.p[1], b.p[2]);
      uvs.push(a.u, slices[i].v, b.u, slices[i].v);
    }
    for (let i = 0; i < segsY; i++) {
      const v0 = baseVertex + i * 2;
      const v1 = v0 + 1;
      const v2 = v0 + 2;
      const v3 = v0 + 3;
      indices.push(v0, v2, v1, v1, v2, v3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 1. Curious Silver Instruments (`silver-instruments`):
 *    4 watchmaker-grade silver contraptions mounted squarely on table.topY
 *    for `table-silver-1`..`table-silver-4`, featuring ExtrudeGeometry toothed clockwork gears,
 *    engraved silver dial faces, nested gimbal rings with pivot screws & finials,
 *    refractive optical glass bell domes enclosing oscillating pendulums, and silver exhaust chimneys.
 */
function buildSilverInstruments(parent, materials, registry, layout) {
  const group = new THREE.Group();
  group.name = 'CuriousSilverInstrumentsGroup';
  parent.add(group);

  const silverTables = layout.SPINDLE_TABLES.filter((t) => t.artifactType === 'silver-instruments');
  const smokeEmitters = [];
  const animTargets = {
    gyroRings: [],
    spindleGroup: null,
    governorArms: [],
    pendulums: [],
    balanceBeam: null,
    alembicDials: [],
  };

  const accentGold = materials.gildedGold;
  const accentBrass = materials.antiqueBrass;
  const silver = materials.burnishedSilver;
  const crystalDomeMat = materials.crystalPhial || createCaseGlassMaterial(0.32);

  const astrolabeTex = createEngravedDialTexture('astrolabe');
  const clockTex = createEngravedDialTexture('clock');
  const gaugeTex = createEngravedDialTexture('gauge');

  const astrolabeDialMat = new THREE.MeshStandardMaterial({
    color: astrolabeTex ? '#ffffff' : '#d2dce6',
    map: astrolabeTex,
    metalness: 0.65,
    roughness: 0.28,
  });
  const clockDialMat = new THREE.MeshStandardMaterial({
    color: clockTex ? '#ffffff' : '#e6dfd0',
    map: clockTex,
    metalness: 0.22,
    roughness: 0.38,
  });
  const gaugeDialMat = new THREE.MeshStandardMaterial({
    color: gaugeTex ? '#ffffff' : '#dbe3ea',
    map: gaugeTex,
    metalness: 0.45,
    roughness: 0.32,
  });

  // Contraption 1: Interlocking Astrolabe Gimbal Gyroscope with Engraved Dial & Exhaust Chimney (`table-silver-1`)
  if (silverTables[0]) {
    const t = silverTables[0];
    const contraption = new THREE.Group();
    contraption.name = 'SilverInstrument_Gyroscope';
    contraption.position.set(t.x, t.topY, t.z);
    contraption.rotation.y = t.rotationY;
    group.add(contraption);

    const baseProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.125, 0.0),
      new THREE.Vector2(0.125, 0.016),
      new THREE.Vector2(0.105, 0.028),
      new THREE.Vector2(0.044, 0.055),
      new THREE.Vector2(0.022, 0.115),
      new THREE.Vector2(0.036, 0.128),
      new THREE.Vector2(0.016, 0.148),
      new THREE.Vector2(0.0, 0.148),
    ];
    const pedestal = new THREE.Mesh(new THREE.LatheGeometry(baseProfile, 32), silver);
    contraption.add(pedestal);

    // Engraved silver astrolabe horizon dial inlaid onto base flange
    const baseDial = new THREE.Mesh(new THREE.RingGeometry(0.048, 0.102, 32), astrolabeDialMat);
    baseDial.rotation.x = -Math.PI * 0.5;
    baseDial.position.y = 0.029;
    contraption.add(baseDial);

    const brassCollar = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 10, 24), accentBrass);
    brassCollar.rotation.x = Math.PI * 0.5;
    brassCollar.position.y = 0.128;
    contraption.add(brassCollar);

    // ExtrudeGeometry toothed azimuth drive gear on lower pedestal
    const azimuthGear = new THREE.Mesh(createToothedGearGeometry(0.068, 16, 0.008, 6), accentBrass);
    azimuthGear.position.y = 0.068;
    contraption.add(azimuthGear);
    animTargets.alembicDials.push({ mesh: azimuthGear, axis: 'y', speed: 0.55 });

    // Ornate U-cradle supporting the gimbal rings + pointed finials
    const cradleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.158, 0.305, 0),
      new THREE.Vector3(-0.148, 0.182, 0),
      new THREE.Vector3(0, 0.14, 0),
      new THREE.Vector3(0.148, 0.182, 0),
      new THREE.Vector3(0.158, 0.305, 0),
    ]);
    const cradle = new THREE.Mesh(new THREE.TubeGeometry(cradleCurve, 32, 0.009, 10, false), silver);
    contraption.add(cradle);

    for (const s of [-1, 1]) {
      const finialStem = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.012, 0.008),
        new THREE.Vector2(0.008, 0.024),
        new THREE.Vector2(0.014, 0.032),
        new THREE.Vector2(0.003, 0.052),
        new THREE.Vector2(0.0, 0.058),
      ], 14), accentGold);
      finialStem.position.set(s * 0.158, 0.305, 0);
      contraption.add(finialStem);
    }

    // Nested delicate gimbal rings with orthogonal tiny pivot screws & pointers
    const centerY = 0.305;
    const ringSpecs = [
      { r: 0.142, tube: 0.0065, mat: silver, tiltX: 0.22, tiltZ: 0.08, speed: [0.65, 0.9, 0.0] },
      { r: 0.114, tube: 0.0058, mat: accentBrass, tiltX: -0.58, tiltZ: 0.42, speed: [-1.1, 0.5, 0.7] },
      { r: 0.086, tube: 0.0052, mat: silver, tiltX: 0.85, tiltZ: -0.48, speed: [0.4, -1.6, 0.95] },
      { r: 0.060, tube: 0.0042, mat: accentGold, tiltX: -0.35, tiltZ: 0.75, speed: [-1.3, -0.8, 1.4] },
    ];
    for (const spec of ringSpecs) {
      const pivot = new THREE.Group();
      pivot.position.set(0, centerY, 0);
      pivot.rotation.set(spec.tiltX, 0, spec.tiltZ);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.r, spec.tube, 12, 48), spec.mat);
      pivot.add(ring);

      // Tiny watchmaker pivot screws & collars on opposite gimbal axes
      for (const s of [-1, 1]) {
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 10), accentGold);
        collar.rotation.z = Math.PI * 0.5;
        collar.position.set(s * spec.r, 0, 0);
        pivot.add(collar);

        const screwHead = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.005, 8), silver);
        screwHead.rotation.z = Math.PI * 0.5;
        screwHead.position.set(s * (spec.r + 0.011), 0, 0);
        pivot.add(screwHead);
      }
      contraption.add(pivot);
      animTargets.gyroRings.push({ pivot, speed: spec.speed });
    }

    // Core faceted star-sphere with tiny astrolabe ring
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), silver);
    core.position.set(0, centerY, 0);
    contraption.add(core);
    animTargets.gyroRings.push({ pivot: core, speed: [1.2, 2.1, 0.8] });

    // Miniature silver exhaust chimney at back of plinth puffing soft steam wisps
    const chimney = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.014, 0.0),
      new THREE.Vector2(0.011, 0.06),
      new THREE.Vector2(0.009, 0.14),
      new THREE.Vector2(0.016, 0.16),
      new THREE.Vector2(0.012, 0.16),
    ], 16), silver);
    chimney.position.set(0, 0.025, -0.095);
    contraption.add(chimney);

    smokeEmitters.push(createSmokeEmitter(contraption, new THREE.Vector3(0, 0.19, -0.095), {
      count: 5,
      baseScale: 0.015,
      riseHeight: 0.28,
      opacity: 0.24,
    }));
  }

  // Contraption 2: Watchmaker Clockwork Tower, Extruded Meshed Gears, Engraved Dial & Governor (`table-silver-2`)
  if (silverTables[1]) {
    const t = silverTables[1];
    const contraption = new THREE.Group();
    contraption.name = 'SilverInstrument_ClockworkSpindles';
    contraption.position.set(t.x, t.topY, t.z);
    contraption.rotation.y = t.rotationY;
    group.add(contraption);

    const plinth = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.145, 0.0),
      new THREE.Vector2(0.142, 0.016),
      new THREE.Vector2(0.128, 0.028),
      new THREE.Vector2(0.0, 0.028),
    ], 32), silver);
    contraption.add(plinth);

    const upperDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.104, 0.012, 32), accentBrass);
    upperDeck.position.y = 0.148;
    contraption.add(upperDeck);

    // 4 turned silver watchmaker pillars with brass collars
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const pillar = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.011, 0.0),
        new THREE.Vector2(0.008, 0.02),
        new THREE.Vector2(0.007, 0.10),
        new THREE.Vector2(0.011, 0.12),
      ], 12), silver);
      pillar.position.set(Math.cos(a) * 0.088, 0.028, Math.sin(a) * 0.088);
      contraption.add(pillar);
    }

    // Engraved Watchmaker Clock Dial Face mounted vertically on front chassis (+Z)
    const dialBezel = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.006, 10, 28), accentGold);
    dialBezel.position.set(0, 0.088, 0.098);
    contraption.add(dialBezel);

    const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.045, 28), clockDialMat);
    dialFace.position.set(0, 0.088, 0.097);
    contraption.add(dialFace);

    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.024, 0.002), accentBrass);
    hourHand.geometry.translate(0, 0.01, 0);
    hourHand.position.set(0, 0.088, 0.0995);
    contraption.add(hourHand);
    animTargets.alembicDials.push({ mesh: hourHand, axis: 'z', speed: -0.35 });

    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.036, 0.002), silver);
    minHand.geometry.translate(0, 0.016, 0);
    minHand.position.set(0, 0.088, 0.101);
    contraption.add(minHand);
    animTargets.alembicDials.push({ mesh: minHand, axis: 'z', speed: -2.1 });

    // Central rotating spindle & helical coil
    const spindleGroup = new THREE.Group();
    spindleGroup.position.y = 0.028;
    contraption.add(spindleGroup);
    animTargets.spindleGroup = spindleGroup;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.40, 14), silver);
    shaft.position.y = 0.20;
    spindleGroup.add(shaft);

    const helixPts = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const ang = u * Math.PI * 6;
      const rad = 0.024 + Math.sin(u * Math.PI) * 0.026;
      helixPts.push(new THREE.Vector3(Math.cos(ang) * rad, 0.155 + u * 0.175, Math.sin(ang) * rad));
    }
    const helixMesh = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 48, 0.0045, 8, false),
      silver
    );
    spindleGroup.add(helixMesh);

    // Real ExtrudeGeometry toothed spoked gears
    const mainGear = new THREE.Mesh(createToothedGearGeometry(0.064, 18, 0.01, 6), accentBrass);
    mainGear.position.y = 0.048;
    spindleGroup.add(mainGear);

    const upperGear = new THREE.Mesh(createToothedGearGeometry(0.046, 12, 0.008, 5), silver);
    upperGear.position.y = 0.098;
    spindleGroup.add(upperGear);

    // Meshed counter-spinning pinion gears on left & right flanks
    const pinionR = new THREE.Mesh(createToothedGearGeometry(0.036, 10, 0.009, 4), silver);
    pinionR.position.set(0.086, 0.076, 0);
    contraption.add(pinionR);
    animTargets.alembicDials.push({ mesh: pinionR, axis: 'y', speed: -3.4 });

    const pinionVert = new THREE.Mesh(createToothedGearGeometry(0.040, 14, 0.008, 5), accentGold);
    pinionVert.rotation.x = Math.PI * 0.5;
    pinionVert.position.set(-0.065, 0.088, -0.025);
    contraption.add(pinionVert);
    animTargets.alembicDials.push({ mesh: pinionVert, axis: 'z', speed: 2.6 });

    // Centrifugal governor arms with turned brass bobs
    for (const dir of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(0, 0.355, 0);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.115, 8), silver);
      rod.position.set(dir * 0.036, -0.044, 0);
      rod.rotation.z = dir * 0.55;
      armPivot.add(rod);
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), accentGold);
      bob.position.set(dir * 0.068, -0.086, 0);
      armPivot.add(bob);
      spindleGroup.add(armPivot);
      animTargets.governorArms.push({ pivot: armPivot, dir });
    }

    const finial = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.016, 0.0),
      new THREE.Vector2(0.018, 0.012),
      new THREE.Vector2(0.006, 0.036),
      new THREE.Vector2(0.0, 0.062),
    ], 14), silver);
    finial.position.y = 0.398;
    spindleGroup.add(finial);

    // Side silver exhaust chimney puffing soft steam
    const sidePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.11, 12), silver);
    sidePipe.position.set(-0.095, 0.20, -0.04);
    contraption.add(sidePipe);
    smokeEmitters.push(createSmokeEmitter(contraption, new THREE.Vector3(-0.095, 0.26, -0.04), {
      count: 5,
      baseScale: 0.014,
      riseHeight: 0.28,
      opacity: 0.25,
    }));
  }

  // Contraption 3: Refractive Glass-Bell-Domed Oscillating Twin Silver Pendulums (`table-silver-3`)
  if (silverTables[2]) {
    const t = silverTables[2];
    const contraption = new THREE.Group();
    contraption.name = 'SilverInstrument_TwinPendulums';
    contraption.position.set(t.x, t.topY, t.z);
    contraption.rotation.y = t.rotationY;
    group.add(contraption);

    // Stepped circular watchmaker plinth (y = 0 flush on table)
    const plinth = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.168, 0.0),
      new THREE.Vector2(0.168, 0.016),
      new THREE.Vector2(0.155, 0.028),
      new THREE.Vector2(0.142, 0.032),
      new THREE.Vector2(0.0, 0.032),
    ], 36), silver);
    contraption.add(plinth);

    const bezelRing = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.0065, 10, 36), accentBrass);
    bezelRing.rotation.x = Math.PI * 0.5;
    bezelRing.position.y = 0.032;
    contraption.add(bezelRing);

    // Arched double-column silver bridge inside dome
    for (const sx of [-0.085, 0.085]) {
      const col = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.012, 0.0),
        new THREE.Vector2(0.008, 0.03),
        new THREE.Vector2(0.007, 0.30),
        new THREE.Vector2(0.012, 0.33),
      ], 12), silver);
      col.position.set(sx, 0.032, 0);
      contraption.add(col);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), accentBrass);
      cap.position.set(sx, 0.366, 0);
      contraption.add(cap);
    }

    const topCrossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.19, 10), silver);
    topCrossbar.rotation.z = Math.PI * 0.5;
    topCrossbar.position.y = 0.345;
    contraption.add(topCrossbar);

    // Engraved escape wheel gear visible behind the crossbar
    const escapeWheel = new THREE.Mesh(createToothedGearGeometry(0.044, 15, 0.006, 5), accentGold);
    escapeWheel.rotation.x = Math.PI * 0.5;
    escapeWheel.position.set(0, 0.305, -0.028);
    contraption.add(escapeWheel);
    animTargets.alembicDials.push({ mesh: escapeWheel, axis: 'z', speed: 1.75 });

    // Graduated silver arc scale behind pendulums
    const arcScale = new THREE.Mesh(
      new THREE.RingGeometry(0.138, 0.16, 28, 1, Math.PI * 1.18, Math.PI * 0.64),
      astrolabeDialMat
    );
    arcScale.position.set(0, 0.345, -0.022);
    contraption.add(arcScale);

    // Counter-oscillating twin silver & brass pendulums
    for (let i = 0; i < 2; i++) {
      const zOff = i === 0 ? 0.018 : -0.012;
      const pendPivot = new THREE.Group();
      pendPivot.position.set(0, 0.345, zOff);

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.225, 8), silver);
      rod.position.y = -0.1125;
      pendPivot.add(rod);

      const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.011, 20), i === 0 ? silver : accentBrass);
      bob.rotation.x = Math.PI * 0.5;
      bob.position.y = -0.228;
      pendPivot.add(bob);

      const needleTip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.032, 8), accentGold);
      needleTip.rotation.z = Math.PI;
      needleTip.position.y = -0.256;
      pendPivot.add(needleTip);

      contraption.add(pendPivot);
      animTargets.pendulums.push({ pivot: pendPivot, phase: i * Math.PI, freq: 2.35 + i * 0.15, amp: 0.32 });
    }

    // Optical refractive glass bell dome enclosing the pendulum assembly cleanly
    const domePts = [];
    const domeR = 0.14;
    const cylH = 0.32;
    domePts.push(new THREE.Vector2(domeR, 0.032));
    domePts.push(new THREE.Vector2(domeR, 0.032 + cylH));
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI * 0.5);
      domePts.push(new THREE.Vector2(Math.cos(a) * domeR, 0.032 + cylH + Math.sin(a) * (domeR * 0.88)));
    }
    const glassBellDome = new THREE.Mesh(new THREE.LatheGeometry(domePts, 36), crystalDomeMat);
    glassBellDome.renderOrder = 4;
    glassBellDome.userData.noShadow = true;
    contraption.add(glassBellDome);

    // Finial crown atop the glass bell dome
    const domeFinial = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.022, 0.0),
      new THREE.Vector2(0.016, 0.012),
      new THREE.Vector2(0.009, 0.026),
      new THREE.Vector2(0.014, 0.034),
      new THREE.Vector2(0.0, 0.056),
    ], 16), accentGold);
    domeFinial.position.y = 0.032 + cylH + domeR * 0.88;
    contraption.add(domeFinial);

    // Miniature rocking silver balance beam mounted on rear brass bracket
    const postCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.032, -0.155),
      new THREE.Vector3(0, 0.18, -0.172),
      new THREE.Vector3(0, 0.36, -0.165),
    ]);
    const backPost = new THREE.Mesh(new THREE.TubeGeometry(postCurve, 14, 0.006, 8, false), silver);
    contraption.add(backPost);

    const beamPivot = new THREE.Group();
    beamPivot.position.set(0, 0.36, -0.165);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.14, 8), silver);
    beam.rotation.z = Math.PI * 0.5;
    beamPivot.add(beam);
    for (const side of [-1, 1]) {
      const pan = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.01, 12), accentBrass);
      pan.rotation.x = Math.PI;
      pan.position.set(side * 0.068, -0.036, 0);
      beamPivot.add(pan);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.036, 6), silver);
      wire.position.set(side * 0.068, -0.018, 0);
      beamPivot.add(wire);
    }
    contraption.add(beamPivot);
    animTargets.balanceBeam = beamPivot;

    // Rear silver micro-exhaust pipe emitting gentle smoke wisps
    const microPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.09, 10), silver);
    microPipe.position.set(0.095, 0.077, -0.11);
    contraption.add(microPipe);
    smokeEmitters.push(createSmokeEmitter(contraption, new THREE.Vector3(0.095, 0.125, -0.11), {
      count: 4,
      baseScale: 0.013,
      riseHeight: 0.24,
      opacity: 0.22,
    }));
  }

  // Contraption 4: Silver Alembic Retort with Pressure Gauge Dial, Gear & Crystal Receiver (`table-silver-4`)
  if (silverTables[3]) {
    const t = silverTables[3];
    const contraption = new THREE.Group();
    contraption.name = 'SilverInstrument_AlembicFunnel';
    contraption.position.set(t.x, t.topY, t.z);
    contraption.rotation.y = t.rotationY;
    group.add(contraption);

    const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.009, 10, 28), accentBrass);
    footRing.rotation.x = Math.PI * 0.5;
    footRing.position.y = 0.01;
    contraption.add(footRing);

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.092, 0.008, Math.sin(a) * 0.092),
        new THREE.Vector3(Math.cos(a) * 0.082, 0.045, Math.sin(a) * 0.082),
        new THREE.Vector3(Math.cos(a) * 0.056, 0.082, Math.sin(a) * 0.056),
      ]);
      const leg = new THREE.Mesh(new THREE.TubeGeometry(legCurve, 12, 0.0065, 8, false), accentBrass);
      contraption.add(leg);
    }

    // Bulbous silver alembic retort + slender exhaust chimney spout
    const alembicProfile = [
      new THREE.Vector2(0.0, 0.068),
      new THREE.Vector2(0.058, 0.074),
      new THREE.Vector2(0.088, 0.128),
      new THREE.Vector2(0.079, 0.188),
      new THREE.Vector2(0.032, 0.238),
      new THREE.Vector2(0.015, 0.305),
      new THREE.Vector2(0.013, 0.378),
      new THREE.Vector2(0.035, 0.415),
      new THREE.Vector2(0.030, 0.418),
      new THREE.Vector2(0.010, 0.378),
    ];
    const alembicBody = new THREE.Mesh(new THREE.LatheGeometry(alembicProfile, 30), silver);
    contraption.add(alembicBody);

    // Brass waist band + ExtrudeGeometry toothed regulator wheel
    const waistBand = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.005, 10, 28), accentBrass);
    waistBand.rotation.x = Math.PI * 0.5;
    waistBand.position.y = 0.145;
    contraption.add(waistBand);

    const regulatorGear = new THREE.Mesh(createToothedGearGeometry(0.042, 12, 0.007, 4), accentGold);
    regulatorGear.rotation.z = Math.PI * 0.5;
    regulatorGear.position.set(-0.094, 0.145, 0);
    contraption.add(regulatorGear);
    animTargets.alembicDials.push({ mesh: regulatorGear, axis: 'x', speed: 2.8 });

    // Engraved silver pressure gauge dial mounted on front belly (+Z)
    const gaugeRim = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0045, 8, 24), accentBrass);
    gaugeRim.position.set(0, 0.145, 0.086);
    contraption.add(gaugeRim);

    const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(0.029, 24), gaugeDialMat);
    gaugeFace.position.set(0, 0.145, 0.085);
    contraption.add(gaugeFace);

    const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.022, 0.002), accentGold);
    gaugeNeedle.geometry.translate(0, 0.008, 0);
    gaugeNeedle.position.set(0, 0.145, 0.0875);
    contraption.add(gaugeNeedle);
    animTargets.alembicDials.push({ mesh: gaugeNeedle, axis: 'z', speed: 3.6, oscillate: true });

    // Coiled condenser tube curving into faceted optical crystal receiver bulb
    const tubeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.035, 0.215, 0),
      new THREE.Vector3(0.095, 0.225, 0.045),
      new THREE.Vector3(0.115, 0.165, -0.035),
      new THREE.Vector3(0.088, 0.115, 0.045),
      new THREE.Vector3(0.125, 0.082, 0.0),
    ]);
    const condenserTube = new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 36, 0.0055, 8, false), silver);
    contraption.add(condenserTube);

    const receiverFlask = new THREE.Mesh(
      new THREE.LatheGeometry([
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.024, 0.0),
        new THREE.Vector2(0.038, 0.028),
        new THREE.Vector2(0.034, 0.056),
        new THREE.Vector2(0.014, 0.078),
      ], 10),
      materials.crystalPhial
    );
    receiverFlask.position.set(0.125, 0.0, 0);
    receiverFlask.renderOrder = 3;
    contraption.add(receiverFlask);

    const receiverCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.014, 12), accentBrass);
    receiverCap.position.set(0.125, 0.082, 0);
    contraption.add(receiverCap);

    smokeEmitters.push(
      createSmokeEmitter(contraption, new THREE.Vector3(0, 0.425, 0), {
        count: 8,
        color: '#e6eef5',
        edgeColor: '#98aabd',
        baseScale: 0.022,
        riseHeight: 0.42,
        speed: 0.52,
        opacity: 0.42,
      })
    );
  }

  tagCanonId(group, 'silver-instruments');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  let boostTimer = 0;

  const entry = registry.register({
    id: 'silver-instruments',
    name: 'Curious Silver Instruments',
    category: 'instrument',
    group,
    hitMeshes,
    cameraPos: [2.95, 1.68, 2.05],
    cameraTarget: silverTables[0]
      ? [silverTables[0].x, silverTables[0].topY + 0.24, silverTables[0].z]
      : [4.2, 1.15, 1.3],
    actions: ['pulse-smoke'],
    interact: () => {
      boostTimer = 4.0;
      return { whirringBoost: true, duration: 4.0 };
    },
    onUpdate: (dt, elapsed) => {
      if (boostTimer > 0) {
        boostTimer = Math.max(0, boostTimer - dt);
      }
      const boost = boostTimer > 0 ? 1.0 + 1.8 * Math.min(1, boostTimer) : 1.0;

      for (const r of animTargets.gyroRings) {
        r.pivot.rotation.x += dt * r.speed[0] * boost;
        r.pivot.rotation.y += dt * r.speed[1] * boost;
        r.pivot.rotation.z += dt * r.speed[2] * boost;
      }
      if (animTargets.spindleGroup) {
        animTargets.spindleGroup.rotation.y += dt * 1.9 * boost;
      }
      for (const arm of animTargets.governorArms) {
        arm.pivot.rotation.z = arm.dir * (0.12 + 0.14 * (boost - 1) + Math.sin(elapsed * 3.1) * 0.04);
      }
      for (const p of animTargets.pendulums) {
        p.pivot.rotation.z = Math.sin(elapsed * p.freq * (0.9 + 0.1 * boost) + p.phase) * p.amp;
      }
      if (animTargets.balanceBeam) {
        animTargets.balanceBeam.rotation.z = Math.sin(elapsed * 1.45) * 0.16;
      }
      for (const d of animTargets.alembicDials) {
        if (d.oscillate) {
          d.mesh.rotation[d.axis] = Math.sin(elapsed * d.speed * boost) * 0.95;
        } else {
          d.mesh.rotation[d.axis] += dt * d.speed * boost;
        }
      }
      for (const emitter of smokeEmitters) {
        emitter.update(dt, elapsed, boost);
      }
    },
    setEra: () => {
      group.visible = true;
    },
    metadata: {
      tableCount: silverTables.length,
    },
  });

  return { group, entry };
}

/**
 * Updates a pre-allocated tubular mesh along a 3D spine curve in-place without GC churn.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Vector3[]} spinePoints Length N
 * @param {number[]} radii Length N
 * @param {number} radialSegments
 */
function updateSerpentTubeGeometry(geometry, spinePoints, radii, radialSegments = 10) {
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const nPts = spinePoints.length;
  const ringVerts = radialSegments + 1;

  const tangent = new THREE.Vector3();
  const prevTangent = new THREE.Vector3();
  const refZ = new THREE.Vector3(0, 0, 1);
  const altRefX = new THREE.Vector3(1, 0, 0);
  const axis = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < nPts; i++) {
    const p = spinePoints[i];
    if (i === 0) {
      tangent.subVectors(spinePoints[1], p);
    } else if (i === nPts - 1) {
      tangent.subVectors(p, spinePoints[nPts - 2]);
    } else {
      tangent.subVectors(spinePoints[i + 1], spinePoints[i - 1]);
    }
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 1, 0);
    else tangent.normalize();

    if (i === 0) {
      const ref = Math.abs(tangent.z) > 0.92 ? altRefX : refZ;
      binormal.crossVectors(tangent, ref).normalize();
      normal.crossVectors(binormal, tangent).normalize();
    } else {
      axis.crossVectors(prevTangent, tangent);
      const axisLen = axis.length();
      if (axisLen > 1e-6) {
        axis.divideScalar(axisLen);
        const cosA = THREE.MathUtils.clamp(prevTangent.dot(tangent), -1, 1);
        normal.applyAxisAngle(axis, Math.acos(cosA));
      }
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      binormal.crossVectors(tangent, normal).normalize();
    }
    prevTangent.copy(tangent);

    const r = radii[i];
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const nx = normal.x * cosT + binormal.x * sinT;
      const ny = normal.y * cosT + binormal.y * sinT;
      const nz = normal.z * cosT + binormal.z * sinT;

      const idx = i * ringVerts + j;
      posAttr.setXYZ(idx, p.x + nx * r, p.y + ny * r, p.z + nz * r);
      normAttr.setXYZ(idx, nx, ny, nz);
    }
  }
  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
}

/**
 * Creates a pre-allocated indexed tubular BufferGeometry ready for dynamic in-place updates.
 */
function createDynamicTubeGeometry(spineCount, radialSegments = 10) {
  const ringVerts = radialSegments + 1;
  const vertCount = spineCount * ringVerts;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let i = 0; i < spineCount; i++) {
    const u = i / (spineCount - 1);
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const idx = i * ringVerts + j;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = v;
    }
  }
  for (let i = 0; i < spineCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds a stylized smoke-serpent head with curved viper snout, brow ridges, eyes, and curved forked tongue.
 */
function buildSmokeSerpentHead(bodyMat) {
  const head = new THREE.Group();
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), bodyMat);
  cranium.scale.set(1.08, 0.72, 1.32);
  cranium.userData.noRaycast = true;
  cranium.userData.noShadow = true;
  head.add(cranium);

  const snoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0.015),
    new THREE.Vector3(0, -0.002, 0.036),
    new THREE.Vector3(0, -0.006, 0.058),
  ]);
  const snout = new THREE.Mesh(
    createTaperedCurveGeometry(snoutCurve, 8, 10, (u) => ({
      rx: 0.022 * (1 - u * 0.62),
      ry: 0.015 * (1 - u * 0.58),
    })),
    bodyMat
  );
  snout.userData.noRaycast = true;
  snout.userData.noShadow = true;
  head.add(snout);

  const eyeMat = new THREE.MeshBasicMaterial({
    color: '#d9ffe6',
    transparent: true,
    opacity: 0.9,
  });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 8), eyeMat);
    eye.position.set(s * 0.017, 0.009, 0.025);
    eye.userData.noRaycast = true;
    head.add(eye);
  }

  const tongueMat = new THREE.MeshBasicMaterial({
    color: '#9cffc4',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  for (const s of [-1, 1]) {
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.006, 0.052),
      new THREE.Vector3(s * 0.002, -0.007, 0.068),
      new THREE.Vector3(s * 0.009, -0.005, 0.084),
    ]);
    const fork = new THREE.Mesh(new THREE.TubeGeometry(tCurve, 8, 0.0014, 5, false), tongueMat);
    fork.userData.noRaycast = true;
    fork.userData.noShadow = true;
    head.add(fork);
  }

  return { head, eyeMat, tongueMat };
}

/**
 * 2. OoP Ch. 22 Smoke-Serpent Silver Instrument (`smoke-serpent-instrument`):
 *    Mounted on `table-serpent` (`topY`). Watchmaker silver vessel with extruded toothed
 *    gears, engraved astrolabe ring, continuous pale-green smoke wisps, and interactive/OoP
 *    curling smoke serpent splitting into two coiled twin serpents.
 */
function buildSmokeSerpentInstrument(parent, materials, registry, layout) {
  const table = layout.SPINDLE_TABLES.find((t) => t.id === 'table-serpent') || layout.SPINDLE_TABLES[0];
  const group = new THREE.Group();
  group.name = 'SmokeSerpentInstrument';
  group.position.set(table.x, table.topY, table.z);
  group.rotation.y = table.rotationY;
  parent.add(group);

  const silver = materials.burnishedSilver;
  const brass = materials.antiqueBrass;
  const gold = materials.gildedGold;

  // Stepped turned silver plinth resting cleanly at y = 0
  const basePlate = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.136, 0.0),
    new THREE.Vector2(0.136, 0.012),
    new THREE.Vector2(0.118, 0.024),
    new THREE.Vector2(0.095, 0.026),
    new THREE.Vector2(0.0, 0.026),
  ], 32), silver);
  group.add(basePlate);

  // Engraved astrolabe dial collar on base deck
  const dialTex = createEngravedDialTexture('astrolabe');
  const dialRing = new THREE.Mesh(
    new THREE.RingGeometry(0.046, 0.094, 32),
    new THREE.MeshStandardMaterial({
      color: dialTex ? '#ffffff' : '#d2dce6',
      map: dialTex,
      metalness: 0.65,
      roughness: 0.28,
    })
  );
  dialRing.rotation.x = -Math.PI * 0.5;
  dialRing.position.y = 0.027;
  group.add(dialRing);

  // Real ExtrudeGeometry toothed brass drive gear + meshed silver pinion
  const brassGear = new THREE.Mesh(createToothedGearGeometry(0.082, 20, 0.011, 6), brass);
  brassGear.position.y = 0.038;
  group.add(brassGear);

  const sidePinion = new THREE.Mesh(createToothedGearGeometry(0.036, 10, 0.009, 4), silver);
  sidePinion.position.set(0.106, 0.038, 0);
  group.add(sidePinion);

  // Delicate arched struts framing a silver resonator chamber
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.098, 0.025, Math.sin(a) * 0.098),
      new THREE.Vector3(Math.cos(a) * 0.116, 0.125, Math.sin(a) * 0.116),
      new THREE.Vector3(Math.cos(a) * 0.034, 0.215, Math.sin(a) * 0.034),
    ]);
    const strut = new THREE.Mesh(new THREE.TubeGeometry(strutCurve, 18, 0.005, 8, false), silver);
    group.add(strut);
  }

  const chamber = new THREE.Mesh(new THREE.SphereGeometry(0.048, 20, 16), silver);
  chamber.position.y = 0.132;
  group.add(chamber);

  const chamberBand = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.005, 10, 28), gold);
  chamberBand.rotation.x = Math.PI * 0.5;
  chamberBand.position.y = 0.132;
  group.add(chamberBand);

  // Tiny gimbal pivot studs on chamber band
  for (const s of [-1, 1]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), brass);
    screw.rotation.z = Math.PI * 0.5;
    screw.position.set(s * 0.054, 0, 0);
    chamberBand.add(screw);
  }

  // Slender vertical spindle-funnel spout
  const funnelProfile = [
    new THREE.Vector2(0.028, 0.175),
    new THREE.Vector2(0.022, 0.215),
    new THREE.Vector2(0.012, 0.285),
    new THREE.Vector2(0.010, 0.365),
    new THREE.Vector2(0.032, 0.405),
    new THREE.Vector2(0.028, 0.408),
    new THREE.Vector2(0.008, 0.365),
  ];
  const funnel = new THREE.Mesh(new THREE.LatheGeometry(funnelProfile, 26), silver);
  group.add(funnel);

  tagCanonId(group, 'smoke-serpent-instrument');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  // Continuous subtle pale-green smoke puffing from the spout
  const continuousEmitter = createSmokeEmitter(group, new THREE.Vector3(0, 0.41, 0), {
    count: 6,
    color: '#b8ffd2',
    edgeColor: '#48b878',
    baseScale: 0.018,
    riseHeight: 0.34,
    speed: 0.46,
    opacity: 0.35,
  });

  // Dynamic twin-serpent smoke meshes (reused in-place, zero GC)
  const SPINE_LEN = 34;
  const RADIAL_SEGS = 10;
  const serpentMatA = createSerpentSmokeMaterial();
  const serpentMatB = createSerpentSmokeMaterial();

  const geoA = createDynamicTubeGeometry(SPINE_LEN, RADIAL_SEGS);
  const geoB = createDynamicTubeGeometry(SPINE_LEN, RADIAL_SEGS);
  const meshA = new THREE.Mesh(geoA, serpentMatA);
  const meshB = new THREE.Mesh(geoB, serpentMatB);
  meshA.frustumCulled = false;
  meshB.frustumCulled = false;
  meshA.userData.noRaycast = true;
  meshB.userData.noRaycast = true;
  meshA.userData.noShadow = true;
  meshB.userData.noShadow = true;
  meshA.renderOrder = 4;
  meshB.renderOrder = 4;
  meshA.visible = false;
  meshB.visible = false;
  group.add(meshA, meshB);

  const headA = buildSmokeSerpentHead(serpentMatA);
  const headB = buildSmokeSerpentHead(serpentMatB);
  headA.head.position.set(0, 0.42, 0);
  headB.head.position.set(0, 0.42, 0);
  headA.head.visible = false;
  headB.head.visible = false;
  group.add(headA.head, headB.head);

  const ptsA = Array.from({ length: SPINE_LEN }, () => new THREE.Vector3());
  const ptsB = Array.from({ length: SPINE_LEN }, () => new THREE.Vector3());
  const radiiA = new Array(SPINE_LEN).fill(0.01);
  const radiiB = new Array(SPINE_LEN).fill(0.01);
  const _forwardZ = new THREE.Vector3(0, 0, 1);
  const _headDirA = new THREE.Vector3();
  const _headDirB = new THREE.Vector3();

  const serpentLight = new THREE.PointLight('#6effaa', 0, 2.2, 1.8);
  serpentLight.position.set(0, 0.72, 0);
  serpentLight.visible = false;
  group.add(serpentLight);

  let serpentActive = false;
  let serpentAge = 0;
  const TOTAL_SERPENT_DURATION = 7.4;

  function triggerSmokeSerpent() {
    serpentActive = true;
    serpentAge = 0;
    meshA.visible = true;
    meshB.visible = true;
    headA.head.visible = true;
    headB.head.visible = true;
    return true;
  }

  function updateSerpentAnimation(dt, elapsed) {
    if (!serpentActive) {
      serpentLight.intensity = 0;
      serpentLight.visible = false;
      return;
    }

    serpentAge += dt;
    if (serpentAge >= TOTAL_SERPENT_DURATION) {
      serpentActive = false;
      meshA.visible = false;
      meshB.visible = false;
      headA.head.visible = false;
      headB.head.visible = false;
      serpentLight.intensity = 0;
      serpentLight.visible = false;
      return;
    }

    // Growth (0..1.7s), Split into twin serpents (1.8..3.4s), Coil & hover (3.4..5.4s), Dissipate (5.4..7.4s)
    const growT = THREE.MathUtils.smoothstep(serpentAge, 0.0, 1.75);
    const splitT = THREE.MathUtils.smoothstep(serpentAge, 1.85, 3.35);
    const fadeIn = THREE.MathUtils.smoothstep(serpentAge, 0.0, 0.45);
    const fadeOut = 1.0 - THREE.MathUtils.smoothstep(serpentAge, 5.4, TOTAL_SERPENT_DURATION);
    const overallOpacity = fadeIn * fadeOut * 0.92;
    const expandDissipate = 1.0 + THREE.MathUtils.smoothstep(serpentAge, 5.4, TOTAL_SERPENT_DURATION) * 0.65;

    const maxH = 0.08 + growT * 0.64;
    for (let i = 0; i < SPINE_LEN; i++) {
      const u = i / (SPINE_LEN - 1);
      const y = 0.40 + u * maxH;

      const trunkCurlX = Math.sin(u * Math.PI * 2.4 - elapsed * 2.8) * 0.045 * Math.sin(u * Math.PI);
      const trunkCurlZ = Math.cos(u * Math.PI * 2.1 - elapsed * 2.4) * 0.038 * u;

      const branchWeight = THREE.MathUtils.smoothstep(u, 0.34, 0.92) * splitT;
      const spreadX = 0.145 * branchWeight * expandDissipate;
      const helixPhase = u * Math.PI * 3.0 - elapsed * 3.1;
      const coilR = (0.042 + 0.024 * Math.sin(u * Math.PI)) * branchWeight;

      const ax = trunkCurlX - spreadX + Math.cos(helixPhase) * coilR;
      const az = trunkCurlZ + Math.sin(helixPhase) * coilR;

      const bx = trunkCurlX + spreadX - Math.cos(helixPhase) * coilR;
      const bz = trunkCurlZ - Math.sin(helixPhase) * coilR;

      ptsA[i].set(ax, y, az);
      ptsB[i].set(bx, y, bz);

      const baseR = (0.008 + Math.sin(u * Math.PI) * 0.017 + u * 0.008) * (0.65 + 0.35 * growT);
      radiiA[i] = baseR * expandDissipate;
      radiiB[i] = baseR * (0.55 + 0.45 * splitT) * expandDissipate;
    }

    updateSerpentTubeGeometry(geoA, ptsA, radiiA, RADIAL_SEGS);
    updateSerpentTubeGeometry(geoB, ptsB, radiiB, RADIAL_SEGS);

    const tip = ptsA[SPINE_LEN - 1];
    const prevA = ptsA[SPINE_LEN - 3];
    headA.head.position.copy(tip);
    _headDirA.subVectors(tip, prevA);
    _headDirA.x -= 0.25 * splitT;
    _headDirA.y = Math.max(0.05, _headDirA.y * 0.45);
    _headDirA.z += 0.55;
    _headDirA.normalize();
    headA.head.quaternion.setFromUnitVectors(_forwardZ, _headDirA);
    headA.head.scale.setScalar((0.75 + 0.35 * growT) * expandDissipate);

    const tipB = ptsB[SPINE_LEN - 1];
    const prevB = ptsB[SPINE_LEN - 3];
    headB.head.visible = splitT > 0.06;
    headB.head.position.copy(tipB);
    _headDirB.subVectors(tipB, prevB);
    _headDirB.x += 0.25 * splitT;
    _headDirB.y = Math.max(0.05, _headDirB.y * 0.45);
    _headDirB.z += 0.55;
    _headDirB.normalize();
    headB.head.quaternion.setFromUnitVectors(_forwardZ, _headDirB);
    headB.head.scale.setScalar((0.6 + 0.45 * splitT) * expandDissipate);

    serpentMatA.uniforms.uTime.value = elapsed;
    serpentMatA.uniforms.uOpacity.value = overallOpacity;
    serpentMatB.uniforms.uTime.value = elapsed + 1.4;
    serpentMatB.uniforms.uOpacity.value = overallOpacity * Math.max(0.0, splitT);

    headA.eyeMat.opacity = overallOpacity;
    headA.tongueMat.opacity = overallOpacity * 0.85;
    headB.eyeMat.opacity = overallOpacity * splitT;
    headB.tongueMat.opacity = overallOpacity * splitT * 0.85;

    serpentLight.intensity = overallOpacity * 1.15;
    serpentLight.visible = serpentLight.intensity > 0.01;
  }

  let currentEra = 'cos';

  const entry = registry.register({
    id: 'smoke-serpent-instrument',
    name: 'Delicate Smoke-Serpent Silver Instrument',
    category: 'instrument',
    group,
    hitMeshes,
    cameraPos: [1.85, 1.72, 1.85],
    cameraTarget: [table.x, table.topY + 0.42, table.z],
    actions: ['tap-instrument'],
    interact: () => {
      triggerSmokeSerpent();
      return { serpentTriggered: true, message: 'Naturally, naturally... But in essence divided?' };
    },
    onUpdate: (dt, elapsed) => {
      const rate = serpentActive ? 2.4 : 0.7;
      brassGear.rotation.y += dt * rate;
      sidePinion.rotation.y -= dt * rate * 2.0;
      chamberBand.rotation.z = Math.sin(elapsed * 1.5) * 0.14;
      continuousEmitter.update(dt, elapsed, serpentActive ? 1.5 : 1.0);
      updateSerpentAnimation(dt, elapsed);
    },
    setEra: (eraId) => {
      const prevEra = currentEra;
      currentEra = eraId;
      group.visible = eraId === 'oop' || eraId === 'hbp' || eraId === 'dh';
      if (eraId === 'oop' && prevEra !== 'oop' && !serpentActive) {
        triggerSmokeSerpent();
      }
    },
  });

  return { group, entry, triggerSmokeSerpent };
}

/**
 * 3. Lunascope (`lunascope`):
 *    Mounted on `table-lunascope` (`topY`). Delicate brass-and-silver moon-phase
 *    astronomical instrument with engraved lunar dial, toothed elevation gear,
 *    nested gimbal pivots & pointed finials (OoP Ch. 37 — NOT a lunar chart). Visible in `oop`.
 */
function buildLunascope(parent, materials, registry, layout) {
  const table = layout.SPINDLE_TABLES.find((t) => t.id === 'table-lunascope') || layout.SPINDLE_TABLES[5];
  const group = new THREE.Group();
  group.name = 'Lunascope';
  group.position.set(table.x, table.topY, table.z);
  group.rotation.y = table.rotationY;
  parent.add(group);

  const brass = materials.antiqueBrass;
  const silver = materials.burnishedSilver;
  const gold = materials.gildedGold;

  // Stepped octagonal-round brass base (y = 0 flush on table)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.138, 0.024, 8), brass);
  base.position.y = 0.012;
  group.add(base);

  const lunarTex = createEngravedDialTexture('lunar');
  const lunarDial = new THREE.Mesh(
    new THREE.RingGeometry(0.03, 0.108, 32),
    new THREE.MeshStandardMaterial({
      color: lunarTex ? '#ffffff' : '#d5dde7',
      map: lunarTex,
      metalness: 0.55,
      roughness: 0.3,
    })
  );
  lunarDial.rotation.x = -Math.PI * 0.5;
  lunarDial.position.y = 0.025;
  group.add(lunarDial);

  const stem = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.032, 0.024),
    new THREE.Vector2(0.024, 0.045),
    new THREE.Vector2(0.018, 0.085),
    new THREE.Vector2(0.028, 0.115),
    new THREE.Vector2(0.018, 0.145),
  ], 20), brass);
  group.add(stem);

  // Toothed brass elevation gear under cradle
  const elevationGear = new THREE.Mesh(createToothedGearGeometry(0.052, 14, 0.008, 5), gold);
  elevationGear.position.y = 0.072;
  group.add(elevationGear);

  // Silver lunar-phase horizon dial ring
  const horizonRing = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.008, 10, 40), silver);
  horizonRing.rotation.x = Math.PI * 0.5;
  horizonRing.position.y = 0.245;
  group.add(horizonRing);

  // Calibrated moon-phase studs + pointed finials around horizon ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pip = new THREE.Mesh(new THREE.OctahedronGeometry(0.008, 0), i % 2 === 0 ? gold : silver);
    pip.position.set(Math.cos(a) * 0.142, 0.252, Math.sin(a) * 0.142);
    group.add(pip);
  }

  // Brass meridian cradle arc with top finial
  const meridianArc = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.0075, 10, 36, Math.PI * 1.15), brass);
  meridianArc.position.y = 0.245;
  meridianArc.rotation.z = -Math.PI * 0.075 - Math.PI * 0.5;
  group.add(meridianArc);

  const topFinial = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.012, 0.0),
    new THREE.Vector2(0.008, 0.015),
    new THREE.Vector2(0.003, 0.035),
    new THREE.Vector2(0.0, 0.044),
  ], 12), gold);
  topFinial.position.y = 0.382;
  group.add(topFinial);

  // Rotating tilted celestial assembly holding the two-tone moon globe
  const moonPivot = new THREE.Group();
  moonPivot.position.y = 0.245;
  moonPivot.rotation.z = 0.36;
  group.add(moonPivot);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.005, 10, 36), silver);
  moonPivot.add(innerRing);

  for (const s of [-1, 1]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), gold);
    screw.rotation.z = Math.PI * 0.5;
    screw.position.set(s * 0.105, 0, 0);
    moonPivot.add(screw);
  }

  const axisPin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 8), gold);
  moonPivot.add(axisPin);

  // Two-tone Moon Globe: illuminated pale silver waxing half + dark cratered obsidian half
  const litMoonMat = new THREE.MeshStandardMaterial({
    color: '#edf4ff',
    emissive: '#9db8db',
    emissiveIntensity: 0.28,
    roughness: 0.38,
    metalness: 0.25,
  });
  const darkMoonMat = new THREE.MeshStandardMaterial({
    color: '#252a34',
    roughness: 0.72,
    metalness: 0.2,
  });

  const moonCore = new THREE.Group();
  const litHalf = new THREE.Mesh(new THREE.SphereGeometry(0.056, 22, 16, 0, Math.PI), litMoonMat);
  const darkHalf = new THREE.Mesh(new THREE.SphereGeometry(0.056, 22, 16, Math.PI, Math.PI), darkMoonMat);
  moonCore.add(litHalf, darkHalf);
  moonPivot.add(moonCore);

  // Orbiting miniature lunar phase pointer ring
  const phaseRingPivot = new THREE.Group();
  phaseRingPivot.position.y = 0.245;
  const pointerRing = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.004, 8, 32), gold);
  pointerRing.rotation.x = Math.PI * 0.35;
  phaseRingPivot.add(pointerRing);
  const pointerMoon = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), silver);
  pointerMoon.position.set(0.082, 0, 0);
  phaseRingPivot.add(pointerMoon);
  group.add(phaseRingPivot);

  tagCanonId(group, 'lunascope');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  let inspectSpinTimer = 0;

  const entry = registry.register({
    id: 'lunascope',
    name: 'Lunascope',
    category: 'instrument',
    group,
    hitMeshes,
    cameraPos: [-2.65, 1.55, -1.05],
    cameraTarget: [table.x, table.topY + 0.24, table.z],
    actions: ['inspect-lunascope'],
    interact: () => {
      inspectSpinTimer = 2.8;
      return { inspected: true, note: 'Moon-phase lunascope rotating' };
    },
    onUpdate: (dt) => {
      if (inspectSpinTimer > 0) inspectSpinTimer = Math.max(0, inspectSpinTimer - dt);
      const speedMult = inspectSpinTimer > 0 ? 1.0 + 3.2 * Math.min(1, inspectSpinTimer) : 1.0;
      moonCore.rotation.y += dt * 0.45 * speedMult;
      innerRing.rotation.y -= dt * 0.28 * speedMult;
      phaseRingPivot.rotation.y += dt * 0.65 * speedMult;
      elevationGear.rotation.y += dt * 0.22 * speedMult;
    },
    setEra: (eraId) => {
      group.visible = eraId === 'oop';
    },
  });

  return { group, entry };
}

/**
 * 4. Marvolo Gaunt's Cracked Ring (`gaunt-ring`):
 *    Mounted on `table-gaunt-ring` (`topY`), visible ONLY in `hbp` era (HBP Ch. 10).
 *    Heavy heirloom gold band resting flat/reclined cleanly on table top, set with a
 *    heavy black stone showing a jagged crack down the middle.
 */
function buildGauntRing(parent, materials, registry, layout) {
  const table = layout.SPINDLE_TABLES.find((t) => t.id === 'table-gaunt-ring') || layout.SPINDLE_TABLES[3];
  const group = new THREE.Group();
  group.name = 'MarvoloGauntRing';
  group.position.set(table.x, table.topY, table.z);
  group.rotation.y = table.rotationY + 0.35;
  parent.add(group);

  const goldMat = materials.gildedGold;

  // Heavy gold signet ring resting squarely at local y >= 0 on the spindle table
  const ringAssembly = new THREE.Group();
  ringAssembly.position.set(0, 0.0431, 0);
  ringAssembly.rotation.set(0.42, 0.22, 0.04);
  group.add(ringAssembly);

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0085, 14, 32), goldMat);
  ringAssembly.add(band);

  // Heavy carved octagonal gold bezel setting atop the band (+Y crown)
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.017, 0.014, 8), goldMat);
  bezel.position.set(0, 0.035, 0);
  ringAssembly.add(bezel);

  // Heavy black Resurrection Stone split cleanly into two halves with a jagged fissure
  const blackStoneMat = new THREE.MeshPhysicalMaterial({
    color: '#0e1015',
    roughness: 0.22,
    metalness: 0.14,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
  });

  const makeCrackedStoneHalf = (side) => {
    const shape = new THREE.Shape();
    if (side < 0) {
      shape.moveTo(-0.016, -0.014);
      shape.lineTo(-0.0018, -0.014);
      shape.lineTo(-0.0038, -0.005);
      shape.lineTo(0.0005, 0.002);
      shape.lineTo(-0.0028, 0.009);
      shape.lineTo(-0.0012, 0.014);
      shape.lineTo(-0.016, 0.014);
      shape.lineTo(-0.019, 0.0);
      shape.closePath();
    } else {
      shape.moveTo(0.0014, -0.014);
      shape.lineTo(0.016, -0.014);
      shape.lineTo(0.019, 0.0);
      shape.lineTo(0.016, 0.014);
      shape.lineTo(0.0018, 0.014);
      shape.lineTo(0.0002, 0.009);
      shape.lineTo(0.0034, 0.002);
      shape.lineTo(-0.0008, -0.005);
      shape.closePath();
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.009,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.0018,
      bevelThickness: 0.002,
    });
    return new THREE.Mesh(geo, blackStoneMat);
  };

  const stoneHolder = new THREE.Group();
  stoneHolder.position.set(0, 0.041, 0);
  stoneHolder.rotation.x = -Math.PI * 0.5;
  ringAssembly.add(stoneHolder);

  const leftHalf = makeCrackedStoneHalf(-1);
  const rightHalf = makeCrackedStoneHalf(1);
  stoneHolder.add(leftHalf, rightHalf);

  const crackGlowMat = new THREE.MeshBasicMaterial({ color: '#3b2e1b' });
  const crackSeam = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.026, 0.005), crackGlowMat);
  crackSeam.position.z = 0.004;
  stoneHolder.add(crackSeam);

  tagCanonId(group, 'gaunt-ring');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  let inspectPulse = 0;

  const entry = registry.register({
    id: 'gaunt-ring',
    name: "Marvolo Gaunt's Cracked Ring",
    category: 'artifact',
    group,
    hitMeshes,
    cameraPos: [1.72, 1.18, -2.85],
    cameraTarget: [table.x, table.topY + 0.035, table.z],
    actions: ['inspect-ring'],
    interact: () => {
      inspectPulse = 2.0;
      return { ringVisible: group.visible, crackedStone: true };
    },
    onUpdate: (dt) => {
      if (inspectPulse > 0) {
        inspectPulse = Math.max(0, inspectPulse - dt);
        ringAssembly.rotation.y += dt * 1.4;
      } else {
        ringAssembly.rotation.y = 0.2;
      }
    },
    setEra: (eraId) => {
      group.visible = eraId === 'hbp';
    },
  });

  return { group, entry };
}

/**
 * 5. The Sorting Hat (`sorting-hat`):
 *    Sitting squarely on `layout.SORTING_HAT_SHELF` (`y = 2.06`).
 *    High-resolution (`64×48`) unified sculpted leather/felt wizard hat mesh with:
 *    - asymmetric slumped droop & crinkled conical spire,
 *    - wavy frayed wide brim with genuine leather thickness resting flush at y >= 0,
 *    - deep expressive sculpted brow folds above a recessed organic vertex-deformed
 *      talking mouth tear (ZERO blocky BoxGeometry lips!),
 *    - dark inner leather throat lining, curved leather mend patches & twine stitch tubes.
 */
function buildSortingHat(parent, materials, registry, layout) {
  const shelf = layout.SORTING_HAT_SHELF;
  const group = new THREE.Group();
  group.name = 'SortingHat';
  group.position.set(shelf.hatPos[0], shelf.hatPos[1], shelf.hatPos[2]);
  group.rotation.y = shelf.rotationY;
  parent.add(group);

  const hatMat = materials.sortingHatLeather;

  const SEG_U = 64; // circumferential resolution
  const SEG_V = 48; // profile stations from brim underside -> brim edge -> mouth tear -> brow -> slumped spire tip
  const MOUTH_LOWER_V = 22;
  const MOUTH_UPPER_V = 23;
  const MOUTH_HALF_ANG = 0.56; // +/- ~32 degrees around front +Z (theta = PI/2)

  const cols = SEG_U + 1;
  const rows = SEG_V + 1;
  const vertCount = cols * rows;

  const basePositions = new Float32Array(vertCount * 3);
  const flexDeltas = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const mouthMasks = new Float32Array(cols);
  const indices = [];

  for (let iu = 0; iu <= SEG_U; iu++) {
    const theta = (iu / SEG_U) * Math.PI * 2;
    const dTheta = Math.atan2(Math.sin(theta - Math.PI * 0.5), Math.cos(theta - Math.PI * 0.5));
    const absD = Math.abs(dTheta);
    mouthMasks[iu] = absD < MOUTH_HALF_ANG
      ? Math.pow(Math.cos((dTheta / MOUTH_HALF_ANG) * (Math.PI * 0.5)), 1.55)
      : 0;
  }

  // Spine slump offset helper for normalized crown height h in [0..1]
  const crownOffset = (h) => {
    const slump = Math.pow(Math.max(0, h), 2.05);
    const bendX = slump * 0.102 + Math.sin(h * Math.PI) * 0.016;
    const bendZ = slump * 0.072 - Math.sin(h * Math.PI * 1.15) * 0.012;
    const dropY = slump * 0.058;
    return { bendX, bendZ, dropY };
  };

  for (let iv = 0; iv <= SEG_V; iv++) {
    for (let iu = 0; iu <= SEG_U; iu++) {
      const u = iu / SEG_U;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const dTheta = Math.atan2(Math.sin(theta - Math.PI * 0.5), Math.cos(theta - Math.PI * 0.5));
      const mMask = mouthMasks[iu];

      // Organic wavy frayed brim profile shared by underside, edge, and upper brim
      const frayR =
        Math.sin(theta * 7 + 0.4) * 0.007 +
        Math.cos(theta * 13 - 0.8) * 0.0042 +
        Math.sin(theta * 19 + 1.1) * 0.002;
      const waveY =
        Math.sin(theta * 3 + 0.55) * 0.011 +
        Math.cos(theta * 5 - 0.35) * 0.0055;
      // Crooked hand-torn mouth rip contour along front
      const ripUndulation =
        Math.sin(dTheta * 7.5 + 0.3) * 0.0032 -
        Math.cos(dTheta * 14.0) * 0.0018;

      let r = 0.11;
      let y = 0.02;
      let offX = 0;
      let offZ = 0;

      // Dynamic deformation deltas when talking/flexing (fx, fy, fz)
      let fx = 0;
      let fy = 0;
      let fz = 0;

      if (iv <= 4) {
        // Brim underside: inner rim (0.098) -> outer underside (0.186)
        const t = iv / 4;
        r = THREE.MathUtils.lerp(0.098, 0.186, t) + frayR * t;
        y = THREE.MathUtils.lerp(0.018, 0.017 + waveY, t);
        // Subtle downward flex on front brim when mouth opens
        fy = -0.004 * t * mMask;
      } else if (iv <= 7) {
        // Rounded brim edge thickness (0.009m thick leather edge)
        const t = (iv - 4) / 3;
        const ang = -Math.PI * 0.5 + t * Math.PI;
        r = 0.186 + Math.cos(ang) * 0.0055 + frayR;
        y = 0.0215 + Math.sin(ang) * 0.0048 + waveY;
        fy = -0.004 * mMask;
      } else if (iv <= 14) {
        // Upper brim surface curving inward into crown waist
        const t = (iv - 7) / 7;
        const radialOut = 1 - t;
        r = THREE.MathUtils.lerp(0.186, 0.114, t) + frayR * radialOut;
        y = THREE.MathUtils.lerp(0.026 + waveY, 0.032, t) + Math.sin(t * Math.PI) * 0.003;
        fy = -0.006 * radialOut * mMask;
      } else if (iv <= MOUTH_LOWER_V) {
        // Lower crown -> Lower Mouth Lip Edge (iv = 22)
        const t = (iv - 14) / (MOUTH_LOWER_V - 14);
        const yMouthRest = 0.072 + ripUndulation * mMask;
        y = THREE.MathUtils.lerp(0.032, yMouthRest - 0.0022 * mMask, t);

        // Pinched hatband groove near t = 0.35, then lower lip rolls out and tucks inward at rip edge
        const bandPinch = -Math.sin(t * Math.PI) * 0.005;
        const lowerLipRoll =
          t > 0.65 && t < 0.92 ? Math.sin(((t - 0.65) / 0.27) * Math.PI) * 0.012 * mMask : 0;
        const lowerLipTuck = t >= 0.88 ? ((t - 0.88) / 0.12) * -0.018 * mMask : 0;

        r = THREE.MathUtils.lerp(0.114, 0.106, t) + bandPinch + lowerLipRoll + lowerLipTuck;
        const crinkle = Math.sin(theta * 6 + t * 2.5) * 0.003 * (1 - mMask * 0.7);
        r += crinkle;

        // Lower lip drops and pushes subtly forward on talk flex
        const lipWeight = Math.pow(t, 1.35) * mMask;
        fy = -0.024 * lipWeight;
        fz = 0.011 * lipWeight;
      } else if (iv <= 32) {
        // Upper Mouth Lip Edge (iv = 23) -> Sculpted Brow Folds & Temple Creases
        const t = (iv - MOUTH_UPPER_V) / (32 - MOUTH_UPPER_V); // 0..1
        const hGlobal = THREE.MathUtils.lerp(0.095, 0.42, t);
        const yMouthRest = 0.072 + ripUndulation * mMask;
        const yBrowTop = 0.215;
        y = THREE.MathUtils.lerp(yMouthRest + 0.0022 * mMask, yBrowTop, t);

        const baseR = THREE.MathUtils.lerp(0.106, 0.078, t);
        // Upper lip tucks sharply in at t=0, rolls forward into expressive cheek/upper-lip mound
        const upperLipTuck = t < 0.14 ? (1 - t / 0.14) * -0.018 * mMask : 0;
        const upperLipRidge =
          t > 0.06 && t < 0.32 ? Math.sin(((t - 0.06) / 0.26) * Math.PI) * 0.013 * mMask : 0;

        // Deep furrowed asymmetric brow-ridges sloping toward nose bridge above mouth
        const browLobeL = Math.exp(-Math.pow((dTheta + 0.33) / 0.23, 2)) * Math.exp(-Math.pow((t - 0.56) / 0.22, 2));
        const browLobeR = Math.exp(-Math.pow((dTheta - 0.31) / 0.23, 2)) * Math.exp(-Math.pow((t - 0.60) / 0.22, 2));
        const eyeSocketDip =
          (Math.exp(-Math.pow((dTheta + 0.28) / 0.19, 2)) + Math.exp(-Math.pow((dTheta - 0.28) / 0.19, 2))) *
          Math.exp(-Math.pow((t - 0.36) / 0.14, 2));
        const browSculpt = (browLobeL * 0.018 + browLobeR * 0.017) - eyeSocketDip * 0.014;

        // Lateral leather crumple folds wrapping crown
        const sideCrinkle =
          Math.sin(theta * 5 + t * 5.2) * 0.0055 * (1 - 0.4 * mMask) +
          Math.sin(t * Math.PI * 3.0) * 0.006 * (1 - t * 0.4);

        r = Math.max(0.04, baseR + upperLipTuck + upperLipRidge + browSculpt + sideCrinkle);

        const cOff = crownOffset(hGlobal);
        offX = cOff.bendX;
        offZ = cOff.bendZ;
        y -= cOff.dropY;

        // Upper lip lifts & curls upward; brow ridges furrow dynamically when speaking
        const upperLipWeight = Math.pow(Math.max(0, 1 - t * 1.45), 1.25) * mMask;
        const browFlexWeight = Math.exp(-Math.pow((t - 0.58) / 0.26, 2)) * mMask;
        fy = 0.026 * upperLipWeight + 0.005 * browFlexWeight;
        fz = 0.012 * upperLipWeight + 0.007 * browFlexWeight;
      } else {
        // Upper crinkled slumped spire rising to asymmetric drooping point (iv = 33..48)
        const t = (iv - 32) / (SEG_V - 32); // 0..1
        const hGlobal = THREE.MathUtils.lerp(0.42, 1.0, t);
        const cOff = crownOffset(hGlobal);

        y = THREE.MathUtils.lerp(0.215, 0.515, t) - cOff.dropY;
        const baseR = 0.078 * Math.pow(Math.max(0, 1 - t), 0.88);
        const fold =
          (Math.sin(theta * 4 + t * 7.2) * 0.0065 +
            Math.cos(theta * 6 - t * 5.5) * 0.0038 +
            Math.sin(t * Math.PI * 4.5) * 0.0045) *
          (1 - t * 0.85);

        r = t >= 0.999 ? 0.001 : Math.max(0.003, baseR + fold);
        offX = cOff.bendX;
        offZ = cOff.bendZ;

        // Subtle spire nod & sway in response to talking jaw flex
        fy = -0.006 * t;
        fz = 0.018 * Math.pow(t, 1.2);
      }

      // Clamp bottom of hat strictly >= 0.001 so it rests cleanly on shelf plank
      const finalY = Math.max(0.001, y);
      const px = Math.cos(theta) * r + offX;
      const pz = Math.sin(theta) * r + offZ;

      const idx = iv * cols + iu;
      basePositions[idx * 3] = px;
      basePositions[idx * 3 + 1] = finalY;
      basePositions[idx * 3 + 2] = pz;

      flexDeltas[idx * 3] = fx;
      flexDeltas[idx * 3 + 1] = fy;
      flexDeltas[idx * 3 + 2] = fz;

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = iv / SEG_V;
    }
  }

  // Triangulate surface rings — intentionally leave front mouth tear open between MOUTH_LOWER_V and MOUTH_UPPER_V
  for (let iv = 0; iv < SEG_V; iv++) {
    for (let iu = 0; iu < SEG_U; iu++) {
      if (iv === MOUTH_LOWER_V) {
        const isMouthQuad = mouthMasks[iu] > 0.001 || mouthMasks[iu + 1] > 0.001;
        if (isMouthQuad) continue;
      }
      const a = iv * cols + iu;
      const b = iv * cols + (iu + 1);
      const c = (iv + 1) * cols + iu;
      const d = (iv + 1) * cols + (iu + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  const hatGeo = new THREE.BufferGeometry();
  const livePos = new Float32Array(basePositions);
  hatGeo.setAttribute('position', new THREE.BufferAttribute(livePos, 3));
  hatGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  hatGeo.setIndex(indices);
  hatGeo.computeVertexNormals();

  // Helper to weld coincident seam normals at u=0/SEG_U and closed back mouth seam
  const normAttr = hatGeo.attributes.normal;
  function weldSeamNormals() {
    for (let iv = 0; iv <= SEG_V; iv++) {
      const a = iv * cols;
      const b = iv * cols + SEG_U;
      const nx = normAttr.getX(a) + normAttr.getX(b);
      const ny = normAttr.getY(a) + normAttr.getY(b);
      const nz = normAttr.getZ(a) + normAttr.getZ(b);
      const len = Math.hypot(nx, ny, nz) || 1;
      normAttr.setXYZ(a, nx / len, ny / len, nz / len);
      normAttr.setXYZ(b, nx / len, ny / len, nz / len);
    }
    for (let iu = 0; iu <= SEG_U; iu++) {
      if (mouthMasks[iu] <= 0.001) {
        const a = MOUTH_LOWER_V * cols + iu;
        const b = MOUTH_UPPER_V * cols + iu;
        const nx = normAttr.getX(a) + normAttr.getX(b);
        const ny = normAttr.getY(a) + normAttr.getY(b);
        const nz = normAttr.getZ(a) + normAttr.getZ(b);
        const len = Math.hypot(nx, ny, nz) || 1;
        normAttr.setXYZ(a, nx / len, ny / len, nz / len);
        normAttr.setXYZ(b, nx / len, ny / len, nz / len);
      }
    }
    normAttr.needsUpdate = true;
  }
  weldSeamNormals();

  const hatMesh = new THREE.Mesh(hatGeo, hatMat);
  group.add(hatMesh);

  // Dark shadowed leather mouth-throat & inner crown lining (so parted mouth rip has deep interior shadow)
  const innerShadowMat = new THREE.MeshStandardMaterial({
    color: '#120b08',
    roughness: 0.98,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const innerThroat = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.095, 0.012),
      new THREE.Vector2(0.088, 0.055),
      new THREE.Vector2(0.072, 0.14),
      new THREE.Vector2(0.036, 0.24),
      new THREE.Vector2(0.0, 0.28),
    ], 24),
    innerShadowMat
  );
  group.add(innerThroat);

  // Curved stitched leather mend patches conforming cleanly onto the crown
  const patchMat = hatMat;
  const twineMat = new THREE.MeshStandardMaterial({ color: '#9c7e54', roughness: 0.88, metalness: 0.02 });

  const addConformingPatch = ({ thetaCenter, yCenter, arcSpan, height, radius }) => {
    const patchGeo = new THREE.PlaneGeometry(arcSpan * radius, height, 8, 6);
    const pp = patchGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const lx = pp.getX(i);
      const ly = pp.getY(i);
      const ang = thetaCenter - lx / radius;
      const hNorm = THREE.MathUtils.clamp((yCenter + ly - 0.03) / 0.45, 0, 1);
      const cOff = crownOffset(hNorm);
      const rPatch = radius * (1 - hNorm * 0.48) + 0.008;
      pp.setXYZ(
        i,
        Math.cos(ang) * rPatch + cOff.bendX,
        yCenter + ly - cOff.dropY,
        Math.sin(ang) * rPatch + cOff.bendZ
      );
    }
    patchGeo.computeVertexNormals();
    const patchMesh = new THREE.Mesh(patchGeo, patchMat);
    group.add(patchMesh);

    // Curved hand-sewn twine stitch loops flanking the patch borders
    for (const s of [-1, 1]) {
      for (let st = -1; st <= 1; st++) {
        const ang = thetaCenter + s * (arcSpan * 0.48);
        const sy = yCenter + st * (height * 0.28);
        const hNorm = THREE.MathUtils.clamp((sy - 0.03) / 0.45, 0, 1);
        const cOff = crownOffset(hNorm);
        const rBase = radius * (1 - hNorm * 0.48) + 0.006;
        const stCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(ang - 0.05) * rBase + cOff.bendX, sy - 0.004 - cOff.dropY, Math.sin(ang - 0.05) * rBase + cOff.bendZ),
          new THREE.Vector3(Math.cos(ang) * (rBase + 0.005) + cOff.bendX, sy - cOff.dropY, Math.sin(ang) * (rBase + 0.005) + cOff.bendZ),
          new THREE.Vector3(Math.cos(ang + 0.05) * rBase + cOff.bendX, sy + 0.004 - cOff.dropY, Math.sin(ang + 0.05) * rBase + cOff.bendZ),
        ]);
        const stitchMesh = new THREE.Mesh(new THREE.TubeGeometry(stCurve, 6, 0.0014, 5, false), twineMat);
        group.add(stitchMesh);
      }
    }
  };

  addConformingPatch({ thetaCenter: Math.PI * 0.86, yCenter: 0.165, arcSpan: 0.46, height: 0.068, radius: 0.102 });
  addConformingPatch({ thetaCenter: Math.PI * 0.18, yCenter: 0.195, arcSpan: 0.42, height: 0.062, radius: 0.10 });

  // Stitched twine mending threads pinning the left & right corners of the mouth tear
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const ang = Math.PI * 0.5 + s * (MOUTH_HALF_ANG - 0.04 - k * 0.065);
      const rCorner = 0.107;
      const stCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(ang - 0.02) * rCorner, 0.060, Math.sin(ang - 0.02) * rCorner),
        new THREE.Vector3(Math.cos(ang) * (rCorner + 0.006), 0.072, Math.sin(ang) * (rCorner + 0.006)),
        new THREE.Vector3(Math.cos(ang + 0.02) * rCorner, 0.084, Math.sin(ang + 0.02) * rCorner),
      ]);
      const stitch = new THREE.Mesh(new THREE.TubeGeometry(stCurve, 6, 0.0015, 5, false), twineMat);
      group.add(stitch);
    }
  }

  // Twisted worn leather hatband cord tucked around waist above brim
  const bandPts = [];
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const rb = 0.114 + Math.sin(a * 6) * 0.0025;
    bandPts.push(new THREE.Vector3(Math.cos(a) * rb, 0.036 + Math.sin(a * 3) * 0.002, Math.sin(a) * rb));
  }
  const hatband = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bandPts, true), 48, 0.0042, 6, true),
    twineMat
  );
  group.add(hatband);

  tagCanonId(group, 'sorting-hat');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  let flexOpen = false;
  let speakTimer = 0;
  let currentMouthFlex = 0;
  let appliedMouthFlex = -1;

  function applyHatFlexDeform(amount) {
    if (Math.abs(amount - appliedMouthFlex) < 1e-4) return;
    appliedMouthFlex = amount;
    const posAttr = hatGeo.attributes.position;
    const arr = posAttr.array;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = basePositions[i] + flexDeltas[i] * amount;
    }
    posAttr.needsUpdate = true;
    hatGeo.computeVertexNormals();
    weldSeamNormals();
  }

  applyHatFlexDeform(0);

  function toggleHatFlex() {
    flexOpen = !flexOpen;
    return flexOpen;
  }

  const entry = registry.register({
    id: 'sorting-hat',
    name: 'The Sorting Hat',
    category: 'artifact',
    group,
    hitMeshes,
    cameraPos: [0.24, 2.34, -4.45],
    cameraTarget: [shelf.hatPos[0], shelf.hatPos[1] + 0.22, shelf.hatPos[2]],
    actions: ['speak-hat', 'toggle-hat-flex'],
    interact: (actionName) => {
      if (actionName === 'toggle-hat-flex') {
        return { flexOpen: toggleHatFlex() };
      }
      speakTimer = 2.8;
      return { speaking: true, quote: 'Bee in your bonnet, Potter?' };
    },
    onUpdate: (dt, elapsed, state) => {
      group.visible = !isWallSectorCutAway(state, 0, -1, layout.ROOM_RADIUS || 6.5);
      if (speakTimer > 0) {
        speakTimer = Math.max(0, speakTimer - dt);
      }

      let targetFlex = 0;
      let tiltX = 0;
      if (speakTimer > 0) {
        const speakT = 2.8 - speakTimer;
        const cadence = 0.5 + 0.5 * Math.sin(speakT * 11.5);
        targetFlex = 0.35 + cadence * 0.72;
        tiltX = -0.032 * cadence;
      } else if (flexOpen) {
        targetFlex = 0.68 + Math.sin(elapsed * 2.2) * 0.14;
        tiltX = -0.022;
      } else {
        targetFlex = 0.04 + Math.sin(elapsed * 1.1) * 0.03;
        tiltX = 0;
      }

      currentMouthFlex = THREE.MathUtils.lerp(currentMouthFlex, targetFlex, Math.min(1, dt * 14));
      applyHatFlexDeform(currentMouthFlex);
      hatMesh.rotation.x = THREE.MathUtils.lerp(hatMesh.rotation.x, tiltX, Math.min(1, dt * 10));
    },
    setEra: () => {
      group.visible = true;
    },
  });

  return { group, entry, toggleHatFlex };
}

/**
 * 6. Fawkes the Phoenix on his Baroque Golden Perch (`fawkes-perch`):
 *    Richly fluted baroque golden perch standing firmly on floor y = 0 at `layout.FAWKES_PERCH`
 *    with soft ground contact shadow, filigree side brackets, and turned finials.
 *    Anatomically sculpted swan-sized phoenix with lofted avian torso, tapered S-curve neck,
 *    curved raptor/swan golden beak, layered sculpted feather plumage blades, sweeping golden
 *    crest & cascading tail ribbons, articulated clawed talons, and full Burning Day cycle.
 */
function buildFawkesAndPerch(parent, materials, registry, layout) {
  const perchSpec = layout.FAWKES_PERCH;
  const group = new THREE.Group();
  group.name = 'FawkesAndGoldenPerch';
  group.position.set(perchSpec.x, perchSpec.y, perchSpec.z);
  group.rotation.y = perchSpec.rotationY;
  parent.add(group);

  const gold = materials.gildedGold;
  const crimsonFeather = materials.crimsonFeather;
  const goldFeather = materials.goldFeather;
  const shimmerFeather = materials.createFeatherShaderMaterial({
    crimsonColor: '#b31f14',
    goldColor: '#f7ca57',
    emberGlow: 0.28,
  });

  // Ground contact shadow beneath perch & ashes
  group.add(createContactShadowMesh(materials, 0.48, 0.65));

  // --- Richly Fluted Baroque Golden Perch (y = 0 to perchTopY = 1.86) ---
  const perchGroup = new THREE.Group();
  perchGroup.name = 'GoldenPerch';
  group.add(perchGroup);

  const poleProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.145, 0.0),
    new THREE.Vector2(0.138, 0.024),
    new THREE.Vector2(0.112, 0.044),
    new THREE.Vector2(0.088, 0.068),
    new THREE.Vector2(0.068, 0.108),
    new THREE.Vector2(0.056, 0.155),
    new THREE.Vector2(0.038, 0.25),
    new THREE.Vector2(0.052, 0.42),
    new THREE.Vector2(0.032, 0.56),
    new THREE.Vector2(0.030, 1.15),
    new THREE.Vector2(0.048, 1.24),
    new THREE.Vector2(0.028, 1.32),
    new THREE.Vector2(0.026, 1.76),
    new THREE.Vector2(0.052, 1.81),
    new THREE.Vector2(0.0, 1.825),
  ];
  const poleGeo = new THREE.LatheGeometry(poleProfile, 36);
  // Carve crisp baroque vertical flutes into the tall central column sections
  const polePos = poleGeo.attributes.position;
  for (let i = 0; i < polePos.count; i++) {
    const px = polePos.getX(i);
    const py = polePos.getY(i);
    const pz = polePos.getZ(i);
    const r = Math.hypot(px, pz);
    if (r > 0.01 && ((py > 0.58 && py < 1.12) || (py > 1.34 && py < 1.74))) {
      const ang = Math.atan2(pz, px);
      const flute = 1 - Math.max(0, Math.cos(ang * 12)) * 0.095;
      polePos.setX(i, px * flute);
      polePos.setZ(i, pz * flute);
    }
  }
  poleGeo.computeVertexNormals();
  const poleMesh = new THREE.Mesh(poleGeo, gold);
  perchGroup.add(poleMesh);

  // Turned baroque decorative collar rings
  for (const [cy, cr] of [
    [0.155, 0.07],
    [0.56, 0.038],
    [1.24, 0.052],
    [1.54, 0.04],
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cr, 0.0085, 10, 28), gold);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = cy;
    perchGroup.add(ring);
  }

  // 3 baroque scrolled S-curve tripod legs with ball pads resting squarely on y = 0
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const footHolder = new THREE.Group();
    footHolder.rotation.y = a;

    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.068, 0.16, 0),
      new THREE.Vector3(0.165, 0.115, 0),
      new THREE.Vector3(0.245, 0.055, 0),
      new THREE.Vector3(0.285, 0.022, 0),
    ]);
    const legScroll = new THREE.Mesh(
      createTaperedCurveGeometry(legCurve, 16, 10, (u) => 0.018 - u * 0.005),
      gold
    );
    footHolder.add(legScroll);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.018, 12), gold);
    pad.position.set(0.285, 0.009, 0);
    footHolder.add(pad);

    perchGroup.add(footHolder);
  }

  // Horizontal golden crossbar (top edge at y = 1.86, center y = 1.835, radius 0.025)
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 24), gold);
  crossbar.rotation.z = Math.PI * 0.5;
  crossbar.position.y = 1.835;
  perchGroup.add(crossbar);

  // Turned baroque finials at crossbar ends
  const finialGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.028, 0.006),
    new THREE.Vector2(0.036, 0.024),
    new THREE.Vector2(0.022, 0.044),
    new THREE.Vector2(0.028, 0.054),
    new THREE.Vector2(0.010, 0.072),
    new THREE.Vector2(0.0, 0.088),
  ], 20);
  for (const s of [-1, 1]) {
    const finial = new THREE.Mesh(finialGeo, gold);
    finial.rotation.z = -s * Math.PI * 0.5;
    finial.position.set(s * 0.278, 1.835, 0);
    perchGroup.add(finial);
  }

  // Scrolled filigree side brackets & inner volutes supporting crossbar (open-top for Fawkes's plumage)
  for (const s of [-1, 1]) {
    const mainBracket = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.54, 0),
      new THREE.Vector3(s * 0.08, 1.56, 0),
      new THREE.Vector3(s * 0.17, 1.66, 0),
      new THREE.Vector3(s * 0.23, 1.77, 0),
      new THREE.Vector3(s * 0.25, 1.825, 0),
    ]);
    perchGroup.add(new THREE.Mesh(new THREE.TubeGeometry(mainBracket, 22, 0.011, 8, false), gold));

    // Inner filigree C-scroll volute
    const scrollCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.04, 1.61, 0),
      new THREE.Vector3(s * 0.11, 1.68, 0),
      new THREE.Vector3(s * 0.145, 1.755, 0),
      new THREE.Vector3(s * 0.10, 1.78, 0),
      new THREE.Vector3(s * 0.08, 1.73, 0),
    ]);
    perchGroup.add(new THREE.Mesh(new THREE.TubeGeometry(scrollCurve, 18, 0.0065, 8, false), gold));
  }

  // --- Anatomically Sculpted Fawkes the Phoenix (Perched atop crossbar y = 1.86) ---
  const birdRoot = new THREE.Group();
  birdRoot.name = 'FawkesPhoenix';
  birdRoot.position.set(0, 1.86, 0);
  group.add(birdRoot);

  const beakTalonMat = new THREE.MeshStandardMaterial({
    color: '#d8ab46',
    roughness: 0.32,
    metalness: 0.52,
  });
  const clawTipMat = new THREE.MeshStandardMaterial({
    color: '#30251c',
    roughness: 0.25,
    metalness: 0.42,
  });

  // Articulated clawed talons gripping the crossbar cleanly
  for (const sx of [-0.054, 0.054]) {
    // Feathered upper thigh cap
    const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), crimsonFeather);
    thigh.scale.set(0.85, 1.3, 0.95);
    thigh.position.set(sx, 0.072, -0.005);
    birdRoot.add(thigh);

    // Tapered scaled golden tarsus leg
    const tarsus = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0085, 0.068, 10), beakTalonMat);
    tarsus.position.set(sx, 0.025, 0.003);
    birdRoot.add(tarsus);

    // 3 curved articulated front toes + 1 rear hallux gripping around r = 0.025 bar (center at local y = -0.025)
    for (const toeSpec of [
      { xOff: -0.014, yaw: 0.28, dir: 1 },
      { xOff: 0.0, yaw: 0.0, dir: 1 },
      { xOff: 0.014, yaw: -0.28, dir: 1 },
      { xOff: 0.0, yaw: 0.0, dir: -1 },
    ]) {
      const toeHolder = new THREE.Group();
      toeHolder.position.set(sx + toeSpec.xOff, -0.001, 0.002);
      toeHolder.rotation.y = toeSpec.yaw;

      const d = toeSpec.dir;
      const toeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.002, 0),
        new THREE.Vector3(0, -0.004, d * 0.022),
        new THREE.Vector3(0, -0.024, d * 0.030),
        new THREE.Vector3(0, -0.044, d * 0.020),
      ]);
      const toeMesh = new THREE.Mesh(
        createTaperedCurveGeometry(toeCurve, 10, 7, (u) => 0.0055 * (1 - u * 0.45)),
        beakTalonMat
      );
      toeHolder.add(toeMesh);

      const clawCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.042, d * 0.020),
        new THREE.Vector3(0, -0.052, d * 0.012),
      ]);
      const clawTip = new THREE.Mesh(
        createTaperedCurveGeometry(clawCurve, 6, 6, (u) => 0.0036 * (1 - u * 0.85)),
        clawTipMat
      );
      toeHolder.add(clawTip);
      birdRoot.add(toeHolder);
    }
  }

  // Body & plumage pivot
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 0.072, 0);
  birdRoot.add(bodyPivot);

  const healthyBodyMat = crimsonFeather;
  const moultingSkinMat = new THREE.MeshStandardMaterial({
    color: '#7d4a46',
    roughness: 0.85,
    metalness: 0.02,
  });

  // Sculpted lofted swan-sized avian torso (contoured keel chest, tucked waist, rounded back)
  const torsoSpine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, -0.055),
    new THREE.Vector3(0, 0.07, -0.015),
    new THREE.Vector3(0, 0.165, 0.025),
    new THREE.Vector3(0, 0.245, 0.034),
    new THREE.Vector3(0, 0.285, 0.028),
  ]);
  const torsoGeo = createTaperedCurveGeometry(torsoSpine, 24, 20, (u) => {
    const profile = Math.sin(Math.pow(u, 0.72) * Math.PI);
    const chestBulge = Math.exp(-Math.pow((u - 0.62) / 0.25, 2)) * 0.025;
    return {
      rx: 0.022 + profile * 0.074,
      ry: 0.024 + profile * 0.088 + chestBulge,
    };
  });
  const torso = new THREE.Mesh(torsoGeo, healthyBodyMat);
  bodyPivot.add(torso);

  // Scalloped crimson breast plumage blades (`healthyPlumageGroup`)
  const healthyPlumageGroup = new THREE.Group();
  bodyPivot.add(healthyPlumageGroup);

  const breastFeatherGeo = createSculptedFeatherGeometry({
    length: 0.088,
    width: 0.052,
    arch: 0.014,
    cup: 0.007,
    segsU: 6,
    segsV: 8,
  });
  const breastRows = [
    { y: 0.255, z: 0.092, r: 0.042, count: 4, spread: 0.42 },
    { y: 0.195, z: 0.105, r: 0.052, count: 5, spread: 0.48 },
    { y: 0.132, z: 0.088, r: 0.048, count: 4, spread: 0.42 },
  ];
  for (const row of breastRows) {
    for (let i = 0; i < row.count; i++) {
      const frac = row.count === 1 ? 0 : (i / (row.count - 1)) * 2 - 1;
      const yaw = frac * row.spread;
      const blade = new THREE.Mesh(breastFeatherGeo, shimmerFeather);
      blade.position.set(Math.sin(yaw) * row.r, row.y, row.z - Math.abs(frac) * 0.022);
      blade.rotation.y = yaw;
      blade.rotation.x = 0.26;
      healthyPlumageGroup.add(blade);
    }
  }

  // Graceful Variable-Radius S-Curved Neck & Head Pivot
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.268, 0.032);
  bodyPivot.add(neckPivot);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.068, 0.042),
    new THREE.Vector3(0, 0.142, 0.008),
    new THREE.Vector3(0, 0.205, 0.034),
  ]);
  const neckGeo = createTaperedCurveGeometry(neckCurve, 22, 16, (u) => ({
    rx: THREE.MathUtils.lerp(0.046, 0.032, u) + Math.sin(u * Math.PI) * 0.004,
    ry: THREE.MathUtils.lerp(0.049, 0.035, u) + Math.sin(u * Math.PI) * 0.004,
  }));
  const neckMesh = new THREE.Mesh(neckGeo, healthyBodyMat);
  neckPivot.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.212, 0.038);
  neckPivot.add(headGroup);

  // Sculpted elongated avian cranium with brow ridges
  const skullGeo = new THREE.SphereGeometry(0.052, 22, 16);
  const skPos = skullGeo.attributes.position;
  for (let i = 0; i < skPos.count; i++) {
    let x = skPos.getX(i) * 0.88;
    let y = skPos.getY(i) * 0.92;
    let z = skPos.getZ(i) * 1.18;
    // Slight brow arch over eyes & sleek cheek taper toward beak
    if (z > 0.01 && y > 0.005 && Math.abs(x) > 0.02) {
      x += Math.sign(x) * 0.005;
      y += 0.004;
    }
    if (z > 0.03) {
      x *= 0.86;
      y *= 0.88;
    }
    skPos.setXYZ(i, x, y, z);
  }
  skullGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(skullGeo, healthyBodyMat);
  headGroup.add(headMesh);

  // Smoothly curved tapered raptor/swan golden beak (NO plain geometric cones!)
  const upperBeakCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.004, 0.046),
    new THREE.Vector3(0, 0.002, 0.078),
    new THREE.Vector3(0, -0.009, 0.106),
    new THREE.Vector3(0, -0.028, 0.118),
  ]);
  const upperBeak = new THREE.Mesh(
    createTaperedCurveGeometry(upperBeakCurve, 16, 12, (u) => ({
      rx: 0.017 * Math.pow(Math.max(0.04, 1 - u), 0.78),
      ry: 0.014 * Math.pow(Math.max(0.04, 1 - u), 0.85),
    })),
    beakTalonMat
  );
  headGroup.add(upperBeak);

  const lowerBeakCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.012, 0.046),
    new THREE.Vector3(0, -0.014, 0.076),
    new THREE.Vector3(0, -0.018, 0.098),
  ]);
  const lowerBeak = new THREE.Mesh(
    createTaperedCurveGeometry(lowerBeakCurve, 10, 10, (u) => ({
      rx: 0.013 * (1 - u * 0.88),
      ry: 0.007 * (1 - u * 0.88),
    })),
    beakTalonMat
  );
  headGroup.add(lowerBeak);

  // Glossy dark eyes with warm sculpted golden iris rims
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: '#110d0a',
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
  });
  const eyeRimMat = new THREE.MeshStandardMaterial({ color: '#d49d35', roughness: 0.34, metalness: 0.35 });
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0032, 8, 16), eyeRimMat);
    rim.rotation.y = s * 1.15;
    rim.position.set(s * 0.036, 0.011, 0.034);
    headGroup.add(rim);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.010, 12, 12), eyeMat);
    eye.position.set(s * 0.038, 0.011, 0.035);
    headGroup.add(eye);
  }

  // Sweeping Arched Golden Crest Plumes atop head (layered curved lanceolate feathers)
  const crestGroup = new THREE.Group();
  headGroup.add(crestGroup);
  for (let i = 0; i < 5; i++) {
    const spread = (i - 2) * 0.009;
    const len = 0.145 - Math.abs(i - 2) * 0.022;
    const crestCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(spread * 0.3, 0.038, 0.008 - i * 0.004),
      new THREE.Vector3(spread * 0.8, 0.095 - Math.abs(i - 2) * 0.01, -0.042),
      new THREE.Vector3(spread * 1.2, 0.072 - Math.abs(i - 2) * 0.014, -len),
    ]);
    const crest = new THREE.Mesh(
      createFeatherRibbonGeometry(crestCurve, 12, (u) => 0.022 * Math.sin(Math.pow(u, 0.65) * Math.PI)),
      goldFeather
    );
    crestGroup.add(crest);
  }

  // Folded / Breathing Layered Wings (left & right with sculpted covert + primary pinion blades)
  const wingPivots = [];
  const covertGeo = createSculptedFeatherGeometry({ length: 0.14, width: 0.044, arch: 0.016, cup: 0.006 });
  const primaryGeo = createSculptedFeatherGeometry({ length: 0.24, width: 0.042, arch: 0.022, cup: 0.005 });

  for (const s of [-1, 1]) {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(s * 0.088, 0.232, 0.005);
    bodyPivot.add(wingPivot);

    // Sculpted shoulder covert cap
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), crimsonFeather);
    shoulder.scale.set(0.5, 1.25, 1.08);
    shoulder.position.set(s * 0.012, -0.068, -0.022);
    wingPivot.add(shoulder);

    // Upper crimson wing covert feathers (tier 1)
    for (let c = 0; c < 4; c++) {
      const covert = new THREE.Mesh(covertGeo, crimsonFeather);
      covert.position.set(s * (0.026 - c * 0.003), -0.04 - c * 0.022, -0.015 - c * 0.018);
      covert.rotation.set(0.32 + c * 0.06, s * 1.48, -s * 0.14);
      wingPivot.add(covert);
    }

    // Layered crimson & gold primary/secondary flight pinions (tier 2)
    for (let f = 0; f < 6; f++) {
      const mat = f >= 3 ? goldFeather : shimmerFeather;
      const pinion = new THREE.Mesh(primaryGeo, mat);
      pinion.scale.set(1, 0.85 + f * 0.075, 1);
      pinion.position.set(s * (0.022 - f * 0.0035), -0.085 - f * 0.018, -0.028 - f * 0.014);
      pinion.rotation.set(0.38 + f * 0.045, s * 1.42, -s * 0.09);
      wingPivot.add(pinion);
    }
    wingPivots.push({ pivot: wingPivot, side: s });
  }

  // Sweeping Long Curved Cascading Golden Tail Feather Blades (cascading down behind perch)
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.018, -0.058);
  bodyPivot.add(tailGroup);

  const tailFeathers = [];
  for (let i = -3; i <= 3; i++) {
    const absI = Math.abs(i);
    const len = 0.60 - absI * 0.062;
    const spreadX = i * 0.032;
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(spreadX * 0.25, 0.02, 0),
      new THREE.Vector3(spreadX * 0.7, -len * 0.34, -0.068),
      new THREE.Vector3(spreadX, -len * 0.72, -0.036 - absI * 0.014),
      new THREE.Vector3(spreadX * 1.18, -len, 0.012 + (i % 2) * 0.012),
    ]);
    const widthBase = absI === 0 ? 0.048 : absI <= 1 ? 0.04 : 0.032;
    const tMesh = new THREE.Mesh(
      createFeatherRibbonGeometry(tailCurve, 20, (v) => widthBase * Math.sin(Math.pow(v, 0.6) * Math.PI * 0.96)),
      absI <= 1 ? goldFeather : shimmerFeather
    );
    tailGroup.add(tMesh);
    tailFeathers.push(tMesh);
  }

  // Moulting decrepit state overlay (ruffled stray quills & falling shed feathers)
  const moultingRuffleGroup = new THREE.Group();
  bodyPivot.add(moultingRuffleGroup);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const quillCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 0.06, 0.09 + (i % 3) * 0.045, Math.sin(ang) * 0.06),
      new THREE.Vector3(Math.cos(ang) * 0.095, 0.11 + (i % 3) * 0.048, Math.sin(ang) * 0.085),
      new THREE.Vector3(Math.cos(ang) * 0.118, 0.085 + (i % 3) * 0.04, Math.sin(ang) * 0.105),
    ]);
    const quill = new THREE.Mesh(
      createTaperedCurveGeometry(quillCurve, 8, 6, (u) => 0.004 * (1 - u * 0.7)),
      crimsonFeather
    );
    moultingRuffleGroup.add(quill);
  }
  moultingRuffleGroup.visible = false;

  // Two loose sculpted feathers drifting downward in moulting animation
  const shedFeatherGeo = createSculptedFeatherGeometry({ length: 0.105, width: 0.028, arch: 0.016, cup: 0.004 });
  const fallingFeathers = [];
  for (let k = 0; k < 2; k++) {
    const ff = new THREE.Mesh(shedFeatherGeo, k === 0 ? goldFeather : shimmerFeather);
    ff.position.set(k === 0 ? 0 : 0.09, 1.68 - k * 0.45, -0.06);
    ff.userData.noRaycast = true;
    ff.visible = false;
    group.add(ff);
    fallingFeathers.push({ mesh: ff, offset: k * 0.48 });
  }

  // --- Volumetric Burning Day Flames & Rising Embers (vivid non-white-clipped flames) ---
  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 1.88, 0);
  group.add(flameGroup);

  const flameMats = [];
  const flameShells = [
    { rTop: 0.024, rBot: 0.105, h: 0.56, y: 0.25 },
    { rTop: 0.036, rBot: 0.155, h: 0.68, y: 0.29 },
    { rTop: 0.048, rBot: 0.195, h: 0.78, y: 0.32 },
  ];
  for (let i = 0; i < flameShells.length; i++) {
    const spec = flameShells[i];
    const fMat = createPhoenixFlameMaterial();
    fMat.uniforms.uSeed.value = i * 2.37;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.rTop, spec.rBot, spec.h, 20, 10, true),
      fMat
    );
    cone.position.y = spec.y;
    cone.rotation.y = (i / flameShells.length) * Math.PI * 2;
    cone.userData.noRaycast = true;
    cone.userData.noShadow = true;
    cone.renderOrder = 5 + i;
    flameGroup.add(cone);
    flameMats.push(fMat);
  }
  flameGroup.visible = false;

  // Rising glowing embers
  const emberGroup = new THREE.Group();
  emberGroup.position.set(0, 1.85, 0);
  group.add(emberGroup);
  const emberGeo = new THREE.SphereGeometry(0.012, 6, 6);
  const embers = [];
  for (let i = 0; i < 24; i++) {
    const eMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? '#ffd966' : '#ff6b1a',
      transparent: true,
      opacity: 0.9,
    });
    const em = new THREE.Mesh(emberGeo, eMat);
    em.userData.noRaycast = true;
    em.userData.noShadow = true;
    emberGroup.add(em);
    embers.push({
      mesh: em,
      mat: eMat,
      phase: i / 24,
      angle: i * 2.399,
      radius: 0.06 + (i % 5) * 0.045,
      speed: 0.45 + (i % 4) * 0.14,
    });
  }
  emberGroup.visible = false;

  const phoenixLight = new THREE.PointLight('#ff8224', 0, 5.5, 1.7);
  phoenixLight.position.set(0, 2.12, 0.15);
  group.add(phoenixLight);

  // --- Floor Ash Pile + Tiny Wrinkled Newborn Chick (`ashes` state, clear of gold base plinth) ---
  const ashGroup = new THREE.Group();
  ashGroup.name = 'FawkesAshesAndChick';
  ashGroup.position.set(0.14, 0.0, 0.19);
  group.add(ashGroup);

  const ashTex = createAshMoundTextures();
  const ashMat = new THREE.MeshStandardMaterial({
    color: ashTex ? '#d4d6dc' : '#52545a',
    map: ashTex ? ashTex.map : null,
    bumpMap: ashTex ? ashTex.bumpMap : null,
    bumpScale: 0.028,
    roughness: 0.96,
    metalness: 0.02,
  });
  const ashMoundGeo = new THREE.SphereGeometry(0.225, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const amPos = ashMoundGeo.attributes.position;
  for (let i = 0; i < amPos.count; i++) {
    const ax = amPos.getX(i);
    const ay = amPos.getY(i);
    const az = amPos.getZ(i);
    const ang = Math.atan2(az, ax);
    const r = Math.hypot(ax, az);
    const drift = 1.0 + Math.sin(ang * 5 + r * 10) * 0.09 + Math.cos(ang * 3 - 0.5) * 0.07;
    const ridge = 0.94 + Math.cos(r * 16 + ang * 2) * 0.09;
    amPos.setXYZ(i, ax * 1.04 * drift, ay * 0.45 * ridge, az * drift);
  }
  ashMoundGeo.computeVertexNormals();
  const ashMound = new THREE.Mesh(ashMoundGeo, ashMat);
  ashGroup.add(ashMound);

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.35;
    const rad = 0.085 + (i % 3) * 0.032;
    const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.021, 0), materials.ashEmber);
    lump.scale.set(1.2, 0.72, 0.95);
    lump.rotation.set(i * 0.8, a, i * 0.4);
    lump.position.set(Math.cos(a) * rad, 0.034, Math.sin(a) * rad);
    ashGroup.add(lump);
  }

  // Tiny wrinkled newborn chick poking out of the mottled charcoal-ash heap
  const chickGroup = new THREE.Group();
  chickGroup.position.set(0.0, 0.092, 0.015);
  chickGroup.scale.setScalar(1.18);
  ashGroup.add(chickGroup);

  const chickSkinMat = new THREE.MeshStandardMaterial({
    color: '#b8857d',
    roughness: 0.86,
    metalness: 0.02,
  });

  // Sculpted wrinkled belly & skin folds
  const chickBodyGeo = new THREE.SphereGeometry(0.048, 18, 14);
  const cbPos = chickBodyGeo.attributes.position;
  for (let i = 0; i < cbPos.count; i++) {
    const x = cbPos.getX(i);
    const y = cbPos.getY(i);
    const z = cbPos.getZ(i);
    const wrinkle = 1 + Math.sin(y * 140) * 0.055;
    cbPos.setXYZ(i, x * wrinkle, y * 0.95, z * 1.12 * wrinkle);
  }
  chickBodyGeo.computeVertexNormals();
  const chickBody = new THREE.Mesh(chickBodyGeo, chickSkinMat);
  chickGroup.add(chickBody);

  const chickHead = new THREE.Group();
  chickHead.position.set(0, 0.056, 0.022);
  chickGroup.add(chickHead);

  const chickSkullGeo = new THREE.SphereGeometry(0.034, 16, 14);
  const csPos = chickSkullGeo.attributes.position;
  for (let i = 0; i < csPos.count; i++) {
    const x = csPos.getX(i);
    const y = csPos.getY(i);
    const z = csPos.getZ(i);
    const w = 1 + Math.sin(y * 160 + x * 40) * 0.045;
    csPos.setXYZ(i, x * 0.95 * w, y * 0.95, z * 1.1 * w);
  }
  chickSkullGeo.computeVertexNormals();
  const chickSkull = new THREE.Mesh(chickSkullGeo, chickSkinMat);
  chickHead.add(chickSkull);

  // Curved open baby chick beak (upper + lower curved tubes)
  const chickBeakTop = new THREE.Mesh(
    createTaperedCurveGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.002, 0.03),
        new THREE.Vector3(0, 0.003, 0.045),
        new THREE.Vector3(0, -0.003, 0.055),
      ]),
      8, 8, (u) => 0.008 * (1 - u * 0.78)
    ),
    beakTalonMat
  );
  const chickBeakBot = new THREE.Mesh(
    createTaperedCurveGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.005, 0.029),
        new THREE.Vector3(0, -0.011, 0.044),
      ]),
      6, 8, (u) => 0.0065 * (1 - u * 0.78)
    ),
    beakTalonMat
  );
  chickHead.add(chickBeakTop, chickBeakBot);

  for (const s of [-1, 1]) {
    const cEye = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 8), eyeMat);
    cEye.position.set(s * 0.023, 0.007, 0.022);
    chickHead.add(cEye);

    const wingBud = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), chickSkinMat);
    wingBud.scale.set(0.45, 0.85, 1.2);
    wingBud.position.set(s * 0.045, 0.006, -0.005);
    chickGroup.add(wingBud);
  }

  ashGroup.visible = false;

  tagCanonId(group, 'fawkes-perch');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  // --- Burning Day State Machine ---
  const CYCLE_ORDER = ['magnificent', 'moulting', 'burning', 'ashes', 'reborn'];
  let fawkesMode = 'moulting';
  let modeElapsed = 0;
  let fallPhase = 0;

  function applyFawkesVisualMode(mode) {
    const normalized = String(mode || '').toLowerCase();
    if (normalized === 'scarlet-gold') fawkesMode = 'magnificent';
    else if (normalized === 'burning-day') fawkesMode = 'moulting';
    else if (['magnificent', 'moulting', 'burning', 'ashes', 'reborn', 'lamenting', 'absent'].includes(normalized)) {
      fawkesMode = normalized;
    } else {
      fawkesMode = 'magnificent';
    }
    modeElapsed = 0;

    birdRoot.visible = fawkesMode !== 'absent' && fawkesMode !== 'ashes';
    ashGroup.visible = fawkesMode === 'ashes';
    flameGroup.visible = fawkesMode === 'burning' || fawkesMode === 'reborn';
    emberGroup.visible = fawkesMode === 'burning' || fawkesMode === 'reborn';
    for (const ff of fallingFeathers) {
      ff.mesh.visible = fawkesMode === 'moulting';
    }

    const isMoulting = fawkesMode === 'moulting';
    torso.material = isMoulting ? moultingSkinMat : healthyBodyMat;
    neckMesh.material = isMoulting ? moultingSkinMat : healthyBodyMat;
    headMesh.material = isMoulting ? moultingSkinMat : healthyBodyMat;
    healthyPlumageGroup.visible = !isMoulting;
    crestGroup.visible = !isMoulting;
    moultingRuffleGroup.visible = isMoulting;

    for (const wp of wingPivots) {
      wp.pivot.scale.setScalar(isMoulting ? 0.56 : 1.0);
    }
    for (let i = 0; i < tailFeathers.length; i++) {
      tailFeathers[i].visible = !isMoulting || i === 1 || i === 3 || i === 5;
      tailFeathers[i].scale.setScalar(isMoulting ? 0.55 : 1.0);
    }
  }

  function cycleFawkesMode(explicitMode) {
    if (explicitMode) {
      applyFawkesVisualMode(explicitMode);
      return fawkesMode;
    }
    const idx = CYCLE_ORDER.indexOf(fawkesMode);
    const nextMode = idx >= 0 ? CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length] : 'magnificent';
    applyFawkesVisualMode(nextMode);
    return fawkesMode;
  }

  const entry = registry.register({
    id: 'fawkes-perch',
    name: 'Fawkes the Phoenix & Golden Perch',
    category: 'creature',
    group,
    hitMeshes,
    cameraPos: [-0.55, 1.65, 1.75],
    cameraTarget: [perchSpec.x, 1.05, perchSpec.z],
    actions: ['burning-day'],
    interact: (actionName, context) => {
      const requested = context?.mode || (['magnificent', 'moulting', 'burning', 'ashes', 'reborn'].includes(actionName) ? actionName : undefined);
      const next = cycleFawkesMode(requested);
      return { fawkesMode: next };
    },
    onUpdate: (dt, elapsed) => {
      modeElapsed += dt;

      if (fawkesMode === 'burning' && modeElapsed > 3.2) {
        applyFawkesVisualMode('ashes');
      } else if (fawkesMode === 'reborn' && modeElapsed > 2.2) {
        applyFawkesVisualMode('magnificent');
      }

      if (fawkesMode === 'magnificent' || fawkesMode === 'lamenting' || fawkesMode === 'reborn') {
        const isLament = fawkesMode === 'lamenting';
        const riseScale = fawkesMode === 'reborn' ? THREE.MathUtils.smoothstep(modeElapsed, 0, 1.2) : 1.0;
        birdRoot.scale.setScalar(0.3 + 0.7 * riseScale);
        bodyPivot.rotation.x = isLament ? 0.16 : Math.sin(elapsed * 1.4) * 0.03;
        neckPivot.rotation.x = isLament ? 0.25 : Math.sin(elapsed * 1.6) * 0.05;
        headGroup.rotation.y = isLament ? Math.sin(elapsed * 0.7) * 0.14 : Math.sin(elapsed * 0.95) * 0.24;
        headGroup.rotation.z = isLament ? 0.1 : Math.sin(elapsed * 1.3) * 0.07;

        for (const wp of wingPivots) {
          wp.pivot.rotation.z = wp.side * ((isLament ? 0.14 : 0.05) + Math.sin(elapsed * 2.1) * 0.03);
        }
        tailGroup.rotation.x = Math.sin(elapsed * 1.5) * 0.04;
        shimmerFeather.uniforms.uTime.value = elapsed;
        shimmerFeather.uniforms.uEmberGlow.value = fawkesMode === 'reborn' ? 0.85 : isLament ? 0.18 : 0.32;
      } else if (fawkesMode === 'moulting') {
        birdRoot.scale.setScalar(1.0);
        bodyPivot.rotation.x = 0.24;
        neckPivot.rotation.x = 0.34 + Math.sin(elapsed * 3.8) * 0.04;
        headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.12;
        headGroup.rotation.z = 0.18;
        for (const wp of wingPivots) {
          wp.pivot.rotation.z = wp.side * (0.22 + Math.sin(elapsed * 4.5) * 0.025);
        }

        fallPhase = (fallPhase + dt * 0.28) % 1;
        for (const ff of fallingFeathers) {
          const p = (fallPhase + ff.offset) % 1;
          const fy = 1.68 * (1 - p) + 0.04 * p;
          ff.mesh.position.set(
            Math.sin(p * Math.PI * 3 + ff.offset * 6) * 0.11,
            fy,
            -0.06 + Math.cos(p * Math.PI * 2 + ff.offset * 4) * 0.06
          );
          ff.mesh.rotation.set(p * 2.2, p * 4.0, Math.sin(p * 6) * 0.6);
        }
      } else if (fawkesMode === 'burning') {
        const shrink = 1.0 - THREE.MathUtils.smoothstep(modeElapsed, 1.0, 2.9);
        birdRoot.scale.setScalar(Math.max(0.05, shrink));
        for (const wp of wingPivots) {
          wp.pivot.rotation.z = wp.side * (0.45 + Math.sin(elapsed * 12) * 0.22);
        }
      }

      if (flameGroup.visible) {
        const fInt = fawkesMode === 'burning'
          ? 0.45 + 0.48 * Math.sin(Math.min(1, modeElapsed / 3.2) * Math.PI)
          : 0.9 - THREE.MathUtils.smoothstep(modeElapsed, 0.5, 2.2) * 0.9;
        for (const fm of flameMats) {
          fm.uniforms.uTime.value = elapsed;
          fm.uniforms.uIntensity.value = fInt;
        }
        phoenixLight.intensity = fInt * (1.85 + Math.sin(elapsed * 17) * 0.45);
      } else {
        phoenixLight.intensity = fawkesMode === 'ashes' ? 0.35 + Math.sin(elapsed * 5.0) * 0.1 : 0;
      }
      phoenixLight.visible = phoenixLight.intensity > 0.01;

      if (emberGroup.visible) {
        for (const em of embers) {
          em.phase = (em.phase + dt * em.speed) % 1;
          const a = em.angle + elapsed * 1.4;
          const rad = em.radius * (1 + em.phase * 1.6);
          em.mesh.position.set(Math.cos(a) * rad, -0.1 + em.phase * 1.15, Math.sin(a) * rad);
          em.mat.opacity = Math.sin(em.phase * Math.PI) * 0.92;
        }
      }

      if (ashGroup.visible) {
        chickGroup.position.y = 0.092 + Math.sin(elapsed * 3.1) * 0.008;
        chickHead.rotation.x = Math.sin(elapsed * 4.4) * 0.14 - 0.1;
        chickHead.rotation.y = Math.sin(elapsed * 1.7) * 0.25;
      }
    },
    setEra: (eraId) => {
      if (eraId === 'cos') applyFawkesVisualMode('moulting');
      else if (eraId === 'gof' || eraId === 'oop') applyFawkesVisualMode('magnificent');
      else if (eraId === 'hbp') applyFawkesVisualMode('lamenting');
      else if (eraId === 'dh') applyFawkesVisualMode('absent');
    },
  });

  return { group, entry, cycleFawkesMode, getMode: () => fawkesMode };
}

/**
 * 7. The Pensieve (`pensieve`):
 *    Sculpted thick chamfered shallow stone basin with stepped rim molding wrapped in `materials.runeStone`
 *    (carved granite albedo + deep Sobel normal map) and swirling bright silvery-white liquid-light
 *    shader (`materials.createPensieveLiquidMaterial()`) + rising ethereal light wisps.
 *    Smoothly moves between `layout.BLACK_CABINET.pensieveCabinetPos` and `layout.PENSIEVE_DESK_POS`.
 */
function buildPensieve(parent, materials, registry, layout, canonData) {
  const cabinetPos = new THREE.Vector3(
    layout.BLACK_CABINET.pensieveCabinetPos.x,
    layout.BLACK_CABINET.pensieveCabinetPos.y,
    layout.BLACK_CABINET.pensieveCabinetPos.z
  );
  const deskPos = new THREE.Vector3(
    layout.PENSIEVE_DESK_POS.x,
    layout.PENSIEVE_DESK_POS.y,
    layout.PENSIEVE_DESK_POS.z
  );

  const group = new THREE.Group();
  group.name = 'ThePensieve';
  group.position.copy(cabinetPos);
  parent.add(group);

  // Thick chamfered shallow carved stone basin with stepped foot & rim molding (y = 0..0.165)
  const basinProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.172, 0.0),
    new THREE.Vector2(0.178, 0.012),
    new THREE.Vector2(0.166, 0.024),
    new THREE.Vector2(0.152, 0.034),
    new THREE.Vector2(0.158, 0.044),
    new THREE.Vector2(0.242, 0.102),
    new THREE.Vector2(0.264, 0.118),
    new THREE.Vector2(0.278, 0.142),
    new THREE.Vector2(0.276, 0.158),
    new THREE.Vector2(0.264, 0.164),
    new THREE.Vector2(0.214, 0.164),
    new THREE.Vector2(0.202, 0.152),
    new THREE.Vector2(0.194, 0.118),
    new THREE.Vector2(0.128, 0.068),
    new THREE.Vector2(0.0, 0.056),
  ];
  const basinMesh = new THREE.Mesh(new THREE.LatheGeometry(basinProfile, 56), materials.runeStone);
  group.add(basinMesh);

  // Stepped rim molding bevel & carved outer runic frieze collar for deep normal-map rune relief
  const rimRing = new THREE.Mesh(new THREE.RingGeometry(0.214, 0.270, 56), materials.runeStone);
  rimRing.rotation.x = -Math.PI * 0.5;
  rimRing.position.y = 0.1645;
  group.add(rimRing);

  const rimInnerBead = new THREE.Mesh(new THREE.TorusGeometry(0.214, 0.007, 10, 56), materials.runeStone);
  rimInnerBead.rotation.x = Math.PI * 0.5;
  rimInnerBead.position.y = 0.158;
  group.add(rimInnerBead);

  const runeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.279, 0.265, 0.044, 56, 1, true),
    materials.runeStone
  );
  runeCollar.position.y = 0.138;
  group.add(runeCollar);

  // Swirling bright whitish-silver liquid-light surface ("neither liquid nor gas")
  const liquidMat = materials.createPensieveLiquidMaterial();
  const liquidDisc = new THREE.Mesh(new THREE.CircleGeometry(0.216, 48), liquidMat);
  liquidDisc.rotation.x = -Math.PI * 0.5;
  liquidDisc.position.y = 0.132;
  liquidDisc.renderOrder = 2;
  liquidDisc.userData.noShadow = true;
  group.add(liquidDisc);

  // Ethereal rising silvery light mist wisps & subtle floating vapor veil
  const silverWisps = createSmokeEmitter(group, new THREE.Vector3(0, 0.14, 0), {
    count: 6,
    color: '#f2f8ff',
    edgeColor: '#9fc5f0',
    baseScale: 0.04,
    riseHeight: 0.24,
    speed: 0.34,
    opacity: 0.25,
  });

  const veilMat = createSmokeWispMaterial({ color: '#f7fbff', edgeColor: '#9ec8f5', opacity: 0.22 });
  const veilRing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.12, 32, 1, true), veilMat);
  veilRing.position.y = 0.19;
  veilRing.userData.noRaycast = true;
  veilRing.userData.noShadow = true;
  veilRing.renderOrder = 3;
  group.add(veilRing);

  const pensieveLight = new THREE.PointLight('#d4ebff', 1.15, 3.2, 1.8);
  pensieveLight.position.set(0, 0.26, 0);
  group.add(pensieveLight);

  tagCanonId(group, 'pensieve');
  enableShadows(group, true, true);
  liquidDisc.castShadow = false;
  const hitMeshes = [basinMesh, rimRing, rimInnerBead, runeCollar, liquidDisc];

  let location = 'cabinet';
  let transition = null;
  let peerBoostTimer = 0;
  let eraVisible = false;
  let lastRenderState = null;

  let entry = null;

  function syncPensieveVisibility(state) {
    const eastCutAway =
      location === 'cabinet' &&
      !transition &&
      isWallSectorCutAway(state, 1, 0, layout.ROOM_RADIUS || 6.5);
    group.visible = eraVisible && !eastCutAway;
  }

  function syncCameraFraming(loc) {
    if (!entry) return;
    if (loc === 'desk') {
      entry.cameraPos.set(0.92, 1.68, -0.25);
      entry.cameraTarget.set(deskPos.x, deskPos.y + 0.14, deskPos.z);
    } else {
      entry.cameraPos.set(4.35, 1.65, 0.45);
      entry.cameraTarget.set(cabinetPos.x, cabinetPos.y + 0.14, cabinetPos.z);
    }
  }

  function setPensieveLocation(nextLoc, immediate = false) {
    const normalized = nextLoc === 'desk' ? 'desk' : nextLoc === 'cabinet' || nextLoc === 'hidden' ? 'cabinet' : (location === 'desk' ? 'cabinet' : 'desk');
    const targetVec = normalized === 'desk' ? deskPos : cabinetPos;
    location = normalized;
    syncCameraFraming(location);

    if (immediate) {
      transition = null;
      group.position.copy(targetVec);
    } else {
      transition = {
        start: group.position.clone(),
        end: targetVec.clone(),
        elapsed: 0,
        duration: 0.95,
      };
    }
    syncPensieveVisibility(lastRenderState);
    return location;
  }

  entry = registry.register({
    id: 'pensieve',
    name: 'The Pensieve',
    category: 'artifact',
    group,
    hitMeshes,
    cameraPos: [4.35, 1.65, 0.45],
    cameraTarget: [cabinetPos.x, cabinetPos.y + 0.14, cabinetPos.z],
    actions: ['peer-pensieve', 'move-pensieve'],
    interact: (actionName) => {
      if (actionName === 'move-pensieve' || actionName === 'desk' || actionName === 'cabinet') {
        eraVisible = true;
        const nextLoc = actionName === 'desk' || actionName === 'cabinet' ? actionName : undefined;
        return { location: setPensieveLocation(nextLoc, false) };
      }
      peerBoostTimer = 3.5;
      return { peering: true, location };
    },
    onUpdate: (dt, elapsed, state) => {
      lastRenderState = state || lastRenderState;
      if (transition) {
        transition.elapsed += dt;
        const rawT = Math.min(1, transition.elapsed / transition.duration);
        const eased = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
        group.position.lerpVectors(transition.start, transition.end, eased);
        group.position.y += Math.sin(rawT * Math.PI) * 0.34;
        if (rawT >= 1) {
          group.position.copy(transition.end);
          transition = null;
        }
      }

      syncPensieveVisibility(state);

      if (peerBoostTimer > 0) peerBoostTimer = Math.max(0, peerBoostTimer - dt);
      const boost = peerBoostTimer > 0 ? 1.0 + 0.95 * Math.sin(Math.min(1, peerBoostTimer / 3.5) * Math.PI) : 1.0;

      liquidMat.uniforms.uTime.value = elapsed * (0.9 + 0.4 * boost);
      liquidMat.uniforms.uIntensity.value = boost;
      veilMat.uniforms.uTime.value = elapsed * 0.85;
      veilMat.uniforms.uOpacity.value = 0.18 * boost;
      veilRing.rotation.y = elapsed * 0.35;
      pensieveLight.intensity = 1.05 * boost + Math.sin(elapsed * 2.5) * 0.12;
      pensieveLight.visible = group.visible && pensieveLight.intensity > 0.01;
      silverWisps.update(dt, elapsed, boost);
    },
    setEra: (eraId) => {
      const eraCfg = canonData?.BOOK_ERAS?.find((e) => e.id === eraId);
      const targetLoc = eraCfg?.pensieveLocation === 'desk' ? 'desk' : 'cabinet';
      eraVisible = eraId !== 'cos';
      if (targetLoc !== location) {
        setPensieveLocation(targetLoc, false);
      } else {
        syncPensieveVisibility(lastRenderState);
      }
    },
  });

  return {
    group,
    entry,
    setPensieveLocation,
    revealForManualMove: () => {
      eraVisible = true;
      syncPensieveVisibility(lastRenderState);
    },
    getLocation: () => location,
  };
}

/**
 * 8. Crystal Memory Phials (`memory-phials`):
 *    2 tiny lathe-sculpted faceted crystal stopper bottles (`materials.crystalPhial`)
 *    with tapered cork stoppers & animated glowing twisted silvery memory strands
 *    sitting at `layout.MEMORY_PHIALS_OFFSETS` beside the Pensieve on the desk in HBP/DH.
 */
function buildMemoryPhials(parent, materials, registry, layout) {
  const group = new THREE.Group();
  group.name = 'CrystalMemoryPhials';
  parent.add(group);

  const offsets = layout.MEMORY_PHIALS_OFFSETS || [];
  const corkMat = new THREE.MeshStandardMaterial({ color: '#7e5a38', roughness: 0.88 });
  const strandMatBright = new THREE.MeshStandardMaterial({
    color: '#e8f4ff',
    emissive: '#bcdfff',
    emissiveIntensity: 1.35,
    roughness: 0.25,
    transparent: true,
    opacity: 0.9,
  });
  const strandMatDense = new THREE.MeshStandardMaterial({
    color: '#cbdbe8',
    emissive: '#9cb5cf',
    emissiveIntensity: 0.95,
    roughness: 0.4,
    transparent: true,
    opacity: 0.86,
  });

  const phialObjects = [];

  offsets.forEach((spec, idx) => {
    const phialRoot = new THREE.Group();
    phialRoot.name = spec.id || `memory-phial-${idx + 1}`;
    phialRoot.position.set(spec.x, spec.y, spec.z);
    group.add(phialRoot);

    const isFlask = idx === 1;
    const glassProfile = isFlask
      ? [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.022, 0.0),
          new THREE.Vector2(0.026, 0.012),
          new THREE.Vector2(0.028, 0.036),
          new THREE.Vector2(0.021, 0.064),
          new THREE.Vector2(0.011, 0.082),
          new THREE.Vector2(0.011, 0.098),
          new THREE.Vector2(0.0155, 0.104),
          new THREE.Vector2(0.009, 0.106),
        ]
      : [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.020, 0.0),
          new THREE.Vector2(0.023, 0.010),
          new THREE.Vector2(0.021, 0.060),
          new THREE.Vector2(0.011, 0.082),
          new THREE.Vector2(0.011, 0.102),
          new THREE.Vector2(0.0155, 0.106),
          new THREE.Vector2(0.009, 0.108),
        ];

    // Faceted 8- or 10-sided lathe crystal bottle for crisp optical refraction facets
    const facetSegs = isFlask ? 10 : 8;
    const bottleGeo = new THREE.LatheGeometry(glassProfile, facetSegs);
    const bottle = new THREE.Mesh(bottleGeo, materials.crystalPhial);
    bottle.renderOrder = 3;
    phialRoot.add(bottle);

    // Subtle brass lip ring + tapered cork stopper
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0018, 6, 16), materials.antiqueBrass);
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = isFlask ? 0.098 : 0.101;
    phialRoot.add(collar);

    const cork = new THREE.Mesh(
      new THREE.LatheGeometry([
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.0072, 0.0),
        new THREE.Vector2(0.0098, 0.018),
        new THREE.Vector2(0.0085, 0.022),
        new THREE.Vector2(0.0, 0.022),
      ], 12),
      corkMat
    );
    cork.position.y = isFlask ? 0.098 : 0.102;
    phialRoot.add(cork);

    // Internal glowing twisted twin silvery memory strands
    const strandGroup = new THREE.Group();
    const sMat = idx === 0 ? strandMatBright : strandMatDense;
    for (let s = 0; s < 2; s++) {
      const strandPts = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const a = u * Math.PI * 3.8 + idx * 1.4 + s * Math.PI;
        const r = 0.0045 + Math.sin(u * Math.PI) * 0.008;
        strandPts.push(new THREE.Vector3(Math.cos(a) * r, 0.016 + u * 0.056, Math.sin(a) * r));
      }
      const strandMesh = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strandPts), 24, s === 0 ? 0.0028 : 0.002, 6, false),
        sMat
      );
      strandGroup.add(strandMesh);
    }
    phialRoot.add(strandGroup);

    phialObjects.push({
      root: phialRoot,
      cork,
      corkRestY: cork.position.y,
      strand: strandGroup,
      basePos: new THREE.Vector3(spec.x, spec.y, spec.z),
    });
  });

  // Glowing arc strand used when pouring a phial into the Pensieve
  const pourArcPts = [
    new THREE.Vector3(0.36, 1.02, -1.26),
    new THREE.Vector3(0.22, 1.08, -1.30),
    new THREE.Vector3(0.06, 0.98, -1.34),
  ];
  const pourArc = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pourArcPts), 20, 0.006, 8, false),
    strandMatBright
  );
  pourArc.userData.noRaycast = true;
  pourArc.visible = false;
  group.add(pourArc);

  tagCanonId(group, 'memory-phials');
  enableShadows(group, true, true);
  const hitMeshes = collectHitMeshes(group);

  let pourTimer = 0;

  const entry = registry.register({
    id: 'memory-phials',
    name: 'Crystal Memory Phials',
    category: 'artifact',
    group,
    hitMeshes,
    cameraPos: [0.95, 1.32, -0.62],
    cameraTarget: [0.52, 0.89, -1.33],
    actions: ['pour-memory'],
    interact: () => {
      pourTimer = 2.6;
      return { pouring: true };
    },
    onUpdate: (dt, elapsed) => {
      phialObjects.forEach((p, idx) => {
        p.strand.rotation.y = elapsed * (idx === 0 ? 1.85 : 0.78);
        p.strand.position.y = Math.sin(elapsed * 2.2 + idx * 1.5) * 0.003;
      });

      if (pourTimer > 0 && phialObjects[0]) {
        pourTimer = Math.max(0, pourTimer - dt);
        const phase = 1.0 - pourTimer / 2.6;
        const arcLift = Math.sin(phase * Math.PI);
        const p0 = phialObjects[0];
        p0.root.position.set(
          p0.basePos.x - arcLift * 0.14,
          p0.basePos.y + arcLift * 0.18,
          p0.basePos.z - arcLift * 0.04
        );
        p0.root.rotation.z = arcLift * 1.15;
        p0.cork.position.y = p0.corkRestY + arcLift * 0.04;
        pourArc.visible = phase > 0.22 && phase < 0.78;
      } else if (phialObjects[0]) {
        phialObjects[0].root.position.copy(phialObjects[0].basePos);
        phialObjects[0].root.rotation.z = 0;
        phialObjects[0].cork.position.y = phialObjects[0].corkRestY;
        pourArc.visible = false;
      }
    },
    setEra: (eraId) => {
      group.visible = eraId === 'hbp' || eraId === 'dh';
    },
  });

  return { group, entry };
}

/**
 * Helper constructing a detailed Sword of Gryffindor mesh (~0.96m total height):
 * - True diamond-cross-section tapering double-edged silver blade with central fuller groove
 * - Ornate medieval twisted silver cross-guard with curled spiral quillons & ExtrudeGeometry ecusson
 * - Ribbed dark leather grip with silver wire collars
 * - Faceted brilliant-cut crimson rubies (`materials.rubyGem || ...`) set in silver prongs on hilt & pommel
 * @param {object} materials
 * @param {boolean} isReplica
 */
function createGryffindorSwordMesh(materials, isReplica = false) {
  const sword = new THREE.Group();

  const baseSilver = materials?.burnishedSilver;
  const bladeMat = isReplica
    ? new THREE.MeshStandardMaterial({ color: '#9aa2ad', metalness: 0.72, roughness: 0.38 })
    : new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#eef4fb'),
        map: baseSilver?.map || null,
        normalMap: baseSilver?.normalMap || null,
        normalScale: new THREE.Vector2(0.32, 0.32),
        roughnessMap: baseSilver?.roughnessMap || null,
        metalness: 0.76,
        roughness: 0.25,
        clearcoat: 0.32,
        clearcoatRoughness: 0.20,
        emissive: new THREE.Color('#1d2530'),
        emissiveIntensity: 0.14,
      });

  const leatherGripMat = new THREE.MeshStandardMaterial({
    color: isReplica ? '#322925' : '#241712',
    roughness: 0.74,
    metalness: 0.08,
  });

  const rubyMat = isReplica
    ? new THREE.MeshStandardMaterial({ color: '#7a1925', roughness: 0.45, metalness: 0.1 })
    : (materials.rubyGem ||
      new THREE.MeshPhysicalMaterial({
        color: '#a80c24',
        emissive: '#38030c',
        emissiveIntensity: 0.55,
        roughness: 0.08,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.9,
      }));

  // 1. True diamond-cross-section double-edged goblin silver blade with central fuller groove
  const blade = new THREE.Mesh(createGoblinBladeGeometry(), bladeMat);
  sword.add(blade);

  // ExtrudeGeometry beveled silver ricasso/ecusson collar where blade meets cross-guard
  const ecussonShape = new THREE.Shape();
  ecussonShape.moveTo(-0.038, 0.205);
  ecussonShape.lineTo(0.038, 0.205);
  ecussonShape.lineTo(0.032, 0.175);
  ecussonShape.lineTo(0.0, 0.155);
  ecussonShape.lineTo(-0.032, 0.175);
  ecussonShape.closePath();
  const ecussonGeo = new THREE.ExtrudeGeometry(ecussonShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.003,
    bevelThickness: 0.003,
  });
  ecussonGeo.translate(0, 0, -0.009);
  sword.add(new THREE.Mesh(ecussonGeo, bladeMat));

  // 2. Ornate medieval twisted silver cross-guard with curled spiral quillons
  const guardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.142, 0.172, 0),
    new THREE.Vector3(-0.082, 0.194, 0),
    new THREE.Vector3(0, 0.200, 0),
    new THREE.Vector3(0.082, 0.194, 0),
    new THREE.Vector3(0.142, 0.172, 0),
  ]);
  const crossGuard = new THREE.Mesh(
    createTaperedCurveGeometry(guardCurve, 28, 12, (u) => {
      const mid = 1 - Math.abs(u - 0.5) * 1.1;
      return 0.0095 + mid * 0.004;
    }),
    bladeMat
  );
  sword.add(crossGuard);

  // Helical twisted silver wire filigree wrapping both guard arms + curled spiral quillons
  for (const s of [-1, 1]) {
    const twistPts = [];
    for (let i = 0; i <= 26; i++) {
      const u = i / 26;
      const gx = s * (0.034 + u * 0.106);
      const gy = THREE.MathUtils.lerp(0.198, 0.173, u);
      const ang = u * Math.PI * 7.5;
      twistPts.push(new THREE.Vector3(gx, gy + Math.sin(ang) * 0.011, Math.cos(ang) * 0.011));
    }
    sword.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(twistPts), 32, 0.003, 6, false), bladeMat));

    // Curled spiral quillon volute
    const spiralPts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      const a = u * Math.PI * 1.85;
      const r = 0.024 * (1 - u * 0.65);
      spiralPts.push(new THREE.Vector3(
        s * (0.142 + Math.sin(a) * r),
        0.172 - (1 - Math.cos(a)) * r * 0.9,
        0
      ));
    }
    sword.add(new THREE.Mesh(
      createTaperedCurveGeometry(new THREE.CatmullRomCurve3(spiralPts), 18, 8, (u) => 0.0085 * (1 - u * 0.45)),
      bladeMat
    ));

    const quillonTip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), bladeMat);
    quillonTip.position.copy(spiralPts[spiralPts.length - 1]);
    sword.add(quillonTip);
  }

  // 3. Ribbed dark leather grip (y = 0.205..0.345)
  const gripCore = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.017, 0.14, 16), leatherGripMat);
  gripCore.scale.set(1.12, 1.0, 0.85);
  gripCore.position.y = 0.275;
  sword.add(gripCore);

  for (let i = 0; i < 7; i++) {
    const ry = 0.215 + i * 0.02;
    const rad = 0.0168 - (i / 7) * 0.0022;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.0032, 8, 18), i === 3 ? bladeMat : leatherGripMat);
    rib.rotation.x = Math.PI * 0.5;
    rib.scale.set(1.1, 0.85, 1.0);
    rib.position.y = ry;
    sword.add(rib);
  }

  // 4. Faceted medieval wheel/scent-stopper silver pommel (y = 0.37)
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.026, 8), bladeMat);
  pommel.rotation.x = Math.PI * 0.5;
  pommel.scale.set(1.05, 1.0, 1.18);
  pommel.position.y = 0.37;
  sword.add(pommel);

  const pommelCap = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.022, 8), bladeMat);
  pommelCap.position.y = 0.405;
  sword.add(pommelCap);

  // 5. Egg-sized faceted brilliant-cut crimson rubies set in silver bezel prongs (CoS Ch. 18)
  const addSetRuby = (x, y, z, scaleX, scaleY, scaleZ) => {
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.018 * scaleX, 0.0032, 8, 16), bladeMat);
    bezel.scale.set(1.0, scaleY / scaleX, 1.0);
    bezel.position.set(x, y, z - 0.004);
    sword.add(bezel);

    const gem = new THREE.Mesh(createBrilliantCutRubyGeometry(0.018, 0.022), rubyMat);
    gem.scale.set(scaleX, scaleY, scaleZ);
    gem.position.set(x, y, z);
    sword.add(gem);
  };

  addSetRuby(0, 0.37, 0.015, 0.95, 1.18, 0.85);
  addSetRuby(0, 0.192, 0.016, 1.05, 1.25, 0.88);
  addSetRuby(0, 0.248, 0.015, 0.72, 0.92, 0.72);
  addSetRuby(0, 0.302, 0.015, 0.72, 0.92, 0.72);

  return sword;
}

/**
 * 9. Sword of Gryffindor in Beveled Oak & Optical Glass Case (`gryffindor-sword-case`):
 *    Mounted at `layout.SWORD_CASE` (`201°`, `y = 2.32`).
 *    Supports DH state: real sword hidden inside `layout.HIDDEN_CAVITY.swordRestPos`
 *    behind Dumbledore's hinged portrait while replica sits in the glass case (`toggleSwordSecret`).
 */
function buildGryffindorSwordCase(parent, materials, registry, layout) {
  const caseSpec = layout.SWORD_CASE;
  const cavitySpec = layout.HIDDEN_CAVITY;

  const group = new THREE.Group();
  group.name = 'GryffindorSwordGroup';
  parent.add(group);

  const caseGroup = new THREE.Group();
  caseGroup.name = 'SwordDisplayCase';
  caseGroup.position.set(caseSpec.pos[0], caseSpec.pos[1], caseSpec.pos[2]);
  caseGroup.rotation.y = caseSpec.rotationY;
  group.add(caseGroup);

  const w = caseSpec.width; // 0.96
  const h = caseSpec.height; // 1.36
  const d = caseSpec.depth; // 0.24
  const frameThick = 0.065;

  const oak = materials.darkCarvedOak;
  const brass = materials.antiqueBrass;

  // Backboard & deep crimson velvet lining
  const backboard = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), oak);
  backboard.position.z = -d * 0.5 + 0.015;
  caseGroup.add(backboard);

  const velvetInset = new THREE.Mesh(
    new THREE.PlaneGeometry(w - frameThick * 2, h - frameThick * 2),
    materials.velvetFabric
  );
  velvetInset.position.z = -d * 0.5 + 0.032;
  caseGroup.add(velvetInset);

  // Beveled stepped oak cornice & plinth moldings using ExtrudeGeometry
  const makeBeveledMoldingBar = (barW, barH, barD) => {
    const s = new THREE.Shape();
    s.moveTo(-barW * 0.5, -barH * 0.5);
    s.lineTo(barW * 0.5, -barH * 0.5);
    s.lineTo(barW * 0.5, barH * 0.5);
    s.lineTo(-barW * 0.5, barH * 0.5);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: barD,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    g.translate(0, 0, -barD * 0.5);
    return g;
  };

  const topWall = new THREE.Mesh(makeBeveledMoldingBar(w + 0.04, frameThick, d + 0.02), oak);
  topWall.position.set(0, h * 0.5 - frameThick * 0.5, 0);
  const botWall = new THREE.Mesh(makeBeveledMoldingBar(w + 0.04, frameThick, d + 0.02), oak);
  botWall.position.set(0, -h * 0.5 + frameThick * 0.5, 0);
  const leftWall = new THREE.Mesh(makeBeveledMoldingBar(frameThick, h - frameThick * 2, d), oak);
  leftWall.position.set(-w * 0.5 + frameThick * 0.5, 0, 0);
  const rightWall = new THREE.Mesh(makeBeveledMoldingBar(frameThick, h - frameThick * 2, d), oak);
  rightWall.position.set(w * 0.5 - frameThick * 0.5, 0, 0);
  caseGroup.add(topWall, botWall, leftWall, rightWall);

  // Front oak sash frame + brass hinges/clasp
  const sashW = 0.04;
  const sashFrontZ = d * 0.5 - 0.012;
  const sashL = new THREE.Mesh(makeBeveledMoldingBar(sashW, h - frameThick * 2, 0.022), oak);
  sashL.position.set(-w * 0.5 + frameThick + sashW * 0.5, 0, sashFrontZ);
  const sashR = new THREE.Mesh(makeBeveledMoldingBar(sashW, h - frameThick * 2, 0.022), oak);
  sashR.position.set(w * 0.5 - frameThick - sashW * 0.5, 0, sashFrontZ);
  caseGroup.add(sashL, sashR);

  for (const hy of [-0.36, 0.36]) {
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.024), brass);
    hinge.position.set(-w * 0.5 + 0.02, hy, sashFrontZ);
    caseGroup.add(hinge);
  }
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.064, 0.026), brass);
  clasp.position.set(w * 0.5 - frameThick, 0, sashFrontZ);
  caseGroup.add(clasp);

  // Brass mounting cradle brackets inside the case
  for (const pegPos of [
    [-0.08, 0.25],
    [0.08, 0.25],
  ]) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.095, 10), brass);
    peg.rotation.x = Math.PI * 0.5;
    peg.position.set(pegPos[0], pegPos[1], -0.02);
    caseGroup.add(peg);
  }

  // Optical reflective protective glass pane (renders cleanly over transmissive rubies)
  const glassMat = createCaseGlassMaterial(0.22);
  const glassPane = new THREE.Mesh(
    new THREE.PlaneGeometry(w - frameThick * 2 - sashW * 1.5, h - frameThick * 2),
    glassMat
  );
  glassPane.position.z = sashFrontZ;
  glassPane.renderOrder = 6;
  glassPane.userData.noShadow = true;
  caseGroup.add(glassPane);

  // Real Sword of Gryffindor & DH Replica Sword
  const realSwordInCase = createGryffindorSwordMesh(materials, false);
  realSwordInCase.position.set(0, 0.06, 0.0);
  caseGroup.add(realSwordInCase);

  const replicaSwordInCase = createGryffindorSwordMesh(materials, true);
  replicaSwordInCase.position.set(0, 0.06, 0.0);
  replicaSwordInCase.visible = false;
  caseGroup.add(replicaSwordInCase);

  // Real Sword hidden inside `HIDDEN_CAVITY.swordRestPos` behind Dumbledore's hinged portrait
  const cavitySwordGroup = new THREE.Group();
  cavitySwordGroup.name = 'HiddenCavityRealSword';
  cavitySwordGroup.position.set(
    cavitySpec.swordRestPos[0],
    cavitySpec.swordRestPos[1],
    cavitySpec.swordRestPos[2]
  );
  cavitySwordGroup.rotation.y = cavitySpec.rotationY;
  cavitySwordGroup.visible = false;
  group.add(cavitySwordGroup);

  const realSwordInCavity = createGryffindorSwordMesh(materials, false);
  realSwordInCavity.position.set(0, 0.14, 0.0);
  realSwordInCavity.rotation.z = 0.08;
  cavitySwordGroup.add(realSwordInCavity);

  tagCanonId(group, 'gryffindor-sword-case');
  enableShadows(group, true, true);
  glassPane.castShadow = false;
  const hitMeshes = collectHitMeshes(group);

  let swordInCavity = false;
  let gleamTimer = 0;

  function toggleSwordSecret(inCavity) {
    swordInCavity = typeof inCavity === 'boolean' ? inCavity : !swordInCavity;
    realSwordInCase.visible = !swordInCavity;
    replicaSwordInCase.visible = swordInCavity;
    cavitySwordGroup.visible = swordInCavity;
    return swordInCavity;
  }

  const entry = registry.register({
    id: 'gryffindor-sword-case',
    name: 'Sword of Gryffindor in Glass Display Case',
    category: 'artifact',
    group,
    hitMeshes,
    cameraPos: [-1.42, 2.25, -4.18],
    cameraTarget: [...caseSpec.pos],
    actions: ['inspect-sword', 'toggle-sword-secret'],
    interact: (actionName) => {
      if (actionName === 'toggle-sword-secret' || actionName === 'toggle-secret') {
        const next = toggleSwordSecret();
        return { swordInCavity: next, replicaInCase: next };
      }
      gleamTimer = 2.0;
      return { swordInCavity, replicaInCase: swordInCavity };
    },
    onUpdate: (dt, elapsed, state) => {
      const roomR = layout.ROOM_RADIUS || 6.5;
      const caseCut = isWallSectorCutAway(state, Math.sin(caseSpec.angleRad), Math.cos(caseSpec.angleRad), roomR);
      const cavCut = isWallSectorCutAway(state, 0, -1, roomR);
      caseGroup.visible = !caseCut;
      cavitySwordGroup.visible = swordInCavity && !cavCut;

      if (gleamTimer > 0) {
        gleamTimer = Math.max(0, gleamTimer - dt);
        const wobble = Math.sin(elapsed * 5.0) * 0.08 * Math.min(1, gleamTimer);
        realSwordInCase.rotation.y = wobble;
        replicaSwordInCase.rotation.y = wobble;
      } else {
        realSwordInCase.rotation.y = 0;
        replicaSwordInCase.rotation.y = 0;
      }
    },
    setEra: (eraId) => {
      group.visible = eraId !== 'cos';
      toggleSwordSecret(eraId === 'dh');
    },
  });

  return { group, entry, toggleSwordSecret };
}

/**
 * Builds and registers all strictly book-canon artifacts, instruments,
 * Fawkes on his golden perch, the Sorting Hat, Pensieve, Memory Phials,
 * Gaunt's Ring, and Sword of Gryffindor.
 *
 * @param {THREE.Scene} scene
 * @param {object} materials
 * @param {import('./registry.js').CanonSceneRegistry} registry
 * @param {object} [layout]
 * @param {object} [canonData]
 * @returns {{
 *   cycleFawkesMode: (mode?: string) => string,
 *   togglePensieveLocation: (loc?: string) => string,
 *   triggerSmokeSerpent: () => boolean,
 *   toggleHatFlex: () => boolean,
 *   toggleSwordSecret: (inCavity?: boolean) => boolean,
 *   applyEra: (eraId: string) => void
 * }}
 */
export function buildArtifacts(
  scene,
  materials,
  registry,
  layout = defaultLayout,
  canonData = defaultCanonData
) {
  const artifactsRoot = new THREE.Group();
  artifactsRoot.name = 'CanonArtifactsRoot';
  scene.add(artifactsRoot);

  const silver = buildSilverInstruments(artifactsRoot, materials, registry, layout);
  const serpent = buildSmokeSerpentInstrument(artifactsRoot, materials, registry, layout);
  const lunascope = buildLunascope(artifactsRoot, materials, registry, layout);
  const gauntRing = buildGauntRing(artifactsRoot, materials, registry, layout);
  const sortingHat = buildSortingHat(artifactsRoot, materials, registry, layout);
  const fawkes = buildFawkesAndPerch(artifactsRoot, materials, registry, layout);
  const pensieve = buildPensieve(artifactsRoot, materials, registry, layout, canonData);
  const phials = buildMemoryPhials(artifactsRoot, materials, registry, layout);
  const sword = buildGryffindorSwordCase(artifactsRoot, materials, registry, layout);

  const allEntries = [
    silver.entry,
    serpent.entry,
    lunascope.entry,
    gauntRing.entry,
    sortingHat.entry,
    fawkes.entry,
    pensieve.entry,
    phials.entry,
    sword.entry,
  ];

  function applyEra(eraId = 'cos', { immediate = false } = {}) {
    const normalized = typeof eraId === 'string' ? eraId.toLowerCase() : 'cos';
    for (const entry of allEntries) {
      if (entry && typeof entry.setEra === 'function') {
        entry.setEra(normalized);
      }
    }
    if (immediate) {
      const eraCfg = canonData?.BOOK_ERAS?.find((e) => e.id === normalized);
      const targetLoc = eraCfg?.pensieveLocation === 'desk' ? 'desk' : 'cabinet';
      pensieve.setPensieveLocation(targetLoc, true);
    }
  }

  // Initialize synchronously to active registry era (default 'cos')
  const initialEra = typeof registry?.getCurrentEra === 'function' ? registry.getCurrentEra() : 'cos';
  applyEra(initialEra || 'cos', { immediate: true });

  return {
    cycleFawkesMode: (mode) => fawkes.cycleFawkesMode(mode),
    togglePensieveLocation: (loc) => {
      pensieve.revealForManualMove();
      return pensieve.setPensieveLocation(loc, false);
    },
    triggerSmokeSerpent: () => serpent.triggerSmokeSerpent(),
    toggleHatFlex: () => sortingHat.toggleHatFlex(),
    toggleSwordSecret: (inCavity) => sword.toggleSwordSecret(inCavity),
    applyEra: (eraId) => applyEra(eraId, { immediate: false }),
  };
}
