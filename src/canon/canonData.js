/**
 * Verified Book-Canon Data Module for Dumbledore's Office (Books 1–7).
 *
 * Strictly derived from J.K. Rowling's seven original Harry Potter novels
 * (compiled from research/canon-books-1to4.json and research/canon-books-5to7.json).
 * Excludes all film set inventions, Pottermore/Wizarding World expansions,
 * theme parks, video games, Cursed Child, and fan speculation.
 */

export const CANON_OBJECTS = {
  'stone-gargoyle': {
    id: 'stone-gargoyle',
    name: 'Stone Gargoyle Guardian',
    category: 'entrance',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 11 / Ch. 12',
        text: "They marched in silence round a corner and she stopped before a large and extremely ugly stone gargoyle. 'Sherbet lemon!' she said. This was evidently a password, because the gargoyle sprang suddenly to life, and hopped aside as the wall behind him split in two.",
      },
      {
        book: 'Goblet of Fire',
        chapter: 'Ch. 28 (The Madness of Mr. Crouch)',
        text: 'Harry tore up the stone steps, through the oak front doors, and off up the marble staircase towards the second floor. Five minutes later he was hurtling towards a stone gargoyle standing halfway along an empty corridor.',
      },
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 36 (The Flaw in the Plan)',
        text: '“Can we go up?” he asked the gargoyle. “Feel free,” groaned the statue.',
      },
    ],
    derivedVisuals: [
      'Large, extremely ugly carved stone gargoyle standing guard against a solid corridor stone wall (NOT a golden or stone griffin).',
      'UK/US variant on GoF Ch. 28: UK "towards" vs. US "toward". Also note canon floor shift: GoF Ch. 28 places the gargoyle on the second floor, whereas HBP Ch. 10 places it on the seventh floor.',
      'Leaps/hops aside when spoken the correct sweet-themed password (or "Dumbledore" under Snape).',
      'Barred to illegitimate authorities such as Dolores Umbridge (OoP Ch. 28: "The Head\'s office has sealed itself against her" / "Barred to all but the rightful Headmaster").',
      'In DH Ch. 36 after the Battle of Hogwarts, knocked aside and standing lopsided, groaning "Feel free".',
    ],
    minimalStructuralBridging:
      'Placed on a stone plinth in a short approach corridor stub outside the circular office wall. Chiseled weathered gargoyle silhouette and parted two-leaf ashlar wall panel behind it.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'speak-password', label: 'Speak Password' },
      { id: 'inspect', label: 'Inspect Gargoyle' },
    ],
  },

  'spiral-staircase': {
    id: 'spiral-staircase',
    name: 'Moving Spiral Stone Staircase',
    category: 'entrance',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 11 / Ch. 12',
        text: 'Behind the wall was a spiral staircase which was moving smoothly upwards, like an escalator.',
      },
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 11 / Ch. 12',
        text: 'They rose upwards in circles, higher and higher, until at last, slightly dizzy, Harry could see a gleaming oak door ahead, with a brass knocker in the shape of a griffin.',
      },
    ],
    derivedVisuals: [
      'Concealed behind the split corridor stone wall guarded by the gargoyle.',
      'Spiral staircase rises continuously in smooth circular motion like an escalator toward the office landing.',
      'The ONLY spiral staircase associated with Dumbledore\'s office in the seven novels (located at the entrance approach, not inside the office).',
    ],
    minimalStructuralBridging:
      'Represented as a cylindrical stone stair shaft rising from the corridor archway beneath/adjacent to the circular office entry threshold.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'ascend', label: 'Ride Staircase' },
    ],
  },

  'oak-door-knocker': {
    id: 'oak-door-knocker',
    name: 'Gleaming Oak Door & Brass Griffin Knocker',
    category: 'entrance',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 11 / Ch. 12',
        text: 'until at last, slightly dizzy, Harry could see a gleaming oak door ahead, with a brass knocker in the shape of a griffin.',
      },
    ],
    derivedVisuals: [
      'Single polished, gleaming oak door (not a double door) at the top of the moving spiral staircase.',
      'Ornamental brass door knocker sculpted in the shape of a griffin.',
      'Not completely soundproof: in GoF Ch. 30, Harry hears raised voices (Fudge, Moody, Dumbledore) from outside on the staircase.',
      'Magically locks occupants inside when required (OoP Ch. 37 until Dumbledore arrives).',
    ],
    minimalStructuralBridging:
      'Single heavy oak door leaf framed in dressed stone at the stair landing, hinged to open inward toward Fawkes\'s perch.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'knock-door', label: 'Knock Brass Griffin' },
      { id: 'toggle-door', label: 'Open / Close Oak Door' },
    ],
  },

  'circular-room': {
    id: 'circular-room',
    name: 'Circular Tower Chamber',
    category: 'architecture',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'It was a large and beautiful circular room, full of funny little noises.',
      },
      {
        book: 'Half-Blood Prince',
        chapter: 'Ch. 10 (The House of Gaunt)',
        text: 'The circular office looked just as it always did; the delicate silver instruments stood on spindle-legged tables, puffing smoke and whirring...',
      },
    ],
    derivedVisuals: [
      'Single-level, large, beautiful circular tower room with curved stone walls.',
      'Explicitly has NO upper balcony, NO mezzanine gallery, NO interior second story, and NO hanging planetary orrery.',
      'Floor supports all furniture, Fawkes\'s burning-day ashes (CoS Ch. 12), broken table legs (OoP Ch. 37), and Snape\'s silver doe Patronus (DH Ch. 33).',
    ],
    minimalStructuralBridging:
      'Dressed Hogwarts ashlar stone walls arranged in a 6.5m radius single-story cylinder with stone flagstone floor, simple woven rug under the desk zone, and timber-ribbed ceiling (exact floor/ceiling finish is structural bridging).',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'overview', label: 'Room Overview' },
    ],
  },

  'windows-grounds': {
    id: 'windows-grounds',
    name: 'Tower Windows Overlooking Grounds',
    category: 'architecture',
    books: ['Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 37 (The Lost Prophecy)',
        text: 'Harry looked through the window. There was a cool line of pale green along the horizon: dawn was approaching.',
      },
    ],
    derivedVisuals: [
      'Tall windows set into the curved tower wall overlooking the Hogwarts grounds and distant horizon (OoP Ch. 37 pale-green dawn horizon).',
      'In HBP Ch. 29, Professor McGonagall looks out the office window across the grounds while watching for Minister Rufus Scrimgeour.',
      'Openable windows: Hermione summons the Horcrux books straight out of Dumbledore\'s open office window (DH Ch. 6), and Snape\'s silver doe Patronus leaps out the office window (DH Ch. 33).',
    ],
    minimalStructuralBridging:
      'Two tall pointed-arch leaded-glass casement windows set around the outer tower arc with stone sills and an exterior sky/grounds vista (exact window count and leaded mullion pattern are structural bridging).',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'look-out-window', label: 'Look Across Grounds' },
    ],
  },

  fireplace: {
    id: 'fireplace',
    name: 'Stone Fireplace (Floo-Connected)',
    category: 'architecture',
    books: ['Order of the Phoenix'],
    quotes: [
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 37 (The Lost Prophecy)',
        text: 'The empty fireplace burst into emerald-green flame... As Dumbledore\'s tall form unfolded itself from the fire...',
      },
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 37 (The Lost Prophecy)',
        text: '“I DON\'T CARE! I\'ve had enough, I\'ve seen enough, I want out, I want it to end, I don\'t care anymore —”',
      },
    ],
    derivedVisuals: [
      'Fireplace recessed into the office wall, connected to the Floo Network: Dumbledore arrives via an explosion of emerald-green flames (OoP Ch. 37).',
      'Later in OoP Ch. 37, an active fire burns in the hearth; during Harry\'s outburst quoted above, he snatches up a lunascope and throws it straight into the burning fire.',
    ],
    minimalStructuralBridging:
      'Carved Hogwarts stone hearth and mantle along the western/side arc with iron grate, embers, and toggleable orange vs. emerald Floo flame (stone mantle design is structural bridging).',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'floo-flare', label: 'Trigger Emerald Floo Flame' },
    ],
  },

  'horcrux-books': {
    id: 'horcrux-books',
    name: 'Stored Horcrux Books',
    category: 'artifact',
    books: ['Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 6 (The Ghoul in Pyjamas)',
        text: 'Accio Horcrux books',
      },
    ],
    derivedVisuals: [
      'NO bookcase or bookshelves are explicitly described anywhere in Dumbledore\'s office across all seven novels (the only "shelf" attested in the office is the shelf behind the desk holding the Sorting Hat in CoS Ch. 12; wall bookcases are film-set dressing).',
      'DH Ch. 6 confirms solely that Dumbledore removed Dark Arts/Horcrux volumes from the Hogwarts Library and kept them in his office until Hermione summoned them out of his open office window after his funeral.',
    ],
    minimalStructuralBridging:
      'Because no bookcase is mentioned in the novels, these stored volumes are bridged minimally via a small single-tier carved dark-oak side shelf/case holding bound Horcrux texts in HBP (visibly depleted/summoned out the window in DH)—strictly excluding the film\'s two-story library rotunda.',
    erasVisible: ['hbp', 'dh'],
    actions: [
      { id: 'inspect-books', label: 'Inspect Horcrux Books' },
    ],
  },

  'claw-footed-desk': {
    id: 'claw-footed-desk',
    name: 'Enormous Claw-Footed Desk',
    category: 'furniture',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'There was also an enormous, claw-footed desk, and, sitting on a shelf behind it, a shabby, tainted wizard’s hat — the Sorting Hat.',
      },
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 33 (The Prince\'s Tale)',
        text: 'The stone Pensieve lay in the cabinet where it had always been: Harry heaved it on to the desk and poured Snape\'s memories into the wide basin with its runic markings around the edge.',
      },
    ],
    derivedVisuals: [
      'Enormous desk supported by sculpted claw feet.',
      'Positioned centrally facing the visitor area, with a wall shelf directly behind it holding the Sorting Hat and (from HBP Ch. 29) Dumbledore\'s portrait behind/over it.',
      'Overturned during the Ch. 27 confrontation in OoP, restored by HBP Ch. 10; holds the stone Pensieve and crystal memory phials during HBP lessons and DH Ch. 33.',
    ],
    minimalStructuralBridging:
      'Grand dark-oak writing desk (~2.4m wide) with four cabriole/claw feet, inkwell, parchment, and central top surface sized to support the Pensieve (wood species and surface props beyond Pensieve/phials/parchment are bridging).',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'inspect-desk', label: 'Examine Desk Surface' },
    ],
  },

  'headmaster-chair': {
    id: 'headmaster-chair',
    name: 'Headmaster\'s Chair',
    category: 'furniture',
    books: ['Chamber of Secrets', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 36 (The Flaw in the Plan)',
        text: 'Harry had eyes only for the man who stood in the largest portrait directly behind the headmaster’s chair.',
      },
    ],
    derivedVisuals: [
      'Positioned behind the enormous claw-footed desk, directly beneath/in front of the largest wall portrait (Dumbledore\'s portrait from HBP Ch. 29 onward).',
      'The novels name "the headmaster’s chair" without specifying its material, back height, or upholstery color.',
    ],
    minimalStructuralBridging:
      'Carved dark oak armchair with burgundy velvet seat cushion behind the desk. Note: wood species, high-backed silhouette, and burgundy velvet upholstery are minimal structural bridging choices not specified in the novels.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'inspect-chair', label: 'Inspect Headmaster\'s Chair' },
    ],
  },

  'visitor-chairs': {
    id: 'visitor-chairs',
    name: 'Visitor Seating Facing the Desk',
    category: 'furniture',
    books: ['Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 22 (St. Mungo\'s Hospital for Magical Maladies and Injuries)',
        text: '...Professor McGonagall drew up three straight-backed, wooden chairs...',
      },
    ],
    derivedVisuals: [
      'In OoP Ch. 22, McGonagall conjures "straight-backed, wooden chairs" in Dumbledore\'s office for herself, Harry, and Ron.',
      'Harry also sits in a chair/armchair opposite/in front of Dumbledore\'s desk in GoF Ch. 36 (when Fawkes lands on his knee), OoP Ch. 37 (after his rampage), and throughout his HBP private lessons.',
      'Strictly NOT "chintz" armchairs (chintz armchairs appear in Courtroom Ten in OoP Ch. 8 and Budleigh Babberton in HBP Ch. 4, never Dumbledore\'s office).',
    ],
    minimalStructuralBridging:
      'Pair of wooden visitor chairs placed opposite the claw-footed desk. Note: carved oak finish and any dark leather/plain cushion detailing are minimal structural bridging choices not specified in the novels (no chintz fabric).',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'sit-view', label: 'Visitor Seat View' },
    ],
  },

  'spindle-tables': {
    id: 'spindle-tables',
    name: 'Spindle-Legged Tables',
    category: 'furniture',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'A number of curious silver instruments stood on spindle-legged tables, whirring and emitting little puffs of smoke.',
      },
      {
        book: 'Half-Blood Prince',
        chapter: 'Ch. 10 (The House of Gaunt)',
        text: 'The circular office looked just as it always did; the delicate silver instruments stood on spindle-legged tables, puffing smoke and whirring...',
      },
    ],
    derivedVisuals: [
      'Slender, delicate tables with thin spindle legs arranged around the circular room.',
      'Hold the curious whirring silver instruments (and Gaunt\'s cracked ring in HBP Ch. 10).',
      'Smashed in OoP Ch. 27 and broken by Harry in OoP Ch. 37 (throws a spindle-legged table to the floor where its legs break off), then fully restored by HBP Ch. 10.',
    ],
    minimalStructuralBridging:
      'Seven small round and oval dark-oak occasional tables with turned spindle legs arrayed along the room perimeter.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'inspect-tables', label: 'Inspect Spindle Tables' },
    ],
  },

  'silver-instruments': {
    id: 'silver-instruments',
    name: 'Curious Silver Instruments',
    category: 'instrument',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'It was a large and beautiful circular room, full of funny little noises. A number of curious silver instruments stood on spindle-legged tables, whirring and emitting little puffs of smoke.',
      },
      {
        book: 'Half-Blood Prince',
        chapter: 'Ch. 10 (The House of Gaunt)',
        text: 'The circular office looked just as it always did; the delicate silver instruments stood on spindle-legged tables, puffing smoke and whirring...',
      },
    ],
    derivedVisuals: [
      'Delicate, intricate burnished silver contraptions standing on the spindle-legged tables.',
      'Continuously spin/whirr, make funny little noises, and release small gentle puffs of smoke.',
      'Shattered during OoP Ch. 27 & Ch. 37 (Harry smashes frail silver instruments against the wall and a portrait), restored by HBP Ch. 10.',
    ],
    minimalStructuralBridging:
      'Varied tabletop silver mechanisms (spinning gyro-rings, geared dials, slender steam-spouts) sized for spindle tables—NOT a giant ceiling-suspended brass planetary orrery.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'pulse-smoke', label: 'Whirr & Puff Smoke' },
    ],
  },

  'smoke-serpent-instrument': {
    id: 'smoke-serpent-instrument',
    name: 'Delicate Smoke-Serpent Silver Instrument',
    category: 'instrument',
    books: ['Order of the Phoenix'],
    quotes: [
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 22 (St. Mungo\'s Hospital for Magical Maladies and Injuries)',
        text: 'Naturally, naturally... But in essence divided?',
      },
    ],
    derivedVisuals: [
      'Fragile silver instrument fetched by Dumbledore from a spindle-legged table and placed on his desk in OoP Ch. 22.',
      'Tapped with a wand, it makes rhythmic clinking sounds and puffs pale green smoke from a tiny tube.',
      'The pale green smoke curls into a serpent\'s head and splits into two snakes when Dumbledore asks "But in essence divided?".',
    ],
    minimalStructuralBridging:
      'Fine silver vessel with slender vertical spout tube and small geared base resting on a spindle-legged table / desk.',
    erasVisible: ['oop', 'hbp', 'dh'],
    actions: [
      { id: 'tap-instrument', label: 'Tap with Wand ("In essence divided?")' },
    ],
  },

  lunascope: {
    id: 'lunascope',
    name: 'Lunascope',
    category: 'instrument',
    books: ['Order of the Phoenix'],
    quotes: [
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 37 (The Lost Prophecy)',
        text: '“I DON\'T CARE! I\'ve had enough, I\'ve seen enough, I want out, I want it to end, I don\'t care anymore —”',
      },
    ],
    derivedVisuals: [
      'Tabletop astronomical instrument (specifically named a lunascope, NOT a paper lunar chart) kept in the office in OoP Ch. 37.',
      'During Harry\'s grief rampage in OoP Ch. 37, Harry snatches up the lunascope and throws it straight into the burning fire in the fireplace.',
    ],
    minimalStructuralBridging:
      'Compact tabletop brass-and-silver moon-phase globe/dial instrument on a side spindle-legged table near the hearth in the OoP era.',
    erasVisible: ['oop'],
    actions: [
      { id: 'inspect-lunascope', label: 'Inspect Lunascope' },
    ],
  },

  portraits: {
    id: 'portraits',
    name: 'Portraits of Former Headmasters & Headmistresses',
    category: 'portrait',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'covered with portraits of old headmasters and headmistresses, all of whom were snoozing gently in their frames.',
      },
      {
        book: 'Order of the Phoenix',
        chapter: 'Ch. 27 (The Centaur and the Sneak)',
        text: 'You know, Minister, I disagree with Dumbledore on many counts... but you cannot deny he\'s got style...',
      },
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 36 (The Flaw in the Plan)',
        text: '“And let it be noted that Slytherin House played its part! Let our contribution not be forgotten!”',
      },
    ],
    derivedVisuals: [
      'Framed oil portraits of former Hogwarts headmasters and headmistresses covering the curved office walls.',
      'Normally appear gently snoozing in their frames (eyes closed), waking to converse, advise, or step between linked frames outside Hogwarts (Everard, Dilys Derwent, Phineas Nigellus Black, Dexter Fortescue, Armando Dippet).',
      'Mostly empty during the battle in DH Ch. 33, then packed and cheering/applauding in DH Ch. 36.',
    ],
    minimalStructuralBridging:
      'Gallery of gilt and dark-wood framed oil portraits hung along the stone wall arc, each equipped with snoozing and awake procedural canvas textures.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'wake-portraits', label: 'Wake / Snooze Portraits' },
    ],
  },

  'dumbledore-portrait': {
    id: 'dumbledore-portrait',
    name: 'Portrait of Albus Dumbledore (& Hidden Wall Cavity)',
    category: 'portrait',
    books: ['Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 36 (The Flaw in the Plan)',
        text: 'Harry had eyes only for the man who stood in the largest portrait directly behind the headmaster’s chair.',
      },
    ],
    derivedVisuals: [
      'Appears immediately after Dumbledore\'s death in HBP Ch. 29: largest portrait in the office, in a golden frame directly behind/over the headmaster\'s chair and desk.',
      'Depicts Dumbledore with long silver beard, crooked nose, and half-moon spectacles (slumbering peacefully in HBP Ch. 29; awake and weeping tears behind his spectacles in DH Ch. 36).',
      'Frame hinges forward on its side to conceal a secret wall cavity holding the real Sword of Gryffindor in DH Ch. 33.',
    ],
    minimalStructuralBridging:
      'Oversized gilded-frame portrait mounted directly behind the headmaster\'s chair with hinged pivot animation exposing a recessed stone niche behind the canvas.',
    erasVisible: ['hbp', 'dh'],
    actions: [
      { id: 'swing-portrait', label: 'Swing Hinged Portrait (Reveal Cavity)' },
      { id: 'wake-dumbledore', label: 'Wake / Slumber Portrait' },
    ],
  },

  'sorting-hat': {
    id: 'sorting-hat',
    name: 'The Sorting Hat',
    category: 'artifact',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'There was also an enormous, claw-footed desk, and, sitting on a shelf behind it, a shabby, tainted wizard’s hat — the Sorting Hat.',
      },
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'Bee in your bonnet, Potter?',
      },
    ],
    derivedVisuals: [
      'Ancient, patched, frayed, shabby pointed wizard\'s hat (note edition variant "tainted" vs "tattered" in CoS Ch. 12).',
      'Rests on a wall shelf positioned directly behind the enormous claw-footed desk.',
      'Communicates via a rip near the brim functioning as a mouth.',
    ],
    minimalStructuralBridging:
      'Sculpted crinkled felt cone and slumped wide brim with stitched mouth-rip resting on a carved oak wall shelf behind the desk.',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'speak-hat', label: 'Listen to Sorting Hat' },
    ],
  },

  'fawkes-perch': {
    id: 'fawkes-perch',
    name: 'Fawkes the Phoenix & Golden Perch',
    category: 'creature',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'Standing on a golden perch behind the door was a decrepit-looking bird which resembled a half-plucked turkey. Harry stared at it and the bird looked balefully back, making its gagging noise again. Harry thought it looked very ill. Its eyes were dull and, even as Harry watched, a couple more feathers fell out of its tail.',
      },
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 12 (The Polyjuice Potion)',
        text: 'Harry looked down in time to see a tiny, wrinkled, newborn bird poke its head out of the ashes. It was quite as ugly as the old one.',
      },
      {
        book: 'Goblet of Fire',
        chapter: 'Ch. 36 (The Parting of the Ways)',
        text: 'scarlet-and-gold bird',
      },
    ],
    derivedVisuals: [
      'Tall golden bird perch standing specifically behind the gleaming oak entrance door.',
      'CoS Ch. 12 Burning Day: decrepit half-plucked bird erupts into a ball of fire, leaves a smouldering pile of ash on the floor, and is reborn as a tiny wrinkled chick.',
      'Healthy state (GoF Ch. 36, OoP Ch. 22/27): brilliant swan-sized scarlet-and-gold plumage with long golden tail feathers.',
      'Departs Hogwarts forever after singing his lament in HBP Ch. 29 (heard "across the grounds and through the castle windows" from the Hospital Wing), leaving the golden perch empty in DH.',
    ],
    minimalStructuralBridging:
      'Brass/gilded floor-standing ring perch positioned immediately behind the inward-swinging oak door, with era-driven phoenix states (burning-day, scarlet-gold, lamenting, absent).',
    erasVisible: ['cos', 'gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'burning-day', label: 'Trigger Burning Day Rebirth' },
    ],
  },

  'black-cabinet': {
    id: 'black-cabinet',
    name: 'Black Cabinet (Pensieve Cabinet)',
    category: 'furniture',
    books: ['Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Goblet of Fire',
        chapter: 'Ch. 30 (The Pensieve)',
        text: 'black cabinet',
      },
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 33 (The Prince\'s Tale)',
        text: 'The stone Pensieve lay in the cabinet where it had always been: Harry heaved it on to the desk and poured Snape\'s memories into the wide basin with its runic markings around the edge.',
      },
    ],
    derivedVisuals: [
      'Opaque dark/black wooden cabinet in the office (NOT a towering glass-fronted apothecary cabinet packed with glowing bottles).',
      'In GoF Ch. 30, Dumbledore leaves the black cabinet door improperly fastened/slightly ajar in haste when Fudge arrives, letting out a bright sliver of silvery-white light that dances onto the glass sword case.',
    ],
    minimalStructuralBridging:
      'Single-bay tall dark ebonized oak cabinet with solid paneled door(s) placed opposite/across from the glass sword case so an ajar crack casts silvery light onto the glass (closed oak doors remain recessed in the East alcove in CoS to seal the wall cavity).',
    erasVisible: ['gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'toggle-cabinet', label: 'Open / Close Cabinet Door' },
    ],
  },

  pensieve: {
    id: 'pensieve',
    name: 'The Pensieve',
    category: 'artifact',
    books: ['Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Goblet of Fire',
        chapter: 'Ch. 30 (The Pensieve)',
        text: 'A shallow stone basin lay there, with odd carvings around the edge: runes and symbols that Harry did not recognize.',
      },
      {
        book: 'Goblet of Fire',
        chapter: 'Ch. 30 (The Pensieve)',
        text: 'light made liquid – or like wind made solid',
      },
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 33 (The Prince\'s Tale)',
        text: 'The stone Pensieve lay in the cabinet where it had always been: Harry heaved it on to the desk and poured Snape\'s memories into the wide basin with its runic markings around the edge.',
      },
    ],
    derivedVisuals: [
      'Wide, shallow carved stone basin etched around its rim with unfamiliar runes and symbols (no novel calls them "Saxon runes").',
      'Filled with a bright, whitish-silver, cloud-like substance moving ceaselessly—"neither liquid nor gas", resembling "light made liquid – or like wind made solid".',
      'Housed inside the black cabinet in GoF Ch. 30 and DH Ch. 33; heaved onto the claw-footed desk for memory viewing in HBP lessons and DH Ch. 33.',
    ],
    minimalStructuralBridging:
      'Carved dark-grey stone shallow basin with procedural runic rim texture and custom GLSL swirling whitish-silver light shader.',
    erasVisible: ['gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'peer-pensieve', label: 'Peer Into Pensieve' },
      { id: 'move-pensieve', label: 'Toggle Cabinet / Desk Placement' },
    ],
  },

  'memory-phials': {
    id: 'memory-phials',
    name: 'Crystal Memory Phials',
    category: 'artifact',
    books: ['Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Half-Blood Prince',
        chapter: 'Ch. 20 (Lord Voldemort\'s Request)',
        text: 'two tiny crystal bottles',
      },
      {
        book: 'Half-Blood Prince',
        chapter: 'Ch. 23 (Horcruxes)',
        text: 'glass phial',
      },
      {
        book: 'Deathly Hallows',
        chapter: 'Ch. 33 (The Prince\'s Tale)',
        text: 'flask',
      },
    ],
    derivedVisuals: [
      'Small stoppered crystal/glass containers holding swirling silvery memories: in HBP Ch. 20, "two tiny crystal bottles" sit beside the Pensieve on Dumbledore\'s desk; in HBP Ch. 23, Harry brings Slughorn\'s authentic memory in a "glass phial"; in DH Ch. 33, Harry brings Snape\'s memories in a "flask".',
      'Slughorn\'s altered memory in HBP Ch. 17 appears sluggish, foggy, and congealed compared to bright silvery threads.',
      'Strictly 1–2 small phials/bottles beside the Pensieve—never hundreds of wall-lining apothecary jars.',
    ],
    minimalStructuralBridging:
      'Two small cork-stoppered crystal phials filled with luminous silver wisps sitting beside the Pensieve on the desk in HBP and DH.',
    erasVisible: ['hbp', 'dh'],
    actions: [
      { id: 'pour-memory', label: 'Swirl / Pour Memory Phial' },
    ],
  },

  'gryffindor-sword-case': {
    id: 'gryffindor-sword-case',
    name: 'Sword of Gryffindor in Glass Display Case',
    category: 'artifact',
    books: ['Chamber of Secrets', 'Goblet of Fire', 'Order of the Phoenix', 'Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Chamber of Secrets',
        chapter: 'Ch. 18 (Dobby\'s Reward — physical sword description in McGonagall\'s office)',
        text: 'its handle glittering with rubies the size of eggs.',
      },
      {
        book: 'Goblet of Fire',
        chapter: 'Ch. 30 (The Pensieve — sword in glass case in Dumbledore\'s office)',
        text: 'glass case',
      },
    ],
    derivedVisuals: [
      'Gleaming silver goblin-made sword with large egg-sized red rubies set into the hilt (physical sword details established in CoS Ch. 18 inside McGonagall\'s office).',
      'First described inside a glass display case in Dumbledore\'s office in GoF Ch. 30, where silvery light leaking from the ajar black cabinet dances across the glass.',
      'In DH Ch. 15 & Ch. 33, Phineas Nigellus reveals the sword in the glass case is a fake replica, while the real sword was concealed in the hidden wall cavity behind Dumbledore\'s hinged portrait.',
    ],
    minimalStructuralBridging:
      'Wall-mounted oak-framed glass display box housing the silver ruby-hilted sword across from the black cabinet.',
    erasVisible: ['gof', 'oop', 'hbp', 'dh'],
    actions: [
      { id: 'inspect-sword', label: 'Inspect Sword & Glass Case' },
    ],
  },

  'gaunt-ring': {
    id: 'gaunt-ring',
    name: 'Marvolo Gaunt\'s Cracked Ring',
    category: 'artifact',
    books: ['Half-Blood Prince', 'Deathly Hallows'],
    quotes: [
      {
        book: 'Half-Blood Prince',
        chapter: 'Ch. 4 (Horace Slughorn — ring worn on Dumbledore\'s hand; seen resting on office table in Ch. 10)',
        text: '...set with a heavy black stone that had cracked down the middle',
      },
    ],
    derivedVisuals: [
      'Clumsy heavy gold ring set with a heavy black stone cracked straight down the middle (appearance first described in HBP Ch. 4 when worn on Dumbledore\'s uninjured hand).',
      'In HBP Ch. 10 ("The House of Gaunt"), the cracked-stone ring rests openly on one of the spindle-legged tables inside Dumbledore\'s office alongside Dumbledore\'s blackened hand (and appears on the desk beside the real sword in Snape\'s memory in DH Ch. 33).',
      'Rested visibly on a spindle-legged table/desk—NOT slid out of a desk drawer beside Tom Riddle\'s diary.',
    ],
    minimalStructuralBridging:
      'Small tarnished gold band with faceted black stone split down the center resting on a spindle-legged table near the desk during the HBP era.',
    erasVisible: ['hbp'],
    actions: [
      { id: 'inspect-ring', label: 'Inspect Gaunt Ring' },
    ],
  },
};

