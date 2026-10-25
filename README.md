# Street Story

*Working title.* A mobile-first 3D street-restoration game. You start on a run-down street with $0 and bring it back to life: mow the lawn, buy the abandoned café, sell espresso, upgrade, and restore the block one project at a time.

Prototype #1 ends on a hook. After about 15 minutes the street has visibly changed, two shops are running, and the glowing **Bakery — $5,000** is just out of reach.

## Play it

```sh
npm start          # http://localhost:8000, plus a LAN address for your phone
```

There's no build step and nothing to install for the web version. Three.js and the font are vendored in `vendor/`, so it also works offline. Add `?debug=1` to the URL for cash and speed buttons.

## The loop

1. **Mow**: swipe across the lawn. Overgrown tufts take two passes, so you swipe back and forth. Grass flies and coins pop out. The lawn pays about $100, enough for the café. Regrown lawn only pays a quarter per tuft, so mowing never becomes the real income.
2. **Buy the café** ($100): boards fly off, the sign flickers on, customers arrive.
3. **Serve**: a customer shows an order bubble. Tap the shop to make the order, then tap again to hand it over.
4. **Zoom in to work a shop**: use the magnifier buttons, a pinch, or a double-tap on a shop. There are two zoom levels. While zoomed, drag with two fingers to move left, right, up and down the street (a flick keeps it gliding). A one-finger drag off the lawn also works, which helps with a mouse. The arrows jump straight to the next shop. A drag that starts on the lawn still mows, even zoomed in.
5. **Run several shops at once**: the bottom row shows every opportunity you can take on right now (Flower Shop, New sidewalk, trash…), not one at a time. Each shop has its own customers and its own upgrades (green arrow above it). That spreads your money and your attention.
6. **Restore the street**: sidewalk (*choose cobblestone, limestone or brick*), landscaping (*choose pink, blue or white*), streetlights, then the glowing **bakery**.

## The pinch point (where $0.99 comes in)

The opening stays generous on purpose: no impatient customers, no timers worth skipping, no paid offers. Once the player is **both** 6 minutes in **and** has opened the flower shop, the street gets busy:

- **Customers have patience.** A ring on each order bubble drains and turns red. If it empties, the customer leaves and a red **−$8** floats up. If a queue is full, passers-by go elsewhere and that shows up as a loss too.
- **Rush hours** every 2½ minutes triple foot traffic for 40 seconds. A live counter shows money lost during the rush, and the summary says it out loud: "You lost $64 to waiting customers."
- **Offers appear only now**: *Helpers · $0.99* during a rush (every shop serves itself until the rush ends), *Finish now · $0.99* on build timers, and *+$1,000 · $0.99* near the bakery.

The in-game fix is hiring staff, which is also the best money sink. So the $0.99 is a shortcut, never the only way out. Every timing and threshold is in `pressure` and `monetization` in the config.

### Fake doors in prototype #1

No payments exist in this build. The $0.99 buttons look real. A tap records the intent, reveals that nothing was charged, and grants the reward for free. Set `monetization.mode` to `"off"` in the config to hide these buttons.

Open **Settings → Playtest stats** after a session to see when pressure started, how much was lost, when the first $0.99 tap happened, and when the bakery appeared and was bought. **Copy full log** gives the raw event list.

## Tuning without rebuilding

Every price, reward, timer and rate lives in [`config/game.json`](config/game.json). Edit it and reload.

```sh
npm run sim        # simulates a typical player and prints when each purchase happens
```

With the current config, a player who keeps buying every upgrade unlocks the bakery at about 12½ minutes and reaches $5,000 at about 21. A player who starts saving once the bakery glows (`SAVER=1 npm run sim`) has $4,720 at about 17 minutes. Impatient customers cost them $400–1,500 along the way, depending on how much staff they hired.

## Code map

| Path | What it does |
| --- | --- |
| `config/game.json` | Economy and content data |
| `src/economy.js` | Pure pricing rules, shared by the game and the simulator |
| `src/game.js` | Game flow: input, zoom, shop service, projects, upgrades, builds, rush hours, fake doors, stats |
| `src/scene/stage.js` | Renderer, elevated three-quarter camera that fits any phone, lighting |
| `src/scene/street.js` | Road, sidewalks and the four paving styles, lamps, park beds, trash |
| `src/scene/buildings.js` | Shops with neglected and restored looks, the restore animation, the hook beam |
| `src/scene/grass.js` | Instanced grass, cutting, regrowth, mowed-lawn patches |
| `src/scene/people.js` | Pedestrians, customers, baristas |
| `src/scene/fx.js`, `mower.js` | Particles, coin pops, the mower |
| `src/ui/` | HUD, bottom card, world-anchored bubbles, sheets, modals, icons |
| `tools/` | `sim.mjs` (pacing), `serve.mjs` (local server), `build.mjs` (app bundle) |

## Shipping to iOS and Android

See [docs/PUBLISHING.md](docs/PUBLISHING.md). In short, the same web build is wrapped with Capacitor (`npm run ios` / `npm run android`).
