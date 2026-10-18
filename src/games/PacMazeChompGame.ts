import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Pellet {
  x: number;
  y: number;
  isEnergizer: boolean;
  isCherry: boolean;
  collected: boolean;
}

interface MazeWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MazeGhost {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
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

interface PacPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  powerTimer: number;
  stunTimer: number;
  mouthAngle: number;
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
  wallStroke: string;
  wallFill: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'namco_neon',
    name: '1980 Cobalt Labyrinth',
    bg: '#020414',
    wallStroke: '#2563eb',
    wallFill: 'rgba(37, 99, 235, 0.18)'
  },
  {
    id: 'candy_labyrinth',
    name: 'Ms. Arcade Magenta',
    bg: '#160312',
    wallStroke: '#ec4899',
    wallFill: 'rgba(236, 72, 153, 0.18)'
  },
  {
    id: 'emerald_circuit',
    name: 'Emerald PCB Maze',
    bg: '#02120a',
    wallStroke: '#10b981',
    wallFill: 'rgba(16, 185, 129, 0.18)'
  }
];

export class PacMazeChompGame extends BaseGame {
  private playersState: Map<PlayerId, PacPlayer> = new Map();
  private pellets: Pellet[] = [];
  private walls: MazeWall[] = [];
  private ghosts: MazeGhost[] = [];
  private callouts: FloatingCallout[] = [];
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
    this.pellets = [];
    this.walls = [];
    this.ghosts = [];
    this.callouts = [];
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);
      const startY = height - 52;
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        score: 0,
        powerTimer: 0,
        stunTimer: 0,
        mouthAngle: 0.2,
        charge: 0,
        isCharging: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetX: startX,
        botTargetY: startY
      });
    });

    const cx = width / 2;
    const cy = height / 2 + 8;
    this.walls = [
      { x: cx - 140, y: cy - 68, w: 72, h: 20 },
      { x: cx + 68, y: cy - 68, w: 72, h: 20 },
      { x: cx - 140, y: cy + 48, w: 72, h: 20 },
      { x: cx + 68, y: cy + 48, w: 72, h: 20 },
      { x: cx - 36, y: cy - 14, w: 72, h: 28 }
    ];

    this.populatePellets(width, height);

    this.ghosts = [
      { name: 'BLINKY', x: cx - 45, y: cy - 35, vx: 85, vy: 0, color: '#ef4444' },
      { name: 'PINKY', x: cx + 45, y: cy - 35, vx: -85, vy: 0, color: '#f472b6' },
      { name: 'INKY', x: cx - 45, y: cy + 35, vx: 0, vy: -80, color: '#38bdf8' },
      { name: 'CLYDE', x: cx + 45, y: cy + 35, vx: 0, vy: 80, color: '#f97316' }
    ];
  }

  private populatePellets(width: number, height: number): void {
    this.pellets = [];
    const stepX = 36;
    const stepY = 32;
    for (let x = 44; x < width - 38; x += stepX) {
      for (let y = 62; y < height - 46; y += stepY) {
        let insideWall = false;
        for (const w of this.walls) {
          if (x >= w.x - 10 && x <= w.x + w.w + 10 && y >= w.y - 10 && y <= w.y + w.h + 10) {
            insideWall = true;
            break;
          }
        }
        if (insideWall) continue;

        const isCorner = (x <= 65 || x >= width - 65) && (y <= 82 || y >= height - 72);
        this.pellets.push({
          x,
          y,
          isEnergizer: isCorner,
          isCherry: Math.abs(x - width / 2) < 22 && Math.abs(y - (height / 2 - 42)) < 20,
          collected: false
        });
      }
    }
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
      this.addCallout(width / 2, height * 0.25, 'GHOST FRENZY! 2X CHOMP POINTS!', '#fde047');
    }

    this.updateBots(dt, width, height);

    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 90;
    }

    // Respawn pellets if all eaten
    if (this.pellets.every((p) => p.collected)) {
      this.populatePellets(width, height);
      this.audio.playScore();
    }

    // Update Ghosts
    for (const g of this.ghosts) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      if (g.x < 30 || g.x > width - 30) g.vx *= -1;
      if (g.y < 52 || g.y > height - 36) g.vy *= -1;

      if (Math.random() < 0.025) {
        const spd = this.suddenDeath ? 105 : 85;
        if (Math.random() < 0.5) {
          g.vx = Math.random() < 0.5 ? spd : -spd;
          g.vy = 0;
        } else {
          g.vx = 0;
          g.vy = Math.random() < 0.5 ? spd : -spd;
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) ps.stunTimer -= dt;
      if (ps.powerTimer > 0) ps.powerTimer -= dt;

      ps.mouthAngle = Math.abs(Math.sin((45 - this.roundTimer) * 14)) * 0.42 + 0.06;

      const steer = ps.stunTimer > 0 ? 0 : this.input.getSteer(p.id);
      const throttle = ps.stunTimer > 0 ? 0 : this.input.getThrottle(p.id);
      const isBot = p.type.startsWith('bot_');
      const actionHeld = ps.stunTimer <= 0 && (this.input.isActionPressed(p.id) || (isBot && this.input.isPressed(p.id)));

      // Hold-to-charge Waka-Warp Dash & Sonic Siren Shunt (72% - 98%)
      if (actionHeld) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.88);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          ps.vx += Math.cos(ps.angle) * 360;
          ps.vy += Math.sin(ps.angle) * 360;
          ps.powerTimer = Math.max(ps.powerTimer, 3.2);
          ps.score += 45;
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.28);
          this.particles.emit(ps.x, ps.y, 20, '#fde047');
          this.addCallout(ps.x, ps.y - 24, 'WAKA-WARP DASH! +45', '#fde047');

          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            if (Math.hypot(rival.x - ps.x, rival.y - ps.y) < 95) {
              const ang = Math.atan2(rival.y - ps.y, rival.x - ps.x);
              rival.vx += Math.cos(ang) * 320;
              rival.vy += Math.sin(ang) * 320;
              rival.stunTimer = 0.65;
              ps.score += 50;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 18, 'SIREN SHUNT! +50', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.5;
          this.audio.playBuzzer();
          this.addCallout(ps.x, ps.y - 18, 'CHOMP OVERLOAD!', '#ef4444');
        }
        ps.charge = 0;
      }

      const moveSpeed = (ps.powerTimer > 0 ? 580 : 440) * (ps.underdog ? 1.16 : 1.0);
      if (Math.abs(steer) > 0.08 || Math.abs(throttle) > 0.08) {
        ps.angle = Math.atan2(-throttle, steer);
        ps.vx += steer * moveSpeed * dt;
        ps.vy += -throttle * moveSpeed * dt;
      }

      ps.vx *= Math.pow(0.015, dt);
      ps.vy *= Math.pow(0.015, dt);
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Side Warp Tunnels!
      if (ps.x < 12) ps.x = width - 14;
      if (ps.x > width - 12) ps.x = 14;
      ps.y = Math.max(50, Math.min(height - 34, ps.y));

      // Chomp Pellets
      for (const pel of this.pellets) {
        if (pel.collected) continue;
        if (Math.hypot(ps.x - pel.x, ps.y - pel.y) < (pel.isEnergizer ? 19 : 14)) {
          pel.collected = true;
          if (pel.isEnergizer) {
            ps.score += 45;
            ps.powerTimer = 5.5;
            this.audio.playBoost();
            this.particles.emit(pel.x, pel.y, 16, '#fde047');
            this.addCallout(pel.x, pel.y - 14, 'POWER ENERGIZER! +45', '#fde047');
          } else if (pel.isCherry) {
            ps.score += 65;
            this.audio.playScore();
            this.particles.emit(pel.x, pel.y, 18, '#f43f5e');
            this.addCallout(pel.x, pel.y - 14, 'BONUS CHERRY! +65', '#f43f5e');
          } else {
            ps.score += 5;
            if (Math.random() < 0.25) this.audio.playChomp();
          }
        }
      }

      // Ghost Collisions
      for (const g of this.ghosts) {
        if (Math.hypot(ps.x - g.x, ps.y - g.y) < 22) {
          if (ps.powerTimer > 0) {
            const pts = this.suddenDeath ? 120 : 75;
            ps.score += pts;
            g.x = width / 2;
            g.y = height / 2 + 8;
            this.hitStopTimer = 0.045;
            this.audio.playScore();
            this.particles.emit(ps.x, ps.y, 20, '#38bdf8');
            this.addCallout(ps.x, ps.y - 18, `CHOMPED ${g.name}! +${pts}`, '#38bdf8');
          } else if (ps.stunTimer <= 0) {
            ps.stunTimer = 0.95;
            ps.score = Math.max(0, ps.score - 25);
            this.audio.playStun();
            this.particles.shake(0.3);
            this.particles.emit(ps.x, ps.y, 14, '#ef4444');
            this.addCallout(ps.x, ps.y - 18, `SPOOKED BY ${g.name}! -25`, '#ef4444');
          }
        }
      }
    }

    // Player-to-Player Power Chomp & Collisions
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
          if (a.powerTimer > 0 && b.powerTimer <= 0 && b.stunTimer <= 0) {
            const steal = Math.min(40, Math.round(b.score * 0.2));
            b.score -= steal;
            a.score += steal + 30;
            b.stunTimer = 0.75;
            this.addCallout(a.x, a.y - 20, `POWER CHOMP STEAL! +${steal + 30}`, a.color);
          } else if (b.powerTimer > 0 && a.powerTimer <= 0 && a.stunTimer <= 0) {
            const steal = Math.min(40, Math.round(a.score * 0.2));
            a.score -= steal;
            b.score += steal + 30;
            a.stunTimer = 0.75;
            this.addCallout(b.x, b.y - 20, `POWER CHOMP STEAL! +${steal + 30}`, b.color);
          }
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
      ps.botReactionTimer = difficulty === 'bot_easy' ? 0.32 : difficulty === 'bot_normal' ? 0.22 : 0.14;

      if (ps.powerTimer > 0 && this.ghosts.length > 0) {
        const g = this.ghosts[0];
        ps.botTargetX = g.x;
        ps.botTargetY = g.y;
      } else {
        let bestPel: Pellet | null = null;
        let minDist = Infinity;
        for (const pel of this.pellets) {
          if (pel.collected) continue;
          const d = Math.hypot(pel.x - ps.x, pel.y - ps.y) - (pel.isEnergizer ? 80 : 0);
          if (d < minDist) {
            minDist = d;
            bestPel = pel;
          }
        }
        if (bestPel) {
          ps.botTargetX = bestPel.x;
          ps.botTargetY = bestPel.y;
        }
      }
    }

    const dx = ps.botTargetX - ps.x;
    const dy = ps.botTargetY - ps.y;
    const dist = Math.hypot(dx, dy) || 1;
    let press = false;
    if (ps.isCharging) {
      press = ps.charge < 0.82;
    } else if (Math.random() < 0.03) {
      press = true;
    }

    this.input.setBotInput(botId, press, dx / dist, -dy / dist);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Neon Maze Walls
    ctx.fillStyle = theme.wallFill;
    ctx.strokeStyle = theme.wallStroke;
    ctx.lineWidth = 2.5;
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.roundRect(w.x, w.y, w.w, w.h, 6);
      ctx.fill();
      ctx.stroke();
    }

    // Pellets, Energizers, & Cherries
    for (const pel of this.pellets) {
      if (pel.collected) continue;
      if (pel.isCherry) {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(pel.x - 3, pel.y + 2, 5, 0, Math.PI * 2);
        ctx.arc(pel.x + 4, pel.y + 3, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = pel.isEnergizer ? '#fbbf24' : '#fef08a';
        ctx.beginPath();
        ctx.arc(pel.x, pel.y, pel.isEnergizer ? 7 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ghosts
    const anyPowered = Array.from(this.playersState.values()).some((p) => p.powerTimer > 0);
    for (const g of this.ghosts) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = anyPowered ? '#2563eb' : g.color;
      ctx.beginPath();
      ctx.arc(0, -4, 12, Math.PI, 0, false);
      ctx.lineTo(12, 10);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 10);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4, -4, 3, 0, Math.PI * 2);
      ctx.arc(4, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Pac Players
    for (const ps of this.playersState.values()) {
      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(ps.angle);
      ctx.fillStyle = ps.powerTimer > 0 ? '#fde047' : ps.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, ps.mouthAngle, Math.PI * 2 - ps.mouthAngle);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
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

    ctx.fillStyle = 'rgba(2, 4, 20, 0.8)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Maze & Warp Tunnels • Hold (72-98%): Waka-Warp Dash & Siren Shunt', width - 14, 22);
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
      mvpHighlight: 'Chomped the Neon Labyrinth and hunted down the Ghost Squad!'
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
