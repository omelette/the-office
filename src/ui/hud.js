/**
 * Book-Canon HUD, Object Directory, Gargoyle Password Gate, Canon Provenance Inspector,
 * and Canon Purity & Film Exclusions Audit Modal for Dumbledore's Office.
 *
 * All quotes, citations, passwords, named portraits, eras, and film exclusions are read
 * exclusively from `canonData` (src/canon/canonData.js).
 */

const CATEGORY_ORDER = [
  'entrance',
  'architecture',
  'furniture',
  'instrument',
  'portrait',
  'creature',
  'artifact',
];

const CATEGORY_LABELS = {
  entrance: 'Entrance & Approach',
  architecture: 'Chamber Architecture',
  furniture: 'Furniture',
  instrument: 'Silver & Astronomical Instruments',
  portrait: 'Portraits',
  creature: 'Creatures',
  artifact: 'Artifacts & Texts',
};

const CAMERA_PRESET_ITEMS = [
  { id: 'overview', label: 'Overview', fallbackCanonId: 'circular-room' },
  { id: 'inside', label: 'Inside Office', altId: 'interior', fallbackCanonId: 'circular-room' },
  { id: 'entrance', label: 'Gargoyle Entrance', fallbackCanonId: 'stone-gargoyle' },
  { id: 'desk', label: 'Claw-Footed Desk', fallbackCanonId: 'claw-footed-desk' },
  { id: 'pensieve', label: 'Pensieve', fallbackCanonId: 'pensieve' },
  { id: 'fawkes', label: "Fawkes's Perch", fallbackCanonId: 'fawkes-perch' },
  { id: 'instruments', label: 'Silver Instruments', fallbackCanonId: 'silver-instruments' },
  { id: 'portraits', label: 'Portraits', fallbackCanonId: 'portraits' },
  { id: 'sword', label: 'Sword of Gryffindor', fallbackCanonId: 'gryffindor-sword-case' },
  { id: 'fireplace', label: 'Fireplace', fallbackCanonId: 'fireplace' },
];

const ERA_SHORT_LABELS = {
  cos: 'CoS · Book 2',
  gof: 'GoF · Book 4',
  oop: 'OoP · Book 5',
  hbp: 'HBP · Book 6',
  dh: 'DH · Book 7',
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePassword(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/^['"“”‘’]+|['"“”‘’.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildPasswordLookup(passwords = []) {
  const acceptedMap = new Map();
  const rejectedSet = new Set();
  const chips = [];
  const seenChips = new Set();
  let dhNoPasswordRow = null;

  for (const row of passwords) {
    if (!row) continue;
    if (row.status === 'accepted' && row.password) {
      const primary = row.password.trim();
      acceptedMap.set(normalizePassword(primary), { label: primary, row });
      if (!seenChips.has(primary)) {
        seenChips.add(primary);
        chips.push({
          value: primary,
          title: `${row.book}, ${row.chapter} — ${row.speaker}`,
        });
      }

      if (row.usEditionVariant) {
        const variants = row.usEditionVariant.split('/').map((v) => v.trim()).filter(Boolean);
        for (const variant of variants) {
          acceptedMap.set(normalizePassword(variant), { label: variant, row });
          if (!seenChips.has(variant) && !row.usEditionVariant.includes('/')) {
            seenChips.add(variant);
            chips.push({
              value: variant,
              title: `${row.book}, ${row.chapter} (US edition) — ${row.speaker}`,
            });
          }
        }
      }
    } else if (row.status === 'accepted' && row.password === null) {
      dhNoPasswordRow = row;
    } else if (row.status === 'rejected' && row.usEditionVariant) {
      for (const part of row.usEditionVariant.split('/')) {
        const norm = normalizePassword(part);
        if (norm) rejectedSet.add(norm);
      }
    }
  }

  return { acceptedMap, rejectedSet, chips, dhNoPasswordRow };
}

function injectHudStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('hud-canon-styles')) return;

  const style = document.createElement('style');
  style.id = 'hud-canon-styles';
  style.textContent = `
    .hud-top-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      pointer-events: none;
    }
    .hud-brand-compact {
      padding: 8px 14px;
      max-width: 390px;
    }
    .hud-brand-compact h1 {
      font-size: clamp(0.98rem, 0.92rem + 0.35vw, 1.16rem);
      line-height: 1.25;
    }
    .hud-brand-compact .hud-subtitle {
      margin: 2px 0 0;
      font-size: var(--text-xs);
      color: var(--parchment-300);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hud-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
    }
    .hud-select-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding-right: 4px;
      border-right: 1px solid var(--glass-border);
      margin-right: 2px;
    }
    .hud-select-label {
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--parchment-400);
    }
    .hud-select {
      background: rgba(24, 20, 17, 0.92);
      color: var(--parchment-100);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 0.38rem 0.6rem;
      font-family: var(--font-body);
      font-size: var(--text-sm);
      cursor: pointer;
    }
    .hud-select:focus-visible {
      outline: 2px solid var(--brass-300);
      outline-offset: 2px;
    }
    .hud-middle {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin: 10px 0;
      pointer-events: none;
    }
    .hud-left-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 100%;
      width: min(320px, calc(100vw - 28px));
      pointer-events: none;
    }
    .directory-panel {
      display: flex;
      flex-direction: column;
      max-height: min(56vh, 470px);
      overflow: hidden;
      padding: 12px;
      gap: 8px;
    }
    .directory-panel.is-hidden,
    .password-card.is-hidden {
      display: none;
    }
    .panel-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .panel-close-btn {
      background: transparent;
      border: 1px solid var(--glass-border);
      color: var(--parchment-300);
      border-radius: var(--radius-sm);
      width: 26px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
    }
    .panel-close-btn:hover {
      border-color: var(--brass-400);
      color: var(--parchment-50);
      background: rgba(56, 46, 33, 0.65);
    }
    .hud-input {
      width: 100%;
      background: rgba(12, 11, 10, 0.72);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      color: var(--parchment-50);
      padding: 6px 10px;
      font-family: var(--font-body);
      font-size: var(--text-sm);
    }
    .hud-input:focus {
      outline: none;
      border-color: var(--brass-300);
      box-shadow: 0 0 0 2px rgba(212, 175, 90, 0.2);
    }
    .directory-list {
      overflow-y: auto;
      padding-right: 4px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .directory-list::-webkit-scrollbar {
      width: 5px;
    }
    .directory-list::-webkit-scrollbar-thumb {
      background: rgba(212, 175, 90, 0.35);
      border-radius: var(--radius-pill);
    }
    .dir-cat-title {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.11em;
      color: var(--brass-400);
      margin: 0 0 4px;
      padding-bottom: 2px;
      border-bottom: 1px solid rgba(212, 175, 90, 0.16);
    }
    .dir-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dir-item-btn {
      width: 100%;
      text-align: left;
      background: rgba(25, 22, 18, 0.64);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      padding: 6px 8px;
      color: var(--parchment-100);
      font-size: var(--text-xs);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      transition: background var(--transition-fast), border-color var(--transition-fast);
    }
    .dir-item-btn:hover {
      background: rgba(56, 46, 33, 0.72);
      border-color: var(--glass-border);
    }
    .dir-item-btn.is-selected {
      background: linear-gradient(135deg, rgba(178, 139, 57, 0.3), rgba(127, 96, 34, 0.35));
      border-color: var(--brass-300);
      color: var(--brass-300);
    }
    .dir-item-btn.is-era-absent {
      opacity: 0.58;
    }
    .dir-era-tag {
      font-size: 0.64rem;
      padding: 1px 5px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--glass-border);
      color: var(--parchment-300);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .password-card {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pwd-form {
      display: flex;
      gap: 6px;
    }
    .pwd-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .pwd-chip {
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--glass-border);
      background: rgba(34, 29, 23, 0.85);
      color: var(--parchment-200);
      font-size: 0.72rem;
      cursor: pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }
    .pwd-chip:hover {
      border-color: var(--brass-300);
      background: rgba(74, 58, 36, 0.85);
      color: var(--parchment-50);
    }
    .pwd-feedback {
      font-size: var(--text-xs);
      line-height: 1.38;
      padding: 6px 8px;
      border-radius: var(--radius-sm);
      border-left: 2px solid var(--brass-400);
      background: rgba(12, 11, 10, 0.55);
      color: var(--parchment-200);
    }
    .pwd-feedback.is-accepted {
      border-left-color: #79b473;
      color: #d8f2d4;
    }
    .pwd-feedback.is-rejected {
      border-left-color: var(--crimson-400);
      color: #f4c6c2;
    }
    .hud-bottom-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    }
    .hud-status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      min-height: 24px;
      pointer-events: none;
    }
    .era-bar {
      width: min(980px, 100%);
      padding: 9px 14px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .era-pills-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .era-pill {
      padding: 0.34rem 0.72rem;
      font-size: var(--text-xs);
      border-radius: var(--radius-pill);
    }
    .era-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px 12px;
      font-size: var(--text-xs);
      color: var(--parchment-200);
    }
    .era-title-text {
      font-family: var(--font-display);
      font-size: var(--text-sm);
      color: var(--brass-300);
      font-weight: 600;
    }
    .era-citation-pill {
      color: var(--parchment-400);
      font-size: 0.72rem;
    }
    .era-excerpt-line {
      margin: 0;
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-xs);
      color: var(--parchment-200);
      line-height: 1.4;
    }
    .era-scope-note {
      margin: 0;
      font-size: 0.7rem;
      color: var(--parchment-400);
    }
    .inspector-card {
      max-height: calc(100vh - 220px);
    }
    @media (min-width: 769px) {
      #inspector-root {
        padding: 76px 16px 138px;
      }
    }
    .inspector-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .inspector-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin: 6px 0 10px;
    }
    .canon-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      font-size: 0.68rem;
      border: 1px solid var(--glass-border);
      background: rgba(15, 13, 11, 0.62);
      color: var(--parchment-200);
    }
    .canon-badge.is-gold {
      border-color: var(--brass-400);
      color: var(--brass-300);
    }
    .canon-badge.is-warn {
      border-color: rgba(196, 67, 55, 0.65);
      background: rgba(153, 42, 32, 0.25);
      color: #f6c4be;
    }
    .inspector-section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(212, 175, 90, 0.16);
    }
    .inspector-section h3 {
      margin: 0 0 6px;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--brass-300);
    }
    .inspector-list {
      margin: 0;
      padding-left: 16px;
      font-size: var(--text-xs);
      color: var(--parchment-100);
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .bridging-box {
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background: rgba(12, 11, 10, 0.5);
      border: 1px dashed rgba(212, 175, 90, 0.3);
      font-size: var(--text-xs);
      color: var(--parchment-300);
      line-height: 1.45;
    }
    .inspector-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .segmented-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    .segmented-btn {
      padding: 3px 9px;
      font-size: 0.72rem;
    }
    .action-feedback {
      margin-top: 8px;
      font-size: var(--text-xs);
      color: var(--brass-300);
      min-height: 16px;
    }
    .quote-cite {
      display: block;
      margin-top: 5px;
      font-style: normal;
      font-family: var(--font-body);
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--brass-300);
    }
    .portrait-mini-card {
      padding: 7px 9px;
      border-radius: var(--radius-sm);
      background: rgba(12, 11, 10, 0.48);
      border: 1px solid rgba(212, 175, 90, 0.16);
      font-size: var(--text-xs);
      margin-bottom: 6px;
    }
    .portrait-mini-card strong {
      color: var(--brass-300);
    }
    .modal-dialog-wide {
      width: min(860px, 100%);
    }
    .modal-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 10px;
    }
    .ledger-entry {
      padding: 12px 14px;
      border-radius: var(--radius-md);
      background: rgba(12, 11, 10, 0.5);
      border: 1px solid rgba(212, 175, 90, 0.2);
      margin-bottom: 10px;
    }
    .ledger-entry blockquote {
      margin: 6px 0;
      padding: 6px 10px;
      border-left: 2px solid var(--brass-400);
      background: rgba(24, 21, 18, 0.65);
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-xs);
      color: var(--parchment-200);
    }
    .exclusion-card {
      padding: 12px 14px;
      border-radius: var(--radius-md);
      background: rgba(28, 16, 15, 0.52);
      border: 1px solid rgba(196, 67, 55, 0.42);
      margin-bottom: 10px;
    }
    .exclusion-title {
      font-family: var(--font-display);
      color: #f4b8b2;
      font-size: var(--text-sm);
      font-weight: 600;
      margin: 4px 0 6px;
    }
    @media (max-width: 900px) {
      .hud-left-stack {
        width: min(280px, calc(100vw - 24px));
      }
      .era-bar {
        padding: 8px 10px;
      }
    }
  `;
  document.head.appendChild(style);
}

