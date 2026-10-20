/**
 * AudioSynth.js
 * Procedural Web Audio API synthesizer for Retro Arcade Studio.
 * Zero external audio assets — all SFX, sirens, marching beats, and chiptunes
 * are synthesized in real-time using OscillatorNodes, GainNodes, and BiquadFilterNodes.
 */
export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.28;
    this._noiseBuffer = null;
    this._wakaToggle = false;
    this._marchIndex = 0;
    this._sequenceTimer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
      this._createNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  _ensureReady() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return !!this.ctx && !this.muted;
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.0; // 1.0s white noise buffer
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
    if (this.muted) {
      this.stopSequence();
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Jump Sound: Frequency sweep from 150Hz to 600Hz over 0.15s (Square wave)
   */
  playJump() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.155);
  }

  /**
   * Explosion / Popped: White noise buffer with exponential decay over 0.4s
   */
  playExplosion(duration = 0.4, filterFreq = 900) {
    if (!this._ensureReady() || !this._noiseBuffer) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + duration);
  }

  /**
   * Dig Dug Popped sound: pitch pop + 0.4s white noise exponential decay
   */
  playPop() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.095);

    this.playExplosion(0.4, 1400);
  }

  /**
   * Waka-Waka: Alternating pitch square wave tones
   */
  playWaka() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    this._wakaToggle = !this._wakaToggle;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    if (this._wakaToggle) {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.07);
    } else {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.07);
    }

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Siren: Modulating background siren pitch based on remaining dots ratio (0..1)
   */
  playSiren(remainingRatio = 1.0, frightened = false) {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = frightened
      ? 190
      : 220 + (1 - Math.max(0, Math.min(1, remainingRatio))) * 240;

    osc.type = frightened ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.28, now + 0.12);
    osc.frequency.linearRampToValueAtTime(baseFreq, now + 0.24);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Laser Blaster: Rapid pitch sweep down for player lasers
   */
  playLaser(startFreq = 1150, endFreq = 160, duration = 0.13) {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /**
   * Marching Beats: 4-note descending bass pulse for Space Invaders fleet steps
   */
  playMarch(stepOverride = null) {
    if (!this._ensureReady()) return;
    const notes = [98.0, 87.31, 82.41, 73.42]; // G2, F2, E2, D2 classic 4-note bass march
    const idx = stepOverride !== null ? stepOverride % 4 : this._marchIndex++ % 4;
    const freq = notes[idx];

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Digging debris sound (Lode Runner / Dig Dug)
   */
  playDig() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Dig Dug Pump Inflation stage sound (stages 1..3)
   */
  playPump(stage = 1) {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const base = 240 + stage * 120;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 1.4, now + 0.09);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.105);
  }

  /**
   * Sumo Shove / Heavy Impact
   */
  playShove() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Sumo Slap / Tsuppari Strike
   */
  playSlap() {
    this.playExplosion(0.11, 2400);
  }

  /**
   * Frogger / Q*bert Hop
   */
  playHop() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.065);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * Coin / Gold Pickup / Bonus Item
   */
  playCoin() {
    if (!this._ensureReady()) return;
    const now = this.ctx.currentTime;
    this.playNote(987.77, 0.07, 'square', 0.25, 0); // B5
    this.playNote(1318.51, 0.18, 'square', 0.25, 0.07); // E6
  }

  /**
   * Power-Up / Hammer / Ghost Eat / Spread Shot
   */
  playPowerUp() {
    if (!this._ensureReady()) return;
    const freqs = [330, 440, 554.37, 659.25, 880];
    freqs.forEach((f, i) => {
      this.playNote(f, 0.06, 'square', 0.24, i * 0.045);
    });
  }

  /**
   * Hit / Hurt / Collision
   */
  playHit() {
    if (!this._ensureReady()) return;
    this.playNote(180, 0.12, 'sawtooth', 0.3, 0);
    this.playNote(110, 0.16, 'sawtooth', 0.3, 0.06);
  }

  /**
   * UI Menu Move / Blip
   */
  playMenuMove() {
    this.playNote(520, 0.035, 'square', 0.16, 0);
  }

  /**
   * UI Menu Select
   */
  playMenuSelect() {
    this.playNote(523.25, 0.05, 'square', 0.24, 0);
    this.playNote(783.99, 0.09, 'square', 0.24, 0.05);
  }

  /**
   * Stage Clear Chiptune Fanfare
   */
  playStageClear() {
    this.playChiptune([
      { freq: 523.25, dur: 0.1, type: 'square' },
      { freq: 659.25, dur: 0.1, type: 'square' },
      { freq: 783.99, dur: 0.1, type: 'square' },
      { freq: 1046.5, dur: 0.24, type: 'square' },
      { freq: 783.99, dur: 0.1, type: 'square' },
      { freq: 1046.5, dur: 0.32, type: 'square' }
    ]);
  }

  /**
   * Game Over Chiptune Jingle
   */
  playGameOver() {
    this.playChiptune([
      { freq: 493.88, dur: 0.14, type: 'sawtooth' },
      { freq: 466.16, dur: 0.14, type: 'sawtooth' },
      { freq: 440.0, dur: 0.14, type: 'sawtooth' },
      { freq: 392.0, dur: 0.38, type: 'sawtooth' }
    ]);
  }

  /**
   * Play a single synthesized oscillator note
   */
  playNote(freq, duration = 0.1, type = 'square', gainVal = 0.25, delay = 0) {
    if (!this._ensureReady()) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(gainVal, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  /**
   * Chiptune Melodies: Sequenced oscillator nodes utilizing channel arrays
   * @param {Array<{freq: number, dur: number, type?: OscillatorType, gain?: number}>} sequence
   */
  playChiptune(sequence = []) {
    if (!this._ensureReady()) return;
    let offset = 0;
    for (const step of sequence) {
      if (step.freq > 0) {
        this.playNote(
          step.freq,
          step.dur || 0.1,
          step.type || 'square',
          step.gain || 0.22,
          offset
        );
      }
      offset += step.dur || 0.1;
    }
  }

  stopSequence() {
    if (this._sequenceTimer) {
      clearInterval(this._sequenceTimer);
      this._sequenceTimer = null;
    }
  }
}

export default AudioSynth;
