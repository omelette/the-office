import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStaticSubtree } from './batcher.js';

function isDescendantOf(node, ancestor) {
  let curr = node;
  while (curr) {
    if (curr === ancestor) return true;
    curr = curr.parent;
  }
  return false;
}

/**
 * Normalizes an angle in degrees into [-8.5, 351.5) to match layout.WALL_SECTORS.
 * @param {number} deg
 * @returns {number}
 */
function normalizeSectorDeg(deg) {
  let d = ((deg % 360) + 360) % 360;
  if (d >= 351.5) d -= 360;
  return d;
}

/**
 * Finds the outward horizontal unit normal of the wall sector enclosing angleDeg.
 * Keeps wall-mounted portraits and Horcrux stand synchronized with engine cutaway.
 * @param {object} layout
 * @param {number} angleDeg
 * @returns {[number, number, number]}
 */
function resolveSectorNormal(layout, angleDeg) {
  const sectors = layout?.WALL_SECTORS;
  if (Array.isArray(sectors)) {
    const normDeg = normalizeSectorDeg(angleDeg);
    for (const s of sectors) {
      if (normDeg >= s.startDeg - 0.01 && normDeg <= s.endDeg + 0.01) {
        return s.normal;
      }
    }
  }
  const rad = ((angleDeg || 0) * Math.PI) / 180;
  return [Math.sin(rad), 0, Math.cos(rad)];
}

/**
 * Evaluates whether a wall-mounted fixture at sectorNormal is hidden by active wall cutaway.
 * Matches engine.js updateCutawayVisibility() math exactly (dot > 0.14).
 * @param {object|undefined} state
 * @param {number} roomRadius
 * @param {[number, number, number]} sectorNormal
 * @returns {boolean}
 */
function isSectorCutAway(state, roomRadius, sectorNormal) {
  if (!state || !state.cutaway || state.mode === 'first-person' || !state.camera) {
    return false;
  }
  const dx = state.camera.position.x;
  const dz = state.camera.position.z;
  const distXZ = Math.hypot(dx, dz);
  if (distXZ <= roomRadius * 0.85 || distXZ < 1e-5) {
    return false;
  }
  const dot = (dx / distXZ) * sectorNormal[0] + (dz / distXZ) * sectorNormal[2];
  return dot > 0.14;
}

/**
 * Assigns `.userData.canonId` across an Object3D subtree, configures shadows
 * (respecting `userData.noShadow` and `userData.noCastShadow`), and returns
 * raycastable Mesh descendants (excluding `userData.noRaycast`).
 * @param {THREE.Object3D} root
 * @param {string} canonId
 * @returns {THREE.Mesh[]}
 */
function finalizeCanonMeshes(root, canonId) {
  const hitMeshes = [];
  root.userData.canonId = canonId;
  root.traverse((obj) => {
    obj.userData.canonId = canonId;
    if (obj.isMesh) {
      if (obj.userData.noShadow) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      } else {
        obj.castShadow = obj.userData.noCastShadow ? false : true;
        obj.receiveShadow = true;
      }
      if (!obj.userData.noRaycast && !obj.userData.isHighlightOverlay) {
        hitMeshes.push(obj);
      }
    }
  });
  return hitMeshes;
}

/**
 * Helper to resolve canonical object metadata safely from canonData.
 * @param {object} canonData
 * @param {string} id
 * @param {string} fallbackName
 * @param {string} fallbackCategory
 * @param {string[]} fallbackActions
 */
function getCanonMeta(canonData, id, fallbackName, fallbackCategory, fallbackActions = []) {
  const obj = canonData?.CANON_OBJECTS?.[id];
  return {
    name: obj?.name || fallbackName,
    category: obj?.category || fallbackCategory,
    actions: Array.isArray(obj?.actions) ? obj.actions.map((a) => a.id) : fallbackActions,
  };
}

/**
 * Safely normalizes and merges an array of BufferGeometries into one geometry,
 * preserving UVs and normals cleanly and disposing intermediate clones.
 * @param {THREE.BufferGeometry[]} geometries
 * @returns {THREE.BufferGeometry}
 */
function safeMergeGeometries(geometries) {
  const prepared = [];
  for (const g of geometries) {
    if (!g) continue;
    const nonIdx = g.index ? g.toNonIndexed() : g.clone();
    if (!nonIdx.getAttribute('normal')) {
      nonIdx.computeVertexNormals();
    }
    const pos = nonIdx.getAttribute('position');
    if (!nonIdx.getAttribute('uv') && pos) {
      const uvArr = new Float32Array(pos.count * 2);
      nonIdx.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    }
    // Strip extra attributes like tangent if inconsistent across primitives
    for (const key of Object.keys(nonIdx.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') {
        nonIdx.deleteAttribute(key);
      }
    }
    prepared.push(nonIdx);
  }
  if (prepared.length === 0) return new THREE.BufferGeometry();
  if (prepared.length === 1) return prepared[0];
  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  return merged || new THREE.BufferGeometry();
}

/**
 * Builds a watertight 45-degree mitered rectangular frame geometry by sweeping
 * a closed 2D cross-section profile `[[r, z], ...]` (ordered clockwise in (r, +z))
 * around an inner rectangle of size (innerW x innerH).
 * @param {number} innerW
 * @param {number} innerH
 * @param {[number, number][]} profile
 * @returns {THREE.BufferGeometry}
 */
function createMiteredFrameGeometry(innerW, innerH, profile) {
  const hw = innerW * 0.5;
  const hh = innerH * 0.5;
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  // Compute cumulative perimeter U along profile for consistent texture mapping
  const profLen = [0];
  for (let i = 1; i < profile.length; i++) {
    const dr = profile[i][0] - profile[i - 1][0];
    const dz = profile[i][1] - profile[i - 1][1];
    profLen.push(profLen[i - 1] + Math.hypot(dr, dz));
  }
  const totalProf = profLen[profLen.length - 1] || 1;

  const positions = [];
  const uvs = [];
  const barLens = [innerW, innerH, innerW, innerH];

  const getCornerPos = (cIdx, r, z) => {
    const [sx, sy] = signs[cIdx];
    return [sx * (hw + r), sy * (hh + r), z];
  };

  for (let edge = 0; edge < 4; edge++) {
    const c0 = edge;
    const c1 = (edge + 1) % 4;
    const uScale = Math.max(0.25, barLens[edge] * 1.4);

    for (let i = 0; i < profile.length - 1; i++) {
      const [rA, zA] = profile[i];
      const [rB, zB] = profile[i + 1];
      if (Math.abs(rB - rA) < 1e-6 && Math.abs(zB - zA) < 1e-6) continue;

      const v00 = getCornerPos(c0, rA, zA);
      const v10 = getCornerPos(c1, rA, zA);
      const v01 = getCornerPos(c0, rB, zB);
      const v11 = getCornerPos(c1, rB, zB);

      const vA = (profLen[i] / totalProf) * 1.2;
      const vB = (profLen[i + 1] / totalProf) * 1.2;

      positions.push(
        v00[0], v00[1], v00[2],
        v01[0], v01[1], v01[2],
        v11[0], v11[1], v11[2],

        v00[0], v00[1], v00[2],
        v11[0], v11[1], v11[2],
        v10[0], v10[1], v10[2]
      );
      uvs.push(
        0, vA,
        0, vB,
        uScale, vB,

        0, vA,
        uScale, vB,
        uScale, vA
      );
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Determines the ground contact-shadow Y coordinate so shadows rest at y = 0.004
 * on bare stone flagstones and sit cleanly at y = 0.016 above the woven carpet
 * (`CARPET.y + 0.006 = 0.014`) where furniture stands on the rug.
 * @param {object} layout
 * @param {number} worldX
 * @param {number} worldZ
 * @returns {number}
 */
function getContactShadowY(layout, worldX, worldZ) {
  const carpet = layout?.CARPET;
  if (carpet && carpet.radiusX > 0 && carpet.radiusZ > 0) {
    const nx = (worldX - (carpet.x || 0)) / carpet.radiusX;
    const nz = (worldZ - (carpet.z || 0)) / carpet.radiusZ;
    if (nx * nx + nz * nz <= 1.0) {
      return Number(((carpet.y ?? 0.008) + 0.008).toFixed(4));
    }
  }
  return 0.004;
}

/**
 * Creates a fallback soft radial contact-shadow material when `materials.createContactShadowMaterial`
 * is unavailable (e.g. headless tests or older material stubs).
 * @returns {THREE.MeshBasicMaterial}
 */
function createFallbackContactShadowMaterial() {
  let tex;
  if (typeof document !== 'undefined') {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, 4, size * 0.5, size * 0.5, size * 0.5);
      grad.addColorStop(0.0, 'rgba(10, 7, 5, 0.58)');
      grad.addColorStop(0.5, 'rgba(10, 7, 5, 0.28)');
      grad.addColorStop(0.85, 'rgba(10, 7, 5, 0.06)');
      grad.addColorStop(1.0, 'rgba(10, 7, 5, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
    }
  }
  if (!tex) {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x / (size - 1)) * 2 - 1;
        const dy = (y / (size - 1)) * 2 - 1;
        const d = Math.min(1, Math.hypot(dx, dy));
        const a = Math.pow(1 - d, 2.1) * 0.55;
        const idx = (y * size + x) * 4;
        data[idx] = 10;
        data[idx + 1] = 7;
        data[idx + 2] = 5;
        data[idx + 3] = Math.round(a * 255);
      }
    }
    tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
  }

  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * Helper building a horizontal soft ground contact-shadow plane beneath grounded furniture.
 * Tagged `noRaycast = true`, `noShadow = true` so it never interferes with picking, highlights, or shadow maps.
 * @param {THREE.Material} shadowMat
 * @param {number} width
 * @param {number} depth
 * @param {number} y
 * @returns {THREE.Mesh}
 */
function createGroundContactShadow(shadowMat, width, depth, y = 0.004) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), shadowMat);
  plane.rotation.x = -Math.PI * 0.5;
  plane.position.y = y;
  plane.renderOrder = 1;
  plane.userData.noRaycast = true;
  plane.userData.noShadow = true;
  plane.userData.noCastShadow = true;
  return plane;
}

/**
 * Builds shared furniture accent materials (dark bronze shadow cove, leather blotter,
 * crimson sealing wax, midnight ink, swan feather quill, and soft drop shadows).
 * @param {object} materials
 */
