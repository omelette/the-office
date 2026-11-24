/**
 * Collision-Free Spatial Layout Contract for Dumbledore's Office (Books 1–7 Canon).
 *
 * Coordinate & Angle Convention:
 * - Right-handed Three.js world space, single-level circular room centered at (0, 0, 0), FLOOR_Y = 0.
 * - Strictly NO mezzanine, upper balcony, or interior second story.
 * - Angle `angleRad = 0` (0°) points toward +Z (South / Entrance Oak Door).
 * - Angle increases Counter-Clockwise (CCW) when viewed from above (+Y looking down):
 *     0°   = +Z (South: Oak door, spiral staircase down, corridor, stone gargoyle)
 *     90°  = +X (East: Black cabinet housing Pensieve)
 *     180° = -Z (North: Claw-footed desk, Sorting Hat shelf, Dumbledore portrait cavity)
 *     270° = -X (West: Carved stone fireplace & hearth)
 * - polarToCartesian(r, angleRad, y) => [r * sin(angleRad), y, r * cos(angleRad)]
 * - wallFacingRotation(angleRad) => angleRad + Math.PI (local +Z faces radially inward toward center)
 */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export const ROOM_RADIUS = 6.5;
export const WALL_THICKNESS = 0.45;
export const ROOM_HEIGHT = 5.6;
export const FLOOR_Y = 0;

export const degToRad = (deg) => deg * DEG2RAD;
export const radToDeg = (rad) => rad * RAD2DEG;

/**
 * Converts cylindrical coordinates (radius, angleRad CCW from +Z, y) to [x, y, z].
 * @param {number} radius
 * @param {number} angleRad
 * @param {number} [y=0]
 * @returns {[number, number, number]}
 */
export function polarToCartesian(radius, angleRad, y = 0) {
  return [
    Number((radius * Math.sin(angleRad)).toFixed(4)),
    Number(y.toFixed(4)),
    Number((radius * Math.cos(angleRad)).toFixed(4)),
  ];
}

/**
 * Converts cylindrical coordinates into { x, y, z }.
 * @param {number} radius
 * @param {number} angleRad
 * @param {number} [y=0]
 * @returns {{ x: number, y: number, z: number }}
 */
export function polarToObject(radius, angleRad, y = 0) {
  const [x, py, z] = polarToCartesian(radius, angleRad, y);
  return { x, y: py, z };
}

/**
 * Computes Y-axis rotation (radians) so a fixture whose local front is +Z
 * faces radially inward toward the office center (0, y, 0).
 * @param {number} angleRad
 * @returns {number}
 */
export function wallFacingRotation(angleRad) {
  return angleRad + Math.PI;
}

/**
 * Computes the unit outward horizontal normal [nx, 0, nz] for a wall sector at angleRad.
 * @param {number} angleRad
 * @returns {[number, number, number]}
 */
export function outwardNormal(angleRad) {
  return [
    Number(Math.sin(angleRad).toFixed(5)),
    0,
    Number(Math.cos(angleRad).toFixed(5)),
  ];
}

/**
 * Entrance Approach (0° / +Z South):
 * Gleaming oak door with brass griffin knocker opening inward;
 * Outside +Z: upper landing -> moving spiral stone staircase descending to y = -3.6 ->
 * splitting stone wall -> stone corridor -> ugly stone gargoyle.
 */
export const ENTRANCE = {
  angleDeg: 0,
  angleRad: 0,
  doorPos: [0, FLOOR_Y, ROOM_RADIUS],
  doorWidth: 1.36,
  doorHeight: 2.65,
  archHeight: 2.95,
  openingSpanDeg: 17, // -8.5° to +8.5°
  rotationY: wallFacingRotation(0),
  // Hinged on East (+X) jamb so inward swing opens toward East wall (Fawkes rests safely behind it at 26°)
  hingePos: [0.68, FLOOR_Y, ROOM_RADIUS - 0.04],
  openSwingRad: -1.68, // Swings inward ~96° toward Fawkes's corner without colliding
  knockerLocalOffset: [-0.68, 1.48, 0.05], // Relative to hinge at closed pose
  upperLanding: {
    minX: -1.05,
    maxX: 1.05,
    minZ: ROOM_RADIUS,
    maxZ: 7.55,
    floorY: FLOOR_Y,
  },
  spiralStaircase: {
    centerX: 0,
    centerZ: 9.1,
    radius: 1.55,
    innerColumnRadius: 0.32,
    topY: FLOOR_Y,
    bottomY: -3.6,
    stepCount: 20,
    turns: 1.35,
  },
  wallSplit: {
    z: 10.75,
    floorY: -3.6,
    openingWidth: 1.85,
    leafWidth: 1.15,
    leafHeight: 2.95,
    thickness: 0.36,
    slideOffset: 0.98,
  },
  corridor: {
    minX: -1.65,
    maxX: 1.65,
    minZ: 10.75,
    maxZ: 16.4,
    floorY: -3.6,
    height: 3.35,
  },
  gargoyle: {
    guardPos: [0.0, -3.6, 11.75],
    asidePos: [-1.18, -3.6, 11.95],
    lopsidedPos: [-1.05, -3.6, 12.15],
    lopsidedTiltZ: 0.24,
    plinthHeight: 0.55,
    radius: 0.45,
    facingRotY: 0, // Faces +Z down the corridor toward visitors
  },
};

