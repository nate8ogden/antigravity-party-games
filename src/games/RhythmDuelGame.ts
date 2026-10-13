import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface RhythmTheme {
  name: string;
  bgGradTop: string;
  bgGradMid: string;
  bgGradBottom: string;
  highwayBg: string;
  highwayRailGlow: string;
  sunTop: string;
  sunMid: string;
  sunBottom: string;
  eqColor: string;
  noteColorOverride?: string;
  themePillColor: string;
}

export const RHYTHM_THEMES: RhythmTheme[] = [
  {
    name: 'Neon Synthwave 🌆',
    bgGradTop: '#090514',
    bgGradMid: '#180B2B',
    bgGradBottom: '#05020A',
    highwayBg: 'rgba(15, 23, 42, 0.70)',
    highwayRailGlow: '#EC4899',
    sunTop: '#F43F5E',
    sunMid: '#FB923C',
    sunBottom: '#FDE047',
    eqColor: 'rgba(236, 72, 153, 0.75)',
    themePillColor: '#EC4899'
  },
  {
    name: 'Cyberpunk Club ⚡',
    bgGradTop: '#04131D',
    bgGradMid: '#062B36',
    bgGradBottom: '#020C12',
    highwayBg: 'rgba(6, 30, 45, 0.75)',
    highwayRailGlow: '#06B6D4',
    sunTop: '#06B6D4',
    sunMid: '#10B981',
    sunBottom: '#34D399',
    eqColor: 'rgba(6, 182, 212, 0.8)',
    themePillColor: '#06B6D4'
  },
  {
    name: 'Tokyo Retro Arcade 🕹️',
    bgGradTop: '#1A0E05',
    bgGradMid: '#381C08',
    bgGradBottom: '#100702',
    highwayBg: 'rgba(35, 18, 10, 0.75)',
    highwayRailGlow: '#F59E0B',
    sunTop: '#EF4444',
    sunMid: '#F59E0B',
    sunBottom: '#FBBF24',
    eqColor: 'rgba(245, 158, 11, 0.8)',
    themePillColor: '#F59E0B'
  }
];

interface RhythmNote {
  id: number;
  playerId: PlayerId;
  targetTime: number; // Absolute song time when note reaches hit line
  hit: boolean;
  missed: boolean;
  y: number;
}

interface PlayerRhythmState {
  id: PlayerId;
  score: number;
  combo: number;
  maxCombo: number;
  perfectHits: number;
  greatHits: number;
  misses: number;
  feedbackText: string;
  feedbackColor: string;
  feedbackTimer: number;
  laneX: number;
  laneW: number;
  hitLineY: number;
  keyPulseAnim: number;
  botNextTargetNoteId: number | null;
  botPlannedHitTime: number;
  isUnderdog: boolean;
  comboShieldAvailable: boolean;
  grooveMeter: number; // 0 to 100
}

export class RhythmDuelGame extends BaseGame {
  private notes: RhythmNote[] = [];
  private playerStates: Map<PlayerId, PlayerRhythmState> = new Map();
  private songTime: number = 0;
  private bpm: number = 128;
  private beatInterval: number = 60 / 128; // ~0.46875s per beat
  private baseNoteSpeed: number = 380; // px/sec down the highway
  private noteSpeed: number = 380;
  private nextBeatIndex: number = 0;
  private hitLineY: number = 470;
  private nextNoteId: number = 0;
  private beatMetronomeTimer: number = 0;
  private eqBars: number[] = [0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.4, 0.7, 0.5];
  private readonly TOTAL_ROUND_DURATION: number = 34.0;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  // Theme Management
  private currentThemeIndex: number = 0;

  // Sudden Death State
  private isSuddenDeath: boolean = false;
  private suddenDeathFlashTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = this.TOTAL_ROUND_DURATION;
    // Procedurally select initial theme
    this.currentThemeIndex = Math.floor(Math.random() * RHYTHM_THEMES.length);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = this.TOTAL_ROUND_DURATION;
    this.isFinished = false;
    this.isSuddenDeath = false;
    this.suddenDeathFlashTimer = 0;
    this.songTime = 0;
    this.nextBeatIndex = 2; // initial 2-beat lead in
    this.nextNoteId = 0;
    this.notes = [];
    this.playerStates.clear();
    this.beatMetronomeTimer = 0;
    this.noteSpeed = this.baseNoteSpeed;
    this.hitLineY = height - 105;