export const BOOK_ERAS = [
  {
    id: 'cos',
    label: 'Chamber of Secrets (Book 2)',
    book: 'Harry Potter and the Chamber of Secrets',
    chapter: 'Ch. 11–12',
    title: 'First Visit & Fawkes\'s Burning Day',
    summaryQuote: 'It was a large and beautiful circular room, full of funny little noises. A number of curious silver instruments stood on spindle-legged tables, whirring and emitting little puffs of smoke.',
    quoteCitation: 'Chamber of Secrets, Ch. 12 ("The Polyjuice Potion")',
    lightingMood: 'Warm late-afternoon castle interior with golden highlights on silver instruments and phoenix flame',
    timeOfDay: 'Late Afternoon Dusk',
    pensieveLocation: 'hidden',
    blackCabinetState: 'closed',
    dumbledorePortraitVisible: false,
    fawkesMode: 'burning-day',
    swordHiddenInCavity: false,
  },
  {
    id: 'gof',
    label: 'Goblet of Fire (Book 4)',
    book: 'Harry Potter and the Goblet of Fire',
    chapter: 'Ch. 28–30 & 36',
    title: 'The Pensieve & The Parting of the Ways',
    summaryQuote: 'A shallow stone basin lay there, with odd carvings around the edge: runes and symbols that Harry did not recognize.',
    quoteCitation: 'Goblet of Fire, Ch. 30 ("The Pensieve")',
    lightingMood: 'Shadowy evening vigil pierced by a sliver of silvery-white Pensieve light dancing onto the glass sword case',
    timeOfDay: 'Midnight Pensieve Vigil',
    pensieveLocation: 'cabinet',
    blackCabinetState: 'ajar',
    dumbledorePortraitVisible: false,
    fawkesMode: 'scarlet-gold',
    swordHiddenInCavity: false,
  },
  {
    id: 'oop',
    label: 'Order of the Phoenix (Book 5)',
    book: 'Harry Potter and the Order of the Phoenix',
    chapter: 'Ch. 22, 27–28 & 37',
    title: 'Night Crisis, Emerald Floo & Pre-Dawn Grief',
    summaryQuote: 'Harry looked through the window. There was a cool line of pale green along the horizon: dawn was approaching.',
    quoteCitation: 'Order of the Phoenix, Ch. 37 ("The Lost Prophecy")',
    lightingMood: 'Winter-night crisis (Ch. 22) shifting to a cool pale-green dawn horizon, emerald Floo burst, and active hearth fire (Ch. 37)',
    timeOfDay: 'Night Crisis to Approaching Dawn',
    pensieveLocation: 'cabinet',
    blackCabinetState: 'closed',
    dumbledorePortraitVisible: false,
    fawkesMode: 'scarlet-gold',
    swordHiddenInCavity: false,
  },
  {
    id: 'hbp',
    label: 'Half-Blood Prince (Book 6)',
    book: 'Harry Potter and the Half-Blood Prince',
    chapter: 'Ch. 10, 17, 20, 23 & 29',
    title: 'Pensieve Lessons & The Phoenix Lament',
    summaryQuote: 'The circular office looked just as it always did; the delicate silver instruments stood on spindle-legged tables, puffing smoke and whirring...',
    quoteCitation: 'Half-Blood Prince, Ch. 10 ("The House of Gaunt")',
    lightingMood: 'Quiet nocturnal study lit by candles, hearth glow, and the Pensieve on the desk; solemn mourning in Ch. 29',
    timeOfDay: 'Bleak Winter Night',
    pensieveLocation: 'desk',
    blackCabinetState: 'closed',
    dumbledorePortraitVisible: true,
    fawkesMode: 'lamenting',
    swordHiddenInCavity: false,
  },
  {
    id: 'dh',
    label: 'Deathly Hallows (Book 7)',
    book: 'Harry Potter and the Deathly Hallows',
    chapter: 'Ch. 15, 33 & 36',
    title: 'The Prince\'s Tale & Victory Finale',
    chapterScopeNote: 'Composite era preset combining Ch. 33 (open black cabinet, Pensieve heaved onto desk, hidden sword cavity behind hinged Dumbledore portrait) with Ch. 36 (Golden Dawn After the Battle, lopsided gargoyle, cheering portraits, weeping Dumbledore portrait, and Reparo).',
    summaryQuote: 'Harry had eyes only for the man who stood in the largest portrait directly behind the headmaster’s chair.',
    quoteCitation: 'Deathly Hallows, Ch. 36 ("The Flaw in the Plan")',
    lightingMood: 'Battle-night tension (Ch. 33) giving way to bright post-battle dawn light streaming over cheering headmaster portraits (Ch. 36)',
    timeOfDay: 'Golden Dawn After the Battle',
    pensieveLocation: 'desk',
    blackCabinetState: 'open',
    dumbledorePortraitVisible: true,
    fawkesMode: 'absent',
    swordHiddenInCavity: true,
  },
];