function createFurnitureAuxMaterials(materials) {
  const contactShadowMat =
    (typeof materials.createContactShadowMaterial === 'function'
      ? materials.createContactShadowMaterial()
      : null) || createFallbackContactShadowMaterial();
  if (contactShadowMat) {
    contactShadowMat.polygonOffset = true;
    contactShadowMat.polygonOffsetFactor = -1;
    contactShadowMat.polygonOffsetUnits = -1;
  }

  const darkBronzeFrame = new THREE.MeshStandardMaterial({
    name: 'baroqueBronzeShadowCove',
    color: new THREE.Color('#2c2015'),
    roughnessMap: materials.antiqueBrass?.roughnessMap || null,
    normalMap: materials.antiqueBrass?.normalMap || null,
    bumpMap: materials.antiqueBrass?.bumpMap || null,
    bumpScale: 0.008,
    metalness: 0.72,
    roughness: 0.42,
  });

  const darkOakRecess = new THREE.MeshStandardMaterial({
    name: 'darkOakPanelRecess',
    map: materials.darkCarvedOak?.map || null,
    normalMap: materials.darkCarvedOak?.normalMap || null,
    bumpMap: materials.darkCarvedOak?.bumpMap || null,
    bumpScale: 0.015,
    color: new THREE.Color('#5a4332'),
    roughness: 0.74,
    metalness: 0.03,
  });

  const leatherBlotter = new THREE.MeshPhysicalMaterial({
    name: 'deskLeatherBlotter',
    color: new THREE.Color('#2a1514'),
    roughness: 0.56,
    metalness: 0.04,
    clearcoat: 0.14,
    clearcoatRoughness: 0.42,
  });

  const crimsonWax = new THREE.MeshPhysicalMaterial({
    name: 'crimsonWaxSeal',
    color: new THREE.Color('#7c1118'),
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });

  const darkInk = new THREE.MeshPhysicalMaterial({
    name: 'midnightInk',
    color: new THREE.Color('#090d18'),
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 0.9,
  });

  const glassInkwell =
    materials.crystalPhial ||
    new THREE.MeshPhysicalMaterial({
      name: 'inkwellCrystalFallback',
      color: new THREE.Color('#dceeff'),
      roughness: 0.07,
      metalness: 0.04,
      transparent: true,
      opacity: 0.56,
      ior: 1.52,
    });

  const swanFeather = new THREE.MeshStandardMaterial({
    name: 'swanFeatherQuill',
    color: new THREE.Color('#ede4cf'),
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const wallMountShadow = new THREE.MeshBasicMaterial({
    map: contactShadowMat.map || null,
    color: new THREE.Color('#0a0806'),
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  return {
    contactShadowMat,
    darkBronzeFrame,
    darkOakRecess,
    leatherBlotter,
    crimsonWax,
    darkInk,
    glassInkwell,
    swanFeather,
    wallMountShadow,
  };
}

/**
 * Generates an antique engraved brass nameplate texture for named Headmaster portraits.
 * Returns null cleanly when running in headless Node without Canvas 2D.
 * @param {string} title
 * @returns {THREE.CanvasTexture|null}
 */
function createBrassPlaqueTexture(title) {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Aged brushed brass plate gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#9c7830');
  grad.addColorStop(0.28, '#cfa54d');
  grad.addColorStop(0.55, '#b68c39');
  grad.addColorStop(0.82, '#d9b25a');
  grad.addColorStop(1, '#8c6926');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal brushed patina lines
  ctx.strokeStyle = 'rgba(42, 28, 10, 0.14)';
  ctx.lineWidth = 1;
  for (let y = 2; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Dark recessed engraved inner border
  ctx.strokeStyle = '#38250c';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = 'rgba(252, 224, 146, 0.48)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  // Corner engraved rivets
  for (const [rx, ry] of [
    [24, 24],
    [w - 24, 24],
    [24, h - 24],
    [w - 24, h - 24],
  ]) {
    ctx.fillStyle = '#3c270d';
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c46d';
    ctx.beginPath();
    ctx.arc(rx - 1, ry - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Engraved dark-patina serif lettering with subtle metallic bevel highlight
  const cleanTitle = String(title || '').toUpperCase();
  const fontSize = cleanTitle.length > 18 ? 24 : 28;
  ctx.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(255, 232, 166, 0.42)';
  ctx.fillText(cleanTitle, w * 0.5 + 1, h * 0.5 + 1.5);
  ctx.fillStyle = '#241607';
  ctx.fillText(cleanTitle, w * 0.5, h * 0.5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a reusable sculpted baroque corner acanthus rosette cluster geometry.
 * Centered at (0, 0, 0) oriented in the +X/+Y corner quadrant (rotate by corner angle).
 * @param {number} scale
 * @returns {THREE.BufferGeometry}
 */
function createAcanthusRosetteGeometry(scale = 1.0) {
  const parts = [];

  // Central carved floral boss (Lathe)
  const bossProfile = [
    new THREE.Vector2(0.0, 0.018 * scale),
    new THREE.Vector2(0.008 * scale, 0.019 * scale),
    new THREE.Vector2(0.013 * scale, 0.014 * scale),
    new THREE.Vector2(0.022 * scale, 0.011 * scale),
    new THREE.Vector2(0.026 * scale, 0.0),
  ];
  const boss = new THREE.LatheGeometry(bossProfile, 12);
  boss.rotateX(Math.PI * 0.5);
  parts.push(boss);

  // Sculpted extruded acanthus leaf lobe shape
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.014 * scale, 0.018 * scale, 0.008 * scale, 0.044 * scale);
  leafShape.quadraticCurveTo(0.0, 0.056 * scale, -0.008 * scale, 0.044 * scale);
  leafShape.quadraticCurveTo(-0.014 * scale, 0.018 * scale, 0, 0);

  const leafGeoBase = new THREE.ExtrudeGeometry(leafShape, {
    depth: 0.007 * scale,
    bevelEnabled: true,
    bevelThickness: 0.003 * scale,
    bevelSize: 0.003 * scale,
    bevelSegments: 2,
    curveSegments: 8,
  });

  // 3 radiating acanthus petals framing the corner miter + 2 side scroll buds
  const angles = [-0.55, 0.0, 0.55, -1.22, 1.22];
  const scales = [0.9, 1.15, 0.9, 0.72, 0.72];
  for (let i = 0; i < angles.length; i++) {
    const g = leafGeoBase.clone();
    g.scale(scales[i], scales[i], 1);
    g.rotateZ(angles[i]);
    g.translate(0, 0, 0.002 * scale);
    parts.push(g);
  }
  leafGeoBase.dispose();

  return safeMergeGeometries(parts);
}

/**
 * Builds a reusable sculpted baroque scroll pediment crest geometry for the top center of frames.
 * @param {number} widthScale
 * @returns {THREE.BufferGeometry}
 */
function createBaroqueCrestGeometry(widthScale = 1.0) {
  const parts = [];
  const s = widthScale;

  // Central scallop shell cartouche
  const shell = new THREE.SphereGeometry(0.042 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  shell.scale(1.15, 0.85, 0.52);
  shell.rotateX(Math.PI * 0.2);
  shell.translate(0, 0.022 * s, 0.006 * s);
  parts.push(shell);

  // Fluted radiating shell ribs
  for (let i = -3; i <= 3; i++) {
    const rib = new THREE.CapsuleGeometry(0.004 * s, 0.028 * s, 3, 6);
    rib.rotateZ(i * 0.24);
    rib.translate(Math.sin(i * 0.24) * 0.024 * s, 0.024 * s, 0.018 * s);
    parts.push(rib);
  }

  // Symmetrical baroque S-scroll volutes left & right
  for (const dir of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dir * 0.035 * s, 0.012 * s, 0.008 * s),
      new THREE.Vector3(dir * 0.072 * s, 0.032 * s, 0.012 * s),
      new THREE.Vector3(dir * 0.118 * s, 0.016 * s, 0.009 * s),
      new THREE.Vector3(dir * 0.145 * s, -0.004 * s, 0.005 * s),
    ]);
    parts.push(new THREE.TubeGeometry(curve, 16, 0.010 * s, 8, false));

    const volute = new THREE.SphereGeometry(0.014 * s, 10, 8);
    volute.scale(1, 1, 0.75);
    volute.translate(dir * 0.105 * s, 0.014 * s, 0.011 * s);
    parts.push(volute);
  }

  return safeMergeGeometries(parts);
}

/**
 * Creates a sculpted antique brass lion-ring drawer pull (rosette backplate,
 * sculpted 3D lion head boss, and hanging circular brass ring).
 * @param {object} materials
 * @returns {THREE.Group}
 */
function createLionRingPull(materials) {
  const pull = new THREE.Group();

  // Ornate circular backplate
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.024, 0.005, 16),
    materials.antiqueBrass
  );
  plate.rotation.x = Math.PI * 0.5;
  plate.position.z = 0.0025;
  pull.add(plate);

  // Scalloped outer rope bezel
  const bezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.020, 0.0032, 8, 18),
    materials.antiqueBrass
  );
  bezel.position.z = 0.004;
  pull.add(bezel);

  // Sculpted lion mane ruff & crown
  const mane = new THREE.Mesh(
    new THREE.TorusGeometry(0.0105, 0.0048, 8, 12),
    materials.antiqueBrass
  );
  mane.position.set(0, 0.002, 0.009);
  pull.add(mane);

  // Lion skull, brow & snout bridge
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.0095, 10, 8),
    materials.antiqueBrass
  );
  head.scale.set(0.95, 1.05, 0.85);
  head.position.set(0, 0.003, 0.0105);
  pull.add(head);

  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.0055, 8, 6),
    materials.antiqueBrass
  );
  muzzle.scale.set(1.1, 0.78, 0.9);
  muzzle.position.set(0, -0.001, 0.0175);
  pull.add(muzzle);

  // Heavy hanging brass ring clenched in the lion's jaw
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.017, 0.0034, 8, 20),
    materials.antiqueBrass
  );
  ring.rotation.x = 0.16;
  ring.position.set(0, -0.016, 0.016);
  pull.add(ring);

  return pull;
}

/**
 * Creates a sculpted wooden ball-and-claw cabriole desk foot resting squarely at local y = 0.
 * Features a carved oak sphere gripped by 4 curved TubeGeometry wooden talons and an S-curved
 * cabriole haunch topped with a carved acanthus knee scroll and brass ankle collar.
 * @param {object} materials
 * @param {number} scale
 * @returns {THREE.Group}
 */
function createClawFoot(materials, scale = 1.0) {
  const foot = new THREE.Group();

  // Carved oak sphere flattened slightly at base so bottom rests flush at y = 0
  const ballRadius = 0.032 * scale;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 20, 14),
    materials.darkCarvedOak
  );
  ball.scale.set(1.10, 0.86, 1.10);
  ball.position.y = ballRadius * 0.86;
  foot.add(ball);

  // 4 sculpted curved wooden talons (TubeGeometry) gripping the oak sphere
  const clawAngles = [-0.84, -0.28, 0.28, 0.84];
  for (const ang of clawAngles) {
    const toeGroup = new THREE.Group();
    toeGroup.rotation.y = ang;

    // Curved arched toe spline hugging the top & front of the oak sphere
    const toeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.068 * scale, 0.010 * scale),
      new THREE.Vector3(0, 0.056 * scale, 0.027 * scale),
      new THREE.Vector3(0, 0.036 * scale, 0.038 * scale),
      new THREE.Vector3(0, 0.015 * scale, 0.036 * scale),
    ]);
    const toeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(toeCurve, 14, 0.0072 * scale, 8, false),
      materials.darkCarvedOak
    );
    toeGroup.add(toeMesh);

    // Carved knuckle joint boss midway along each wooden toe
    const knuckle = new THREE.Mesh(
      new THREE.SphereGeometry(0.0085 * scale, 10, 8),
      materials.darkCarvedOak
    );
    knuckle.scale.set(1.05, 0.9, 1.15);
    knuckle.position.set(0, 0.044 * scale, 0.034 * scale);
    toeGroup.add(knuckle);

    // Sharp curved wooden talon tip gripping just above y = 0
    const talon = new THREE.Mesh(
      new THREE.ConeGeometry(0.0065 * scale, 0.018 * scale, 8),
      materials.darkCarvedOak
    );
    talon.rotation.x = Math.PI * 0.88;
    talon.position.set(0, 0.0135 * scale, 0.033 * scale);
    toeGroup.add(talon);

    foot.add(toeGroup);
  }

  // S-curved cabriole haunch sweeping from ankle up to plinth corner (y = 0.20 * scale)
  const cabrioleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.058 * scale, 0),
    new THREE.Vector3(0, 0.105 * scale, 0.018 * scale),
    new THREE.Vector3(0, 0.152 * scale, 0.014 * scale),
    new THREE.Vector3(0, 0.195 * scale, -0.004 * scale),
  ]);
  const cabrioleShaft = new THREE.Mesh(
    new THREE.TubeGeometry(cabrioleCurve, 18, 0.034 * scale, 12, false),
    materials.darkCarvedOak
  );
  cabrioleShaft.scale.set(1.12, 1.0, 1.05);
  foot.add(cabrioleShaft);

  // Carved cabriole knee swell & capital socket under plinth
  const kneeSwell = new THREE.Mesh(
    new THREE.SphereGeometry(0.042 * scale, 14, 10),
    materials.darkCarvedOak
  );
  kneeSwell.scale.set(1.0, 1.15, 1.0);
  kneeSwell.position.set(0, 0.145 * scale, 0.015 * scale);
  foot.add(kneeSwell);

  const topSocket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052 * scale, 0.038 * scale, 0.042 * scale, 14),
    materials.darkCarvedOak
  );
  topSocket.position.set(0, 0.184 * scale, -0.002 * scale);
  foot.add(topSocket);

  // Antique brass ankle collar ring
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.033 * scale, 0.0045 * scale, 8, 18),
    materials.antiqueBrass
  );
  collar.rotation.x = Math.PI * 0.5;
  collar.position.y = 0.068 * scale;
  foot.add(collar);

  return foot;
}

/**
 * Adds a deeply inset recessed oak panel with 45° mitered ogee molding trim
 * and raised beveled center field plate.
 * @param {THREE.Group} parent
 * @param {object} materials
 * @param {object} auxMats
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @returns {THREE.Group}
 */
function createRaisedOakPanel(parent, materials, auxMats, width, height, depth = 0.022) {
  const panelGroup = new THREE.Group();

  // Deep shadow recess backplate
  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.024, height - 0.024, 0.008),
    auxMats.darkOakRecess
  );
  recess.position.z = 0.002;
  panelGroup.add(recess);

  // 45° mitered outer trim molding framing the recessed panel
  const trimW = 0.024;
  const innerW = Math.max(0.04, width - trimW * 2);
  const innerH = Math.max(0.03, height - trimW * 2);
  const trimProfile = [
    [0.0, 0.0],
    [0.0, depth * 0.72],
    [trimW * 0.45, depth],
    [trimW, depth * 0.78],
    [trimW, 0.0],
    [0.0, 0.0],
  ];
  const miterTrim = new THREE.Mesh(
    createMiteredFrameGeometry(innerW, innerH, trimProfile),
    materials.darkCarvedOak
  );
  panelGroup.add(miterTrim);

  // Chamfered raised oak center field plate inside the shadow cove
  const fieldW = Math.max(0.02, innerW - 0.028);
  const fieldH = Math.max(0.02, innerH - 0.024);
  const fieldShape = new THREE.Shape();
  fieldShape.moveTo(-fieldW * 0.5, -fieldH * 0.5);
  fieldShape.lineTo(fieldW * 0.5, -fieldH * 0.5);
  fieldShape.lineTo(fieldW * 0.5, fieldH * 0.5);
  fieldShape.lineTo(-fieldW * 0.5, fieldH * 0.5);
  fieldShape.closePath();

  const insetPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(fieldShape, {
      depth: depth * 0.36,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.007,
      bevelSegments: 2,
    }),
    materials.darkCarvedOak
  );
  insetPlate.position.z = 0.007;
  panelGroup.add(insetPlate);

  // Corner brass studs when panel is tall enough
  if (height > 0.14) {
    const rx = width * 0.5 - 0.024;
    const ry = height * 0.5 - 0.024;
    for (const [cx, cy] of [
      [-rx, -ry],
      [rx, -ry],
      [-rx, ry],
      [rx, ry],
    ]) {
      const stud = new THREE.Mesh(
        new THREE.SphereGeometry(0.0065, 8, 6),
        materials.antiqueBrass
      );
      stud.position.set(cx, cy, depth * 0.85);
      panelGroup.add(stud);
    }
  }

  parent.add(panelGroup);
  return panelGroup;
}

/**
 * Builds a single drawer front with deeply inset mitered trim, keyhole escutcheon,
 * and sculpted brass lion-ring drawer pulls.
 * @param {object} materials
 * @param {object} auxMats
 * @param {number} width
 * @param {number} height
 * @param {boolean} singlePull
 * @returns {THREE.Group}
 */
function createDeskDrawerFront(materials, auxMats, width, height, singlePull = false) {
  const drawer = new THREE.Group();

  // Drawer carcass base
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.018),
    materials.darkCarvedOak
  );
  drawer.add(face);

  // Recessed shadow border
  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.024, height - 0.02, 0.006),
    auxMats.darkOakRecess
  );
  recess.position.z = 0.008;
  drawer.add(recess);

  // 45° mitered beveled drawer frame
  const trimW = Math.min(0.018, height * 0.2);
  const innerW = Math.max(0.04, width - trimW * 2);
  const innerH = Math.max(0.022, height - trimW * 2);
  const miterGeo = createMiteredFrameGeometry(innerW, innerH, [
    [0.0, 0.008],
    [0.0, 0.021],
    [trimW * 0.55, 0.023],
    [trimW, 0.018],
    [trimW, 0.008],
    [0.0, 0.008],
  ]);
  drawer.add(new THREE.Mesh(miterGeo, materials.darkCarvedOak));

  // Raised center drawer panel
  const inset = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.02, innerW - 0.018), Math.max(0.016, innerH - 0.016), 0.010),
    materials.darkCarvedOak
  );
  inset.position.z = 0.013;
  drawer.add(inset);

  // Brass keyhole escutcheon shield at center
  const escutcheon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.005, 12),
    materials.antiqueBrass
  );
  escutcheon.rotation.x = Math.PI * 0.5;
  escutcheon.scale.set(0.82, 1, 1.35);
  escutcheon.position.set(0, 0, 0.019);
  drawer.add(escutcheon);

  // Sculpted brass lion-ring pulls
  const pullXs = singlePull ? [0] : [-width * 0.28, width * 0.28];
  for (const px of pullXs) {
    const pull = createLionRingPull(materials);
    pull.position.set(px, 0.002, 0.018);
    if (height < 0.09) {
      pull.scale.setScalar(0.76);
    }
    drawer.add(pull);
  }

  return drawer;
}

/**
 * Helper building a horizontal chamfered rectangular ExtrudeGeometry slab for
 * multi-tier cornice & plinth moldings and the beveled desktop slab.
 * Top surface is strictly aligned at local y = 0, extending downward by `totalHeight`.
 * @param {number} width
 * @param {number} depth
 * @param {number} totalHeight
 * @param {number} bevel
 * @param {number} cornerRadius
 * @returns {THREE.ExtrudeGeometry}
 */
