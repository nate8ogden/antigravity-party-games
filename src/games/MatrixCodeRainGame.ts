import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CodeRainColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
}

interface MatrixItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'CIPHER_KEY' | 'QUANTUM_ORB' | 'RED_SENTINEL';
  points: number;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface HackerPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  buffer: number; // 0 to 100% Vault Decryption
  combo: number;
  stunTimer: number;
  bulletTimeTimer: number;
  charge: number;
  isCharging: boolean;
  underdog: boolean;
  botReactionTimer: number;
  botTargetX: number;
}

interface ThemePalette {
  id: string;
  name: string;
  bg: string;
  rainColor: string;
  rainHead: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'zion_emerald',
    name: 'Zion Emerald Mainframe',
    bg: '#020b05',
    rainColor: 'rgba(34, 197, 94, 0.36)',
    rainHead: '#86efac'
  },
  {
    id: 'amber_mainframe',
    name: '1983 Amber Gibson Terminal',
    bg: '#140902',
    rainColor: 'rgba(245, 158, 11, 0.36)',
    rainHead: '#fde047'
  },
  {
    id: 'arasaka_crimson',
    name: 'Netrunner Cyber Vault',
    bg: '#120209',
    rainColor: 'rgba(236, 72, 153, 0.36)',
    rainHead: '#f9a8d4'
  }
];