export const PASSWORDS = [
  {
    password: 'Sherbet lemon',
    usEditionVariant: 'Lemon drop',
    book: 'Chamber of Secrets',
    chapter: 'Ch. 11 / Ch. 12',
    speaker: 'Professor Minerva McGonagall',
    status: 'accepted',
    notes: 'First office password shown; references the Muggle sweet Dumbledore offers McGonagall in Book 1 Ch. 1.',
  },
  {
    password: 'Sherbet lemon + 7 other rejected sweets',
    usEditionVariant: 'Lemon drop / Pear drop / Liquorice wand / Fizzing Whizzbees / Drooble\'s Best Blowing Gum / Bertie Bott\'s Every-Flavour Beans / Chocolate Frog / Sugar Quill',
    book: 'Goblet of Fire',
    chapter: 'Ch. 28–30',
    speaker: 'Harry Potter',
    status: 'rejected',
    notes: 'Password changed since Book 2; all 8 sweets Harry shouts at the stone gargoyle are rejected before he guesses the true password.',
  },
  {
    password: 'Cockroach Cluster',
    usEditionVariant: 'Cockroach Cluster',
    book: 'Goblet of Fire',
    chapter: 'Ch. 29 / Ch. 30',
    speaker: 'Harry Potter',
    status: 'accepted',
    notes: 'Succeeds to Harry\'s astonishment, causing the gargoyle to leap aside.',
  },
  {
    password: 'Fizzing Whizzbee',
    usEditionVariant: 'Fizzing Whizzbee',
    book: 'Order of the Phoenix',
    chapter: 'Ch. 22 ("St. Mungo\'s Hospital")',
    speaker: 'Professor Minerva McGonagall',
    status: 'accepted',
    notes: 'Both UK and US editions print "Fizzing Whizzbee" (singular) spoken in the middle of the night after Harry\'s vision of Arthur Weasley\'s attack.',
  },
  {
    password: 'Acid Pops',
    usEditionVariant: 'Acid Pops',
    book: 'Half-Blood Prince',
    chapter: 'Ch. 9–10 ("The House of Gaunt")',
    speaker: 'Harry Potter (from Dumbledore\'s note)',
    status: 'accepted',
    notes: 'Communicated in Dumbledore\'s letter ("P.S. I enjoy Acid Pops.") for Harry\'s first lesson.',
  },
  {
    password: 'Toffee Eclairs',
    usEditionVariant: 'Toffee Eclairs / Toffee Éclairs',
    book: 'Half-Blood Prince',
    chapter: 'Ch. 20 ("Lord Voldemort\'s Request")',
    speaker: 'Harry Potter',
    status: 'accepted',
    notes: 'Used by Harry late at night to enter for his Pensieve lesson.',
  },
  {
    password: 'Dumbledore',
    usEditionVariant: 'Dumbledore',
    book: 'Deathly Hallows',
    chapter: 'Ch. 33 ("The Prince\'s Tale")',
    speaker: 'Harry Potter (under Snape\'s headmastership)',
    status: 'accepted',
    notes: 'Harry blurts out "Dumbledore!" while carrying Snape\'s dying memories, and the gargoyle shifts aside.',
  },
  {
    password: null,
    usEditionVariant: 'No password required — gargoyle knocked aside',
    book: 'Deathly Hallows',
    chapter: 'Ch. 36 ("The Flaw in the Plan")',
    speaker: 'Harry Potter / stone gargoyle',
    status: 'accepted',
    notes: 'After the Battle of Hogwarts, the lopsided gargoyle groans "Feel free" when Harry asks "Can we go up?".',
  },
];