/**
 * Fawkes's Golden Perch: standing immediately behind the inward-swinging oak door.
 */
const fawkesAngleRad = degToRad(26);
const fawkesPosArr = polarToCartesian(5.35, fawkesAngleRad, FLOOR_Y);
export const FAWKES_PERCH = {
  id: 'fawkes-perch',
  angleDeg: 26,
  angleRad: fawkesAngleRad,
  radius: 5.35,
  x: fawkesPosArr[0],
  y: FLOOR_Y,
  z: fawkesPosArr[2],
  pos: fawkesPosArr,
  perchTopY: 1.86,
  clearanceRadius: 0.42,
  rotationY: wallFacingRotation(fawkesAngleRad),
  ashPilePos: [fawkesPosArr[0], FLOOR_Y + 0.01, fawkesPosArr[2]],
};

/**
 * Two Tall Stone-Mullioned Leaded Windows on NE (136°) and NW (224°) arcs,
 * preserving an unbroken central stone pier behind the desk (180°).
 */
export const WINDOWS = [
  (() => {
    const angleDeg = 136;
    const angleRad = degToRad(angleDeg);
    return {
      id: 'window-ne',
      label: 'North-East Tower Window',
      angleDeg,
      angleRad,
      spanDeg: 17, // 127.5° to 144.5°
      radius: ROOM_RADIUS,
      sillY: 1.05,
      width: 1.92,
      height: 3.55,
      archPeakY: 4.6,
      pos: polarToCartesian(ROOM_RADIUS, angleRad, 1.05),
      rotationY: wallFacingRotation(angleRad),
    };
  })(),
  (() => {
    const angleDeg = 224;
    const angleRad = degToRad(angleDeg);
    return {
      id: 'window-nw',
      label: 'North-West Tower Window',
      angleDeg,
      angleRad,
      spanDeg: 17, // 215.5° to 232.5°
      radius: ROOM_RADIUS,
      sillY: 1.05,
      width: 1.92,
      height: 3.55,
      archPeakY: 4.6,
      pos: polarToCartesian(ROOM_RADIUS, angleRad, 1.05),
      rotationY: wallFacingRotation(angleRad),
    };
  })(),
];

export const EXTERIOR_DOME = {
  radius: 42,
  groundsRadius: 34,
  horizonY: -6,
};

/**
 * Central North Pier (180° / -Z behind desk):
 * Stacked cleanly vertically:
 * - Sorting Hat Shelf: y = 2.02 (hat peak ~2.54)
 * - Dumbledore's Portrait + Hidden Cavity: y = 2.82..4.62 (center 3.72)
 * Adjacent NW Pier (201°):
 * - Gryffindor Sword Glass Case: y = 1.64..3.00 (center 2.32)
 */
const northAngleRad = degToRad(180);
export const SORTING_HAT_SHELF = {
  id: 'sorting-hat',
  angleDeg: 180,
  angleRad: northAngleRad,
  radius: 6.26,
  y: 2.02,
  width: 1.15,
  depth: 0.44,
  thickness: 0.08,
  spanDeg: 10, // 175° to 185°
  pos: polarToCartesian(6.26, northAngleRad, 2.02),
  hatPos: polarToCartesian(6.24, northAngleRad, 2.06),
  hatTopY: 2.54,
  rotationY: wallFacingRotation(northAngleRad),
};