export class MatrixCodeRainGame extends BaseGame {
  private playersState: Map<PlayerId, HackerPlayer> = new Map();
  private columns: CodeRainColumn[] = [];
  private items: MatrixItem[] = [];
  private callouts: FloatingCallout[] = [];
  private nextItemId = 1;
  private spawnTimer = 0;
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
    this.columns = [];
    this.items = [];
    this.callouts = [];
    this.nextItemId = 1;
    this.spawnTimer = 0;
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const sx = spacing * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: sx,
        y: height - 52,
        vx: 0,
        vy: 0,
        score: 0,
        buffer: 0,
        combo: 1,
        stunTimer: 0,
        bulletTimeTimer: 0,
        charge: 0,
        isCharging: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetX: sx
      });
    });

    const colCount = Math.floor(width / 24);
    const glyphs = ['0', '1', 'Z', 'A', '8', 'K', 'X', '7', '9', 'E', 'M'];
    for (let c = 0; c < colCount; c++) {
      const charList: string[] = [];
      for (let i = 0; i < 12; i++) {
        charList.push(glyphs[Math.floor(Math.random() * glyphs.length)]);
      }
      this.columns.push({
        x: c * 24 + 12,
        y: Math.random() * height,
        speed: 95 + Math.random() * 120,
        chars: charList
      });
    }

    for (let i = 0; i < 6; i++) {
      this.spawnItem(width);
    }
  }

  private spawnItem(width: number): void {
    const roll = Math.random();
    let type: MatrixItem['type'] = 'CIPHER_KEY';
    let points = 25;
    let vy = 115 + Math.random() * 55;

    if (roll < 0.22) {
      type = 'QUANTUM_ORB';
      points = 60;
      vy = 135;
    } else if (roll > 0.68) {
      type = 'RED_SENTINEL';
      points = -30;
      vy = 155 + Math.random() * 55;
    }

    this.items.push({
      id: this.nextItemId++,
      x: 34 + Math.random() * (width - 68),
      y: -18,
      vx: (Math.random() - 0.5) * 30,
      vy,
      type,
      points
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
      this.addCallout(width / 2, height * 0.25, 'FIREWALL BREACH! 2X VAULT JACKPOTS!', '#fde047');
    }

    this.updateBots(dt, width, height);

    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 100;
    }

    for (const col of this.columns) {
      col.y += col.speed * dt;
      if (col.y > height + 180) {
        col.y = -60;
      }
    }

    this.spawnTimer += dt;
    if (this.spawnTimer >= (this.suddenDeath ? 0.38 : 0.52)) {
      this.spawnTimer = 0;
      this.spawnItem(width);
    }

    const anyBulletTime = Array.from(this.playersState.values()).some((p) => p.bulletTimeTimer > 0);
    const rainSpeedScale = anyBulletTime ? 0.65 : 1.0;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.x += it.vx * dt;
      it.y += it.vy * rainSpeedScale * dt;

      if (it.x < 28 || it.x > width - 28) it.vx *= -1;
      if (it.y > height + 24) {
        this.items.splice(i, 1);
        continue;
      }

      for (const ps of this.playersState.values()) {
        if (ps.stunTimer > 0) continue;

        // Magnetic pull during Bullet-Time Surge
        const dist = Math.hypot(ps.x - it.x, ps.y - it.y);
        if (ps.bulletTimeTimer > 0 && it.type !== 'RED_SENTINEL' && dist < 110) {
          it.x += ((ps.x - it.x) / (dist || 1)) * 240 * dt;
          it.y += ((ps.y - it.y) / (dist || 1)) * 240 * dt;
        }

        if (dist < 24) {
          if (it.type === 'RED_SENTINEL') {
            ps.stunTimer = 0.9;
            ps.combo = 1;
            ps.buffer = Math.max(0, ps.buffer - 30);
            ps.score = Math.max(0, ps.score - 25);
            this.audio.playBuzzer();
            this.particles.shake(0.32);
            this.particles.emit(it.x, it.y, 16, '#ef4444');
            this.addCallout(ps.x, ps.y - 20, 'SENTINEL GLITCH! -25', '#ef4444');
          } else {
            const mult = this.suddenDeath ? 2 : 1;
            const pts = it.points * mult;
            ps.score += pts;
            ps.combo = Math.min(4, ps.combo + 1);
            ps.buffer += it.type === 'QUANTUM_ORB' ? 50 : 25;
            this.audio.playChime();
            this.particles.emit(it.x, it.y, 14, it.type === 'QUANTUM_ORB' ? '#38bdf8' : '#fbbf24');
            this.addCallout(it.x, it.y - 14, `+${pts}`, '#fbbf24');

            // 100% Vault Decryption Jackpot!
            if (ps.buffer >= 100) {
              ps.buffer = 0;
              const jackpot = this.suddenDeath ? 130 : 85;
              ps.score += jackpot;
              this.hitStopTimer = 0.045;
              this.audio.playScore();
              this.particles.shake(0.28);
              this.particles.emit(ps.x, ps.y, 24, '#22c55e');
              this.addCallout(ps.x, ps.y - 28, `VAULT DECRYPTED! +${jackpot}`, '#22c55e');
            }
          }
          this.items.splice(i, 1);
          break;
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) ps.stunTimer -= dt;
      if (ps.bulletTimeTimer > 0) ps.bulletTimeTimer -= dt;

      const steer = ps.stunTimer > 0 ? 0 : this.input.getSteer(p.id);
      const isPressed = ps.stunTimer <= 0 && this.input.isPressed(p.id);

      // Hold-to-charge Neo Bullet-Time Surge & Glitch-Spike Shunt (72% - 98%)
      if (isPressed) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.9);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          ps.bulletTimeTimer = 3.2;
          ps.score += 55;
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.28);
          this.particles.emit(ps.x, ps.y, 22, '#22c55e');
          this.addCallout(ps.x, ps.y - 26, 'NEO BULLET-TIME SURGE! +55', '#22c55e');

          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            if (Math.abs(rival.x - ps.x) < 105) {
              rival.vx += (rival.x >= ps.x ? 1 : -1) * 350;
              rival.stunTimer = 0.6;
              ps.score += 50;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 18, 'GLITCH-SPIKE SHUNT! +50', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.45;
          this.audio.playBuzzer();
        }
        ps.charge = 0;
      }

      const speedMult = ps.underdog ? 1.18 : 1.0;
      ps.vx += steer * 1080 * speedMult * dt;
      ps.vx *= Math.pow(0.012, dt);
      ps.x += ps.vx * dt;
      ps.x = Math.max(30, Math.min(width - 30, ps.x));
    }

    // Terminal-to-Terminal Elastic Collisions
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) < 38) {
          const sign = dx >= 0 ? 1 : -1;
          a.vx -= sign * 220;
          b.vx += sign * 220;
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
      let best: MatrixItem | null = null;
      let minDist = Infinity;
      for (const it of this.items) {
        if (it.type === 'RED_SENTINEL') continue;
        const d = Math.abs(it.x - ps.x) + (ps.y - it.y) * 0.45;
        if (d < minDist) {
          minDist = d;
          best = it;
        }
      }
      if (best) {
        const jitter = difficulty === 'bot_easy' ? 32 : difficulty === 'bot_normal' ? 14 : 4;
        ps.botTargetX = best.x + (Math.random() - 0.5) * jitter;
      }
    }

    let steer = Math.abs(ps.botTargetX - ps.x) > 10 ? Math.sign(ps.botTargetX - ps.x) : 0;
    for (const it of this.items) {
      if (it.type === 'RED_SENTINEL' && Math.abs(it.x - ps.x) < 32 && ps.y - it.y < 90 && ps.y > it.y) {
        steer = ps.x < it.x ? -1 : 1;
        break;
      }
    }

    let press = false;
    if (ps.isCharging) {
      press = ps.charge < 0.82;
    } else if (Math.random() < 0.03) {
      press = true;
    }

    this.input.setBotInput(botId, press, steer, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Cascading Digital Rain
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    for (const col of this.columns) {
      for (let i = 0; i < col.chars.length; i++) {
        const cy = col.y - i * 14;
        if (cy < 36 || cy > height) continue;
        ctx.fillStyle = i === 0 ? theme.rainHead : theme.rainColor;
        ctx.fillText(col.chars[i], col.x, cy);
      }
    }

    // Falling Cipher Keys, Quantum Orbs, & Red Sentinels
    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.type === 'CIPHER_KEY') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('KEY', 0, 3.5);
      } else if (it.type === 'QUANTUM_ORB') {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('ERR', 0, 3.5);
      }
      ctx.restore();
    }

    // Hacker Cyber Decks
    for (const ps of this.playersState.values()) {
      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = ps.stunTimer > 0 ? '#64748b' : '#0f172a';
      ctx.strokeStyle = ps.bulletTimeTimer > 0 ? '#22c55e' : ps.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-20, -10, 40, 20, 5);
      ctx.fill();
      ctx.stroke();

      // Decryption Buffer Bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-16, -4, 32, 6);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-16, -4, (32 * Math.min(100, ps.buffer)) / 100, 6);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name}: ${ps.score}`, 0, 24);
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

    ctx.fillStyle = 'rgba(2, 11, 5, 0.82)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Catch Cipher Keys • Hold (72-98%): Bullet-Time Surge & Shunt', width - 14, 22);
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
      mvpHighlight: 'Cracked the Zion Mainframe with Neo Bullet-Time Vault Jackpots!'
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
