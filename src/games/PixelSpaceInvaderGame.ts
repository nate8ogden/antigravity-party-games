import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Invader {
  x: number;
  y: number;
  row: number;
  col: number;
  points: number;
  alive: boolean;
  color: string;
}

interface BunkerBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

interface LaserProjectile {
  x: number;
  y: number;
  vy: number;
  ownerId: PlayerId | null; // null = alien plasma bomb
  isGigaBeam: boolean;
  color: string;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface TurretPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  score: number;
  combo: number;
  cooldown: number;
  stunTimer: number;
  charge: number;
  isCharging: boolean;
  underdog: boolean;
  botReactionTimer: number;
  botTargetX: number;
}

interface ThemePalette {
  id: string;
  name: string;
  bgTop: string;
  bgBot: string;
  bunkerColor: string;
  railColor: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'arcade_1978',
    name: '1978 Taito Phosphor',
    bgTop: '#020617',
    bgBot: '#090d16',
    bunkerColor: '#22c55e',
    railColor: '#38bdf8'
  },
  {
    id: 'galaga_nebula',
    name: 'Galaga Crimson Nebula',
    bgTop: '#1a0526',
    bgBot: '#090214',
    bunkerColor: '#f43f5e',
    railColor: '#fde047'
  },
  {
    id: 'vectrex_amber',
    name: 'Vectrex Amber CRT',
    bgTop: '#180d02',
    bgBot: '#0c0601',
    bunkerColor: '#f59e0b',
    railColor: '#fbbf24'
  }
];