export const DUMBLEDORE_PORTRAIT_SLOT = {
  slotId: 'portrait-albus-dumbledore',
  portraitId: 'portrait-albus-dumbledore',
  name: 'Albus Dumbledore',
  angleDeg: 180,
  angleRad: northAngleRad,
  radius: 6.44,
  y: 3.72,
  width: 1.35,
  height: 1.8,
  minY: 2.82,
  maxY: 4.62,
  spanDeg: 12, // 174° to 186°
  pos: polarToCartesian(6.44, northAngleRad, 3.72),
  rotationY: wallFacingRotation(northAngleRad),
  hingePivot: [-0.675, 3.72, -6.42],
  openSwingRad: -1.15, // Swings left/inward to expose cavity
};

export const HIDDEN_CAVITY = {
  angleDeg: 180,
  angleRad: northAngleRad,
  radius: 6.58,
  y: 3.68,
  width: 0.62,
  height: 1.24,
  depth: 0.3,
  pos: polarToCartesian(6.58, northAngleRad, 3.68),
  swordRestPos: polarToCartesian(6.55, northAngleRad, 3.56),
  rotationY: wallFacingRotation(northAngleRad),
};

const swordAngleRad = degToRad(201);
export const SWORD_CASE = {
  id: 'gryffindor-sword-case',
  angleDeg: 201,
  angleRad: swordAngleRad,
  radius: 6.42,
  y: 2.32,
  width: 0.96,
  height: 1.36,
  depth: 0.24,
  minY: 1.64,
  maxY: 3.0,
  spanDeg: 9, // 196.5° to 205.5°
  pos: polarToCartesian(6.42, swordAngleRad, 2.32),
  rotationY: wallFacingRotation(swordAngleRad),
};

/**
 * East Wall (90° / +X): Opaque Black Cabinet holding the Pensieve in GoF/OoP
 * and casting a sliver of silvery light onto the Sword Glass Case at 201° when ajar.
 */
const cabinetAngleRad = degToRad(90);
const cabinetPosArr = polarToCartesian(6.2, cabinetAngleRad, FLOOR_Y);
export const BLACK_CABINET = {
  id: 'black-cabinet',
  angleDeg: 90,
  angleRad: cabinetAngleRad,
  radius: 6.2,
  pos: cabinetPosArr,
  width: 1.28,
  depth: 0.68,
  height: 2.45,
  spanDeg: 12, // 84° to 96°
  rotationY: wallFacingRotation(cabinetAngleRad),
  interiorShelfY: 1.08,
  pensieveCabinetPos: { x: 6.12, y: 1.08, z: 0.0 },
  pensieveCabinetPosArr: [6.12, 1.08, 0.0],
  beamOrigin: [5.78, 1.32, -0.14],
  beamTarget: [...SWORD_CASE.pos],
};

/**
 * West Wall (270° / -X): Carved Hogwarts Stone Fireplace & Hearth (Floo-connected).
 */
const fireplaceAngleRad = degToRad(270);
const fireplacePosArr = polarToCartesian(6.18, fireplaceAngleRad, FLOOR_Y);
export const FIREPLACE = {
  id: 'fireplace',
  angleDeg: 270,
  angleRad: fireplaceAngleRad,
  radius: 6.18,
  pos: fireplacePosArr,
  width: 2.2,
  depth: 0.86,
  height: 2.35,
  spanDeg: 20, // 260° to 280°
  rotationY: wallFacingRotation(fireplaceAngleRad),
  hearthPos: { x: -6.02, y: 0.14, z: 0.0 },
  grateY: 0.24,
  fireCenter: [-6.02, 0.45, 0.0],
  flueLightPos: [-5.55, 1.18, 0.0],
  clearRadius: 1.55,
};

/**
 * Central Desk & Seating Zone:
 * Enormous claw-footed desk slightly north of center facing +Z toward the door,
 * Headmaster's chair behind it, and straight-backed wooden visitor chairs opposite.
 */
export const DESK = {
  id: 'claw-footed-desk',
  x: 0.0,
  y: FLOOR_Y,
  z: -1.45,
  pos: [0.0, FLOOR_Y, -1.45],
  width: 2.45,
  depth: 1.15,
  topY: 0.82,
  rotationY: 0,
};

export const PENSIEVE_DESK_POS = {
  x: 0.0,
  y: DESK.topY,
  z: -1.35,
  pos: [0.0, DESK.topY, -1.35],
  radius: 0.28,
  height: 0.16,
};

