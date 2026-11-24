import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';
const HAS_BROWSER_IMAGE = typeof window !== 'undefined' && typeof Image !== 'undefined';

/**
 * Deterministic 32-bit string hash (FNV-1a).
 * @param {string} str
 * @returns {number}
 */
function hashString(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic seeded PRNG (Mulberry32).
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tileable 2D value noise for seamless procedural fallback textures.
 * @param {number} x
 * @param {number} y
 * @param {number} period
 * @param {number} seed
 * @returns {number} [0..1]
 */
function tileableNoise2D(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const mod = (n) => ((n % period) + period) % period;
  const hash2 = (ix, iy) => {
    let n = Math.imul(mod(ix), 374761393) + Math.imul(mod(iy), 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };

  const x0 = mod(xi);
  const x1 = mod(xi + 1);
  const y0 = mod(yi);
  const y1 = mod(yi + 1);

  const a = hash2(x0, y0);
  const b = hash2(x1, y0);
  const c = hash2(x0, y1);
  const d = hash2(x1, y1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Tileable multi-octave FBM noise in [0..1].
 * @param {number} u Normalized [0..1]
 * @param {number} v Normalized [0..1]
 * @param {number} baseFreq
 * @param {number} octaves
 * @param {number} seed
 * @returns {number}
 */
function fbmTileable(u, v, baseFreq = 6, octaves = 4, seed = 1) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileableNoise2D(u * freq, v * freq, freq, seed + i * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Creates a 2D canvas (or a safe headless Node shim when `document` is absent).
 * @param {number} width
 * @param {number} height
 */
function createCanvas(width, height) {
  if (HAS_DOM) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return { canvas, ctx };
  }

  const buffer = new Uint8ClampedArray(width * height * 4);
  const noopGrad = { addColorStop() {} };
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    font: '12px serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalCompositeOperation: 'source-over',
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x = 0, y = 0, w = width, h = height) => ({
      width: w,
      height: h,
      data: buffer.slice(0, w * h * 4),
    }),
    putImageData: (imgData) => {
      if (imgData?.data) {
        buffer.set(imgData.data.subarray(0, buffer.length));
      }
    },
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    setLineDash() {},
    drawImage() {},
    fillText() {},
    createLinearGradient: () => noopGrad,
    createRadialGradient: () => noopGrad,
  };
  const canvas = {
    width,
    height,
    data: buffer,
    getContext: () => ctx,
  };
  return { canvas, ctx };
}

function makeTexture(
  canvas,
  { srgb = true, repeatX = 1, repeatY = 1, wrap = true, wrapS = null, wrapT = null, anisotropy = 16 } = {}
) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrapS !== null || wrapT !== null) {
    tex.wrapS = wrapS ?? THREE.ClampToEdgeWrapping;
    tex.wrapT = wrapT ?? THREE.ClampToEdgeWrapping;
    tex.repeat.set(repeatX, repeatY);
  } else if (wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Applies a C1-smooth 10% edge-feather wrap blend on an offscreen canvas so tileable
 * textures meet seamlessly across U and V borders without double-exposing features.
 * @param {HTMLImageElement|HTMLCanvasElement} source
 * @param {number} [featherRatio=0.10]
 * @param {number} [maxSize=1024]
 * @returns {HTMLCanvasElement|object}
 */
export function makeSeamlessCanvas(source, featherRatio = 0.10, maxSize = 1024) {
  const srcW = source.naturalWidth || source.width || 512;
  const srcH = source.naturalHeight || source.height || 512;
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
  const w = Math.max(16, Math.round(srcW * scale));
  const h = Math.max(16, Math.round(srcH * scale));

  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if (featherRatio <= 0 || !HAS_DOM) return canvas;

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Horizontal 10% periodic seam feathering (exact continuity at x=0 and x=w-1)
  const marginX = Math.max(2, Math.min(Math.floor(w * 0.45), Math.round(w * featherRatio)));
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const iLeft = rowOff * 4;
    const iRight = (rowOff + w - 1) * 4;
    const dR = 0.5 * (d[iRight] - d[iLeft]);
    const dG = 0.5 * (d[iRight + 1] - d[iLeft + 1]);
    const dB = 0.5 * (d[iRight + 2] - d[iLeft + 2]);

    for (let x = 0; x < marginX; x++) {
      const u = 1 - x / marginX;
      const weight = u * u * (3 - 2 * u);
      const lIdx = (rowOff + x) * 4;
      d[lIdx] = clampByte(d[lIdx] + dR * weight);
      d[lIdx + 1] = clampByte(d[lIdx + 1] + dG * weight);
      d[lIdx + 2] = clampByte(d[lIdx + 2] + dB * weight);

      const rIdx = (rowOff + (w - 1 - x)) * 4;
      d[rIdx] = clampByte(d[rIdx] - dR * weight);
      d[rIdx + 1] = clampByte(d[rIdx + 1] - dG * weight);
      d[rIdx + 2] = clampByte(d[rIdx + 2] - dB * weight);
    }
  }

  // Vertical 10% periodic seam feathering (exact continuity at y=0 and y=h-1)
  const marginY = Math.max(2, Math.min(Math.floor(h * 0.45), Math.round(h * featherRatio)));
  for (let x = 0; x < w; x++) {
    const iTop = x * 4;
    const iBot = ((h - 1) * w + x) * 4;
    const dR = 0.5 * (d[iBot] - d[iTop]);
    const dG = 0.5 * (d[iBot + 1] - d[iTop + 1]);
    const dB = 0.5 * (d[iBot + 2] - d[iTop + 2]);

    for (let y = 0; y < marginY; y++) {
      const u = 1 - y / marginY;
      const weight = u * u * (3 - 2 * u);
      const tIdx = (y * w + x) * 4;
      d[tIdx] = clampByte(d[tIdx] + dR * weight);
      d[tIdx + 1] = clampByte(d[tIdx + 1] + dG * weight);
      d[tIdx + 2] = clampByte(d[tIdx + 2] + dB * weight);

      const bIdx = ((h - 1 - y) * w + x) * 4;
      d[bIdx] = clampByte(d[bIdx] - dR * weight);
      d[bIdx + 1] = clampByte(d[bIdx + 1] - dG * weight);
      d[bIdx + 2] = clampByte(d[bIdx + 2] - dB * weight);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Computes a true tangent-space RGB Sobel Normal Map canvas (and optionally a calibrated
 * Roughness Map canvas) from an RGB or height canvas.
 * @param {HTMLCanvasElement|object} sourceCanvas
 * @param {object} [opts]
 * @returns {{ normalCanvas: any, roughnessCanvas?: any }}
 */
function deriveSobelMapsFromCanvas(
  sourceCanvas,
  {
    wrap = true,
    normalStrength = 2.0,
    computeRoughness = true,
    roughnessRange = [180, 248],
    invertHeight = false,
  } = {}
) {
  const w = sourceCanvas.width || 256;
  const h = sourceCanvas.height || 256;
  const srcCtx = sourceCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const v = (0.299 * srcData[p] + 0.587 * srcData[p + 1] + 0.114 * srcData[p + 2]) / 255;
    lum[i] = invertHeight ? 1 - v : v;
  }

  const normalObj = createCanvas(w, h);
  const nImg = normalObj.ctx.createImageData(w, h);
  const nd = nImg.data;

  const roughObj = computeRoughness ? createCanvas(w, h) : null;
  const rImg = roughObj ? roughObj.ctx.createImageData(w, h) : null;
  const rd = rImg ? rImg.data : null;

  const minR = roughnessRange[0];
  const maxR = roughnessRange[1];

  const sample = (x, y) => {
    let sx = x;
    let sy = y;
    if (wrap) {
      sx = (sx % w + w) % w;
      sy = (sy % h + h) % h;
    } else {
      sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx;
      sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
    }
    return lum[sy * w + sx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const tc = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const ml = sample(x - 1, y);
      const mc = lum[y * w + x];
      const mr = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const bc = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      // 3x3 Sobel gradients scaled for OpenGL/Three.js tangent space (+X right, +Y up in V)
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

      const nx = -gx * normalStrength;
      const ny = gy * normalStrength;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      const idx = (y * w + x) * 4;
      nd[idx] = clampByte((nx * invLen * 0.5 + 0.5) * 255);
      nd[idx + 1] = clampByte((ny * invLen * 0.5 + 0.5) * 255);
      nd[idx + 2] = clampByte((nz * invLen * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;

      if (rd) {
        const edgeMag = Math.min(1, Math.hypot(gx, gy) * 1.35);
        const t = clamp01((1.0 - mc) * 0.62 + edgeMag * 0.38);
        const rv = clampByte(lerp(minR, maxR, t));
        rd[idx] = rv;
        rd[idx + 1] = rv;
        rd[idx + 2] = rv;
        rd[idx + 3] = 255;
      }
    }
  }

  normalObj.ctx.putImageData(nImg, 0, 0);
  if (roughObj && rImg) {
    roughObj.ctx.putImageData(rImg, 0, 0);
  }
  return {
    normalCanvas: normalObj.canvas,
    roughnessCanvas: roughObj ? roughObj.canvas : undefined,
  };
}

/**
 * Safely swaps a Texture's underlying image/canvas, disposing the previous WebGL2 immutable
 * `texStorage2D` allocation first whenever dimensions change.
 */
function replaceTextureImage(tex, newImage, { colorSpace = null, anisotropy = 16, prevWidth = null, prevHeight = null } = {}) {
  if (!tex) return;
  const oldW = prevWidth ?? (tex.image?.width || 0);
  const oldH = prevHeight ?? (tex.image?.height || 0);
  const newW = newImage?.naturalWidth || newImage?.width || 0;
  const newH = newImage?.naturalHeight || newImage?.height || 0;
  if (oldW !== newW || oldH !== newH) {
    tex.dispose();
  }
  tex.image = newImage;
  if (colorSpace) tex.colorSpace = colorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
}

/**
 * Shared browser image fetch cache so duplicate material variants never fetch twice.
 * @type {Map<string, Promise<HTMLImageElement>>}
 */
const sharedImageCache = new Map();

function loadBrowserImage(url) {
  if (!HAS_BROWSER_IMAGE) {
    return Promise.reject(new Error('Image API unavailable outside browser'));
  }
  if (sharedImageCache.has(url)) {
    return sharedImageCache.get(url);
  }
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    img.src = url;
  });
  sharedImageCache.set(url, promise);
  return promise;
}

/**
 * Browser-safe async PBR texture loader with seamless 10% wrap blend, Sobel tangent-space
 * normal generation, calibrated roughness generation, and live texture/material updates.
 *
 * @param {string} url
 * @param {object} [opts]
 */
export function loadPhotorealisticPBR(url, opts = {}) {
  const {
    map = null,
    normalMap = null,
    roughnessMap = null,
    material = null,
    materials = null,
    seamless = true,
    featherRatio = 0.10,
    normalStrength = 2.0,
    roughnessRange = [180, 248],
    anisotropy = 16,
    maxSize = 1024,
    statusTracker = null,
    onLoaded = null,
    onError = null,
  } = opts;

  const markStatus = (state, extra = {}) => {
    if (!statusTracker) return;
    const prev = statusTracker.files[url];
    if (!prev) {
      statusTracker.total += 1;
      if (state === 'pending') statusTracker.pending += 1;
      else if (state === 'loaded') statusTracker.loaded += 1;
      else if (state === 'failed') statusTracker.failed += 1;
    } else if (prev.status !== state) {
      if (prev.status === 'pending') statusTracker.pending = Math.max(0, statusTracker.pending - 1);
      else if (prev.status === 'loaded') statusTracker.loaded = Math.max(0, statusTracker.loaded - 1);
      else if (prev.status === 'failed') statusTracker.failed = Math.max(0, statusTracker.failed - 1);

      if (state === 'pending') statusTracker.pending += 1;
      else if (state === 'loaded') statusTracker.loaded += 1;
      else if (state === 'failed') statusTracker.failed += 1;
    }
    statusTracker.files[url] = { url, status: state, ...extra };
  };

  if (!HAS_BROWSER_IMAGE) {
    if (statusTracker && !statusTracker.files[url]) {
      statusTracker.files[url] = { url, status: 'headless-fallback' };
    }
    return Promise.resolve({ loaded: false, headless: true, url });
  }

  markStatus('pending');

  return loadBrowserImage(url)
    .then((img) => {
      let albedoCanvas;
      if (seamless) {
        albedoCanvas = makeSeamlessCanvas(img, featherRatio, maxSize);
      } else {
        const srcW = img.naturalWidth || img.width || 512;
        const srcH = img.naturalHeight || img.height || 512;
        const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
        const w = Math.max(16, Math.round(srcW * scale));
        const h = Math.max(16, Math.round(srcH * scale));
        const created = createCanvas(w, h);
        created.ctx.drawImage(img, 0, 0, w, h);
        albedoCanvas = created.canvas;
      }

      const { normalCanvas, roughnessCanvas } = deriveSobelMapsFromCanvas(albedoCanvas, {
        wrap: seamless,
        normalStrength,
        computeRoughness: Boolean(roughnessMap),
        roughnessRange,
      });

      if (map) {
        replaceTextureImage(map, albedoCanvas, { colorSpace: THREE.SRGBColorSpace, anisotropy });
      }
      if (normalMap) {
        replaceTextureImage(normalMap, normalCanvas, { colorSpace: THREE.NoColorSpace, anisotropy });
      }
      if (roughnessMap && roughnessCanvas) {
        replaceTextureImage(roughnessMap, roughnessCanvas, { colorSpace: THREE.NoColorSpace, anisotropy });
      }

      const matList = [];
      if (material) matList.push(material);
      if (Array.isArray(materials)) matList.push(...materials);
      for (const m of matList) {
        if (!m) continue;
        if (map && m.map !== map) m.map = map;
        if (normalMap && m.normalMap !== normalMap) m.normalMap = normalMap;
        if (roughnessMap && m.roughnessMap !== roughnessMap) m.roughnessMap = roughnessMap;
        m.needsUpdate = true;
      }

      markStatus('loaded', {
        width: img.naturalWidth || albedoCanvas.width,
        height: img.naturalHeight || albedoCanvas.height,
      });

      if (typeof onLoaded === 'function') {
        onLoaded({ img, albedoCanvas, normalCanvas, roughnessCanvas });
      }
      return { loaded: true, url, width: albedoCanvas.width, height: albedoCanvas.height };
    })
    .catch((err) => {
      markStatus('failed', { error: err?.message || String(err) });
      if (typeof onError === 'function') onError(err);
      return { loaded: false, url, error: err?.message || String(err) };
    });
}

/**
 * Generates dressed Hogwarts ashlar stone wall fallback textures (diffuse, Sobel normal, roughness).
 */
function buildStoneWallTextures(trackTex, { repeatX = 2, repeatY = 2 } = {}) {
  const size = 512;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  const rows = 6;
  const rowH = size / rows;
  const cols = 4;
  const colW = size / cols;
  const seed = 1307;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(y / rowH);
    const rowY = y - row * rowH;
    const stagger = (row % 2) * (colW * 0.5);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const sx = (x + stagger) % size;
      const col = Math.floor(sx / colW);
      const colX = sx - col * colW;

      const blockHash = (((row * 73 + col * 151 + seed) * 2654435761) >>> 0) / 4294967295;
      const n1 = fbmTileable(u, v, 8, 4, seed);
      const n2 = fbmTileable(u, v, 24, 3, seed + 55);

      const mortarThickness = 4.5;
      const distEdgeX = Math.min(colX, colW - colX);
      const distEdgeY = Math.min(rowY, rowH - rowY);
      const jitter = (n2 - 0.5) * 3.0;
      const edgeDist = Math.min(distEdgeX, distEdgeY) + jitter;

      const isMortar = edgeDist < mortarThickness;
      const bevel = Math.max(0, Math.min(1, (edgeDist - mortarThickness) / 8));

      let r, g, b, heightVal, roughVal;
      if (isMortar) {
        const m = 0.8 + n2 * 0.35;
        r = 82 * m;
        g = 76 * m;
        b = 67 * m;
        heightVal = 35 + n2 * 35;
        roughVal = 246;
      } else {
        const stoneShade = 0.86 + blockHash * 0.22 + (n1 - 0.5) * 0.2 + (n2 - 0.5) * 0.14;
        const bevelShade = 0.84 + 0.16 * bevel;
        r = 152 * stoneShade * bevelShade;
        g = 144 * stoneShade * bevelShade;
        b = 128 * stoneShade * bevelShade;
        heightVal = 115 + bevel * 75 + (n1 - 0.5) * 48 + (n2 - 0.5) * 30;
        roughVal = 200 + (1 - bevel) * 34 + (n2 - 0.5) * 24;
      }

      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(r);
      dImg.data[idx + 1] = clampByte(g);
      dImg.data[idx + 2] = clampByte(b);
      dImg.data[idx + 3] = 255;

      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = clampByte(heightVal);
      hImg.data[idx + 3] = 255;

      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = clampByte(roughVal);
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.9,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX, repeatY })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX, repeatY })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX, repeatY })),
  };
}

