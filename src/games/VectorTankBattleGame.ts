import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VectorShell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  maxBounces: number;
  isRailSabot: boolean;
  ownerId: PlayerId;
  color: string;
}

interface WireframePyramid {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

interface RadarCorePickup {
  x: number;
  y: number;
  points: number;
  pulse: number;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface VectorTankPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  streak: number;
  cooldown: number;
  stunTimer: number;
  charge: number;
  isCharging: boolean;
  underdog: boolean;
  botReactionTimer: number;
  botTargetAngle: number;
}

interface ThemePalette {
  id: string;
  name: string;
  bg: string;
  vectorLine: string;
  gridLine: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'phosphor_green',
    name: '1980 Battlezone Green',
    bg: '#020c06',
    vectorLine: '#22c55e',
    gridLine: 'rgba(34, 197, 94, 0.16)'
  },
  {
    id: 'virtual_red',
    name: 'Crimson Virtual Radar',
    bg: '#140305',
    vectorLine: '#f43f5e',
    gridLine: 'rgba(244, 63, 94, 0.16)'
  },
  {
    id: 'cyber_cyan',
    name: 'Tron Cyan Grid',
    bg: '#020917',
    vectorLine: '#38bdf8',
    gridLine: 'rgba(56, 189, 248, 0.16)'
  }
];

