import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Era lighting and atmosphere configurations derived from Books 2–7 canon.
 */
export const QUALITY_PRESETS = {
  performance: {
    id: 'performance',
    label: 'Fast',
    maxPixelRatio: 1.0,
    useComposer: false,
    gtaoEnabled: false,
    gtaoScale: 0.5,
    gtaoSamples: 8,
    pdSamples: 8,
    bloomScale: 0.5,
    keyShadowSize: 1024,
    hearthShadow: false,
    hearthShadowSize: 512,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    maxPixelRatio: 1.25,
    useComposer: true,
    gtaoEnabled: true,
    gtaoScale: 0.5,
    gtaoSamples: 8,
    pdSamples: 8,
    bloomScale: 0.5,
    keyShadowSize: 1024,
    hearthShadow: true,
    hearthShadowSize: 512,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    maxPixelRatio: 1.75,
    useComposer: true,
    gtaoEnabled: true,
    gtaoScale: 0.75,
    gtaoSamples: 12,
    pdSamples: 12,
    bloomScale: 0.5,
    keyShadowSize: 2048,
    hearthShadow: true,
    hearthShadowSize: 1024,
  },
};

export const ERA_LIGHTING_PRESETS = {
  cos: {
    id: 'cos',
    label: 'Chamber of Secrets (Book 2)',
    timeOfDay: 'Late Afternoon Dusk',
    background: '#161e2b',
    fogColor: '#161e2b',
    fogDensity: 0.013,
    envIntensity: 0.68,
    hemiSky: '#89a3c7',
    hemiGround: '#4a3525',
    hemiIntensity: 0.65,
    keyColor: '#ffd49c',
    keyIntensity: 2.1,
    keyPosition: [14, 15, -10],
    fillColor: '#6f8ec2',
    fillIntensity: 0.55,
    hearthColor: '#ff8a36',
    hearthIntensity: 3.4,
    candleColor: '#ffb95e',
    candleIntensity: 1.9,
  },
  gof: {
    id: 'gof',
    label: 'Goblet of Fire (Book 4)',
    timeOfDay: 'Midnight Pensieve Vigil',
    background: '#0b101c',
    fogColor: '#0b101c',
    fogDensity: 0.016,
    envIntensity: 0.55,
    hemiSky: '#6380b0',
    hemiGround: '#32251d',
    hemiIntensity: 0.5,
    keyColor: '#9fbfff',
    keyIntensity: 1.45,
    keyPosition: [-12, 16, -12],
    fillColor: '#486291',
    fillIntensity: 0.5,
    hearthColor: '#ff7d29',
    hearthIntensity: 3.1,
    candleColor: '#ffbd66',
    candleIntensity: 2.2,
  },
  oop: {
    id: 'oop',
    label: 'Order of the Phoenix (Book 5)',
    timeOfDay: 'Night Crisis to Approaching Dawn',
    background: '#111019',
    fogColor: '#111019',
    fogDensity: 0.018,
    envIntensity: 0.52,
    hemiSky: '#697296',
    hemiGround: '#3b2820',
    hemiIntensity: 0.48,
    keyColor: '#8ea3cc',
    keyIntensity: 1.3,
    keyPosition: [12, 17, -14],
    fillColor: '#565f85',
    fillIntensity: 0.45,
    hearthColor: '#ff7526',
    hearthIntensity: 3.8,
    candleColor: '#ffb357',
    candleIntensity: 2.0,
  },
  hbp: {
    id: 'hbp',
    label: 'Half-Blood Prince (Book 6)',
    timeOfDay: 'Bleak Winter Night',
    background: '#090d15',
    fogColor: '#090d15',
    fogDensity: 0.019,
    envIntensity: 0.54,
    hemiSky: '#738eb8',
    hemiGround: '#2b2019',
    hemiIntensity: 0.44,
    keyColor: '#b7cff2',
    keyIntensity: 1.25,
    keyPosition: [-15, 14, -10],
    fillColor: '#4a5f82',
    fillIntensity: 0.42,
    hearthColor: '#ff6e1f',
    hearthIntensity: 2.8,
    candleColor: '#ffae4f',
    candleIntensity: 2.3,
  },
  dh: {
    id: 'dh',
    label: 'Deathly Hallows (Book 7)',
    timeOfDay: 'Golden Dawn After the Battle',
    background: '#2a2124',
    fogColor: '#2d2224',
    fogDensity: 0.010,
    envIntensity: 0.82,
    hemiSky: '#f0bfa1',
    hemiGround: '#594232',
    hemiIntensity: 0.82,
    keyColor: '#ffc285',
    keyIntensity: 2.85,
    keyPosition: [16, 9, -8],
    fillColor: '#9fb0cf',
    fillIntensity: 0.65,
    hearthColor: '#ff964a',
    hearthIntensity: 1.4,
    candleColor: '#ffd28c',
    candleIntensity: 1.2,
  },
};

