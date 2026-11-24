import * as THREE from 'three';

/**
 * Converts a vector-like value (Vector3, [x, y, z], or { x, y, z }) into a THREE.Vector3.
 * @param {THREE.Vector3|number[]|{x:number,y:number,z:number}|null|undefined} value
 * @param {[number, number, number]} fallback
 * @returns {THREE.Vector3}
 */
function toVector3(value, fallback = [0, 0, 0]) {
  if (value instanceof THREE.Vector3) {
    return value.clone();
  }
  if (Array.isArray(value) && value.length >= 3) {
    return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  }
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    return new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

/**
 * Checks whether an Object3D and all of its ancestors are visible in the scene graph.
 * @param {THREE.Object3D|null} obj
 * @returns {boolean}
 */
function isHierarchyVisible(obj) {
  let curr = obj;
  while (curr) {
    if (!curr.visible) return false;
    curr = curr.parent;
  }
  return true;
}

/**
 * Registry managing interactive book-canon 3D objects inside Dumbledore's Office.
 */
export class CanonSceneRegistry {
  /**
   * @param {{ onError?: (err: unknown, context?: string) => void }} [options]
   */
  constructor(options = {}) {
    /** @type {Map<string, object>} */
    this._entries = new Map();
    /** @type {THREE.Object3D[]} */
    this._hitTargets = [];
    /** @type {string} */
    this._currentEra = 'cos';
    /** @type {((err: unknown, context?: string) => void) | null} */
    this._onError = typeof options.onError === 'function' ? options.onError : null;
  }

  /**
   * Sets or updates the error reporter hook (used by engine to capture runtime issues).
   * @param {((err: unknown, context?: string) => void) | null} handler
   */
  setErrorHandler(handler) {
    this._onError = typeof handler === 'function' ? handler : null;
  }

  /**
   * Registers an interactive canon object entry.
   * @param {object} config
   * @param {string} config.id
   * @param {string} config.name
   * @param {string} [config.category='prop']
   * @param {THREE.Object3D|null} [config.group=null]
   * @param {THREE.Object3D[]} [config.hitMeshes]
   * @param {THREE.Vector3|number[]|{x:number,y:number,z:number}} [config.cameraPos]
   * @param {THREE.Vector3|number[]|{x:number,y:number,z:number}} [config.cameraTarget]
   * @param {(actionName?: string, context?: object) => any} [config.interact]
   * @param {(dt: number, elapsed: number, state: object) => void} [config.onUpdate]
   * @param {(eraId: string) => void} [config.setEra]
   * @param {string[]} [config.actions]
   * @param {object} [config.metadata]
   * @returns {object} Normalized registry entry
   */
  register(config) {
    if (!config || typeof config.id !== 'string' || !config.id.trim()) {
      throw new Error('CanonSceneRegistry.register requires a non-empty string "id".');
    }

    const id = config.id.trim();
    if (this._entries.has(id)) {
      this.unregister(id);
    }

    const group = config.group ?? null;
    if (group && group.userData) {
      group.userData.canonId = id;
    }

    /** @type {THREE.Object3D[]} */
    let hitMeshes = [];
    if (Array.isArray(config.hitMeshes) && config.hitMeshes.length > 0) {
      hitMeshes = config.hitMeshes.filter(Boolean);
    } else if (group) {
      group.traverse((child) => {
        if (child.isMesh) {
          hitMeshes.push(child);
        }
      });
    }

    // Tag all hitMeshes (and any nested meshes inside them) with canonId for O(depth) raycast lookup
    for (const target of hitMeshes) {
      if (target.userData) {
        target.userData.canonId = id;
      }
      if (typeof target.traverse === 'function') {
        target.traverse((child) => {
          if (child.userData) {
            child.userData.canonId = id;
          }
        });
      }
    }

    const entry = {
      id,
      name: typeof config.name === 'string' && config.name.trim() ? config.name.trim() : id,
      category: typeof config.category === 'string' && config.category.trim() ? config.category.trim() : 'prop',
      group,
      hitMeshes,
      cameraPos: toVector3(config.cameraPos, [0, 2.2, 4.2]),
      cameraTarget: toVector3(config.cameraTarget, [0, 1.3, 0]),
      interact: typeof config.interact === 'function' ? config.interact : null,
      onUpdate: typeof config.onUpdate === 'function' ? config.onUpdate : null,
      setEra: typeof config.setEra === 'function' ? config.setEra : null,
      actions: Array.isArray(config.actions) ? [...config.actions] : [],
      metadata: config.metadata && typeof config.metadata === 'object' ? { ...config.metadata } : {},
    };

    this._entries.set(id, entry);
    this._rebuildHitTargets();
    return entry;
  }

  /**
   * Unregisters an entry by id.
   * @param {string} id
   * @returns {boolean}
   */
  unregister(id) {
    const entry = this._entries.get(id);
    if (!entry) return false;

    if (entry.group?.userData?.canonId === id) {
      delete entry.group.userData.canonId;
    }
    for (const target of entry.hitMeshes) {
      if (target?.userData?.canonId === id) {
        delete target.userData.canonId;
      }
    }

    this._entries.delete(id);
    this._rebuildHitTargets();
    return true;
  }

  /**
   * Removes all registered entries.
   */
  clear() {
    for (const id of Array.from(this._entries.keys())) {
      this.unregister(id);
    }
  }

  /**
   * @private
   */
  _rebuildHitTargets() {
    const seen = new Set();
    const list = [];
    for (const entry of this._entries.values()) {
      for (const mesh of entry.hitMeshes) {
        if (mesh && !seen.has(mesh)) {
          seen.add(mesh);
          list.push(mesh);
        }
      }
    }
    this._hitTargets = list;
  }

  /**
   * Looks up a registered canon entry by id.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return this._entries.get(id) ?? null;
  }

  /**
   * Checks whether an id is registered.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._entries.has(id);
  }

  /**
   * Lists all registered canon entries in registration order.
   * @returns {object[]}
   */
  list() {
    return Array.from(this._entries.values());
  }

  /**
   * Alias for list().
   * @returns {object[]}
   */
  getAll() {
    return this.list();
  }

  /**
   * Filters registered entries by category.
   * @param {string} category
   * @returns {object[]}
   */
  getByCategory(category) {
    return this.list().filter((entry) => entry.category === category);
  }

  /**
   * Returns all registered hit target meshes for raycasting.
   * @returns {THREE.Object3D[]}
   */
  getHitTargets() {
    return this._hitTargets;
  }

  /**
   * Returns only hit target meshes whose entire ancestor hierarchy is currently visible.
   * @returns {THREE.Object3D[]}
   */
  getVisibleHitTargets() {
    return this._hitTargets.filter((mesh) => isHierarchyVisible(mesh));
  }

  /**
   * Resolves a raycast hit Object3D back to its CanonSceneRegistry entry
   * by traversing `.userData.canonId` up the parent chain.
   * @param {THREE.Object3D|null|undefined} object3D
   * @returns {object|null}
   */
  resolveHit(object3D) {
    let curr = object3D;
    while (curr) {
      const canonId = curr.userData?.canonId;
      if (typeof canonId === 'string' && this._entries.has(canonId)) {
        return this._entries.get(canonId);
      }
      curr = curr.parent;
    }
    return null;
  }

  /**
   * Resolves a raycast hit Object3D directly to its canonId string (or null).
   * @param {THREE.Object3D|null|undefined} object3D
   * @returns {string|null}
   */
  resolveCanonId(object3D) {
    return this.resolveHit(object3D)?.id ?? null;
  }

  /**
   * Triggers an interactive action on a registered canon object.
   * @param {string} id
   * @param {string} [actionName]
   * @param {object} [context]
   * @returns {any}
   */
  triggerInteract(id, actionName, context = {}) {
    const entry = this.get(id);
    if (!entry || !entry.interact) return null;
    try {
      return entry.interact(actionName, context);
    } catch (err) {
      if (this._onError) {
        this._onError(err, `interact(${id}, ${String(actionName)})`);
        return null;
      }
      throw err;
    }
  }

  /**
   * Runs per-frame `onUpdate(dt, elapsed, state)` callbacks on registered objects.
   * @param {number} dt
   * @param {number} elapsed
   * @param {object} state
   */
  update(dt, elapsed, state) {
    for (const entry of this._entries.values()) {
      if (!entry.onUpdate) continue;
      try {
        entry.onUpdate(dt, elapsed, state);
      } catch (err) {
        if (this._onError) {
          this._onError(err, `onUpdate(${entry.id})`);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Propagates an era change (`cos`, `gof`, `oop`, `hbp`, `dh`) to all entries with `setEra`.
   * @param {string} eraId
   */
  applyEra(eraId) {
    this._currentEra = eraId;
    for (const entry of this._entries.values()) {
      if (!entry.setEra) continue;
      try {
        entry.setEra(eraId);
      } catch (err) {
        if (this._onError) {
          this._onError(err, `setEra(${entry.id}, ${eraId})`);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Returns the most recently applied era ID.
   * @returns {string}
   */
  getCurrentEra() {
    return this._currentEra;
  }
}
