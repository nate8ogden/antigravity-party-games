import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

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
}

export class RhythmDuelGame extends BaseGame {
  private notes: RhythmNote[] = [];
  private playerStates: Map<PlayerId, PlayerRhythmState> = new Map();
  private songTime: number = 0;
  private bpm: number = 128;
  private beatInterval: number = 60 / 128; // ~0.46875s per beat
  private noteSpeed: number = 380; // px/sec down the highway
  private nextBeatIndex: number = 0;
  private hitLineY: number = 500;
  private nextNoteId: number = 0;
  private beatMetronomeTimer: number = 0;
  private eqBars: number[] = [0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.4];
  private readonly TOTAL_ROUND_DURATION: number = 34.0;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = this.TOTAL_ROUND_DURATION;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = this.TOTAL_ROUND_DURATION;
    this.isFinished = false;
    this.songTime = 0;
    this.nextBeatIndex = 2; // initial 2-beat lead in
    this.nextNoteId = 0;
    this.notes = [];
    this.playerStates.clear();
    this.beatMetronomeTimer = 0;
    this.hitLineY = height - 90;

    const active = this.getActivePlayers();
    const laneCount = active.length;
    const laneW = Math.min(160, (width * 0.86) / laneCount);
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
        botPlannedHitTime: 0
      });
    });

    // Ensure pointerdown listener is bound to canvas for direct lane/hit clicking
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
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
      }
    };

    // Generate procedural syncopated rhythm song map with dynamic patterns lasting till 0.5s left
    this.generateSongMap();
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

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
    // Notes must last until exactly half a second (0.5s) left in the round!
    const lastPossibleBeatTime = this.TOTAL_ROUND_DURATION - 0.5;

    let bar = 0;
    const generatedTimes: number[] = [];

    while (true) {
      // Procedurally select a randomized pattern from the library
      const basePattern = patterns[Math.floor(Math.random() * patterns.length)];
      const pattern = [...basePattern];

      // Random micro-mutations for high variety (25% chance per step)
      for (let s = 0; s < 8; s++) {
        if (Math.random() < 0.25) {
          pattern[s] = pattern[s] === 1 ? 0 : 1;
        }
      }

      // Prevent more than 3 consecutive 16th-note hits for fair human physical playability
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
          // Add subtle organic micro-swing variance to 16th upbeats (+-0.012s)
          const swing = step % 2 === 1 ? (Math.random() - 0.5) * 0.024 : 0;
          const beatTime = (bar * 8 + step) * stepDuration + leadIn + swing;

          if (beatTime > lastPossibleBeatTime) {
            barFinished = true;
            break;
          }

          // Ensure minimum 0.16s gap from previous note
          if (generatedTimes.length === 0 || beatTime - generatedTimes[generatedTimes.length - 1] >= 0.16) {
            generatedTimes.push(beatTime);
          }
        }
      }

      if (barFinished) break;
      bar++;
      if (bar > 45) break; // Safety cap
    }

    // Ensure beats last right up until half a second (0.5s) left!
    // If the last generated note is before (lastPossibleBeatTime - 0.4s), add a finisher beat
    if (generatedTimes.length === 0 || generatedTimes[generatedTimes.length - 1] < lastPossibleBeatTime - 0.35) {
      generatedTimes.push(lastPossibleBeatTime - 0.05);
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

    this.songTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Audio metronome pulse sound
    this.beatMetronomeTimer -= dt;
    if (this.beatMetronomeTimer <= 0) {
      this.beatMetronomeTimer += this.beatInterval;
      this.audio.playTap();
      // randomize EQ visualizer bars
      for (let i = 0; i < this.eqBars.length; i++) {
        this.eqBars[i] = 0.2 + Math.random() * 0.8;
      }
    } else {
      for (let i = 0; i < this.eqBars.length; i++) {
        this.eqBars[i] = Math.max(0.15, this.eqBars[i] - dt * 1.5);
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
          st.combo = 0;
          st.misses += 1;
          st.feedbackText = 'MISS';
          st.feedbackColor = '#EF4444';
          st.feedbackTimer = 0.45;
          this.audio.playBuzzer();
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

      // Check for tap trigger
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
      st.combo = 0;
      st.feedbackText = 'MISS';
      st.feedbackColor = '#EF4444';
      st.feedbackTimer = 0.35;
      this.audio.playBuzzer();
      return;
    }

    const candidate = activeNotes[0];
    const diff = Math.abs(candidate.targetTime - this.songTime);

    if (diff <= 0.065) {
      // PERFECT
      candidate.hit = true;
      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.perfectHits += 1;

      const mult = st.combo >= 20 ? 4 : st.combo >= 10 ? 3 : st.combo >= 5 ? 2 : 1;
      st.score += 100 * mult;
      st.feedbackText = mult > 1 ? `PERFECT! x${mult}` : 'PERFECT!';
      st.feedbackColor = '#FBBF24';
      st.feedbackTimer = 0.55;

      this.audio.playScore();
      this.particles.shake(3);
      this.particles.spawnSparks(st.laneX + st.laneW * 0.5, this.hitLineY, '#FBBF24', 14);
    } else if (diff <= 0.135) {
      // GREAT
      candidate.hit = true;
      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.greatHits += 1;

      const mult = st.combo >= 10 ? 2 : 1;
      st.score += 60 * mult;
      st.feedbackText = mult > 1 ? `GREAT x${mult}` : 'GREAT';
      st.feedbackColor = '#38BDF8';
      st.feedbackTimer = 0.45;

      this.audio.playBounce();
      this.particles.spawnSparks(st.laneX + st.laneW * 0.5, this.hitLineY, '#38BDF8', 8);
    } else if (diff <= 0.210) {
      // GOOD / OK
      candidate.hit = true;
      st.combo += 1;
      st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.score += 30;
      st.feedbackText = 'OK';
      st.feedbackColor = '#34D399';
      st.feedbackTimer = 0.35;
      this.audio.playTap();
    } else if (diff <= 0.32) {
      // TOO EARLY
      candidate.hit = true;
      candidate.missed = true;
      st.combo = 0;
      st.misses += 1;
      st.feedbackText = 'EARLY';
      st.feedbackColor = '#F87171';
      st.feedbackTimer = 0.35;
      this.audio.playBuzzer();
    } else {
      // Random errant tap
      st.combo = 0;
      st.feedbackText = 'MISS';
      st.feedbackColor = '#EF4444';
      st.feedbackTimer = 0.35;
      this.audio.playBuzzer();
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

      // Precision calibration (significantly less hard, authentic human performance)
      let timingOffset = 0;
      let willMiss = false;

      if (difficulty === 'bot_easy') {
        // Easy bot: drops ~35% of notes, hits mostly OK/GREAT, rarely PERFECT
        willMiss = Math.random() < 0.35;
        timingOffset = (Math.random() - 0.5) * 0.40;
      } else if (difficulty === 'bot_normal') {
        // Normal bot: beatable and fun! Drops combo naturally (~18% miss, higher on streaks)
        const streakDropChance = st.combo >= 8 ? 0.28 : 0.16;
        willMiss = Math.random() < streakDropChance;
        // Jitter offset across [-0.13, +0.13]
        // diff <= 0.065 is PERFECT (~40%), 0.065..0.135 is GREAT (~45%), 0.135..0.210 is OK (~15%)
        timingOffset = (Math.random() - 0.5) * 0.26;
      } else {
        // Hard bot: skilled challenger but human (~6% miss, timing across [-0.065, +0.065])
        const streakDropChance = st.combo >= 15 ? 0.12 : 0.05;
        willMiss = Math.random() < streakDropChance;
        timingOffset = (Math.random() - 0.5) * 0.13;
      }

      if (willMiss) {
        st.botPlannedHitTime = 99999; // Never hits this note, naturally drops combo
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
    // 1. Synthwave Dark Neon Cyber Grid Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#090514');
    bgGrad.addColorStop(0.6, '#180B2B');
    bgGrad.addColorStop(1, '#05020A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Neon Sun at horizon
    const sunY = 90;
    const sunR = 55;
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#F43F5E');
    sunGrad.addColorStop(0.6, '#FB923C');
    sunGrad.addColorStop(1, '#FDE047');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Laser blind bars across sun
    ctx.fillStyle = '#090514';
    for (let i = 0; i < 5; i++) {
      const barY = sunY - 10 + i * 11;
      ctx.fillRect(width * 0.5 - sunR, barY, sunR * 2, 2.5 + i * 1.2);
    }

    // Audio Visualizer Equalizer Bars across top
    const eqCount = this.eqBars.length;
    const eqW = 16;
    const eqSpacing = 24;
    const eqStartX = width * 0.5 - (eqCount * eqSpacing) / 2;
    for (let i = 0; i < eqCount; i++) {
      const bh = this.eqBars[i] * 50;
      const bx = eqStartX + i * eqSpacing;
      ctx.fillStyle = 'rgba(236, 72, 153, 0.7)';
      ctx.fillRect(bx, 150 - bh, eqW, bh);
    }

    // 2. Render Player Lanes & Highways
    for (const st of this.playerStates.values()) {
      this.renderPlayerLane(ctx, st, height);
    }

    // 3. Render Notes falling down
    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      this.renderNote(ctx, note);
    }

    // 4. Render HUD / Timer & Top scores
    this.renderHUD(ctx, width);
  }

  private renderPlayerLane(ctx: CanvasRenderingContext2D, st: PlayerRhythmState, height: number): void {
    const cfg = this.players.find((p) => p.id === st.id);
    const color = cfg ? cfg.color : '#38BDF8';

    ctx.save();
    // Lane background glass
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(st.laneX, 150, st.laneW, height - 150);

    // Glowing Lane side rails
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(st.laneX, 150);
    ctx.lineTo(st.laneX, height);
    ctx.moveTo(st.laneX + st.laneW, 150);
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

    ctx.fillStyle = isPulsing ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(rx, ry, baseR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Key prompt indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg ? cfg.primaryKey : 'TAP', rx, ry);

    // Combo & Feedback text
    if (st.feedbackTimer > 0) {
      ctx.save();
      ctx.fillStyle = st.feedbackColor;
      ctx.font = 'bold 20px "Chakra Petch", monospace';
      ctx.shadowColor = st.feedbackColor;
      ctx.shadowBlur = 10;
      ctx.fillText(st.feedbackText, rx, this.hitLineY - 48);
      ctx.restore();
    } else if (st.combo > 1) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 14px "Chakra Petch", monospace';
      ctx.fillText(`${st.combo} COMBO`, rx, this.hitLineY - 42);
    }

    // Player stats card at lane bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(st.laneX + 2, height - 42, st.laneW - 4, 38);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(st.laneX + 2, height - 42, st.laneW - 4, 38);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cfg ? cfg.name : `P${st.id + 1}`, st.laneX + 8, height - 26);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 13px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${st.score}`, st.laneX + st.laneW - 8, height - 26);

    ctx.restore();
  }

  private renderNote(ctx: CanvasRenderingContext2D, note: RhythmNote): void {
    const st = this.playerStates.get(note.playerId);
    if (!st || note.y < 130 || note.y > this.hitLineY + 60) return;

    const cfg = this.players.find((p) => p.id === note.playerId);
    const color = cfg ? cfg.color : '#38BDF8';
    const nx = st.laneX + st.laneW * 0.5;
    const ny = note.y;

    ctx.save();
    // Glowing neon gem note
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    // Diamond note body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(nx, ny - 14);
    ctx.lineTo(nx + 18, ny);
    ctx.lineTo(nx, ny + 14);
    ctx.lineTo(nx - 18, ny);
    ctx.closePath();
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(nx, ny, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    // Song Timer Header
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 60, 10, 120, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 28);
    ctx.restore();
  }
}