function createBeveledHorizontalSlabGeo(width, depth, totalHeight, bevel = 0.008, cornerRadius = 0.015) {
  const hw = Math.max(0.02, width * 0.5 - bevel);
  const hd = Math.max(0.02, depth * 0.5 - bevel);
  const r = Math.min(cornerRadius, hw * 0.4, hd * 0.4);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const coreDepth = Math.max(0.004, totalHeight - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // Rotate so extrusion lies along +Y, then shift so max.y === 0
  geo.rotateX(-Math.PI * 0.5);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    geo.translate(0, -geo.boundingBox.max.y, 0);
  }
  return geo;
}

/**
 * Builds a single hollow spiraled parchment scroll geometry so scroll ends show
 * authentic layered spiral paper curls.
 * @param {number} length
 * @param {number} outerRadius
 * @returns {THREE.BufferGeometry}
 */
function createCurledScrollGeometry(length = 0.28, outerRadius = 0.022) {
  const segs = 32;
  const turns = 2.15;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * Math.PI * 2 * turns;
    const r = outerRadius * (0.38 + 0.62 * t);
    pts.push(new THREE.Vector2(Math.cos(ang) * r, Math.sin(ang) * r));
  }

  const positions = [];
  const uvs = [];
  const halfL = length * 0.5;
  for (let i = 0; i < segs; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const u0 = i / segs;
    const u1 = (i + 1) / segs;
    // Strip along X from -halfL to +halfL
    positions.push(
      -halfL, p0.y, p0.x,
      halfL, p0.y, p0.x,
      halfL, p1.y, p1.x,

      -halfL, p0.y, p0.x,
      halfL, p1.y, p1.x,
      -halfL, p1.y, p1.x
    );
    uvs.push(
      0, u0,
      1, u0,
      1, u1,

      0, u0,
      1, u1,
      0, u1
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a gently curled parchment sheet geometry resting cleanly at y >= 0.
 * @param {number} width
 * @param {number} depth
 * @param {number} curlHeight
 * @returns {THREE.PlaneGeometry}
 */
function createCurledParchmentSheetGeo(width, depth, curlHeight = 0.008) {
  const geo = new THREE.PlaneGeometry(width, depth, 10, 12);
  geo.rotateX(-Math.PI * 0.5);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = (x / (width * 0.5));
    const nz = (z / (depth * 0.5));
    const cornerWave = Math.max(0, (nx * 0.5 + 0.5) * (nz * 0.5 + 0.5) - 0.35);
    const edgeCurl = Math.pow(Math.max(0, Math.abs(nx) - 0.65) / 0.35, 2) * 0.35;
    pos.setY(i, (cornerWave + edgeCurl) * curlHeight);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 1. Enormous Claw-Footed Desk (`claw-footed-desk`)
 * Centered at layout.DESK ([0, 0, -1.45]), top surface at exact layout.DESK.topY (0.82).
 * Keeps PENSIEVE_DESK_POS ([0, 0.82, -1.35]) & MEMORY_PHIALS_OFFSETS cleanly unobstructed.
 */
function buildClawFootedDesk(materials, auxMats, layout) {
  const spec = layout.DESK;
  const deskGroup = new THREE.Group();
  deskGroup.name = 'ClawFootedDesk';
  deskGroup.position.set(spec.x, spec.y, spec.z);
  deskGroup.rotation.y = spec.rotationY || 0;

  const W = spec.width; // 2.45
  const D = spec.depth; // 1.15
  const topY = spec.topY; // 0.82

  // Ground Contact Shadow centered beneath the desk
  deskGroup.add(
    createGroundContactShadow(
      auxMats.contactShadowMat,
      W * 1.12,
      D * 1.24,
      getContactShadowY(layout, spec.x, spec.z)
    )
  );

  // 4 massive outer claw feet + 4 inner pedestal claw feet resting squarely at y = 0
  const pedXOffsets = [-0.83, 0.83];
  const pedW = 0.66;
  const pedD = 0.96;

  for (const px of pedXOffsets) {
    const isLeft = px < 0;
    const outerX = px + (isLeft ? -pedW * 0.42 : pedW * 0.42);
    const innerX = px + (isLeft ? pedW * 0.40 : -pedW * 0.40);

    for (const fz of [-pedD * 0.44, pedD * 0.44]) {
      const outerClaw = createClawFoot(materials, 1.16);
      outerClaw.position.set(outerX, 0, fz);
      outerClaw.rotation.y = Math.atan2(outerX - px, fz);
      deskGroup.add(outerClaw);

      const innerClaw = createClawFoot(materials, 0.92);
      innerClaw.position.set(innerX, 0, fz);
      innerClaw.rotation.y = Math.atan2(innerX - px, fz);
      deskGroup.add(innerClaw);
    }

    // Multi-tier beveled carved oak plinth moldings above feet (y = 0.16..0.228)
    const plinthBottom = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(pedW + 0.056, pedD + 0.056, 0.026, 0.006, 0.014),
      materials.darkCarvedOak
    );
    plinthBottom.position.set(px, 0.186, 0);
    deskGroup.add(plinthBottom);

    const plinthMid = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(pedW + 0.032, pedD + 0.032, 0.024, 0.005, 0.012),
      materials.darkCarvedOak
    );
    plinthMid.position.set(px, 0.210, 0);
    deskGroup.add(plinthMid);

    const plinthCap = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(pedW + 0.012, pedD + 0.012, 0.018, 0.004, 0.01),
      materials.darkCarvedOak
    );
    plinthCap.position.set(px, 0.228, 0);
    deskGroup.add(plinthCap);

    // Main pedestal carcass (y = 0.228..0.67)
    const pedBody = new THREE.Mesh(
      new THREE.BoxGeometry(pedW, 0.442, pedD),
      materials.darkCarvedOak
    );
    pedBody.position.set(px, 0.449, 0);
    deskGroup.add(pedBody);

    // Fluted corner pilasters with turned base collar & carved capital on each pedestal
    for (const cx of [-pedW * 0.5, pedW * 0.5]) {
      for (const cz of [-pedD * 0.5, pedD * 0.5]) {
        const pilX = px + cx * 0.96;
        const pilZ = cz * 0.96;
        const pilaster = new THREE.Mesh(
          new THREE.CylinderGeometry(0.021, 0.023, 0.42, 12),
          materials.darkCarvedOak
        );
        pilaster.position.set(pilX, 0.449, pilZ);
        deskGroup.add(pilaster);

        for (const ringY of [0.242, 0.656]) {
          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.027, 0.027, 0.02, 12),
            materials.darkCarvedOak
          );
          cap.position.set(pilX, ringY, pilZ);
          deskGroup.add(cap);
        }
      }
    }

    // Visitor-facing front (+Z) mitered raised oak panel on each pedestal
    const frontPanel = createRaisedOakPanel(deskGroup, materials, auxMats, pedW - 0.12, 0.36);
    frontPanel.position.set(px, 0.449, pedD * 0.5 + 0.002);

    // Outer side (-X or +X) mitered raised oak panel
    const sidePanel = createRaisedOakPanel(deskGroup, materials, auxMats, pedD - 0.16, 0.36);
    sidePanel.position.set(px + (isLeft ? -pedW * 0.5 - 0.002 : pedW * 0.5 + 0.002), 0.449, 0);
    sidePanel.rotation.y = isLeft ? -Math.PI * 0.5 : Math.PI * 0.5;

    // Headmaster-facing (-Z) 3 recessed mitered drawers per pedestal with brass lion-ring pulls
    for (let dIdx = 0; dIdx < 3; dIdx++) {
      const drawer = createDeskDrawerFront(materials, auxMats, pedW - 0.11, 0.122, false);
      drawer.position.set(px, 0.295 + dIdx * 0.148, -pedD * 0.5 - 0.006);
      drawer.rotation.y = Math.PI;
      deskGroup.add(drawer);
    }
  }

  // Central recessed paneled modesty front across kneehole (visitor +Z side, y = 0.228..0.67)
  const modesty = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.442, 0.055),
    materials.darkCarvedOak
  );
  modesty.position.set(0, 0.449, 0.32);
  deskGroup.add(modesty);

  const modestyPanelLeft = createRaisedOakPanel(deskGroup, materials, auxMats, 0.44, 0.36);
  modestyPanelLeft.position.set(-0.25, 0.449, 0.348);
  const modestyPanelRight = createRaisedOakPanel(deskGroup, materials, auxMats, 0.44, 0.36);
  modestyPanelRight.position.set(0.25, 0.449, 0.348);

  // Upper full-width frieze apron (y = 0.67..0.755)
  const apronW = W - 0.11;
  const apronD = D - 0.11;
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(apronW, 0.085, apronD),
    materials.darkCarvedOak
  );
  apron.position.set(0, 0.7125, 0);
  deskGroup.add(apron);

  // Frieze carved mitered panels on visitor-facing (+Z) side & lion-ring drawers on (-Z) side
  for (const [fx, fw] of [
    [-0.82, 0.56],
    [0.0, 0.92],
    [0.82, 0.56],
  ]) {
    const frontFrieze = createRaisedOakPanel(deskGroup, materials, auxMats, fw, 0.066, 0.014);
    frontFrieze.position.set(fx, 0.7125, apronD * 0.5 + 0.002);

    const backDrawer = createDeskDrawerFront(materials, auxMats, fw, 0.068, fw < 0.7);
    backDrawer.position.set(fx, 0.7125, -apronD * 0.5 - 0.006);
    backDrawer.rotation.y = Math.PI;
    deskGroup.add(backDrawer);
  }

  // Multi-tier stepped carved oak cornice under desktop (y = 0.755..0.790)
  const corniceTier1 = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(W - 0.08, D - 0.08, 0.018, 0.004, 0.014),
    materials.darkCarvedOak
  );
  corniceTier1.position.set(0, 0.773, 0);
  deskGroup.add(corniceTier1);

  const corniceTier2 = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(W - 0.036, D - 0.036, 0.018, 0.005, 0.016),
    materials.darkCarvedOak
  );
  corniceTier2.position.set(0, 0.790, 0);
  deskGroup.add(corniceTier2);

  // Main beveled oak tabletop slab: top face strictly at exact topY (0.82)
  const topSlab = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(W, D, 0.032, 0.007, 0.022),
    materials.darkCarvedOak
  );
  topSlab.position.set(0, topY, 0);
  deskGroup.add(topSlab);

  // Subtle perimeter antique brass corner brackets flush along outer corners (clear of center & phials)
  const cornerW = 0.14;
  for (const cx of [-W * 0.5 + cornerW * 0.5 + 0.01, W * 0.5 - cornerW * 0.5 - 0.01]) {
    for (const cz of [-D * 0.5 + 0.024, D * 0.5 - 0.024]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(cornerW, 0.0018, 0.020),
        materials.antiqueBrass
      );
      strip.position.set(cx, topY - 0.0005, cz);
      strip.userData.noCastShadow = true;
      deskGroup.add(strip);
    }
  }

  // High-detail corner writing set (strictly clear of PENSIEVE_DESK_POS & MEMORY_PHIALS_OFFSETS)
  const propsGroup = new THREE.Group();
  propsGroup.position.set(0, topY, 0);

  // 1. Beveled dark leather writing blotter mat on left station (x in [-1.05, -0.51])
  const blotterCenterX = -0.78;
  const blotterCenterZ = 0.04;
  const blotterW = 0.54;
  const blotterD = 0.42;
  const blotterH = 0.005;

  const blotterMatMesh = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(blotterW, blotterD, blotterH, 0.002, 0.012),
    auxMats.leatherBlotter
  );
  blotterMatMesh.position.set(blotterCenterX, blotterH, blotterCenterZ);
  propsGroup.add(blotterMatMesh);

  // Thin gold-tooled border & brass blotter corner protectors
  const borderTrim = new THREE.Mesh(
    createMiteredFrameGeometry(blotterW - 0.05, blotterD - 0.05, [
      [0.0, 0.0],
      [0.0, 0.0012],
      [0.005, 0.0012],
      [0.005, 0.0],
      [0.0, 0.0],
    ]),
    materials.antiqueBrass
  );
  borderTrim.rotation.x = -Math.PI * 0.5;
  borderTrim.position.set(blotterCenterX, blotterH + 0.0002, blotterCenterZ);
  borderTrim.userData.noCastShadow = true;
  propsGroup.add(borderTrim);

  // 2. Curled aged parchment sheets resting on the blotter mat
  const sheet1 = new THREE.Mesh(
    createCurledParchmentSheetGeo(0.23, 0.30, 0.007),
    materials.agedParchment
  );
  sheet1.position.set(-0.83, blotterH + 0.0008, 0.03);
  sheet1.rotation.y = 0.14;
  propsGroup.add(sheet1);

  const sheet2 = new THREE.Mesh(
    createCurledParchmentSheetGeo(0.21, 0.28, 0.009),
    materials.agedParchment
  );
  sheet2.position.set(-0.79, blotterH + 0.0028, 0.055);
  sheet2.rotation.y = -0.08;
  propsGroup.add(sheet2);

  // Deep crimson wax seal with raised Hogwarts stamp ring on parchment corner
  const waxDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.021, 0.004, 16),
    auxMats.crimsonWax
  );
  waxDisk.position.set(-0.72, blotterH + 0.0055, 0.14);
  propsGroup.add(waxDisk);

  const waxRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.011, 0.0022, 6, 16),
    auxMats.crimsonWax
  );
  waxRing.rotation.x = Math.PI * 0.5;
  waxRing.position.set(-0.72, blotterH + 0.0078, 0.14);
  propsGroup.add(waxRing);

  // 3. Faceted refractive glass ink bottle with brass neck & hinged lid (x = -0.56, z = 0.19)
  const inkX = -0.56;
  const inkZ = 0.19;
  const inkBaseY = blotterH;

  const inkBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.027, 0.035, 0.042, 8),
    auxMats.glassInkwell
  );
  inkBody.position.set(inkX, inkBaseY + 0.021, inkZ);
  propsGroup.add(inkBody);

  const inkShoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.027, 0.011, 8),
    auxMats.glassInkwell
  );
  inkShoulder.position.set(inkX, inkBaseY + 0.0475, inkZ);
  propsGroup.add(inkShoulder);

  const inkLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.026, 0.026, 8),
    auxMats.darkInk
  );
  inkLiquid.position.set(inkX, inkBaseY + 0.015, inkZ);
  propsGroup.add(inkLiquid);

  const inkCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.018, 0.012, 14),
    materials.antiqueBrass
  );
  inkCollar.position.set(inkX, inkBaseY + 0.056, inkZ);
  propsGroup.add(inkCollar);

  // Open hinged brass inkwell cap flipped cleanly to one side
  const inkLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.005, 14),
    materials.antiqueBrass
  );
  inkLid.position.set(inkX + 0.022, inkBaseY + 0.068, inkZ);
  inkLid.rotation.z = -1.18;
  propsGroup.add(inkLid);

  // 4. Realistic curved swan-feather quill poised inside the inkwell
  const quillGroup = new THREE.Group();
  quillGroup.position.set(inkX, inkBaseY + 0.046, inkZ);
  quillGroup.rotation.set(0.24, 0.42, -0.22);

  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0),
    new THREE.Vector3(0.004, 0.075, -0.006),
    new THREE.Vector3(0.014, 0.165, -0.018),
    new THREE.Vector3(0.028, 0.245, -0.032),
  ]);
  const quillShaft = new THREE.Mesh(
    new THREE.TubeGeometry(shaftCurve, 18, 0.0024, 7, false),
    auxMats.swanFeather
  );
  quillGroup.add(quillShaft);

  const quillNib = new THREE.Mesh(
    new THREE.ConeGeometry(0.0024, 0.018, 6),
    materials.antiqueBrass
  );
  quillNib.rotation.x = Math.PI;
  quillNib.position.y = -0.008;
  quillGroup.add(quillNib);

  // Sculpted organic barbed swan-feather vane with natural notch & curvature
  const vaneShape = new THREE.Shape();
  vaneShape.moveTo(0, 0.055);
  vaneShape.quadraticCurveTo(0.024, 0.115, 0.022, 0.175);
  vaneShape.lineTo(0.010, 0.188);
  vaneShape.lineTo(0.018, 0.194);
  vaneShape.quadraticCurveTo(0.014, 0.232, 0.002, 0.248);
  vaneShape.quadraticCurveTo(-0.011, 0.222, -0.013, 0.165);
  vaneShape.quadraticCurveTo(-0.012, 0.105, 0, 0.055);

  const vaneGeo = new THREE.ShapeGeometry(vaneShape, 12);
  const vanePos = vaneGeo.getAttribute('position');
  for (let i = 0; i < vanePos.count; i++) {
    const vy = vanePos.getY(i);
    const t = Math.max(0, (vy - 0.055) / 0.195);
    const vx = vanePos.getX(i);
    // Align vane gently along curved shaft & give natural feather camber
    vanePos.setX(i, vx + t * t * 0.024);
    vanePos.setZ(i, -t * t * 0.030 + Math.abs(vx) * 0.18);
  }
  vaneGeo.computeVertexNormals();
  const quillVane = new THREE.Mesh(vaneGeo, auxMats.swanFeather);
  quillVane.userData.noCastShadow = true;
  quillGroup.add(quillVane);
  propsGroup.add(quillGroup);

  // 5. Curled hollow parchment scrolls & red wax seal on back-right corner (x = +0.92, z = -0.32)
  const scrollGroup = new THREE.Group();
  scrollGroup.position.set(0.92, 0.022, -0.32);
  scrollGroup.rotation.y = 0.34;

  const mainScroll = new THREE.Mesh(
    createCurledScrollGeometry(0.28, 0.022),
    materials.agedParchment
  );
  scrollGroup.add(mainScroll);

  const ribbonWrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.020, 16),
    materials.velvetFabric
  );
  ribbonWrap.rotation.z = Math.PI * 0.5;
  scrollGroup.add(ribbonWrap);

  const scrollSeal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.014, 0.005, 14),
    auxMats.crimsonWax
  );
  scrollSeal.position.set(0, 0.024, 0.008);
  scrollSeal.rotation.x = 0.25;
  scrollGroup.add(scrollSeal);

  const secondScroll = new THREE.Mesh(
    createCurledScrollGeometry(0.23, 0.018),
    materials.agedParchment
  );
  secondScroll.position.set(-0.04, -0.004, 0.052);
  secondScroll.rotation.y = -0.22;
  scrollGroup.add(secondScroll);

  propsGroup.add(scrollGroup);
  deskGroup.add(propsGroup);

  return { group: deskGroup, quillGroup };
}