export const MEMORY_PHIALS_OFFSETS = [
  {
    id: 'phial-1',
    label: 'Crystal Memory Bottle (Slughorn / Memory I)',
    x: 0.46,
    y: DESK.topY,
    z: -1.26,
    pos: [0.46, DESK.topY, -1.26],
    localToDesk: [0.46, DESK.topY, 0.19],
  },
  {
    id: 'phial-2',
    label: 'Crystal Memory Bottle / Flask (Memory II)',
    x: 0.58,
    y: DESK.topY,
    z: -1.4,
    pos: [0.58, DESK.topY, -1.4],
    localToDesk: [0.58, DESK.topY, 0.05],
  },
];

export const HEADMASTER_CHAIR = {
  id: 'headmaster-chair',
  x: 0.0,
  y: FLOOR_Y,
  z: -2.6,
  pos: [0.0, FLOOR_Y, -2.6],
  radius: 0.42,
  topY: 1.48,
  rotationY: 0,
};

export const VISITOR_CHAIRS = [
  {
    id: 'visitor-chair-left',
    x: -0.82,
    y: FLOOR_Y,
    z: 0.35,
    pos: [-0.82, FLOOR_Y, 0.35],
    radius: 0.38,
    topY: 1.05,
    rotationY: Math.PI - 0.16,
  },
  {
    id: 'visitor-chair-right',
    x: 0.82,
    y: FLOOR_Y,
    z: 0.35,
    pos: [0.82, FLOOR_Y, 0.35],
    radius: 0.38,
    topY: 1.05,
    rotationY: Math.PI + 0.16,
  },
];

export const CARPET = {
  x: 0.0,
  y: FLOOR_Y + 0.008,
  z: -0.95,
  radiusX: 2.65,
  radiusZ: 2.25,
};

/**
 * 7 Distinct Non-Overlapping Spindle-Legged Tables arrayed around the circular perimeter.
 */
function makeSpindleTable({ id, angleDeg, r, radius, height, artifactType, label }) {
  const angleRad = degToRad(angleDeg);
  const [x, y, z] = polarToCartesian(r, angleRad, FLOOR_Y);
  return {
    id,
    label,
    angleDeg,
    angleRad,
    r,
    x,
    y,
    z,
    pos: [x, y, z],
    radius,
    height,
    topY: height,
    artifactType,
    artifactPos: [x, height, z],
    rotationY: wallFacingRotation(angleRad),
  };
}

export const SPINDLE_TABLES = [
  makeSpindleTable({
    id: 'table-serpent',
    label: 'Smoke-Serpent Instrument Table',
    angleDeg: 52,
    r: 4.35,
    radius: 0.42,
    height: 0.86,
    artifactType: 'smoke-serpent-instrument',
  }),
  makeSpindleTable({
    id: 'table-silver-1',
    label: 'East Silver Instruments Table',
    angleDeg: 74,
    r: 4.75,
    radius: 0.38,
    height: 0.94,
    artifactType: 'silver-instruments',
  }),
  makeSpindleTable({
    id: 'table-silver-2',
    label: 'North-East Silver Instruments Table',
    angleDeg: 114,
    r: 4.75,
    radius: 0.4,
    height: 0.88,
    artifactType: 'silver-instruments',
  }),
  makeSpindleTable({
    id: 'table-gaunt-ring',
    label: 'Gaunt Ring Spindle Table (HBP Ch. 10)',
    angleDeg: 148,
    r: 4.1,
    radius: 0.36,
    height: 0.82,
    artifactType: 'gaunt-ring',
  }),
  makeSpindleTable({
    id: 'table-silver-3',
    label: 'North-West Silver Instruments Table',
    angleDeg: 216,
    r: 4.35,
    radius: 0.38,
    height: 0.92,
    artifactType: 'silver-instruments',
  }),
  makeSpindleTable({
    id: 'table-lunascope',
    label: 'Lunascope Table (OoP Ch. 37)',
    angleDeg: 246,
    r: 4.55,
    radius: 0.4,
    height: 0.85,
    artifactType: 'lunascope',
  }),
  makeSpindleTable({
    id: 'table-silver-4',
    label: 'South-West Silver Instruments Table',
    angleDeg: 308,
    r: 4.7,
    radius: 0.39,
    height: 0.9,
    artifactType: 'silver-instruments',
  }),
];

/**
 * Modest Minimal-Bridging Side Stand for Stored Horcrux Books (HBP/DH eras only).
 * Explicitly NOT a wall bookcase or film library rotunda; placed adjacent to Window NE
 * where Hermione summons the books out the open window in DH Ch. 6.
 */