    const active = this.getActivePlayers();
    const laneCount = active.length;
    const laneW = Math.min(150, (width * 0.84) / laneCount);
    const totalW = laneW * laneCount;
    const startX = (width - totalW) / 2;

    active.forEach((p, idx) => {
      const lx = startX + idx * laneW;
      this.playerStates.set(p.id, {
        id: p.id,
        score: 0,
        combo: 0,
        maxCombo: 0,
        perfectHits: 0,
        greatHits: 0,
        misses: 0,
        feedbackText: '',
        feedbackColor: '#FFFFFF',
        feedbackTimer: 0,
        laneX: lx,
        laneW: laneW,
        hitLineY: this.hitLineY,
        keyPulseAnim: 0,
        botNextTargetNoteId: null,
        botPlannedHitTime: 0,
        isUnderdog: false,
        comboShieldAvailable: true,
        grooveMeter: 0
      });
    });

    // Ensure listeners are bound
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }
    if (!this.boundKeyDown) {
      this.boundKeyDown = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.boundKeyDown);
    }

    // Expose debug hook for tests and evaluation
    (window as any).__RHYTHM_DUEL_DEBUG__ = {
      getNotes: () => this.notes.map((n) => ({ id: n.id, playerId: n.playerId, targetTime: n.targetTime, hit: n.hit, missed: n.missed })),
      getLastNoteTargetTime: () => {
        if (this.notes.length === 0) return 0;
        return Math.max(...this.notes.map((n) => n.targetTime));
      },
      getFirstNoteTargetTime: () => {
        if (this.notes.length === 0) return 0;
        return Math.min(...this.notes.map((n) => n.targetTime));
      },
      getRoundTimer: () => this.roundTimer,
      getSongTime: () => this.songTime,
      getPlayerState: (pid: PlayerId) => {
        const st = this.playerStates.get(pid);
        return st ? { ...st } : null;
      },
      tapPlayer: (pid: PlayerId) => {
        const st = this.playerStates.get(pid);
        if (st) {
          st.keyPulseAnim = 1.0;
          this.evaluatePlayerTap(st);
        }
      },
      getThemeIndex: () => this.currentThemeIndex,
      setThemeIndex: (idx: number) => {
        this.currentThemeIndex = idx % RHYTHM_THEMES.length;
      }
    };

    // Generate procedural syncopated rhythm song map with dynamic patterns lasting till 0.5s left
    this.generateSongMap();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.toggleTheme();
    }
  }

  private toggleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % RHYTHM_THEMES.length;
    this.audio.playTap();
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click: [T] Theme Pill at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.toggleTheme();
      return;
    }

    // Check which active human player's lane was clicked
    for (const st of this.playerStates.values()) {
      const p = this.getPlayer(st.id);
      if (p && !p.type.startsWith('bot_') && p.type !== 'disabled') {
        if (clickX >= st.laneX && clickX <= st.laneX + st.laneW && clickY >= 140) {
          st.keyPulseAnim = 1.0;
          this.evaluatePlayerTap(st);
          break;
        }
      }
    }
  }

  public override destroy(): void {
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private generateSongMap(): void {
    const active = this.getActivePlayers();

    // 12 diverse rhythm patterns (1 = beat note, 0 = rest)
    const patterns = [
      [1, 0, 1, 0, 1, 1, 0, 1], // Standard groove
      [1, 1, 0, 1, 1, 0, 1, 0], // Driving kick/snare
      [1, 0, 0, 1, 0, 1, 1, 1], // Syncopated funk
      [1, 1, 1, 0, 1, 1, 0, 0], // Triplet rush
      [1, 0, 1, 0, 1, 0, 1, 0], // Steady four-on-the-floor
      [1, 0, 0, 1, 1, 0, 1, 0], // Double-kick bounce
      [0, 1, 0, 1, 0, 1, 0, 1], // Off-beat reggae bounce
      [1, 0, 0, 1, 0, 0, 1, 0], // Latin clave pulse
      [1, 1, 0, 0, 1, 1, 0, 1], // Staccato bursts
      [1, 0, 1, 1, 0, 1, 0, 0], // Gallop shuffle
      [1, 0, 0, 0, 1, 0, 1, 0], // Half-time chill drop
      [1, 1, 1, 0, 1, 0, 1, 1]  // High-energy climax
    ];

    const leadIn = 1.2; // Initial preparation lead-in
    const stepDuration = this.beatInterval * 0.5; // ~0.234s per sixteenth step
    const lastPossibleBeatTime = this.TOTAL_ROUND_DURATION - 0.5;

    let bar = 0;
    const generatedTimes: number[] = [];

    while (true) {
      const basePattern = patterns[Math.floor(Math.random() * patterns.length)];
      const pattern = [...basePattern];

      // Random micro-mutations for high variety (25% chance per step)
      for (let s = 0; s < 8; s++) {
        if (Math.random() < 0.25) {
          pattern[s] = pattern[s] === 1 ? 0 : 1;
        }
      }

      // Prevent more than 3 consecutive 16th-note hits for fair human playability
      let consecutive = 0;
      for (let s = 0; s < 8; s++) {
        if (pattern[s] === 1) {
          consecutive++;
          if (consecutive > 3) {
            pattern[s] = 0;
            consecutive = 0;
          }
        } else {
          consecutive = 0;
        }
      }

      let barFinished = false;
      for (let step = 0; step < 8; step++) {
        if (pattern[step] === 1) {
          const swing = step % 2 === 1 ? (Math.random() - 0.5) * 0.024 : 0;
          const beatTime = (bar * 8 + step) * stepDuration + leadIn + swing;

          if (beatTime > lastPossibleBeatTime) {
            barFinished = true;
            break;
          }

          if (generatedTimes.length === 0 || beatTime - generatedTimes[generatedTimes.length - 1] >= 0.16) {
            generatedTimes.push(beatTime);
          }
        }
      }

      if (barFinished) break;
      bar++;
      if (bar > 45) break;
    }

    // Ensure beats last right up until half a second (0.5s) left
    const targetLastBeat = Math.round((this.TOTAL_ROUND_DURATION - 0.5) * 100) / 100;
    if (generatedTimes.length === 0 || targetLastBeat - generatedTimes[generatedTimes.length - 1] >= 0.16) {
      generatedTimes.push(targetLastBeat);
    } else {
      generatedTimes[generatedTimes.length - 1] = targetLastBeat;
    }

    // Spawn notes for all active players at identical times for 100% fair competitive duel
    for (const t of generatedTimes) {
      for (const p of active) {
        this.notes.push({
          id: this.nextNoteId++,
          playerId: p.id,
          targetTime: t,
          hit: false,
          missed: false,
          y: -100
        });
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.songTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Sudden Death Activation (<= 15 seconds remaining)
    if (this.roundTimer <= 15.0 && !this.isSuddenDeath) {
      this.isSuddenDeath = true;
      this.noteSpeed = this.baseNoteSpeed * 1.25; // +25% highway tempo
      this.audio.playBoost();
      this.particles.shake(6);
    }

    if (this.isSuddenDeath) {
      this.suddenDeathFlashTimer += dt;
    }

    // Underdog Surge calculation: identify leader & check deficits
    let maxScore = -1;
    for (const st of this.playerStates.values()) {
      if (st.score > maxScore) {
        maxScore = st.score;
      }
    }

    for (const st of this.playerStates.values()) {
      const deficit = maxScore - st.score;
      st.isUnderdog = deficit >= 400 && maxScore > 0;
    }

    // Audio metronome pulse sound
    this.beatMetronomeTimer -= dt;
    if (this.beatMetronomeTimer <= 0) {
      this.beatMetronomeTimer += this.beatInterval;
      this.audio.playTap();
      // randomize EQ visualizer bars
      for (let i = 0; i < this.eqBars.length; i++) {
        this.eqBars[i] = 0.25 + Math.random() * 0.75;
      }
    } else {
      for (let i = 0; i < this.eqBars.length; i++) {
        this.eqBars[i] = Math.max(0.12, this.eqBars[i] - dt * 1.4);
      }
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    // Update Player Inputs & Note Judgments
    this.updateJudgments(dt);

    // Update Note Y positions
    for (const note of this.notes) {
      if (note.hit) continue;
      const timeRemaining = note.targetTime - this.songTime;
      note.y = this.hitLineY - timeRemaining * this.noteSpeed;

      // Note fell past hit line and was missed
      if (!note.missed && timeRemaining < -0.18) {
        note.missed = true;
        const st = this.playerStates.get(note.playerId);
        if (st) {
          if (st.isUnderdog && st.comboShieldAvailable && st.combo >= 4) {
            // Underdog Combo Shield rescues streak
            st.comboShieldAvailable = false;
            st.feedbackText = 'SHIELD SAVE!';
            st.feedbackColor = '#F59E0B';
            st.feedbackTimer = 0.5;
            this.audio.playBoost();
          } else {
            st.combo = 0;
            st.comboShieldAvailable = true; // reset for next streak
            st.misses += 1;
            st.feedbackText = 'MISS';
            st.feedbackColor = '#EF4444';
            st.feedbackTimer = 0.45;
            this.audio.playBuzzer();
          }
        }
      }
    }

    // Clean up finished notes
    this.notes = this.notes.filter((n) => !n.hit && (!n.missed || n.targetTime - this.songTime > -0.5));

    // End round when timer expires
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private updateJudgments(dt: number): void {
    for (const st of this.playerStates.values()) {
      if (st.feedbackTimer > 0) {
        st.feedbackTimer -= dt;
      }
      if (st.keyPulseAnim > 0) {
        st.keyPulseAnim = Math.max(0, st.keyPulseAnim - dt * 6);
      }

      // Check for tap trigger: primaryKey / Space / Enter / etc.
      const justPressed = this.input.justPressed(st.id);

      if (justPressed) {
        st.keyPulseAnim = 1.0;
        this.evaluatePlayerTap(st);
      }
    }
  }

  private evaluatePlayerTap(st: PlayerRhythmState): void {
    // Find unhit notes in this player's lane closest to the hit line
    const activeNotes = this.notes
      .filter((n) => n.playerId === st.id && !n.hit && !n.missed)
      .sort((a, b) => Math.abs(a.targetTime - this.songTime) - Math.abs(b.targetTime - this.songTime));

    if (activeNotes.length === 0) {
      // Empty tap miss
      if (st.isUnderdog && st.comboShieldAvailable && st.combo >= 4) {
        st.comboShieldAvailable = false;
        st.feedbackText = 'SHIELD SAVE!';
        st.feedbackColor = '#F59E0B';
        st.feedbackTimer = 0.4;
        this.audio.playBoost();
      } else {
        st.combo = 0;
        st.feedbackText = 'MISS';
        st.feedbackColor = '#EF4444';
        st.feedbackTimer = 0.35;
        this.audio.playBuzzer();
      }
      return;
    }

    const candidate = activeNotes[0];
    const diff = Math.abs(candidate.targetTime - this.songTime);

    // Sudden death double-score multiplier
    const suddenDeathMult = this.isSuddenDeath ? 2 : 1;

    // Underdog expanded timing windows (+35% forgiving grace)
    const perfectWindow = st.isUnderdog ? 0.088 : 0.065;
    const greatWindow = st.isUnderdog ? 0.170 : 0.135;
    const goodWindow = st.isUnderdog ? 0.250 : 0.210;

    if (diff <= perfectWindow) {
      // PERFECT HIT
      candidate.hit = true;
      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.perfectHits += 1;
      st.comboShieldAvailable = true; // refreshed

      const streakMult = st.combo >= 20 ? 4 : st.combo >= 10 ? 3 : st.combo >= 5 ? 2 : 1;
      const basePoints = 100 * streakMult * suddenDeathMult;
      st.score += basePoints;
      st.feedbackText = (streakMult * suddenDeathMult) > 1 ? `PERFECT! x${streakMult * suddenDeathMult}` : 'PERFECT!';
      st.feedbackColor = '#FBBF24';
      st.feedbackTimer = 0.55;

      this.audio.playScore();
      this.particles.shake(this.isSuddenDeath ? 5 : 3);
      this.particles.spawnSparks(st.laneX + st.laneW * 0.5, this.hitLineY, '#FBBF24', 16);

      // High combo groove pulse
      if (st.combo >= 10) {
        this.audio.playBounce();
      }
    } else if (diff <= greatWindow) {
      // GREAT HIT
      candidate.hit = true;
      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.greatHits += 1;

      const streakMult = st.combo >= 10 ? 2 : 1;
      const basePoints = 60 * streakMult * suddenDeathMult;
      st.score += basePoints;
      st.feedbackText = (streakMult * suddenDeathMult) > 1 ? `GREAT x${streakMult * suddenDeathMult}` : 'GREAT';
      st.feedbackColor = '#38BDF8';
      st.feedbackTimer = 0.45;

      this.audio.playBounce();
      this.particles.spawnSparks(st.laneX + st.laneW * 0.5, this.hitLineY, '#38BDF8', 10);
    } else if (diff <= goodWindow) {
      // GOOD / OK
      candidate.hit = true;
      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.score += 30 * suddenDeathMult;
      st.feedbackText = suddenDeathMult > 1 ? 'OK x2' : 'OK';
      st.feedbackColor = '#34D399';
      st.feedbackTimer = 0.35;
      this.audio.playTap();
    } else if (diff <= 0.32) {
      // TOO EARLY
      candidate.hit = true;
      candidate.missed = true;
      if (st.isUnderdog && st.comboShieldAvailable && st.combo >= 4) {
        st.comboShieldAvailable = false;
        st.feedbackText = 'SHIELD SAVE!';
        st.feedbackColor = '#F59E0B';
        st.feedbackTimer = 0.4;
        this.audio.playBoost();
      } else {
        st.combo = 0;
        st.misses += 1;
        st.feedbackText = 'EARLY';
        st.feedbackColor = '#F87171';
        st.feedbackTimer = 0.35;
        this.audio.playBuzzer();
      }
    } else {
      // Random errant tap
      if (st.isUnderdog && st.comboShieldAvailable && st.combo >= 4) {
        st.comboShieldAvailable = false;
        st.feedbackText = 'SHIELD SAVE!';
        st.feedbackColor = '#F59E0B';
        st.feedbackTimer = 0.4;
        this.audio.playBoost();
      } else {
        st.combo = 0;
        st.feedbackText = 'MISS';
        st.feedbackColor = '#EF4444';
        st.feedbackTimer = 0.35;
        this.audio.playBuzzer();
      }
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const st = this.playerStates.get(botId);
    if (!st) return;

    // Look for next incoming unhit note
    const upcomingNotes = this.notes.filter(
      (n) => n.playerId === botId && !n.hit && !n.missed && n.targetTime > this.songTime - 0.1
    );

    if (upcomingNotes.length === 0) {
      st.botNextTargetNoteId = null;
      return;
    }

    const nextNote = upcomingNotes[0];

    // If bot has not scheduled hit time for this note yet
    if (st.botNextTargetNoteId !== nextNote.id) {
      st.botNextTargetNoteId = nextNote.id;

      let timingOffset = 0;
      let willMiss = false;

      if (difficulty === 'bot_easy') {
        // Easy bot: drops ~36% of notes, hits mostly OK/GREAT, wide sensory jitter
        willMiss = Math.random() < 0.36;
        timingOffset = (Math.random() - 0.5) * 0.38;
      } else if (difficulty === 'bot_normal') {
        // Normal bot: beatable and fun! Naturally drops combo (~17% miss, higher on streaks)
        const streakDropChance = st.combo >= 8 ? 0.28 : 0.16;
        willMiss = Math.random() < streakDropChance;
        timingOffset = (Math.random() - 0.5) * 0.24;
      } else {
        // Hard bot: skilled human competitor (~5% miss, timing jitter within +/- 0.055s)
        const streakDropChance = st.combo >= 15 ? 0.10 : 0.04;
        willMiss = Math.random() < streakDropChance;
        timingOffset = (Math.random() - 0.5) * 0.11;
      }

      if (willMiss) {
        st.botPlannedHitTime = 99999;
      } else {
        st.botPlannedHitTime = nextNote.targetTime + timingOffset;
      }
    }

    // Trigger tap when planned hit time is reached
    if (this.songTime >= st.botPlannedHitTime && st.botPlannedHitTime < 9999) {
      st.keyPulseAnim = 1.0;
      this.evaluatePlayerTap(st);
      st.botNextTargetNoteId = null;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const scores = active.map((p) => {
      const st = this.playerStates.get(p.id);
      return {
        playerId: p.id,
        score: st?.score || 0,
        maxCombo: st?.maxCombo || 0,
        perfects: st?.perfectHits || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topCombo = scores[0]?.maxCombo || 0;
    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} rocked the synth duel with ${topScore} pts and a ${topCombo}x combo!`
      : 'Rhythm stalemate!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = RHYTHM_THEMES[this.currentThemeIndex];

    // 1. Synthwave Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(0.6, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Neon Horizon Sun / Grid
    const sunY = 95;
    const sunR = 52;
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, theme.sunTop);
    sunGrad.addColorStop(0.6, theme.sunMid);
    sunGrad.addColorStop(1, theme.sunBottom);
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Laser blind bars across sun
    ctx.fillStyle = theme.bgGradTop;
    for (let i = 0; i < 5; i++) {
      const barY = sunY - 10 + i * 11;
      ctx.fillRect(width * 0.5 - sunR, barY, sunR * 2, 2.5 + i * 1.2);
    }

    // Audio Visualizer Equalizer Bars across horizon
    const eqCount = this.eqBars.length;
    const eqW = 14;
    const eqSpacing = 22;
    const eqStartX = width * 0.5 - (eqCount * eqSpacing) / 2;
    for (let i = 0; i < eqCount; i++) {
      const bh = this.eqBars[i] * 46;
      const bx = eqStartX + i * eqSpacing;
      ctx.fillStyle = theme.eqColor;
      ctx.fillRect(bx, 150 - bh, eqW, bh);
    }

    // 2. Render Player Lanes & Highways
    for (const st of this.playerStates.values()) {
      this.renderPlayerLane(ctx, st, height, theme);
    }

    // 3. Render Notes falling down
    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      this.renderNote(ctx, note, theme);
    }

    // 4. Render HUD Header & Minigame Subheader (Safe layout)
    this.renderSafeHUD(ctx, width, height, theme);
  }

  private renderPlayerLane(
    ctx: CanvasRenderingContext2D,
    st: PlayerRhythmState,
    height: number,
    theme: RhythmTheme
  ): void {
    const cfg = this.players.find((p) => p.id === st.id);
    const color = cfg ? cfg.color : '#38BDF8';
    const isBot = cfg?.type.startsWith('bot_') ?? false;

    ctx.save();

    // Lane background glass
    ctx.fillStyle = theme.highwayBg;
    ctx.fillRect(st.laneX, 155, st.laneW, height - 155);

    // Glowing Lane side rails
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : (st.isUnderdog ? '#F59E0B' : color);
    ctx.lineWidth = st.isUnderdog ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(st.laneX, 155);
    ctx.lineTo(st.laneX, height);
    ctx.moveTo(st.laneX + st.laneW, 155);
    ctx.lineTo(st.laneX + st.laneW, height);
    ctx.stroke();

    // Judgment Hit Line
    const isPulsing = st.keyPulseAnim > 0;
    ctx.lineWidth = isPulsing ? 6 : 3;
    ctx.strokeStyle = isPulsing ? '#FFFFFF' : color;
    ctx.beginPath();
    ctx.moveTo(st.laneX + 4, this.hitLineY);
    ctx.lineTo(st.laneX + st.laneW - 4, this.hitLineY);
    ctx.stroke();

    // Hit Target receptor node
    const rx = st.laneX + st.laneW * 0.5;
    const ry = this.hitLineY;
    const baseR = 18 + st.keyPulseAnim * 6;

    // Underdog golden halo around receptor
    if (st.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(rx, ry, baseR + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = isPulsing ? '#FFFFFF' : 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(rx, ry, baseR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Key prompt indicator inside receptor
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg ? cfg.primaryKey : 'TAP', rx, ry);

    // Mascot DJ / Performer Avatar right below receptor
    let mood: CharacterMood = 'focused';
    if (st.feedbackText === 'MISS' || st.feedbackText === 'EARLY') {
      mood = 'shocked';
    } else if (st.combo >= 10 || (this.isFinished && st.score > 0)) {
      mood = 'triumph';
    } else if (st.feedbackText.startsWith('PERFECT') || st.feedbackText.startsWith('GREAT')) {
      mood = 'happy';
    }

    drawCharacter(ctx, rx, this.hitLineY + 28, 14, st.id, isBot, mood, this.songTime * 4);

    // Combo & Feedback text
    if (st.feedbackTimer > 0) {
      ctx.save();
      ctx.fillStyle = st.feedbackColor;
      ctx.font = 'bold 18px "Chakra Petch", monospace';
      ctx.shadowColor = st.feedbackColor;
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.fillText(st.feedbackText, rx, this.hitLineY - 44);
      ctx.restore();
    } else if (st.combo > 1) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 13px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${st.combo} COMBO`, rx, this.hitLineY - 40);
    }

    // Player stats card at lane bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(st.laneX + 2, height - 38, st.laneW - 4, 34);
    ctx.strokeStyle = st.isUnderdog ? '#F59E0B' : color;
    ctx.lineWidth = st.isUnderdog ? 2 : 1.5;
    ctx.strokeRect(st.laneX + 2, height - 38, st.laneW - 4, 34);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cfg ? cfg.name : `P${st.id + 1}`, st.laneX + 6, height - 23);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 13px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${st.score}`, st.laneX + st.laneW - 6, height - 23);

    ctx.restore();
  }

  private renderNote(ctx: CanvasRenderingContext2D, note: RhythmNote, _theme: RhythmTheme): void {
    const st = this.playerStates.get(note.playerId);
    if (!st || note.y < 140 || note.y > this.hitLineY + 60) return;

    const cfg = this.players.find((p) => p.id === note.playerId);
    const color = cfg ? cfg.color : '#38BDF8';
    const nx = st.laneX + st.laneW * 0.5;
    const ny = note.y;

    ctx.save();
    // Glowing neon gem note
    ctx.shadowColor = this.isSuddenDeath ? '#EF4444' : color;
    ctx.shadowBlur = this.isSuddenDeath ? 18 : 12;

    // Diamond note body
    ctx.fillStyle = this.isSuddenDeath ? '#F43F5E' : color;
    ctx.beginPath();
    ctx.moveTo(nx, ny - 13);
    ctx.lineTo(nx + 17, ny);
    ctx.lineTo(nx, ny + 13);
    ctx.lineTo(nx - 17, ny);
    ctx.closePath();
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(nx, ny, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderSafeHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: RhythmTheme
  ): void {
    ctx.save();

    // 1. Minigame subheader / instruction banner at y: 56
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const badgeW = Math.min(width - 60, 480);
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - badgeW * 0.5, 54, badgeW, 26, 13);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isSuddenDeath) {
      const flash = Math.sin(this.suddenDeathFlashTimer * 10) > 0;
      ctx.fillStyle = flash ? '#FDE047' : '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH OVERDRIVE: 2X SCORE & HYPER TEMPO! ⚡', width * 0.5, 67);
    } else {
      ctx.fillText('🎵 Hit notes on the judgment line! Build streaks for combo multipliers!', width * 0.5, 67);
    }

    // 2. Interactive Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // 3. Control Hints (bottom-right safe zone)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap Lane or Primary Key to Hit Beat', width - 24, height - 28);

    ctx.restore();
  }
}
