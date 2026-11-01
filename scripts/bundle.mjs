import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const engineFiles = [
  'src/engine/WasmCore.js',
  'src/engine/Vector2.js',
  'src/engine/CloudPersistence.js',
  'src/ui/TouchControls.js',
  'src/engine/Input.js',
  'src/engine/AudioSynth.js',
  'src/ui/CRTOverlay.js',
  'src/engine/Renderer.js',
  'src/ui/MainMenu.js'
];

const gameFiles = [
  { file: 'src/games/LodeRunner.js', className: 'LodeRunner' },
  { file: 'src/games/DigDug.js', className: 'DigDug' },
  { file: 'src/games/DonkeyKong.js', className: 'DonkeyKong' },
  { file: 'src/games/Sumo.js', className: 'Sumo' },
  { file: 'src/games/PacMan.js', className: 'PacMan' },
  { file: 'src/games/Frogger.js', className: 'Frogger' },
  { file: 'src/games/Galaga.js', className: 'Galaga' },
  { file: 'src/games/SpaceInvaders.js', className: 'SpaceInvaders' },
  { file: 'src/games/Asteroids.js', className: 'Asteroids' },
  { file: 'src/games/Centipede.js', className: 'Centipede' },
  { file: 'src/games/Defender.js', className: 'Defender' },
  { file: 'src/games/Arkanoid.js', className: 'Arkanoid' },
  { file: 'src/games/Paperboy.js', className: 'Paperboy' },
  { file: 'src/games/Joust.js', className: 'Joust' },
  { file: 'src/games/Qbert.js', className: 'Qbert' },
  { file: 'src/games/Rampage.js', className: 'Rampage' },
  { file: 'src/games/MarbleMadness.js', className: 'MarbleMadness' },
  { file: 'src/games/Pitfall.js', className: 'Pitfall' },
  { file: 'src/games/DuckHunt.js', className: 'DuckHunt' },
  { file: 'src/games/Excitebike.js', className: 'Excitebike' },
  { file: 'src/games/MissileCommand.js', className: 'MissileCommand' },
  { file: 'src/games/BurgerTime.js', className: 'BurgerTime' },
  { file: 'src/games/BubbleBobble.js', className: 'BubbleBobble' },
  { file: 'src/games/SpyHunter.js', className: 'SpyHunter' },
  { file: 'src/games/Tron.js', className: 'Tron' },
  { file: 'src/games/TrackAndField.js', className: 'TrackAndField' },
  { file: 'src/games/OutRun.js', className: 'OutRun' },
  { file: 'src/games/Contra.js', className: 'Contra' },
  { file: 'src/games/Galaxian.js', className: 'Galaxian' },
  { file: 'src/games/DigDug2.js', className: 'DigDug2' },
  { file: 'src/games/ElevatorAction.js', className: 'ElevatorAction' },
  { file: 'src/games/Tapper.js', className: 'Tapper' },
  { file: 'src/games/LunarLander.js', className: 'LunarLander' },
  { file: 'src/games/Tempest.js', className: 'Tempest' },
  { file: 'src/games/Robotron.js', className: 'Robotron' },
  { file: 'src/games/Sinistar.js', className: 'Sinistar' },
  { file: 'src/games/CrystalCastles.js', className: 'CrystalCastles' },
  { file: 'src/games/Zaxxon.js', className: 'Zaxxon' },
  { file: 'src/games/MoonPatrol.js', className: 'MoonPatrol' },
  { file: 'src/games/Pengo.js', className: 'Pengo' },
  { file: 'src/games/RallyX.js', className: 'RallyX' },
  { file: 'src/games/RoadFighter.js', className: 'RoadFighter' },
  { file: 'src/games/Flicky.js', className: 'Flicky' },
  { file: 'src/games/Mappy.js', className: 'Mappy' },
  { file: 'src/games/CircusCharlie.js', className: 'CircusCharlie' },
  { file: 'src/games/BattleCity.js', className: 'BattleCity' },
  { file: 'src/games/KungFuMaster.js', className: 'KungFuMaster' },
  { file: 'src/games/WildGunman.js', className: 'WildGunman' },
  { file: 'src/games/Exerion.js', className: 'Exerion' },
  { file: 'src/games/TetrisRetro.js', className: 'TetrisRetro' }
];

function stripESM(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+.*$/gm, '')
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^\s*export\s+(class|const|let|var|function)\s+/gm, '$1 ');
}

let out = '/* Retro Arcade Studio — Self-Contained Universal Bundle (file://, http://, and https:// compatible) */\n(function() {\n"use strict";\n';

for (const file of engineFiles) {
  const raw = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
  out += `\n// === ${file} ===\n` + stripESM(raw) + '\n';
}

for (const g of gameFiles) {
  const raw = fs.readFileSync(path.join(ROOT_DIR, g.file), 'utf8');
  out += `\n// === ${g.file} ===\nconst ${g.className} = (function() {\n` + stripESM(raw) + `\nreturn ${g.className};\n})();\n`;
}

const mainRaw = fs.readFileSync(path.join(ROOT_DIR, 'src/main.js'), 'utf8');
out += `\n// === src/main.js ===\n` + stripESM(mainRaw) + '\n})();\n';

fs.mkdirSync(path.join(ROOT_DIR, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT_DIR, 'dist/bundle.js'), out, 'utf8');
console.log(`Generated dist/bundle.js (${Math.round(out.length / 1024)} KB)`);
