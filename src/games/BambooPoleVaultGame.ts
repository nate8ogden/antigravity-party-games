import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type VaultTheme = 'emerald_ravine' | 'sunset_gorge' | 'sacred_bamboo';

interface VaultPalette {
  name: string;
  skyTop: string;
  skyBot: string;
  cliffColor: string;
  poleColor: string;
}

const THEMES: Record<VaultTheme, VaultPalette> = {
  emerald_ravine: {
    name: 'Emerald Bamboo Gorge',
    skyTop: '#064e3b',
    skyBot: '#022c22',
    cliffColor: '#3f6212',
    poleColor: '#84cc16',
  },
  sunset_gorge: {
    name: 'Golden Sunset Canyon',
    skyTop: '#451a03',
    skyBot: '#1c1917',
    cliffColor: '#92400e',
    poleColor: '#fbbf24',
  },
  sacred_bamboo: {
    name: 'Arashiyama Moonlit Grove',
    skyTop: '#1e1b4b',
    skyBot: '#090d16',
    cliffColor: '#334155',
    poleColor: '#22d3ee',
  },
};

const THEME_KEYS: VaultTheme[] = ['emerald_ravine', 'sunset_gorge', 'sacred_bamboo'];

interface Vaulter {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: 'runway' | 'airborne';
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  catapultBoost: boolean;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class BambooPoleVaultGame extends BaseGame {
  private vaulters: Vaulter[] = [];
  private timeElapsed = 0;
  private roundTime = 45;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private themeIdx = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
          this.audio.playTap();
        } else if (e.key === '1') this.themeIdx = 0;
        else if (e.key === '2') this.themeIdx = 1;
        else if (e.key === '3') this.themeIdx = 2;
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(_width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.vaulters = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.vaulters.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: 90 + idx * 24,
        y: height * 0.68,
        vx: 0,
        vy: 0,
        phase: 'runway',
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        catapultBoost: false,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.84,
        calloutText: '',
        calloutTimer: 0,
      });
    });
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(v: Vaulter, text: string): void {
    v.calloutText = text;
    v.calloutTimer = 1.15;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    this.timeElapsed += dt;
    const remaining = Math.max(0, this.roundTime - this.timeElapsed);
    if (remaining <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBuzzer();
      this.vaulters.forEach((v) => this.showCallout(v, 'CHASM VAULT 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.vaulters.map((v) => v.score));
    const groundY = height * 0.68;
    const plantBoxX = width * 0.42;

    for (const v of this.vaulters) {
      v.underdog = maxScore - v.score >= 150;
      if (v.calloutTimer > 0) v.calloutTimer = Math.max(0, v.calloutTimer - dt);
      if (v.stunTimer > 0) {
        v.stunTimer = Math.max(0, v.stunTimer - dt);
        continue;
      }

      const steer = this.input.getSteer(v.id);
      const pCfg = this.getPlayer(v.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      const justTap = this.input.justAction(v.id) || (isBot && this.input.justPressed(v.id));
      const isHold = this.input.isActionPressed(v.id) || (isBot && this.input.isPressed(v.id));

      if (v.phase === 'runway') {
        v.vx = Math.min(340, v.vx + (260 + Math.max(0, steer) * 140) * (v.underdog ? 1.15 : 1.0) * dt);
        if (justTap) v.vx = Math.min(380, v.vx + 55);
        v.x += v.vx * dt;
        v.y = groundY;

        if (isHold) {
          v.holding = true;
          v.charge = Math.min(1, v.charge + dt * 0.98);
        } else if (v.holding || v.x >= plantBoxX) {
          const sweet = v.charge >= 0.72 && v.charge <= 0.98;
          v.phase = 'airborne';
          v.catapultBoost = sweet;
          v.vx = sweet ? 430 : 320;
          v.vy = sweet ? -560 : -430;
          if (sweet) {
            v.score += 85;
            v.combo = Math.min(4, v.combo + 1);
            this.showCallout(v, 'BAMBOO CATAPULT +85!');
            this.audio.playBoost();
            this.triggerHitStop(45, 11);

            for (const other of this.vaulters) {
              if (other.id !== v.id && Math.abs(other.x - v.x) < 150) {
                other.vx -= 180;
                v.score += 70;
                this.showCallout(v, 'POLE SNAP SHUNT +70!');
                this.audio.playBounce();
              }
            }
          } else if (v.charge > 0.98) {
            v.vx = 210;
            v.vy = -290;
            v.combo = 1;
            this.showCallout(v, 'POLE OVERBEND!');
            this.audio.playStun();
          } else {
            this.audio.playTap();
          }
          v.holding = false;
          v.charge = 0;
        }
      } else {
        v.vx += steer * 240 * dt;
        v.vy += 620 * dt;
        v.x += v.vx * dt;
        v.y += v.vy * dt;

        // Land on target pads on right cliff
        if (v.y >= groundY) {
          if (v.x >= width * 0.58) {
            const bullseyeDist = Math.abs(v.x - width * 0.76);
            const base = bullseyeDist < 55 ? 95 : 55;
            const pts = base * v.combo * (this.suddenDeath ? 2 : 1);
            v.score += pts;
            v.combo = Math.min(4, v.combo + 1);
            this.showCallout(v, bullseyeDist < 55 ? `GOLDEN PAD +${pts}!` : `SAFE VAULT +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(v.x, groundY, '#fbbf24', 12);
          } else {
            v.combo = 1;
            this.showCallout(v, 'RAVINE SPLASH!');
            this.audio.playStun();
          }
          v.phase = 'runway';
          v.x = 85;
          v.y = groundY;
          v.vx = 120;
          v.vy = 0;
        }
      }
    }

    // Elastic Mid-Air & Runway Bumping
    for (let i = 0; i < this.vaulters.length; i++) {
      for (let j = i + 1; j < this.vaulters.length; j++) {
        const a = this.vaulters[i];
        const b = this.vaulters[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 34) {
          const nx = dx / dist;
          a.vx -= nx * 160;
          b.vx += nx * 160;
          this.audio.playBounce();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const bot = this.vaulters.find((v) => v.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const shouldHold =
      bot.phase === 'runway' &&
      bot.x > width * 0.22 &&
      (!bot.holding || bot.charge < bot.botChargeGoal);
    this.input.setBotState(botId, shouldHold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const groundY = height * 0.68;
    // Left Runway Cliff & Right Landing Cliff
    ctx.fillStyle = pal.cliffColor;
    ctx.fillRect(0, groundY, width * 0.44, height - groundY);
    ctx.fillRect(width * 0.58, groundY, width * 0.42, height - groundY);

    // Golden Bullseye Landing Pad
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(width * 0.76 - 48, groundY - 6, 96, 12);

    // Vaulters
    for (const v of this.vaulters) {
      ctx.save();
      ctx.translate(v.x, v.y - 16);
      if (v.holding && v.charge > 0.05) {
        const sweet = v.charge >= 0.72 && v.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + v.charge * Math.PI * 2);
        ctx.stroke();
      }
      // Bamboo Pole
      ctx.strokeStyle = pal.poleColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-16, 6);
      ctx.lineTo(24, -18 + v.charge * 18);
      ctx.stroke();

      const mood = v.stunTimer > 0 ? 'shocked' : v.catapultBoost ? 'triumph' : v.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, v.id, 0, 0, 16, mood, this.timeElapsed, 0);
      if (v.calloutTimer > 0 && v.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.calloutText, 0, -28);
      }
      ctx.restore();
    }

    // HUD
    const remaining = Math.max(0, Math.ceil(this.roundTime - this.timeElapsed));
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.fillRect(0, 0, width, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🎋 BAMBOO POLE VAULT • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X VAULT' : ''}`,
      width * 0.5,
      19
    );

    this.vaulters.forEach((v, idx) => {
      ctx.fillStyle = v.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${v.id}: ${Math.round(v.score)} pts (${v.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.vaulters].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((v, i) => ({
        playerId: v.id,
        score: Math.round(v.score),
        place: i + 1,
      })),
      mvpHighlight: `Bamboo Vault Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
