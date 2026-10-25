# The District

A street-restoration idle game. You start on a run-down street and bring it back to life one swipe at a time.

## Build 1: first playable

Run-down street → swipe to cut overgrown grass → coins pop out → cash counter climbs → café unlocks at $100 → tap **BUY** → café transforms and opens → first customers arrive.

## Run it

No build step and no dependencies. Serve the folder and open it on a phone-sized viewport:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need a server, so opening `index.html` straight from the filesystem won't work.

## Where things live

| File | What it does |
| --- | --- |
| `src/config.js` | Economy and layout. **Pacing knobs live here** (`CAFE_PRICE`, `GRASS.*`). |
| `src/main.js` | Game loop, input (swipe and tap), purchase flow. |
| `src/grass.js` | Tufts, swipe cutting, regrowth, mowed-lawn patches. |
| `src/coins.js` | Coin pop/bounce physics and the fly-to-counter arc. |
| `src/cafe.js` | Café in derelict and open states, plus the buy transformation. |
| `src/customers.js` | Customers walk in, go inside, leave with a coffee. |
| `src/fx.js` | Clippings, dust, confetti, sparkles, swipe trail, the "CAFÉ OPEN!" banner. |
| `src/hud.js` | Cash pill, BUY button, mute button, tutorial hand. |
| `src/world.js` | Street backdrop: sky, neighbors, path, sidewalk, road, verge. |
| `artifact.html` | Same game, wrapped for publishing as a claude.ai artifact. |

All art is drawn in code on a 400×820 logical canvas that scales to the screen. Sound is synthesized with WebAudio, so the game ships with no asset files.

## Design rules

- Bright, polished, dimensional, extremely simple.
- No programmer-looking UI: every control is a drawn game object, never a browser default.
- Restoration should last. Cut grass grows back as healthy lawn, never as weeds again.

## Next milestones

1. Espresso serving: customers pay when served.
2. Café upgrades.
3. Hire the barista.
4. Passive income.
5. First street choice: pavement vs. landscaping.