/**
 * Generates matte carved limestone/granite fallback textures (zero brick mortar lines).
 */
function buildCarvedStoneTextures(trackTex, { repeatX = 2, repeatY = 2 } = {}) {
  const size = 256;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = fbmTileable(u, v, 5, 4, 2401);
      const grain = fbmTileable(u, v, 22, 3, 2447);
      const lichen = Math.max(0, fbmTileable(u, v, 7, 3, 2483) - 0.62) * 1.4;

      const shade = 0.72 + macro * 0.34 + (grain - 0.5) * 0.18;
      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte((112 - lichen * 22) * shade);
      dImg.data[idx + 1] = clampByte((110 + lichen * 10) * shade);
      dImg.data[idx + 2] = clampByte((102 - lichen * 28) * shade);
      dImg.data[idx + 3] = 255;

      const hv = clampByte(115 + (macro - 0.5) * 65 + (grain - 0.5) * 52);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = hv;
      hImg.data[idx + 3] = 255;

      const rv = clampByte(208 + (1 - macro) * 28 + (grain - 0.5) * 20);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.8,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX, repeatY })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX, repeatY })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX, repeatY })),
  };
}

/**
 * Generates worn Hogwarts flagstone floor fallback textures.
 */
function buildFlagstoneTextures(trackTex) {
  const size = 512;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  const rows = 4;
  const rowH = size / rows;
  const seed = 7719;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(y / rowH);
    const rowY = y - row * rowH;
    const cols = row % 2 === 0 ? 3 : 4;
    const colW = size / cols;
    const offset = row * 79;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const sx = (x + offset) % size;
      const col = Math.floor(sx / colW);
      const colX = sx - col * colW;

      const tileHash = (((row * 101 + col * 37 + seed) * 2654435761) >>> 0) / 4294967295;
      const n1 = fbmTileable(u, v, 6, 4, seed);
      const n2 = fbmTileable(u, v, 20, 3, seed + 13);

      const edgeDist = Math.min(colX, colW - colX, rowY, rowH - rowY) + (n2 - 0.5) * 3.5;
      const isJoint = edgeDist < 4.5;
      const bevel = Math.max(0, Math.min(1, (edgeDist - 4.5) / 7));

      let r, g, b, bv, rv;
      if (isJoint) {
        r = 38 + n2 * 16;
        g = 35 + n2 * 14;
        b = 32 + n2 * 12;
        bv = 30 + n2 * 30;
        rv = 242;
      } else {
        const shade = 0.84 + tileHash * 0.22 + (n1 - 0.5) * 0.2;
        const wear = 0.88 + 0.12 * bevel;
        r = 88 * shade * wear;
        g = 85 * shade * wear;
        b = 84 * shade * wear;
        bv = 135 + bevel * 65 + (n1 - 0.5) * 36;
        rv = 152 + (1 - bevel) * 48 + (n2 - 0.5) * 26;
      }

      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(r);
      dImg.data[idx + 1] = clampByte(g);
      dImg.data[idx + 2] = clampByte(b);
      dImg.data[idx + 3] = 255;

      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = clampByte(bv);
      hImg.data[idx + 3] = 255;

      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = clampByte(rv);
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.85,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 4, repeatY: 4 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 4, repeatY: 4 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 4, repeatY: 4 })),
  };
}