/**
 * 2a. Headmaster's Chair (`headmaster-chair`)
 * Placed at layout.HEADMASTER_CHAIR ([0, 0, -2.6]), topY = 1.48, radius <= 0.42.
 * Turned Gothic finial posts, pierced pointed-arch oak back frame, H-stretchers,
 * and burgundy physical velvet sheen cushion (minimal bridging, strictly NO chintz).
 */
function buildHeadmasterChair(materials, auxMats, layout) {
  const spec = layout.HEADMASTER_CHAIR;
  const chairGroup = new THREE.Group();
  chairGroup.name = 'HeadmasterChair';
  chairGroup.position.set(spec.x, spec.y, spec.z);
  chairGroup.rotation.y = spec.rotationY || 0;

  // Ground contact shadow
  chairGroup.add(
    createGroundContactShadow(
      auxMats.contactShadowMat,
      0.86,
      0.82,
      getContactShadowY(layout, spec.x, spec.z)
    )
  );

  const swivelGroup = new THREE.Group();
  chairGroup.add(swivelGroup);

  const seatY = 0.46;
  const seatW = 0.58;
  const seatD = 0.52;
  const legXs = [-0.25, 0.25];
  const legZs = [-0.22, 0.22];

  // Turned dark oak baluster legs resting squarely at y = 0
  const legProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.015, 0.0),
    new THREE.Vector2(0.022, 0.025),
    new THREE.Vector2(0.014, 0.07),
    new THREE.Vector2(0.025, 0.16),
    new THREE.Vector2(0.016, 0.24),
    new THREE.Vector2(0.026, 0.34),
    new THREE.Vector2(0.020, 0.40),
    new THREE.Vector2(0.029, seatY),
  ];
  const legGeo = new THREE.LatheGeometry(legProfile, 20);

  for (const lx of legXs) {
    for (const lz of legZs) {
      const leg = new THREE.Mesh(legGeo, materials.darkCarvedOak);
      leg.position.set(lx, 0, lz);
      swivelGroup.add(leg);
    }
  }

  // Turned baluster H-stretchers at y = 0.16
  const sideStretcherGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.012, -0.22),
      new THREE.Vector2(0.018, -0.14),
      new THREE.Vector2(0.011, -0.06),
      new THREE.Vector2(0.019, 0.0),
      new THREE.Vector2(0.011, 0.06),
      new THREE.Vector2(0.018, 0.14),
      new THREE.Vector2(0.012, 0.22),
    ],
    14
  );
  for (const lx of legXs) {
    const sideStretcher = new THREE.Mesh(sideStretcherGeo, materials.darkCarvedOak);
    sideStretcher.rotation.x = Math.PI * 0.5;
    sideStretcher.position.set(lx, 0.16, 0);
    swivelGroup.add(sideStretcher);
  }

  const midStretcherGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.012, -0.25),
      new THREE.Vector2(0.018, -0.15),
      new THREE.Vector2(0.012, -0.06),
      new THREE.Vector2(0.022, 0.0),
      new THREE.Vector2(0.012, 0.06),
      new THREE.Vector2(0.018, 0.15),
      new THREE.Vector2(0.012, 0.25),
    ],
    14
  );
  const midStretcher = new THREE.Mesh(midStretcherGeo, materials.darkCarvedOak);
  midStretcher.rotation.z = Math.PI * 0.5;
  midStretcher.position.set(0, 0.16, 0);
  swivelGroup.add(midStretcher);

  // Chamfered beveled oak seat rail frame
  const seatFrame = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(seatW, seatD, 0.056, 0.008, 0.024),
    materials.darkCarvedOak
  );
  seatFrame.position.set(0, seatY + 0.028, 0);
  swivelGroup.add(seatFrame);

  // Plush burgundy physical velvet sheen seat cushion (minimal bridging, ZERO chintz)
  const cushionGeo = createBeveledHorizontalSlabGeo(seatW - 0.06, seatD - 0.06, 0.056, 0.018, 0.045);
  const seatCushion = new THREE.Mesh(cushionGeo, materials.velvetFabric);
  seatCushion.position.set(0, seatY + 0.072, 0.01);
  swivelGroup.add(seatCushion);

  // Carved scrolled oak armrests & turned baluster arm posts
  const armPostGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.021, 0),
      new THREE.Vector2(0.015, 0.05),
      new THREE.Vector2(0.024, 0.11),
      new THREE.Vector2(0.016, 0.17),
      new THREE.Vector2(0.022, 0.215),
    ],
    16
  );

  for (const side of [-1, 1]) {
    const ax = side * 0.27;
    const armPost = new THREE.Mesh(armPostGeo, materials.darkCarvedOak);
    armPost.position.set(ax, seatY + 0.015, 0.195);
    swivelGroup.add(armPost);

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ax, seatY + 0.225, -0.22),
      new THREE.Vector3(ax, seatY + 0.238, -0.02),
      new THREE.Vector3(ax, seatY + 0.228, 0.17),
      new THREE.Vector3(ax, seatY + 0.212, 0.235),
    ]);
    const armRest = new THREE.Mesh(
      new THREE.TubeGeometry(armCurve, 18, 0.022, 10, false),
      materials.darkCarvedOak
    );
    armRest.scale.set(1.15, 0.78, 1.0);
    swivelGroup.add(armRest);

    const armScroll = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 12, 10),
      materials.darkCarvedOak
    );
    armScroll.scale.set(1.1, 0.85, 1.15);
    armScroll.position.set(ax, seatY + 0.222, 0.235);
    swivelGroup.add(armScroll);
  }

  // Tall turned & chamfered rear stiles + Gothic spire finials reaching exact topY (1.48)
  const stileTopY = spec.topY - 0.105; // 1.375
  const stileH = stileTopY - seatY;
  const finialGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.026, 0.0),
      new THREE.Vector2(0.029, 0.015),
      new THREE.Vector2(0.018, 0.032),
      new THREE.Vector2(0.025, 0.052),
      new THREE.Vector2(0.014, 0.075),
      new THREE.Vector2(0.004, 0.098),
      new THREE.Vector2(0.0, 0.105),
    ],
    14
  );

  for (const side of [-1, 1]) {
    const sx = side * 0.255;
    const stile = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, stileH, 0.048),
      materials.darkCarvedOak
    );
    stile.position.set(sx, seatY + stileH * 0.5, -0.225);
    swivelGroup.add(stile);

    const finial = new THREE.Mesh(finialGeo, materials.darkCarvedOak);
    finial.position.set(sx, stileTopY, -0.225);
    swivelGroup.add(finial);
  }

  // Carved Gothic pointed-arch pierced oak backrest frame (crest peaking cleanly at 1.44 < 1.48)
  const backW = 0.48;
  const backBottomY = seatY + 0.11;
  const backRectH = 0.66;
  const archPeakY = stileTopY - backBottomY + 0.065; // ~0.87

  const backOuterShape = new THREE.Shape();
  backOuterShape.moveTo(-backW * 0.5, 0);
  backOuterShape.lineTo(backW * 0.5, 0);
  backOuterShape.lineTo(backW * 0.5, backRectH);
  backOuterShape.quadraticCurveTo(backW * 0.42, archPeakY * 0.90, 0, archPeakY);
  backOuterShape.quadraticCurveTo(-backW * 0.42, archPeakY * 0.90, -backW * 0.5, backRectH);
  backOuterShape.closePath();

  // Pierced Gothic trefoil tracery holes in the upper carved oak crest above the velvet pad
  const crestHoleCenter = new THREE.Path();
  crestHoleCenter.absarc(0, backRectH + 0.09, 0.034, 0, Math.PI * 2, true);
  backOuterShape.holes.push(crestHoleCenter);
  for (const dir of [-1, 1]) {
    const sideLobe = new THREE.Path();
    sideLobe.absarc(dir * 0.075, backRectH + 0.055, 0.022, 0, Math.PI * 2, true);
    backOuterShape.holes.push(sideLobe);
  }

  const backFrameMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(backOuterShape, {
      depth: 0.034,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
      curveSegments: 14,
    }),
    materials.darkCarvedOak
  );
  backFrameMesh.position.set(0, backBottomY, -0.242);
  swivelGroup.add(backFrameMesh);

  // Burgundy velvet backrest pad framed inside the lower oak panel
  const backPad = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(0.36, 0.58, 0.026, 0.007, 0.02),
    materials.velvetFabric
  );
  backPad.rotation.x = Math.PI * 0.5;
  backPad.position.set(0, seatY + 0.44, -0.196);
  swivelGroup.add(backPad);

  // Brass medallion at crest apex
  const crestMedallion = new THREE.Mesh(
    new THREE.SphereGeometry(0.020, 12, 10),
    materials.antiqueBrass
  );
  crestMedallion.scale.set(1, 1, 0.48);
  crestMedallion.position.set(0, backBottomY + archPeakY - 0.035, -0.200);
  swivelGroup.add(crestMedallion);

  return { group: chairGroup, swivelGroup };
}

/**
 * 2b. Straight-Backed Wooden Visitor Chairs (`visitor-chairs`)
 * Placed at layout.VISITOR_CHAIRS, matching OoP Ch. 22 ("straight-backed, wooden chairs") — NO chintz!
 * Features turned legs, turned H-stretchers, chamfered seat rails, Gothic finial posts,
 * and a carved pointed-arch pierced oak back splat.
 */
