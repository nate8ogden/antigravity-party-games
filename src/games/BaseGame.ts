import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MatchMutatorType = 'none' | 'turbo' | 'golden_bounty' | 'low_gravity' | 'slippery' | 'gusty_wind';

export interface MutatorConfig {
  type: MatchMutatorType;
  name: string;
  badge: string;
  color: string;
  description: string;
  speedMultiplier: number;
  scoreMultiplier: number;
  gravityMultiplier: number;
  frictionMultiplier: number;
  windForce: number;
}

export const DEFAULT_MUTATOR: MutatorConfig = {
  type: 'none',
  name: 'Standard Rules',
  badge: '⚖️',
  color: '#94A3B8',
  description: 'Standard physics and rules',
  speedMultiplier: 1.0,
  scoreMultiplier: 1.0,
  gravityMultiplier: 1.0,
  frictionMultiplier: 1.0,
  windForce: 0
};

export abstract class BaseGame {
  protected players: PlayerConfig[];
  protected input: InputRouter;
  protected audio: AudioEngine;
  protected particles: ParticleSystem;

  public roundTimer: number = 0;
  public isFinished: boolean = false;

  // Universal Match Mutator & Randomness System
  public activeMutator: MutatorConfig = { ...DEFAULT_MUTATOR };

  // Universal Anti-Loop & Anti-Stall Framework
  protected antiLoopTrackers: Map<string | number, {
    accumAngle: number;
    lastAngle: number;
    anchorX: number;
    anchorY: number;
    loopTime: number;
    isLooping: boolean;
    breakoutCooldown: number;
  }> = new Map();