const booksAngleRad = degToRad(155);
const booksPosArr = polarToCartesian(6.08, booksAngleRad, FLOOR_Y);
export const HORCRUX_BOOKS_ANCHOR = {
  id: 'horcrux-books',
  angleDeg: 155,
  angleRad: booksAngleRad,
  radius: 6.08,
  x: booksPosArr[0],
  y: FLOOR_Y,
  z: booksPosArr[2],
  pos: booksPosArr,
  width: 1.02,
  depth: 0.4,
  height: 1.12,
  topY: 1.12,
  spanDeg: 10, // 150° to 160°
  rotationY: wallFacingRotation(booksAngleRad),
  erasVisible: ['hbp', 'dh'],
};

/**
 * Framed Portraits of Former Headmasters & Headmistresses on Open Stone Wall Sectors.
 * Includes all 5 named peers (Dumbledore's portrait sits separately in DUMBLEDORE_PORTRAIT_SLOT)
 * plus 4 unnamed snoozing predecessors per CoS Ch. 12.
 */
function makePortraitSlot({ slotId, portraitId, name, angleDeg, y, width, height, named = true, gender = 'male', beard = false, hat = false, glasses = false }) {
  const angleRad = degToRad(angleDeg);
  const pos = polarToCartesian(6.46, angleRad, y);
  const spanDeg = Number(((width / ROOM_RADIUS) * RAD2DEG).toFixed(2));
  return {
    slotId,
    portraitId,
    name,
    named,
    angleDeg,
    angleRad,
    y,
    width,
    height,
    spanDeg,
    pos,
    rotationY: wallFacingRotation(angleRad),
    appearance: { gender, beard, hat, glasses },
  };
}

export const PORTRAIT_SLOTS = [
  makePortraitSlot({
    slotId: 'slot-phineas',
    portraitId: 'portrait-phineas-nigellus-black',
    name: 'Phineas Nigellus Black',
    angleDeg: 50,
    y: 2.85,
    width: 1.05,
    height: 1.4,
    named: true,
    gender: 'male',
    beard: 'pointed',
    hat: false,
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-everard',
    portraitId: 'portrait-everard',
    name: 'Everard',
    angleDeg: 68,
    y: 2.95,
    width: 0.95,
    height: 1.25,
    named: true,
    gender: 'male',
    beard: false,
    hat: false,
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-dilys',
    portraitId: 'portrait-dilys-derwent',
    name: 'Dilys Derwent',
    angleDeg: 113,
    y: 2.95,
    width: 1.05,
    height: 1.38,
    named: true,
    gender: 'female',
    beard: false,
    hat: false,
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-dippet',
    portraitId: 'portrait-armando-dippet',
    name: 'Armando Dippet',
    angleDeg: 161,
    y: 3.05,
    width: 1.0,
    height: 1.32,
    named: true,
    gender: 'male',
    beard: false,
    hat: false,
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-fortescue',
    portraitId: 'portrait-dexter-fortescue',
    name: 'Dexter Fortescue',
    angleDeg: 247,
    y: 2.95,
    width: 1.05,
    height: 1.38,
    named: true,
    gender: 'male',
    beard: 'short',
    hat: false,
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-unnamed-1',
    portraitId: 'portrait-unnamed-headmistress-1',
    name: 'Former Headmistress',
    angleDeg: 36,
    y: 2.85,
    width: 0.88,
    height: 1.18,
    named: false,
    gender: 'female',
    beard: false,
    hat: 'pointed',
    glasses: true,
  }),
  makePortraitSlot({
    slotId: 'slot-unnamed-2',
    portraitId: 'portrait-unnamed-headmaster-2',
    name: 'Former Headmaster',
    angleDeg: 296,
    y: 2.9,
    width: 0.95,
    height: 1.28,
    named: false,
    gender: 'male',
    beard: 'long',
    hat: 'cap',
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-unnamed-3',
    portraitId: 'portrait-unnamed-headmistress-3',
    name: 'Former Headmistress',
    angleDeg: 315,
    y: 3.05,
    width: 1.0,
    height: 1.32,
    named: false,
    gender: 'female',
    beard: false,
    hat: 'bonnet',
    glasses: false,
  }),
  makePortraitSlot({
    slotId: 'slot-unnamed-4',
    portraitId: 'portrait-unnamed-headmaster-4',
    name: 'Former Headmaster',
    angleDeg: 334,
    y: 2.85,
    width: 0.92,
    height: 1.22,
    named: false,
    gender: 'male',
    beard: 'short',
    hat: 'pointed',
    glasses: 'round',
  }),
];

