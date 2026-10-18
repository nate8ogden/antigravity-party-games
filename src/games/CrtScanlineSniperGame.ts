import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CrtTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'MALLARD_DUCK' | 'GOLDEN_UFO' | 'SODA_CAN' | 'DECOY_SKUNK';
  points: number;
  color: string;
  lockRing: number; // shrinks from 2.2 -> 1.0 for timing multiplier
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface SniperPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  streak: number;
  cooldown: number;
  stunTimer: number;
  charge: number;
  isCharging: boolean;
  underdog: boolean;
  botReactionTimer: number;
  botTargetX: number;
  botTargetY: number;
}

interface ThemePalette {
  id: string;
  name: string;
  bg: string;
  scanline: string;
  bezel: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'nes_zapper',
    name: '1985 Lightgun Woodland CRT',
    bg: '#06150d',
    scanline: 'rgba(34, 197, 94, 0.12)',
    bezel: '#1e293b'
  },
  {
    id: 'time_crisis',
    name: 'Cyber Arcade Gallery',
    bg: '#060c21',
    scanline: 'rgba(56, 189, 248, 0.12)',
    bezel: '#334155'
  },
  {
    id: 'amber_scope',
    name: 'Amber Thermal Scope',
    bg: '#180d03',
    scanline: 'rgba(245, 158, 11, 0.12)',
    bezel: '#292524'
  }
];