/**
 * Generates Hogwarts woven wool rug fallback textures.
 */
function buildWovenCarpetTextures(trackTex) {
  const size = 512;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dctx = diff.ctx;
  const hctx = height.ctx;

  dctx.fillStyle = '#471a20';
  dctx.fillRect(0, 0, size, size);

  dctx.strokeStyle = '#9a7a3f';
  dctx.lineWidth = 10;
  dctx.strokeRect(20, 20, size - 40, size - 40);

  dctx.strokeStyle = '#252c3f';
  dctx.lineWidth = 22;
  dctx.strokeRect(44, 44, size - 88, size - 88);

  dctx.strokeStyle = '#b48f48';
  dctx.lineWidth = 3;
  dctx.strokeRect(62, 62, size - 124, size - 124);

  const rng = mulberry32(9912);
  dctx.save();
  dctx.translate(size / 2, size / 2);
  for (let ring = 0; ring < 3; ring++) {
    const rad = 138 - ring * 42;
    dctx.strokeStyle = ring % 2 === 0 ? 'rgba(180, 143, 72, 0.55)' : 'rgba(42, 54, 78, 0.72)';
    dctx.lineWidth = ring === 0 ? 5 : 3;
    dctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = rad + (i % 2 === 0 ? 12 : -10);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) dctx.moveTo(px, py);
      else dctx.lineTo(px, py);
    }
    dctx.closePath();
    dctx.stroke();
  }
  dctx.fillStyle = 'rgba(164, 128, 58, 0.35)';
  dctx.beginPath();
  dctx.arc(0, 0, 26, 0, Math.PI * 2);
  dctx.fill();
  dctx.restore();

  const dImg = dctx.getImageData(0, 0, size, size);
  const hImg = hctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const warp = Math.sin(x * 1.55) * 0.5 + 0.5;
      const weft = Math.sin(y * 1.55) * 0.5 + 0.5;
      const weave = (x + y) % 4 < 2 ? warp : weft;
      const aging = 0.86 + rng() * 0.1 + fbmTileable(x / size, y / size, 6, 3, 211) * 0.14;

      const factor = (0.85 + weave * 0.24) * aging;
      dImg.data[idx] = clampByte(dImg.data[idx] * factor);
      dImg.data[idx + 1] = clampByte(dImg.data[idx + 1] * factor);
      dImg.data[idx + 2] = clampByte(dImg.data[idx + 2] * factor);

      const bv = clampByte(95 + weave * 125);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;

      const rv = clampByte(218 + (1 - weave) * 32);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  dctx.putImageData(dImg, 0, 0);
  hctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: false,
    normalStrength: 1.55,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, wrap: false })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, wrap: false })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, wrap: false })),
  };
}

/**
 * Generates dark carved oak or gleaming polished oak woodgrain fallback textures.
 */
function buildOakWoodTextures(trackTex, { gleaming = false } = {}) {
  const size = 512;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  const seed = gleaming ? 3301 : 5509;
  const baseRgb = gleaming ? [138, 86, 40] : [68, 44, 27];
  const darkRgb = gleaming ? [88, 52, 22] : [36, 22, 13];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbmTileable(u, v, 4, 3, seed) * 2.2;
      const fine = fbmTileable(u * 4, v * 0.5, 8, 2, seed + 17);
      const ringCoord = (gleaming ? v : u) * 11 + warp + Math.sin((gleaming ? u : v) * Math.PI * 2) * 0.55;
      const ring = Math.pow(0.5 + 0.5 * Math.sin(ringCoord * Math.PI * 2), 1.6);
      const pore = Math.pow(tileableNoise2D(u * 64, v * 12, 64, seed + 88), 3);

      const t = ring * 0.72 + fine * 0.28;
      const r = lerp(darkRgb[0], baseRgb[0], t) - pore * 14;
      const g = lerp(darkRgb[1], baseRgb[1], t) - pore * 10;
      const b = lerp(darkRgb[2], baseRgb[2], t) - pore * 6;

      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(r);
      dImg.data[idx + 1] = clampByte(g);
      dImg.data[idx + 2] = clampByte(b);
      dImg.data[idx + 3] = 255;

      const bv = clampByte(130 + ring * 65 - pore * 85);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;

      const rv = gleaming
        ? clampByte(150 + (1 - ring) * 45 + pore * 42)
        : clampByte(178 + (1 - ring) * 42 + pore * 38);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.65,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 1, repeatY: 1 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 1, repeatY: 1 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 1, repeatY: 1 })),
  };
}

/**
 * Generates brushed / patinated metallic micro-normal and roughness maps.
 */
function buildMetalTextures(trackTex, { baseColor, patinaColor, seed = 881, brushStrength = 0.35 }) {
  const size = 256;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  const cBase = new THREE.Color(baseColor);
  const cPatina = new THREE.Color(patinaColor);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const brush = tileableNoise2D(u * 4, v * 96, 96, seed);
      const fine = tileableNoise2D(u * 16, v * 128, 128, seed + 19);
      const blotch = fbmTileable(u, v, 6, 4, seed + 31);
      const mix = blotch * 0.55 + brush * brushStrength * 0.45;

      const r = lerp(cBase.r, cPatina.r, mix * 0.42) * 255;
      const g = lerp(cBase.g, cPatina.g, mix * 0.42) * 255;
      const b = lerp(cBase.b, cPatina.b, mix * 0.42) * 255;

      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(r);
      dImg.data[idx + 1] = clampByte(g);
      dImg.data[idx + 2] = clampByte(b);
      dImg.data[idx + 3] = 255;

      const bv = clampByte(115 + brush * 70 + fine * 35 + (blotch - 0.5) * 30);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;

      const rv = clampByte(178 + mix * 68);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.25,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 2, repeatY: 2 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 2, repeatY: 2 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 2, repeatY: 2 })),
  };
}

/**
 * Generates layered crimson & gold phoenix plumage textures.
 */
function buildFeatherTextures(trackTex, { goldVariant = false } = {}) {
  const size = 256;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dctx = diff.ctx;
  const hctx = height.ctx;
  const rctx = rough.ctx;

  dctx.fillStyle = goldVariant ? '#c9881d' : '#6f110d';
  dctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#404040';
  hctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, size, size);

  const rng = mulberry32(goldVariant ? 9044 : 4409);

  for (let row = 0; row < 8; row++) {
    const fy = row * 34;
    const cols = 6;
    const offset = (row % 2) * (size / (cols * 2));
    for (let col = -1; col <= cols; col++) {
      const fx = col * (size / cols) + offset;
      const w = 22 + rng() * 6;
      const h = 44 + rng() * 8;

      const grad = dctx.createLinearGradient(fx, fy, fx, fy + h);
      if (goldVariant) {
        grad.addColorStop(0, '#a86714');
        grad.addColorStop(0.55, '#e8b339');
        grad.addColorStop(1, '#ffe48a');
      } else {
        grad.addColorStop(0, '#78120c');
        grad.addColorStop(0.65, '#ba291b');
        grad.addColorStop(0.92, '#e27d29');
        grad.addColorStop(1, '#f3be57');
      }

      dctx.save();
      dctx.translate(fx, fy);
      dctx.beginPath();
      dctx.moveTo(0, 0);
      dctx.quadraticCurveTo(w, h * 0.45, 0, h);
      dctx.quadraticCurveTo(-w, h * 0.45, 0, 0);
      dctx.fillStyle = grad;
      dctx.fill();

      dctx.strokeStyle = goldVariant ? 'rgba(255, 240, 175, 0.5)' : 'rgba(240, 178, 86, 0.42)';
      dctx.lineWidth = 1.2;
      dctx.beginPath();
      dctx.moveTo(0, 4);
      dctx.lineTo(0, h - 3);
      dctx.stroke();

      for (let b = 6; b < h - 4; b += 4) {
        const bw = w * 0.72 * Math.sin((b / h) * Math.PI);
        dctx.beginPath();
        dctx.moveTo(0, b);
        dctx.lineTo(-bw, b + 3);
        dctx.moveTo(0, b);
        dctx.lineTo(bw, b + 3);
        dctx.stroke();
      }
      dctx.restore();

      hctx.save();
      hctx.translate(fx, fy);
      const bGrad = hctx.createLinearGradient(0, 0, 0, h);
      bGrad.addColorStop(0, '#555555');
      bGrad.addColorStop(0.5, '#c8c8c8');
      bGrad.addColorStop(1, '#ececec');
      hctx.fillStyle = bGrad;
      hctx.beginPath();
      hctx.moveTo(0, 0);
      hctx.quadraticCurveTo(w, h * 0.45, 0, h);
      hctx.quadraticCurveTo(-w, h * 0.45, 0, 0);
      hctx.fill();
      hctx.restore();
    }
  }

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.5,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 1, repeatY: 1 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 1, repeatY: 1 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 1, repeatY: 1 })),
  };
}

/**
 * Generates aged vellum parchment textures.
 */
function buildParchmentTextures(trackTex) {
  const size = 512;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = fbmTileable(u, v, 5, 4, 303);
      const fiber = tileableNoise2D(u * 48, v * 48, 48, 309);
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const edgeDark = 0.82 + 0.18 * Math.min(1, edge * 8);

      const shade = (0.86 + (n1 - 0.5) * 0.16 + (fiber - 0.5) * 0.06) * edgeDark;
      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(234 * shade);
      dImg.data[idx + 1] = clampByte(214 * shade);
      dImg.data[idx + 2] = clampByte(168 * shade);
      dImg.data[idx + 3] = 255;

      const bv = clampByte(120 + (fiber - 0.5) * 70 + (n1 - 0.5) * 45);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);

  const ctx = diff.ctx;
  ctx.strokeStyle = 'rgba(78, 52, 28, 0.42)';
  ctx.lineWidth = 1.6;
  const rng = mulberry32(1993);
  for (let line = 0; line < 14; line++) {
    const y = 64 + line * 28;
    const endX = 180 + rng() * 260;
    ctx.beginPath();
    ctx.moveTo(56, y);
    for (let x = 60; x < endX; x += 8) {
      ctx.lineTo(x, y + (rng() - 0.5) * 4.5);
    }
    ctx.stroke();
  }

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: false,
    normalStrength: 1.15,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, wrap: false })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, wrap: false })),
  };
}