export function initHUD(engine, registry, canonData = {}, controllers = {}, soundscape = null) {
  injectHudStyles();

  const hudRoot = document.getElementById('hud-root');
  const inspectorRoot = document.getElementById('inspector-root');
  const modalRoot = document.getElementById('modal-root');

  if (!hudRoot || !inspectorRoot || !modalRoot) {
    throw new Error('initHUD requires #hud-root, #inspector-root, and #modal-root in the DOM.');
  }

  const CANON_OBJECTS = canonData?.CANON_OBJECTS || {};
  const BOOK_ERAS = Array.isArray(canonData?.BOOK_ERAS) ? canonData.BOOK_ERAS : [];
  const PASSWORDS = Array.isArray(canonData?.PASSWORDS) ? canonData.PASSWORDS : [];
  const NAMED_PORTRAITS = Array.isArray(canonData?.NAMED_PORTRAITS) ? canonData.NAMED_PORTRAITS : [];
  const FILM_ONLY_EXCLUSIONS = Array.isArray(canonData?.FILM_ONLY_EXCLUSIONS)
    ? canonData.FILM_ONLY_EXCLUSIONS
    : [];

  const passwordLookup = buildPasswordLookup(PASSWORDS);
  const eraMap = new Map(BOOK_ERAS.map((e) => [e.id, e]));

  const state = {
    currentEra: engine?.getEra?.() || registry?.getCurrentEra?.() || BOOK_ERAS[0]?.id || 'cos',
    selectedId: null,
    hoveredEntry: null,
    activeCameraPreset: 'overview',
    directoryOpen: false,
    directoryFilter: '',
    passwordPromptOpen: false,
    passwordManualPin: false,
    passwordDismissed: false,
    passwordFeedback: null,
    auditModalOpen: false,
    auditTab: 'ledger',
    auditSearch: '',
    portraitsAwake: false,
    dumbledoreSwung: false,
    actionFeedback: '',
    isApplyingEra: false,
  };

  // --- Root Shell inside #hud-root ---
  hudRoot.innerHTML = '';

  const topWrap = document.createElement('header');
  topWrap.className = 'hud-top-wrap';

  const brandPanel = document.createElement('div');
  brandPanel.className = 'glass-panel hud-brand-compact';
  brandPanel.innerHTML = `
    <h1 class="serif-title">Dumbledore's Office — Strictly Book-Canon 3D</h1>
    <p class="hud-subtitle">
      <span id="hud-canon-count">${Object.keys(CANON_OBJECTS).length} Book-Verified Elements</span>
      <span>•</span>
      <span id="hud-mode-badge">Orbit Camera</span>
    </p>
  `;

  const toolbar = document.createElement('nav');
  toolbar.className = 'glass-panel hud-toolbar';
  toolbar.setAttribute('aria-label', 'Camera and View Controls');

  // Camera View Presets Dropdown
  const selectWrap = document.createElement('div');
  selectWrap.className = 'hud-select-wrap';
  const selectLabel = document.createElement('label');
  selectLabel.className = 'hud-select-label';
  selectLabel.htmlFor = 'hud-camera-preset';
  selectLabel.textContent = 'View';

  const cameraSelect = document.createElement('select');
  cameraSelect.id = 'hud-camera-preset';
  cameraSelect.className = 'hud-select';
  cameraSelect.setAttribute('aria-label', 'Camera View Presets');
  for (const item of CAMERA_PRESET_ITEMS) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.label;
    cameraSelect.appendChild(opt);
  }
  selectWrap.append(selectLabel, cameraSelect);

  // Graphics Quality Dropdown (Fast | Balanced | Ultra)
  const qualityWrap = document.createElement('div');
  qualityWrap.className = 'hud-select-wrap';
  const qualityLabel = document.createElement('label');
  qualityLabel.className = 'hud-select-label';
  qualityLabel.htmlFor = 'hud-quality-preset';
  qualityLabel.textContent = 'Quality';

  const qualitySelect = document.createElement('select');
  qualitySelect.id = 'hud-quality-preset';
  qualitySelect.className = 'hud-select';
  qualitySelect.setAttribute('aria-label', 'Graphics Quality Preset');
  for (const qItem of [
    { id: 'performance', label: 'Fast' },
    { id: 'balanced', label: 'Balanced' },
    { id: 'ultra', label: 'Ultra' },
  ]) {
    const opt = document.createElement('option');
    opt.value = qItem.id;
    opt.textContent = qItem.label;
    qualitySelect.appendChild(opt);
  }
  qualitySelect.value = engine?.getQuality?.() || 'balanced';
  qualityWrap.append(qualityLabel, qualitySelect);

  const cutawayBtn = document.createElement('button');
  cutawayBtn.type = 'button';
  cutawayBtn.className = 'brass-btn';
  cutawayBtn.textContent = 'Wall Cutaway';

  const walkBtn = document.createElement('button');
  walkBtn.type = 'button';
  walkBtn.className = 'brass-btn';
  walkBtn.textContent = 'First-Person (WASD)';

  const soundBtn = document.createElement('button');
  soundBtn.type = 'button';
  soundBtn.className = 'brass-btn';
  soundBtn.textContent = 'Soundscape';

  const directoryBtn = document.createElement('button');
  directoryBtn.type = 'button';
  directoryBtn.className = 'brass-btn';
  directoryBtn.textContent = 'Directory';

  const auditBtn = document.createElement('button');
  auditBtn.type = 'button';
  auditBtn.className = 'brass-btn';
  auditBtn.textContent = 'Canon Purity Audit';

  toolbar.append(selectWrap, qualityWrap, cutawayBtn, walkBtn, soundBtn, directoryBtn, auditBtn);
  topWrap.append(brandPanel, toolbar);

  // Middle Row (Left Collapsible Directory + Gargoyle Password Card, keeping center open)
  const middleWrap = document.createElement('div');
  middleWrap.className = 'hud-middle';

  const leftStack = document.createElement('div');
  leftStack.className = 'hud-left-stack';

  const directoryPanel = document.createElement('section');
  directoryPanel.className = 'glass-panel directory-panel is-hidden';
  directoryPanel.setAttribute('aria-label', 'Book-Canon Object Directory');

  const passwordCard = document.createElement('section');
  passwordCard.className = 'parchment-panel password-card is-hidden';
  passwordCard.setAttribute('aria-label', 'Stone Gargoyle Password Prompt');

  leftStack.append(directoryPanel, passwordCard);
  middleWrap.appendChild(leftStack);

  // Bottom Row (Hover Pill + First-Person Hint + Era Selector Bar)
  const bottomWrap = document.createElement('footer');
  bottomWrap.className = 'hud-bottom-wrap';

  const statusRow = document.createElement('div');
  statusRow.className = 'hud-status-row';

  const hoverPill = document.createElement('div');
  hoverPill.className = 'hover-pill';
  hoverPill.style.display = 'none';

  const fpHintPill = document.createElement('div');
  fpHintPill.className = 'hover-pill';
  fpHintPill.style.display = 'none';
  fpHintPill.textContent = 'Walk: WASD / Arrows • Drag to look • Shift to sprint • Esc for Orbit';

  statusRow.append(hoverPill, fpHintPill);

  const eraBar = document.createElement('section');
  eraBar.className = 'glass-panel era-bar';
  eraBar.setAttribute('aria-label', 'Book Era Selector');

  bottomWrap.append(statusRow, eraBar);
  hudRoot.append(topWrap, middleWrap, bottomWrap);

  // --- Action Dispatcher & Audio Sync ---
  function playAudioForAction(canonId, actionId) {
    if (!soundscape) return;
    if (canonId === 'stone-gargoyle' || canonId === 'spiral-staircase' || actionId === 'swing-portrait') {
      soundscape.playStoneGrind?.();
    } else if (canonId === 'oak-door-knocker' || actionId === 'knock-door' || actionId === 'toggle-door') {
      soundscape.playOakDoorCreak?.();
    } else if (canonId === 'pensieve' || canonId === 'memory-phials' || actionId === 'peer-pensieve' || actionId === 'move-pensieve' || actionId === 'pour-memory') {
      soundscape.playPensieveShimmer?.();
    } else if (canonId === 'fawkes-perch' || actionId === 'burning-day') {
      soundscape.playPhoenixChime?.();
    } else if (canonId === 'smoke-serpent-instrument' || canonId === 'silver-instruments' || actionId === 'tap-instrument' || actionId === 'pulse-smoke') {
      soundscape.playSerpentHiss?.();
    } else if (canonId === 'sorting-hat' || actionId === 'speak-hat') {
      soundscape.playHatRustle?.();
    }
  }

  function invokeControllerFallback(canonId, actionId) {
    const arch = controllers?.architecture;
    const furn = controllers?.furniture;
    const art = controllers?.artifacts;

    if (canonId === 'fawkes-perch' && actionId === 'burning-day') {
      return art?.cycleFawkesMode?.() ?? 'Cycled Fawkes Burning Day state';
    }
    if (canonId === 'smoke-serpent-instrument' && actionId === 'tap-instrument') {
      return art?.triggerSmokeSerpent?.() ?? 'Pale-green smoke serpent divided into two';
    }
    if (canonId === 'pensieve' && actionId === 'move-pensieve') {
      return art?.togglePensieveLocation?.() ?? 'Toggled Pensieve between black cabinet and desk';
    }
    if (canonId === 'pensieve' && actionId === 'peer-pensieve') {
      engine?.focusObject?.('pensieve', 750);
      return 'Peering into the silvery Pensieve basin';
    }
    if (canonId === 'sorting-hat' && actionId === 'speak-hat') {
      return art?.toggleHatFlex?.() ?? 'Sorting Hat mouth flexed';
    }
    if (canonId === 'black-cabinet' && actionId === 'toggle-cabinet') {
      state.cabinetCycle = state.cabinetCycle === 'ajar' ? 'open' : state.cabinetCycle === 'open' ? 'closed' : 'ajar';
      return arch?.setCabinetState?.(state.cabinetCycle) ?? `Black cabinet set to ${state.cabinetCycle}`;
    }
    if (canonId === 'fireplace' && actionId === 'floo-flare') {
      return arch?.triggerFlooFlash?.() ?? 'Emerald-green Floo flames flared in the hearth';
    }
    if (canonId === 'portraits' && actionId === 'wake-portraits') {
      state.portraitsAwake = !state.portraitsAwake;
      return furn?.setPortraitsAwake?.(state.portraitsAwake) ?? (state.portraitsAwake ? 'Portraits awakened' : 'Portraits snoozing');
    }
    if (canonId === 'dumbledore-portrait' && actionId === 'swing-portrait') {
      state.dumbledoreSwung = !state.dumbledoreSwung;
      furn?.setDumbledorePortraitSwing?.(state.dumbledoreSwung);
      arch?.setSwordCavityOpen?.(state.dumbledoreSwung);
      return state.dumbledoreSwung ? 'Portrait swung open to expose hidden cavity' : 'Portrait closed';
    }
    if (canonId === 'dumbledore-portrait' && actionId === 'wake-dumbledore') {
      state.portraitsAwake = !state.portraitsAwake;
      return furn?.setPortraitsAwake?.(state.portraitsAwake) ?? 'Toggled Dumbledore portrait state';
    }
    if (canonId === 'gryffindor-sword-case' && actionId === 'inspect-sword') {
      engine?.focusObject?.('gryffindor-sword-case', 750);
      return 'Focused Sword of Gryffindor in glass case';
    }
    if (canonId === 'circular-room' && actionId === 'overview') {
      applyCameraPreset('overview');
      return 'Camera moved to room overview';
    }
    if (actionId === 'inspect' || actionId.startsWith('inspect-') || actionId === 'look-out-window' || actionId === 'sit-view') {
      engine?.focusObject?.(canonId, 750);
      return 'Camera focused on selected element';
    }
    return null;
  }

  function runObjectAction(canonId, actionId, label) {
    if (canonId === 'stone-gargoyle' && actionId === 'speak-password') {
      state.passwordDismissed = false;
      state.passwordManualPin = true;
      state.passwordPromptOpen = true;
      renderPasswordCard();
      if (state.activeCameraPreset !== 'entrance') {
        applyCameraPreset('entrance');
      }
      const input = passwordCard.querySelector('#gargoyle-password-input');
      if (input) input.focus();
      state.actionFeedback = 'Speak or select a book-canon password below.';
      renderInspector();
      return;
    }

    playAudioForAction(canonId, actionId);

    const entry = registry?.get?.(canonId);
    let result = null;
    if (entry && typeof entry.interact === 'function') {
      result = registry.triggerInteract(canonId, actionId, {
        engine,
        controllers,
        soundscape,
        era: state.currentEra,
      });
      if (result === false || (result && result.handled === false)) {
        result = invokeControllerFallback(canonId, actionId);
      }
    } else {
      result = invokeControllerFallback(canonId, actionId);
    }

    if (typeof result === 'string') {
      state.actionFeedback = result;
    } else if (result && typeof result.message === 'string') {
      state.actionFeedback = result.message;
    } else if (result && typeof result === 'object') {
      if (canonId === 'dumbledore-portrait' && typeof result.open === 'boolean') {
        state.dumbledoreSwung = result.open;
        controllers?.architecture?.setSwordCavityOpen?.(result.open);
        state.actionFeedback = result.open
          ? 'Dumbledore portrait swung forward — hidden wall cavity revealed.'
          : 'Dumbledore portrait returned flush over the cavity.';
      } else if (canonId === 'portraits' && typeof result.awake === 'boolean') {
        state.portraitsAwake = result.awake;
        state.actionFeedback = result.awake
          ? 'Headmaster portraits awakened in their frames.'
          : 'Headmaster portraits returned to gentle snoozing.';
      } else if (typeof result.quote === 'string') {
        state.actionFeedback = `“${result.quote}”`;
      } else if (typeof result.fawkesMode === 'string') {
        state.actionFeedback = `Fawkes state: ${result.fawkesMode}`;
      } else if (typeof result.location === 'string') {
        state.actionFeedback = `Pensieve moved to: ${result.location}`;
      } else if (result.peering) {
        engine?.focusObject?.('pensieve', 750);
        state.actionFeedback = 'Peering into the bright swirling silvery substance…';
      } else if (typeof result.swordInCavity === 'boolean') {
        state.actionFeedback = result.swordInCavity
          ? 'Real Sword of Gryffindor concealed in cavity; replica inside glass case.'
          : 'Sword displayed inside the glass case.';
      } else if (typeof result.awake === 'boolean') {
        state.actionFeedback = result.awake ? 'Portrait awakened.' : 'Portrait slumbering peacefully.';
      } else {
        state.actionFeedback = `Activated: ${label || actionId}`;
      }
    } else {
      state.actionFeedback = `Activated: ${label || actionId}`;
    }
    renderInspector();
  }

  // --- Camera Preset Switching ---
  function applyCameraPreset(presetId) {
    const cfg = CAMERA_PRESET_ITEMS.find((p) => p.id === presetId) || CAMERA_PRESET_ITEMS[0];
    state.activeCameraPreset = cfg.id;
    cameraSelect.value = cfg.id;

    if (cfg.id === 'entrance') {
      state.passwordDismissed = false;
    } else {
      state.passwordManualPin = false;
    }

    if (engine && typeof engine.setCameraPreset === 'function') {
      let res = engine.setCameraPreset(cfg.id, 850);
      if (!res?.ok && cfg.altId) {
        res = engine.setCameraPreset(cfg.altId, 850);
      }
      if (!res?.ok && cfg.fallbackCanonId) {
        engine.focusObject?.(cfg.fallbackCanonId, 850);
      }
    }

    syncTopControls();
    updatePasswordPromptVisibility();
  }

  // --- Era Switching ---
  function syncEraUI(eraId) {
    state.currentEra = eraId;
    renderEraBar();
    renderDirectory();
    if (state.selectedId) {
      renderInspector();
    }
    if (state.passwordPromptOpen) {
      renderPasswordCard();
    }
  }

  function applyEra(eraId) {
    if (!eraMap.has(eraId)) return;
    state.isApplyingEra = true;
    try {
      state.currentEra = eraId;
      if (engine && typeof engine.applyEraLighting === 'function') {
        engine.applyEraLighting(eraId);
      } else {
        registry?.applyEra?.(eraId);
      }
      controllers?.architecture?.applyEra?.(eraId);
      controllers?.furniture?.applyEra?.(eraId);
      controllers?.artifacts?.applyEra?.(eraId);
      soundscape?.setFireplaceLit?.(true);
      syncEraUI(eraId);
    } finally {
      state.isApplyingEra = false;
    }
  }

  // --- Top Controls Sync ---
  function syncTopControls() {
    if (engine?.getQuality) {
      qualitySelect.value = engine.getQuality();
    }
    const cutaway = engine?.isCutawayEnabled ? engine.isCutawayEnabled() : true;
    cutawayBtn.classList.toggle('is-active', Boolean(cutaway));
    cutawayBtn.setAttribute('aria-pressed', String(Boolean(cutaway)));

    const isFp = engine?.getMode ? engine.getMode() === 'first-person' : false;
    walkBtn.classList.toggle('is-active', isFp);
    walkBtn.setAttribute('aria-pressed', String(isFp));
    fpHintPill.style.display = isFp ? 'block' : 'none';

    const modeBadge = document.getElementById('hud-mode-badge');
    if (modeBadge) {
      modeBadge.textContent = isFp ? 'First-Person Walk' : 'Orbit Camera';
    }

    const soundOn = soundscape?.isEnabled ? soundscape.isEnabled() : false;
    soundBtn.classList.toggle('is-active', soundOn);
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.textContent = soundOn ? 'Soundscape: On' : 'Soundscape';

    directoryBtn.classList.toggle('is-active', state.directoryOpen);
    directoryBtn.setAttribute('aria-expanded', String(state.directoryOpen));
  }

  // --- Password Prompt Card ---
  function updatePasswordPromptVisibility() {
    const byContext =
      state.activeCameraPreset === 'entrance' ||
      state.selectedId === 'stone-gargoyle' ||
      state.selectedId === 'spiral-staircase';

    const shouldShow = !state.passwordDismissed && (byContext || state.passwordManualPin);
    state.passwordPromptOpen = shouldShow;
    renderPasswordCard();
  }

  function submitGargoylePassword(rawInput) {
    const normalized = normalizePassword(rawInput);
    if (!normalized) {
      state.passwordFeedback = {
        type: 'rejected',
        text: 'The ugly stone gargoyle awaits a spoken password (e.g., "Sherbet lemon", "Cockroach Cluster", or "Acid Pops").',
      };
      renderPasswordCard();
      return;
    }

    const matched = passwordLookup.acceptedMap.get(normalized);
    if (matched) {
      soundscape?.playStoneGrind?.();
      if (typeof controllers?.architecture?.triggerEntranceSequence === 'function') {
        controllers.architecture.triggerEntranceSequence(matched.label);
      } else {
        registry?.triggerInteract?.('stone-gargoyle', 'speak-password', { password: matched.label });
      }
      state.passwordFeedback = {
        type: 'accepted',
        text: `"${matched.label}!" — ${matched.row.book}, ${matched.row.chapter} (${matched.row.speaker}). The stone gargoyle springs aside as the wall splits in two!`,
      };
      renderPasswordCard();
      return;
    }

    if (passwordLookup.rejectedSet.has(normalized)) {
      state.passwordFeedback = {
        type: 'rejected',
        text: `"${rawInput.trim()}" — The stone gargoyle stays completely immobile, just as in Goblet of Fire Ch. 28–30 when Harry shouted sweets in vain before trying "Cockroach Cluster".`,
      };
      renderPasswordCard();
      return;
    }

    state.passwordFeedback = {
      type: 'rejected',
      text: `"${rawInput.trim()}" — Nothing happens (CoS Ch. 11 / GoF Ch. 28–30). Try a verified book password chip below.`,
    };
    renderPasswordCard();
  }

  function renderPasswordCard() {
    passwordCard.classList.toggle('is-hidden', !state.passwordPromptOpen);
    if (!state.passwordPromptOpen) {
      passwordCard.innerHTML = '';
      return;
    }

    const isDh = state.currentEra === 'dh';
    const dhNote = isDh && passwordLookup.dhNoPasswordRow
      ? `<p class="era-scope-note" style="margin:0;color:var(--brass-300);">${escapeHtml(passwordLookup.dhNoPasswordRow.notes)} (${escapeHtml(passwordLookup.dhNoPasswordRow.book)} ${escapeHtml(passwordLookup.dhNoPasswordRow.chapter)})</p>`
      : '';

    const chipsHtml = passwordLookup.chips
      .map(
        (c) =>
          `<button type="button" class="pwd-chip" data-pwd="${escapeHtml(c.value)}" title="${escapeHtml(c.title)}">${escapeHtml(c.value)}</button>`
      )
      .join('');

    const dhBtnHtml = isDh
      ? `<button type="button" class="pwd-chip" data-dh-ask="true" title="Deathly Hallows Ch. 36">"Can we go up?" (DH Ch. 36)</button>`
      : '';

    const feedbackHtml = state.passwordFeedback
      ? `<div class="pwd-feedback is-${escapeHtml(state.passwordFeedback.type)}">${escapeHtml(state.passwordFeedback.text)}</div>`
      : '';

    passwordCard.innerHTML = `
      <div class="panel-header-row">
        <div>
          <div class="muted-label">Corridor Gate · Books 2–7</div>
          <h2 class="serif-title" style="font-size:var(--text-base);">Stone Gargoyle Password</h2>
        </div>
        <button type="button" class="panel-close-btn" id="pwd-close-btn" aria-label="Close Password Prompt">×</button>
      </div>
      ${dhNote}
      <form class="pwd-form" id="gargoyle-password-form">
        <input
          id="gargoyle-password-input"
          class="hud-input"
          type="text"
          autocomplete="off"
          placeholder="Speak a book password..."
          aria-label="Gargoyle password input"
        />
        <button type="submit" class="brass-btn">Speak</button>
      </form>
      <div class="pwd-chips" aria-label="Verified book-canon passwords">
        ${chipsHtml}
        ${dhBtnHtml}
      </div>
      ${feedbackHtml}
    `;

    passwordCard.querySelector('#pwd-close-btn')?.addEventListener('click', () => {
      state.passwordDismissed = true;
      state.passwordManualPin = false;
      state.passwordPromptOpen = false;
      renderPasswordCard();
    });

    const form = passwordCard.querySelector('#gargoyle-password-form');
    const input = passwordCard.querySelector('#gargoyle-password-input');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      submitGargoylePassword(input?.value || '');
    });

    passwordCard.querySelectorAll('[data-pwd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pwd = btn.getAttribute('data-pwd') || '';
        if (input) input.value = pwd;
        submitGargoylePassword(pwd);
      });
    });

    passwordCard.querySelector('[data-dh-ask]')?.addEventListener('click', () => {
      soundscape?.playStoneGrind?.();
      controllers?.architecture?.setGargoyleState?.('lopsided');
      controllers?.architecture?.triggerEntranceSequence?.('Feel free');
      state.passwordFeedback = {
        type: 'accepted',
        text: '“Can we go up?” he asked the gargoyle. “Feel free,” groaned the statue. (Deathly Hallows, Ch. 36)',
      };
      renderPasswordCard();
    });
  }

  // --- Left-Side Collapsible Object Directory ---
  function buildDirectoryGroupsHtml() {
    const allObjects = Object.values(CANON_OBJECTS);
    const filterTerm = state.directoryFilter.trim().toLowerCase();

    const grouped = new Map();
    for (const cat of CATEGORY_ORDER) grouped.set(cat, []);

    for (const obj of allObjects) {
      const hay = `${obj.name} ${obj.category} ${(obj.books || []).join(' ')}`.toLowerCase();
      if (filterTerm && !hay.includes(filterTerm)) continue;
      if (!grouped.has(obj.category)) grouped.set(obj.category, []);
      grouped.get(obj.category).push(obj);
    }

    let groupsHtml = '';
    for (const [cat, items] of grouped.entries()) {
      if (!items.length) continue;
      const catTitle = CATEGORY_LABELS[cat] || cat;
      const buttonsHtml = items
        .map((obj) => {
          const isSelected = state.selectedId === obj.id;
          const visibleInEra = !Array.isArray(obj.erasVisible) || obj.erasVisible.includes(state.currentEra);
          const eraHint = !visibleInEra && Array.isArray(obj.erasVisible)
            ? `<span class="dir-era-tag">${escapeHtml(obj.erasVisible.map((e) => e.toUpperCase()).join('/'))}</span>`
            : '';
          return `
            <button
              type="button"
              class="dir-item-btn${isSelected ? ' is-selected' : ''}${visibleInEra ? '' : ' is-era-absent'}"
              data-dir-id="${escapeHtml(obj.id)}"
            >
              <span>${escapeHtml(obj.name)}</span>
              ${eraHint}
            </button>
          `;
        })
        .join('');

      groupsHtml += `
        <div>
          <h3 class="dir-cat-title">${escapeHtml(catTitle)} (${items.length})</h3>
          <div class="dir-items">${buttonsHtml}</div>
        </div>
      `;
    }

    return groupsHtml || `<p class="muted-label" style="margin:8px 0;">No matching canon objects.</p>`;
  }

  function bindDirectoryListEvents(listEl) {
    listEl?.querySelectorAll('[data-dir-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dir-id');
        if (!id) return;
        const selectedViaEngine = engine?.selectObject?.(id, { focus: true, durationMs: 850 });
        if (!selectedViaEngine) {
          openInspector(id);
        }
      });
    });
  }

  function renderDirectory() {
    directoryPanel.classList.toggle('is-hidden', !state.directoryOpen);
    if (!state.directoryOpen) {
      directoryPanel.innerHTML = '';
      return;
    }

    const totalCount = Object.keys(CANON_OBJECTS).length;
    const existingList = directoryPanel.querySelector('.directory-list');
    if (existingList) {
      existingList.innerHTML = buildDirectoryGroupsHtml();
      bindDirectoryListEvents(existingList);
      return;
    }

    directoryPanel.innerHTML = `
      <div class="panel-header-row">
        <div>
          <div class="muted-label">Book-Canon Index</div>
          <h2 class="serif-title" style="font-size:var(--text-base);">Object Directory (${totalCount})</h2>
        </div>
        <button type="button" class="panel-close-btn" id="dir-close-btn" aria-label="Collapse Directory">×</button>
      </div>
      <input
        id="dir-filter-input"
        class="hud-input"
        type="search"
        value="${escapeHtml(state.directoryFilter)}"
        placeholder="Filter ${totalCount} canon objects..."
        aria-label="Filter canon object directory"
      />
      <div class="directory-list">${buildDirectoryGroupsHtml()}</div>
    `;

    directoryPanel.querySelector('#dir-close-btn')?.addEventListener('click', () => {
      state.directoryOpen = false;
      syncTopControls();
      renderDirectory();
    });

    const filterInput = directoryPanel.querySelector('#dir-filter-input');
    filterInput?.addEventListener('input', (e) => {
      state.directoryFilter = e.target.value;
      const listEl = directoryPanel.querySelector('.directory-list');
      if (listEl) {
        listEl.innerHTML = buildDirectoryGroupsHtml();
        bindDirectoryListEvents(listEl);
      }
    });

    bindDirectoryListEvents(directoryPanel.querySelector('.directory-list'));
  }

  // --- Bottom Era Selector Bar ---
  function renderEraBar() {
    if (!BOOK_ERAS.length) {
      eraBar.innerHTML = '';
      return;
    }

    const activeEra = eraMap.get(state.currentEra) || BOOK_ERAS[0];
    const pillsHtml = BOOK_ERAS.map((era) => {
      const isActive = era.id === activeEra.id;
      const shortLabel = ERA_SHORT_LABELS[era.id] || era.id.toUpperCase();
      return `
        <button
          type="button"
          class="brass-btn era-pill${isActive ? ' is-active' : ''}"
          data-era-id="${escapeHtml(era.id)}"
          aria-pressed="${isActive}"
          title="${escapeHtml(era.label)} — ${escapeHtml(era.timeOfDay)}"
        >
          ${escapeHtml(shortLabel)}
        </button>
      `;
    }).join('');

    const scopeNoteHtml = activeEra.chapterScopeNote
      ? `<p class="era-scope-note">${escapeHtml(activeEra.chapterScopeNote)}</p>`
      : '';

    eraBar.innerHTML = `
      <div class="era-pills-row" role="tablist" aria-label="Book Era Presets">
        <span class="muted-label" style="margin-right:4px;">Canon Era</span>
        ${pillsHtml}
      </div>
      <div class="era-meta-row">
        <span class="era-title-text">${escapeHtml(activeEra.title)}</span>
        <span>${escapeHtml(activeEra.book)} (${escapeHtml(activeEra.chapter)})</span>
        <span class="era-citation-pill">• ${escapeHtml(activeEra.timeOfDay)}</span>
      </div>
      <blockquote class="era-excerpt-line">
        “${escapeHtml(activeEra.summaryQuote)}”
        <span class="era-citation-pill">— ${escapeHtml(activeEra.quoteCitation)}</span>
      </blockquote>
      ${scopeNoteHtml}
    `;

    eraBar.querySelectorAll('[data-era-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const eraId = btn.getAttribute('data-era-id');
        if (eraId) applyEra(eraId);
      });
    });
  }

  // --- Right-Side Canon Provenance Inspector Drawer ---
  function buildExtraControllerControls(canonId) {
    const arch = controllers?.architecture;
    const furn = controllers?.furniture;
    const art = controllers?.artifacts;

    if (canonId === 'black-cabinet') {
      return `
        <div class="segmented-row" aria-label="Black Cabinet Door State">
          <button type="button" class="brass-btn segmented-btn" data-ctrl-cabinet="closed">Closed</button>
          <button type="button" class="brass-btn segmented-btn" data-ctrl-cabinet="ajar">Ajar (GoF Sliver)</button>
          <button type="button" class="brass-btn segmented-btn" data-ctrl-cabinet="open">Open</button>
        </div>
      `;
    }
    if (canonId === 'stone-gargoyle') {
      return `
        <div class="segmented-row" aria-label="Stone Gargoyle Position">
          <button type="button" class="brass-btn segmented-btn" data-ctrl-gargoyle="guard">Guard</button>
          <button type="button" class="brass-btn segmented-btn" data-ctrl-gargoyle="aside">Aside (Unlocked)</button>
          <button type="button" class="brass-btn segmented-btn" data-ctrl-gargoyle="lopsided">Lopsided (DH Ch. 36)</button>
        </div>
      `;
    }
    if (canonId === 'gryffindor-sword-case' && typeof art?.toggleSwordSecret === 'function') {
      return `
        <div class="segmented-row" aria-label="Real vs Replica Sword State">
          <button type="button" class="brass-btn segmented-btn" data-ctrl-sword="false">Sword Visible in Case</button>
          <button type="button" class="brass-btn segmented-btn" data-ctrl-sword="true">Real Sword in Cavity (DH)</button>
        </div>
      `;
    }
    if (canonId === 'dumbledore-portrait' && (furn?.setDumbledorePortraitSwing || arch?.setSwordCavityOpen)) {
      return `
        <div class="segmented-row" aria-label="Portrait Cavity Controls">
          <button type="button" class="brass-btn segmented-btn" data-ctrl-cavity="true">Open Hidden Cavity</button>
          <button type="button" class="brass-btn segmented-btn" data-ctrl-cavity="false">Close Portrait Frame</button>
        </div>
      `;
    }
    return '';
  }

  function renderInspector() {
    const id = state.selectedId;
    if (!id) {
      inspectorRoot.innerHTML = '';
      return;
    }

    const canonObj = CANON_OBJECTS[id];
    const regEntry = registry?.get?.(id);

    if (!canonObj && !regEntry) {
      inspectorRoot.innerHTML = '';
      return;
    }

    const name = canonObj?.name || regEntry?.name || id;
    const category = canonObj?.category || regEntry?.category || 'prop';
    const books = Array.isArray(canonObj?.books) ? canonObj.books : [];
    const quotes = Array.isArray(canonObj?.quotes) ? canonObj.quotes : [];
    const derivedVisuals = Array.isArray(canonObj?.derivedVisuals) ? canonObj.derivedVisuals : [];
    const bridging = canonObj?.minimalStructuralBridging || '';
    const erasVisible = Array.isArray(canonObj?.erasVisible) ? canonObj.erasVisible : [];
    const visibleInCurrentEra = !erasVisible.length || erasVisible.includes(state.currentEra);

    const actions = Array.isArray(canonObj?.actions) ? canonObj.actions : [];

    const booksHtml = books.map((b) => `<span class="canon-badge">${escapeHtml(b)}</span>`).join('');
    const erasHtml = erasVisible.length
      ? `<span class="canon-badge is-gold">Eras: ${escapeHtml(erasVisible.map((e) => e.toUpperCase()).join(', '))}</span>`
      : '';
    const eraWarningHtml = !visibleInCurrentEra
      ? `<span class="canon-badge is-warn">Hidden in ${escapeHtml(state.currentEra.toUpperCase())} era</span>`
      : '';

    const quotesHtml = quotes.length
      ? quotes
          .map(
            (q) => `
              <blockquote>
                “${escapeHtml(q.text)}”
                <cite class="quote-cite">${escapeHtml(q.book)} — ${escapeHtml(q.chapter)}</cite>
              </blockquote>
            `
          )
          .join('')
      : `<p class="muted-label">No verbatim excerpt attached.</p>`;

    const derivedHtml = derivedVisuals.length
      ? `<ul class="inspector-list">${derivedVisuals.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`
      : `<p class="muted-label">None listed.</p>`;

    const bridgingHtml = bridging
      ? `<div class="bridging-box">${escapeHtml(bridging)}</div>`
      : '';

    const actionsHtml = actions
      .map(
        (act) =>
          `<button type="button" class="brass-btn" data-action-id="${escapeHtml(act.id)}">${escapeHtml(act.label)}</button>`
      )
      .join('');

    const extraControlsHtml = buildExtraControllerControls(id);

    let portraitsSectionHtml = '';
    if ((id === 'portraits' || id === 'dumbledore-portrait') && NAMED_PORTRAITS.length) {
      const relevant = id === 'dumbledore-portrait'
        ? NAMED_PORTRAITS.filter((p) => p.id === 'portrait-albus-dumbledore')
        : NAMED_PORTRAITS;
      const cards = relevant
        .map(
          (p) => `
            <div class="portrait-mini-card">
              <strong>${escapeHtml(p.name)}</strong>
              <span class="era-citation-pill"> (${escapeHtml(p.bookFirstAppears)})</span>
              <div>${escapeHtml(p.appearance)}</div>
            </div>
          `
        )
        .join('');
      portraitsSectionHtml = `
        <div class="inspector-section">
          <h3>Named Portraits in Novels</h3>
          ${cards}
        </div>
      `;
    }

    inspectorRoot.innerHTML = `
      <article class="parchment-panel inspector-card" aria-label="Canon Provenance Inspector">
        <div class="inspector-header">
          <div>
            <div class="muted-label">${escapeHtml(CATEGORY_LABELS[category] || category)}</div>
            <h2 class="serif-title" style="font-size:var(--text-lg);margin-top:2px;">${escapeHtml(name)}</h2>
          </div>
          <button type="button" class="panel-close-btn" id="inspector-close-btn" aria-label="Close Inspector">×</button>
        </div>

        <div class="inspector-badges">
          ${erasHtml}
          ${eraWarningHtml}
          ${booksHtml}
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="brass-btn" id="inspector-focus-btn">Focus Camera</button>
        </div>

        <div class="inspector-section">
          <h3>Verbatim Book Canon</h3>
          ${quotesHtml}
        </div>

        ${portraitsSectionHtml}

        <div class="inspector-section">
          <h3>Driven by Book Text</h3>
          ${derivedHtml}
        </div>

        <div class="inspector-section">
          <h3>Minimal Structural Bridging</h3>
          ${bridgingHtml}
        </div>

        <div class="inspector-section">
          <h3>Interactive Controls</h3>
          <div class="inspector-actions">
            ${actionsHtml}
          </div>
          ${extraControlsHtml}
          <div class="action-feedback" aria-live="polite">${escapeHtml(state.actionFeedback)}</div>
        </div>
      </article>
    `;

    inspectorRoot.querySelector('#inspector-close-btn')?.addEventListener('click', closeInspector);

    inspectorRoot.querySelector('#inspector-focus-btn')?.addEventListener('click', () => {
      engine?.focusObject?.(id, 800);
    });

    inspectorRoot.querySelectorAll('[data-action-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const actionId = btn.getAttribute('data-action-id');
        if (actionId) runObjectAction(id, actionId, btn.textContent);
      });
    });

    inspectorRoot.querySelectorAll('[data-ctrl-cabinet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cabState = btn.getAttribute('data-ctrl-cabinet');
        if (!cabState) return;
        if (typeof controllers?.architecture?.setCabinetState === 'function') {
          controllers.architecture.setCabinetState(cabState);
        } else {
          registry?.triggerInteract?.('black-cabinet', cabState, { engine, controllers, soundscape });
        }
        state.actionFeedback = `Black cabinet set to: ${cabState}`;
        renderInspector();
      });
    });

    inspectorRoot.querySelectorAll('[data-ctrl-gargoyle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gMode = btn.getAttribute('data-ctrl-gargoyle');
        if (!gMode) return;
        soundscape?.playStoneGrind?.();
        if (typeof controllers?.architecture?.setGargoyleState === 'function') {
          controllers.architecture.setGargoyleState(gMode);
        } else {
          registry?.triggerInteract?.('stone-gargoyle', gMode, { engine, controllers, soundscape });
        }
        state.actionFeedback = `Stone gargoyle state: ${gMode}`;
        renderInspector();
      });
    });

    inspectorRoot.querySelectorAll('[data-ctrl-sword]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inCavity = btn.getAttribute('data-ctrl-sword') === 'true';
        controllers?.artifacts?.toggleSwordSecret?.(inCavity);
        state.actionFeedback = inCavity
          ? 'Real Sword of Gryffindor concealed in Dumbledore portrait cavity (DH Ch. 33).'
          : 'Sword displayed inside glass case.';
        renderInspector();
      });
    });

    inspectorRoot.querySelectorAll('[data-ctrl-cavity]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('data-ctrl-cavity') === 'true';
        soundscape?.playStoneGrind?.();
        controllers?.furniture?.setDumbledorePortraitSwing?.(open);
        controllers?.architecture?.setSwordCavityOpen?.(open);
        state.dumbledoreSwung = open;
        state.actionFeedback = open
          ? 'Dumbledore portrait swung forward revealing hidden wall cavity.'
          : 'Dumbledore portrait returned flush against the stone pier.';
        renderInspector();
      });
    });
  }

  function openInspector(id) {
    if (!id) {
      closeInspector();
      return;
    }
    state.selectedId = id;
    state.actionFeedback = '';
    if (id === 'stone-gargoyle' || id === 'spiral-staircase') {
      state.passwordDismissed = false;
    } else {
      state.passwordManualPin = false;
      if (state.activeCameraPreset === 'entrance') {
        state.activeCameraPreset = 'custom';
      }
    }
    renderInspector();
    renderDirectory();
    updatePasswordPromptVisibility();
  }

  function closeInspector() {
    state.selectedId = null;
    state.actionFeedback = '';
    if (engine?.selectObject) {
      engine.selectObject(null);
    }
    renderInspector();
    renderDirectory();
    updatePasswordPromptVisibility();
  }

  // --- Canon Purity & Film Exclusions Audit Modal ---
  function buildAuditBodyHtml() {
    const q = state.auditSearch.trim().toLowerCase();

    const ledgerObjects = Object.values(CANON_OBJECTS).filter((obj) => {
      if (!q) return true;
      const hay = `${obj.name} ${obj.id} ${obj.category} ${(obj.books || []).join(' ')} ${(obj.quotes || []).map((x) => `${x.book} ${x.chapter} ${x.text}`).join(' ')} ${obj.minimalStructuralBridging || ''}`.toLowerCase();
      return hay.includes(q);
    });

    const filteredExclusions = FILM_ONLY_EXCLUSIONS.filter((ex) => {
      if (!q) return true;
      const hay = `${ex.filmElement} ${ex.bookReality} ${ex.citation}`.toLowerCase();
      return hay.includes(q);
    });

    if (state.auditTab === 'ledger') {
      const objectCards = ledgerObjects
        .map((obj) => {
          const quotesHtml = (obj.quotes || [])
            .map(
              (qt) => `
                <blockquote>
                  “${escapeHtml(qt.text)}”
                  <cite class="quote-cite">${escapeHtml(qt.book)} — ${escapeHtml(qt.chapter)}</cite>
                </blockquote>
              `
            )
            .join('');
          return `
            <div class="ledger-entry">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;">
                <strong style="color:var(--brass-300);font-family:var(--font-display);font-size:var(--text-base);">${escapeHtml(obj.name)}</strong>
                <span class="canon-badge">${escapeHtml(obj.id)} · ${escapeHtml((obj.erasVisible || []).map((e) => e.toUpperCase()).join('/'))}</span>
              </div>
              <div style="font-size:var(--text-xs);color:var(--parchment-300);margin:4px 0;">
                <strong>Books:</strong> ${escapeHtml((obj.books || []).join(', '))}
              </div>
              ${quotesHtml}
              <div class="bridging-box" style="margin-top:6px;">
                <strong style="color:var(--parchment-100);">Minimal Structural Bridging:</strong> ${escapeHtml(obj.minimalStructuralBridging || '')}
              </div>
            </div>
          `;
        })
        .join('');

      const portraitsHtml = NAMED_PORTRAITS.map(
        (p) => `
          <div class="ledger-entry">
            <strong style="color:var(--brass-300);">${escapeHtml(p.name)}</strong>
            <span class="era-citation-pill"> — ${escapeHtml(p.bookFirstAppears)}</span>
            <p style="margin:4px 0;font-size:var(--text-xs);">${escapeHtml(p.appearance)}</p>
            <ul class="inspector-list">${(p.notableMoments || []).map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
          </div>
        `
      ).join('');

      const passwordsHtml = PASSWORDS.map(
        (pw) => `
          <div class="portrait-mini-card">
            <strong>${escapeHtml(pw.password || 'No password (knocked lopsided)')}</strong>
            ${pw.usEditionVariant ? `<span class="era-citation-pill"> · ${escapeHtml(pw.usEditionVariant)}</span>` : ''}
            <div><span class="canon-badge ${pw.status === 'accepted' ? 'is-gold' : 'is-warn'}">${escapeHtml(pw.status)}</span> ${escapeHtml(pw.book)}, ${escapeHtml(pw.chapter)} — ${escapeHtml(pw.notes)}</div>
          </div>
        `
      ).join('');

      return `
        <h3 class="serif-title" style="font-size:var(--text-base);margin:8px 0;">Modeled Objects & Citation Ledger (${ledgerObjects.length}/${Object.keys(CANON_OBJECTS).length})</h3>
        ${objectCards || '<p class="muted-label">No ledger entries match filter.</p>'}
        <h3 class="serif-title" style="font-size:var(--text-base);margin:14px 0 8px;">Named Headmasters & Headmistresses (${NAMED_PORTRAITS.length})</h3>
        ${portraitsHtml}
        <h3 class="serif-title" style="font-size:var(--text-base);margin:14px 0 8px;">Verified Book Passwords (${PASSWORDS.length})</h3>
        ${passwordsHtml}
      `;
    }

    return `
      <p style="font-size:var(--text-xs);color:var(--parchment-300);margin:0 0 12px;">
        This model strictly implements J.K. Rowling's seven original Harry Potter novels and explicitly rejects film set designs, Pottermore/Wizarding World expansions, video games, and fan conflations.
      </p>
      ${
        filteredExclusions
          .map(
            (ex) => `
              <div class="exclusion-card">
                <span class="canon-badge is-warn">EXCLUDED NON-BOOK ELEMENT</span>
                <div class="exclusion-title">${escapeHtml(ex.filmElement)}</div>
                <p style="margin:0 0 6px;font-size:var(--text-xs);color:var(--parchment-100);line-height:1.48;">
                  <strong style="color:var(--brass-300);">Strict Book Reality:</strong> ${escapeHtml(ex.bookReality)}
                </p>
                <div class="era-citation-pill">Citation: ${escapeHtml(ex.citation)}</div>
              </div>
            `
          )
          .join('') || '<p class="muted-label">No exclusions match filter.</p>'
      }
    `;
  }

  function renderAuditModal() {
    if (!state.auditModalOpen) {
      modalRoot.innerHTML = '';
      return;
    }

    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="audit-modal-backdrop">
        <div class="parchment-panel modal-dialog modal-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
          <div class="panel-header-row">
            <div>
              <div class="muted-label">Books 1–7 Verification Ledger</div>
              <h2 id="audit-modal-title" class="serif-title" style="font-size:var(--text-xl);">Canon Purity & Film Exclusions Audit</h2>
            </div>
            <button type="button" class="panel-close-btn" id="audit-close-btn" aria-label="Close Canon Purity Audit">×</button>
          </div>

          <div class="modal-tabs" role="tablist">
            <button type="button" class="brass-btn${state.auditTab === 'ledger' ? ' is-active' : ''}" data-audit-tab="ledger">
              Complete Citation Ledger (${Object.keys(CANON_OBJECTS).length})
            </button>
            <button type="button" class="brass-btn${state.auditTab === 'exclusions' ? ' is-active' : ''}" data-audit-tab="exclusions">
              Excluded Film & Non-Book Elements (${FILM_ONLY_EXCLUSIONS.length})
            </button>
            <input
              id="audit-search-input"
              class="hud-input"
              style="flex:1;min-width:190px;"
              type="search"
              value="${escapeHtml(state.auditSearch)}"
              placeholder="Search quotes, books, or exclusions..."
              aria-label="Search Canon Purity Audit"
            />
          </div>

          <div id="audit-modal-body">${buildAuditBodyHtml()}</div>
        </div>
      </div>
    `;

    modalRoot.querySelector('#audit-close-btn')?.addEventListener('click', closeAuditModal);
    modalRoot.querySelector('#audit-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target?.id === 'audit-modal-backdrop') {
        closeAuditModal();
      }
    });

    modalRoot.querySelectorAll('[data-audit-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.auditTab = btn.getAttribute('data-audit-tab') || 'ledger';
        modalRoot.querySelectorAll('[data-audit-tab]').forEach((tabBtn) => {
          tabBtn.classList.toggle('is-active', tabBtn.getAttribute('data-audit-tab') === state.auditTab);
        });
        const bodyEl = modalRoot.querySelector('#audit-modal-body');
        if (bodyEl) bodyEl.innerHTML = buildAuditBodyHtml();
      });
    });

    const searchInput = modalRoot.querySelector('#audit-search-input');
    searchInput?.addEventListener('input', (e) => {
      state.auditSearch = e.target.value;
      const bodyEl = modalRoot.querySelector('#audit-modal-body');
      if (bodyEl) bodyEl.innerHTML = buildAuditBodyHtml();
    });
  }

  function openAuditModal(tab = 'ledger') {
    state.auditTab = tab === 'exclusions' ? 'exclusions' : 'ledger';
    state.auditModalOpen = true;
    renderAuditModal();
  }

  function closeAuditModal() {
    state.auditModalOpen = false;
    renderAuditModal();
  }

  // --- Wire Top Control Events ---
  cameraSelect.addEventListener('change', () => {
    applyCameraPreset(cameraSelect.value);
  });

  qualitySelect.addEventListener('change', () => {
    engine?.setQuality?.(qualitySelect.value);
    syncTopControls();
  });

  cutawayBtn.addEventListener('click', () => {
    const current = engine?.isCutawayEnabled ? engine.isCutawayEnabled() : true;
    const next = !current;
    engine?.setCutaway?.(next);
    controllers?.architecture?.setCutaway?.(next);
    syncTopControls();
  });

  walkBtn.addEventListener('click', () => {
    engine?.toggleFirstPerson?.();
    syncTopControls();
  });

  soundBtn.addEventListener('click', () => {
    soundscape?.toggle?.();
    syncTopControls();
  });

  directoryBtn.addEventListener('click', () => {
    state.directoryOpen = !state.directoryOpen;
    syncTopControls();
    renderDirectory();
  });

  auditBtn.addEventListener('click', () => {
    openAuditModal('ledger');
  });

  // --- Wire Engine Callbacks (keeps HUD synced with 3D raycast & debug API) ---
  engine?.setCallbacks?.({
    onSelect: (canonId) => {
      if (canonId) {
        state.selectedId = canonId;
        state.actionFeedback = '';
        if (canonId === 'stone-gargoyle' || canonId === 'spiral-staircase') {
          state.passwordDismissed = false;
        } else {
          state.passwordManualPin = false;
          if (state.activeCameraPreset === 'entrance') {
            state.activeCameraPreset = 'custom';
          }
        }
      } else {
        state.selectedId = null;
        state.actionFeedback = '';
        state.passwordManualPin = false;
      }
      renderInspector();
      renderDirectory();
      updatePasswordPromptVisibility();
    },
    onHover: (entry) => {
      state.hoveredEntry = entry || null;
      if (entry) {
        const canonObj = CANON_OBJECTS[entry.id];
        hoverPill.textContent = `${canonObj?.name || entry.name} — Click to inspect · Double-click to focus`;
        hoverPill.style.display = 'block';
      } else {
        hoverPill.style.display = 'none';
      }
    },
    onModeChange: (nextMode) => {
      if (nextMode === 'first-person') {
        state.passwordManualPin = false;
        if (state.activeCameraPreset === 'entrance') {
          state.activeCameraPreset = 'first-person';
        }
        updatePasswordPromptVisibility();
      }
      syncTopControls();
    },
    onCutawayChange: (enabled) => {
      controllers?.architecture?.setCutaway?.(enabled);
      syncTopControls();
    },
    onQualityChange: () => {
      syncTopControls();
    },
    onEraChange: (eraId) => {
      if (!state.isApplyingEra) {
        controllers?.architecture?.applyEra?.(eraId);
        controllers?.furniture?.applyEra?.(eraId);
        controllers?.artifacts?.applyEra?.(eraId);
        syncEraUI(eraId);
      }
    },
  });

  // --- Keyboard Escape Handling ---
  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return;

    if (state.auditModalOpen) {
      e.preventDefault();
      closeAuditModal();
      return;
    }
    if (engine?.getMode?.() === 'first-person') {
      e.preventDefault();
      engine.setFirstPerson(false);
      syncTopControls();
      return;
    }
    if (state.passwordPromptOpen) {
      e.preventDefault();
      state.passwordDismissed = true;
      state.passwordManualPin = false;
      state.passwordPromptOpen = false;
      renderPasswordCard();
      return;
    }
    if (state.selectedId) {
      e.preventDefault();
      closeInspector();
      return;
    }
    if (state.directoryOpen) {
      e.preventDefault();
      state.directoryOpen = false;
      syncTopControls();
      renderDirectory();
    }
  };

  window.addEventListener('keydown', onKeyDown);

  // Initial render
  syncTopControls();
  renderEraBar();
  renderDirectory();
  updatePasswordPromptVisibility();
  renderInspector();

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    hudRoot.innerHTML = '';
    inspectorRoot.innerHTML = '';
    modalRoot.innerHTML = '';
  }

  return {
    openInspector,
    closeInspector,
    openDirectory(open = true) {
      state.directoryOpen = Boolean(open);
      syncTopControls();
      renderDirectory();
    },
    openAuditModal,
    closeAuditModal,
    openPasswordPrompt(open = true) {
      state.passwordDismissed = !open;
      state.passwordManualPin = Boolean(open);
      state.passwordPromptOpen = Boolean(open);
      renderPasswordCard();
    },
    setEra: applyEra,
    setCameraPreset: applyCameraPreset,
    dispose,
  };
}
