// Ridge Runner — the entrypoint (Node 22, standard library only).
// The grader runs this program in a fresh container with no network: it
// reads this repository at the submitted commit and writes the entry to
// /output. The program copies the playable game and its screenshots there
// and writes dossier.json, the summary the judge reads, with the vendored
// make.fun library. Running it twice writes the same bytes twice.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one directory tree when it exists; the game always does. */
function copyTree(name) {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes;
// the rest refuse an entry the scorer would refuse (more than 4 screenshots
// or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files in all, or a path under game/ over 1000 bytes: game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
