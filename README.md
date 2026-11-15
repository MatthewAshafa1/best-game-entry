# Starlight Salvage

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/MatthewAshafa1/best-game-entry/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/MatthewAshafa1/best-game-entry/reward.svg)](https://make.fun/bounty/best-game-01)

An original arcade salvage game, built for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01). Pilot the skiff **Kestrel** through a debris field: bank the scrap, dodge the rocks, outgun the rogue drones — and spend your credits at the dock between waves.

## How to play

- **WASD / arrow keys** — fly
- **Mouse** — aim
- **Hold click / Space** — fire the blaster
- **P** — pause, **M** — mute

Collect the wave quota of scrap to clear the wave and open the dock, where credits buy Hull Plating, Magnet Coils, Ion Thrusters, a Twin Blaster and Shield Cells. Chain quick pickups to raise your combo multiplier. Lose all hull and the run ends — your best score is kept on the title screen.

## What's in it

- A complete loop: title → waves → dock upgrades → game over → restart
- Growing challenge: more asteroids and drones each wave, plus a rare relic worth a detour
- Feedback on every action: particles, screen shake, floating score text, combo pitch that climbs as you streak
- Synthesized sound (Web Audio, no audio files) and a quiet ambient pad
- All art drawn on canvas — no image assets, no network requests

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no dependencies.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