export class VectorTankBattleGame extends BaseGame {
  private playersState: Map<PlayerId, VectorTankPlayer> = new Map();
  private shells: VectorShell[] = [];
  private obstacles: WireframePyramid[] = [];
  private cores: RadarCorePickup[] = [];
  private callouts: FloatingCallout[] = [];
  private radarAngle = 0;
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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.playersState.clear();
    this.shells = [];
    this.obstacles = [];
    this.cores = [];
    this.callouts = [];
    this.radarAngle = 0;
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startY = idx % 2 === 0 ? 96 : height - 76;
      const startAngle = idx % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: spacing * (idx + 1),
        y: startY,
        vx: 0,
        vy: 0,
        angle: startAngle,
        score: 0,
        streak: 1,
        cooldown: 0,
        stunTimer: 0,
        charge: 0,
        isCharging: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetAngle: startAngle
      });
    });

    const midX = width / 2;
    const midY = height / 2 + 10;
    this.obstacles.push(
      { x: midX - 135, y: midY - 26, w: 52, h: 52, hp: 5 },
      { x: midX + 83, y: midY - 26, w: 52, h: 52, hp: 5 },
      { x: midX - 26, y: midY - 88, w: 52, h: 42, hp: 5 },
      { x: midX - 26, y: midY + 46, w: 52, h: 42, hp: 5 }
    );

    this.spawnCore(width, height);
  }

  private spawnCore(width: number, height: number): void {
    this.cores.push({
      x: width / 2 + (Math.random() - 0.5) * 90,
      y: height / 2 + (Math.random() - 0.5) * 60,
      points: this.suddenDeath ? 90 : 55,
      pulse: 0
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
      this.addCallout(width / 2, height * 0.25, 'RADAR OVERLOAD! RICOCHET 2X!', '#fde047');
    }

    this.updateBots(dt, width, height);
    this.radarAngle = (this.radarAngle + dt * 3.8) % (Math.PI * 2);

    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 100;
    }

    if (this.cores.length < 2 && Math.random() < 0.025) {
      this.spawnCore(width, height);
    }

    // Update Shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.x < 18 || s.x > width - 18) {
        s.vx *= -1;
        s.bounces++;
        this.audio.playBounce();
      }
      if (s.y < 46 || s.y > height - 18) {
        s.vy *= -1;
        s.bounces++;
        this.audio.playBounce();
      }

      for (let k = this.obstacles.length - 1; k >= 0; k--) {
        const ob = this.obstacles[k];
        if (s.x >= ob.x && s.x <= ob.x + ob.w && s.y >= ob.y && s.y <= ob.y + ob.h) {
          if (s.isRailSabot) {
            ob.hp -= 2;
            if (ob.hp <= 0) this.obstacles.splice(k, 1);
            this.particles.emit(s.x, s.y, 12, '#fde047');
          } else {
            s.vx *= -1;
            s.vy *= -1;
            s.bounces++;
            this.audio.playBounce();
          }
          break;
        }
      }

      if (s.bounces > s.maxBounces) {
        this.shells.splice(i, 1);
        continue;
      }

      // Tank impacts
      for (const ps of this.playersState.values()) {
        if (ps.stunTimer > 0) continue;
        if (Math.hypot(s.x - ps.x, s.y - ps.y) < 20) {
          if (s.ownerId !== ps.id || s.bounces > 0) {
            ps.stunTimer = 1.05;
            ps.streak = 1;
            const shooter = this.playersState.get(s.ownerId);
            if (shooter && s.ownerId !== ps.id) {
              const pts = (s.bounces > 0 ? 85 : 55) * (this.suddenDeath ? 2 : 1);
              shooter.score += pts;
              shooter.streak = Math.min(4, shooter.streak + 1);
              this.addCallout(
                ps.x,
                ps.y - 22,
                s.bounces > 0 ? `RICOCHET SNIPE! +${pts}` : `DIRECT HIT! +${pts}`,
                shooter.color
              );
            }
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();
            this.particles.shake(0.35);
            this.particles.emit(ps.x, ps.y, 20, s.color);
            this.shells.splice(i, 1);
            break;
          }
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) ps.stunTimer -= dt;
      if (ps.cooldown > 0) ps.cooldown -= dt;

      const steer = ps.stunTimer > 0 ? 0 : this.input.getSteer(p.id);
      const throttle = ps.stunTimer > 0 ? 0 : this.input.getThrottle(p.id);
      const isPressed = ps.stunTimer <= 0 && this.input.isPressed(p.id);

      // Responsive turret rotation & drive
      if (Math.abs(steer) > 0.08) {
        ps.angle += steer * 3.6 * dt;
      }

      const speedMult = ps.underdog ? 1.18 : 1.0;
      const forward = Math.abs(throttle) > 0.08 ? -throttle : 0.35;
      ps.vx += Math.cos(ps.angle) * forward * 540 * speedMult * dt;
      ps.vy += Math.sin(ps.angle) * forward * 540 * speedMult * dt;

      // Hold-to-charge Railgun Sabot & Shockwave Shunt (72% - 98%)
      if (isPressed) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.85);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          this.shells.push({
            x: ps.x + Math.cos(ps.angle) * 20,
            y: ps.y + Math.sin(ps.angle) * 20,
            vx: Math.cos(ps.angle) * 390,
            vy: Math.sin(ps.angle) * 390,
            bounces: 0,
            maxBounces: 4,
            isRailSabot: true,
            ownerId: p.id,
            color: '#fde047'
          });
          ps.vx -= Math.cos(ps.angle) * 140;
          ps.vy -= Math.sin(ps.angle) * 140;
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.3);
          this.addCallout(ps.x, ps.y - 26, 'RAILGUN SABOT & SHUNT!', '#fde047');

          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            const d = Math.hypot(rival.x - ps.x, rival.y - ps.y);
            if (d < 95) {
              const ang = Math.atan2(rival.y - ps.y, rival.x - ps.x);
              rival.vx += Math.cos(ang) * 320;
              rival.vy += Math.sin(ang) * 320;
              rival.stunTimer = 0.6;
              ps.score += 50;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 20, 'TANK RAM SHUNT! +50', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.5;
          this.audio.playBuzzer();
          this.addCallout(ps.x, ps.y - 20, 'TURRET OVERHEAT!', '#ef4444');
        } else if (ps.cooldown <= 0) {
          ps.cooldown = 0.42;
          this.shells.push({
            x: ps.x + Math.cos(ps.angle) * 18,
            y: ps.y + Math.sin(ps.angle) * 18,
            vx: Math.cos(ps.angle) * 290,
            vy: Math.sin(ps.angle) * 290,
            bounces: 0,
            maxBounces: 2,
            isRailSabot: false,
            ownerId: p.id,
            color: ps.color
          });
          this.audio.playLaser();
        }
        ps.charge = 0;
      }

      ps.vx *= Math.pow(0.02, dt);
      ps.vy *= Math.pow(0.02, dt);
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;
      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(58, Math.min(height - 30, ps.y));

      // Collect Radar Cores
      for (let k = this.cores.length - 1; k >= 0; k--) {
        const c = this.cores[k];
        c.pulse += dt * 5;
        if (Math.hypot(ps.x - c.x, ps.y - c.y) < 24) {
          ps.score += c.points;
          this.audio.playScore();
          this.particles.emit(c.x, c.y, 16, '#fde047');
          this.addCallout(c.x, c.y - 16, `RADAR CORE! +${c.points}`, '#fde047');
          this.cores.splice(k, 1);
        }
      }
    }

    // Tank-to-Tank Collisions
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
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
      ps.botReactionTimer = difficulty === 'bot_easy' ? 0.3 : difficulty === 'bot_normal' ? 0.2 : 0.12;

      let targetX = ps.x;
      let targetY = ps.y;
      for (const [id, opp] of this.playersState) {
        if (id !== botId) {
          targetX = opp.x;
          targetY = opp.y;
          break;
        }
      }
      const dispersion = difficulty === 'bot_easy' ? 0.38 : difficulty === 'bot_normal' ? 0.16 : 0.05;
      ps.botTargetAngle = Math.atan2(targetY - ps.y, targetX - ps.x) + (Math.random() - 0.5) * dispersion;
    }

    let diff = ps.botTargetAngle - ps.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const steer = Math.abs(diff) > 0.08 ? Math.sign(diff) : 0;
    let press = false;
    if (ps.isCharging) {
      press = ps.charge < 0.82;
    } else if (Math.abs(diff) < 0.26) {
      press = Math.random() < 0.35;
    }

    this.input.setBotInput(botId, press, steer, -0.5);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Vector Grid & Sweeping Radar Line
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 36);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 36; y < height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const cx = width / 2;
    const cy = height / 2 + 10;
    ctx.strokeStyle = theme.vectorLine;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI * 2);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.radarAngle) * 180, cy + Math.sin(this.radarAngle) * 180);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 3D Wireframe Pyramids
    ctx.strokeStyle = theme.vectorLine;
    ctx.lineWidth = 2;
    for (const ob of this.obstacles) {
      const ox = ob.x + ob.w / 2;
      const oy = ob.y + ob.h / 2;
      ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
      ctx.beginPath();
      ctx.moveTo(ob.x, ob.y);
      ctx.lineTo(ox, oy - 8);
      ctx.moveTo(ob.x + ob.w, ob.y);
      ctx.lineTo(ox, oy - 8);
      ctx.moveTo(ob.x, ob.y + ob.h);
      ctx.lineTo(ox, oy - 8);
      ctx.moveTo(ob.x + ob.w, ob.y + ob.h);
      ctx.lineTo(ox, oy - 8);
      ctx.stroke();
    }

    // Radar Cores
    for (const c of this.cores) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11 + Math.sin(c.pulse) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shells
    for (const s of this.shells) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.isRailSabot ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vector Tanks
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

      ctx.save();
      ctx.rotate(ps.angle);
      ctx.strokeStyle = ps.stunTimer > 0 ? '#64748b' : ps.color;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(-14, -11, 28, 22);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.moveTo(7, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name}: ${ps.score}`, 0, 26);
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

    ctx.fillStyle = 'rgba(2, 12, 6, 0.8)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Aim Turret • Tap: Ricochet Shell • Hold (72-98%): Railgun & Shunt', width - 14, 22);
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
      mvpHighlight: 'Commanded the 1980 Vector Battlefield with ricochet precision!'
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