/**
 * Generates plush velvet fabric textures with physical cloth normal map.
 */
function buildVelvetTextures(trackTex) {
  const size = 256;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);

  const dctx = diff.ctx;
  const hctx = height.ctx;

  dctx.fillStyle = '#4a1724';
  dctx.fillRect(0, 0, size, size);

  const dImg = dctx.getImageData(0, 0, size, size);
  const hImg = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const weave = ((x % 3 === 0 ? 1 : 0) + (y % 3 === 0 ? 1 : 0)) * 0.5;
      const nap = fbmTileable(x / size, y / size, 12, 3, 602);
      const factor = 0.86 + weave * 0.14 + (nap - 0.5) * 0.14;

      dImg.data[idx] = clampByte(dImg.data[idx] * factor);
      dImg.data[idx + 1] = clampByte(dImg.data[idx + 1] * factor);
      dImg.data[idx + 2] = clampByte(dImg.data[idx + 2] * factor);

      const bv = clampByte(110 + weave * 85 + (nap - 0.5) * 40);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;
    }
  }
  dctx.putImageData(dImg, 0, 0);
  hctx.putImageData(hImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.4,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 2, repeatY: 2 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 2, repeatY: 2 })),
  };
}

/**
 * Generates weathered, stitched, frayed felt/leather fallback textures for the Sorting Hat.
 */
function buildSortingHatTextures(trackTex) {
  const size = 512;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);

  const dImg = diff.ctx.createImageData(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const rImg = rough.ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const crease = Math.abs(fbmTileable(u, v, 5, 4, 811) - 0.5) * 2;
      const grime = fbmTileable(u, v, 14, 3, 819);
      const felt = tileableNoise2D(u * 48, v * 48, 48, 823);

      const wear = 0.72 + crease * 0.36 + (felt - 0.5) * 0.12;
      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(70 * wear - grime * 16);
      dImg.data[idx + 1] = clampByte(55 * wear - grime * 14);
      dImg.data[idx + 2] = clampByte(42 * wear - grime * 10);
      dImg.data[idx + 3] = 255;

      const bv = clampByte(100 + crease * 90 + (felt - 0.5) * 45);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;

      const rv = clampByte(205 + grime * 35);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const dctx = diff.ctx;
  const hctx = height.ctx;
  const patches = [
    [130, 170, 86, 62, 0.2],
    [340, 290, 94, 70, -0.18],
  ];
  for (const [px, py, pw, ph, rot] of patches) {
    dctx.save();
    hctx.save();
    dctx.translate(px, py);
    hctx.translate(px, py);
    dctx.rotate(rot);
    hctx.rotate(rot);

    dctx.fillStyle = 'rgba(48, 37, 29, 0.75)';
    dctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    dctx.strokeStyle = 'rgba(130, 108, 76, 0.65)';
    dctx.lineWidth = 2;
    dctx.setLineDash([5, 5]);
    dctx.strokeRect(-pw / 2 + 3, -ph / 2 + 3, pw - 6, ph - 6);

    hctx.strokeStyle = '#ffffff';
    hctx.lineWidth = 3;
    hctx.setLineDash([5, 5]);
    hctx.strokeRect(-pw / 2 + 3, -ph / 2 + 3, pw - 6, ph - 6);

    dctx.restore();
    hctx.restore();
  }

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.9,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 1, repeatY: 1 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 1, repeatY: 1 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 1, repeatY: 1 })),
  };
}

/**
 * Generates carved ancient rune stone fallback textures for the Pensieve basin & rim.
 */
function buildRuneStoneTextures(trackTex) {
  const w = 512;
  const h = 256;
  const diff = createCanvas(w, h);
  const height = createCanvas(w, h);
  const rough = createCanvas(w, h);

  const dImg = diff.ctx.createImageData(w, h);
  const hImg = height.ctx.createImageData(w, h);
  const rImg = rough.ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const stone = fbmTileable(u, v, 8, 4, 1515);
      const grain = tileableNoise2D(u * 32, v * 16, 32, 1521);
      const shade = 0.8 + stone * 0.25 + (grain - 0.5) * 0.12;

      const idx = (y * w + x) * 4;
      dImg.data[idx] = clampByte(72 * shade);
      dImg.data[idx + 1] = clampByte(76 * shade);
      dImg.data[idx + 2] = clampByte(82 * shade);
      dImg.data[idx + 3] = 255;

      const bv = clampByte(150 + (stone - 0.5) * 40);
      hImg.data[idx] = hImg.data[idx + 1] = hImg.data[idx + 2] = bv;
      hImg.data[idx + 3] = 255;

      const rv = clampByte(165 + (1 - stone) * 45);
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  diff.ctx.putImageData(dImg, 0, 0);
  height.ctx.putImageData(hImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  const dctx = diff.ctx;
  const hctx = height.ctx;
  const rctx = rough.ctx;

  const carveStroke = (fn, width = 3) => {
    dctx.strokeStyle = '#1f242b';
    dctx.lineWidth = width + 1;
    dctx.beginPath();
    fn(dctx);
    dctx.stroke();

    dctx.strokeStyle = 'rgba(182, 206, 232, 0.35)';
    dctx.lineWidth = 1.2;
    dctx.beginPath();
    fn(dctx);
    dctx.stroke();

    hctx.strokeStyle = '#141414';
    hctx.lineWidth = width + 2;
    hctx.beginPath();
    fn(hctx);
    hctx.stroke();

    rctx.strokeStyle = '#e0e0e0';
    rctx.lineWidth = width + 2;
    rctx.beginPath();
    fn(rctx);
    rctx.stroke();
  };

  carveStroke((c) => {
    c.moveTo(0, 44);
    c.lineTo(w, 44);
    c.moveTo(0, h - 44);
    c.lineTo(w, h - 44);
  }, 3);

  const runeCount = 12;
  const step = w / runeCount;
  for (let i = 0; i < runeCount; i++) {
    const cx = i * step + step * 0.5;
    const cy = h * 0.5;
    const variant = i % 6;
    carveStroke((c) => {
      c.moveTo(cx, cy - 36);
      c.lineTo(cx, cy + 36);
      if (variant === 0) {
        c.moveTo(cx, cy - 30);
        c.lineTo(cx + 15, cy - 12);
        c.lineTo(cx, cy + 4);
      } else if (variant === 1) {
        c.moveTo(cx - 14, cy - 18);
        c.lineTo(cx + 14, cy + 14);
        c.moveTo(cx + 14, cy - 18);
        c.lineTo(cx - 14, cy + 14);
      } else if (variant === 2) {
        c.moveTo(cx - 12, cy - 28);
        c.lineTo(cx, cy - 8);
        c.lineTo(cx + 12, cy - 28);
        c.moveTo(cx - 10, cy + 16);
        c.lineTo(cx + 10, cy + 16);
      } else if (variant === 3) {
        c.moveTo(cx, cy - 32);
        c.lineTo(cx + 14, cy - 18);
        c.lineTo(cx, cy);
        c.lineTo(cx + 14, cy + 18);
        c.lineTo(cx, cy + 32);
      } else if (variant === 4) {
        c.moveTo(cx - 12, cy);
        c.lineTo(cx, cy - 22);
        c.lineTo(cx + 12, cy);
        c.lineTo(cx, cy + 22);
        c.closePath();
      } else {
        c.moveTo(cx - 13, cy - 22);
        c.lineTo(cx + 13, cy - 22);
        c.moveTo(cx - 13, cy + 22);
        c.lineTo(cx + 13, cy + 22);
      }
    }, 3.2);
  }

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 2.35,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 2, repeatY: 1 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 2, repeatY: 1 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 2, repeatY: 1 })),
  };
}

/**
 * Generates diamond-leaded Hogwarts window glass textures with opaque lead cames via transmissionMap.
 */
function buildLeadedGlassTextures(trackTex) {
  const size = 256;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);
  const rough = createCanvas(size, size);
  const trans = createCanvas(size, size);

  const dctx = diff.ctx;
  const hctx = height.ctx;
  const rctx = rough.ctx;
  const tctx = trans.ctx;

  // Clear hand-blown glass diamonds
  dctx.fillStyle = '#eef6ff';
  dctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#181818';
  rctx.fillRect(0, 0, size, size);
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, size, size);

  // Subtle hand-blown antique glass ripples
  const rng = mulberry32(4141);
  for (let i = 0; i < 64; i++) {
    const rx = rng() * size;
    const ry = rng() * size;
    const rad = 18 + rng() * 32;
    const grad = hctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
    grad.addColorStop(0, 'rgba(195,195,195,0.22)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    hctx.fillStyle = grad;
    hctx.beginPath();
    hctx.arc(rx, ry, rad, 0, Math.PI * 2);
    hctx.fill();
  }

  const drawCames = (ctx, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    const step = 64;
    for (let offset = -size; offset <= size * 2; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + size, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset - size, size);
      ctx.stroke();
    }
  };

  drawCames(dctx, '#1b1d20', 4.5);
  drawCames(hctx, '#f0f0f0', 5);
  drawCames(rctx, '#d6d6d6', 5);
  drawCames(tctx, '#000000', 4.5);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.5,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, repeatX: 2, repeatY: 4 })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, repeatX: 2, repeatY: 4 })),
    roughnessMap: trackTex(makeTexture(rough.canvas, { srgb: false, repeatX: 2, repeatY: 4 })),
    transmissionMap: trackTex(makeTexture(trans.canvas, { srgb: false, repeatX: 2, repeatY: 4 })),
  };
}

/**
 * Generates gilded leather book-spine textures for shelves and desk stacks.
 */
