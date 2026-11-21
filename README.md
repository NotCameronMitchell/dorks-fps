# DORKS

A 3v3 hero shooter for phones, starring the group chat. Runs in the browser (three.js), no app store needed.

## Play / develop

```
npm install
npm run dev      # then open the printed Network URL on your phone (same Wi-Fi)
npm run build    # static site in dist/, host it anywhere
```

On a phone: hold it sideways, and use "Add to Home Screen" for full screen.

- **Touch:** left thumb moves, right thumb looks. Fire button (drag on it to keep aiming), jump, three abilities, ultimate. Auto-fire and light aim assist are on by default (toggle in the pause menu).
- **Desktop:** WASD + mouse, click to fire, `E` / `Shift` / `F` abilities, `Q` ultimate, `Space` jump, `Esc` pause.

## What's in

- **Mode:** 3v3 control point vs bots. Capture the point, hold it to 100%. Overtime if the enemy is on it at 99%.
- **Heroes (9):** Mason, Cole, Cam, Henry, Sam (damage) · James, Grant (tank) · Sarah, Billy (support). Each has a weapon, a passive, three abilities and an ultimate. Kits live in `src/heroes.js`.
- **Maps (3):** The Local, Thrift Depot, Server Farm. Defined as data in `src/maps.js`; each is rotationally symmetric with a main route, two flanks, high ground and health packs.

## Code map

| File | What it does |
| --- | --- |
| `src/heroes.js` | Roster: stats, looks, weapons, abilities, bot hints. Add a hero here. |
| `src/maps.js` | Map layouts built from boxes and stairs. Add a map here. |
| `src/looks.js` | How each friend looks: proportions, colours, hair, hats, glasses, painted face and shirt. |
| `src/models.js` | Weapons, cats, projectiles, animation poses, and the old code-built characters (fallback only). |
| `src/rig.js` | Loads the anime character models from `public/models` and drives their skeletons. |
| `tools/anime/` | Script that builds each friend's model from the free VRoid sample avatars. |
| `src/game.js` | Match simulation: movement, damage, projectiles, zones, objective. |
| `src/world.js` | Collision, raycasts, navigation grid and pathfinding. |
| `src/bots.js` | Bot AI. |
| `src/input.js`, `src/hud.js`, `src/main.js` | Controls, HUD, menus and the render loop. |

Heroes only talk to the game through a small set of primitives (`shoot`, `hitscan`, `melee`, `zone`, `status`, `dash`, `heal`, ...), so new characters are mostly data. The simulation takes an "intent" per character (move, fire, abilities) whether it comes from a thumb or a bot, which is the seam online multiplayer will plug into later.

## Design notes

Drawn from write-ups of Blizzard's Overwatch GDC talks, Riot's clarity guidelines, and mobile FPS / three.js performance guides:

- Roles read at a glance: tanks are wide, Sam is tiny, every hero has a distinct colour block and headgear.
- Mobile aiming is imprecise, so the game leans on auto-fire, bullet magnetism and generous hitboxes instead of pixel aim.
- Draw calls are the mobile budget: each map is merged into one or two meshes, no shadows, capped pixel ratio.
- Maps are simple: one objective, readable chokes, flanks that reward mobility, high ground overlooking the point.
