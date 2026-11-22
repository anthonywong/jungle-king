# Lion versus tiger artwork — injury revision

Historical version: the current approved action and production animation are documented in [lion-tiger-film-v3.md](lion-tiger-film-v3.md).

Updated on 2026-11-18 using the built-in image generation tool in reference-image/edit mode, following the request for an injured tiger and smoother animation.

- Runtime assets: [attack atlas](../game/assets/lion-vs-tiger/drafts/lion-tiger-attack-v2.webp) and [injury atlas](../game/assets/lion-vs-tiger/drafts/lion-tiger-injured-v2.webp). Each is 1536 × 1024 with a 4 × 4 grid, giving 32 distinct 384 × 256 drawings.
- Generated source files: `exec-b0e36fad-6f82-4596-b2f7-3c84158bca8e.png` (attack) and `exec-215c5719-4300-4e44-bff4-0c31485ea80a.png` (final injury correction). Both are converted to WebP at quality 92. The intermediate injury image was `exec-68028a5c-8a63-410d-a25d-bd73e79dee1e.png`.
- The first 16-frame atlas remains at `game/assets/lion-vs-tiger/drafts/lion-tiger-atlas.webp` for reference; it is no longer embedded in the playable build.
- Action advances at 12 drawings per second, with a 0.28-second opening and 0.65-second ending hold. Total duration is 3.43 seconds. This uses additional drawn poses, not frame duplication or whole-image dissolves.
- First contact is pose 13; landing is pose 21. Audio cues follow this independent timeline, leaving the original lion/leopard and elephant/tiger timings unchanged.
- The tiger receives small shoulder scratches, recoils, protects its foreleg and sinks into a defeated resting pose. The injury is non-graphic and the tiger remains alive.
- Reduced motion shows three still poses: opening, injury reaction and defeated ending.
- Both atlases must load before this film renders. A missing page uses the existing lion-only fallback at its original valid pose range.
- The browser regression suite checks all 32 distinct crops, actual playback order, reduced-motion poses, skip/completion, missing-page fallback, and pixel equality of all 29 original lion/leopard and elephant/tiger frames.

## Revision prompts

### Attack page

Use case: illustration-story, animation revision. The attached 4x4 sprite atlas is the edit/reference target. Rebuild its action as PAGE ONE of a smoother 32-pose lion-versus-tiger animation. Produce exactly ONE 4-column by 4-row atlas, 16 equal landscape panels, 1536x1024 pixels, no borders, no gutters, no text. Read row-major. Preserve the reference's golden-maned lion, striped Bengal tiger, realistic ink-watercolor manhua rendering, cool Chinese mountain backdrop and rocky ledge. Fixed side-on camera, same mountain contours in every cell, same scale, no cuts, whole animals inside every frame. Lion LEFT facing right, tiger RIGHT facing left. Their distance closes gradually; no abrupt jumps. Four legs each, consistent anatomy.
This sheet covers ONLY anticipation, leap and first impact: 16 small consecutive increments, not a whole fight. Keep silhouettes subtly different in adjacent cells with genuine in-between drawings. Row1: (1) standing faceoff, (2) lion slightly lowers head, (3) bends front legs a little, (4) lowers shoulders more. Row2: (5) deep crouch, (6) hind legs compress, (7) rear legs start pushing, forepaws lift, (8) forequarters lift further. Row3: (9) rear paws leave ground, (10) airborne body moves slightly right, paws tucked, (11) approaches tiger with leading forepaw beginning to extend, (12) forepaw reaches further, tiger raises defensive foreleg. Row4: (13) nearly touches tiger, (14) first lion forepaw contact with tiger's near shoulder, (15) shoulder struck, tiger flinches, (16) paw follows through as tiger leans back in pain.
User specifically wants tiger INJURED: from cell14 onward show three small dark-red superficial claw scratches on the tiger's near shoulder and a tiny smear of blood in the fur, persisting in15-16. Clear but non-graphic injury, no gore, no exposed tissue, no dismemberment. Lion remains uninjured. Minimal dust at contact, no exaggerated impact graphics. Last frame lion still extended with paw on tiger shoulder; tiger head recoils, near foreleg begins buckling. Do NOT show retreat or victory on this first sheet. Background and markings must stay consistent frame to frame.

### Injury page