export class PixelSpaceInvaderGame extends BaseGame {
  private playersState: Map<PlayerId, TurretPlayer> = new Map();
  private invaders: Invader[] = [];
  private bunkers: BunkerBlock[] = [];
  private bullets: LaserProjectile[] = [];
  private callouts: FloatingCallout[] = [];
  private invaderDir = 1;
  private invaderSpeed = 38;
  private animPhase = 0;
  private ufoX = -60;
  private ufoActive = false;
  private ufoTimer = 4.5;
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
    this.invaders = [];
    this.bunkers = [];
    this.bullets = [];
    this.callouts = [];
    this.invaderDir = 1;
    this.invaderSpeed = 38;
    this.animPhase = 0;
    this.ufoActive = false;
    this.ufoTimer = 4.0;
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: startX,
        y: height - 48,
        vx: 0,
        score: 0,
        combo: 1,
        cooldown: 0,
        stunTimer: 0,
        charge: 0,
        isCharging: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetX: startX
      });
    });

    this.spawnInvaderWave(width);
    this.buildBunkers(width, height);
  }

  private spawnInvaderWave(width: number): void {
    this.invaders = [];
    const rows = 4;
    const cols = 8;
    const colors = ['#f43f5e', '#ec4899', '#38bdf8', '#22c55e'];
    const pointValues = [35, 25, 20, 15];
    const startX = (width - (cols - 1) * 44) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.invaders.push({
          x: startX + c * 44,
          y: 78 + r * 30,
          row: r,
          col: c,
          points: pointValues[r],
          alive: true,
          color: colors[r]
        });
      }
    }
  }

  private buildBunkers(width: number, height: number): void {
    this.bunkers = [];
    const bunkerY = height - 105;
    const centers = [width * 0.24, width * 0.5, width * 0.76];
    for (const cx of centers) {
      for (let bx = -1; bx <= 1; bx++) {
        this.bunkers.push({
          x: cx + bx * 16 - 7,
          y: bunkerY + (bx === 0 ? -6 : 0),
          w: 14,
          h: 12,
          hp: 3
        });
      }
    }
  }

  private addCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, vy: -40, text, color, life: 0.9 });
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
      this.invaderSpeed += 24;
      this.audio.playBoost();
      this.addCallout(width / 2, height * 0.3, 'MOTHERSHIP SWARM! 2X UFO POINTS!', '#fde047');
    }

    this.updateBots(dt, width, height);
    this.animPhase += dt * 5;

    // Leader / Underdog Surge
    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 120;
    }

    // Mystery Golden Mothership UFO
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0 && !this.ufoActive) {
      this.ufoActive = true;
      this.ufoX = -35;
      this.ufoTimer = this.suddenDeath ? 5.5 : 8.0;
    }
    if (this.ufoActive) {
      this.ufoX += 115 * dt;
      if (this.ufoX > width + 45) {
        this.ufoActive = false;
      }
    }

    // Invader Marching Formation
    let hitEdge = false;
    let aliveCount = 0;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      aliveCount++;
      inv.x += this.invaderDir * this.invaderSpeed * dt;
      if (inv.x < 35 || inv.x > width - 35) {
        hitEdge = true;
      }
    }

    if (aliveCount === 0) {
      this.spawnInvaderWave(width);
      this.invaderSpeed = Math.min(110, this.invaderSpeed + 12);
      this.audio.playScore();
      this.addCallout(width / 2, 110, 'NEW INVADER WAVE!', '#38bdf8');
    } else if (hitEdge) {
      this.invaderDir *= -1;
      this.invaderSpeed = Math.min(115, this.invaderSpeed + 5);
      for (const inv of this.invaders) {
        inv.y = Math.min(height - 140, inv.y + 12);
      }
    }

    // Alien Plasma Bomb Drop
    if (Math.random() < (this.suddenDeath ? 0.055 : 0.035)) {
      const live = this.invaders.filter((i) => i.alive);
      if (live.length > 0) {
        const shooter = live[Math.floor(Math.random() * live.length)];
        this.bullets.push({
          x: shooter.x,
          y: shooter.y + 12,
          vy: 165,
          ownerId: null,
          isGigaBeam: false,
          color: '#ef4444'
        });
      }
    }

    // Update Projectiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;

      if (b.y < 32 || b.y > height) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check bunker collisions for non-piercing shots
      let stoppedByBunker = false;
      for (let k = this.bunkers.length - 1; k >= 0; k--) {
        const bk = this.bunkers[k];
        if (b.x >= bk.x && b.x <= bk.x + bk.w && b.y >= bk.y && b.y <= bk.y + bk.h) {
          if (b.ownerId === null) {
            bk.hp--;
            if (bk.hp <= 0) this.bunkers.splice(k, 1);
            this.particles.emit(b.x, b.y, 6, '#22c55e');
            stoppedByBunker = true;
            break;
          }
        }
      }
      if (stoppedByBunker) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.ownerId !== null) {
        const ps = this.playersState.get(b.ownerId);

        // Hit Golden UFO
        if (this.ufoActive && Math.hypot(b.x - this.ufoX, b.y - 54) < (b.isGigaBeam ? 28 : 20)) {
          const ufoPts = this.suddenDeath ? 150 : 95;
          if (ps) {
            ps.score += ufoPts;
            ps.combo = Math.min(4, ps.combo + 1);
          }
          this.ufoActive = false;
          this.hitStopTimer = 0.045;
          this.audio.playScore();
          this.particles.shake(0.3);
          this.particles.emit(this.ufoX, 54, 24, '#fbbf24');
          this.addCallout(this.ufoX, 54, `MOTHERSHIP SNIPE! +${ufoPts}`, '#fbbf24');
          if (!b.isGigaBeam) {
            this.bullets.splice(i, 1);
            continue;
          }
        }

        // Hit Invaders
        let consumed = false;
        for (const inv of this.invaders) {
          if (!inv.alive) continue;
          if (Math.hypot(b.x - inv.x, b.y - inv.y) < (b.isGigaBeam ? 24 : 15)) {
            inv.alive = false;
            if (ps) {
              const pts = inv.points * ps.combo;
              ps.score += pts;
              ps.combo = Math.min(4, ps.combo + 1);
              this.addCallout(inv.x, inv.y - 10, `+${pts} (${ps.combo}x)`, inv.color);
            }
            this.audio.playExplosion();
            this.particles.emit(inv.x, inv.y, 12, inv.color);
            if (!b.isGigaBeam) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.bullets.splice(i, 1);
          continue;
        }
      } else {
        // Alien bomb hitting player turret
        for (const ps of this.playersState.values()) {
          if (ps.stunTimer > 0) continue;
          if (Math.hypot(b.x - ps.x, b.y - ps.y) < 17) {
            ps.stunTimer = 0.95;
            ps.combo = 1;
            ps.score = Math.max(0, ps.score - 25);
            this.audio.playBuzzer();
            this.particles.shake(0.32);
            this.particles.emit(ps.x, ps.y, 16, '#ef4444');
            this.addCallout(ps.x, ps.y - 18, 'PLASMA HIT! COMBO RESET', '#ef4444');
            this.bullets.splice(i, 1);
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
      const isPressed = ps.stunTimer <= 0 && this.input.isPressed(p.id);

      if (isPressed) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.85);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          // Piercing Giga-Wave Cannon & EMP Shunt!
          this.bullets.push({
            x: ps.x,
            y: ps.y - 18,
            vy: -460,
            ownerId: p.id,
            isGigaBeam: true,
            color: '#fde047'
          });
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.28);
          this.particles.emit(ps.x, ps.y - 16, 22, '#fde047');
          this.addCallout(ps.x, ps.y - 28, 'GIGA-WAVE CANNON!', '#fde047');

          // EMP Shunt nearby rival turrets
          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            if (Math.abs(rival.x - ps.x) < 95) {
              const dir = rival.x >= ps.x ? 1 : -1;
              rival.vx += dir * 320;
              rival.stunTimer = 0.55;
              ps.score += 55;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 22, 'EMP TURRET SHUNT! +55', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.5;
          this.audio.playBuzzer();
          this.addCallout(ps.x, ps.y - 20, 'CANNON OVERHEAT!', '#ef4444');
        } else if (ps.cooldown <= 0) {
          // Rapid Laser Shot
          ps.cooldown = 0.24;
          this.bullets.push({
            x: ps.x,
            y: ps.y - 16,
            vy: -380,
            ownerId: p.id,
            isGigaBeam: false,
            color: ps.color
          });
          this.audio.playLaser();
        }
        ps.charge = 0;
      }

      const speedMult = ps.underdog ? 1.18 : 1.0;
      ps.vx += steer * 980 * speedMult * dt;
      ps.vx *= Math.pow(0.012, dt);
      ps.x += ps.vx * dt;
      ps.x = Math.max(36, Math.min(width - 36, ps.x));
    }

    // Elastic Turret-to-Turret Rail Collisions
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) < 36) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = 36 - Math.abs(dx);
          a.x -= sign * overlap * 0.5;
          b.x += sign * overlap * 0.5;
          a.vx -= sign * 180;
          b.vx += sign * 180;
          this.audio.playBounce();
        }
      }
    }

    // Update Callouts
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
    width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer <= 0) {
      ps.botReactionTimer = difficulty === 'bot_easy' ? 0.3 : difficulty === 'bot_normal' ? 0.2 : 0.12;

      if (this.ufoActive && difficulty !== 'bot_easy') {
        ps.botTargetX = this.ufoX + 20;
      } else {
        const live = this.invaders.filter((i) => i.alive);
        if (live.length > 0) {
          const target = live[Math.floor(Math.random() * live.length)];
          const jitter = difficulty === 'bot_easy' ? 35 : difficulty === 'bot_normal' ? 14 : 4;
          ps.botTargetX = target.x + (Math.random() - 0.5) * jitter;
        } else {
          ps.botTargetX = width / 2;
        }
      }
    }

    // Dodge incoming alien bomb
    let steer = Math.abs(ps.botTargetX - ps.x) > 8 ? Math.sign(ps.botTargetX - ps.x) : 0;
    for (const b of this.bullets) {
      if (b.ownerId === null && b.y > ps.y - 95 && Math.abs(b.x - ps.x) < 28) {
        steer = b.x >= ps.x ? -1 : 1;
        break;
      }
    }

    let press = false;
    if (ps.isCharging) {
      press = ps.charge < (difficulty === 'bot_hard' ? 0.84 : 0.65);
    } else if (Math.abs(ps.botTargetX - ps.x) < 26) {
      press = Math.random() < 0.35;
    }

    this.input.setBotInput(botId, press, steer, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    // 1. Deep Space Cabinet Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Golden Mothership UFO
    if (this.ufoActive) {
      ctx.save();
      ctx.translate(this.ufoX, 54);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -4, 9, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    }

    // 3. Marching Voxel Invaders
    const wingUp = Math.sin(this.animPhase) > 0;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      ctx.save();
      ctx.translate(inv.x, inv.y);
      ctx.fillStyle = inv.color;
      // Crab / Squid pixel silhouette
      ctx.fillRect(-11, -7, 22, 12);
      ctx.fillRect(-7, -11, 14, 4);
      ctx.fillRect(-15, wingUp ? -9 : -2, 4, 8);
      ctx.fillRect(11, wingUp ? -9 : -2, 4, 8);
      // Glowing eyes
      ctx.fillStyle = '#020617';
      ctx.fillRect(-6, -4, 4, 4);
      ctx.fillRect(2, -4, 4, 4);
      ctx.restore();
    }

    // 4. Destructible Shield Bunkers
    for (const bk of this.bunkers) {
      ctx.fillStyle = theme.bunkerColor;
      ctx.globalAlpha = bk.hp / 3;
      ctx.fillRect(bk.x, bk.y, bk.w, bk.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bk.x, bk.y, bk.w, bk.h);
    }
    ctx.globalAlpha = 1;

    // 5. Defense Rail & Player Laser Turrets
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, height - 36);
    ctx.lineTo(width - 24, height - 36);
    ctx.stroke();

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = ps.stunTimer > 0 ? '#64748b' : ps.color;
      ctx.strokeStyle = ps.underdog ? '#fde047' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-16, -8, 32, 16, 4);
      ctx.fill();
      ctx.stroke();
      // Cannon barrel
      ctx.fillRect(-4, -18, 8, 10);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name}: ${ps.score} (${ps.combo}x)`, 0, 24);
      ctx.restore();
    }

    // 6. Projectiles
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      if (b.isGigaBeam) {
        ctx.fillRect(b.x - 6, b.y - 18, 12, 34);
      } else {
        ctx.fillRect(b.x - 2.5, b.y - 7, 5, 14);
      }
    }

    // 7. Callouts & HUD
    for (const c of this.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
      ctx.fillStyle = c.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Slide Turret • Tap: Laser • Hold (72-98%): Giga-Wave & EMP Shunt', width - 14, 22);
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
      mvpHighlight: 'Cleared the Alien Matrix with Giga-Wave Cannon combos!'
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