/**
 * Contiguous 360° Wall Cutaway Sectors covering the outer cylindrical stone wall.
 * Builders create one arc group per sector and register them with engine.registerCutawayWallSectors().
 */
function makeWallSector(id, startDeg, endDeg, opts = {}) {
  const spanDeg = endDeg - startDeg;
  const centerDeg = startDeg + spanDeg * 0.5;
  const centerRad = degToRad(centerDeg);
  return {
    id,
    startDeg,
    endDeg,
    spanDeg,
    startRad: degToRad(startDeg),
    endRad: degToRad(endDeg),
    centerDeg,
    centerRad,
    normal: outwardNormal(centerRad),
    hasDoorOpening: Boolean(opts.hasDoorOpening),
    hasWindowOpening: Boolean(opts.hasWindowOpening),
    windowSpec: opts.windowSpec || null,
  };
}

export const WALL_SECTORS = [
  makeWallSector('sector-entrance-door', -8.5, 8.5, { hasDoorOpening: true }),
  makeWallSector('sector-se-1', 8.5, 45),
  makeWallSector('sector-se-2', 45, 84),
  makeWallSector('sector-east-cabinet', 84, 102),
  makeWallSector('sector-ene', 102, 127.5),
  makeWallSector('sector-window-ne', 127.5, 144.5, { hasWindowOpening: true, windowSpec: WINDOWS[0] }),
  makeWallSector('sector-north-east', 144.5, 168),
  makeWallSector('sector-north-center', 168, 192),
  makeWallSector('sector-north-west', 192, 215.5),
  makeWallSector('sector-window-nw', 215.5, 232.5, { hasWindowOpening: true, windowSpec: WINDOWS[1] }),
  makeWallSector('sector-wnw', 232.5, 260),
  makeWallSector('sector-west-fireplace', 260, 280),
  makeWallSector('sector-sw-1', 280, 316),
  makeWallSector('sector-sw-2', 316, 351.5),
];

/**
 * Curated Camera Presets matching engine.registerCameraPresets().
 */
export const CAMERA_PRESETS = {
  overview: {
    label: 'Cutaway Overview',
    pos: [10.8, 8.8, 11.4],
    target: [0, 1.8, -0.5],
    cutaway: true,
    mode: 'orbit',
  },
  inside: {
    label: 'Inside Threshold',
    pos: [0.0, 2.05, 4.4],
    target: [0, 1.85, -3.2],
    cutaway: false,
    mode: 'orbit',
  },
  entrance: {
    label: 'Gargoyle Entrance',
    pos: [0.0, -1.65, 15.1],
    target: [0, -2.05, 11.2],
    cutaway: false,
    mode: 'orbit',
  },
  desk: {
    label: 'Headmaster\'s Desk',
    pos: [0.45, 2.15, 1.35],
    target: [0, 1.35, -2.1],
    cutaway: false,
    mode: 'orbit',
  },
  pensieve: {
    label: 'The Pensieve',
    pos: [1.15, 1.95, -0.15],
    target: [0, 1.05, -1.35],
    cutaway: false,
    mode: 'orbit',
  },
  fawkes: {
    label: 'Fawkes & Golden Perch',
    pos: [-0.55, 1.65, 1.75],
    target: [FAWKES_PERCH.x, 1.05, FAWKES_PERCH.z],
    cutaway: false,
    mode: 'orbit',
  },
  instruments: {
    label: 'Silver Instruments',
    pos: [1.65, 1.85, 2.15],
    target: [3.85, 1.18, 2.15],
    cutaway: false,
    mode: 'orbit',
  },
  portraits: {
    label: 'Headmaster Portraits',
    pos: [0.55, 2.55, 2.85],
    target: [4.85, 2.9, 2.85],
    cutaway: false,
    mode: 'orbit',
  },
  sword: {
    label: 'Sword of Gryffindor',
    pos: [-0.85, 2.2, -3.25],
    target: [...SWORD_CASE.pos],
    cutaway: false,
    mode: 'orbit',
  },
  fireplace: {
    label: 'Stone Fireplace',
    pos: [-2.45, 1.8, 1.45],
    target: [-6.02, 1.15, 0.0],
    cutaway: false,
    mode: 'orbit',
  },
};

/**
 * First-Person Walk mode containment bounds & static furniture colliders.
 */