function toVec3(v, fallback = [0, 0, 0]) {
  if (v instanceof THREE.Vector3) return v.clone();
  if (Array.isArray(v) && v.length >= 3) {
    return new THREE.Vector3(Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0);
  }
  if (v && typeof v === 'object' && 'x' in v && 'y' in v && 'z' in v) {
    return new THREE.Vector3(Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Builds a procedural HDR light-box Scene representing Dumbledore's warm candlelit circular
 * castle chamber so PMREM reflections on silver, brass, gold, crystal, and rubies carry
 * authentic amber firelight & cool NE/NW moonlight contrast rather than studio white.
 */
function createMedievalChamberEnvironment() {
  const envScene = new THREE.Scene();
  const geometries = [];
  const materials = [];

  const trackGeo = (g) => {
    geometries.push(g);
    return g;
  };
  const trackMat = (m) => {
    materials.push(m);
    return m;
  };

  // Dark dressed stone chamber enclosure
  const chamberGeo = trackGeo(new THREE.CylinderGeometry(8.5, 8.5, 8.0, 24, 1, false));
  const chamberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#211c19'),
      roughness: 0.92,
      metalness: 0.04,
      side: THREE.BackSide,
    })
  );
  const chamberShell = new THREE.Mesh(chamberGeo, chamberMat);
  chamberShell.position.y = 2.6;
  envScene.add(chamberShell);

  // Dark stone floor & oak-beamed ceiling bounce surfaces
  const discGeo = trackGeo(new THREE.CircleGeometry(8.5, 24));
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#1b1715', roughness: 0.85, side: THREE.DoubleSide })
  );
  const floor = new THREE.Mesh(discGeo, floorMat);
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.y = -0.2;
  envScene.add(floor);

  const ceilMat = trackMat(
    new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.9, side: THREE.DoubleSide })
  );
  const ceil = new THREE.Mesh(discGeo, ceilMat);
  ceil.rotation.x = Math.PI * 0.5;
  ceil.position.y = 6.2;
  envScene.add(ceil);

  // Warm overhead candlelight bounce light & subtle emissive ceiling ring
  const overheadBounce = new THREE.PointLight('#ffcf86', 45, 22, 1.3);
  overheadBounce.position.set(0, 4.6, 0);
  envScene.add(overheadBounce);

  const ringGeo = trackGeo(new THREE.TorusGeometry(2.8, 0.22, 8, 24));
  const candleRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffcb7a').multiplyScalar(3.4),
    })
  );
  const candleRing = new THREE.Mesh(ringGeo, candleRingMat);
  candleRing.rotation.x = Math.PI * 0.5;
  candleRing.position.y = 5.4;
  envScene.add(candleRing);

  // Warm amber hearth glow panel on -X (270° fireplace)
  const panelGeo = trackGeo(new THREE.PlaneGeometry(2.6, 2.2));
  const hearthPanelMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff842e').multiplyScalar(14.0),
      side: THREE.DoubleSide,
    })
  );
  const hearthPanel = new THREE.Mesh(panelGeo, hearthPanelMat);
  hearthPanel.position.set(-7.6, 1.4, 0.0);
  hearthPanel.rotation.y = Math.PI * 0.5;
  envScene.add(hearthPanel);

  // Cool moonlit / twilight window glow portals on NE (136°) and NW (224°)
  const winGeo = trackGeo(new THREE.PlaneGeometry(2.2, 3.4));
  const winMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#7ca8eb').multiplyScalar(6.5),
      side: THREE.DoubleSide,
    })
  );
  for (const deg of [136, 224]) {
    const rad = (deg * Math.PI) / 180;
    const portal = new THREE.Mesh(winGeo, winMat);
    portal.position.set(7.7 * Math.sin(rad), 2.7, 7.7 * Math.cos(rad));
    portal.lookAt(0, 2.7, 0);
    envScene.add(portal);
  }

  // Subtle perimeter sconce warmth points for metallic rim gleams
  const sconceGeo = trackGeo(new THREE.SphereGeometry(0.28, 8, 6));
  const sconceMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffc46e').multiplyScalar(5.5),
    })
  );
  for (const deg of [42, 108, 252, 318]) {
    const rad = (deg * Math.PI) / 180;
    const sconce = new THREE.Mesh(sconceGeo, sconceMat);
    sconce.position.set(7.5 * Math.sin(rad), 2.6, 7.5 * Math.cos(rad));
    envScene.add(sconce);
  }

  return {
    scene: envScene,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/**
 * Creates subtle floating illuminated atmospheric dust motes drifting inside the office.
 */
function createAtmosphericDustMotes(count = 160) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size * 0.5;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.32, 'rgba(255, 248, 232, 0.72)');
    grad.addColorStop(0.7, 'rgba(255, 240, 200, 0.18)');
    grad.addColorStop(1.0, 'rgba(255, 240, 200, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const spriteTex = new THREE.CanvasTexture(canvas);
  spriteTex.colorSpace = THREE.SRGBColorSpace;
  spriteTex.needsUpdate = true;

  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    // Low-discrepancy golden-angle distribution inside circular chamber
    const phi = i * 2.39996323;
    const frac = (i + 0.5) / count;
    const r = 0.55 + Math.sqrt(frac) * 5.25;
    const x = Math.sin(phi) * r;
    const z = Math.cos(phi) * r;
    const y = 0.4 + ((i * 0.61803398875) % 1) * 4.55;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    seeds.push({
      baseX: x,
      baseZ: z,
      y,
      phase: i * 1.37,
      riseSpeed: 0.032 + (i % 7) * 0.008,
      driftAmp: 0.14 + (i % 5) * 0.045,
      driftFreq: 0.35 + (i % 6) * 0.09,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color('#ffe0a8'),
    map: spriteTex,
    size: 0.042,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'AtmosphericDustMotes';
  points.raycast = () => {};
  points.userData.noRaycast = true;
  points.userData.noShadow = true;

  const ERA_MOTE_STYLE = {
    cos: { color: '#ffe0a8', opacity: 0.36 },
    gof: { color: '#c4d9ff', opacity: 0.32 },
    oop: { color: '#bde8cf', opacity: 0.32 },
    hbp: { color: '#d8cbb8', opacity: 0.28 },
    dh: { color: '#ffe5a1', opacity: 0.44 },
  };

  function setEra(eraId) {
    const style = ERA_MOTE_STYLE[eraId] || ERA_MOTE_STYLE.cos;
    material.color.set(style.color);
    material.opacity = style.opacity;
  }

  function update(dt, elapsed) {
    const posAttr = geometry.getAttribute('position');
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      s.y += s.riseSpeed * dt;
      if (s.y > 5.1) {
        s.y = 0.38;
      }
      const dx = Math.sin(elapsed * s.driftFreq + s.phase) * s.driftAmp;
      const dz = Math.cos(elapsed * (s.driftFreq * 0.87) + s.phase * 1.4) * s.driftAmp;
      posAttr.setXYZ(i, s.baseX + dx, s.y, s.baseZ + dz);
    }
    posAttr.needsUpdate = true;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    spriteTex.dispose();
  }

  return { points, setEra, update, dispose };
}

/**
 * Creates a non-destructive Fresnel rim highlight overlay material (leaves original materials untouched).
 */
function createHighlightRimMaterial(colorHex, intensity = 0.5) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float rim = smoothstep(0.48, 0.96, clamp(1.0 - ndv, 0.0, 1.0));
        if (rim <= 0.001) discard;
        float alpha = rim * uIntensity;
        gl_FragColor = vec4(uColor * (0.75 + 0.75 * rim), alpha);
      }
    `,
  });
}

/**
 * Instantiates the Three.js WebGL engine, environment, lighting rig, camera controller,
 * raycaster, wall cutaway system, and window.__OFFICE_DEBUG__ inspection hooks.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {import('./registry.js').CanonSceneRegistry} registry
 * @param {object} [options]
 */
export function createOfficeEngine(canvas, registry, options = {}) {
  if (!canvas) {
    throw new Error('createOfficeEngine requires a valid HTMLCanvasElement.');
  }

  const errors = [];
  const recordError = (err, context = '') => {
    const message = err instanceof Error ? err.message : String(err);
    const entry = {
      message: context ? `[${context}] ${message}` : message,
      stack: err instanceof Error ? err.stack : undefined,
      time: new Date().toISOString(),
    };
    errors.push(entry);
    if (typeof callbacks.onError === 'function') {
      try {
        callbacks.onError(entry);
      } catch (_) {
        // Prevent recursive callback failure
      }
    }
  };

  if (registry && typeof registry.setErrorHandler === 'function') {
    registry.setErrorHandler(recordError);
  }

  const onWindowError = (event) => {
    recordError(event.error || event.message || 'Unknown window error', 'window.error');
  };
  const onUnhandledRejection = (event) => {
    recordError(event.reason || 'Unhandled promise rejection', 'unhandledrejection');
  };
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  const callbacks = {
    onSelect: options.onSelect ?? null,
    onHover: options.onHover ?? null,
    onModeChange: options.onModeChange ?? null,
    onEraChange: options.onEraChange ?? null,
    onCutawayChange: options.onCutawayChange ?? null,
    onQualityChange: options.onQualityChange ?? null,
    onError: options.onError ?? null,
  };
  const getTextureLoadStatusFn =
    typeof options.getTextureLoadStatus === 'function' ? options.getTextureLoadStatus : null;

  let currentQuality =
    typeof options.quality === 'string' && options.quality in QUALITY_PRESETS
      ? options.quality
      : 'balanced';
  let activeQualityPreset = QUALITY_PRESETS[currentQuality];

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, activeQualityPreset.maxPixelRatio));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;

  // --- Scene & Warm Medieval Chamber PMREM Environment ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#161e2b');
  scene.fog = new THREE.FogExp2('#161e2b', 0.013);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const chamberEnv = createMedievalChamberEnvironment();
  const envRenderTarget = pmremGenerator.fromScene(chamberEnv.scene, 0.04);
  scene.environment = envRenderTarget.texture;
  scene.environmentIntensity = 0.68;
  chamberEnv.dispose();

  // --- Camera & OrbitControls ---
  const initialWidth = canvas.clientWidth || window.innerWidth || 1280;
  const initialHeight = canvas.clientHeight || window.innerHeight || 720;
  const camera = new THREE.PerspectiveCamera(48, initialWidth / initialHeight, 0.1, 180);
  camera.position.set(11.0, 8.6, 12.2);

  // --- Post-Processing Pipeline (RenderPass -> GTAOPass -> UnrealBloomPass -> OutputPass) ---
  let composer = null;
  let renderPass = null;
  let gtaoPass = null;
  let bloomPass = null;
  let outputPass = null;
  let composerDisabled = false;

  // Cached list of meshes hidden during GTAO depth/normal GBuffer pass (avoids per-frame scene.traverse)
  let nonAoMeshes = [];
  let nonAoSavedVis = [];
  let nonAoCacheFrame = -1;

  function rebuildNonAoCache() {
    nonAoMeshes = [];
    scene.traverse((object) => {
      if (object.isPoints || object.isLine) {
        nonAoMeshes.push(object);
      } else if (object.isMesh) {
        const mat = object.material;
        const singleMat = Array.isArray(mat) ? mat[0] : mat;
        if (
          object.userData?.isHighlightOverlay ||
          object.userData?.noShadow ||
          object.userData?.noAO ||
          (singleMat &&
            (singleMat.transparent === true ||
              singleMat.depthWrite === false ||
              singleMat.blending === THREE.AdditiveBlending ||
              singleMat.side === THREE.BackSide ||
              (singleMat.transmission || 0) > 0))
        ) {
          nonAoMeshes.push(object);
        }
      }
    });
    nonAoSavedVis = new Array(nonAoMeshes.length);
  }

  try {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    try {
      const effW = Math.max(1, Math.round(initialWidth * renderer.getPixelRatio()));
      const effH = Math.max(1, Math.round(initialHeight * renderer.getPixelRatio()));
      const aoW = Math.max(1, Math.round(effW * activeQualityPreset.gtaoScale));
      const aoH = Math.max(1, Math.round(effH * activeQualityPreset.gtaoScale));
      gtaoPass = new GTAOPass(scene, camera, aoW, aoH);
      gtaoPass.updateGtaoMaterial({
        radius: 0.42,
        distanceExponent: 1.7,
        samples: activeQualityPreset.gtaoSamples,
        scale: 1.0,
      });
      gtaoPass.updatePdMaterial({
        samples: activeQualityPreset.pdSamples,
        lumaPhi: 10,
        depthPhi: 2,
        normalPhi: 3,
      });
      gtaoPass.blendIntensity = 0.82;
      gtaoPass.overrideVisibility = () => {
        if (nonAoCacheFrame < 0 || nonAoCacheFrame % 120 === 0) {
          rebuildNonAoCache();
        }
        nonAoCacheFrame += 1;
        for (let i = 0; i < nonAoMeshes.length; i++) {
          const obj = nonAoMeshes[i];
          nonAoSavedVis[i] = obj.visible;
          obj.visible = false;
        }
      };
      gtaoPass.restoreVisibility = () => {
        for (let i = 0; i < nonAoMeshes.length; i++) {
          nonAoMeshes[i].visible = nonAoSavedVis[i];
        }
      };
      composer.addPass(gtaoPass);
    } catch (_) {
      gtaoPass = null;
    }

    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.max(1, Math.round(initialWidth * activeQualityPreset.bloomScale)),
        Math.max(1, Math.round(initialHeight * activeQualityPreset.bloomScale))
      ),
      0.18,
      0.36,
      0.91
    );
    composer.addPass(bloomPass);

    outputPass = new OutputPass();
    composer.addPass(outputPass);
  } catch (_) {
    composer = null;
    composerDisabled = true;
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.75;
  controls.minDistance = 0.8;
  controls.maxDistance = 32;
  controls.maxPolarAngle = Math.PI * 0.8;
  controls.target.set(0, 2.0, 0);
  controls.update();

  // --- Architecture & Walk Bounds ---
  const archBounds = {
    officeCenter: new THREE.Vector3(0, 0, 0),
    officeRadius: 6.5,
    floorY: 0,
    lowerFloorY: -3.6,
    eyeHeight: 1.68,
    playerRadius: 0.55,
    ceilingCutY: 5.5,
    corridorRect: { minX: -0.68, maxX: 0.68, minZ: 6.0, maxZ: 7.45 },
    extraWalkRects: [],
    obstacles: [],
  };

  // --- Camera Presets ---
  const cameraPresets = new Map([
    ['overview', { pos: new THREE.Vector3(11.0, 8.6, 12.2), target: new THREE.Vector3(0, 2.0, 0), mode: 'orbit' }],
    ['cutaway', { pos: new THREE.Vector3(10.5, 7.8, 11.4), target: new THREE.Vector3(0, 1.8, 0), mode: 'orbit' }],
    ['interior', { pos: new THREE.Vector3(0.4, 2.35, 5.2), target: new THREE.Vector3(0, 1.85, -2.5), mode: 'orbit' }],
    ['desk', { pos: new THREE.Vector3(0.0, 2.45, 1.4), target: new THREE.Vector3(0, 1.4, -2.6), mode: 'orbit' }],
    ['entrance', { pos: new THREE.Vector3(0.0, 2.1, 13.0), target: new THREE.Vector3(0, 1.8, 7.2), mode: 'orbit' }],
    ['top', { pos: new THREE.Vector3(0.0, 19.0, 0.01), target: new THREE.Vector3(0, 0, 0), mode: 'orbit' }],
    ['first-person', { pos: new THREE.Vector3(0, 1.68, 4.4), target: new THREE.Vector3(0, 1.68, -2.0), mode: 'first-person' }],
  ]);

  // --- Lighting Rig ---
  const lightingGroup = new THREE.Group();
  lightingGroup.name = 'EraLightingRig';
  scene.add(lightingGroup);

  const hemiLight = new THREE.HemisphereLight('#89a3c7', '#4a3525', 0.65);
  hemiLight.position.set(0, 16, 0);
  lightingGroup.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#ffd49c', 2.1);
  keyLight.position.set(14, 15, -10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(activeQualityPreset.keyShadowSize, activeQualityPreset.keyShadowSize);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 48;
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -14;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.02;
  lightingGroup.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#6f8ec2', 0.55);
  fillLight.position.set(-10, 9, 12);
  lightingGroup.add(fillLight);

  // Non-shadow omnidirectional hearth bounce + 1-pass SpotLight shadow aimed out of fireplace (6x faster than PointLight cubemap)
  const hearthLight = new THREE.PointLight('#ff8a36', 3.4 * 0.55, 15, 1.5);
  hearthLight.position.set(-5.6, 1.25, 0.0);
  hearthLight.castShadow = false;
  lightingGroup.add(hearthLight);

  const hearthShadowSpot = new THREE.SpotLight('#ff8a36', 3.4 * 0.85, 16, Math.PI * 0.46, 0.85, 1.4);
  hearthShadowSpot.position.set(-5.55, 1.35, 0.0);
  hearthShadowSpot.target.position.set(1.2, 0.5, 0.0);
  hearthShadowSpot.castShadow = activeQualityPreset.hearthShadow;
  hearthShadowSpot.shadow.mapSize.set(activeQualityPreset.hearthShadowSize, activeQualityPreset.hearthShadowSize);
  hearthShadowSpot.shadow.camera.near = 0.25;
  hearthShadowSpot.shadow.camera.far = 16;
  hearthShadowSpot.shadow.bias = -0.0012;
  hearthShadowSpot.shadow.normalBias = 0.03;
  lightingGroup.add(hearthShadowSpot);
  lightingGroup.add(hearthShadowSpot.target);

  // Subtle floating illuminated atmospheric dust motes inside the circular chamber
  const dustMotes = createAtmosphericDustMotes(160);
  scene.add(dustMotes.points);

  const candleLights = [
    { light: new THREE.PointLight('#ffb95e', 1.9, 14, 1.55), basePos: new THREE.Vector3(0.0, 2.15, -2.5), phase: 0.4 },
    { light: new THREE.PointLight('#ffb95e', 1.7, 13, 1.55), basePos: new THREE.Vector3(3.6, 3.1, 2.2), phase: 2.1 },
    { light: new THREE.PointLight('#ffb95e', 1.7, 13, 1.55), basePos: new THREE.Vector3(-3.2, 3.1, 3.0), phase: 4.3 },
  ];
  for (const c of candleLights) {
    c.light.position.copy(c.basePos);
    lightingGroup.add(c.light);
  }

  // Subtle warm candle bounce reaching the North pier (Dumbledore's portrait & Sorting Hat shelf)
  const northPierLight = new THREE.PointLight('#ffc87a', 1.35, 8.5, 1.45);
  northPierLight.position.set(0.0, 2.8, -4.4);
  lightingGroup.add(northPierLight);
  let northPierBaseIntensity = 1.35;

  let currentEra = 'cos';
  let currentEraConfig = ERA_LIGHTING_PRESETS.cos;

  function applyEraLighting(eraId = 'cos') {
    const key = typeof eraId === 'string' && eraId.toLowerCase() in ERA_LIGHTING_PRESETS
      ? eraId.toLowerCase()
      : 'cos';
    const cfg = ERA_LIGHTING_PRESETS[key];
    currentEra = key;
    currentEraConfig = cfg;

    scene.background = new THREE.Color(cfg.background);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.set(cfg.fogColor);
      scene.fog.density = cfg.fogDensity;
    } else {
      scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    }

    scene.environmentIntensity = cfg.envIntensity;

    hemiLight.color.set(cfg.hemiSky);
    hemiLight.groundColor.set(cfg.hemiGround);
    hemiLight.intensity = cfg.hemiIntensity;

    keyLight.color.set(cfg.keyColor);
    keyLight.intensity = cfg.keyIntensity;
    keyLight.position.set(cfg.keyPosition[0], cfg.keyPosition[1], cfg.keyPosition[2]);

    fillLight.color.set(cfg.fillColor);
    fillLight.intensity = cfg.fillIntensity;

    hearthLight.color.set(cfg.hearthColor);
    hearthLight.intensity = cfg.hearthIntensity * 0.55;
    hearthShadowSpot.color.set(cfg.hearthColor);
    hearthShadowSpot.intensity = cfg.hearthIntensity * 0.85;

    for (const c of candleLights) {
      c.light.color.set(cfg.candleColor);
      c.light.intensity = cfg.candleIntensity;
    }

    northPierLight.color.set(cfg.candleColor).lerp(new THREE.Color('#fff0d6'), 0.25);
    northPierBaseIntensity = key === 'dh' ? 0.65 : key === 'hbp' ? 1.45 : 1.15;
    northPierLight.intensity = northPierBaseIntensity;

    dustMotes.setEra(key);

    if (registry && typeof registry.applyEra === 'function') {
      registry.applyEra(key);
    }
    if (typeof callbacks.onEraChange === 'function') {
      callbacks.onEraChange(key, cfg);
    }
    return key;
  }

  // --- Wall Cutaway System ---
  let cutawayEnabled = true;
  /** @type {{ object: THREE.Object3D, normal: THREE.Vector3 }[]} */
  const cutawaySectors = [];
  /** @type {THREE.Object3D[]} */
  const cutawayCeilings = [];

  function registerCutawayWallSectors(sectors = []) {
    cutawaySectors.length = 0;
    for (const s of sectors) {
      if (!s || !s.object) continue;
      let normal;
      if (s.normal) {
        normal = toVec3(s.normal, [0, 0, 1]);
      } else if (typeof s.angle === 'number') {
        normal = new THREE.Vector3(Math.cos(s.angle), 0, Math.sin(s.angle));
      } else {
        continue;
      }
      normal.y = 0;
      if (normal.lengthSq() > 0) normal.normalize();
      cutawaySectors.push({ object: s.object, normal });
    }
    updateCutawayVisibility();
  }

  function registerCutawayCeiling(objects = []) {
    cutawayCeilings.length = 0;
    const list = Array.isArray(objects) ? objects : [objects];
    for (const obj of list) {
      if (obj) cutawayCeilings.push(obj);
    }
    updateCutawayVisibility();
  }

  function updateCutawayVisibility() {
    const showFull = !cutawayEnabled || mode === 'first-person';
    if (showFull) {
      for (const s of cutawaySectors) {
        s.object.visible = true;
      }
      for (const c of cutawayCeilings) {
        c.visible = true;
      }
      return;
    }

    const dx = camera.position.x - archBounds.officeCenter.x;
    const dz = camera.position.z - archBounds.officeCenter.z;
    const distXZ = Math.hypot(dx, dz);

    const outsideRadius = distXZ > archBounds.officeRadius * 0.85;
    if (!outsideRadius) {
      for (const s of cutawaySectors) {
        s.object.visible = true;
      }
      for (const c of cutawayCeilings) {
        c.visible = camera.position.y < archBounds.ceilingCutY;
      }
      return;
    }

    const invDist = distXZ > 1e-5 ? 1 / distXZ : 0;
    const camDirX = dx * invDist;
    const camDirZ = dz * invDist;

    for (const s of cutawaySectors) {
      const dot = camDirX * s.normal.x + camDirZ * s.normal.z;
      s.object.visible = dot <= 0.14;
    }
    for (const c of cutawayCeilings) {
      c.visible = false;
    }
  }

  function setCutaway(enabled) {
    cutawayEnabled = Boolean(enabled);
    updateCutawayVisibility();
    if (typeof callbacks.onCutawayChange === 'function') {
      callbacks.onCutawayChange(cutawayEnabled);
    }
    return cutawayEnabled;
  }

  // --- Mode & Fly-To Tweening ---
  let mode = 'orbit'; // 'orbit' | 'first-person'
  const fpState = {
    yaw: 0,
    pitch: 0,
    isDraggingLook: false,
    lastMouseX: 0,
    lastMouseY: 0,
    keys: new Set(),
    moveSpeed: 3.8,
  };

  let activeTween = null;

  function cancelTween() {
    if (activeTween) {
      const resolve = activeTween.resolve;
      activeTween = null;
      if (resolve) resolve(false);
    }
  }

  function syncFpAnglesFromCamera() {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    fpState.yaw = euler.y;
    fpState.pitch = THREE.MathUtils.clamp(euler.x, -1.28, 1.28);
  }

  function applyFpQuaternion() {
    const euler = new THREE.Euler(fpState.pitch, fpState.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  }

  function isPointWalkable(x, z) {
    const margin = archBounds.playerRadius;
    const cx = archBounds.officeCenter.x;
    const cz = archBounds.officeCenter.z;

    // 1. Check obstacles first
    for (const obs of archBounds.obstacles) {
      if (obs.type === 'circle') {
        const d = Math.hypot(x - obs.x, z - obs.z);
        if (d < obs.radius + margin) return false;
      } else if (obs.type === 'box') {
        if (
          x > obs.minX - margin &&
          x < obs.maxX + margin &&
          z > obs.minZ - margin &&
          z < obs.maxZ + margin
        ) {
          return false;
        }
      }
    }

    // 2. Inside main circular room
    const r = Math.hypot(x - cx, z - cz);
    if (r <= archBounds.officeRadius - margin) {
      return true;
    }

    // 3. Inside entrance corridor / doorway bridge
    const c = archBounds.corridorRect;
    if (
      c &&
      x >= c.minX + margin &&
      x <= c.maxX - margin &&
      z >= c.minZ &&
      z <= c.maxZ - margin
    ) {
      return true;
    }

    // 4. Extra walkable rects (if supplied by layout)
    for (const rect of archBounds.extraWalkRects) {
      if (
        x >= rect.minX + margin &&
        x <= rect.maxX - margin &&
        z >= rect.minZ + margin &&
        z <= rect.maxZ - margin
      ) {
        return true;
      }
    }

    return false;
  }

  function clampToWalkable(x, z) {
    if (isPointWalkable(x, z)) return [x, z];

    const cx = archBounds.officeCenter.x;
    const cz = archBounds.officeCenter.z;
    const maxR = Math.max(0.5, archBounds.officeRadius - archBounds.playerRadius);
    const dx = x - cx;
    const dz = z - cz;
    const len = Math.hypot(dx, dz) || 1;
    const clampedX = cx + (dx / len) * maxR;
    const clampedZ = cz + (dz / len) * maxR;

    if (isPointWalkable(clampedX, clampedZ)) {
      return [clampedX, clampedZ];
    }
    return [cx, cz + maxR * 0.5];
  }

  function setFirstPerson(enabled) {
    const nextMode = enabled ? 'first-person' : 'orbit';
    if (mode === nextMode) return mode;

    cancelTween();
    mode = nextMode;
    canvas.dataset.mode = mode;

    if (mode === 'first-person') {
      controls.enabled = false;
      const [wx, wz] = clampToWalkable(camera.position.x, camera.position.z);
      camera.position.set(wx, archBounds.floorY + archBounds.eyeHeight, wz);

      // Look gently toward office center if coming from outside, or keep current look direction
      const toCenter = new THREE.Vector3(
        archBounds.officeCenter.x - wx,
        archBounds.floorY + archBounds.eyeHeight - camera.position.y,
        archBounds.officeCenter.z - wz
      );
      if (toCenter.lengthSq() > 0.2) {
        const lookAtTarget = camera.position.clone().add(toCenter.normalize());
        camera.lookAt(lookAtTarget);
      }
      syncFpAnglesFromCamera();
      applyFpQuaternion();
    } else {
      fpState.keys.clear();
      fpState.isDraggingLook = false;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      controls.target.copy(camera.position).addScaledVector(forward, 3.2);
      controls.target.y = Math.max(0.5, controls.target.y);
      controls.enabled = true;
      controls.update();
    }

    updateCutawayVisibility();
    if (typeof callbacks.onModeChange === 'function') {
      callbacks.onModeChange(mode);
    }
    return mode;
  }

  function flyTo(pos, target, durationMs = 850) {
    if (mode === 'first-person') {
      setFirstPerson(false);
    }

    const endPos = toVec3(pos, [11, 8.6, 12.2]);
    const endTarget = toVec3(target, [0, 2, 0]);

    cancelTween();

    if (!durationMs || durationMs <= 0) {
      camera.position.copy(endPos);
      controls.target.copy(endTarget);
      controls.update();
      updateCutawayVisibility();
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      activeTween = {
        startPos: camera.position.clone(),
        startTarget: controls.target.clone(),
        endPos,
        endTarget,
        duration: durationMs / 1000,
        elapsed: 0,
        resolve,
      };
    });
  }

  function setCameraPreset(name, durationMs = 800) {
    const key = typeof name === 'string' ? name.toLowerCase() : 'overview';
    const preset = cameraPresets.get(key);
    if (!preset) {
      return { ok: false, error: `Unknown camera preset "${name}"` };
    }

    if (preset.mode === 'first-person') {
      if (mode !== 'first-person') {
        setFirstPerson(true);
      }
      const [wx, wz] = clampToWalkable(preset.pos.x, preset.pos.z);
      camera.position.set(wx, archBounds.floorY + archBounds.eyeHeight, wz);
      camera.lookAt(preset.target);
      syncFpAnglesFromCamera();
      applyFpQuaternion();
      return {
        ok: true,
        preset: key,
        position: camera.position.toArray(),
        target: preset.target.toArray(),
      };
    }

    if (typeof preset.cutaway === 'boolean') {
      setCutaway(preset.cutaway);
    }

    const promise = flyTo(preset.pos, preset.target, durationMs);
    return {
      ok: true,
      preset: key,
      position: preset.pos.toArray(),
      target: preset.target.toArray(),
      cutaway: cutawayEnabled,
      promise,
    };
  }

  function registerCameraPresets(presetsMap) {
    if (!presetsMap) return;
    const entries = presetsMap instanceof Map ? presetsMap.entries() : Object.entries(presetsMap);
    for (const [name, cfg] of entries) {
      if (!cfg) continue;
      cameraPresets.set(name.toLowerCase(), {
        pos: toVec3(cfg.pos || cfg.cameraPos),
        target: toVec3(cfg.target || cfg.cameraTarget),
        mode: cfg.mode || 'orbit',
        cutaway: typeof cfg.cutaway === 'boolean' ? cfg.cutaway : undefined,
      });
    }
  }

  // --- Highlight & Raycast Selection ---
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const hoverRimMat = createHighlightRimMaterial('#fff0bd', 0.38);
  const selectedRimMat = createHighlightRimMaterial('#ffd166', 0.54);

  /** @type {WeakMap<THREE.Mesh, THREE.Mesh>} */
  const overlayCache = new WeakMap();
  let hoveredId = null;
  let selectedId = null;

  function ensureOverlayForMesh(mesh) {
    if (!mesh || !mesh.isMesh || !mesh.geometry) return null;
    if (mesh.userData?.isHighlightOverlay) return null;
    if (mesh.geometry.type === 'PlaneGeometry') return null;

    let overlay = overlayCache.get(mesh);
    if (!overlay) {
      overlay = new THREE.Mesh(mesh.geometry, hoverRimMat);
      overlay.name = `${mesh.name || 'mesh'}_highlight`;
      overlay.userData.isHighlightOverlay = true;
      overlay.castShadow = false;
      overlay.receiveShadow = false;
      overlay.raycast = () => {};
      overlay.renderOrder = 10;
      overlay.visible = false;
      mesh.add(overlay);
      overlayCache.set(mesh, overlay);
    }
    return overlay;
  }

  function setEntryHighlight(id, state /* 'none' | 'hover' | 'selected' */) {
    if (!id || !registry) return;
    const entry = registry.get(id);
    if (!entry) return;

    const targets = entry.hitMeshes && entry.hitMeshes.length > 0 ? entry.hitMeshes : entry.group ? [entry.group] : [];
    for (const root of targets) {
      root.traverse((obj) => {
        if (!obj.isMesh || obj.userData?.isHighlightOverlay) return;
        if (state === 'none') {
          const existing = overlayCache.get(obj);
          if (existing) existing.visible = false;
        } else {
          const overlay = ensureOverlayForMesh(obj);
          if (overlay) {
            overlay.material = state === 'selected' ? selectedRimMat : hoverRimMat;
            overlay.visible = true;
          }
        }
      });
    }
  }

  function refreshHighlights() {
    if (hoveredId && hoveredId !== selectedId) {
      setEntryHighlight(hoveredId, 'hover');
    }
    if (selectedId) {
      setEntryHighlight(selectedId, 'selected');
    }
  }

  function setHoveredId(nextId) {
    if (hoveredId === nextId) return;
    const prevId = hoveredId;
    hoveredId = nextId;

    if (prevId && prevId !== selectedId) {
      setEntryHighlight(prevId, 'none');
    }
    if (hoveredId && hoveredId !== selectedId) {
      setEntryHighlight(hoveredId, 'hover');
    }

    if (hoveredId) {
      canvas.classList.add('is-hovering');
      document.body.dataset.hoverCanon = hoveredId;
    } else {
      canvas.classList.remove('is-hovering');
      delete document.body.dataset.hoverCanon;
    }

    if (typeof callbacks.onHover === 'function') {
      callbacks.onHover(hoveredId ? registry.get(hoveredId) : null);
    }
  }

  function selectObject(id, { focus = false, durationMs = 850 } = {}) {
    if (id !== null && id !== undefined && (!registry || !registry.has(id))) {
      return false;
    }
    const nextId = id ?? null;
    if (selectedId !== nextId) {
      const prevId = selectedId;
      selectedId = nextId;
      if (prevId) {
        setEntryHighlight(prevId, prevId === hoveredId ? 'hover' : 'none');
      }
      if (selectedId) {
        setEntryHighlight(selectedId, 'selected');
      }
    }

    const entry = selectedId ? registry.get(selectedId) : null;
    if (focus && entry) {
      flyTo(entry.cameraPos, entry.cameraTarget, durationMs);
    }

    if (typeof callbacks.onSelect === 'function') {
      callbacks.onSelect(selectedId, entry);
    }
    return true;
  }

  function focusObject(id, durationMs = 850) {
    const entry = registry ? registry.get(id) : null;
    if (!entry) return false;
    selectObject(id, { focus: true, durationMs });
    return true;
  }

  const _pickBoxCache = new WeakMap();

  function isObjectHierarchyVisible(obj) {
    let curr = obj;
    while (curr) {
      if (!curr.visible) return false;
      curr = curr.parent;
    }
    return true;
  }

  function pickCanonAtClientCoords(clientX, clientY) {
    if (!registry) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerNDC, camera);
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const entries = registry.list();
    const candidateTargets = [];

    for (const entry of entries) {
      if (!entry.hitMeshes || entry.hitMeshes.length === 0) continue;
      if (entry.group && !entry.group.visible) continue;

      const isDynamic = Boolean(entry.onUpdate || entry.interact);
      let entryBoxData = _pickBoxCache.get(entry);
      if (!entryBoxData || (isDynamic && nowMs - entryBoxData.updatedAt > 450)) {
        const box = entryBoxData ? entryBoxData.box : new THREE.Box3();
        const tmpBox = new THREE.Box3();
        box.makeEmpty();
        let hasAny = false;
        for (const target of entry.hitMeshes) {
          if (!target) continue;
          tmpBox.setFromObject(target);
          if (!tmpBox.isEmpty()) {
            box.union(tmpBox);
            hasAny = true;
          }
        }
        if (hasAny) {
          box.expandByScalar(0.08);
        }
        entryBoxData = { box, updatedAt: nowMs, hasAny };
        _pickBoxCache.set(entry, entryBoxData);
      }

      if (!entryBoxData.hasAny || !raycaster.ray.intersectsBox(entryBoxData.box)) {
        continue;
      }

      for (const target of entry.hitMeshes) {
        if (!target || !isObjectHierarchyVisible(target)) continue;
        if (entry.hitMeshes.length > 1) {
          let targetBoxData = _pickBoxCache.get(target);
          if (!targetBoxData || (isDynamic && nowMs - targetBoxData.updatedAt > 450)) {
            const box = targetBoxData ? targetBoxData.box : new THREE.Box3();
            box.setFromObject(target);
            if (!box.isEmpty()) box.expandByScalar(0.06);
            targetBoxData = { box, updatedAt: nowMs };
            _pickBoxCache.set(target, targetBoxData);
          }
          if (targetBoxData.box.isEmpty() || !raycaster.ray.intersectsBox(targetBoxData.box)) {
            continue;
          }
        }
        candidateTargets.push(target);
      }
    }

    if (!candidateTargets.length) return null;

    const hits = raycaster.intersectObjects(candidateTargets, true);
    for (const hit of hits) {
      if (hit.object?.userData?.isHighlightOverlay) continue;
      const entry = registry.resolveHit(hit.object);
      if (entry) return entry;
    }
    return null;
  }

  // --- Pointer & Keyboard Event Wiring ---
  let pointerDownX = 0;
  let pointerDownY = 0;
  let isPointerDown = false;
  let hoverLastPickMs = 0;

  const onPointerDown = (e) => {
    isPointerDown = true;
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    canvas.classList.add('is-dragging');
    cancelTween();

    if (mode === 'first-person') {
      fpState.isDraggingLook = true;
      fpState.lastMouseX = e.clientX;
      fpState.lastMouseY = e.clientY;
    }
  };

  const onPointerMove = (e) => {
    if (mode === 'first-person' && fpState.isDraggingLook && isPointerDown) {
      const dx = e.clientX - fpState.lastMouseX;
      const dy = e.clientY - fpState.lastMouseY;
      fpState.lastMouseX = e.clientX;
      fpState.lastMouseY = e.clientY;

      fpState.yaw -= dx * 0.0034;
      fpState.pitch = THREE.MathUtils.clamp(fpState.pitch - dy * 0.003, -1.28, 1.28);
      applyFpQuaternion();
    }

    if (isPointerDown) return;

    if (e.target === canvas) {
      const nowHoverMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (nowHoverMs - hoverLastPickMs < 75) return;
      hoverLastPickMs = nowHoverMs;
      const hitEntry = pickCanonAtClientCoords(e.clientX, e.clientY);
      setHoveredId(hitEntry ? hitEntry.id : null);
    } else {
      setHoveredId(null);
    }
  };

  const onPointerUp = (e) => {
    if (!isPointerDown) return;
    const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
    isPointerDown = false;
    fpState.isDraggingLook = false;
    canvas.classList.remove('is-dragging');

    if (moved < 6 && e.button === 0 && e.target === canvas) {
      const hitEntry = pickCanonAtClientCoords(e.clientX, e.clientY);
      selectObject(hitEntry ? hitEntry.id : null);
    }
  };

  const onDoubleClick = (e) => {
    const hitEntry = pickCanonAtClientCoords(e.clientX, e.clientY);
    if (hitEntry) {
      selectObject(hitEntry.id, { focus: true, durationMs: 850 });
    }
  };

  const onWheel = () => {
    cancelTween();
  };

  const onPointerLeave = () => {
    isPointerDown = false;
    fpState.isDraggingLook = false;
    canvas.classList.remove('is-dragging');
    setHoveredId(null);
  };

  const onKeyDown = (e) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

    const code = e.code;
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight'
    ) {
      fpState.keys.add(code);
    }
  };

  const onKeyUp = (e) => {
    fpState.keys.delete(e.code);
  };

  function syncPipelineSize(width, height) {
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, activeQualityPreset.maxPixelRatio);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);

    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
      const effW = Math.max(1, Math.round(width * dpr));
      const effH = Math.max(1, Math.round(height * dpr));
      if (gtaoPass) {
        const aoW = Math.max(1, Math.round(effW * activeQualityPreset.gtaoScale));
        const aoH = Math.max(1, Math.round(effH * activeQualityPreset.gtaoScale));
        gtaoPass.setSize(aoW, aoH);
      }
      if (bloomPass) {
        bloomPass.setSize(
          Math.max(1, Math.round(width * activeQualityPreset.bloomScale)),
          Math.max(1, Math.round(height * activeQualityPreset.bloomScale))
        );
      }
    }
  }

  function setQuality(qualityId = 'balanced') {
    const key = typeof qualityId === 'string' && qualityId.toLowerCase() in QUALITY_PRESETS
      ? qualityId.toLowerCase()
      : 'balanced';
    const preset = QUALITY_PRESETS[key];
    currentQuality = key;
    activeQualityPreset = preset;

    if (keyLight.shadow.mapSize.x !== preset.keyShadowSize) {
      keyLight.shadow.mapSize.set(preset.keyShadowSize, preset.keyShadowSize);
      if (keyLight.shadow.map) {
        keyLight.shadow.map.dispose();
        keyLight.shadow.map = null;
      }
    }
    hearthShadowSpot.castShadow = Boolean(preset.hearthShadow);
    if (hearthShadowSpot.shadow.mapSize.x !== preset.hearthShadowSize) {
      hearthShadowSpot.shadow.mapSize.set(preset.hearthShadowSize, preset.hearthShadowSize);
      if (hearthShadowSpot.shadow.map) {
        hearthShadowSpot.shadow.map.dispose();
        hearthShadowSpot.shadow.map = null;
      }
    }

    if (gtaoPass) {
      gtaoPass.enabled = Boolean(preset.gtaoEnabled);
      if (preset.gtaoEnabled) {
        gtaoPass.updateGtaoMaterial({
          radius: 0.42,
          distanceExponent: 1.7,
          samples: preset.gtaoSamples,
          scale: 1.0,
        });
        gtaoPass.updatePdMaterial({
          samples: preset.pdSamples,
          lumaPhi: 10,
          depthPhi: 2,
          normalPhi: 3,
        });
      }
    }

    perfEmaMs = 16.67;
    perfLastTimestamp = 0;

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width > 0 && height > 0) {
      syncPipelineSize(width, height);
    }

    if (typeof callbacks.onQualityChange === 'function') {
      callbacks.onQualityChange(currentQuality, preset);
    }
    return currentQuality;
  }

  const onResize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    syncPipelineSize(width, height);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onResize);

  // --- Frame Update & Render Loop ---
  const clock = new THREE.Clock();
  let rafId = null;
  let elapsed = 0;

  const forwardVec = new THREE.Vector3();
  const rightVec = new THREE.Vector3();

  function updateFirstPersonMovement(dt) {
    if (mode !== 'first-person' || fpState.keys.size === 0) return;

    let fwd = 0;
    let strafe = 0;
    if (fpState.keys.has('KeyW') || fpState.keys.has('ArrowUp')) fwd += 1;
    if (fpState.keys.has('KeyS') || fpState.keys.has('ArrowDown')) fwd -= 1;
    if (fpState.keys.has('KeyD') || fpState.keys.has('ArrowRight')) strafe += 1;
    if (fpState.keys.has('KeyA') || fpState.keys.has('ArrowLeft')) strafe -= 1;

    if (fwd === 0 && strafe === 0) return;

    const sprint = fpState.keys.has('ShiftLeft') || fpState.keys.has('ShiftRight') ? 1.65 : 1.0;
    const speed = fpState.moveSpeed * sprint * dt;

    forwardVec.set(-Math.sin(fpState.yaw), 0, -Math.cos(fpState.yaw)).normalize();
    rightVec.set(Math.cos(fpState.yaw), 0, -Math.sin(fpState.yaw)).normalize();

    const moveX = (forwardVec.x * fwd + rightVec.x * strafe) * speed;
    const moveZ = (forwardVec.z * fwd + rightVec.z * strafe) * speed;

    const oldX = camera.position.x;
    const oldZ = camera.position.z;
    const nextX = oldX + moveX;
    const nextZ = oldZ + moveZ;

    if (isPointWalkable(nextX, nextZ)) {
      camera.position.x = nextX;
      camera.position.z = nextZ;
    } else if (isPointWalkable(nextX, oldZ)) {
      camera.position.x = nextX;
    } else if (isPointWalkable(oldX, nextZ)) {
      camera.position.z = nextZ;
    } else {
      const [cx, cz] = clampToWalkable(nextX, nextZ);
      camera.position.x = cx;
      camera.position.z = cz;
    }
    camera.position.y = archBounds.floorY + archBounds.eyeHeight;
  }

  function updateLights(t) {
    const hBase = currentEraConfig.hearthIntensity;
    const hFlicker =
      Math.sin(t * 7.3) * 0.14 + Math.sin(t * 13.7 + 1.1) * 0.08 + Math.cos(t * 21.1) * 0.05;
    const hScale = 1 + hFlicker;
    hearthLight.intensity = Math.max(0.15, hBase * 0.55 * hScale);
    hearthShadowSpot.intensity = Math.max(0.2, hBase * 0.85 * hScale);

    const cBase = currentEraConfig.candleIntensity;
    for (const c of candleLights) {
      const cf = Math.sin(t * 5.2 + c.phase) * 0.07 + Math.sin(t * 11.9 + c.phase * 1.7) * 0.04;
      c.light.intensity = Math.max(0.1, cBase * (1 + cf));
    }

    const npFlicker = Math.sin(t * 4.6 + 1.2) * 0.05 + Math.sin(t * 10.3 + 2.7) * 0.03;
    northPierLight.intensity = Math.max(0.1, northPierBaseIntensity * (1 + npFlicker));
  }

  let perfEmaMs = 16.67;
  let perfLastTimestamp = 0;

  function stepFrame(dt) {
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (perfLastTimestamp > 0) {
      const frameDeltaMs = Math.max(0.5, Math.min(250, nowPerf - perfLastTimestamp));
      perfEmaMs = perfEmaMs * 0.9 + frameDeltaMs * 0.1;
    }
    perfLastTimestamp = nowPerf;

    const safeDt = Math.min(dt, 0.1);
    elapsed += safeDt;

    if (activeTween) {
      activeTween.elapsed += safeDt;
      const rawT = Math.min(1, activeTween.elapsed / activeTween.duration);
      const t = easeInOutCubic(rawT);
      camera.position.lerpVectors(activeTween.startPos, activeTween.endPos, t);
      controls.target.lerpVectors(activeTween.startTarget, activeTween.endTarget, t);
      if (rawT >= 1) {
        const resolve = activeTween.resolve;
        activeTween = null;
        if (resolve) resolve(true);
      }
    }

    if (mode === 'orbit') {
      controls.update();
      const inLowerApproach = camera.position.z > archBounds.officeRadius + 0.8 && Math.abs(camera.position.x) < 4.5;
      const localFloorY = inLowerApproach ? archBounds.lowerFloorY : archBounds.floorY;
      const minCamY = localFloorY + 0.28;
      if (camera.position.y < minCamY) {
        camera.position.y = minCamY;
      }
    } else {
      updateFirstPersonMovement(safeDt);
    }

    updateCutawayVisibility();
    updateLights(elapsed);
    dustMotes.update(safeDt, elapsed);

    if (registry && typeof registry.update === 'function') {
      registry.update(safeDt, elapsed, {
        era: currentEra,
        mode,
        cutaway: cutawayEnabled,
        selectedId,
        hoveredId,
        camera,
      });
    }

    refreshHighlights();

    renderer.info.reset();

    if (composer && !composerDisabled && activeQualityPreset.useComposer) {
      try {
        composer.render(safeDt);
        return;
      } catch (err) {
        if (gtaoPass && gtaoPass.enabled) {
          gtaoPass.enabled = false;
          try {
            composer.render(safeDt);
            return;
          } catch (_) {
            // Fall through to direct renderer fallback
          }
        }
        composerDisabled = true;
      }
    }

    try {
      renderer.render(scene, camera);
    } catch (err) {
      recordError(err, 'renderer.render');
    }
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    const dt = clock.getDelta();
    stepFrame(dt);
  }

  function start() {
    if (rafId !== null) return;
    clock.start();
    clock.getDelta();
    loop();
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // --- Architecture & Lighting Helpers for Phase 2 Layout ---
  function setArchitectureBounds(bounds = {}) {
    if (bounds.officeCenter) archBounds.officeCenter.copy(toVec3(bounds.officeCenter));
    if (typeof bounds.officeRadius === 'number') archBounds.officeRadius = bounds.officeRadius;
    if (typeof bounds.floorY === 'number') archBounds.floorY = bounds.floorY;
    if (typeof bounds.lowerFloorY === 'number') archBounds.lowerFloorY = bounds.lowerFloorY;
    if (typeof bounds.eyeHeight === 'number') archBounds.eyeHeight = bounds.eyeHeight;
    if (typeof bounds.playerRadius === 'number') archBounds.playerRadius = bounds.playerRadius;
    if (typeof bounds.ceilingCutY === 'number') archBounds.ceilingCutY = bounds.ceilingCutY;
    if (bounds.corridorRect !== undefined) archBounds.corridorRect = bounds.corridorRect;
    if (Array.isArray(bounds.extraWalkRects)) archBounds.extraWalkRects = bounds.extraWalkRects;
    if (Array.isArray(bounds.obstacles)) archBounds.obstacles = bounds.obstacles;
    updateCutawayVisibility();
  }

  function setLightingAnchors({ hearthPosition, candlePositions } = {}) {
    if (hearthPosition) {
      const hp = toVec3(hearthPosition);
      hearthLight.position.copy(hp);
      hearthShadowSpot.position.set(hp.x + 0.05, hp.y + 0.1, hp.z);
    }
    if (Array.isArray(candlePositions)) {
      candlePositions.forEach((pos, idx) => {
        if (candleLights[idx]) {
          candleLights[idx].basePos.copy(toVec3(pos));
          candleLights[idx].light.position.copy(candleLights[idx].basePos);
        }
      });
    }
  }

  function setCallbacks(next = {}) {
    Object.assign(callbacks, next);
  }

  function getCameraState() {
    const target = new THREE.Vector3();
    if (mode === 'orbit') {
      target.copy(controls.target);
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      target.copy(camera.position).add(forward);
    }
    return {
      mode,
      position: camera.position.toArray(),
      target: target.toArray(),
      fov: camera.fov,
      cutaway: cutawayEnabled,
      era: currentEra,
      selectedId,
      hoveredId,
    };
  }

  function getSceneStats() {
    let meshCount = 0;
    scene.traverse((obj) => {
      if (obj.isMesh && !obj.userData?.isHighlightOverlay) meshCount += 1;
    });
    return {
      meshCount,
      registeredObjects: registry ? registry.list().length : 0,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };
  }

  function getPerfMetrics() {
    const safeMs = Math.max(0.5, perfEmaMs);
    return {
      fps: Math.round((1000 / safeMs) * 10) / 10,
      frameMs: Math.round(safeMs * 100) / 100,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      quality: currentQuality,
      pixelRatio: renderer.getPixelRatio(),
      composerActive: Boolean(composer && !composerDisabled && activeQualityPreset.useComposer),
      gtaoActive: Boolean(gtaoPass && gtaoPass.enabled && composer && !composerDisabled && activeQualityPreset.useComposer),
    };
  }

  // --- Deterministic QA Debug Surface ---
  const debugApi = {
    listObjects() {
      if (!registry) return [];
      return registry.list().map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        hasInteract: Boolean(e.interact),
        actions: e.actions,
        cameraPos: e.cameraPos.toArray(),
        cameraTarget: e.cameraTarget.toArray(),
      }));
    },
    selectObject(id, opts = {}) {
      return selectObject(id, { focus: Boolean(opts?.focus), durationMs: opts?.durationMs ?? 0 });
    },
    focusObject(id, durationMs = 0) {
      return focusObject(id, durationMs);
    },
    setCameraPreset(name, durationMs = 0) {
      return setCameraPreset(name, durationMs);
    },
    setEra(eraId) {
      return applyEraLighting(eraId);
    },
    setCutaway(bool) {
      return setCutaway(bool);
    },
    setFirstPerson(bool) {
      return setFirstPerson(bool);
    },
    setQuality(qualityId) {
      return setQuality(qualityId);
    },
    getQuality() {
      return currentQuality;
    },
    triggerAction(id, actionName, extra = {}) {
      if (!registry) return null;
      return registry.triggerInteract(id, actionName, { engine: api, ...extra });
    },
    getCameraState,
    getErrors() {
      return errors.map((e) => ({ ...e }));
    },
    getSceneStats,
    getPerfMetrics,
    getTextureLoadStatus() {
      if (getTextureLoadStatusFn) {
        return getTextureLoadStatusFn();
      }
      return { total: 0, loaded: 0, failed: 0, pending: 0, allSettled: true, files: {} };
    },
  };

  window.__OFFICE_DEBUG__ = debugApi;

  // Initialize default lighting
  applyEraLighting('cos');

  function dispose() {
    stop();
    cancelTween();
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('dblclick', onDoubleClick);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);

    controls.dispose();
    dustMotes.dispose();
    hoverRimMat.dispose();
    selectedRimMat.dispose();
    if (gtaoPass) {
      gtaoPass.dispose?.();
      gtaoPass.gtaoMaterial?.dispose?.();
      gtaoPass.blendMaterial?.dispose?.();
    }
    bloomPass?.dispose?.();
    outputPass?.dispose?.();
    renderPass?.dispose?.();
    composer?.dispose?.();
    envRenderTarget.dispose();
    pmremGenerator.dispose();
    renderer.dispose();

    if (window.__OFFICE_DEBUG__ === debugApi) {
      delete window.__OFFICE_DEBUG__;
    }
  }

  const api = {
    scene,
    camera,
    renderer,
    composer,
    controls,
    registry,
    start,
    stop,
    stepFrame,
    flyTo,
    setCameraPreset,
    registerCameraPresets,
    setFirstPerson,
    toggleFirstPerson: () => setFirstPerson(mode !== 'first-person'),
    getMode: () => mode,
    applyEraLighting,
    getEra: () => currentEra,
    setCutaway,
    isCutawayEnabled: () => cutawayEnabled,
    setQuality,
    getQuality: () => currentQuality,
    registerCutawayWallSectors,
    registerCutawayCeiling,
    setArchitectureBounds,
    setLightingAnchors,
    selectObject,
    focusObject,
    setCallbacks,
    getCameraState,
    getErrors: () => errors.map((e) => ({ ...e })),
    getSceneStats,
    getPerfMetrics,
    getTextureLoadStatus: debugApi.getTextureLoadStatus,
    dispose,
  };

  return api;
}