export const NAMED_PORTRAITS = [
  {
    id: 'portrait-albus-dumbledore',
    name: 'Albus Dumbledore',
    bookFirstAppears: 'Half-Blood Prince, Ch. 29 ("The Phoenix Lament")',
    appearance: 'Elderly wizard with long silver beard, crooked nose, and half-moon spectacles; largest portrait in the office, mounted in a golden frame directly behind/over the headmaster\'s chair.',
    linkedLocations: [],
    notableMoments: [
      'HBP Ch. 29: Appears sleeping peacefully in golden frame behind/over the desk right after his death.',
      'DH Ch. 33: Hinged frame swings forward to conceal a hidden wall cavity holding the real Sword of Gryffindor; instructs Snape in secret.',
      'DH Ch. 36: Weeps tears down his painted face behind half-moon spectacles and counsels Harry on the Deathly Hallows.',
    ],
  },
  {
    id: 'portrait-phineas-nigellus-black',
    name: 'Phineas Nigellus Black',
    bookFirstAppears: 'Order of the Phoenix, Ch. 22 ("St. Mungo\'s Hospital")',
    appearance: 'Clever-looking wizard with black hair, thin eyebrows, shrewd narrow dark eyes, pointed beard, and Slytherin green-and-silver robes.',
    linkedLocations: ['Number Twelve, Grimmauld Place (carried in Hermione\'s beaded bag in DH Ch. 15–33)'],
    notableMoments: [
      'OoP Ch. 22: Sent to Grimmauld Place to warn Sirius Black.',
      'OoP Ch. 27: Remarks "You know, Minister, I disagree with Dumbledore on many counts... but you cannot deny he\'s got style..." when Dumbledore escapes.',
      'OoP Ch. 37: Asks if Sirius is dead and walks out of his frame to verify at Grimmauld Place.',
      'DH Ch. 36: Calls out during applause: "And let it be noted that Slytherin House played its part! Let our contribution not be forgotten!"',
    ],
  },
  {
    id: 'portrait-everard',
    name: 'Everard',
    bookFirstAppears: 'Order of the Phoenix, Ch. 22 ("St. Mungo\'s Hospital")',
    appearance: 'Sallow-faced wizard with a short black fringe (bangs).',
    linkedLocations: ['Ministry of Magic'],
    notableMoments: [
      'OoP Ch. 22: Travels to his Ministry portrait, spots Arthur Weasley injured in the Department of Mysteries, and raises the alarm.',
    ],
  },
  {
    id: 'portrait-dilys-derwent',
    name: 'Dilys Derwent',
    bookFirstAppears: 'Order of the Phoenix, Ch. 22 ("St. Mungo\'s Hospital")',
    appearance: 'Elderly witch with long silver ringlets.',
    linkedLocations: ['St. Mungo\'s Hospital for Magical Maladies and Injuries (main admitting area)'],
    notableMoments: [
      'OoP Ch. 22: Travels to her St. Mungo\'s portrait and reports Arthur Weasley has arrived alive.',
    ],
  },
  {
    id: 'portrait-dexter-fortescue',
    name: 'Dexter Fortescue',
    bookFirstAppears: 'Order of the Phoenix, Ch. 22 ("St. Mungo\'s Hospital")',
    appearance: 'Corpulent, red-nosed wizard holding an ear trumpet.',
    linkedLocations: [],
    notableMoments: [
      'OoP Ch. 22: Scolds Phineas Nigellus Black about duty toward the sitting Headmaster.',
    ],
  },
  {
    id: 'portrait-armando-dippet',
    name: 'Armando Dippet',
    bookFirstAppears: 'Order of the Phoenix, Ch. 22 (as portrait; character seen alive in CoS Ch. 13 diary memory)',
    appearance: 'Elderly, frail, nearly bald wizard with stray wisps of white hair.',
    linkedLocations: [],
    notableMoments: [
      'OoP Ch. 22: Joins other heads reminding Phineas Nigellus of their duty.',
      'OoP Ch. 37: Exclaims "Really!" when Harry throws the lunascope into the burning fire.',
    ],
  },
  {
    id: 'portrait-note-absent-heads',
    name: 'Severus Snape & Dolores Umbridge (Explicitly Absent in Novels)',
    bookFirstAppears: 'Absent in Books 1–7',
    appearance: 'Not present on the office walls in Books 5–7.',
    linkedLocations: [],
    notableMoments: [
      'Umbridge (OoP Ch. 28): Office sealed itself against her; never entered or received a portrait.',
      'Snape (DH Ch. 30 & 36): Fled his post in Ch. 30; no portrait of Snape hangs in the office in DH Ch. 36.',
    ],
  },
];