export class CrtScanlineSniperGame extends BaseGame {
  private playersState: Map<PlayerId, SniperPlayer> = new Map();
  private targets: CrtTarget[] = [];
  private callouts: FloatingCallout[] = [];
  private nextTargetId = 1;
  private hitStopTimer = 0;
  private suddenDeath = false;
  private themeIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupThemeHotkeys();
    this.reset(width, height);
  }

  private setupThemeHotkeys(): void {
    if (typeof window === 'undefined' || this.keyHandler) return;
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      } else if (e.key === '1') {
        this.themeIndex = 0;
      } else if (e.key === '2') {
        this.themeIndex = 1;
      } else if (e.key === '3') {
        this.themeIndex = 2;
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.playersState.clear();
    this.targets = [];
    this.callouts = [];
    this.nextTargetId = 1;
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const sx = spacing * (idx + 1);
      const sy = height / 2;
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        score: 0,
        streak: 1,
        cooldown: 0,
        stunTimer: 0,
        charge: 0,
        isCharging: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetX: sx,
        botTargetY: sy
      });
    });

    for (let i = 0; i < 7; i++) {
      this.spawnTarget(width, height);
    }
  }

  private spawnTarget(width: number, height: number): void {
    const isLeft = Math.random() < 0.5;
    const speed = 75 + Math.random() * 85;
    const roll = Math.random();
    let type: CrtTarget['type'] = 'SODA_CAN';
    let points = 20;
    let color = '#38bdf8';

    if (roll < 0.24) {
      type = 'GOLDEN_UFO';
      points = 55;
      color = '#fbbf24';
    } else if (roll < 0.65) {
      type = 'MALLARD_DUCK';
      points = 30;
      color = '#4ade80';
    } else if (roll > 0.85) {
      type = 'DECOY_SKUNK';
      points = -30;
      color = '#f43f5e';
    }

    this.targets.push({
      id: this.nextTargetId++,
      x: isLeft ? -18 : width + 18,
      y: 65 + Math.random() * (height - 125),
      vx: isLeft ? speed : -speed,
      vy: (Math.random() - 0.5) * 35,
      radius: type === 'GOLDEN_UFO' ? 15 : 17,
      type,
      points,
      color,
      lockRing: 2.0
    });
  }

  private addCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, vy: -38, text, color, life: 0.9 });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBoost();
      this.addCallout(width / 2, height * 0.24, 'SHARPSHOOTER FRENZY! 2X UFO POINTS!', '#fde047');
    }

    this.updateBots(dt, width, height);

    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 95;
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.lockRing = Math.max(1.0, t.lockRing - dt * 0.45);

      if (t.y < 58 || t.y > height - 48) t.vy *= -1;
      if ((t.vx > 0 && t.x > width + 36) || (t.vx < 0 && t.x < -36)) {
        this.targets.splice(i, 1);
        this.spawnTarget(width, height);
      }
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) ps.stunTimer -= dt;
      if (ps.cooldown > 0) ps.cooldown -= dt;

      const isBot = p.type.startsWith('bot_');
      const hasSteer = this.input.hasSteer(p.id);
      const steer = (ps.stunTimer > 0 || (!hasSteer && !isBot)) ? 0 : this.input.getSteer(p.id);
      const throttle = (ps.stunTimer > 0 || (!hasSteer && !isBot)) ? 0 : this.input.getThrottle(p.id);
      const actionHeld = ps.stunTimer <= 0 && (
        this.input.isActionPressed(p.id) ||
        (isBot && this.input.isPressed(p.id)) ||
        (!hasSteer && !isBot && this.input.isPressed(p.id))
      );

      const speedMult = ps.underdog ? 1.18 : 1.0;
      ps.vx += steer * 980 * speedMult * dt;
      ps.vy += -throttle * 980 * speedMult * dt;

      if (!hasSteer && !isBot && ps.stunTimer <= 0) {
        const bestT = this.targets.find(t => t.type !== 'DECOY_SKUNK');
        if (bestT) {
          const dx = bestT.x - ps.x;
          const dy = bestT.y - ps.y;
          const d = Math.hypot(dx, dy) || 1;
          ps.vx += (dx / d) * 720 * speedMult * dt;
          ps.vy += (dy / d) * 720 * speedMult * dt;
        }
      }

      // Hold-to-charge Zapper Chain-Lightning Shot & Recoil Shunt (72% - 98%)
      if (actionHeld) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.9);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          // Chain-Lightning Zapper Arc!
          let chainHits = 0;
          for (let i = this.targets.length - 1; i >= 0 && chainHits < 2; i--) {
            const t = this.targets[i];
            if (t.type !== 'DECOY_SKUNK' && Math.hypot(t.x - ps.x, t.y - ps.y) < 120) {
              chainHits++;
              const pts = t.points * 2;
              ps.score += pts;
              this.particles.emit(t.x, t.y, 18, '#fde047');
              this.targets.splice(i, 1);
              this.spawnTarget(width, height);
            }
          }
          ps.score += 45;
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.28);
          this.addCallout(ps.x, ps.y - 24, 'ZAPPER CHAIN ARC! +45', '#fde047');

          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            if (Math.hypot(rival.x - ps.x, rival.y - ps.y) < 105) {
              const ang = Math.atan2(rival.y - ps.y, rival.x - ps.x);
              rival.vx += Math.cos(ang) * 380;
              rival.vy += Math.sin(ang) * 380;
              rival.stunTimer = 0.6;
              ps.score += 50;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 18, 'CROSSHAIR SHUNT! +50', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.45;
          this.audio.playBuzzer();
        } else if (ps.cooldown <= 0) {
          ps.cooldown = 0.25;
          this.audio.playLaser();
          let hit = false;
          for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            if (Math.hypot(ps.x - t.x, ps.y - t.y) < t.radius + 14) {
              hit = true;
              if (t.type === 'DECOY_SKUNK') {
                ps.stunTimer = 0.85;
                ps.streak = 1;
                ps.score = Math.max(0, ps.score - 25);
                this.audio.playBuzzer();
                this.particles.shake(0.28);
                this.addCallout(t.x, t.y, 'DECOY SKUNK! -25', '#ef4444');
              } else {
                const lockBonus = t.lockRing <= 1.25 ? 2 : 1;
                const pts = t.points * lockBonus * (this.suddenDeath ? 2 : 1);
                ps.score += pts;
                ps.streak = Math.min(4, ps.streak + 1);
                this.audio.playScore();
                this.particles.emit(t.x, t.y, 16, t.color);
                this.addCallout(t.x, t.y - 14, lockBonus > 1 ? `BULLSEYE! +${pts}` : `+${pts}`, t.color);
              }
              this.targets.splice(i, 1);
              this.spawnTarget(width, height);
              break;
            }
          }
          if (!hit) {
            this.particles.emit(ps.x, ps.y, 5, '#64748b');
          }
        }
        ps.charge = 0;
      }

      ps.vx *= Math.pow(0.015, dt);
      ps.vy *= Math.pow(0.015, dt);
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;
      ps.x = Math.max(28, Math.min(width - 28, ps.x));
      ps.y = Math.max(54, Math.min(height - 34, ps.y));
    }

    // Elastic Crosshair Bump
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 30) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 210;
          a.vy -= ny * 210;
          b.vx += nx * 210;
          b.vy += ny * 210;
          this.audio.playBounce();
        }
      }
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y += c.vy * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer <= 0) {
      ps.botReactionTimer = difficulty === 'bot_easy' ? 0.32 : difficulty === 'bot_normal' ? 0.2 : 0.12;
      const valid = this.targets.filter((t) => t.type !== 'DECOY_SKUNK');
      if (valid.length > 0) {
        const t = valid[0];
        const jitter = difficulty === 'bot_easy' ? 32 : difficulty === 'bot_normal' ? 14 : 4;
        ps.botTargetX = t.x + (Math.random() - 0.5) * jitter;
        ps.botTargetY = t.y + (Math.random() - 0.5) * jitter;
      }
    }

    const dx = ps.botTargetX - ps.x;
    const dy = ps.botTargetY - ps.y;
    const dist = Math.hypot(dx, dy) || 1;
    const close = dist < 20;

    let press = false;
    if (ps.isCharging) {
      press = ps.charge < 0.82;
    } else if (close) {
      press = Math.random() < 0.45;
    }

    this.input.setBotInput(botId, press, dx / dist, -dy / dist);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = theme.scanline;
    ctx.lineWidth = 1;
    for (let y = 36; y < height; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = theme.bezel;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 36, width - 6, height - 39);

    // Targets
    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.type !== 'DECOY_SKUNK') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, t.radius * t.lockRing, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#020617';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        t.type === 'GOLDEN_UFO' ? 'UFO' : t.type === 'MALLARD_DUCK' ? 'DUCK' : t.type === 'DECOY_SKUNK' ? 'BOMB' : 'CAN',
        0,
        3
      );
      ctx.restore();
    }

    // Player Crosshairs
    for (const ps of this.playersState.values()) {
      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = ps.stunTimer > 0 ? '#64748b' : ps.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.moveTo(-21, 0);
      ctx.lineTo(21, 0);
      ctx.moveTo(0, -21);
      ctx.lineTo(0, 21);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name}: ${ps.score}`, 0, 28);
      ctx.restore();
    }

    for (const c of this.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
      ctx.fillStyle = c.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(6, 21, 13, 0.82)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Aim Scope • Tap: Snipe • Hold (72-98%): Zapper Chain Arc & Shunt', width - 14, 22);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.values())
      .sort((a, b) => b.score - a.score)
      .map((ps, idx) => ({
        playerId: ps.id,
        score: Math.round(ps.score),
        place: idx + 1
      }));

    return {
      winnerId: rankings[0]?.playerId ?? null,
      rankings,
      mvpHighlight: 'Sniped the Phosphor CRT Gallery with Zapper Chain-Lightning!'
    };
  }

  public handlePointerDown(x: number, y: number, _width: number, _height: number): boolean {
    if (y <= 42 && x <= 260) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playSelect();
      return true;
    }
    return false;
  }
}