export const WALK_BOUNDS = {
  officeCenter: [0, FLOOR_Y, 0],
  officeRadius: ROOM_RADIUS,
  floorY: FLOOR_Y,
  lowerFloorY: ENTRANCE.corridor.floorY,
  eyeHeight: 1.68,
  playerRadius: 0.52,
  ceilingCutY: ROOM_HEIGHT - 0.1,
  corridorRect: {
    minX: -0.68,
    maxX: 0.68,
    minZ: 5.95,
    maxZ: 7.4,
  },
  lowerCorridorBounds: { ...ENTRANCE.corridor },
  obstacles: [
    // Enormous claw-footed desk
    {
      type: 'box',
      minX: DESK.x - DESK.width * 0.5,
      maxX: DESK.x + DESK.width * 0.5,
      minZ: DESK.z - DESK.depth * 0.5,
      maxZ: DESK.z + DESK.depth * 0.5,
    },
    // Headmaster chair
    { type: 'circle', x: HEADMASTER_CHAIR.x, z: HEADMASTER_CHAIR.z, radius: HEADMASTER_CHAIR.radius },
    // Visitor chairs
    ...VISITOR_CHAIRS.map((c) => ({ type: 'circle', x: c.x, z: c.z, radius: c.radius })),
    // Fawkes golden perch
    { type: 'circle', x: FAWKES_PERCH.x, z: FAWKES_PERCH.z, radius: FAWKES_PERCH.clearanceRadius },
    // 7 Spindle tables
    ...SPINDLE_TABLES.map((t) => ({ type: 'circle', x: t.x, z: t.z, radius: t.radius })),
    // Fireplace hearth curb
    { type: 'box', minX: -6.5, maxX: -5.4, minZ: -1.15, maxZ: 1.15 },
    // Black cabinet
    { type: 'box', minX: 5.75, maxX: 6.5, minZ: -0.7, maxZ: 0.7 },
  ],
};

/**
 * Lighting anchor coordinates calibrated for engine.setLightingAnchors().
 */
export const LIGHTING_ANCHORS = {
  hearthPosition: FIREPLACE.flueLightPos,
  candlePositions: [
    [DESK.x - 0.9, DESK.topY + 0.45, DESK.z - 0.25],
    [3.5, 2.8, 2.4],
    [-3.1, 2.8, 2.8],
  ],
};

/**
 * Validates that no wall fixtures or floor footprints overlap in 3D space.
 * Useful for automated layout verification and QA assertions.
 * @returns {{ ok: boolean, issues: string[], stats: object }}
 */