export const FILM_ONLY_EXCLUSIONS = [
  {
    id: 'excl-griffin-entrance',
    filmElement: 'Giant rotating golden/stone griffin staircase guardian',
    bookReality: 'In CoS Ch. 11 and GoF Ch. 28–30, the corridor entrance is "a large and extremely ugly stone gargoyle" that hops aside while the wall splits in two; the griffin in the books is ONLY the brass knocker on the gleaming oak door at the top of the moving spiral staircase.',
    citation: 'Chamber of Secrets Ch. 11–12; Goblet of Fire Ch. 28–30',
  },
  {
    id: 'excl-two-story-mezzanine',
    filmElement: 'Two-story circular mezzanine / upper balcony with wraparound spiral stairs inside the office',
    bookReality: 'Across all 7 novels, Dumbledore\'s office is strictly a single-level "large and beautiful circular room". The only spiral staircase is the moving stone staircase behind the corridor gargoyle outside the office.',
    citation: 'Chamber of Secrets Ch. 12; Half-Blood Prince Ch. 10; cross-book audit',
  },
  {
    id: 'excl-hanging-orrery',
    filmElement: 'Giant suspended brass planetary orrery / astronomical armillary hanging from the ceiling',
    bookReality: 'Film set invention only; never appears in any of the 7 novels. The books describe tabletop curious silver instruments on spindle-legged tables and a tabletop lunascope (OoP Ch. 37).',
    citation: 'Chamber of Secrets Ch. 12; Order of the Phoenix Ch. 37',
  },
  {
    id: 'excl-apothecary-memory-cabinet',
    filmElement: 'Monumental double-door glass-fronted apothecary memory cabinet holding hundreds of glowing vials',
    bookReality: 'In GoF Ch. 30 and DH Ch. 33, the Pensieve is stored inside an opaque "black cabinet" (left slightly ajar in GoF Ch. 30, leaking a single sliver of light). In HBP, only 1–2 small crystal/glass phials sit beside the Pensieve on the desk.',
    citation: 'Goblet of Fire Ch. 30; Half-Blood Prince Ch. 10, 17, 20, 23; Deathly Hallows Ch. 33',
  },
  {
    id: 'excl-self-opening-cabinet',
    filmElement: 'Cabinet doors opening dramatically by themselves when Harry approaches the Pensieve',
    bookReality: 'In GoF Ch. 30, Dumbledore simply left the black cabinet door improperly fastened in his haste when Fudge arrived.',
    citation: 'Goblet of Fire Ch. 30',
  },
  {
    id: 'excl-desk-drawer-ring-diary',
    filmElement: 'Dumbledore sliding Marvolo Gaunt\'s ring and Tom Riddle\'s diary out of a desk drawer in HBP',
    bookReality: 'Film HBP opening shot only. In HBP Ch. 10, Gaunt\'s cracked black-stoned ring sits visibly on a spindle-legged table inside the office alongside the Pensieve on the desk.',
    citation: 'Half-Blood Prince Ch. 10',
  },
  {
    id: 'excl-yellow-pages-library-arches',
    filmElement: 'Floor-to-ceiling multi-story library wall arches and bookshelves wrapping the office',
    bookReality: 'No bookcase or bookshelves are explicitly described in Dumbledore\'s office in any of the 7 novels (only a wall shelf behind the desk holding the Sorting Hat in CoS Ch. 12). DH Ch. 6 confirms solely that Dumbledore stored removed Horcrux books inside his office ("Accio Horcrux books" out the open window).',
    citation: 'Chamber of Secrets Ch. 12; Deathly Hallows Ch. 6',
  },
  {
    id: 'excl-elder-wand-snapping',
    filmElement: 'Harry snapping the Elder Wand in half and tossing it off the Hogwarts viaduct bridge',
    bookReality: 'In DH Ch. 36, Harry stands before Dumbledore\'s weeping portrait in the office, uses the Elder Wand to cast "Reparo" on his snapped holly wand, and intends to return the Elder Wand to Dumbledore\'s tomb.',
    citation: 'Deathly Hallows Ch. 36',
  },
  {
    id: 'excl-saxon-runes',
    filmElement: 'Pensieve carvings specifically called "ancient Saxon runes" (Pottermore/Wizarding World lore)',
    bookReality: 'GoF Ch. 30 strictly writes "odd carvings around the edge: runes and symbols that Harry did not recognize."',
    citation: 'Goblet of Fire Ch. 30',
  },
  {
    id: 'excl-chintz-armchair-lunar-chart',
    filmElement: 'Chintz armchair / cushions or paper "lunar chart" smashed in OoP Ch. 37',
    bookReality: 'In OoP Ch. 37, Harry smashes silver instruments, throws a "lunascope" into the fireplace, and breaks a spindle-legged table. Chintz armchairs occur in Courtroom Ten (OoP Ch. 8) and Budleigh Babberton (HBP Ch. 4), not Dumbledore\'s office (where McGonagall conjures "straight-backed, wooden chairs" in OoP Ch. 22).',
    citation: 'Order of the Phoenix Ch. 8, 22 & 37; Half-Blood Prince Ch. 4',
  },
  {
    id: 'excl-wrong-room-conflations',
    filmElement: 'Conflating CoS Ch. 18, Book 1 Ch. 17, or PoA Lupin classroom / Flitwick\'s office with Dumbledore\'s office',
    bookReality: 'Book 1 has 0 office visits (Ch. 17 is the Hospital Wing). CoS Ch. 18 ("Dobby\'s Reward") takes place in Professor McGonagall\'s office. Book 3 (PoA) has 0 office visits—Sirius is held in Flitwick\'s 7th-floor office, while the PoA film merely reused the Dumbledore\'s office set for Lupin\'s classroom.',
    citation: 'Philosopher\'s Stone Ch. 17; Chamber of Secrets Ch. 18; Prisoner of Azkaban Ch. 21',
  },
  {
    id: 'excl-oaken-double-door-and-floor-confusion',
    filmElement: '"Oaken double door" wiki paraphrase and fixed "third floor" movie tour claims',
    bookReality: 'CoS Ch. 11/12 verbatim text specifies singular "a gleaming oak door". GoF Ch. 28 places the stone gargoyle on the second floor, whereas HBP Ch. 10 places it on the seventh floor.',
    citation: 'Chamber of Secrets Ch. 11–12; Goblet of Fire Ch. 28; Half-Blood Prince Ch. 10',
  },
];