function buildVisitorChairs(materials, auxMats, layout) {
  const chairsGroup = new THREE.Group();
  chairsGroup.name = 'VisitorChairs';

  const legProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.013, 0.0),
    new THREE.Vector2(0.018, 0.025),
    new THREE.Vector2(0.013, 0.09),
    new THREE.Vector2(0.020, 0.16),
    new THREE.Vector2(0.014, 0.26),
    new THREE.Vector2(0.021, 0.36),
    new THREE.Vector2(0.022, 0.45),
  ];
  const legGeo = new THREE.LatheGeometry(legProfile, 18);

  const sideHGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.010, -0.175),
      new THREE.Vector2(0.015, -0.10),
      new THREE.Vector2(0.010, -0.04),
      new THREE.Vector2(0.016, 0.0),
      new THREE.Vector2(0.010, 0.04),
      new THREE.Vector2(0.015, 0.10),
      new THREE.Vector2(0.010, 0.175),
    ],
    12
  );
  const crossHGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.010, -0.19),
      new THREE.Vector2(0.015, -0.11),
      new THREE.Vector2(0.010, -0.04),
      new THREE.Vector2(0.018, 0.0),
      new THREE.Vector2(0.010, 0.04),
      new THREE.Vector2(0.015, 0.11),
      new THREE.Vector2(0.010, 0.19),
    ],
    12
  );

  const finialGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.019, 0.0),
      new THREE.Vector2(0.021, 0.012),
      new THREE.Vector2(0.013, 0.024),
      new THREE.Vector2(0.018, 0.040),
      new THREE.Vector2(0.008, 0.062),
      new THREE.Vector2(0.0, 0.072),
    ],
    14
  );

  // Carved pointed-arch pierced oak central back splat
  const splatW = 0.19;
  const splatH = 0.41;
  const splatShape = new THREE.Shape();
  splatShape.moveTo(-splatW * 0.5, 0);
  splatShape.lineTo(splatW * 0.5, 0);
  splatShape.lineTo(splatW * 0.5, splatH * 0.72);
  splatShape.quadraticCurveTo(splatW * 0.36, splatH * 0.94, 0, splatH);
  splatShape.quadraticCurveTo(-splatW * 0.36, splatH * 0.94, -splatW * 0.5, splatH * 0.72);
  splatShape.closePath();

  // Pierced Gothic twin lancet openings + rose trefoil cutout
  for (const dir of [-1, 1]) {
    const lancet = new THREE.Path();
    const lx = dir * 0.042;
    lancet.moveTo(lx - 0.020, 0.045);
    lancet.lineTo(lx + 0.020, 0.045);
    lancet.lineTo(lx + 0.020, 0.235);
    lancet.quadraticCurveTo(lx + 0.014, 0.275, lx, 0.295);
    lancet.quadraticCurveTo(lx - 0.014, 0.275, lx - 0.020, 0.235);
    lancet.closePath();
    splatShape.holes.push(lancet);
  }
  const roseCutout = new THREE.Path();
  roseCutout.absarc(0, 0.335, 0.024, 0, Math.PI * 2, true);
  splatShape.holes.push(roseCutout);

  const piercedSplatGeo = new THREE.ExtrudeGeometry(splatShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 12,
  });

  // Carved Gothic pointed-arch top crest rail
  const crestShape = new THREE.Shape();
  crestShape.moveTo(-0.20, 0);
  crestShape.lineTo(0.20, 0);
  crestShape.lineTo(0.20, 0.036);
  crestShape.quadraticCurveTo(0.10, 0.072, 0, 0.088);
  crestShape.quadraticCurveTo(-0.10, 0.072, -0.20, 0.036);
  crestShape.closePath();
  const crestRailGeo = new THREE.ExtrudeGeometry(crestShape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 10,
  });

  // Slender turned flank spindles beside the pierced Gothic splat
  const sideSpindleGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.008, 0.0),
      new THREE.Vector2(0.012, 0.08),
      new THREE.Vector2(0.007, 0.16),
      new THREE.Vector2(0.013, 0.24),
      new THREE.Vector2(0.007, 0.32),
      new THREE.Vector2(0.010, 0.40),
    ],
    12
  );

  for (const spec of layout.VISITOR_CHAIRS) {
    const chair = new THREE.Group();
    chair.name = spec.id;
    chair.position.set(spec.x, spec.y, spec.z);
    chair.rotation.y = spec.rotationY;

    // Ground contact shadow
    chair.add(
      createGroundContactShadow(
        auxMats.contactShadowMat,
        0.76,
        0.74,
        getContactShadowY(layout, spec.x, spec.z)
      )
    );

    const seatY = 0.45;
    const seatW = 0.46;
    const seatD = 0.43;

    // 4 turned oak legs resting cleanly at y = 0
    for (const lx of [-0.19, 0.19]) {
      for (const lz of [-0.175, 0.175]) {
        const leg = new THREE.Mesh(legGeo, materials.darkCarvedOak);
        leg.position.set(lx, 0, lz);
        chair.add(leg);
      }
    }

    // Turned H-stretchers at y = 0.16
    for (const lx of [-0.19, 0.19]) {
      const sideH = new THREE.Mesh(sideHGeo, materials.darkCarvedOak);
      sideH.rotation.x = Math.PI * 0.5;
      sideH.position.set(lx, 0.16, 0);
      chair.add(sideH);
    }
    const crossH = new THREE.Mesh(crossHGeo, materials.darkCarvedOak);
    crossH.rotation.z = Math.PI * 0.5;
    crossH.position.set(0, 0.16, 0);
    chair.add(crossH);

    // Chamfered seat rail apron + contoured solid dark oak plank seat (zero upholstery!)
    const seatRailFrame = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(seatW - 0.02, seatD - 0.02, 0.044, 0.006, 0.018),
      materials.darkCarvedOak
    );
    seatRailFrame.position.set(0, seatY + 0.016, 0);
    chair.add(seatRailFrame);

    const seatPlank = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(seatW, seatD, 0.022, 0.006, 0.022),
      materials.darkCarvedOak
    );
    seatPlank.position.set(0, seatY + 0.036, 0);
    chair.add(seatPlank);

    // Tall straight back stiles + turned Gothic spire finials reaching exact spec.topY (1.05)
    const finialBaseY = spec.topY - 0.072; // 0.978
    const stileH = finialBaseY - seatY;
    for (const sx of [-0.195, 0.195]) {
      const stile = new THREE.Mesh(
        new THREE.BoxGeometry(0.034, stileH, 0.034),
        materials.darkCarvedOak
      );
      stile.position.set(sx, seatY + stileH * 0.5, -0.18);
      chair.add(stile);

      const finial = new THREE.Mesh(finialGeo, materials.darkCarvedOak);
      finial.position.set(sx, finialBaseY, -0.18);
      chair.add(finial);
    }

    // Carved Gothic pointed-arch top crest rail & lower rail
    const topCrest = new THREE.Mesh(crestRailGeo, materials.darkCarvedOak);
    topCrest.position.set(0, spec.topY - 0.095, -0.193);
    chair.add(topCrest);

    const lowerRail = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(0.39, 0.030, 0.030, 0.004, 0.006),
      materials.darkCarvedOak
    );
    lowerRail.position.set(0, seatY + 0.115, -0.18);
    chair.add(lowerRail);

    // Carved pointed-arch pierced oak back splat + flanking turned oak spindles
    const splat = new THREE.Mesh(piercedSplatGeo, materials.darkCarvedOak);
    splat.position.set(0, seatY + 0.115, -0.188);
    chair.add(splat);

    for (const bx of [-0.145, 0.145]) {
      const sp = new THREE.Mesh(sideSpindleGeo, materials.darkCarvedOak);
      sp.position.set(bx, seatY + 0.115, -0.18);
      chair.add(sp);
    }

    chairsGroup.add(chair);
  }

  return chairsGroup;
}

/**
 * 3. Seven Spindle-Legged Tables (`spindle-tables`)
 * Exact { x, z, radius, topY, height, rotationY } from layout.SPINDLE_TABLES so artifacts
 * mount cleanly at exact y = topY with zero floating or sinking.
 * Features high-segment LatheGeometry turned baluster spindles, beveled molded rims,
 * and curved crossed wooden X-stretchers.
 */
function buildSpindleTables(materials, auxMats, layout) {
  const tablesGroup = new THREE.Group();
  tablesGroup.name = 'SpindleTables';

  layout.SPINDLE_TABLES.forEach((spec, idx) => {
    const table = new THREE.Group();
    table.name = spec.id;
    table.position.set(spec.x, spec.y, spec.z);
    table.rotation.y = spec.rotationY;

    const r = spec.radius;
    const h = spec.topY; // exact top surface Y
    const isOctagonal = idx % 2 === 1;
    const radialSegs = isOctagonal ? 8 : 36;
    const legCount = idx % 3 === 0 ? 3 : 4;

    // Ground contact shadow plane at y = 0.004 on stone flagstones
    table.add(
      createGroundContactShadow(
        auxMats.contactShadowMat,
        r * 2.25,
        r * 2.25,
        getContactShadowY(layout, spec.x, spec.z)
      )
    );

    // 1. Beveled molded tabletop rim whose flat upper face rests at exact y = h
    if (isOctagonal) {
      const octShape = new THREE.Shape();
      const octR = r * 0.965;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const px = Math.cos(a) * octR;
        const py = Math.sin(a) * octR;
        if (i === 0) octShape.moveTo(px, py);
        else octShape.lineTo(px, py);
      }
      octShape.closePath();

      const octGeo = new THREE.ExtrudeGeometry(octShape, {
        depth: 0.014,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.014,
        bevelSegments: 3,
      });
      octGeo.rotateX(-Math.PI * 0.5);
      octGeo.computeBoundingBox();
      if (octGeo.boundingBox) {
        octGeo.translate(0, h - octGeo.boundingBox.max.y, 0);
      }
      table.add(new THREE.Mesh(octGeo, materials.darkCarvedOak));

      const underMold = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.93, r * 0.78, 0.022, 8),
        materials.darkCarvedOak
      );
      underMold.rotation.y = Math.PI / 8;
      underMold.position.y = h - 0.036;
      table.add(underMold);
    } else {
      const topProfile = [
        new THREE.Vector2(0.0, h),
        new THREE.Vector2(r * 0.93, h),
        new THREE.Vector2(r * 0.975, h - 0.006),
        new THREE.Vector2(r * 0.995, h - 0.015),
        new THREE.Vector2(r * 0.96, h - 0.024),
        new THREE.Vector2(r * 0.89, h - 0.032),
        new THREE.Vector2(r * 0.76, h - 0.044),
        new THREE.Vector2(0.0, h - 0.044),
      ];
      table.add(new THREE.Mesh(new THREE.LatheGeometry(topProfile, 36), materials.darkCarvedOak));
    }

    // Subtle antique brass perimeter inlay flush on outer rim (clear of center instrument)
    const rimInlay = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.84, r * 0.875, radialSegs),
      materials.antiqueBrass
    );
    rimInlay.rotation.x = -Math.PI * 0.5;
    rimInlay.rotation.z = isOctagonal ? Math.PI / 8 : 0;
    rimInlay.position.y = h + 0.0002;
    rimInlay.userData.noCastShadow = true;
    table.add(rimInlay);

    // Recessed molded apron skirt & central turned pendant drop finial
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.68, r * 0.66, 0.034, radialSegs),
      materials.darkCarvedOak
    );
    apron.rotation.y = isOctagonal ? Math.PI / 8 : 0;
    apron.position.y = h - 0.056;
    table.add(apron);

    const finial = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, -0.068),
          new THREE.Vector2(0.007, -0.045),
          new THREE.Vector2(0.022, -0.022),
          new THREE.Vector2(0.012, -0.008),
          new THREE.Vector2(0.024, 0.0),
        ],
        14
      ),
      materials.darkCarvedOak
    );
    finial.position.y = h - 0.070;
    table.add(finial);

    // 2. Smooth high-segment LatheGeometry turned baluster spindle legs
    const legTopY = h - 0.044;
    const legProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.010, 0.0),
      new THREE.Vector2(0.0125, 0.020),
      new THREE.Vector2(0.0075, 0.055),
      new THREE.Vector2(0.0155, legTopY * 0.16),
      new THREE.Vector2(0.0085, legTopY * 0.25),
      new THREE.Vector2(0.0175, legTopY * 0.36),
      new THREE.Vector2(0.0195, legTopY * 0.48),
      new THREE.Vector2(0.0110, legTopY * 0.62),
      new THREE.Vector2(0.0160, legTopY * 0.71),
      new THREE.Vector2(0.0095, legTopY * 0.79),
      new THREE.Vector2(0.0185, legTopY * 0.90),
      new THREE.Vector2(0.0145, legTopY),
    ];
    const legGeo = new THREE.LatheGeometry(legProfile, 24);

    const legTopRadius = r * 0.56;
    const legFootRadius = r * 0.72;
    const tiltAngle = Math.atan2(legFootRadius - legTopRadius, legTopY);
    const ankleY = h * 0.24;
    const ankleRadius = THREE.MathUtils.lerp(legFootRadius, legTopRadius, ankleY / legTopY);

    for (let l = 0; l < legCount; l++) {
      const ang = (l / legCount) * Math.PI * 2 + (legCount === 4 ? Math.PI * 0.25 : 0);
      const legHolder = new THREE.Group();
      legHolder.rotation.y = ang;

      const leg = new THREE.Mesh(legGeo, materials.darkCarvedOak);
      // Seat 3mm inside the brass ferrule so tilted foot edge never dips below y = 0
      leg.position.set(legFootRadius, 0.003, 0);
      leg.rotation.z = tiltAngle;
      legHolder.add(leg);

      // Turned antique brass foot ferrule resting cleanly flush at y = 0
      const ferrule = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.014, 0.022, 16),
        materials.antiqueBrass
      );
      ferrule.position.set(legFootRadius, 0.011, 0);
      legHolder.add(ferrule);

      table.add(legHolder);
    }

    // 3. Curved crossed wooden X-stretchers (4-leg X-cross or 3-leg Y-arch) + central turned urn
    const apexY = ankleY + 0.055;
    if (legCount === 4) {
      for (let pair = 0; pair < 2; pair++) {
        const angA = (pair / 4) * Math.PI * 2 + Math.PI * 0.25;
        const angB = angA + Math.PI;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(angA) * ankleRadius, ankleY, Math.sin(angA) * ankleRadius),
          new THREE.Vector3(Math.cos(angA) * ankleRadius * 0.45, apexY - 0.008, Math.sin(angA) * ankleRadius * 0.45),
          new THREE.Vector3(0, apexY, 0),
          new THREE.Vector3(Math.cos(angB) * ankleRadius * 0.45, apexY - 0.008, Math.sin(angB) * ankleRadius * 0.45),
          new THREE.Vector3(Math.cos(angB) * ankleRadius, ankleY, Math.sin(angB) * ankleRadius),
        ]);
        const xBar = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.0095, 8, false),
          materials.darkCarvedOak
        );
        table.add(xBar);
      }
    } else {
      for (let s = 0; s < legCount; s++) {
        const ang = (s / legCount) * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(ang) * ankleRadius, ankleY, Math.sin(ang) * ankleRadius),
          new THREE.Vector3(Math.cos(ang) * ankleRadius * 0.48, apexY - 0.006, Math.sin(ang) * ankleRadius * 0.48),
          new THREE.Vector3(0, apexY, 0),
        ]);
        const arm = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 16, 0.0095, 8, false),
          materials.darkCarvedOak
        );
        table.add(arm);
      }
    }

    // Turned oak urn hub finial at the X-stretcher crossing
    const centerUrn = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, -0.022),
          new THREE.Vector2(0.016, -0.012),
          new THREE.Vector2(0.024, 0.0),
          new THREE.Vector2(0.014, 0.018),
          new THREE.Vector2(0.019, 0.032),
          new THREE.Vector2(0.007, 0.052),
          new THREE.Vector2(0.0, 0.064),
        ],
        16
      ),
      materials.darkCarvedOak
    );
    centerUrn.position.y = apexY;
    table.add(centerUrn);

    tablesGroup.add(table);
  });

  return tablesGroup;
}

/**
 * Tailored painterly palettes and canon visual signatures for the 9 wall portraits
 * (used cleanly for procedural CanvasTexture fallback before/without external JPG load).
 */