export function validateLayout() {
  const issues = [];

  const angularDiff = (a, b) => {
    let d = ((a - b + 540) % 360) - 180;
    return Math.abs(d);
  };

  // 1. Verify wall sector tiling sums to 360°
  const totalSpan = WALL_SECTORS.reduce((acc, s) => acc + s.spanDeg, 0);
  if (Math.abs(totalSpan - 360) > 0.01) {
    issues.push(`WALL_SECTORS span sums to ${totalSpan}°, expected 360°`);
  }

  // 2. Check angular + vertical overlaps among wall fixtures
  const wallItems = [
    { id: 'entrance-door', angleDeg: ENTRANCE.angleDeg, spanDeg: ENTRANCE.openingSpanDeg, minY: 0, maxY: ENTRANCE.archHeight },
    ...WINDOWS.map((w) => ({ id: w.id, angleDeg: w.angleDeg, spanDeg: w.spanDeg, minY: w.sillY, maxY: w.archPeakY })),
    { id: 'sorting-hat-shelf', angleDeg: SORTING_HAT_SHELF.angleDeg, spanDeg: SORTING_HAT_SHELF.spanDeg, minY: 1.92, maxY: SORTING_HAT_SHELF.hatTopY },
    { id: 'dumbledore-portrait', angleDeg: DUMBLEDORE_PORTRAIT_SLOT.angleDeg, spanDeg: DUMBLEDORE_PORTRAIT_SLOT.spanDeg, minY: DUMBLEDORE_PORTRAIT_SLOT.minY, maxY: DUMBLEDORE_PORTRAIT_SLOT.maxY },
    { id: 'sword-case', angleDeg: SWORD_CASE.angleDeg, spanDeg: SWORD_CASE.spanDeg, minY: SWORD_CASE.minY, maxY: SWORD_CASE.maxY },
    { id: 'black-cabinet', angleDeg: BLACK_CABINET.angleDeg, spanDeg: BLACK_CABINET.spanDeg, minY: 0, maxY: BLACK_CABINET.height },
    { id: 'fireplace', angleDeg: FIREPLACE.angleDeg, spanDeg: FIREPLACE.spanDeg, minY: 0, maxY: FIREPLACE.height },
    { id: 'horcrux-books', angleDeg: HORCRUX_BOOKS_ANCHOR.angleDeg, spanDeg: HORCRUX_BOOKS_ANCHOR.spanDeg, minY: 0, maxY: HORCRUX_BOOKS_ANCHOR.height },
    ...PORTRAIT_SLOTS.map((p) => ({
      id: p.slotId,
      angleDeg: p.angleDeg,
      spanDeg: p.spanDeg,
      minY: p.y - p.height * 0.5,
      maxY: p.y + p.height * 0.5,
    })),
  ];

  for (let i = 0; i < wallItems.length; i++) {
    for (let j = i + 1; j < wallItems.length; j++) {
      const a = wallItems[i];
      const b = wallItems[j];
      const dAng = angularDiff(a.angleDeg, b.angleDeg);
      const minAng = (a.spanDeg + b.spanDeg) * 0.5 + 1.0; // require >=1° angular gap if vertical ranges overlap
      const yOverlap = a.minY < b.maxY + 0.12 && b.minY < a.maxY + 0.12;
      if (dAng < minAng && yOverlap) {
        issues.push(`Wall overlap: ${a.id} (${a.angleDeg}°) vs ${b.id} (${b.angleDeg}°)`);
      }
    }
  }

  // 3. Check floor footprints (circular obstacles + desk + chairs + Fawkes + tables)
  const floorCircles = [
    { id: FAWKES_PERCH.id, x: FAWKES_PERCH.x, z: FAWKES_PERCH.z, r: FAWKES_PERCH.clearanceRadius },
    { id: HEADMASTER_CHAIR.id, x: HEADMASTER_CHAIR.x, z: HEADMASTER_CHAIR.z, r: HEADMASTER_CHAIR.radius },
    ...VISITOR_CHAIRS.map((c) => ({ id: c.id, x: c.x, z: c.z, r: c.radius })),
    ...SPINDLE_TABLES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: t.radius })),
    // Desk represented conservatively via 2 overlapping circles or box test below
  ];

  for (let i = 0; i < floorCircles.length; i++) {
    const a = floorCircles[i];
    // Ensure inside wall radius
    const distWall = ROOM_RADIUS - (Math.hypot(a.x, a.z) + a.r);
    if (distWall < 0.25) {
      issues.push(`Floor footprint ${a.id} too close to inner wall (clearance ${distWall.toFixed(2)}m)`);
    }
    // Check desk AABB clearance
    const halfW = DESK.width * 0.5;
    const halfD = DESK.depth * 0.5;
    const closestX = Math.max(DESK.x - halfW, Math.min(a.x, DESK.x + halfW));
    const closestZ = Math.max(DESK.z - halfD, Math.min(a.z, DESK.z + halfD));
    const distDesk = Math.hypot(a.x - closestX, a.z - closestZ) - a.r;
    if (distDesk < 0.08) {
      issues.push(`Floor footprint ${a.id} overlaps desk (clearance ${distDesk.toFixed(2)}m)`);
    }
    // Check door swing clearance (hinge at [0.68, 6.46], door radius 1.36)
    const distHinge = Math.hypot(a.x - ENTRANCE.hingePos[0], a.z - ENTRANCE.hingePos[2]);
    if (distHinge < 1.36 + a.r + 0.15) {
      issues.push(`Floor footprint ${a.id} impinges on oak door swing (${distHinge.toFixed(2)}m)`);
    }
    for (let j = i + 1; j < floorCircles.length; j++) {
      const b = floorCircles[j];
      const gap = Math.hypot(a.x - b.x, a.z - b.z) - (a.r + b.r);
      if (gap < 0.25) {
        issues.push(`Floor overlap: ${a.id} vs ${b.id} (gap ${gap.toFixed(2)}m)`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      wallFixtures: wallItems.length,
      spindleTables: SPINDLE_TABLES.length,
      portraitSlots: PORTRAIT_SLOTS.length + 1, // + Dumbledore portrait
      wallSectors: WALL_SECTORS.length,
      cameraPresets: Object.keys(CAMERA_PRESETS).length,
    },
  };
}
