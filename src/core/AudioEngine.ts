/**
 * Procedural Web Audio API Synthesizer
 * Zero external audio assets required; ultra low latency, retro chip-tune sound design.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private masterVolume: number = 0.75;
  private sfxEnabled: boolean = true;

  private compressor: DynamicsCompressorNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted || !this.sfxEnabled ? 0 : this.masterVolume, this.ctx.currentTime);

      // Studio-grade limiter & compressor to eliminate clipping on explosive multi-player sound bursts
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-8, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(14, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6.0, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.22, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private getDestination(): AudioNode {
    this.initContext();
    return this.masterGain ?? this.ctx?.destination ?? (null as unknown as AudioNode);
  }

  public createPanner(pan: number = 0): AudioNode {
    const dest = this.getDestination();
    if (!this.ctx || pan === 0 || typeof this.ctx.createStereoPanner !== 'function') {
      return dest;
    }
    try {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
      panner.connect(dest);
      return panner;
    } catch {
      return dest;
    }
  }

  public getPlayerPan(playerId?: number): number {
    if (playerId === 0) return -0.35;
    if (playerId === 1) return 0.35;
    if (playerId === 2) return -0.28;
    if (playerId === 3) return 0.28;
    return 0;
  }

  public setMasterVolume(vol: number) {
    const safeVol = (typeof vol === 'number' && !isNaN(vol)) ? Math.max(0, Math.min(1, vol)) : 0.7;
    this.masterVolume = safeVol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted || !this.sfxEnabled ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted || !this.sfxEnabled ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted || !this.sfxEnabled ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted || !this.sfxEnabled ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private jitter(baseFreq: number, spread = 0.08): number {
    return baseFreq * (1 + (Math.random() - 0.5) * 2 * spread);
  }

  public playTap() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    const startF = this.jitter(440, 0.05);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(startF * 2, t + 0.05);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playSelect() {
    this.playTap();
  }

  public playCountdown(isFinal: boolean) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    if (!isFinal) {
      // Crisp 3-2-1 acoustic tick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.12);
    } else {
      // Punchy "GO!" brass fanfare chord (C5, G5, C6) + sub hit
      const freqs = [523.25, 783.99, 1046.50];
      freqs.forEach((f) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f * 1.05, t + 0.35);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.38);
      });

      // Sub punch for GO!
      const sub = this.ctx.createOscillator();
      const subG = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110, t);
      sub.frequency.exponentialRampToValueAtTime(40, t + 0.22);
      subG.gain.setValueAtTime(0.3, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      sub.connect(subG);
      subG.connect(dest);
      sub.start(t);
      sub.stop(t + 0.22);
    }
  }

  public playLaser(pan = 0) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    osc.type = 'sawtooth';
    const startF = this.jitter(950, 0.07);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.14);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playExplosion(pan = 0) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    // 1. Visceral Sub-bass punch (85Hz down to 20Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(85, t);
    subOsc.frequency.exponentialRampToValueAtTime(20, t + 0.26);
    subGain.gain.setValueAtTime(0.35, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(t);
    subOsc.stop(t + 0.26);

    // 2. Filtered White Noise rumble
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.jitter(650, 0.1), t);
    filter.frequency.linearRampToValueAtTime(45, t + 0.38);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.38);
  }

  public playBounce() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    const startF = this.jitter(180, 0.08);
    const endF = this.jitter(420, 0.08);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(endF, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playBoost() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'square';
    const startF = this.jitter(220, 0.05);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.linearRampToValueAtTime(startF * 3, t + 0.15);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playScore() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = t + idx * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.12);

      osc.connect(gain);
      gain.connect(this.getDestination());

      osc.start(noteTime);
      osc.stop(noteTime + 0.12);
    });
  }

  public playChime() {
    this.playScore();
  }

  public playStun() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playGhostTag() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.25);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playFanfare() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    // Triumphant victorious fanfare chord progression
    const sequence = [
      { notes: [523.25, 659.25], start: 0, dur: 0.12 },     // C5, E5
      { notes: [587.33, 783.99], start: 0.11, dur: 0.12 },   // D5, G5
      { notes: [659.25, 880.00], start: 0.22, dur: 0.14 },   // E5, A5
      { notes: [783.99, 1046.50, 1318.51], start: 0.36, dur: 0.65 } // G5, C6, E6 (Sustained apex)
    ];

    sequence.forEach((chord) => {
      chord.notes.forEach((f) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = t + chord.start;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, noteTime);

        gain.gain.setValueAtTime(0.14, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + chord.dur);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(noteTime);
        osc.stop(noteTime + chord.dur);
      });
    });

    // Sub bass warmth on final apex
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    const apexTime = t + 0.36;
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130.81, apexTime); // C3
    sub.frequency.exponentialRampToValueAtTime(65.41, apexTime + 0.6); // C2
    subG.gain.setValueAtTime(0.32, apexTime);
    subG.gain.exponentialRampToValueAtTime(0.001, apexTime + 0.6);
    sub.connect(subG);
    subG.connect(dest);
    sub.start(apexTime);
    sub.stop(apexTime + 0.6);
  }

  public playMenuTick() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const f = this.jitter(880, 0.06);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.035);

    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.getDestination());
    osc.start(t);
    osc.stop(t + 0.035);
  }

  public playMenuConfirm() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();
    [659.25, 1046.50].forEach((f, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteT = t + i * 0.05;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, noteT);

      gain.gain.setValueAtTime(0.15, noteT);
      gain.gain.exponentialRampToValueAtTime(0.001, noteT + 0.16);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(noteT);
      osc.stop(noteT + 0.16);
    });
  }

  public playBuzzer() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.18);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playTone(freq: number, duration: number = 0.1, type: OscillatorType = 'sine') {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(this.jitter(freq, 0.04), t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + duration);
  }

  public playWhoosh() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    const startF = this.jitter(280, 0.08);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(startF * 2.2, t + 0.12);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playSnowSplat() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.jitter(800, 0.1), this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.16);

    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDestination());

    noise.start(t);
    noise.stop(t + 0.16);
  }

  public playChomp() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(380, 0.08), t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.11);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playReel() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.jitter(240, 0.05), t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.04);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.04);
  }

  public playRopeTension(tensionRatio: number = 1) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    const baseFreq = 140 * Math.max(0.4, Math.min(2.5, tensionRatio));
    osc.frequency.setValueAtTime(this.jitter(baseFreq, 0.06), t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.14);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playSpike() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(300, 0.08), t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.12);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playFlipper() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.jitter(520, 0.05), t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.06);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.06);
  }

  public playSqueak() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.jitter(900, 0.08), t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.1);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playUrgencyTick(remainingSec: number) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    // Pitch rises as time runs lower (from 600Hz at 5s to 1200Hz at 1s)
    const freq = 600 + Math.max(0, (5 - remainingSec)) * 150;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playPointScore(playerId: number) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    // Harmonic arpeggio in the player's key
    const baseFreqs = [523.25, 587.33, 659.25, 783.99]; // C5, D5, E5, G5
    const baseF = baseFreqs[playerId % baseFreqs.length];
    const notes = [baseF, baseF * 1.25, baseF * 1.5]; // root, third, fifth

    const t = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = t + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.16, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.14);

      osc.connect(gain);
      gain.connect(this.getDestination());

      osc.start(noteTime);
      osc.stop(noteTime + 0.14);
    });
  }

  public playGamepadToast(connected: boolean) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (connected) {
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    } else {
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(330, t + 0.14);
    }

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playCoin() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    // Two-tone sparkling coin chime (B5 -> E6)
    const tones = [
      { f: 987.77, delay: 0, dur: 0.12, vol: 0.18 },
      { f: 1318.51, delay: 0.06, dur: 0.22, vol: 0.24 }
    ];

    tones.forEach(({ f, delay, dur, vol }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + delay);

      gain.gain.setValueAtTime(vol, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(t + delay);
      osc.stop(t + delay + dur);
    });
  }

  public playPurchase() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    // Sparkling 4-tone victory unlock arpeggio: E5 -> G#5 -> B5 -> E6
    const freqs = [659.25, 830.61, 987.77, 1318.51];
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = t + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.22, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.32);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(noteTime);
      osc.stop(noteTime + 0.32);
    });
  }

  public playAnnouncerCountdown(count: number) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    if (count > 0) {
      // Formant pitched synthetic beep: 3 -> 440Hz, 2 -> 554Hz, 1 -> 659Hz
      const pitches = [440, 554.37, 659.25, 440];
      const baseFreq = pitches[(3 - count) % pitches.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, t);

      // Lowpass formant filter to sound like a retro arcade announcer vox
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.5, t);
      filter.Q.setValueAtTime(4.0, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(t);
      osc.stop(t + 0.22);
    } else {
      // "GO!" - Big high-energy power chord sweep
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C Major triumph
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.18);

        gain.gain.setValueAtTime(0.25 - idx * 0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + 0.45);
      });
    }
  }

  public playCrowdReaction(type: 'gasp' | 'cheer') {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    if (type === 'gasp') {
      // Inhaling noise burst with descending bandpass filter
      const dur = 0.35;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(500, t + dur);
      filter.Q.setValueAtTime(3.0, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(t);
      noise.stop(t + dur);
    } else {
      // Exultant crowd cheer harmonic shimmer
      const chord = [330, 440, 554, 659, 880];
      chord.forEach((f, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f + Math.sin(idx) * 8, t);

        const dur = 0.6;
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + dur);
      });
    }
  }

  public playHitStopThud() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    // 55Hz sub-bass concussive punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Synthesizes a single retro chiptune note (NES Pulse / Triangle / Sine / Sawtooth)
   * with an authentic NES APU sustain plateau envelope so melodies and basslines project
   * clearly across laptop, desktop, and mobile speakers.
   */
  public playChiptuneVoice(
    freq: number,
    duration: number,
    waveType: OscillatorType = 'square',
    gainLevel: number = 0.12,
    pan: number = 0,
    slideToFreq?: number
  ) {
    if (this.muted || !this.sfxEnabled || freq <= 20) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.createPanner(pan);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, t);
    if (slideToFreq && slideToFreq > 20) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, t + duration * 0.85);
    }

    const safeDur = Math.max(0.04, duration);
    const attackEnd = t + Math.min(0.008, safeDur * 0.15);
    const sustainEnd = t + safeDur * 0.78;
    const sustainLevel = Math.max(0.001, gainLevel * 0.82);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(gainLevel, attackEnd);
    gain.gain.linearRampToValueAtTime(sustainLevel, sustainEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + safeDur);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + safeDur + 0.01);
  }

  /**
   * Synthesizes a retro NES / Edo-taiko percussion hit ('taiko' | 'kick' | 'hat' | 'snare')
   */
  public playChiptunePercussion(kind: 'taiko' | 'kick' | 'hat' | 'snare', gainLevel: number = 0.12) {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();

    if (kind === 'taiko' || kind === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
      gain.gain.setValueAtTime(gainLevel * 1.45, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.12);
    } else {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const startF = kind === 'snare' ? 320 : 1850;
      const endF = kind === 'snare' ? 105 : 980;
      const dur = kind === 'snare' ? 0.075 : 0.038;
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(endF, t + dur);
      gain.gain.setValueAtTime(gainLevel * 0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
  }

  /**
   * Classic 8-note Zelda / Broderbund mystery discovery arpeggio chime
   * Played when discovering a hidden false-brick passage or revealing the escape ladder!
   */
  public playSecretChime() {
    if (this.muted || !this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.getDestination();
    // G5, F#5, D#5, A4, G#4, E5, G#5, C6
    const notes = [783.99, 739.99, 622.25, 440.0, 415.3, 659.25, 830.61, 1046.5];
    const step = 0.068;

    notes.forEach((freq, idx) => {
      const start = t + idx * step;
      const dur = idx === notes.length - 1 ? 0.26 : 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = idx % 2 === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.008);
      gain.gain.linearRampToValueAtTime(0.13, start + dur * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + dur + 0.01);
    });
  }
}

