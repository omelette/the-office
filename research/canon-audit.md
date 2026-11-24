# Dumbledore's Office — Cross-Book Canon Audit Ledger (Books 1–7)

**Sources:** [canon-books-1to4.json](file:///c:/Development/Other/dumbledores-office/research/canon-books-1to4.json), [canon-books-5to7.json](file:///c:/Development/Other/dumbledores-office/research/canon-books-5to7.json), compiled into [canonData.js](file:///c:/Development/Other/dumbledores-office/src/canon/canonData.js).  
**Canon Policy:** Strictly grounded in J.K. Rowling's seven original Harry Potter novels (UK Bloomsbury / US Scholastic). All film set inventions, Pottermore/Wizarding World expansions, studio tour labels, video games, *Cursed Child*, and fan speculation are rejected and explicitly logged below.

---

## 1. Book-by-Book Visit Verification

| Book | Visits to Dumbledore's Office | Key Chapters & Canon Notes |
| --- | --- | --- |
| **1. Philosopher's / Sorcerer's Stone** | **0 visits** | No office visit and no gargoyle appearance. Final talk occurs in the Hospital Wing (Ch. 17). Ch. 1 introduces Dumbledore's fondness for sherbet lemons / lemon drops. |
| **2. Chamber of Secrets** | **1 visit** | Ch. 11 (end) / Ch. 12 (*The Polyjuice Potion*): First entrance via stone gargoyle, spiral staircase, oak door with brass griffin knocker; circular room, silver instruments on spindle-legged tables, snoozing portraits, enormous claw-footed desk, Sorting Hat on shelf behind desk, Fawkes on golden perch behind door (Burning Day rebirth). **Clarification:** Ch. 18 (*Dobby's Reward*) takes place in **Professor McGonagall's office**, not Dumbledore's. |
| **3. Prisoner of Azkaban** | **0 visits** | No office visit and no gargoyle appearance. Sirius is locked in **Professor Flitwick's seventh-floor office** (Ch. 21). |
| **4. Goblet of Fire** | **2 visits** (+1 corridor attempt) | Ch. 28 (*The Madness of Mr. Crouch*): Stone gargoyle explicitly located on the **second floor**. Ch. 29–30 (*The Dream* -> *The Pensieve*): *"Cockroach Cluster!"*, sound-permeable oak door, Gryffindor's sword in glass case, opaque black cabinet left ajar leaking silvery light, Pensieve basin. Ch. 36 (*The Parting of the Ways*): Sirius waiting, Harry seated facing desk, Fawkes flying from perch onto Harry's knee & healing leg wound. |
| **5. Order of the Phoenix** | **4 key scenes** | Ch. 22: Winter-night crisis, purple-and-gold dressing gown, McGonagall conjuring *"straight-backed, wooden chairs"*, Fawkes fire-flash, delicate smoke-serpent silver instrument (*"But in essence divided?"*), portrait network (Everard, Dilys Derwent, Phineas Nigellus, Dexter Fortescue, Armando Dippet). Ch. 27–28: Desk overturned, tables/instruments shattered, Fawkes escape, office sealed against Umbridge. Ch. 37: Pale-green dawn horizon out window, emerald Floo arrival, Harry's rampage (silver instruments, lunascope thrown into burning fire, broken spindle table). |
| **6. Half-Blood Prince** | **5+ scenes** | Ch. 10, 17, 20, 23, 25: Circular room restored; Pensieve on desk with 1–2 small crystal/glass bottles/phials; Gaunt's cracked black-stoned gold ring resting on a spindle-legged table (Ch. 10; ring appearance first described in Ch. 4). Ch. 29: Dumbledore's sleeping portrait appears in golden frame behind/over desk; McGonagall watches grounds through office window for Scrimgeour; Fawkes's lament drifts *"across the grounds and through the castle windows"* (to the Hospital Wing) before Fawkes departs Hogwarts forever. |
| **7. Deathly Hallows** | **2 visits** (+2 cross-references) | Ch. 6: Horcrux books kept in office zoomed out open window via *"Accio Horcrux books"*. Ch. 15: Fake sword in glass case vs. real sword last removed to break Gaunt's ring. Ch. 30: Snape flees school corridor (office vacant). Ch. 33: Password *"Dumbledore"*, Pensieve heaved from black cabinet onto desk, empty portraits, Snape's memories (silver doe leaping out window; hidden cavity behind hinged Dumbledore portrait). Ch. 36: Gargoyle knocked lopsided (*"Feel free"*), cheering portraits, weeping Dumbledore portrait behind headmaster's chair, holly wand mended with Elder Wand (*"Reparo"*). |

---

## 2. Included `CANON_OBJECTS` Citation & Minimal Bridging Ledger

### Entrance Sequence
- **`stone-gargoyle` — Stone Gargoyle Guardian** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 11/12: `"They marched in silence round a corner and she stopped before a large and extremely ugly stone gargoyle. 'Sherbet lemon!' she said. This was evidently a password, because the gargoyle sprang suddenly to life, and hopped aside as the wall behind him split in two."`
    - GoF Ch. 28 (UK spelling): `"Harry tore up the stone steps, through the oak front doors, and off up the marble staircase towards the second floor. Five minutes later he was hurtling towards a stone gargoyle standing halfway along an empty corridor."` *(US Scholastic uses `toward`.)*
    - DH Ch. 36: `“Can we go up?” he asked the gargoyle. “Feel free,” groaned the statue.`
  - *Minimal Structural Bridging:* Stone plinth in a short approach corridor stub outside the circular tower base; two-leaf parted stone wall behind it. Note canon floor shift: GoF Ch. 28 says 2nd floor, HBP Ch. 10 says 7th floor.
- **`spiral-staircase` — Moving Spiral Stone Staircase** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 11/12: `"Behind the wall was a spiral staircase which was moving smoothly upwards, like an escalator."`
    - CoS Ch. 11/12: `"They rose upwards in circles, higher and higher, until at last, slightly dizzy, Harry could see a gleaming oak door ahead, with a brass knocker in the shape of a griffin."`
  - *Minimal Structural Bridging:* Stone cylindrical stair shaft ascending from behind the split corridor wall up to the office door landing.
- **`oak-door-knocker` — Gleaming Oak Door & Brass Griffin Knocker** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 11/12: `"until at last, slightly dizzy, Harry could see a gleaming oak door ahead, with a brass knocker in the shape of a griffin."`
  - *Minimal Structural Bridging:* Single polished oak leaf (not double doors) hinged to open inward toward Fawkes's perch; sound-permeable (GoF Ch. 30); locks internally when enchanted (OoP Ch. 37).

### Architecture & Room Envelope
- **`circular-room` — Circular Tower Chamber** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 12: `"It was a large and beautiful circular room, full of funny little noises."`
    - HBP Ch. 10: `"The circular office looked just as it always did; the delicate silver instruments stood on spindle-legged tables, puffing smoke and whirring..."`
  - *Minimal Structural Bridging:* Single-level 6.5m-radius dressed ashlar stone cylinder, flagstone floor, simple woven rug under the desk zone, and timber-ribbed ceiling (exact floor/ceiling finish is structural bridging). Explicitly NO second floor/balcony/mezzanine.
- **`windows-grounds` — Tower Windows Overlooking Grounds** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - OoP Ch. 37: `"Harry looked through the window. There was a cool line of pale green along the horizon: dawn was approaching."`
  - *Canon Context (non-Hospital Wing):* In HBP Ch. 29, Professor McGonagall looks out the office window across the grounds while watching for Scrimgeour (note: the HBP Ch. 29 line `"across the grounds and through the castle windows"` describes Fawkes's lament reaching the Hospital Wing, not Dumbledore's office). Openable office windows are also verified by DH Ch. 6 (Horcrux books summoned out) and DH Ch. 33 (Snape's silver doe Patronus leaping out).
  - *Minimal Structural Bridging:* Two tall pointed-arch leaded-glass casements around the curved wall (exact window count and leaded mullion pattern are bridging).
- **`fireplace` — Stone Fireplace (Floo-Connected)** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - OoP Ch. 37: `"The empty fireplace burst into emerald-green flame... As Dumbledore's tall form unfolded itself from the fire..."`
    - OoP Ch. 37: `“I DON'T CARE! I've had enough, I've seen enough, I want out, I want it to end, I don't care anymore —”` *(followed by Harry snatching up a lunascope and throwing it into the burning fire).*
  - *Minimal Structural Bridging:* Carved stone hearth and mantle recessed into the side arc with iron grate and toggleable orange vs. emerald Floo fire (mantle molding is structural bridging).

### Furniture & Seating
- **`claw-footed-desk` — Enormous Claw-Footed Desk** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 12: `"There was also an enormous, claw-footed desk, and, sitting on a shelf behind it, a shabby, tainted wizard’s hat — the Sorting Hat."` *(Edition variant: `tainted` vs `tattered`)*
    - DH Ch. 33: `"The stone Pensieve lay in the cabinet where it had always been: Harry heaved it on to the desk and poured Snape's memories into the wide basin with its runic markings around the edge."`
  - *Minimal Structural Bridging:* Large dark-oak writing desk (~2.4m) on sculpted claw feet facing the entrance (wood species & inkwell/parchment dressing are bridging).
- **`headmaster-chair` — Headmaster's Chair** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - DH Ch. 36: `"Harry had eyes only for the man who stood in the largest portrait directly behind the headmaster’s chair."`
  - *Minimal Structural Bridging:* High-backed carved dark oak armchair with burgundy velvet seat cushion positioned behind the desk beneath Dumbledore's portrait. **Explicit check:** Wood species, back profile, and burgundy velvet upholstery are minimal structural bridging choices not specified in the novels (zero chintz).
- **`visitor-chairs` — Visitor Seating Facing the Desk** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - OoP Ch. 22: `"...Professor McGonagall drew up three straight-backed, wooden chairs..."`
  - *Canon Context:* Harry also sits in a chair/armchair facing Dumbledore's desk in GoF Ch. 36 (when Fawkes lands on his knee), OoP Ch. 37 (after his rampage), and HBP Ch. 10–23.
  - *Minimal Structural Bridging:* Two wooden visitor armchairs facing the desk. **Explicit check:** Carved oak finish and dark leather/plain cushion detailing are minimal structural bridging choices not specified in the novels. No novel places chintz armchairs in Dumbledore's office (chintz appears in OoP Ch. 8 Courtroom Ten and HBP Ch. 4 Budleigh Babberton).
- **`spindle-tables` — Spindle-Legged Tables** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 12: `"A number of curious silver instruments stood on spindle-legged tables, whirring and emitting little puffs of smoke."`
    - HBP Ch. 10: `"The circular office looked just as it always did; the delicate silver instruments stood on spindle-legged tables, puffing smoke and whirring..."`
  - *Minimal Structural Bridging:* Seven slender turned-leg wooden occasional tables arranged along the circular perimeter.
- **`black-cabinet` — Black Cabinet (Pensieve Cabinet)** (`gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - GoF Ch. 30: `"black cabinet"` (door left improperly fastened/ajar by Dumbledore before Fudge arrived, leaking a bright sliver of silvery-white light onto the glass sword case).
    - DH Ch. 33: `"The stone Pensieve lay in the cabinet where it had always been: Harry heaved it on to the desk and poured Snape's memories into the wide basin with its runic markings around the edge."`
  - *Minimal Structural Bridging:* Single-bay opaque black-stained oak cabinet with solid paneled door(s) placed opposite the glass sword case (closed oak doors remain recessed in the East alcove in CoS to seal the wall cavity).

### Instruments, Portraits, Creatures & Artifacts
- **`horcrux-books` — Stored Horcrux Books** (`hbp`, `dh`)
  - *Quotes:*
    - DH Ch. 6: `"Accio Horcrux books"`
  - *Explicit Canon Check:* **No bookcase or bookshelves are explicitly described anywhere in Dumbledore's office across all 7 novels** (wall bookcases are film-set dressing; the only `"shelf"` attested in the office is behind the desk holding the Sorting Hat in CoS Ch. 12). DH Ch. 6 confirms solely that Dumbledore removed library volumes on Horcruxes and kept them in his office until Hermione summoned them out of his open window after his funeral.
  - *Minimal Structural Bridging:* Small single-tier carved dark-oak side shelf/case holding bound Horcrux texts in HBP (visibly depleted in DH)—explicitly rejecting the film's two-story library rotunda.
- **`silver-instruments` — Curious Silver Instruments** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:* CoS Ch. 12 & HBP Ch. 10 (see `spindle-tables`).
  - *Minimal Structural Bridging:* Burnished tabletop silver mechanisms (spinning dials, gyro-rings, smoke tubes) on the spindle tables; no ceiling orrery.
- **`smoke-serpent-instrument` — Delicate Smoke-Serpent Silver Instrument** (`oop`, `hbp`, `dh`)
  - *Quotes:* OoP Ch. 22: `"Naturally, naturally... But in essence divided?"`
  - *Minimal Structural Bridging:* Slender spouted silver instrument emitting pale green smoke that splits into two serpents.
- **`lunascope` — Lunascope** (`oop`)
  - *Quotes:* OoP Ch. 37: `“I DON'T CARE! I've had enough, I've seen enough, I want out, I want it to end, I don't care anymore —”` *(Harry snatches up a lunascope and throws it into the burning fire).*
  - *Minimal Structural Bridging:* Tabletop brass-and-silver moon-phase instrument positioned near the hearth in the OoP era (never a paper "lunar chart").
- **`portraits` — Portraits of Former Headmasters & Headmistresses** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 12: `"covered with portraits of old headmasters and headmistresses, all of whom were snoozing gently in their frames."`
    - OoP Ch. 27: `"You know, Minister, I disagree with Dumbledore on many counts... but you cannot deny he's got style..."`
    - DH Ch. 36: `“And let it be noted that Slytherin House played its part! Let our contribution not be forgotten!”`
  - *Minimal Structural Bridging:* Framed oil portraits mounted around the curved wall arc with both snoozing (eyes-closed) and awake textures.
- **`dumbledore-portrait` — Portrait of Albus Dumbledore (& Hidden Cavity)** (`hbp`, `dh`)
  - *Quotes:* DH Ch. 36: `"Harry had eyes only for the man who stood in the largest portrait directly behind the headmaster’s chair."`
  - *Minimal Structural Bridging:* Largest gilded portrait centered behind the headmaster's chair; side-hinged frame swings outward to expose a recessed stone cavity for the real Sword of Gryffindor (DH Ch. 33).
- **`sorting-hat` — The Sorting Hat** (`cos`, `gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - CoS Ch. 12: `"There was also an enormous, claw-footed desk, and, sitting on a shelf behind it, a shabby, tainted wizard’s hat — the Sorting Hat."`
    - CoS Ch. 12: `"Bee in your bonnet, Potter?"`
  - *Minimal Structural Bridging:* Slumped crinkled felt/leather pointed hat on an oak wall shelf behind the desk.
- **`fawkes-perch` — Fawkes the Phoenix & Golden Perch** (`cos`, `gof`, `oop`, `hbp`, `dh` [empty perch in `dh`])
  - *Quotes:*
    - CoS Ch. 12: `"Standing on a golden perch behind the door was a decrepit-looking bird which resembled a half-plucked turkey. Harry stared at it and the bird looked balefully back, making its gagging noise again. Harry thought it looked very ill. Its eyes were dull and, even as Harry watched, a couple more feathers fell out of its tail."`
    - CoS Ch. 12: `"Harry looked down in time to see a tiny, wrinkled, newborn bird poke its head out of the ashes. It was quite as ugly as the old one."`
    - GoF Ch. 36: `"scarlet-and-gold bird"`
  - *Minimal Structural Bridging:* Floor-standing gilded ring perch directly behind the inward-swinging oak door; phoenix animates across `burning-day` (CoS), `scarlet-gold` (GoF/OoP), `lamenting` (HBP Ch. 29—heard in Hospital Wing before departing forever), and `absent` (DH).
- **`pensieve` — The Pensieve** (`gof`, `oop`, `hbp`, `dh`)
  - *Quotes:*
    - GoF Ch. 30: `"A shallow stone basin lay there, with odd carvings around the edge: runes and symbols that Harry did not recognize."`
    - GoF Ch. 30: `"light made liquid – or like wind made solid"`
    - DH Ch. 33: `"The stone Pensieve lay in the cabinet where it had always been: Harry heaved it on to the desk and poured Snape's memories into the wide basin with its runic markings around the edge."`
  - *Minimal Structural Bridging:* Shallow carved stone basin with procedural runic rim and custom GLSL swirling bright whitish-silver liquid-light shader.
- **`memory-phials` — Crystal Memory Phials** (`hbp`, `dh`)
  - *Verified Object Phrases:*
    - HBP Ch. 20: `"two tiny crystal bottles"` (beside the Pensieve on the desk)
    - HBP Ch. 23: `"glass phial"` (Slughorn's memory)
    - DH Ch. 33: `"flask"` (Snape's dying memories)
  - *Minimal Structural Bridging:* Pair of small stoppered glass phials beside the Pensieve on the desk in HBP and DH (never hundreds of wall jars).
- **`gryffindor-sword-case` — Sword of Gryffindor in Glass Display Case** (`gof`, `oop`, `hbp`, `dh`)
  - *Quotes & Citations:*
    - CoS Ch. 18 (McGonagall's office — physical sword description): `"its handle glittering with rubies the size of eggs."`
    - GoF Ch. 30 (first appearance in Dumbledore's office): `"glass case"` (catching dancing silvery light from the ajar black cabinet).
    - DH Ch. 15 & Ch. 33: Fake replica in glass case while real sword hides in cavity behind Dumbledore's hinged portrait.
  - *Minimal Structural Bridging:* Wall-mounted oak-and-glass display case facing the black cabinet.
- **`gaunt-ring` — Marvolo Gaunt's Cracked Ring** (`hbp`)
  - *Quotes & Citations:*
    - HBP Ch. 4 (physical description on Dumbledore's hand): `"...set with a heavy black stone that had cracked down the middle"`
    - HBP Ch. 10 (in Dumbledore's office): Cracked black-stoned gold ring rests visibly on a spindle-legged table alongside Dumbledore's blackened hand (also seen on the desk in Snape's memory in DH Ch. 33).
  - *Minimal Structural Bridging:* Heavy tarnished gold band with cracked black stone resting openly on a spindle-legged table near the desk in HBP (not in a desk drawer).

---

## 3. Book Era Presets (`BOOK_ERAS`)

1. **`cos` (Book 2, Ch. 11–12):** Late Afternoon Dusk; Pensieve hidden; cabinet closed; Dumbledore portrait absent; Fawkes in `burning-day` state.
2. **`gof` (Book 4, Ch. 28–30 & 36):** Midnight Pensieve Vigil; Pensieve in `cabinet`; black cabinet `ajar` leaking silvery light onto glass sword case; Fawkes `scarlet-gold`.
3. **`oop` (Book 5, Ch. 22, 27–28 & 37):** `Night Crisis to Approaching Dawn` (winter-night crisis in Ch. 22 shifting to cool pale-green dawn horizon, emerald Floo arrival, and active hearth fire in Ch. 37); smoke-serpent instrument & lunascope present.
4. **`hbp` (Book 6, Ch. 10, 17, 20, 23 & 29):** Bleak Winter Night; Pensieve on `desk` with 1–2 tiny crystal phials/bottles; Gaunt's cracked ring on spindle table; Horcrux books present; Dumbledore's sleeping portrait appears in Ch. 29; Fawkes `lamenting` / departing.
5. **`dh` (Book 7, Ch. 15, 33 & 36):** Composite era combining **Ch. 33** (`blackCabinetState: 'open'`, `pensieveLocation: 'desk'`, hidden sword cavity behind hinged Dumbledore portrait, fake sword in glass case) with **Ch. 36** (`Golden Dawn After the Battle`, lopsided gargoyle groaning *"Feel free"*, cheering portraits, weeping Dumbledore portrait, holly wand mended with Elder Wand via *"Reparo"*). Fawkes `absent`.

---

## 4. Passwords Ledger (Books 1–7)

| Password | US / Text Variant | Book & Chapter | Speaker | Result |
| --- | --- | --- | --- | --- |
| `Sherbet lemon` | `Lemon drop` | CoS Ch. 11 / 12 | Prof. McGonagall | Accepted |
| `Sherbet lemon` + 7 other rejected sweets | `Lemon drop`, `Pear drop`, `Liquorice wand`, `Fizzing Whizzbees`, `Drooble's Best Blowing Gum`, `Bertie Bott's Every-Flavour Beans`, `Chocolate Frog`, `Sugar Quill` | GoF Ch. 28–30 | Harry Potter | Rejected (all 8) |
| `Cockroach Cluster` | `Cockroach Cluster` | GoF Ch. 29 / 30 | Harry Potter | Accepted |
| `Fizzing Whizzbee` | `Fizzing Whizzbee` | OoP Ch. 22 | Prof. McGonagall | Accepted |
| `Acid Pops` | `Acid Pops` | HBP Ch. 9–10 | Harry Potter (via Dumbledore's note) | Accepted |
| `Toffee Eclairs` | `Toffee Éclairs` | HBP Ch. 20 | Harry Potter | Accepted |
| `Dumbledore` | `Dumbledore` | DH Ch. 33 | Harry Potter (Snape's tenure) | Accepted |
| *(None — knocked aside)* | Groans `"Feel free"` | DH Ch. 36 | Harry / stone gargoyle | Open access |

---

## 5. Named Portraits Ledger

1. **Albus Dumbledore** (*HBP Ch. 29; DH Ch. 33, 36*): Long silver beard, crooked nose, half-moon spectacles; largest portrait in a golden frame directly behind/over the headmaster's chair; hinged side-to-side to conceal real Sword of Gryffindor.
2. **Phineas Nigellus Black** (*OoP Ch. 22, 27, 37; DH Ch. 15, 33, 36*): Black hair, pointed beard, Slytherin green-and-silver robes; linked to Number Twelve, Grimmauld Place.
3. **Everard** (*OoP Ch. 22*): Sallow-faced wizard with short black fringe; linked to Ministry of Magic.
4. **Dilys Derwent** (*OoP Ch. 22*): Elderly witch with long silver ringlets; linked to St. Mungo's Hospital.
5. **Dexter Fortescue** (*OoP Ch. 22*): Corpulent, red-nosed wizard with an ear trumpet.
6. **Armando Dippet** (*OoP Ch. 22, 37; alive in CoS Ch. 13*): Elderly, frail, nearly bald wizard with stray wisps of white hair.
7. **Absent Heads Note**: Neither **Dolores Umbridge** (office sealed against her in OoP Ch. 28) nor **Severus Snape** (abandoned post in DH Ch. 30; absent in DH Ch. 36) appears as a portrait in the seven novels.

---

## 6. Film-Only, Pottermore & Non-Canon Exclusions

1. **Golden/stone griffin entrance statue** → Books strictly have *"a large and extremely ugly stone gargoyle"* outside; the griffin is only the brass door knocker at the top of the spiral staircase.
2. **Two-story mezzanine / upper balcony & wraparound interior staircases** → Books describe a single-level circular room across all 7 novels.
3. **Giant hanging brass planetary orrery** → Film set invention; novels only describe tabletop silver instruments on spindle-legged tables and a tabletop lunascope.
4. **Towering glass-fronted double-door apothecary memory cabinet with hundreds of glowing vials** → Books describe an opaque black cabinet for the Pensieve and only 1–2 small crystal bottles/phials on the desk in HBP.
5. **Self-opening Pensieve cabinet doors** → In GoF Ch. 30, Dumbledore simply left the black cabinet door improperly fastened in haste.
6. **HBP desk-drawer scene with Riddle's diary and Gaunt's ring** → Film-only opening; in HBP Ch. 10, Gaunt's cracked ring sits visibly on a spindle-legged table.
7. **Floor-to-ceiling multi-story library arches & wall bookcases** → Film set dressing; no bookcase or bookshelves appear in Dumbledore's office in any of the 7 novels (DH Ch. 6 only confirms Dumbledore stored removed Horcrux books in his office).
8. **Snapping the Elder Wand on a bridge** → Film-only ending; in DH Ch. 36, Harry mends his holly wand with *"Reparo"* before Dumbledore's portrait inside the office.
9. **"Ancient Saxon runes" on the Pensieve** → Pottermore/Wizarding World lore, absent from GoF Ch. 30 (*"odd carvings around the edge: runes and symbols that Harry did not recognize"*).
10. **Chintz armchairs / cushions or paper "lunar chart" smashed in OoP Ch. 37** → Chintz armchairs occur in Courtroom Ten (OoP Ch. 8) and Budleigh Babberton (HBP Ch. 4), whereas McGonagall conjures *"straight-backed, wooden chairs"* in Dumbledore's office (OoP Ch. 22); OoP Ch. 37 explicitly specifies Harry threw a *lunascope* into the fireplace.
11. **Wrong-room conflations** → Book 1 Ch. 17 is the Hospital Wing; CoS Ch. 18 (*Dobby's Reward*) is McGonagall's office; PoA Ch. 21 is Flitwick's office (and the PoA film reused the office set for Lupin's classroom).
12. **"Oaken double door" & fixed "third floor" claims** → CoS Ch. 11/12 specifies singular *"a gleaming oak door"*; GoF Ch. 28 puts the gargoyle on the second floor while HBP Ch. 10 puts it on the seventh floor.