function buildBookLeatherTextures(trackTex, baseHex, seed) {
  const size = 256;
  const diff = createCanvas(size, size);
  const height = createCanvas(size, size);

  const dctx = diff.ctx;
  const hctx = height.ctx;

  dctx.fillStyle = baseHex;
  dctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);

  const dImg = dctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbmTileable(x / size, y / size, 10, 3, seed);
      const factor = 0.8 + n * 0.34;
      const idx = (y * size + x) * 4;
      dImg.data[idx] = clampByte(dImg.data[idx] * factor);
      dImg.data[idx + 1] = clampByte(dImg.data[idx + 1] * factor);
      dImg.data[idx + 2] = clampByte(dImg.data[idx + 2] * factor);
    }
  }
  dctx.putImageData(dImg, 0, 0);

  for (const ry of [36, 72, 184, 220]) {
    dctx.fillStyle = '#c59c43';
    dctx.fillRect(0, ry - 3, size, 6);
    hctx.fillStyle = '#e5e5e5';
    hctx.fillRect(0, ry - 4, size, 8);
  }

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: false,
    normalStrength: 1.45,
    computeRoughness: false,
  });

  return {
    map: trackTex(makeTexture(diff.canvas, { srgb: true, wrap: false })),
    normalMap: trackTex(makeTexture(normalCanvas, { srgb: false, wrap: false })),
  };
}

/**
 * Generates a linen-canvas weave + oil brushstroke Sobel normal map for oil portraits.
 */
function buildPortraitNormalCanvas() {
  const size = 256;
  const height = createCanvas(size, size);
  const hImg = height.ctx.createImageData(size, size);
  const d = hImg.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = Math.sin(x * (Math.PI * 0.5)) * 0.5 + 0.5;
      const weft = Math.sin(y * (Math.PI * 0.5)) * 0.5 + 0.5;
      const linen = (x + y) % 4 < 2 ? warp * 0.68 + weft * 0.32 : weft * 0.68 + warp * 0.32;
      const stroke = fbmTileable(u * 1.5 + v * 0.35, v * 0.65, 8, 3, 913);
      const val = clampByte(96 + linen * 76 + (stroke - 0.5) * 68);
      const idx = (y * size + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = val;
      d[idx + 3] = 255;
    }
  }
  height.ctx.putImageData(hImg, 0, 0);

  const { normalCanvas } = deriveSobelMapsFromCanvas(height.canvas, {
    wrap: true,
    normalStrength: 1.35,
    computeRoughness: false,
  });
  return normalCanvas;
}

/**
 * Generates a procedural Scottish Highlands dusk horizon fallback canvas.
 */
function buildHighlandsFallbackCanvas() {
  const w = 512;
  const h = 256;
  const { canvas, ctx } = createCanvas(w, h);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  skyGrad.addColorStop(0, '#10192c');
  skyGrad.addColorStop(0.55, '#2b3a54');
  skyGrad.addColorStop(1, '#6f7992');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h * 0.62);

  // Highland peaks silhouette
  ctx.fillStyle = '#1b2430';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let x = 0; x <= w; x += 8) {
    const t = (x / w) * Math.PI * 2;
    const ridge = Math.sin(t * 2) * 18 + Math.cos(t * 5) * 10 + Math.sin(t * 9) * 5;
    ctx.lineTo(x, h * 0.48 - ridge);
  }
  ctx.lineTo(w, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // Loch reflection
  const lochGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
  lochGrad.addColorStop(0, '#14202d');
  lochGrad.addColorStop(0.5, '#25364a');
  lochGrad.addColorStop(1, '#101824');
  ctx.fillStyle = lochGrad;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);

  return canvas;
}

/**
 * Canonical portraitId -> CC0 Old Master oil portrait file mapping under `./textures/portraits/`.
 */
const PORTRAIT_FILE_MAP = {
  'portrait-albus-dumbledore': {
    awake: './textures/portraits/dumbledore_awake.jpg',
    snoozing: './textures/portraits/dumbledore_sleeping.jpg',
  },
  'portrait-phineas-nigellus-black': './textures/portraits/phineas_black.jpg',
  'portrait-armando-dippet': './textures/portraits/armando_dippet.jpg',
  'portrait-dilys-derwent': './textures/portraits/dilys_derwent.jpg',
  'portrait-everard': './textures/portraits/everard.jpg',
  'portrait-dexter-fortescue': './textures/portraits/dexter_fortescue.jpg',
  'portrait-unnamed-headmistress-1': './textures/portraits/unnamed_headmistress_1.jpg',
  'portrait-unnamed-headmaster-2': './textures/portraits/unnamed_headmaster_2.jpg',
  'portrait-unnamed-headmistress-3': './textures/portraits/unnamed_headmistress_3.jpg',
  'portrait-unnamed-headmaster-4': './textures/portraits/unnamed_headmaster_4.jpg',
};

const PORTRAIT_NAME_FALLBACK_MAP = {
  'albus dumbledore': 'portrait-albus-dumbledore',
  'phineas nigellus black': 'portrait-phineas-nigellus-black',
  'armando dippet': 'portrait-armando-dippet',
  'dilys derwent': 'portrait-dilys-derwent',
  everard: 'portrait-everard',
  'dexter fortescue': 'portrait-dexter-fortescue',
};

/**
 * Paints a procedural oil portrait fallback canvas (used on frame 1 or in headless Node).
 */