function getPortraitConfig(slot) {
  const configs = {
    'slot-phineas': {
      palette: {
        bg: '#101a14',
        bgAccent: '#233b2d',
        robe: '#16442a',
        trim: '#ced6de',
        skin: '#d9c2af',
        hair: '#17171a',
        eye: '#1c1917',
      },
      enhance: (ctx, eyesOpen) => {
        const cx = 192;
        const headY = eyesOpen ? 512 * 0.36 : 512 * 0.385;
        ctx.strokeStyle = '#141416';
        ctx.lineWidth = 2.4;
        for (const dir of [-1, 1]) {
          const ex = cx + dir * 20;
          ctx.beginPath();
          ctx.moveTo(ex - 11, headY - 12);
          ctx.quadraticCurveTo(ex, headY - 19, ex + 11, headY - 13);
          ctx.stroke();
        }
        ctx.fillStyle = '#d4dce4';
        ctx.beginPath();
        ctx.ellipse(cx, 355, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e6e42';
        ctx.beginPath();
        ctx.arc(cx, 355, 4.5, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    'slot-everard': {
      palette: {
        bg: '#1d1914',
        bgAccent: '#393226',
        robe: '#272c38',
        trim: '#b6944e',
        skin: '#c8b688',
        hair: '#17171a',
        eye: '#38322c',
      },
      enhance: (ctx, eyesOpen) => {
        const cx = 192;
        const headY = eyesOpen ? 512 * 0.36 : 512 * 0.385;
        ctx.fillStyle = '#17171a';
        ctx.beginPath();
        ctx.moveTo(cx - 46, headY - 58);
        ctx.quadraticCurveTo(cx, headY - 76, cx + 46, headY - 58);
        ctx.lineTo(cx + 46, headY - 24);
        for (let x = cx + 44; x >= cx - 44; x -= 6) {
          const jag = ((x * 13) % 7) - 3;
          ctx.lineTo(x, headY - 23 + jag);
        }
        ctx.closePath();
        ctx.fill();
      },
    },
    'slot-dilys': {
      palette: {
        bg: '#1e1822',
        bgAccent: '#3b2d45',
        robe: '#432544',
        trim: '#d2b063',
        skin: '#e4c9b8',
        hair: '#d9dee6',
        eye: '#5a7c99',
      },
      enhance: (ctx, eyesOpen) => {
        const cx = 192;
        const headY = eyesOpen ? 512 * 0.36 : 512 * 0.385;
        for (const dir of [-1, 1]) {
          for (let ring = 0; ring < 9; ring++) {
            const rx = cx + dir * (48 + Math.sin(ring * 0.9) * 6);
            const ry = headY - 22 + ring * 18;
            ctx.fillStyle = ring % 2 === 0 ? '#d8dde5' : '#bcc4d0';
            ctx.beginPath();
            ctx.arc(rx, ry, 13 - ring * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(rx - dir * 2, ry - 2, 7.5, 0.2, Math.PI * 1.4);
            ctx.stroke();
          }
        }
      },
    },
    'slot-dippet': {
      palette: {
        bg: '#211914',
        bgAccent: '#423328',
        robe: '#4b2328',
        trim: '#caa450',
        skin: '#e2c5af',
        hair: '#ece8df',
        eye: '#688096',
      },
      enhance: (ctx, eyesOpen) => {
        const cx = 192;
        const headY = eyesOpen ? 512 * 0.36 : 512 * 0.385;
        const domeGrad = ctx.createRadialGradient(cx - 8, headY - 46, 6, cx, headY - 38, 48);
        domeGrad.addColorStop(0, '#edd6c2');
        domeGrad.addColorStop(0.7, '#dfc1aa');
        domeGrad.addColorStop(1, '#b78e72');
        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.ellipse(cx, headY - 44, 49, 28, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, headY - 38, 48, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    'slot-fortescue': {
      palette: {
        bg: '#231814',
        bgAccent: '#453125',
        robe: '#561f23',
        trim: '#d2a852',
        skin: '#dfad92',
        hair: '#cec6ba',
        eye: '#596e84',
      },
    },
    'slot-unnamed-1': {
      palette: { bg: '#161b24', bgAccent: '#283446', robe: '#20334f', trim: '#c9a456', skin: '#e1bfa1', hair: '#8f8981', eye: '#5a7a96' },
    },
    'slot-unnamed-2': {
      palette: { bg: '#1b1814', bgAccent: '#362d22', robe: '#2d3b29', trim: '#c69e4d', skin: '#d9ae8d', hair: '#d5d0c7', eye: '#4b6653' },
    },
    'slot-unnamed-3': {
      palette: { bg: '#23171d', bgAccent: '#422937', robe: '#4b2030', trim: '#d2ab58', skin: '#e4c2a4', hair: '#5e493c', eye: '#60738a' },
    },
    'slot-unnamed-4': {
      palette: { bg: '#1c1b18', bgAccent: '#353129', robe: '#372a42', trim: '#cca352', skin: '#d7aa87', hair: '#968f86', eye: '#576f82' },
    },
  };
  return configs[slot.slotId] || {};
}

/**
 * Applies optional painterly signature details ONLY to synchronous procedural fallback canvases
 * (never overriding loaded Old Master paintings).
 * @param {{ snoozing: THREE.CanvasTexture, awake: THREE.CanvasTexture }} texBundle
 * @param {(ctx: CanvasRenderingContext2D, eyesOpen: boolean) => void} enhancer
 */
function enhancePortraitTextures(texBundle, enhancer) {
  if (typeof enhancer !== 'function') return;
  for (const [key, eyesOpen] of [
    ['snoozing', false],
    ['awake', true],
  ]) {
    const tex = texBundle[key];
    const canvas = tex?.image;
    if (canvas && typeof canvas.getContext === 'function') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        enhancer(ctx, eyesOpen);
        tex.needsUpdate = true;
      }
    }
  }
}

/**
 * Builds a multi-profile sculpted gilded baroque picture frame:
 * - Outer carved ogee molding profile (mitered)
 * - Stepped dark-bronze shadow cove (mitered)
 * - Inner beaded gold fillet + perimeter gold pearl bead molding
 * - Sculpted corner acanthus rosette clusters & top baroque crest pediment
 * - Engraved antique brass nameplate plaque along the bottom edge for named portraits
 * - MeshPhysicalMaterial oil canvas with linen weave normalMap & subtle varnish clearcoat
 *
 * @param {object} materials
 * @param {object} auxMats
 * @param {number} width
 * @param {number} height
 * @param {{ initial: THREE.Texture }} textures
 * @param {{ isGrandGold?: boolean, named?: boolean, name?: string, sharedGeos?: object }} opts
 * @returns {{ frameGroup: THREE.Group, canvasMesh: THREE.Mesh, canvasMat: THREE.MeshPhysicalMaterial }}
 */
function createFramedPortraitMesh(materials, auxMats, width, height, textures, opts = {}) {
  const { isGrandGold = false, named = false, name = '', sharedGeos = {} } = opts;
  const frameGroup = new THREE.Group();

  const bar = isGrandGold ? 0.096 : 0.078;
  const s = isGrandGold ? 1.18 : 1.0;
  const innerW = width - bar * 2;
  const innerH = height - bar * 2;

  // Solid oak backing panel behind the canvas (prevents wall curvature gaps & finishes hinged back)
  const backPlate = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.018, height - 0.018, 0.024),
    materials.darkCarvedOak
  );
  backPlate.position.z = -0.012;
  frameGroup.add(backPlate);

  // 1. Inner beaded gold fillet (mitered 45° frame)
  const filletOuterR = 0.020 * s;
  const filletProfile = [
    [-0.005, 0.011],
    [-0.005, 0.036],
    [0.004 * s, 0.041],
    [filletOuterR, 0.038],
    [filletOuterR, 0.011],
    [-0.005, 0.011],
  ];
  const innerFillet = new THREE.Mesh(
    createMiteredFrameGeometry(innerW, innerH, filletProfile),
    materials.gildedGold
  );
  frameGroup.add(innerFillet);

  // Merged perimeter row of gold pearl beads along the inner fillet
  const beadSpheres = [];
  const beadR = 0.0048 * s;
  const beadBaseGeo = new THREE.SphereGeometry(beadR, 7, 6);
  const bxHalf = innerW * 0.5 + 0.008 * s;
  const byHalf = innerH * 0.5 + 0.008 * s;
  const stepDist = 0.024 * s;
  const nxCount = Math.max(4, Math.floor((bxHalf * 2) / stepDist));
  const nyCount = Math.max(4, Math.floor((byHalf * 2) / stepDist));
  for (let i = 0; i <= nxCount; i++) {
    const x = -bxHalf + (i / nxCount) * bxHalf * 2;
    for (const y of [-byHalf, byHalf]) {
      const g = beadBaseGeo.clone();
      g.translate(x, y, 0.041);
      beadSpheres.push(g);
    }
  }
  for (let j = 1; j < nyCount; j++) {
    const y = -byHalf + (j / nyCount) * byHalf * 2;
    for (const x of [-bxHalf, bxHalf]) {
      const g = beadBaseGeo.clone();
      g.translate(x, y, 0.041);
      beadSpheres.push(g);
    }
  }
  beadBaseGeo.dispose();
  if (beadSpheres.length > 0) {
    const beadChain = new THREE.Mesh(safeMergeGeometries(beadSpheres), materials.gildedGold);
    for (const g of beadSpheres) g.dispose();
    frameGroup.add(beadChain);
  }

  // 2. Stepped dark-bronze shadow cove (deep contrasting valley between gold fillet & ogee)
  const coveStartR = filletOuterR - 0.001;
  const coveEndR = 0.043 * s;
  const coveProfile = [
    [coveStartR, 0.010],
    [coveStartR, 0.036],
    [coveStartR + 0.005 * s, 0.024],
    [coveEndR - 0.005 * s, 0.024],
    [coveEndR, 0.034],
    [coveEndR, 0.010],
    [coveStartR, 0.010],
  ];
  const shadowCove = new THREE.Mesh(
    createMiteredFrameGeometry(innerW, innerH, coveProfile),
    auxMats.darkBronzeFrame
  );
  frameGroup.add(shadowCove);

  // 3. Outer sculpted carved gilded ogee molding profile
  const ogeeStartR = coveEndR - 0.001;
  const ogeeSpan = bar - ogeeStartR;
  const ogeeProfile = [
    [ogeeStartR, -0.010],
    [ogeeStartR, 0.034],
    [ogeeStartR + ogeeSpan * 0.24, 0.052],
    [ogeeStartR + ogeeSpan * 0.45, 0.060],
    [ogeeStartR + ogeeSpan * 0.66, 0.046],
    [ogeeStartR + ogeeSpan * 0.80, 0.038],
    [bar - 0.004, 0.044],
    [bar, 0.038],
    [bar, -0.014],
    [ogeeStartR, -0.010],
  ];
  const outerOgee = new THREE.Mesh(
    createMiteredFrameGeometry(innerW, innerH, ogeeProfile),
    materials.gildedGold
  );
  frameGroup.add(outerOgee);

  // 4. Sculpted corner acanthus rosette clusters
  const rosetteGeo =
    sharedGeos.rosette || createAcanthusRosetteGeometry(s);
  const cx = width * 0.5 - bar * 0.44;
  const cy = height * 0.5 - bar * 0.44;
  const cornerDefs = [
    [-cx, -cy, (3 * Math.PI) / 4],
    [cx, -cy, (-3 * Math.PI) / 4],
    [-cx, cy, Math.PI / 4],
    [cx, cy, -Math.PI / 4],
  ];
  for (const [rx, ry, rotZ] of cornerDefs) {
    const cluster = new THREE.Mesh(rosetteGeo, materials.gildedGold);
    cluster.position.set(rx, ry, 0.048);
    cluster.rotation.z = rotZ;
    frameGroup.add(cluster);
  }

  // 5. Sculpted baroque scroll pediment crest atop frame center
  const crestGeo = sharedGeos.crest || createBaroqueCrestGeometry(s);
  const crestMesh = new THREE.Mesh(crestGeo, materials.gildedGold);
  crestMesh.position.set(0, height * 0.5 - 0.004, 0.034);
  frameGroup.add(crestMesh);

  // 6. Antique engraved brass nameplate plaque along bottom edge for the 6 named portraits
  if (named && name) {
    const plaqueW = Math.min(0.46, width * 0.44);
    const plaqueH = 0.050;
    const plaqueGroup = new THREE.Group();
    plaqueGroup.position.set(0, -height * 0.5 + bar * 0.48, 0.064);

    const plaqueBase = new THREE.Mesh(
      createBeveledHorizontalSlabGeo(plaqueW, plaqueH, 0.036, 0.0025, 0.004),
      materials.antiqueBrass
    );
    plaqueBase.rotation.x = Math.PI * 0.5;
    plaqueGroup.add(plaqueBase);

    const plaqueTex = createBrassPlaqueTexture(name);
    if (plaqueTex) {
      const plaqueFaceMat = new THREE.MeshStandardMaterial({
        map: plaqueTex,
        metalness: 0.72,
        roughness: 0.34,
      });
      const plaqueFace = new THREE.Mesh(
        new THREE.PlaneGeometry(plaqueW - 0.006, plaqueH - 0.006),
        plaqueFaceMat
      );
      plaqueFace.position.z = 0.0005;
      plaqueFace.userData.noCastShadow = true;
      plaqueGroup.add(plaqueFace);
    }

    frameGroup.add(plaqueGroup);
  }

  // 7. Physical oil painting canvas plane with canvas-weave normal map & subtle varnish clearcoat
  const canvasMat = new THREE.MeshPhysicalMaterial({
    map: textures.initial,
    normalMap: materials.portraitNormalMap || null,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.36,
  });
  const canvasMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(innerW + 0.012, innerH + 0.012),
    canvasMat
  );
  canvasMesh.position.z = 0.013;
  canvasMesh.userData.noCastShadow = true;
  frameGroup.add(canvasMesh);

  return { frameGroup, canvasMesh, canvasMat };
}

/**
 * 4. Former Headmasters & Headmistresses Portraits (`portraits`)
 */
function buildPortraits(materials, auxMats, layout) {
  const portraitsGroup = new THREE.Group();
  portraitsGroup.name = 'HeadmasterPortraits';

  const sharedGeos = {
    rosette: createAcanthusRosetteGeometry(1.0),
    crest: createBaroqueCrestGeometry(1.0),
  };

  const portraitEntries = [];

  layout.PORTRAIT_SLOTS.forEach((slot, idx) => {
    const cfg = getPortraitConfig(slot);
    const texBundle = materials.createPortraitTexture({
      portraitId: slot.portraitId,
      name: slot.name,
      palette: cfg.palette || null,
      beard: slot.appearance?.beard ?? false,
      hat: slot.appearance?.hat ?? false,
      glasses: slot.appearance?.glasses ?? false,
      gender: slot.appearance?.gender ?? 'male',
      awake: false,
    });
    enhancePortraitTextures(texBundle, cfg.enhance);

    const slotRoot = new THREE.Group();
    slotRoot.name = slot.slotId;
    slotRoot.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
    slotRoot.rotation.y = slot.rotationY;

    // Subtle soft drop shadow halo against curved stone wall behind the frame
    const wallShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.width + 0.16, slot.height + 0.16),
      auxMats.wallMountShadow
    );
    wallShadow.position.z = -0.024;
    wallShadow.userData.noRaycast = true;
    wallShadow.userData.noShadow = true;
    wallShadow.userData.noCastShadow = true;
    slotRoot.add(wallShadow);

    const { frameGroup, canvasMesh, canvasMat } = createFramedPortraitMesh(
      materials,
      auxMats,
      slot.width,
      slot.height,
      texBundle,
      {
        isGrandGold: false,
        named: Boolean(slot.named),
        name: slot.name,
        sharedGeos,
      }
    );
    slotRoot.add(frameGroup);

    // Subtle hanging cord & carved brass wall-mount rosette pin above portrait
    const pinY = slot.height * 0.5 + 0.115;
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.015, 0.016, 12),
      materials.antiqueBrass
    );
    pin.rotation.x = Math.PI * 0.5;
    pin.position.set(0, pinY, -0.012);
    slotRoot.add(pin);

    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-slot.width * 0.28, slot.height * 0.44, -0.008),
      new THREE.Vector3(0, pinY, -0.008),
      new THREE.Vector3(slot.width * 0.28, slot.height * 0.44, -0.008),
    ]);
    const cordMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cordCurve, 12, 0.0026, 6, false),
      materials.antiqueBrass
    );
    slotRoot.add(cordMesh);

    mergeStaticSubtree(frameGroup, {
      skipFilter: (m) => m === canvasMesh,
    });
    mergeStaticSubtree(slotRoot, {
      skipFilter: (m) => isDescendantOf(m, frameGroup),
    });

    portraitsGroup.add(slotRoot);

    portraitEntries.push({
      slot,
      slotRoot,
      frameGroup,
      canvasMesh,
      canvasMat,
      texBundle,
      sectorNormal: resolveSectorNormal(layout, slot.angleDeg),
      phase: idx * 0.93 + 0.3,
    });
  });

  return { group: portraitsGroup, entries: portraitEntries };
}

