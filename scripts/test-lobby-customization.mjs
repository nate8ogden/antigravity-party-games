import assert from 'node:assert/strict';
import { AudioSynth, SOUNDTRACKS, LOBBY_SOUND_THEMES } from '../src/engine/AudioSynth.js';
import { MainMenu, LOBBY_BACKGROUND_THEMES, GAME_CATALOG } from '../src/ui/MainMenu.js';

console.log('🎻 Testing Lobby Music & Background Customization Suite...');

// 1. Verify AudioSynth Lobby Themes & Piano / Cello Synthesis
const audio = new AudioSynth();
assert.ok(Array.isArray(LOBBY_SOUND_THEMES), 'LOBBY_SOUND_THEMES must be exported array');
assert.equal(LOBBY_SOUND_THEMES.length, 6, 'Must have 6 lobby sound themes (piano, cello, acoustic, synth, chill, 8bit)');

const pianoTheme = LOBBY_SOUND_THEMES.find((t) => t.id === 'piano');
assert.ok(pianoTheme, 'Piano theme must exist in LOBBY_SOUND_THEMES');
assert.ok(pianoTheme.label.includes('PIANO'), 'Piano theme must be clearly labeled');

const celloTheme = LOBBY_SOUND_THEMES.find((t) => t.id === 'cello');
assert.ok(celloTheme, 'Cello theme must exist in LOBBY_SOUND_THEMES');
assert.ok(celloTheme.label.includes('CELLO'), 'Cello theme must be clearly labeled');

const acousticTheme = LOBBY_SOUND_THEMES.find((t) => t.id === 'acoustic');
assert.ok(acousticTheme, 'Acoustic guitar theme must exist in LOBBY_SOUND_THEMES');

// Verify SOUNDTRACKS entries
assert.ok(SOUNDTRACKS.lobby, 'SOUNDTRACKS.lobby must exist');
assert.ok(SOUNDTRACKS.lobby_piano, 'SOUNDTRACKS.lobby_piano must exist');
assert.ok(SOUNDTRACKS.lobby_cello, 'SOUNDTRACKS.lobby_cello must exist');
assert.ok(SOUNDTRACKS.lobby_acoustic, 'SOUNDTRACKS.lobby_acoustic must exist');
assert.ok(SOUNDTRACKS.lobby_synth, 'SOUNDTRACKS.lobby_synth must exist');
assert.ok(SOUNDTRACKS.lobby_chill, 'SOUNDTRACKS.lobby_chill must exist');
assert.ok(SOUNDTRACKS.lobby_8bit, 'SOUNDTRACKS.lobby_8bit must exist');
assert.equal(SOUNDTRACKS.lobby_piano.leadWave, 'piano', 'lobby_piano leadWave must be piano');
assert.equal(SOUNDTRACKS.lobby_cello.leadWave, 'cello', 'lobby_cello leadWave must be cello');
assert.ok(!SOUNDTRACKS.lobby_cello.title.includes('Bach Cello Suite'), 'Bach Cello Suite replaced with lyrical cello piece');
console.log('✅ Concert Grand Piano & Lyrical Cello soundtracks verified in SOUNDTRACKS.');

// Verify audio theme cycling across all 6 themes
audio.setLobbySoundTheme('piano');
assert.equal(audio.getLobbySoundTheme(), 'piano');
assert.equal(audio.getLobbyTrackId(), 'lobby_piano');

audio.cycleLobbySoundTheme();
assert.equal(audio.getLobbySoundTheme(), 'cello');
assert.equal(audio.getLobbyTrackId(), 'lobby_cello');

audio.cycleLobbySoundTheme();
assert.equal(audio.getLobbySoundTheme(), 'acoustic');
assert.equal(audio.getLobbyTrackId(), 'lobby_acoustic');

audio.cycleLobbySoundTheme();
assert.equal(audio.getLobbySoundTheme(), 'synth');
assert.equal(audio.getLobbyTrackId(), 'lobby_synth');

audio.cycleLobbySoundTheme();
assert.equal(audio.getLobbySoundTheme(), 'chill');
assert.equal(audio.getLobbyTrackId(), 'lobby_chill');

audio.cycleLobbySoundTheme();
assert.equal(audio.getLobbySoundTheme(), 'chip');
assert.equal(audio.getLobbyTrackId(), 'lobby_8bit');