  public stagnationTimer: number = 0;
  public suddenDeathActive: boolean = false;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    this.players = players;
    this.input = input;
    this.audio = audio;
    this.particles = particles;
  }

  /**
   * Randomly rolls an unpredictable Match Mutator (Turbo, Golden Bounty, Low Gravity, Slippery, or Gusty Winds)
   */
  public rollRandomMutator(chance: number = 0.35): MutatorConfig {
    if (Math.random() >= chance) {
      this.activeMutator = { ...DEFAULT_MUTATOR };
      return this.activeMutator;
    }

    const mutators: MutatorConfig[] = [
      {
        type: 'turbo',
        name: 'TURBO SPEED',
        badge: '⚡',
        color: '#38BDF8',
        description: '+30% speed across all action!',
        speedMultiplier: 1.3,
        scoreMultiplier: 1.0,
        gravityMultiplier: 1.0,
        frictionMultiplier: 1.0,
        windForce: 0
      },
      {
        type: 'golden_bounty',
        name: 'GOLDEN BOUNTY SURGE',
        badge: '💎',
        color: '#FBBF24',
        description: 'Double bounty points & bonus coins!',
        speedMultiplier: 1.0,
        scoreMultiplier: 2.0,
        gravityMultiplier: 1.0,
        frictionMultiplier: 1.0,
        windForce: 0
      },
      {
        type: 'low_gravity',
        name: 'LOW GRAVITY',
        badge: '🌀',
        color: '#A855F7',
        description: 'Floatier physics & high bounds!',
        speedMultiplier: 1.05,
        scoreMultiplier: 1.0,
        gravityMultiplier: 0.65,
        frictionMultiplier: 0.9,
        windForce: 0
      },
      {
        type: 'slippery',
        name: 'SLIPPERY ICE',
        badge: '🧊',
        color: '#67E8F9',
        description: 'Drifty momentum & sliding turns!',
        speedMultiplier: 1.1,
        scoreMultiplier: 1.0,
        gravityMultiplier: 1.0,
        frictionMultiplier: 0.6,
        windForce: 0
      },
      {
        type: 'gusty_wind',
        name: 'GUSTY WINDS',
        badge: '🌪️',
        color: '#34D399',
        description: 'Dynamic unpredictable crosswinds!',
        speedMultiplier: 1.0,
        scoreMultiplier: 1.0,
        gravityMultiplier: 1.0,
        frictionMultiplier: 1.0,
        windForce: (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 30)
      }
    ];

    const chosen = mutators[Math.floor(Math.random() * mutators.length)];
    this.activeMutator = chosen;
    return chosen;
  }

  /**
   * Renders the top HUD pill when a wild match mutator is active
   */
  public drawMutatorHUD(ctx: CanvasRenderingContext2D, width: number): void {
    if (this.activeMutator.type === 'none') return;

    ctx.save();
    const cx = width / 2;
    const cy = 24;
    const badgeText = `${this.activeMutator.badge} ${this.activeMutator.name}`;

    ctx.font = '800 12px Montserrat, sans-serif';
    const textW = ctx.measureText(badgeText).width;
    const pillW = textW + 28;
    const pillH = 24;

    // Glowing mutator pill background
    ctx.shadowColor = this.activeMutator.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = this.activeMutator.color;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = this.activeMutator.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, cx, cy + 0.5);

    ctx.restore();
  }

  /**
   * Tracks an entity's movement and angular turning to detect circular loop traps.
   * If an entity turns > 2 full revolutions within a tight radius, flags isLooping
   * and can automatically fire a breakout rescue impulse.
   */
  public trackAntiLoop(
    id: string | number,
    x: number,
    y: number,
    angle: number,
    dt: number,
    maxRadius: number = 48,
    onBreakout?: (rescueAngle: number) => void
  ): { isLooping: boolean; loopDuration: number } {
    let tracker = this.antiLoopTrackers.get(id);
    if (!tracker) {
      tracker = {
        accumAngle: 0,
        lastAngle: angle,
        anchorX: x,
        anchorY: y,
        loopTime: 0,
        isLooping: false,
        breakoutCooldown: 0
      };
      this.antiLoopTrackers.set(id, tracker);
    }

    tracker.breakoutCooldown = Math.max(0, tracker.breakoutCooldown - dt);

    // Calculate shortest angular displacement between frames
    let diff = angle - tracker.lastAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    tracker.lastAngle = angle;

    const distFromAnchor = Math.hypot(x - tracker.anchorX, y - tracker.anchorY);
    if (distFromAnchor > maxRadius) {
      // Entity has broken out through linear progress - reset anchor and decay rotation
      tracker.anchorX = x;
      tracker.anchorY = y;
      tracker.accumAngle *= 0.4;
      tracker.loopTime = Math.max(0, tracker.loopTime - dt * 2);
      tracker.isLooping = false;
    } else {
      tracker.accumAngle += diff;
      if (Math.abs(diff) > 0.015) {
        tracker.loopTime += dt;
      } else {
        tracker.loopTime = Math.max(0, tracker.loopTime - dt * 0.5);
      }

      // Check if entity is trapped in an endless circle (> 2.0 full turns or > 1.6s spinning in place)
      const turns = Math.abs(tracker.accumAngle) / (Math.PI * 2);
      if (turns >= 2.0 || tracker.loopTime >= 1.6) {
        tracker.isLooping = true;
        if (tracker.breakoutCooldown <= 0) {
          tracker.breakoutCooldown = 2.0;
          tracker.accumAngle = 0;
          tracker.loopTime = 0;
          this.triggerAntiLoopBreakout(id, x, y, angle);
          if (onBreakout) {
            onBreakout(angle);
          }
        }
      }
    }

    return { isLooping: tracker.isLooping, loopDuration: tracker.loopTime };
  }

  /**
   * Universal breakout pulse with audio, particles, and floating text
   */
  public triggerAntiLoopBreakout(
    id: string | number,
    x: number,
    y: number,
    angle: number,
    label: string = '⚡ ANTI-LOOP BREAKOUT!'
  ): void {
    this.audio.playBoost();
    this.particles.spawnSparks(x, y, '#38BDF8', 12);
    this.particles.showFloatingText(label, x, y - 26, '#38BDF8', 18);
  }

  /**
   * Watchdog for match stalemates: guarantees no match can be locked in an infinite stalemate loop
   */
  public updateStagnationWatchdog(
    dt: number,
    onSuddenDeath?: () => void,
    onForceEnd?: () => void
  ): void {
    if (this.isFinished) return;
    this.stagnationTimer += dt;

    if (this.stagnationTimer >= 40.0 && !this.suddenDeathActive) {
      this.suddenDeathActive = true;
      this.audio.playCountdown(true);
      this.particles.showFloatingText('⚠️ SUDDEN DEATH! BREAK THE LOOP!', 480, 70, '#EF4444', 24);
      if (onSuddenDeath) onSuddenDeath();
    }

    if (this.stagnationTimer >= 58.0) {
      this.isFinished = true;
      this.audio.playFanfare();
      if (onForceEnd) onForceEnd();
    }
  }

  public getActivePlayers(): PlayerConfig[] {
    return this.players.filter((p) => p.type !== 'disabled');
  }

  public getPlayer(id: PlayerId): PlayerConfig | undefined {
    return this.players.find((p) => p.id === id);
  }

  public abstract init(width: number, height: number): void;
  public abstract update(dt: number, width: number, height: number): void;
  public abstract render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  public abstract isRoundOver(): boolean;
  public abstract getRoundResult(): RoundResult;
  public abstract reset(width: number, height: number): void;

  protected updateBots(dt: number, width: number, height: number): void {
    for (const p of this.getActivePlayers()) {
      if (p.type.startsWith('bot_')) {
        this.updateBotAI(dt, p.id, p.type as 'bot_easy' | 'bot_normal' | 'bot_hard', width, height);
      }
    }
  }

  protected abstract updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void;

  protected drawPlayerMascot(
    ctx: CanvasRenderingContext2D,
    playerId: PlayerId,
    x: number,
    y: number,
    radius: number,
    mood: CharacterMood = 'idle',
    time: number = 0,
    angle?: number
  ): void {
    const p = this.getPlayer(playerId);
    const isBot = p ? p.type.startsWith('bot_') : false;
    ctx.save();
    if (typeof angle === 'number') {
      ctx.translate(x, y);
      ctx.rotate(angle);
      drawCharacter(ctx, 0, 0, radius, playerId, isBot, mood, time);
    } else {
      drawCharacter(ctx, x, y, radius, playerId, isBot, mood, time);
    }
    ctx.restore();
  }

  public destroy(): void {}
}