/**
 * 5. Albus Dumbledore's Hinged Portrait (`dumbledore-portrait`)
 * Grand baroque golden frame mounted at DUMBLEDORE_PORTRAIT_SLOT (180°, y = 3.72) using hingePivot.
 * Passes portraitId: 'portrait-albus-dumbledore' so Rembrandt oil textures load seamlessly:
 * hidden in cos/gof/oop; sleeping (dumbledore_sleeping.jpg) in hbp; awake (dumbledore_awake.jpg) in dh;
 * swings smoothly open to expose HIDDEN_CAVITY.
 */
function buildDumbledorePortrait(materials, auxMats, layout) {
  const slot = layout.DUMBLEDORE_PORTRAIT_SLOT;

  const texBundle = materials.createPortraitTexture({
    portraitId: slot.portraitId || 'portrait-albus-dumbledore',
    name: slot.name || 'Albus Dumbledore',
    palette: {
      bg: '#191324',
      bgAccent: '#3e2c56',
      robe: '#3d1c4d',
      trim: '#e4bd5e',
      skin: '#e7c6ae',
      hair: '#edeae4',
      eye: '#5c9ad8',
    },
    beard: 'long',
    hat: false,
    glasses: 'half-moon',
    gender: 'male',
    awake: false,
  });

  const rootGroup = new THREE.Group();
  rootGroup.name = 'DumbledorePortraitRoot';

  const hingePivot = new THREE.Group();
  hingePivot.name = 'DumbledorePortraitHingePivot';
  hingePivot.position.set(slot.hingePivot[0], slot.hingePivot[1], slot.hingePivot[2]);
  rootGroup.add(hingePivot);

  // Offset frame center so world position at swing=0 equals slot.pos ([0, 3.72, -6.44])
  const offsetX = slot.pos[0] - slot.hingePivot[0]; // +0.675
  const offsetY = slot.pos[1] - slot.hingePivot[1]; // 0
  const offsetZ = slot.pos[2] - slot.hingePivot[2]; // -0.02

  const sharedGeos = {
    rosette: createAcanthusRosetteGeometry(1.18),
    crest: createBaroqueCrestGeometry(1.22),
  };

  const { frameGroup, canvasMesh, canvasMat } = createFramedPortraitMesh(
    materials,
    auxMats,
    slot.width,
    slot.height,
    texBundle,
    {
      isGrandGold: true,
      named: true,
      name: slot.name || 'Albus Dumbledore',
      sharedGeos,
    }
  );
  frameGroup.position.set(offsetX, offsetY, offsetZ);

  // Crossed wood stretcher bars on back (-Z) visible when portrait swings open
  for (const angle of [0.58, -0.58]) {
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, slot.height * 0.94, 0.016),
      materials.darkCarvedOak
    );
    brace.position.set(0, 0, -0.026);
    brace.rotation.z = angle;
    frameGroup.add(brace);
  }

  hingePivot.add(frameGroup);

  // Two forged brass side hinges along the left edge at local x = 0
  for (const hy of [-slot.height * 0.3, slot.height * 0.3]) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.11, 12),
      materials.antiqueBrass
    );
    barrel.position.set(0, hy, offsetZ + 0.015);
    hingePivot.add(barrel);

    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.04, 0.01),
      materials.antiqueBrass
    );
    strap.position.set(0.035, hy, offsetZ - 0.015);
    hingePivot.add(strap);
  }

  mergeStaticSubtree(frameGroup, {
    skipFilter: (m) => m === canvasMesh,
  });
  mergeStaticSubtree(hingePivot, {
    skipFilter: (m) => isDescendantOf(m, frameGroup),
  });

  return {
    rootGroup,
    hingePivot,
    canvasMesh,
    canvasMat,
    texBundle,
    sectorNormal: resolveSectorNormal(layout, slot.angleDeg),
    slot,
  };
}

/**
 * 6. Stored Horcrux Books (`horcrux-books`)
 * Placed at layout.HORCRUX_BOOKS_ANCHOR (155°), visible ONLY in ['hbp', 'dh'] eras!
 * Modest waist-high dark oak stand + leather-bound volumes (full in HBP, depleted in DH Ch. 6).
 */
function buildHorcruxBooks(materials, auxMats, layout) {
  const anchor = layout.HORCRUX_BOOKS_ANCHOR;
  const booksRoot = new THREE.Group();
  booksRoot.name = 'HorcruxBooks';
  booksRoot.position.set(anchor.x, anchor.y, anchor.z);
  booksRoot.rotation.y = anchor.rotationY;

  const W = anchor.width - 0.04; // 0.98
  const D = anchor.depth - 0.04; // 0.36
  const standTopY = 0.84;

  // Ground contact shadow on flagstones
  booksRoot.add(
    createGroundContactShadow(
      auxMats.contactShadowMat,
      W * 1.15,
      D * 1.45,
      getContactShadowY(layout, anchor.x, anchor.z)
    )
  );

  // 4 turned baluster oak legs resting cleanly at y = 0
  const legGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.014, 0.0),
      new THREE.Vector2(0.018, 0.025),
      new THREE.Vector2(0.012, 0.07),
      new THREE.Vector2(0.020, 0.18),
      new THREE.Vector2(0.015, 0.32),
      new THREE.Vector2(0.023, 0.48),
    ],
    16
  );
  for (const lx of [-W * 0.44, W * 0.44]) {
    for (const lz of [-D * 0.4, D * 0.4]) {
      const leg = new THREE.Mesh(legGeo, materials.darkCarvedOak);
      leg.position.set(lx, 0, lz);
      booksRoot.add(leg);
    }
  }

  // Low bottom stretcher shelf (y = 0.18)
  const lowerShelf = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(W - 0.04, D - 0.04, 0.028, 0.004, 0.008),
    materials.darkCarvedOak
  );
  lowerShelf.position.set(0, 0.194, 0);
  booksRoot.add(lowerShelf);

  // Single-tier waist-high open book cradle (y = 0.48..0.84) — NOT a wall bookcase!
  const midShelf = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(W, D, 0.032, 0.005, 0.01),
    materials.darkCarvedOak
  );
  midShelf.position.set(0, 0.511, 0);
  booksRoot.add(midShelf);

  const topBoard = new THREE.Mesh(
    createBeveledHorizontalSlabGeo(W + 0.04, D + 0.04, 0.036, 0.006, 0.012),
    materials.darkCarvedOak
  );
  topBoard.position.set(0, standTopY, 0);
  booksRoot.add(topBoard);

  for (const sx of [-W * 0.47, 0, W * 0.47]) {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.30, D - 0.02),
      materials.darkCarvedOak
    );
    cheek.position.set(sx, 0.66, 0);
    booksRoot.add(cheek);
  }

  const backRail = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.12, 0.02),
    materials.darkCarvedOak
  );
  backRail.position.set(0, 0.72, -D * 0.45);
  booksRoot.add(backRail);

  const leatherMats = [
    materials.bookLeatherBurgundy,
    materials.bookLeatherNavy,
    materials.bookLeatherForest,
  ];
  const makeBook = ({ w, h, d, matIdx = 0, brassClasp = false }) => {
    const book = new THREE.Group();
    const coverMat = leatherMats[matIdx % leatherMats.length];

    const spine = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), coverMat);
    book.add(spine);

    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, h * 0.94, d * 0.92),
      materials.agedParchment
    );
    pages.position.set(0, 0, d * 0.05);
    book.add(pages);

    if (brassClasp) {
      const clasp = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.18, h * 0.14, d * 1.04),
        materials.antiqueBrass
      );
      book.add(clasp);
    }

    return book;
  };

  // Full HBP collection (stored Horcrux books before Hermione summons them in DH Ch. 6)
  const fullCollection = new THREE.Group();
  fullCollection.name = 'HorcruxBooksFullHBP';

  const leftSpecs = [
    { x: -0.40, w: 0.044, h: 0.27, d: 0.21, tilt: 0.0, mat: 0, clasp: true },
    { x: -0.35, w: 0.038, h: 0.25, d: 0.20, tilt: 0.0, mat: 1, clasp: false },
    { x: -0.30, w: 0.052, h: 0.28, d: 0.22, tilt: 0.0, mat: 2, clasp: true },
    { x: -0.24, w: 0.042, h: 0.26, d: 0.20, tilt: 0.02, mat: 0, clasp: false },
    { x: -0.17, w: 0.046, h: 0.25, d: 0.21, tilt: -0.18, mat: 1, clasp: false },
  ];
  for (const b of leftSpecs) {
    const mesh = makeBook({ w: b.w, h: b.h, d: b.d, matIdx: b.mat, brassClasp: b.clasp });
    mesh.position.set(b.x, 0.511 + b.h * 0.5, 0.01);
    mesh.rotation.z = b.tilt;
    fullCollection.add(mesh);
  }

  const rightSpecs = [
    { x: 0.06, w: 0.048, h: 0.27, d: 0.21, tilt: 0.0, mat: 2, clasp: true },
    { x: 0.115, w: 0.040, h: 0.24, d: 0.19, tilt: 0.0, mat: 0, clasp: false },
    { x: 0.165, w: 0.045, h: 0.26, d: 0.21, tilt: 0.0, mat: 1, clasp: false },
    { x: 0.24, w: 0.044, h: 0.25, d: 0.20, tilt: 0.22, mat: 0, clasp: true },
  ];
  for (const b of rightSpecs) {
    const mesh = makeBook({ w: b.w, h: b.h, d: b.d, matIdx: b.mat, brassClasp: b.clasp });
    mesh.position.set(b.x, 0.511 + b.h * 0.5, 0.01);
    mesh.rotation.z = b.tilt;
    fullCollection.add(mesh);
  }

  const topStack = [
    { x: -0.20, y: 0.865, w: 0.30, h: 0.05, d: 0.23, rotY: 0.06, mat: 0, clasp: true },
    { x: -0.19, y: 0.913, w: 0.27, h: 0.046, d: 0.21, rotY: -0.09, mat: 2, clasp: false },
    { x: -0.20, y: 0.955, w: 0.24, h: 0.038, d: 0.19, rotY: 0.14, mat: 1, clasp: true },
    { x: 0.22, y: 0.862, w: 0.28, h: 0.044, d: 0.22, rotY: -0.12, mat: 1, clasp: false },
    { x: 0.21, y: 0.904, w: 0.25, h: 0.040, d: 0.20, rotY: 0.08, mat: 0, clasp: true },
  ];
  for (const s of topStack) {
    const tome = makeBook({ w: s.w, h: s.h, d: s.d, matIdx: s.mat, brassClasp: s.clasp });
    tome.position.set(s.x, s.y, 0.01);
    tome.rotation.y = s.rotY;
    fullCollection.add(tome);
  }

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.002, 0.16),
    materials.agedParchment
  );
  marker.position.set(-0.18, 0.938, 0.09);
  marker.rotation.y = 0.22;
  fullCollection.add(marker);

  booksRoot.add(fullCollection);

  // Depleted DH state (after Hermione casts "Accio Horcrux books" out the open window in DH Ch. 6)
  const depletedCollection = new THREE.Group();
  depletedCollection.name = 'HorcruxBooksDepletedDH';

  const leftover1 = makeBook({ w: 0.042, h: 0.24, d: 0.20, matIdx: 1, brassClasp: false });
  leftover1.position.set(-0.39, 0.511 + 0.12, 0.01);
  leftover1.rotation.z = -0.28;
  depletedCollection.add(leftover1);

  const leftover2 = makeBook({ w: 0.26, h: 0.04, d: 0.20, matIdx: 2, brassClasp: false });
  leftover2.position.set(0.22, 0.86, 0.02);
  leftover2.rotation.y = 0.35;
  depletedCollection.add(leftover2);

  const scrap = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.002, 0.20),
    materials.agedParchment
  );
  scrap.position.set(-0.16, 0.842, 0.02);
  scrap.rotation.y = -0.28;
  depletedCollection.add(scrap);

  depletedCollection.visible = false;
  booksRoot.add(depletedCollection);

  return {
    booksRoot,
    fullCollection,
    depletedCollection,
    sectorNormal: resolveSectorNormal(layout, anchor.angleDeg),
  };
}

/**
 * Builds and registers all book-canon furniture & portraits in Dumbledore's Office:
 * `claw-footed-desk`, `headmaster-chair`, `visitor-chairs`, `spindle-tables`,
 * `portraits`, `dumbledore-portrait`, and `horcrux-books`.
 *
 * @param {THREE.Scene} scene
 * @param {object} materials
 * @param {import('./registry.js').CanonSceneRegistry} registry
 * @param {object} layout
 * @param {object} canonData
 * @returns {{ setPortraitsAwake: (awake?: boolean) => boolean, setDumbledorePortraitSwing: (open?: boolean) => boolean, applyEra: (eraId: string) => string }}
 */
