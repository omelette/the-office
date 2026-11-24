import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv', 'uv1', 'color', 'tangent'];

function flipTriangleWinding(geometry) {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return;
  const vertCount = posAttr.count;
  const attrNames = Object.keys(geometry.attributes);

  for (const name of attrNames) {
    const attr = geometry.attributes[name];
    const itemSize = attr.itemSize;
    const arr = attr.array;
    for (let i = 0; i + 2 < vertCount; i += 3) {
      const idx1 = (i + 1) * itemSize;
      const idx2 = (i + 2) * itemSize;
      for (let k = 0; k < itemSize; k++) {
        const tmp = arr[idx1 + k];
        arr[idx1 + k] = arr[idx2 + k];
        arr[idx2 + k] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
}

function hasNoMergeAncestor(node, stopRoot) {
  let cur = node;
  while (cur && cur !== stopRoot) {
    if (cur.userData?.noMerge) return true;
    cur = cur.parent;
  }
  return false;
}

function normalizeGeometry(sourceGeo, relMatrix) {
  const geo = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();
  geo.clearGroups();
  geo.morphAttributes = {};

  for (const attrName of Object.keys(geo.attributes)) {
    if (!KEEP_ATTRIBUTES.includes(attrName)) {
      geo.deleteAttribute(attrName);
    }
  }

  geo.applyMatrix4(relMatrix);
  if (relMatrix.determinant() < 0) {
    flipTriangleWinding(geo);
  }

  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }

  return geo;
}

function getBucketKey(mesh) {
  const g = mesh.geometry;
  const ud = mesh.userData || {};
  const hasUv = g.getAttribute('uv') ? 1 : 0;
  const hasUv1 = g.getAttribute('uv1') ? 1 : 0;
  const hasColor = g.getAttribute('color') ? 1 : 0;
  const hasTangent = g.getAttribute('tangent') ? 1 : 0;

  return [
    mesh.material.uuid,
    mesh.castShadow ? 1 : 0,
    mesh.receiveShadow ? 1 : 0,
    mesh.renderOrder || 0,
    mesh.visible ? 1 : 0,
    mesh.frustumCulled === false ? 0 : 1,
    ud.canonId || '',
    ud.noHighlight ? 1 : 0,
    ud.noShadow ? 1 : 0,
    ud.noRaycast ? 1 : 0,
    ud.canonIgnore ? 1 : 0,
    hasUv,
    hasUv1,
    hasColor,
    hasTangent,
  ].join('|');
}

/**
 * Merges static sibling/descendant meshes under `rootGroup` by material & render flags
 * to dramatically reduce WebGL draw calls while preserving canon metadata and shadow flags.
 */
export function mergeStaticSubtree(rootGroup, { skipFilter } = {}) {
  const result = { mergedMeshes: [], removedCount: 0, createdCount: 0 };
  if (!rootGroup) return result;

  rootGroup.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(rootGroup.matrixWorld).invert();
  const buckets = new Map();

  rootGroup.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return;
    if (!obj.geometry || !obj.material || Array.isArray(obj.material)) return;
    if (!obj.geometry.getAttribute('position')) return;
    if (hasNoMergeAncestor(obj, rootGroup)) return;
    if (skipFilter && skipFilter(obj)) return;

    const key = getBucketKey(obj);
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(obj);
  });

  const relMatrix = new THREE.Matrix4();

  for (const list of buckets.values()) {
    if (list.length < 2) continue;

    const prepared = [];
    for (const mesh of list) {
      relMatrix.copy(invRoot).multiply(mesh.matrixWorld);
      prepared.push(normalizeGeometry(mesh.geometry, relMatrix));
    }

    const mergedGeo = mergeGeometries(prepared, false);
    for (const g of prepared) g.dispose();

    if (!mergedGeo) continue;

    mergedGeo.computeBoundingBox();
    mergedGeo.computeBoundingSphere();

    const ref = list[0];
    const mergedMesh = new THREE.Mesh(mergedGeo, ref.material);
    mergedMesh.name = ref.name ? `${ref.name}_batched` : 'batched_mesh';
    mergedMesh.castShadow = ref.castShadow;
    mergedMesh.receiveShadow = ref.receiveShadow;
    mergedMesh.renderOrder = ref.renderOrder;
    mergedMesh.visible = ref.visible;
    mergedMesh.frustumCulled = ref.frustumCulled;

    const refUd = ref.userData || {};
    if (refUd.canonId) mergedMesh.userData.canonId = refUd.canonId;
    if (refUd.noHighlight) mergedMesh.userData.noHighlight = true;
    if (refUd.noShadow) mergedMesh.userData.noShadow = true;
    if (refUd.noRaycast) mergedMesh.userData.noRaycast = true;
    if (refUd.canonIgnore) mergedMesh.userData.canonIgnore = true;

    for (const oldMesh of list) {
      if (oldMesh.parent) oldMesh.parent.remove(oldMesh);
    }

    rootGroup.add(mergedMesh);
    result.mergedMeshes.push(mergedMesh);
    result.removedCount += list.length;
    result.createdCount += 1;
  }

  return result;
}
