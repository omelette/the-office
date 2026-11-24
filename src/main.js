import './styles.css';
import * as canonData from './canon/canonData.js';
import * as layout from './scene/layout.js';
import { CanonSceneRegistry } from './scene/registry.js';
import { createMaterialLibrary } from './scene/materials.js';
import { createOfficeEngine } from './scene/engine.js';
import { buildArchitecture } from './scene/architecture.js';
import { buildFurniture } from './scene/furniture.js';
import { buildArtifacts } from './scene/artifacts.js';
import { createSoundscape } from './audio/soundscape.js';
import { initHUD } from './ui/hud.js';

const canvas = document.getElementById('scene-canvas');

const materials = createMaterialLibrary();
const registry = new CanonSceneRegistry();
const engine = createOfficeEngine(canvas, registry, {
  getTextureLoadStatus: materials.getTextureLoadStatus,
});
const soundscape = createSoundscape();

// Build all book-canon 3D assemblies in deterministic scene order
const architecture = buildArchitecture(engine.scene, materials, registry, layout, canonData);
const furniture = buildFurniture(engine.scene, materials, registry, layout, canonData);
const artifacts = buildArtifacts(engine.scene, materials, registry, layout, canonData);

// Bind spatial bounds, lighting anchors, camera presets, and wall cutaway sectors to engine
engine.setArchitectureBounds(layout.WALK_BOUNDS);
engine.setLightingAnchors(layout.LIGHTING_ANCHORS);
engine.registerCameraPresets(layout.CAMERA_PRESETS);
engine.registerCutawayWallSectors(architecture.getCutawaySectors());
engine.registerCutawayCeiling(architecture.getCutawayCeilings());

// Cross-controller synchronization so both HUD buttons and window.__OFFICE_DEBUG__.triggerAction
// keep Dumbledore's portrait cavity, real-vs-replica sword, and black cabinet <-> Pensieve synced.
function syncSwordCavityAfterPortrait(open) {
  architecture.setSwordCavityOpen(Boolean(open));
}

function syncCabinetForPensieve(actionName, result) {
  const loc = result?.location;
  if (actionName === 'move-pensieve' || actionName === 'desk' || actionName === 'cabinet') {
    if (loc === 'desk') {
      architecture.setCabinetState('open');
    } else if (loc === 'cabinet') {
      architecture.setCabinetState('ajar');
    }
  } else if (loc === 'cabinet') {
    // Peering into the Pensieve while stored inside the cabinet opens the doors cleanly
    architecture.setCabinetState('open');
  }
}

const dumbledoreEntry = registry.get('dumbledore-portrait');
if (dumbledoreEntry && typeof dumbledoreEntry.interact === 'function') {
  const baseInteract = dumbledoreEntry.interact;
  dumbledoreEntry.interact = (actionName, context) => {
    const res = baseInteract(actionName, context);
    if (res && typeof res.open === 'boolean') {
      syncSwordCavityAfterPortrait(res.open);
    }
    return res;
  };
}

const swordEntry = registry.get('gryffindor-sword-case');
if (swordEntry && typeof swordEntry.interact === 'function') {
  const baseInteract = swordEntry.interact;
  swordEntry.interact = (actionName, context) => {
    const res = baseInteract(actionName, context);
    if (res?.swordInCavity) {
      architecture.setSwordCavityOpen(true);
    }
    return res;
  };
}

const pensieveEntry = registry.get('pensieve');
if (pensieveEntry && typeof pensieveEntry.interact === 'function') {
  const baseInteract = pensieveEntry.interact;
  pensieveEntry.interact = (actionName, context) => {
    const res = baseInteract(actionName, context);
    syncCabinetForPensieve(actionName, res);
    return res;
  };
}

const controllers = {
  architecture,
  furniture: {
    ...furniture,
    setDumbledorePortraitSwing(open) {
      const next = furniture.setDumbledorePortraitSwing(open);
      syncSwordCavityAfterPortrait(next);
      return next;
    },
  },
  artifacts: {
    ...artifacts,
    togglePensieveLocation(loc) {
      const nextLoc = artifacts.togglePensieveLocation(loc);
      syncCabinetForPensieve('move-pensieve', { location: nextLoc });
      return nextLoc;
    },
    toggleSwordSecret(inCavity) {
      const nextInCavity = artifacts.toggleSwordSecret(inCavity);
      if (nextInCavity) {
        architecture.setSwordCavityOpen(true);
      }
      return nextInCavity;
    },
  },
};

// Mount HUD, Canon Provenance Inspector, Directory, Gargoyle Password Gate & Audit Modal
const hud = initHUD(engine, registry, canonData, controllers, soundscape);

// Initialize to Chamber of Secrets Ch. 12 ('cos') & architectural overview
hud.setEra('cos');
engine.setCameraPreset('overview', 0);
architecture.setCutaway(engine.isCutawayEnabled());
soundscape.setFireplaceLit(true);

engine.start();

export { engine, registry, materials, controllers, hud, soundscape };
