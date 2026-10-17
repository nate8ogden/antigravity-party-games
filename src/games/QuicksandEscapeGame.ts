import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type MudTheme = 'prehistoric_bog' | 'tar_pit_oasis' | 'quicksand_temple';

interface MudPalette {
  name: string;
  skyTop: string;
  mudColor: string;
  ropeColor: string;
}

const THEMES: Record<MudTheme, MudPalette> = {
  prehistoric_bog: {
    name: 'Bubbling Jungle Bog',
    skyTop: '#064e3b',
    mudColor: '#78350f',
    ropeColor: '#fbbf24',
  },
  tar_pit_oasis: {
    name: 'La Brea Amber Pit',
    skyTop: '#451a03',
    mudColor: '#27272a',
    ropeColor: '#38bdf8',
  },
  quicksand_temple: {
    name: 'Sunken Gold Temple Pit',
    skyTop: '#1e1b4b',
    mudColor: '#92400e',
    ropeColor: '#4ade80',
  },
};

const THEME_KEYS: MudTheme[] = ['prehistoric_bog', 'tar_pit_oasis', 'quicksand_temple'];

interface RescueRope {
  id: number;
  x: number;
  y: number;
  vx: number;
  golden: boolean;
}

interface MudEscapee {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  hoistBoostTimer: number;
  mudStunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class QuicksandEscapeGame extends BaseGame {
  private escapees: MudEscapee[] = [];
  private ropes: RescueRope[] = [];
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

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.escapees = [];
    this.ropes = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.escapees.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.28 + (idx / Math.max(1, active.length - 1)) * 0.44),
        y: height * 0.65,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        hoistBoostTimer: 0,
        mudStunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.ropes.push({
        id: i,
        x: width * (0.2 + i * 0.2),
        y: height * 0.34,
        vx: (i % 2 === 0 ? 1 : -1) * 145,
        golden: i === 1,
      });
    }
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(e: MudEscapee, text: string): void {
    e.calloutText = text;
    e.calloutTimer = 1.15;
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
      this.escapees.forEach((e) => this.showCallout(e, 'VORTEX SUCTION 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const rp of this.ropes) {
      rp.x += rp.vx * (this.suddenDeath ? 1.3 : 1.0) * dt;
      if (rp.x < width * 0.14 || rp.x > width * 0.86) rp.vx *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.escapees.map((e) => e.score));

    for (const e of this.escapees) {
      e.underdog = maxScore - e.score >= 150;
      if (e.calloutTimer > 0) e.calloutTimer = Math.max(0, e.calloutTimer - dt);
      if (e.hoistBoostTimer > 0) e.hoistBoostTimer = Math.max(0, e.hoistBoostTimer - dt);
      if (e.mudStunTimer > 0) e.mudStunTimer = Math.max(0, e.mudStunTimer - dt);

      const steer = this.input.getSteer(e.id);
      const justTap = this.input.justPressed(e.id) || this.input.justAction(e.id);
      const isHold = this.input.isActionPressed(e.id) || this.input.isPressed(e.id);

      // Quicksand suction pulls downward
      e.vy += 260 * dt;
      e.vx += steer * 1250 * (e.underdog ? 1.15 : 1.0) * dt;

      if (justTap && e.mudStunTimer <= 0) {
        e.vy = -240;
        e.score += 12;
        this.audio.playTap();
      }

      // Hold-to-charge Rope-Winch Hoist & Mud-Dunk Shunt (72%-98% Sweet Spot)
      if (isHold && e.mudStunTimer <= 0) {
        e.holding = true;
        e.charge = Math.min(1, e.charge + dt * 0.92);
      } else if (e.holding) {
        const sweet = e.charge >= 0.72 && e.charge <= 0.98;
        if (sweet) {
          e.hoistBoostTimer = 2.0;
          e.vy = -520;
          e.score += 85;
          e.combo = Math.min(4, e.combo + 1);
          this.showCallout(e, 'ROPE WINCH HOIST +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          // Dunk nearby rivals deeper into the mud!
          for (const other of this.escapees) {
            if (other.id !== e.id && Math.hypot(other.x - e.x, other.y - e.y) < 165) {
              other.vy += 380;
              e.score += 70;
              this.showCallout(e, 'MUD-DUNK SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (e.charge > 0.98) {
          e.mudStunTimer = 0.9;
          e.combo = 1;
          this.showCallout(e, 'MUD SINK!');
          this.audio.playStun();
        }
        e.holding = false;
        e.charge = 0;
      }

      e.vx *= Math.pow(0.08, dt);
      e.vy *= Math.pow(0.2, dt);
      e.x = Math.max(width * 0.12, Math.min(width * 0.88, e.x + e.vx * dt));
      e.y = Math.max(height * 0.22, Math.min(height * 0.84, e.y + e.vy * dt));

      // Catch swinging rescue ropes
      for (const rp of this.ropes) {
        if (Math.hypot(e.x - rp.x, e.y - rp.y) < 38) {
          const base = rp.golden ? 95 : 55;
          const pts = base * e.combo * (this.suddenDeath ? 2 : 1);
          e.score += pts;
          e.combo = Math.min(4, e.combo + 1);
          e.y = height * 0.72;
          this.showCallout(e, rp.golden ? `GOLDEN ROPE +${pts}!` : `RESCUE HOIST +${pts}!`);
          this.audio.playScore();
          this.particles.spawnSparks(rp.x, rp.y, '#fbbf24', 12);
        }
      }
    }

    // Player-to-Player Mud Bumping
    for (let i = 0; i < this.escapees.length; i++) {
      for (let j = i + 1; j < this.escapees.length; j++) {
        const a = this.escapees[i];
        const b = this.escapees[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 38) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 280;
          a.vy -= ny * 280;
          b.vx += nx * 280;
          b.vy += ny * 280;
          this.audio.playBounce();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.escapees.find((e) => e.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const targetRope = this.ropes.find((r) => r.golden) ?? this.ropes[0];
    if (targetRope) {
      bot.vx += Math.sign(targetRope.x - bot.x) * 1000 * dt;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotState(botId, hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    ctx.fillStyle = pal.skyTop;
    ctx.fillRect(0, 0, width, height);

    // Bubbling Quicksand Pit
    ctx.fillStyle = pal.mudColor;
    ctx.fillRect(0, height * 0.52, width, height * 0.48);

    // Swinging Rescue Ropes
    for (const rp of this.ropes) {
      ctx.strokeStyle = rp.golden ? '#fbbf24' : pal.ropeColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(rp.x, 46);
      ctx.lineTo(rp.x, rp.y);
      ctx.stroke();

      ctx.fillStyle = rp.golden ? '#fbbf24' : '#ffffff';
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Escapees
    for (const e of this.escapees) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.holding && e.charge > 0.05) {
        const sweet = e.charge >= 0.72 && e.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + e.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = e.mudStunTimer > 0 ? 'shocked' : e.hoistBoostTimer > 0 ? 'triumph' : e.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, e.id, 0, 0, 17, mood, this.timeElapsed, e.vx * 0.0005);
      if (e.calloutTimer > 0 && e.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.calloutText, 0, -28);
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
      `🪢 QUICKSAND ESCAPE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X HOIST' : ''}`,
      width * 0.5,
      19
    );

    this.escapees.forEach((e, idx) => {
      ctx.fillStyle = e.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${e.id}: ${Math.round(e.score)} pts (${e.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.escapees].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((e, i) => ({
        playerId: e.id,
        score: Math.round(e.score),
        place: i + 1,
      })),
      mvpHighlight: `Quicksand Survivor ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
