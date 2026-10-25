# Street Story

*Working title.* A mobile-first 3D street-restoration game. You start on a run-down street with $0 and bring it back to life: mow the lawn, buy the abandoned café, sell espresso, upgrade, and restore the block one project at a time.

Prototype #1 ends on a hook. After about 10–15 minutes the street has visibly changed, the café earns money on its own, and the glowing **Bakery — $5,000** is just out of reach.

## Play it

```sh
npm start          # http://localhost:8000, plus a LAN address for your phone
```

There's no build step and nothing to install for the web version. Three.js and the font are vendored in `vendor/`, so it also works offline. Add `?debug=1` to the URL for cash and speed buttons.

## The loop

1. **Mow**: swipe across the lawn. A mower follows your finger, grass flies, coins pop out. The lawn pays about $100.
2. **Buy the café** ($100): boards fly off, the sign flickers on, customers arrive.
3. **Sell espresso**: a customer shows an order bubble. Tap the café to brew, then tap again to serve: $5.
4. **Upgrade the café** (green arrow above it): Espresso Machine II → Barista (automatic service) → Outdoor Seating → Latte Bar → Second Barista.
5. **Restore the street**, one project at a time on the bottom card: pick up trash → new sidewalk (*choose cobblestone, limestone or brick*) → flower shop → landscaping (*choose pink, blue or white flowers*) → streetlights → **bakery** → repave the road → boutique.

The first upgrade is instant. Later ones take real time and can be skipped for "$0.99".

## Monetization in prototype #1: fake doors

No payments exist in this build. The **$0.99 skip** and **+$1,000 for $0.99** buttons look real. A tap records the intent, reveals that nothing was charged, and grants the reward for free. This measures what matters, which is whether players want the bakery badly enough to pay. Set `monetization.mode` to `"off"` in the config to hide these buttons.

Open **Settings → Playtest stats** after a session to see when the bakery appeared, how long the player waited, and how many $0.99 taps happened. **Copy full log** gives the raw event list.

## Tuning without rebuilding

Every price, reward, timer and rate lives in [`config/game.json`](config/game.json). Edit it and reload.

```sh
npm run sim        # simulates a typical player and prints when each purchase happens
```

The current config puts the bakery card at about 11½ minutes, $4,729 of $5,000 at about 14¾ minutes, and the purchase at about 15 minutes.

## Code map

| Path | What it does |
| --- | --- |
| `config/game.json` | Economy and content data |
| `src/economy.js` | Pure pricing rules, shared by the game and the simulator |
| `src/game.js` | Game flow: input, café service, projects, upgrades, builds, fake doors, stats |
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