audio.cycleLobbySoundTheme();
assert.equal(audio.getLobbySoundTheme(), 'piano');
console.log('✅ Audio theme cycling across all 6 sound options verified.');

// 2. Verify MainMenu Background Themes & Customization
class MockRenderer {
  constructor() {
    this.width = 960;
    this.height = 540;
  }
  drawText() {}
}

class MockInput {
  constructor() {
    this.keysJustPressed = new Set();
    this.pointer = { x: 0, y: 0, justPressed: false };
  }
  isJustPressed() { return false; }
  isKeyJustPressed(code) { return this.keysJustPressed.has(code); }
}

const mockCtx = {
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  save() {},
  restore() {},
  translate() {},
  rotate() {},
  scale() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  quadraticCurveTo() {},
  bezierCurveTo() {},
  arc() {},
  ellipse() {},
  closePath() {},
  fill() {},
  stroke() {},
  fillRect() {},
  strokeRect() {},
  fillText() {},
  measureText() { return { width: 30 }; },
  rect() {},
  clip() {}
};

const renderer = new MockRenderer();
const input = new MockInput();
const menu = new MainMenu(renderer, input, audio, () => {});

assert.ok(Array.isArray(LOBBY_BACKGROUND_THEMES), 'LOBBY_BACKGROUND_THEMES must be exported array');
assert.equal(LOBBY_BACKGROUND_THEMES.length, 6, 'Must have 6 clean background themes');
assert.ok(!LOBBY_BACKGROUND_THEMES.some((t) => t.id === 'cello'), 'Cello background must be removed');
assert.ok(!LOBBY_BACKGROUND_THEMES.some((t) => t.id === 'piano'), 'Piano background must be removed');
console.log('✅ 6 Clean Lobby Background Themes verified (cello and piano backgrounds removed).');

// Test background theme cycling
const initialBg = menu.backgroundTheme;
menu.cycleBackgroundTheme();
assert.notEqual(menu.backgroundTheme, initialBg, 'cycleBackgroundTheme must change background');
console.log(`✅ Background cycled to ${menu.backgroundTheme}.`);

// Test rendering each of the 6 background themes without errors
for (const bg of LOBBY_BACKGROUND_THEMES) {
  menu.setBackgroundTheme(bg.id);
  assert.equal(menu.backgroundTheme, bg.id);
  assert.doesNotThrow(() => {
    menu.render(mockCtx);
  }, `Rendering background theme '${bg.id}' must execute cleanly`);
}
console.log('✅ All 6 background themes render cleanly on Canvas.');

// Test Hotkeys: KeyB for background, KeyM for sound
input.keysJustPressed.add('KeyB');
const beforeBg = menu.backgroundTheme;
menu.update(0.016);
assert.notEqual(menu.backgroundTheme, beforeBg, 'KeyB must cycle background theme');
input.keysJustPressed.clear();

input.keysJustPressed.add('KeyM');
const beforeSnd = audio.getLobbySoundTheme();
menu.update(0.016);
assert.notEqual(audio.getLobbySoundTheme(), beforeSnd, 'KeyM must cycle sound theme');
input.keysJustPressed.clear();
console.log('✅ Keyboard shortcuts [B] and [M] verified.');

// Test pointer clicks on canvas pills
// 1. BG pill
input.pointer.x = menu.bgButtonRect.x + 10;
input.pointer.y = menu.bgButtonRect.y + 10;
input.pointer.justPressed = true;
const prePillBg = menu.backgroundTheme;
menu.update(0.016);
assert.notEqual(menu.backgroundTheme, prePillBg, 'Clicking BG pill must cycle background');

// 2. Sound pill
input.pointer.x = menu.soundButtonRect.x + 10;
input.pointer.y = menu.soundButtonRect.y + 10;
input.pointer.justPressed = true;
const prePillSnd = audio.getLobbySoundTheme();
menu.update(0.016);
assert.notEqual(audio.getLobbySoundTheme(), prePillSnd, 'Clicking Sound pill must cycle sound');
console.log('✅ Canvas pill click hitboxes verified.');

console.log('🏆 LOBBY MUSIC & BACKGROUND CUSTOMIZATION SUITE: ALL TESTS PASSED!');