Use case: illustration-story. The attached atlas is PAGE ONE of a 32-frame animation. Generate PAGE TWO as a separate single 4-column by 4-row atlas, 16 landscape cells, 1536x1024 pixels, exact equal cells, NO gutters, borders, text or numbers. Continue directly from the BOTTOM-RIGHT cell of the reference: airborne golden lion at LEFT with forepaw extended into the near shoulder of striped tiger at RIGHT. Tiger leaning backward with three small dark-red claw scratches and a little blood in near shoulder fur.
Match that reference exactly: same cool Chinese mountains at identical positions, fixed side-view framing and rocky ledge; same animal designs, scale and light, no camera cuts, gradual small changes in neighboring cells. Draw realistic ink/watercolor manhua with precise feline anatomy, four legs each. Preserve head and limbs across frames. Keep BOTH whole animals fully visible throughout. Animals must NEVER swap sides. Injury persists for ALL16 cells: clearly visible three superficial dark-red scratch marks on tiger near shoulder, tiny blood smear in fur, no gore or exposed tissue. Tiger is hurt, not dead. Its ears flatten, eyes narrow in pain, and it keeps weight off the injured front leg.
This page is slow sequential follow-through, landing, injury reaction and defeat. Exact row-major poses:
1 continue contact from bottom-right reference with lion forepaw on tiger shoulder and tiger flinching;
2 lion begins retracting forepaw a little, tiger near shoulder lowers;
3 lion forepaw retracts further as front body descends, tiger recoils with near foreleg bent;
4 lion front paws approach ground, tiger shifts weight to uninjured far foreleg;
5 lion front paws land on rock, tiny dust, tiger staggers a small step right;
6 lion bends landing forelegs, tiger raises injured forepaw protectively;
7 lion rear paws lower, tiger wincing, one limping half-step right;
8 lion rear paws touch ground, tiger finishes limping step and droops head;
9 lion settles low on all fours, tiger's injured foreleg starts to buckle;
10 lion starts raising head slightly, tiger lowers chest slightly;
11 lion raises shoulders slightly, tiger chest sinks further with injured leg folded;
12 lion rises to standing gradually, tiger's healthy foreleg bends;
13 lion almost standing proudly, tiger lowered onto elbows;
14 lion stands, tiger rests chest on rock, head still raised with strained expression;
15 lion holds stance, tiger eases head lower, still awake;
16 lion standing left and injured tiger collapsed in a low defeated crouch at RIGHT, ears back, eyes open, visible shoulder scratches. Hold this quiet ending, no running away, no disappearance, no triumphant tiger, no sudden perspective or scale changes.
IMPORTANT this page must NOT repeat anticipation or leap. It's the continuation after impact. Keep all changes small and progressive for smooth playback, not comic storytelling cuts.

### Injury consistency correction

undefined

---

# Original 16-frame version (superseded)


Generated on 2026-11-18 using the built-in image generation tool, in reference-image mode. This is new artwork, not a replacement for either approved film.

- References: `game/assets/lion-vs-leopard/lion-vs-leopard-frame-00.webp`, `lion-vs-leopard-frame-07.webp`, `lion-vs-leopard-frame-15.webp`.
- Runtime asset: `game/assets/lion-vs-tiger/drafts/lion-tiger-atlas.webp`, 1536 × 1024, 4 columns × 4 rows, 16 poses read row first. Each pose is 384 × 256.
- Source generation: `exec-40ef80e0-4479-472c-89a6-8b2c74fd4ccf.png` in the session generated-image library; converted to WebP at quality 92 for offline embedding.
- The renderer caches individual canvas crops. The shared lion timeline selects each distinct pose; first contact is pose 8. The original lion/leopard timing, frames and audio remain unchanged.
- Only lion attacking tiger selects this film, for either army. Other opponents keep their existing matching visuals. If the atlas cannot load, the existing lion-only animation and tiger portrait provide a fallback.
- Preview: start the game, choose **獅對虎・逐格原畫** under **過場試映**, then **觀看**. Existing pause, half-speed, scrub, skip and reduced-motion controls apply. Choose **觀看** again to replay.

## Validation

Run `python3 tools/check.py` for logic, offline packaging and original media integrity checks. With Playwright and Chrome installed, run `node tests/lion-tiger-browser.cjs` for actual browser validation. The browser test opens the built game directly from disk, exercises preview controls and real captures, checks reduced motion and missing-atlas fallback, compares all 29 original film poses pixel-for-pixel against approved revision `02408e8`, and records desktop/phone screenshots in `checks/`. Phone coverage uses a simulated viewport, not a physical device.

## Exact generation prompt

Use case: illustration-story. Create ONE production animation atlas for a pre-generated, frame-by-frame 2D animal-chess capture cutscene. The attached images are STYLE AND CHARACTER REFERENCES ONLY: use their realistic ink-and-watercolor Chinese mountain manhua look and the same golden-maned lion. The spotted leopard must NOT appear in the new artwork: its opponent is an orange Bengal TIGER with unmistakable black stripes and a white muzzle. Output a landscape atlas, preferably 2048x1360 or 1536x1024, EXACTLY 4 columns by 4 rows of equal rectangular animation frames, edge-to-edge, zero gutters, zero panel borders, zero text or numbering. Each frame is a full landscape image to be displayed alone, read row-major left to right then top to bottom. Keep a steady side-view camera, the same rocky ledge and misty gray-blue Chinese mountains, identical animal designs and positions grounded consistently. Lion attacks from LEFT toward tiger on RIGHT. Both whole animals visible inside every frame, with room for tails and feet. Realistic feline anatomy, four legs each, no humans, no weapons, no gore. Lighting and palette match references: golden fur, black ink contours and hatching, cool gray mountains, pale mist. This is animation, so create genuinely distinct poses rather than repeat a still image. Frames in exact order: 1 faceoff, lion standing left tiger crouched right; 2 lion lowers head; 3 lion sinks deep into crouch and folds hind legs; 4 lion pushes off, rear paws still touching rock and forepaws rising; 5 lion airborne moving right forelegs tucked; 6 lion advances in midair forepaws reaching out as tiger lifts a defensive paw; 7 lion almost reaches tiger, extended leading forepaw, tiger braces; 8 first contact, lion forepaw strikes tiger shoulder, small burst of dust, no wounds; 9 contact follows through, tiger tilts back, lion mane whips; 10 tiger staggers backward to right, lion forepaws coming down; 11 lion lands on forepaws, tiger retreats a step right; 12 lion hind paws descend, dust drifts, tiger backing away; 13 lion settles into low stance, tiger recoils farther right; 14 lion rises, tiger turns away right; 15 lion stands proudly left-center while tiger remains small at far right edge; 16 lion holds victory stance and tiger retreats farther right, both visible. All frame boundaries must be precisely equally spaced because software will crop this atlas into 16 frames.