export function buildFurniture(scene, materials, registry, layout, canonData) {
  const furnitureRoot = new THREE.Group();
  furnitureRoot.name = 'CanonFurnitureGroup';
  scene.add(furnitureRoot);

  const auxMats = createFurnitureAuxMaterials(materials);

  // 1. Enormous Claw-Footed Desk
  const desk = buildClawFootedDesk(materials, auxMats, layout);
  mergeStaticSubtree(desk.group, {
    skipFilter: (m) => isDescendantOf(m, desk.quillGroup),
  });
  furnitureRoot.add(desk.group);
  const deskHitMeshes = finalizeCanonMeshes(desk.group, 'claw-footed-desk');
  const deskMeta = getCanonMeta(canonData, 'claw-footed-desk', 'Enormous Claw-Footed Desk', 'furniture', ['inspect-desk']);
  let deskInspectPulse = 0;

  const deskPreset = layout.CAMERA_PRESETS?.desk;
  registry.register({
    id: 'claw-footed-desk',
    name: deskMeta.name,
    category: deskMeta.category,
    group: desk.group,
    hitMeshes: deskHitMeshes,
    cameraPos: deskPreset?.pos ?? [0.45, 2.15, 1.35],
    cameraTarget: [layout.DESK.x, 0.72, layout.DESK.z],
    actions: deskMeta.actions,
    interact: () => {
      deskInspectPulse = 1.0;
      return { ok: true, id: 'claw-footed-desk', topY: layout.DESK.topY };
    },
    onUpdate: (dt) => {
      if (deskInspectPulse > 0) {
        deskInspectPulse = Math.max(0, deskInspectPulse - dt * 1.4);
        desk.quillGroup.rotation.z = -0.22 + Math.sin(deskInspectPulse * Math.PI * 3) * 0.08 * deskInspectPulse;
      }
    },
  });

  // 2a. Headmaster's Chair
  const headChair = buildHeadmasterChair(materials, auxMats, layout);
  mergeStaticSubtree(headChair.swivelGroup);
  mergeStaticSubtree(headChair.group, {
    skipFilter: (m) => isDescendantOf(m, headChair.swivelGroup),
  });
  furnitureRoot.add(headChair.group);
  const headChairHits = finalizeCanonMeshes(headChair.group, 'headmaster-chair');
  const headChairMeta = getCanonMeta(canonData, 'headmaster-chair', "Headmaster's Chair", 'furniture', ['inspect-chair']);
  let chairInspectPulse = 0;

  registry.register({
    id: 'headmaster-chair',
    name: headChairMeta.name,
    category: headChairMeta.category,
    group: headChair.group,
    hitMeshes: headChairHits,
    cameraPos: [1.2, 1.85, -1.1],
    cameraTarget: [layout.HEADMASTER_CHAIR.x, 0.92, layout.HEADMASTER_CHAIR.z],
    actions: headChairMeta.actions,
    interact: () => {
      chairInspectPulse = 1.0;
      return { ok: true, id: 'headmaster-chair' };
    },
    onUpdate: (dt) => {
      if (chairInspectPulse > 0) {
        chairInspectPulse = Math.max(0, chairInspectPulse - dt * 1.1);
        headChair.swivelGroup.rotation.y = Math.sin(chairInspectPulse * Math.PI * 2) * 0.1 * chairInspectPulse;
      } else if (headChair.swivelGroup.rotation.y !== 0) {
        headChair.swivelGroup.rotation.y = 0;
      }
    },
  });

  // 2b. Straight-Backed Wooden Visitor Chairs
  const visitorChairs = buildVisitorChairs(materials, auxMats, layout);
  for (const child of visitorChairs.children) {
    if (child.isGroup) mergeStaticSubtree(child);
  }
  furnitureRoot.add(visitorChairs);
  const visitorHits = finalizeCanonMeshes(visitorChairs, 'visitor-chairs');
  const visitorMeta = getCanonMeta(canonData, 'visitor-chairs', 'Visitor Seating Facing the Desk', 'furniture', ['sit-view']);

  registry.register({
    id: 'visitor-chairs',
    name: visitorMeta.name,
    category: visitorMeta.category,
    group: visitorChairs,
    hitMeshes: visitorHits,
    cameraPos: [0.0, 1.65, 2.05],
    cameraTarget: [0.0, 0.9, -1.45],
    actions: visitorMeta.actions,
    interact: (_actionName, context) => {
      if (context?.engine && typeof context.engine.flyTo === 'function') {
        context.engine.flyTo([0.0, 1.32, 0.38], [0.0, 1.2, -2.6], 750);
      }
      return { ok: true, id: 'visitor-chairs' };
    },
  });

  // 3. Seven Spindle-Legged Tables
  const spindleTables = buildSpindleTables(materials, auxMats, layout);
  for (const child of spindleTables.children) {
    if (child.isGroup) mergeStaticSubtree(child);
  }
  furnitureRoot.add(spindleTables);
  const spindleHits = finalizeCanonMeshes(spindleTables, 'spindle-tables');
  const spindleMeta = getCanonMeta(canonData, 'spindle-tables', 'Spindle-Legged Tables', 'furniture', ['inspect-tables']);
  const instPreset = layout.CAMERA_PRESETS?.instruments;

  registry.register({
    id: 'spindle-tables',
    name: spindleMeta.name,
    category: spindleMeta.category,
    group: spindleTables,
    hitMeshes: spindleHits,
    cameraPos: instPreset?.pos ?? [1.65, 1.85, 2.15],
    cameraTarget: [3.85, 0.72, 2.15],
    actions: spindleMeta.actions,
    interact: () => ({ ok: true, count: layout.SPINDLE_TABLES.length }),
  });

  // 4. Old Headmasters & Headmistresses Portraits
  const portraits = buildPortraits(materials, auxMats, layout);
  furnitureRoot.add(portraits.group);
  const portraitHits = finalizeCanonMeshes(portraits.group, 'portraits');
  const portraitsMeta = getCanonMeta(
    canonData,
    'portraits',
    'Portraits of Former Headmasters & Headmistresses',
    'portrait',
    ['wake-portraits']
  );

  let portraitsAwake = false;
  let portraitsCheering = false;

  function setPortraitsAwake(awake) {
    const next = awake === undefined ? !portraitsAwake : Boolean(awake);
    portraitsAwake = next;
    for (const p of portraits.entries) {
      p.canvasMat.map = portraitsAwake ? p.texBundle.awake : p.texBundle.snoozing;
      p.canvasMat.needsUpdate = true;
    }
    return portraitsAwake;
  }

  function applyPortraitsEra(eraId) {
    if (eraId === 'dh') {
      portraitsCheering = true;
      setPortraitsAwake(true);
    } else {
      portraitsCheering = false;
      setPortraitsAwake(false);
    }
  }

  const portraitsPreset = layout.CAMERA_PRESETS?.portraits;
  registry.register({
    id: 'portraits',
    name: portraitsMeta.name,
    category: portraitsMeta.category,
    group: portraits.group,
    hitMeshes: portraitHits,
    cameraPos: portraitsPreset?.pos ?? [0.55, 2.55, 2.85],
    cameraTarget: portraitsPreset?.target ?? [4.85, 2.9, 2.85],
    actions: portraitsMeta.actions,
    interact: (actionName) => {
      if (actionName === 'wake') return { ok: true, awake: setPortraitsAwake(true) };
      if (actionName === 'snooze' || actionName === 'calm') return { ok: true, awake: setPortraitsAwake(false) };
      return { ok: true, awake: setPortraitsAwake(!portraitsAwake) };
    },
    setEra: applyPortraitsEra,
    onUpdate: (_dt, elapsed, state) => {
      for (const p of portraits.entries) {
        const cutAway = isSectorCutAway(state, layout.ROOM_RADIUS, p.sectorNormal);
        p.slotRoot.visible = !cutAway;
        if (cutAway) continue;

        if (portraitsCheering && portraitsAwake) {
          const wave = elapsed * 4.4 + p.phase;
          p.canvasMesh.position.y = Math.abs(Math.sin(wave)) * 0.014;
          p.frameGroup.rotation.z = Math.sin(wave * 0.7) * 0.02;
          p.frameGroup.rotation.x = 0.015 + Math.cos(wave) * 0.012;
        } else if (portraitsAwake) {
          const sway = elapsed * 1.6 + p.phase;
          p.canvasMesh.position.y = Math.sin(sway) * 0.004;
          p.frameGroup.rotation.z = Math.sin(sway * 0.6) * 0.008;
          p.frameGroup.rotation.x = 0;
        } else {
          const breath = elapsed * 0.85 + p.phase;
          p.canvasMesh.position.y = Math.sin(breath) * 0.003;
          p.frameGroup.rotation.z = 0;
          p.frameGroup.rotation.x = Math.sin(breath) * 0.006;
        }
      }
    },
  });

  // 5. Albus Dumbledore's Hinged Portrait (`dumbledore-portrait`)
  const dumbledore = buildDumbledorePortrait(materials, auxMats, layout);
  furnitureRoot.add(dumbledore.rootGroup);
  const dumbledoreHits = finalizeCanonMeshes(dumbledore.rootGroup, 'dumbledore-portrait');
  const dumbledoreMeta = getCanonMeta(
    canonData,
    'dumbledore-portrait',
    'Portrait of Albus Dumbledore (& Hidden Wall Cavity)',
    'portrait',
    ['swing-portrait', 'wake-dumbledore']
  );

  let dumbledoreEraVisible = false;
  let dumbledoreSwingOpen = false;
  let dumbledoreCurrentSwing = 0;
  let dumbledoreAwake = false;

  function refreshDumbledoreTexture() {
    dumbledore.canvasMat.map = dumbledoreAwake
      ? dumbledore.texBundle.awake
      : dumbledore.texBundle.snoozing;
    dumbledore.canvasMat.needsUpdate = true;
  }

  function setDumbledorePortraitSwing(open) {
    dumbledoreSwingOpen = open === undefined ? !dumbledoreSwingOpen : Boolean(open);
    return dumbledoreSwingOpen;
  }

  function applyDumbledoreEra(eraId) {
    dumbledoreEraVisible = eraId === 'hbp' || eraId === 'dh';
    dumbledoreSwingOpen = false;
    if (!dumbledoreEraVisible) {
      dumbledoreCurrentSwing = 0;
      dumbledore.hingePivot.rotation.y = 0;
    }
    dumbledoreAwake = eraId === 'dh';
    refreshDumbledoreTexture();
    dumbledore.rootGroup.visible = dumbledoreEraVisible;
  }

  registry.register({
    id: 'dumbledore-portrait',
    name: dumbledoreMeta.name,
    category: dumbledoreMeta.category,
    group: dumbledore.rootGroup,
    hitMeshes: dumbledoreHits,
    cameraPos: [0.85, 3.25, -2.85],
    cameraTarget: [...layout.DUMBLEDORE_PORTRAIT_SLOT.pos],
    actions: dumbledoreMeta.actions,
    interact: (actionName) => {
      if (actionName === 'wake-dumbledore') {
        dumbledoreAwake = !dumbledoreAwake;
        refreshDumbledoreTexture();
        return { ok: true, awake: dumbledoreAwake };
      }
      return { ok: true, open: setDumbledorePortraitSwing(!dumbledoreSwingOpen) };
    },
    setEra: applyDumbledoreEra,
    onUpdate: (dt, elapsed, state) => {
      const cutAway = isSectorCutAway(state, layout.ROOM_RADIUS, dumbledore.sectorNormal);
      const visibleNow = dumbledoreEraVisible && !cutAway;
      dumbledore.rootGroup.visible = visibleNow;
      if (!visibleNow) return;

      const targetSwing = dumbledoreSwingOpen ? dumbledore.slot.openSwingRad : 0;
      const alpha = 1 - Math.exp(-7.5 * dt);
      dumbledoreCurrentSwing += (targetSwing - dumbledoreCurrentSwing) * alpha;
      dumbledore.hingePivot.rotation.y = dumbledoreCurrentSwing;

      const rate = dumbledoreAwake ? 1.4 : 0.75;
      dumbledore.canvasMesh.position.y = Math.sin(elapsed * rate) * 0.003;
    },
  });

  // 6. Stored Horcrux Books (`horcrux-books`) — visible ONLY in ['hbp', 'dh']
  const horcruxBooks = buildHorcruxBooks(materials, auxMats, layout);
  mergeStaticSubtree(horcruxBooks.fullCollection);
  mergeStaticSubtree(horcruxBooks.depletedCollection);
  mergeStaticSubtree(horcruxBooks.booksRoot, {
    skipFilter: (m) =>
      isDescendantOf(m, horcruxBooks.fullCollection) ||
      isDescendantOf(m, horcruxBooks.depletedCollection),
  });
  furnitureRoot.add(horcruxBooks.booksRoot);
  const booksHits = finalizeCanonMeshes(horcruxBooks.booksRoot, 'horcrux-books');
  const booksMeta = getCanonMeta(canonData, 'horcrux-books', 'Stored Horcrux Books', 'artifact', ['inspect-books']);

  let booksEraVisible = false;
  let booksInspectPulse = 0;

  function applyBooksEra(eraId) {
    booksEraVisible = eraId === 'hbp' || eraId === 'dh';
    horcruxBooks.fullCollection.visible = eraId === 'hbp';
    horcruxBooks.depletedCollection.visible = eraId === 'dh';
    horcruxBooks.booksRoot.visible = booksEraVisible;
  }

  registry.register({
    id: 'horcrux-books',
    name: booksMeta.name,
    category: booksMeta.category,
    group: horcruxBooks.booksRoot,
    hitMeshes: booksHits,
    cameraPos: [1.3, 1.65, -2.55],
    cameraTarget: [layout.HORCRUX_BOOKS_ANCHOR.x, 0.85, layout.HORCRUX_BOOKS_ANCHOR.z],
    actions: booksMeta.actions,
    interact: () => {
      booksInspectPulse = 1.0;
      return {
        ok: true,
        depleted: horcruxBooks.depletedCollection.visible,
      };
    },
    setEra: applyBooksEra,
    onUpdate: (dt, _elapsed, state) => {
      const cutAway = isSectorCutAway(state, layout.ROOM_RADIUS, horcruxBooks.sectorNormal);
      const visibleNow = booksEraVisible && !cutAway;
      horcruxBooks.booksRoot.visible = visibleNow;
      if (!visibleNow) return;

      if (booksInspectPulse > 0) {
        booksInspectPulse = Math.max(0, booksInspectPulse - dt * 1.5);
        const lift = Math.sin(booksInspectPulse * Math.PI) * 0.025;
        horcruxBooks.fullCollection.position.y = lift;
        horcruxBooks.depletedCollection.position.y = lift;
      } else {
        horcruxBooks.fullCollection.position.y = 0;
        horcruxBooks.depletedCollection.position.y = 0;
      }
    },
  });

  function applyEra(eraId = 'cos') {
    const key = typeof eraId === 'string' ? eraId.toLowerCase() : 'cos';
    applyPortraitsEra(key);
    applyDumbledoreEra(key);
    applyBooksEra(key);
    return key;
  }

  // Initialize default canon era ('cos')
  applyEra('cos');

  return {
    setPortraitsAwake,
    setDumbledorePortraitSwing,
    applyEra,
  };
}