function paintOilPortraitCanvas({
  name,
  palette,
  beard,
  hat,
  glasses,
  gender,
  eyesOpen,
}) {
  const w = 384;
  const h = 512;
  const { canvas, ctx } = createCanvas(w, h);
  const seed = hashString(name || 'Headmaster');
  const rng = mulberry32(seed);

  const defaultPalettes = [
    { bg: '#211815', robe: '#4a1b24', trim: '#c79b44', skin: '#e1b996', hair: '#d8d4ca', eye: '#5d84a6' },
    { bg: '#161d24', robe: '#1d3247', trim: '#b89448', skin: '#d8ae8d', hair: '#4a372a', eye: '#4f6d52' },
    { bg: '#1f1c16', robe: '#2e3c2b', trim: '#cfa753', skin: '#e4c2a2', hair: '#8d877f', eye: '#557396' },
    { bg: '#23161e', robe: '#3d2240', trim: '#caa455', skin: '#d6aa86', hair: '#2a2422', eye: '#6d5742' },
  ];
  const fallbackPal = defaultPalettes[seed % defaultPalettes.length];
  const pal = { ...fallbackPal, ...(palette || {}) };

  const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.36, 20, w * 0.5, h * 0.45, h * 0.72);
  bgGrad.addColorStop(0, pal.bgAccent || '#46382b');
  bgGrad.addColorStop(0.55, pal.bg);
  bgGrad.addColorStop(1, '#0d0b0a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 140; i++) {
    const bx = rng() * w;
    const by = rng() * h;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate((rng() - 0.5) * 0.8);
    ctx.fillStyle = rng() > 0.5 ? 'rgba(235, 205, 155, 0.035)' : 'rgba(10, 8, 7, 0.08)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 + rng() * 28, 5 + rng() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const cx = w * 0.5;
  const headY = eyesOpen ? h * 0.36 : h * 0.385;
  const isFemale = gender === 'female';

  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  if (isFemale) {
    ctx.ellipse(cx, headY + 24, 72, 92, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(cx, headY + 8, 62, 70, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  const robeGrad = ctx.createLinearGradient(cx, h * 0.54, cx, h);
  robeGrad.addColorStop(0, pal.robe);
  robeGrad.addColorStop(1, '#120d0c');
  ctx.fillStyle = robeGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 146, h);
  ctx.quadraticCurveTo(cx - 135, h * 0.59, cx - 54, h * 0.54);
  ctx.lineTo(cx + 54, h * 0.54);
  ctx.quadraticCurveTo(cx + 135, h * 0.59, cx + 146, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(cx - 46, h * 0.55);
  ctx.lineTo(cx, h * 0.77);
  ctx.lineTo(cx + 46, h * 0.55);
  ctx.stroke();

  ctx.fillStyle = '#ddd3be';
  ctx.beginPath();
  ctx.moveTo(cx - 42, h * 0.54);
  ctx.quadraticCurveTo(cx, h * 0.63, cx + 42, h * 0.54);
  ctx.lineTo(cx + 26, h * 0.51);
  ctx.lineTo(cx - 26, h * 0.51);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.skin;
  ctx.fillRect(cx - 22, headY + 34, 44, 52);
  ctx.fillStyle = 'rgba(40, 18, 12, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, headY + 46, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  const faceW = isFemale ? 48 : 52;
  const faceH = isFemale ? 64 : 67;
  const skinGrad = ctx.createRadialGradient(cx - 10, headY - 12, 8, cx, headY + 8, faceH + 14);
  skinGrad.addColorStop(0, pal.skin);
  skinGrad.addColorStop(0.75, pal.skin);
  skinGrad.addColorStop(1, '#9d7154');

  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.moveTo(cx - faceW, headY - 10);
  ctx.quadraticCurveTo(cx - faceW, headY - faceH, cx, headY - faceH);
  ctx.quadraticCurveTo(cx + faceW, headY - faceH, cx + faceW, headY - 10);
  ctx.quadraticCurveTo(cx + faceW * 0.9, headY + faceH * 0.85, cx, headY + faceH);
  ctx.quadraticCurveTo(cx - faceW * 0.9, headY + faceH * 0.85, cx - faceW, headY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(165, 84, 68, 0.16)';
  ctx.beginPath();
  ctx.ellipse(cx - 24, headY + 12, 13, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 24, headY + 12, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(54, 30, 22, 0.19)';
  ctx.beginPath();
  ctx.ellipse(cx - 21, headY - 4, 15, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 21, headY - 4, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 232, 210, 0.36)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 1, headY - 8);
  ctx.lineTo(cx, headY + 18);
  ctx.stroke();

  ctx.fillStyle = 'rgba(92, 54, 38, 0.34)';
  ctx.beginPath();
  ctx.ellipse(cx, headY + 21, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#6c3830';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  if (eyesOpen) {
    ctx.moveTo(cx - 14, headY + 36);
    ctx.quadraticCurveTo(cx, headY + 41, cx + 14, headY + 36);
  } else {
    ctx.moveTo(cx - 12, headY + 37);
    ctx.quadraticCurveTo(cx, headY + 38, cx + 12, headY + 37);
  }
  ctx.stroke();

  const eyeY = headY - 4;
  const eyeOffset = 20;
  for (const dir of [-1, 1]) {
    const ex = cx + dir * eyeOffset;
    if (eyesOpen) {
      ctx.fillStyle = '#ede6d8';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 10, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.eye || '#4e6f8c';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 4.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#151210';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 1.6, eyeY - 1.5, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2a1a14';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 10.5, 6.4, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(135, 92, 68, 0.35)';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 10.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2e1d16';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ex - 10, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + 5.5, ex + 10, eyeY);
      ctx.stroke();
    }

    ctx.strokeStyle = pal.hair;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    const browLift = eyesOpen ? -11 : -9;
    ctx.moveTo(ex - 11, eyeY + browLift + 2);
    ctx.quadraticCurveTo(ex, eyeY + browLift - 2, ex + 11, eyeY + browLift + 2);
    ctx.stroke();
  }

  if (beard) {
    const beardLen = beard === 'short' || beard === 'trimmed' ? 68 : beard === 'pointed' ? 115 : 145;
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(cx - 42, headY + 20);
    ctx.quadraticCurveTo(cx - 46, headY + 34 + beardLen * 0.65, cx, headY + 36 + beardLen);
    ctx.quadraticCurveTo(cx + 46, headY + 34 + beardLen * 0.65, cx + 42, headY + 20);
    ctx.quadraticCurveTo(cx, headY + 38, cx - 42, headY + 20);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 250, 240, 0.22)';
    ctx.lineWidth = 1.6;
    for (let s = -28; s <= 28; s += 7) {
      ctx.beginPath();
      ctx.moveTo(cx + s, headY + 28);
      ctx.quadraticCurveTo(cx + s * 0.7, headY + 28 + beardLen * 0.5, cx + s * 0.25, headY + 26 + beardLen);
      ctx.stroke();
    }

    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.ellipse(cx - 14, headY + 31, 18, 6.5, -0.18, 0, Math.PI * 2);
    ctx.ellipse(cx + 14, headY + 31, 18, 6.5, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.ellipse(cx - 46, headY - 8, 12, 28, 0.1, 0, Math.PI * 2);
  ctx.ellipse(cx + 46, headY - 8, 12, 28, -0.1, 0, Math.PI * 2);
  ctx.fill();
  if (!hat) {
    ctx.beginPath();
    ctx.ellipse(cx, headY - 54, 48, 22, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  if (glasses) {
    const isHalfMoon = glasses === 'half-moon';
    ctx.strokeStyle = '#d7b255';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 9, eyeY + (isHalfMoon ? 1 : 0));
    ctx.lineTo(cx + 9, eyeY + (isHalfMoon ? 1 : 0));
    ctx.stroke();

    for (const dir of [-1, 1]) {
      const ex = cx + dir * eyeOffset;
      ctx.beginPath();
      if (isHalfMoon) {
        ctx.arc(ex, eyeY + 1, 11.5, 0, Math.PI, false);
        ctx.closePath();
      } else {
        ctx.arc(ex, eyeY, 12, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(215, 236, 255, 0.12)';
      ctx.fill();
      ctx.stroke();
    }
  }

  if (hat) {
    ctx.fillStyle = pal.hatColor || pal.robe;
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2.5;
    const hatY = headY - 46;

    if (hat === 'cap' || hat === 'bonnet') {
      ctx.beginPath();
      ctx.ellipse(cx, hatY, 56, 26, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, hatY + 4, 88, 18, -0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 48, hatY);
      ctx.quadraticCurveTo(cx - 12, hatY - 82, cx + 22, hatY - 122);
      ctx.quadraticCurveTo(cx + 32, hatY - 58, cx + 48, hatY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.trim;
      ctx.fillRect(cx - 46, hatY - 8, 92, 7);
    }
  }

  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.25, w * 0.5, h * 0.5, h * 0.65);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(12, 8, 6, 0.52)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  if (name) {
    ctx.fillStyle = 'rgba(34, 24, 14, 0.82)';
    ctx.fillRect(w * 0.16, h - 34, w * 0.68, 22);
    ctx.strokeStyle = 'rgba(202, 162, 82, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.16, h - 34, w * 0.68, 22);

    ctx.fillStyle = '#ebd087';
    ctx.font = '600 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 28), cx, h - 23);
  }

  return canvas;
}

/**
 * Creates the custom GLSL ShaderMaterial for the swirling silvery Pensieve substance
 * ("bright, whitish-silver substance, neither liquid nor gas, swirling ceaselessly").
 */
export function createPensieveLiquidMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
      uColorDeep: { value: new THREE.Color('#6682a4') },
      uColorMid: { value: new THREE.Color('#c7e0fb') },
      uColorBright: { value: new THREE.Color('#f7fbff') },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vRipple;

      void main() {
        vUv = uv;
        vec3 pos = position;
        vec2 centered = uv * 2.0 - 1.0;
        float dist = length(centered);
        float angle = atan(centered.y, centered.x);
        float ripple = sin(dist * 10.0 - uTime * 1.4 + angle * 2.0) * 0.008 * (1.0 - smoothstep(0.65, 1.0, dist));
        pos.z += ripple;
        vRipple = ripple;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColorDeep;
      uniform vec3 uColorMid;
      uniform vec3 uColorBright;

      varying vec2 vUv;
      varying float vRipple;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        float theta = atan(p.y, p.x);
        float swirl = theta + (1.4 - r) * 2.6 - uTime * 0.42;
        vec2 swirlUv = vec2(cos(swirl), sin(swirl)) * r * 2.6;

        float q1 = fbm(swirlUv + vec2(uTime * 0.14, -uTime * 0.11));
        float q2 = fbm(swirlUv * 1.45 + vec2(q1 * 1.8 - uTime * 0.18, q1 * 1.3 + uTime * 0.12));

        float wisp = smoothstep(0.28, 0.82, q2);
        float filament = pow(clamp(1.0 - abs(q1 - q2) * 3.4, 0.0, 1.0), 2.2);

        vec3 col = mix(uColorDeep, uColorMid, wisp);
        col = mix(col, uColorBright, clamp(filament * 0.92 + wisp * 0.38, 0.0, 1.0));
        col *= (0.9 + 0.25 * uIntensity + vRipple * 8.0);

        float edgeFade = 1.0 - smoothstep(0.78, 0.99, r);
        float coreGlow = 0.72 + 0.28 * (1.0 - r);
        float alpha = clamp((0.68 + filament * 0.3) * edgeFade * coreGlow, 0.0, 0.96);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * Creates a shimmering crimson/gold phoenix feather ShaderMaterial.
 */
export function createFeatherShaderMaterial({
  crimsonColor = '#b02116',
  goldColor = '#f4c552',
  emberGlow = 0.22,
} = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uCrimson: { value: new THREE.Color(crimsonColor) },
      uGold: { value: new THREE.Color(goldColor) },
      uEmberGlow: { value: emberGlow },
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
      uniform vec3 uCrimson;
      uniform vec3 uGold;
      uniform float uEmberGlow;

      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormalView), normalize(vViewDir)), 0.0), 2.4);
        float barb = 0.5 + 0.5 * sin((vUv.y * 42.0 + abs(vUv.x - 0.5) * 28.0));
        float tipMix = smoothstep(0.48, 0.96, vUv.y);
        float shimmer = 0.88 + 0.12 * sin(uTime * 2.2 + vUv.y * 8.0);

        vec3 base = mix(uCrimson, uGold, tipMix * 0.72 + fresnel * 0.55);
        base *= (0.82 + barb * 0.24) * shimmer;
        base += uGold * (uEmberGlow * (tipMix + fresnel * 0.6));

        gl_FragColor = vec4(base, 1.0);
      }
    `,
  });
}

/**
 * Builds a radial dark-gradient contact shadow MeshBasicMaterial (for grounding legs & bases).
 */
function buildContactShadowAlphaCanvas() {
  const size = 128;
  const { canvas, ctx } = createCanvas(size, size);
  const c = size * 0.5;
  const grad = ctx.createRadialGradient(c, c, 2, c, c, c);
  grad.addColorStop(0.0, 'rgba(10, 8, 6, 0.58)');
  grad.addColorStop(0.42, 'rgba(12, 9, 7, 0.34)');
  grad.addColorStop(0.76, 'rgba(12, 9, 7, 0.10)');
  grad.addColorStop(1.0, 'rgba(12, 9, 7, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createContactShadowMaterial() {
  const tex = makeTexture(buildContactShadowAlphaCanvas(), { srgb: true, wrap: false, anisotropy: 4 });
  return new THREE.MeshBasicMaterial({
    name: 'contactShadow',
    map: tex,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Standalone Highlands panorama loader (used if called directly outside a library instance).
 */
export function loadHighlandsPanoramaTexture() {
  const tex = makeTexture(buildHighlandsFallbackCanvas(), {
    srgb: true,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 16,
  });
  if (HAS_BROWSER_IMAGE) {
    loadBrowserImage('./textures/materials/highlands_vista_panorama.jpg')
      .then((img) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        replaceTextureImage(tex, img, { colorSpace: THREE.SRGBColorSpace, anisotropy: 16 });
      })
      .catch(() => {});
  }
  return tex;
}

/**
 * Builds the photorealistic + procedural-fallback PBR material library for Dumbledore's Office.
 */
export function createMaterialLibrary() {
  const trackedTextures = [];
  const trackedMaterials = [];

  const textureStatus = {
    total: 0,
    loaded: 0,
    failed: 0,
    pending: 0,
    files: {},
  };

  const trackTex = (tex) => {
    if (tex) trackedTextures.push(tex);
    return tex;
  };
  const trackMat = (mat) => {
    if (mat) trackedMaterials.push(mat);
    return mat;
  };

  const trackStatus = (url, state, extra = {}) => {
    const prev = textureStatus.files[url];
    if (!prev) {
      textureStatus.total += 1;
      if (state === 'pending') textureStatus.pending += 1;
      else if (state === 'loaded') textureStatus.loaded += 1;
      else if (state === 'failed') textureStatus.failed += 1;
    } else if (prev.status !== state) {
      if (prev.status === 'pending') textureStatus.pending = Math.max(0, textureStatus.pending - 1);
      else if (prev.status === 'loaded') textureStatus.loaded = Math.max(0, textureStatus.loaded - 1);
      else if (prev.status === 'failed') textureStatus.failed = Math.max(0, textureStatus.failed - 1);

      if (state === 'pending') textureStatus.pending += 1;
      else if (state === 'loaded') textureStatus.loaded += 1;
      else if (state === 'failed') textureStatus.failed += 1;
    }
    textureStatus.files[url] = { url, status: state, ...extra };
  };

  // 1. Stone Wall & Dark Architectural Stone (sharing stone_wall_albedo.jpg at 2x2)
  const wallTex = buildStoneWallTextures(trackTex, { repeatX: 2, repeatY: 2 });
  const stoneWall = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'stoneWall',
      color: new THREE.Color('#f4efe6'),
      map: wallTex.map,
      normalMap: wallTex.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: wallTex.roughnessMap,
      roughness: 0.90,
      metalness: 0.03,
    })
  );

  const stoneDark = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'stoneDark',
      color: new THREE.Color('#7c818c'),
      map: wallTex.map,
      normalMap: wallTex.normalMap,
      normalScale: new THREE.Vector2(1.08, 1.08),
      roughnessMap: wallTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.04,
    })
  );

  const fireplaceBrick = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'fireplaceBrick',
      color: new THREE.Color('#5a4e46'),
      map: wallTex.map,
      normalMap: wallTex.normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: wallTex.roughnessMap,
      roughness: 0.94,
      metalness: 0.02,
    })
  );

  loadPhotorealisticPBR('./textures/materials/stone_wall_albedo.jpg', {
    map: wallTex.map,
    normalMap: wallTex.normalMap,
    roughnessMap: wallTex.roughnessMap,
    materials: [stoneWall, stoneDark, fireplaceBrick],
    seamless: true,
    normalStrength: 2.15,
    roughnessRange: [195, 250],
    statusTracker: textureStatus,
  });

  // 2. Matte Carved Stone (zero brick mortar lines — gargoyle & plinths)
  const carvedTex = buildCarvedStoneTextures(trackTex, { repeatX: 2, repeatY: 2 });
  const carvedStone = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'carvedStone',
      color: new THREE.Color('#d2d0c8'),
      map: carvedTex.map,
      normalMap: carvedTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: carvedTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.03,
    })
  );

  loadPhotorealisticPBR('./textures/materials/carved_stone_albedo.jpg', {
    map: carvedTex.map,
    normalMap: carvedTex.normalMap,
    roughnessMap: carvedTex.roughnessMap,
    material: carvedStone,
    seamless: true,
    normalStrength: 2.05,
    roughnessRange: [204, 252],
    statusTracker: textureStatus,
  });

  // 3. Flagstone Floor & Woven Carpet
  const flagTex = buildFlagstoneTextures(trackTex);
  const flagstoneFloor = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'flagstoneFloor',
      map: flagTex.map,
      normalMap: flagTex.normalMap,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: flagTex.roughnessMap,
      roughness: 0.80,
      metalness: 0.04,
    })
  );

  loadPhotorealisticPBR('./textures/materials/flagstone_floor_albedo.jpg', {
    map: flagTex.map,
    normalMap: flagTex.normalMap,
    roughnessMap: flagTex.roughnessMap,
    material: flagstoneFloor,
    seamless: true,
    normalStrength: 2.1,
    roughnessRange: [148, 245],
    statusTracker: textureStatus,
  });

  const carpetTex = buildWovenCarpetTextures(trackTex);
  const wovenCarpet = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'wovenCarpet',
      map: carpetTex.map,
      normalMap: carpetTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: carpetTex.roughnessMap,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color('#b68f56'),
    })
  );

  loadPhotorealisticPBR('./textures/materials/woven_rug_albedo.jpg', {
    map: carpetTex.map,
    normalMap: carpetTex.normalMap,
    roughnessMap: carpetTex.roughnessMap,
    material: wovenCarpet,
    seamless: false,
    normalStrength: 1.45,
    roughnessRange: [215, 252],
    statusTracker: textureStatus,
  });

  // 4. Dark Carved Oak, Black Cabinet & Gleaming Polished Oak
  const darkOakTex = buildOakWoodTextures(trackTex, { gleaming: false });
  const darkCarvedOak = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'darkCarvedOak',
      map: darkOakTex.map,
      normalMap: darkOakTex.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: darkOakTex.roughnessMap,
      roughness: 0.68,
      metalness: 0.04,
      clearcoat: 0.24,
      clearcoatRoughness: 0.34,
    })
  );

  const blackCabinet = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'blackCabinet',
      map: darkOakTex.map,
      normalMap: darkOakTex.normalMap,
      normalScale: new THREE.Vector2(0.82, 0.82),
      roughnessMap: darkOakTex.roughnessMap,
      color: new THREE.Color('#2d292a'),
      roughness: 0.56,
      metalness: 0.05,
      clearcoat: 0.14,
      clearcoatRoughness: 0.38,
    })
  );

  loadPhotorealisticPBR('./textures/materials/dark_oak_albedo.jpg', {
    map: darkOakTex.map,
    normalMap: darkOakTex.normalMap,
    roughnessMap: darkOakTex.roughnessMap,
    materials: [darkCarvedOak, blackCabinet],
    seamless: true,
    normalStrength: 1.75,
    roughnessRange: [175, 244],
    statusTracker: textureStatus,
  });

  const gleamingOakTex = buildOakWoodTextures(trackTex, { gleaming: true });
  const gleamingOak = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'gleamingOak',
      map: gleamingOakTex.map,
      normalMap: gleamingOakTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: gleamingOakTex.roughnessMap,
      roughness: 0.44,
      metalness: 0.04,
      clearcoat: 0.44,
      clearcoatRoughness: 0.24,
    })
  );

  loadPhotorealisticPBR('./textures/materials/gleaming_oak_albedo.jpg', {
    map: gleamingOakTex.map,
    normalMap: gleamingOakTex.normalMap,
    roughnessMap: gleamingOakTex.roughnessMap,
    material: gleamingOak,
    seamless: true,
    normalStrength: 1.6,
    roughnessRange: [152, 224],
    statusTracker: textureStatus,
  });

  // 5. Metals: Burnished Silver, Antique Brass, Gilded Gold (brushed micro-normal maps)
  const silverTex = buildMetalTextures(trackTex, {
    baseColor: '#e6ebf2',
    patinaColor: '#98a1ae',
    seed: 101,
    brushStrength: 0.55,
  });
  const burnishedSilver = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'burnishedSilver',
      map: silverTex.map,
      normalMap: silverTex.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: silverTex.roughnessMap,
      metalness: 0.95,
      roughness: 0.19,
      clearcoat: 0.12,
      clearcoatRoughness: 0.25,
    })
  );

  const brassTex = buildMetalTextures(trackTex, {
    baseColor: '#cda34e',
    patinaColor: '#5c4b28',
    seed: 202,
    brushStrength: 0.4,
  });
  const antiqueBrass = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'antiqueBrass',
      map: brassTex.map,
      normalMap: brassTex.normalMap,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughnessMap: brassTex.roughnessMap,
      metalness: 0.90,
      roughness: 0.28,
    })
  );

  const goldTex = buildMetalTextures(trackTex, {
    baseColor: '#f2cb5e',
    patinaColor: '#9b7424',
    seed: 303,
    brushStrength: 0.28,
  });
  const gildedGold = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'gildedGold',
      map: goldTex.map,
      normalMap: goldTex.normalMap,
      normalScale: new THREE.Vector2(0.38, 0.38),
      roughnessMap: goldTex.roughnessMap,
      metalness: 0.94,
      roughness: 0.18,
      clearcoat: 0.15,
      clearcoatRoughness: 0.22,
    })
  );

  // 6. Crimson & Gold Phoenix Feathers
  const crimsonFeatherTex = buildFeatherTextures(trackTex, { goldVariant: false });
  const crimsonFeather = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'crimsonFeather',
      map: crimsonFeatherTex.map,
      normalMap: crimsonFeatherTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: crimsonFeatherTex.roughnessMap,
      roughness: 0.46,
      metalness: 0.08,
      sheen: 0.85,
      sheenRoughness: 0.38,
      sheenColor: new THREE.Color('#ffaf45'),
    })
  );

  const goldFeatherTex = buildFeatherTextures(trackTex, { goldVariant: true });
  const goldFeather = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'goldFeather',
      map: goldFeatherTex.map,
      normalMap: goldFeatherTex.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: goldFeatherTex.roughnessMap,
      roughness: 0.36,
      metalness: 0.24,
      sheen: 0.9,
      sheenRoughness: 0.3,
      sheenColor: new THREE.Color('#fff0a8'),
    })
  );

  // 7. Aged Parchment & Velvet Fabric
  const parchmentTex = buildParchmentTextures(trackTex);
  const agedParchment = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'agedParchment',
      map: parchmentTex.map,
      normalMap: parchmentTex.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.86,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
  );

  const velvetTex = buildVelvetTextures(trackTex);
  const velvetFabric = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'velvetFabric',
      map: velvetTex.map,
      normalMap: velvetTex.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.84,
      metalness: 0.0,
      sheen: 0.9,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color('#a83c4c'),
    })
  );

  // 8. Weathered Stitched Leather (Sorting Hat)
  const hatTex = buildSortingHatTextures(trackTex);
  const sortingHatLeather = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'sortingHatLeather',
      map: hatTex.map,
      normalMap: hatTex.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: hatTex.roughnessMap,
      roughness: 0.84,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );

  loadPhotorealisticPBR('./textures/materials/tattered_leather_albedo.jpg', {
    map: hatTex.map,
    normalMap: hatTex.normalMap,
    roughnessMap: hatTex.roughnessMap,
    material: sortingHatLeather,
    seamless: true,
    normalStrength: 2.1,
    roughnessRange: [186, 250],
    statusTracker: textureStatus,
  });

  // 9. Carved Rune Stone (Pensieve basin & rim)
  const runeTex = buildRuneStoneTextures(trackTex);
  const runeStone = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'runeStone',
      map: runeTex.map,
      normalMap: runeTex.normalMap,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: runeTex.roughnessMap,
      roughness: 0.76,
      metalness: 0.08,
      emissive: new THREE.Color('#27394f'),
      emissiveIntensity: 0.08,
    })
  );

  loadPhotorealisticPBR('./textures/materials/rune_stone_albedo.jpg', {
    map: runeTex.map,
    normalMap: runeTex.normalMap,
    roughnessMap: runeTex.roughnessMap,
    material: runeStone,
    seamless: true,
    normalStrength: 2.4,
    roughnessRange: [168, 246],
    statusTracker: textureStatus,
  });

  // 10. Fast Reflective Optical Glass & Crimson Ruby Gem (transmission: 0 avoids extra full-scene FBO pass)
  const glassTex = buildLeadedGlassTextures(trackTex);
  const leadedGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'leadedGlass',
      color: new THREE.Color('#dcebff'),
      map: glassTex.map,
      normalMap: glassTex.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: glassTex.roughnessMap,
      transparent: true,
      opacity: 0.30,
      roughness: 0.08,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  const crystalPhial = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'crystalPhial',
      color: new THREE.Color('#eef6ff'),
      transparent: true,
      opacity: 0.34,
      roughness: 0.05,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.8,
      depthWrite: false,
    })
  );

  const rubyGem = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'rubyGem',
      color: new THREE.Color('#a80c24'),
      roughness: 0.08,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.9,
      emissive: new THREE.Color('#38030c'),
      emissiveIntensity: 0.55,
    })
  );

  // 11. Supporting Canon Materials
  const candleWax = trackMat(
    new THREE.MeshPhysicalMaterial({
      name: 'candleWax',
      color: new THREE.Color('#ede2c6'),
      roughness: 0.58,
      metalness: 0.0,
      sheen: 0.25,
      sheenColor: new THREE.Color('#ffe0a8'),
      emissive: new THREE.Color('#4a2d0a'),
      emissiveIntensity: 0.22,
    })
  );

  const ashEmber = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'ashEmber',
      color: new THREE.Color('#2d2522'),
      roughness: 0.95,
      emissive: new THREE.Color('#d94b14'),
      emissiveIntensity: 0.85,
    })
  );

  const bookBurgundyTex = buildBookLeatherTextures(trackTex, '#5c1f24', 701);
  const bookLeatherBurgundy = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'bookLeatherBurgundy',
      map: bookBurgundyTex.map,
      normalMap: bookBurgundyTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.64,
    })
  );

  const bookNavyTex = buildBookLeatherTextures(trackTex, '#22314a', 702);
  const bookLeatherNavy = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'bookLeatherNavy',
      map: bookNavyTex.map,
      normalMap: bookNavyTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.64,
    })
  );

  const bookForestTex = buildBookLeatherTextures(trackTex, '#24412c', 703);
  const bookLeatherForest = trackMat(
    new THREE.MeshStandardMaterial({
      name: 'bookLeatherForest',
      map: bookForestTex.map,
      normalMap: bookForestTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.64,
    })
  );

  // 12. Portrait Canvas Normal Map & Contact Shadow Texture Cache
  const portraitNormalMap = trackTex(
    makeTexture(buildPortraitNormalCanvas(), {
      srgb: false,
      repeatX: 3,
      repeatY: 4,
      wrap: true,
      anisotropy: 16,
    })
  );

  let contactShadowTex = null;
  function createTrackedContactShadowMaterial() {
    if (!contactShadowTex) {
      contactShadowTex = trackTex(
        makeTexture(buildContactShadowAlphaCanvas(), {
          srgb: true,
          wrap: false,
          anisotropy: 4,
        })
      );
    }
    return trackMat(
      new THREE.MeshBasicMaterial({
        name: 'contactShadow',
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
  }

  // 13. Highlands Panorama Vista Texture Loader (cached per library instance)
  let highlandsPanoramaTex = null;
  function loadTrackedHighlandsPanoramaTexture() {
    if (highlandsPanoramaTex) return highlandsPanoramaTex;
    highlandsPanoramaTex = trackTex(
      makeTexture(buildHighlandsFallbackCanvas(), {
        srgb: true,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        anisotropy: 16,
      })
    );

    const panoUrl = './textures/materials/highlands_vista_panorama.jpg';
    if (!HAS_BROWSER_IMAGE) {
      if (!textureStatus.files[panoUrl]) {
        textureStatus.files[panoUrl] = { url: panoUrl, status: 'headless-fallback' };
      }
      return highlandsPanoramaTex;
    }

    trackStatus(panoUrl, 'pending');
    loadBrowserImage(panoUrl)
      .then((img) => {
        highlandsPanoramaTex.wrapS = THREE.RepeatWrapping;
        highlandsPanoramaTex.wrapT = THREE.ClampToEdgeWrapping;
        replaceTextureImage(highlandsPanoramaTex, img, { colorSpace: THREE.SRGBColorSpace, anisotropy: 16 });
        trackStatus(panoUrl, 'loaded', {
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      })
      .catch((err) => {
        trackStatus(panoUrl, 'failed', { error: err?.message || String(err) });
      });

    return highlandsPanoramaTex;
  }

  /**
   * Loads a single portrait file onto a CanvasTexture (optionally applying a 0.72 brightness
   * candlelit slumber glaze while preserving 100% of the Old Master oil brushwork).
   */
  function loadPortraitUrlIntoCanvasTex(url, targetTex, targetCanvas, { slumberGlaze = false } = {}) {
    if (!HAS_BROWSER_IMAGE) {
      if (!textureStatus.files[url]) {
        textureStatus.files[url] = { url, status: 'headless-fallback' };
      }
      return Promise.resolve(false);
    }

    const trackKey = slumberGlaze ? `${url}#snoozing` : url;
    if (!slumberGlaze) {
      trackStatus(trackKey, 'pending');
    }

    return loadBrowserImage(url)
      .then((img) => {
        const prevW = targetCanvas.width || 384;
        const prevH = targetCanvas.height || 512;
        const w = img.naturalWidth || img.width || prevW;
        const h = img.naturalHeight || img.height || prevH;
        targetCanvas.width = w;
        targetCanvas.height = h;
        const ctx = targetCanvas.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          if (slumberGlaze) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgb(188, 183, 175)';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        replaceTextureImage(targetTex, targetCanvas, {
          colorSpace: THREE.SRGBColorSpace,
          anisotropy: 16,
          prevWidth: prevW,
          prevHeight: prevH,
        });
        if (!slumberGlaze) {
          trackStatus(trackKey, 'loaded', { width: w, height: h });
        }
        return true;
      })
      .catch((err) => {
        if (!slumberGlaze) {
          trackStatus(trackKey, 'failed', { error: err?.message || String(err) });
        }
        return false;
      });
  }

  /**
   * Museum-grade Old Master oil portrait generator & async loader returning BOTH snoozing and awake
   * textures immediately backed by procedural oil-canvas fallbacks.
   */
  function createPortraitTexture({
    portraitId = null,
    name = 'Headmaster',
    palette = null,
    beard = false,
    hat = false,
    glasses = false,
    gender = 'male',
    awake = false,
  } = {}) {
    const snoozingCanvas = paintOilPortraitCanvas({
      name,
      palette,
      beard,
      hat,
      glasses,
      gender,
      eyesOpen: false,
    });
    const awakeCanvas = paintOilPortraitCanvas({
      name,
      palette,
      beard,
      hat,
      glasses,
      gender,
      eyesOpen: true,
    });

    const snoozing = trackTex(makeTexture(snoozingCanvas, { srgb: true, wrap: false, anisotropy: 16 }));
    const awakeTex = trackTex(makeTexture(awakeCanvas, { srgb: true, wrap: false, anisotropy: 16 }));

    const resolvedId =
      portraitId ||
      PORTRAIT_NAME_FALLBACK_MAP[String(name || '').trim().toLowerCase()] ||
      null;
    const mapping = resolvedId ? PORTRAIT_FILE_MAP[resolvedId] : null;

    if (mapping) {
      if (typeof mapping === 'object') {
        loadPortraitUrlIntoCanvasTex(mapping.awake, awakeTex, awakeCanvas, { slumberGlaze: false });
        loadPortraitUrlIntoCanvasTex(mapping.snoozing, snoozing, snoozingCanvas, { slumberGlaze: false });
      } else {
        loadPortraitUrlIntoCanvasTex(mapping, awakeTex, awakeCanvas, { slumberGlaze: false });
        loadPortraitUrlIntoCanvasTex(mapping, snoozing, snoozingCanvas, { slumberGlaze: true });
      }
    }

    return {
      snoozing,
      awake: awakeTex,
      initial: awake ? awakeTex : snoozing,
    };
  }

  function createTrackedPensieveLiquidMaterial() {
    return trackMat(createPensieveLiquidMaterial());
  }

  function createTrackedFeatherShaderMaterial(opts) {
    return trackMat(createFeatherShaderMaterial(opts));
  }

  function getTextureLoadStatus() {
    const files = {};
    for (const [k, v] of Object.entries(textureStatus.files)) {
      files[k] = { ...v };
    }
    return {
      total: textureStatus.total,
      loaded: textureStatus.loaded,
      failed: textureStatus.failed,
      pending: textureStatus.pending,
      allSettled: textureStatus.pending === 0,
      files,
    };
  }

  function dispose() {
    for (const tex of trackedTextures) {
      tex.dispose();
    }
    for (const mat of trackedMaterials) {
      mat.dispose();
    }
    trackedTextures.length = 0;
    trackedMaterials.length = 0;
  }

  return {
    // Primary PBR Materials
    stoneWall,
    stoneDark,
    carvedStone,
    flagstoneFloor,
    wovenCarpet,
    darkCarvedOak,
    gleamingOak,
    burnishedSilver,
    antiqueBrass,
    gildedGold,
    crimsonFeather,
    goldFeather,
    agedParchment,
    velvetFabric,
    sortingHatLeather,
    runeStone,
    leadedGlass,

    // Supporting Canon Materials
    blackCabinet,
    crystalPhial,
    rubyGem,
    candleWax,
    fireplaceBrick,
    ashEmber,
    bookLeatherBurgundy,
    bookLeatherNavy,
    bookLeatherForest,

    // Portrait & Vista Helpers
    portraitNormalMap,
    loadHighlandsPanoramaTexture: loadTrackedHighlandsPanoramaTexture,
    createContactShadowMaterial: createTrackedContactShadowMaterial,
    getTextureLoadStatus,
    loadPhotorealisticPBR: (url, opts = {}) =>
      loadPhotorealisticPBR(url, { statusTracker: textureStatus, ...opts }),

    // Procedural Helpers
    createPortraitTexture,
    createPensieveLiquidMaterial: createTrackedPensieveLiquidMaterial,
    createFeatherShaderMaterial: createTrackedFeatherShaderMaterial,
    dispose,
  };
}
