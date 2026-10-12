import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DrumPad {
  id: number;
  label: string;
  subLabel: string;
  icon: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  darkColor: string;
  litTimer: number;
  pressAnim: number; // 0 to 1 for 3D tactile squash bounce
}

interface PadPlayer {
  id: PlayerId;
  padIndex: number;
  score: number;
  combo: number;
  highestCombo: number;
  lastRating: string;
  ratingTimer: number;
  ratingColor: string;
  ratingY: number;
}

interface BotRhythmSchedule {
  stepIndex: number;
  scheduledTime: number; // time offset relative to downbeat
  targetPad: number;
  hasFired: boolean;
  willHit: boolean;
}

export class SynthDrumPadGame extends BaseGame {
  private playersState: Map<PlayerId, PadPlayer> = new Map();
  private pads: DrumPad[] = [];
  private stepClock: number = 0;
  private readonly stepDuration: number = 0.48; // ~125 BPM funky 808 tempo
  private currentStep: number = 0;
  // Funky classic 808 8-step groove pattern:
  // Step 0: Kick, Step 1: Hat, Step 2: Snare, Step 3: Hat, Step 4: Kick, Step 5: Tom, Step 6: Snare, Step 7: Hat
  private readonly rhythmPattern: number[] = [0, 2, 1, 2, 0, 3, 1, 2];
  private botSchedules: Map<PlayerId, BotRhythmSchedule> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.pads = [];
    this.stepClock = 0;
    this.currentStep = 0;
    this.botSchedules.clear();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        padIndex: idx % 4,
        score: 0,
        combo: 0,
        highestCombo: 0,
        lastRating: '',
        ratingTimer: 0,
        ratingColor: '#38BDF8',
        ratingY: 0
      });
    });

    // 2x2 Grid of Synth Drum Pads with tactile padding
    const padW = Math.min(160, Math.max(120, width * 0.36));
    const padH = Math.min(108, Math.max(80, height * 0.23));
    const gapX = 18;
    const gapY = 18;
    const cx = width / 2;
    const cy = height / 2 + 32;

    this.pads = [
      {
        id: 0,
        label: 'KICK',
        subLabel: 'SUB 808',
        icon: '🥁',
        x: cx - padW - gapX / 2,
        y: cy - padH - gapY / 2,
        w: padW,
        h: padH,
        color: '#EF4444',
        darkColor: '#7F1D1D',
        litTimer: 0,
        pressAnim: 0
      },
      {
        id: 1,
        label: 'SNARE',
        subLabel: 'CRACK',
        icon: '⚡',
        x: cx + gapX / 2,
        y: cy - padH - gapY / 2,
        w: padW,
        h: padH,
        color: '#06B6D4',
        darkColor: '#164E63',
        litTimer: 0,
        pressAnim: 0
      },
      {
        id: 2,
        label: 'HI-HAT',
        subLabel: 'CLOSED',
        icon: '🔔',
        x: cx - padW - gapX / 2,
        y: cy + gapY / 2,
        w: padW,
        h: padH,
        color: '#F59E0B',
        darkColor: '#78350F',
        litTimer: 0,
        pressAnim: 0
      },
      {
        id: 3,
        label: 'MID TOM',
        subLabel: 'ANALOG',
        icon: '🪐',
        x: cx + gapX / 2,
        y: cy + gapY / 2,
        w: padW,
        h: padH,
        color: '#A855F7',
        darkColor: '#581C87',
        litTimer: 0,
        pressAnim: 0
      }
    ];

    // Trigger initial beat illumination and schedule bots
    const initialPad = this.rhythmPattern[0];
    this.pads[initialPad].litTimer = 0.35;
    this.scheduleBotsForStep(0);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    // Update Pad Lit and Squash Animation Timers
    for (const pad of this.pads) {
      if (pad.litTimer > 0) pad.litTimer = Math.max(0, pad.litTimer - dt);
      if (pad.pressAnim > 0) pad.pressAnim = Math.max(0, pad.pressAnim - dt * 5.0);
    }

    // Step Sequencer Clock (125 BPM)
    this.stepClock += dt;
    if (this.stepClock >= this.stepDuration) {
      this.stepClock -= this.stepDuration;
      this.currentStep = (this.currentStep + 1) % this.rhythmPattern.length;
      const activePad = this.rhythmPattern[this.currentStep];

      // Flash pad on the beat
      this.pads[activePad].litTimer = 0.32;
      this.playDrumSound(activePad, 0.85);

      // Light sequencer pulse
      this.scheduleBotsForStep(this.currentStep);
    }

    // Process Human & Bot Player Actions
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.ratingTimer > 0) {
        ps.ratingTimer -= dt;
        ps.ratingY -= dt * 25;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);

      // Directional Pad Selection (Gamepad thumbsticks, D-Pad, Arrow keys, WASD)
      if (steer < -0.3 && throttle > 0.3) ps.padIndex = 0; // KICK (Top-Left)
      else if (steer > 0.3 && throttle > 0.3) ps.padIndex = 1; // SNARE (Top-Right)
      else if (steer < -0.3 && throttle < -0.3) ps.padIndex = 2; // HI-HAT (Bottom-Left)
      else if (steer > 0.3 && throttle < -0.3) ps.padIndex = 3; // MID TOM (Bottom-Right)
      else if (justPressed && steer === 0 && throttle === 0) {
        // Accessibility / 1-Button Party Mode:
        // If tapping without directional steering, automatically strike the active sequenced rhythm pad!
        ps.padIndex = this.rhythmPattern[this.currentStep];
      }

      // Strike Check
      if (justPressed) {
        this.handlePlayerStrike(p, ps);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private handlePlayerStrike(p: PlayerConfig, ps: PadPlayer): void {
    const curPad = this.pads[ps.padIndex];
    if (!curPad) return;

    curPad.pressAnim = 1.0;
    curPad.litTimer = 0.30;

    const targetPadIndex = this.rhythmPattern[this.currentStep];
    const isTargetPad = ps.padIndex === targetPadIndex;

    // Distance to nearest beat (downbeat is at 0.0 or stepDuration)
    const distToBeat = Math.min(this.stepClock, this.stepDuration - this.stepClock);

    if (isTargetPad && distToBeat <= 0.075) {
      // 🌟 PERFECT BEAT (within 75ms)
      ps.combo++;
      if (ps.combo > ps.highestCombo) ps.highestCombo = ps.combo;
      const comboBonus = Math.min(10, Math.floor(ps.combo / 3) * 2);
      const pts = 10 + comboBonus;
      ps.score += pts;

      ps.lastRating = ps.combo >= 4 ? `PERFECT x${ps.combo}! +${pts}` : `PERFECT! +${pts}`;
      ps.ratingColor = '#FBBF24';
      ps.ratingTimer = 0.7;
      ps.ratingY = 0;

      this.playDrumSound(curPad.id, 1.2);
      this.audio.playTone(curPad.id === 0 ? 110 : 540, 0.1, 'triangle');
      this.particles.spawnGoBlast(curPad.x + curPad.w / 2, curPad.y + curPad.h / 2);
      this.particles.showFloatingText('PERFECT! 🔥', curPad.x + curPad.w / 2, curPad.y - 12, '#FBBF24', 18);
    } else if (isTargetPad && distToBeat <= 0.16) {
      // ✨ GOOD BEAT (within 160ms)
      ps.combo++;
      if (ps.combo > ps.highestCombo) ps.highestCombo = ps.combo;
      const pts = 5;
      ps.score += pts;

      ps.lastRating = `GOOD! +${pts}`;
      ps.ratingColor = '#38BDF8';
      ps.ratingTimer = 0.55;
      ps.ratingY = 0;

      this.playDrumSound(curPad.id, 1.0);
      this.particles.spawnSparks(curPad.x + curPad.w / 2, curPad.y + curPad.h / 2, curPad.color, 8);
    } else if (isTargetPad && distToBeat <= 0.24) {
      // ⚠️ EARLY or LATE (within 240ms)
      const isEarly = this.stepClock > this.stepDuration / 2;
      const ratingLabel = isEarly ? 'EARLY +2' : 'LATE +2';
      ps.score += 2;
      ps.combo = 0; // combo reset on sloppy timing

      ps.lastRating = ratingLabel;
      ps.ratingColor = '#F59E0B';
      ps.ratingTimer = 0.45;
      ps.ratingY = 0;

      this.playDrumSound(curPad.id, 0.75);
    } else {
      // ❌ MISS / OFF-BEAT / WRONG PAD
      ps.combo = 0;
      ps.lastRating = isTargetPad ? 'MISS ❌' : 'WRONG PAD ⚠️';
      ps.ratingColor = '#EF4444';
      ps.ratingTimer = 0.4;
      ps.ratingY = 0;

      // Play off-pitch muted thud
      this.audio.playTone(72, 0.14, 'sawtooth');
    }
  }

  private playDrumSound(padIndex: number, volumeScale: number = 1.0): void {
    if (padIndex === 0) {
      // 808 Kick: Punchy deep sub-bass thump
      this.audio.playTone(85, 0.18 * volumeScale, 'triangle');
      this.audio.playTone(46, 0.22 * volumeScale, 'sine');
    } else if (padIndex === 1) {
      // 808 Snare: Snappy resonant crack
      this.audio.playTone(260, 0.12 * volumeScale, 'square');
      this.audio.playTone(420, 0.08 * volumeScale, 'sawtooth');
    } else if (padIndex === 2) {
      // 808 Closed Hi-Hat: Crisp metallic high frequency click
      this.audio.playTone(950, 0.04 * volumeScale, 'sawtooth');
    } else if (padIndex === 3) {
      // 808 Mid Tom: Resonant analog tom sweep
      this.audio.playTone(165, 0.16 * volumeScale, 'sine');
      this.audio.playTone(120, 0.14 * volumeScale, 'triangle');
    }
  }

  /**
   * Human-Calibrated Bot Rhythm Scheduler.
   * Eliminates the instantaneous aimbot by scheduling human reaction times and timing jitter.
   */
  private scheduleBotsForStep(stepIndex: number): void {
    const targetPad = this.rhythmPattern[stepIndex];

    for (const p of this.getActivePlayers()) {
      if (!p.type.startsWith('bot_')) continue;
      const difficulty = p.type as 'bot_easy' | 'bot_normal' | 'bot_hard';

      let willHit = false;
      let timeOffset = 0;
      let chosenPad = targetPad;

      if (difficulty === 'bot_hard') {
        // Hard: 84% hit intent, tight human timing (-35ms to +35ms)
        willHit = Math.random() < 0.84;
        timeOffset = (Math.random() - 0.5) * 0.07;
        if (Math.random() < 0.05) {
          chosenPad = (targetPad + 1) % 4; // rare human slip-up
        }
      } else if (difficulty === 'bot_normal') {
        // Normal: 66% hit intent, casual human timing (-85ms to +85ms)
        willHit = Math.random() < 0.66;
        timeOffset = (Math.random() - 0.5) * 0.17;
        if (Math.random() < 0.14) {
          chosenPad = (targetPad + 1) % 4; // occasional wrong pad
        }
      } else {
        // Easy: 44% hit intent, sloppy timing (-150ms to +150ms)
        willHit = Math.random() < 0.44;
        timeOffset = (Math.random() - 0.5) * 0.30;
        if (Math.random() < 0.28) {
          chosenPad = Math.floor(Math.random() * 4); // frequently picks wrong drum
        }
      }

      this.botSchedules.set(p.id, {
        stepIndex,
        scheduledTime: timeOffset,
        targetPad: chosenPad,
        hasFired: false,
        willHit
      });
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    _difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const schedule = this.botSchedules.get(botId);
    if (!schedule || schedule.hasFired || !schedule.willHit) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    // Check if the current time matches the scheduled human timing window
    let shouldFireNow = false;
    if (schedule.scheduledTime < 0) {
      // Early tap in late part of step cycle
      if (this.stepClock >= this.stepDuration + schedule.scheduledTime) {
        shouldFireNow = true;
      }
    } else {
      // Late or on-time tap in early part of step cycle
      if (this.stepClock >= schedule.scheduledTime) {
        shouldFireNow = true;
      }
    }

    if (shouldFireNow) {
      schedule.hasFired = true;
      const padIdx = schedule.targetPad;
      const ps = this.playersState.get(botId);
      if (ps) ps.padIndex = padIdx;

      let steer = 0;
      let throttle = 0;
      if (padIdx === 0) { steer = -1; throttle = 1; }
      else if (padIdx === 1) { steer = 1; throttle = 1; }
      else if (padIdx === 2) { steer = -1; throttle = -1; }
      else if (padIdx === 3) { steer = 1; throttle = -1; }

      // Fire tap ONCE
      this.input.setBotInput(botId, true, steer, throttle);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Luxury Vintage 808 Sampler Console Chassis
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#111319');
    bgGrad.addColorStop(0.5, '#181B24');
    bgGrad.addColorStop(1, '#0C0D12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Beveled console metallic border
    ctx.strokeStyle = '#272B36';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 42, width - 16, height - 50);

    // Subtle orange MPC accent stripe
    ctx.fillStyle = '#F97316';
    ctx.fillRect(8, 40, width - 16, 2.5);

    // 2. Top Header HUD
    ctx.fillStyle = 'rgba(10, 11, 15, 0.95)';
    ctx.fillRect(0, 0, width, 38);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 13.5px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SYNTH DRUM PAD // 808 GROOVE', 16, 19);

    // Pulsing BPM heart
    const bpmPulse = 0.85 + Math.sin(this.stepClock * (Math.PI * 2 / this.stepDuration)) * 0.15;
    ctx.fillStyle = `rgba(244, 63, 94, ${bpmPulse})`;
    ctx.beginPath();
    ctx.arc(285, 19, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 11.5px Montserrat, sans-serif';
    ctx.fillText('125 BPM ♩', 296, 19);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#EF4444' : '#F8FAFC';
    ctx.font = '900 13px Montserrat, sans-serif';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 19);

    // 3. 8-Step Sequencer LED Strip (Visual Rhythm Guide)
    const seqW = Math.min(520, width - 32);
    const seqH = 28;
    const seqX = width / 2 - seqW / 2;
    const seqY = 48;
    const stepW = (seqW - 7 * 6) / 8;

    // Sequencer chassis backing
    ctx.save();
    ctx.fillStyle = '#090A0E';
    this.drawRounded(ctx, seqX - 4, seqY - 4, seqW + 8, seqH + 8, 6, '#090A0E', '#2A2E3B', 1);

    for (let s = 0; s < 8; s++) {
      const stepX = seqX + s * (stepW + 6);
      const isCurrentStep = s === this.currentStep;
      const assignedPadIndex = this.rhythmPattern[s];
      const assignedPad = this.pads[assignedPadIndex];

      // Step button
      const stepBg = isCurrentStep ? assignedPad.color : '#1C1F2B';
      this.drawRounded(ctx, stepX, seqY, stepW, seqH, 4, stepBg, isCurrentStep ? '#FFFFFF' : '#333847', 1.2);

      // Mini drum icon and number
      ctx.fillStyle = isCurrentStep ? '#FFFFFF' : '#64748B';
      ctx.font = '900 9.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${s + 1}`, stepX + stepW / 2, seqY + seqH / 2);

      // Beat downbeat glow
      if (isCurrentStep) {
        ctx.shadowColor = assignedPad.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeRect(stepX, seqY, stepW, seqH);
        ctx.shadowBlur = 0;
      }
    }

    // Sequencer smooth playhead progress bar
    const stepProgress = Math.min(1.0, this.stepClock / this.stepDuration);
    const playheadX = seqX + (this.currentStep + stepProgress) * (stepW + 6);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(seqX, seqY + seqH + 2, Math.max(0, playheadX - seqX), 2);
    ctx.restore();

    // 4. Render 4 Drum Pads with 3D Depth & Anticipation Rings
    const activeTargetPad = this.rhythmPattern[this.currentStep];

    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      const isLit = pad.litTimer > 0;
      const isNextTarget = i === activeTargetPad;
      const pressOffsetY = pad.pressAnim * 4.5;

      ctx.save();

      // Recessed outer socket
      this.drawRounded(ctx, pad.x - 3, pad.y - 3, pad.w + 6, pad.h + 6, 12, '#0B0D13', '#242834', 1.5);

      // Anticipation Pulse Ring (Shrinks inward right as beat arrives!)
      if (isNextTarget && stepProgress > 0.35) {
        const ringScale = 1.35 - (stepProgress - 0.35) * 0.54; // contracts from 1.35 down to ~1.0
        const ringAlpha = (stepProgress - 0.35) * 1.5;
        const rw = pad.w * ringScale;
        const rh = pad.h * ringScale;
        ctx.strokeStyle = pad.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = Math.min(0.9, Math.max(0, ringAlpha));
        this.drawRounded(ctx, pad.x + pad.w / 2 - rw / 2, pad.y + pad.h / 2 - rh / 2, rw, rh, 14, undefined, pad.color, 2);
        ctx.globalAlpha = 1.0;
      }

      // 3D bottom bevel shadow
      this.drawRounded(ctx, pad.x, pad.y + 4, pad.w, pad.h, 10, isLit ? pad.darkColor : '#12141C');

      // Silicone rubber pad surface
      const padGrad = ctx.createLinearGradient(pad.x, pad.y + pressOffsetY, pad.x, pad.y + pad.h + pressOffsetY);
      if (isLit) {
        padGrad.addColorStop(0, '#FFFFFF');
        padGrad.addColorStop(0.3, pad.color);
        padGrad.addColorStop(1, pad.darkColor);
      } else {
        padGrad.addColorStop(0, '#2D3240');
        padGrad.addColorStop(0.2, '#1E212B');
        padGrad.addColorStop(1, '#161820');
      }

      if (isLit) {
        ctx.shadowColor = pad.color;
        ctx.shadowBlur = 18;
      }

      this.drawRounded(
        ctx,
        pad.x,
        pad.y + pressOffsetY,
        pad.w,
        pad.h,
        10,
        padGrad,
        isLit ? '#FFFFFF' : '#3B4154',
        isLit ? 2 : 1.2
      );
      ctx.shadowBlur = 0;

      // Inner tactile bevel highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(pad.x + 8, pad.y + pressOffsetY + 5, pad.w - 16, 2);

      // Pad Icon & Labels
      ctx.fillStyle = isLit ? '#FFFFFF' : pad.color;
      ctx.font = '900 19px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pad.icon} ${pad.label}`, pad.x + pad.w / 2, pad.y + pressOffsetY + pad.h * 0.42);

      ctx.fillStyle = isLit ? 'rgba(255, 255, 255, 0.9)' : '#94A3B8';
      ctx.font = '800 10.5px Montserrat, sans-serif';
      ctx.fillText(pad.subLabel, pad.x + pad.w / 2, pad.y + pressOffsetY + pad.h * 0.72);

      ctx.restore();
    }

    // 5. Render Player Selection Frames and Rating Toasts
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const pad = this.pads[ps.padIndex];
      if (!pad) continue;

      ctx.save();
      // Colored selection border
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3.5;
      this.drawRounded(ctx, pad.x - 5, pad.y - 5, pad.w + 10, pad.h + 10, 14, undefined, p.color, 3.5);

      // Player corner pill
      const cornerOffsets = [
        { x: pad.x + 8, y: pad.y + 8 },
        { x: pad.x + pad.w - 24, y: pad.y + 8 },
        { x: pad.x + 8, y: pad.y + pad.h - 24 },
        { x: pad.x + pad.w - 24, y: pad.y + pad.h - 24 }
      ];
      const c = cornerOffsets[p.id % cornerOffsets.length];
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(c.x + 8, c.y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id + 1}`, c.x + 8, c.y + 8);

      // Floating Rating Text
      if (ps.ratingTimer > 0 && ps.lastRating) {
        ctx.fillStyle = ps.ratingColor;
        ctx.font = '900 13px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = ps.ratingColor;
        ctx.shadowBlur = 8;
        ctx.fillText(ps.lastRating, pad.x + pad.w / 2, pad.y - 12 + ps.ratingY);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    // 6. Bottom Player Scorecards
    const active = this.getActivePlayers();
    const cardGap = 12;
    const cardW = Math.min(170, (width - 32 - (active.length - 1) * cardGap) / active.length);
    const cardH = 34;
    const startCardX = width / 2 - (active.length * cardW + (active.length - 1) * cardGap) / 2;
    const cardY = height - 42;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const cxPos = startCardX + i * (cardW + cardGap);
      ctx.save();
      this.drawRounded(ctx, cxPos, cardY, cardW, cardH, 8, '#131620', p.color, 1.5);

      // Player name & Score
      ctx.fillStyle = p.color;
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, cxPos + 8, cardY + cardH * 0.35);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.fillText(`${ps.score} PTS`, cxPos + 8, cardY + cardH * 0.72);

      // Combo badge
      if (ps.combo >= 2) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '900 10px Montserrat, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${ps.combo} 🔥`, cxPos + cardW - 8, cardY + cardH / 2);
      }
      ctx.restore();
    }
  }

  private drawRounded(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fillColor?: string | CanvasGradient,
    strokeColor?: string,
    lineWidth: number = 1
  ): void {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `Player ${winnerId + 1} dominated the 808 synth beat with perfect rhythm timing!`
        : 'The groove battle concluded!'
    };
  }
}
