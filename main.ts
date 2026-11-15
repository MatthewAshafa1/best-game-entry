// Starlight Salvage — make.fun best-game-01 entrypoint (Node 22, stdlib only).
//
// The game is plain static files under game/ (game/index.html plus its ES
// modules, no library, no network request). This program hands the entry in:
// it copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there with the vendored make.fun
// library, so the judge reads exactly the files the game ships.
//
// In the grader the output directory is /output. Anywhere else, set
// MAKEFUN_OUTPUT_DIR to point at a scratch folder instead:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output directory so a stale file can never ride along.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir)) {
  throw new Error(`game/ not found beside main.ts (looked in ${gameDir})`);
}
if (!existsSync(shotsDir)) {
  throw new Error(`screenshots/ not found beside main.ts (looked in ${shotsDir})`);
}

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): text_max_bytes is the only
// one that shapes the dossier's bytes; the rest refuse an entry the scorer
// would refuse anyway — more than 4 screenshots or one over 256 KiB, more
// than 993 files in game/ or 48 MiB of game files in all, or a game path
// over 1000 bytes. game/ counts beside /output's own 1000-entry cap, which
// its screenshots/ and dossier.json share, so the entry leaves them room.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Starlight Salvage handed in to ${outDir} (${dossier.length} byte dossier).`);
