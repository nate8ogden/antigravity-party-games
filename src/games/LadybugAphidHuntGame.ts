import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type LeafTheme = 'emerald_rose_leaf' | 'autumn_maple' | 'neon_botanical';

interface LeafPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  leafColor: string;
}

const THEMES: Record<LeafTheme, LeafPalette> = {
  emerald_rose_leaf: {
    name: 'Tilting Rose Leaf Sumo',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    leafColor: '#16a34a',
  },
  autumn_maple: {
    name: 'Crimson Maple Canopy',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    leafColor: '#ea580c',
  },
  neon_botanical: {
    name: 'Cyber Botanical Leaf',
    bgTop: '#090d16',
    bgBot: '#1e1b4b',
    leafColor: '#10b981',
  },
};

const THEME_KEYS: LeafTheme[] = ['emerald_rose_leaf', 'autumn_maple', 'neon_botanical'];

interface RollingAphid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  royalGolden: boolean;
}

interface LadybugSumo {
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
  flutterTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class LadybugAphidHuntGame extends BaseGame {
  private ladybugs: LadybugSumo[] = [];
  private aphids: RollingAphid[] = [];
  private leafTiltX = 0;
  private leafTiltY = 0;
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
    this.roundTimer = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.leafTiltX = 0;
    this.leafTiltY = 0;
    this.ladybugs = [];
    this.aphids = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.ladybugs.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 90,
        y: height * 0.54 + Math.sin(a) * 70,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        flutterTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 8; i++) {
      this.aphids.push(this.spawnAphid(width, height, i));
    }
  }

  private spawnAphid(width: number, height: number, id: number): RollingAphid {
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 140;
    return {
      id,
      x: width * 0.5 + Math.cos(a) * d,
      y: height * 0.54 + Math.sin(a) * d * 0.72,
      vx: 0,
      vy: 0,
      royalGolden: Math.random() < 0.3,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(l: LadybugSumo, text: string): void {
    l.calloutText = text;
    l.calloutTimer = 1.15;
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
    this.roundTimer = remaining;
    if (remaining <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBuzzer();
      this.ladybugs.forEach((l) => this.showCallout(l, 'TILTING LEAF 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    const cx = width * 0.5;
    const cy = height * 0.54;

    // Calculate Dynamic Leaf Tilt from player weight distribution!
    let tx = 0;
    let ty = 0;
    for (const l of this.ladybugs) {
      tx += (l.x - cx) / 240;
      ty += (l.y - cy) / 180;
    }
    this.leafTiltX += (tx - this.leafTiltX) * Math.min(1, dt * 4);
    this.leafTiltY += (ty - this.leafTiltY) * Math.min(1, dt * 4);

    // Aphids roll with the tilting leaf!
    for (let i = 0; i < this.aphids.length; i++) {
      const ap = this.aphids[i];
      ap.vx += this.leafTiltX * 140 * dt;
      ap.vy += this.leafTiltY * 140 * dt;
      ap.vx *= Math.pow(0.2, dt);
      ap.vy *= Math.pow(0.2, dt);
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      if (Math.hypot((ap.x - cx) / 250, (ap.y - cy) / 185) > 1.0) {
        this.aphids[i] = this.spawnAphid(width, height, ap.id);
      }
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.ladybugs.map((l) => l.score));

    for (const l of this.ladybugs) {
      l.underdog = maxScore - l.score >= 150;
      if (l.calloutTimer > 0) l.calloutTimer = Math.max(0, l.calloutTimer - dt);
      if (l.flutterTimer > 0) l.flutterTimer = Math.max(0, l.flutterTimer - dt);

      const sx = this.input.getSteer(l.id);
      const sy = this.input.getThrottle(l.id);
      const pCfg = this.getPlayer(l.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(l.id);

      const isHold = this.input.isActionPressed(l.id) || (isBot && this.input.isPressed(l.id)) || (!hasSteer && !isBot && this.input.isPressed(l.id));

      const accel = 1400 * (l.underdog ? 1.15 : 1.0);
      l.vx += (sx * accel + this.leafTiltX * 210) * dt;
      l.vy += ((sy !== 0 ? -sy : 0) * accel + this.leafTiltY * 210) * dt;
      l.vx *= Math.pow(0.05, dt);
      l.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Shell-Sumo Ram & Leaf-Edge Knockoff Shunt (72%-98% Sweet Spot)
      if (isHold) {
        l.holding = true;
        l.charge = Math.min(1, l.charge + dt * 0.92);
      } else if (l.holding) {
        const sweet = l.charge >= 0.72 && l.charge <= 0.98;
        if (sweet) {
          l.flutterTimer = 2.0;
          l.score += 85;
          l.combo = Math.min(4, l.combo + 1);
          this.showCallout(l, 'SHELL SUMO SLAM +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 12);

          for (const other of this.ladybugs) {
            if (other.id !== l.id && Math.hypot(other.x - l.x, other.y - l.y) < 175) {
              const dx = other.x - l.x;
              const dy = other.y - l.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 620;
              other.vy += (dy / d) * 620;
              l.score += 70;
              this.showCallout(l, 'LEAF SUMO SHUNT +70!');
              this.audio.playBounce();
            }
          }
        }
        l.holding = false;
        l.charge = 0;
      }

      l.x += l.vx * dt;
      l.y += l.vy * dt;

      // Falling off tilting rose leaf!
      if (Math.hypot((l.x - cx) / 250, (l.y - cy) / 185) > 1.02) {
        l.x = cx;
        l.y = cy;
        l.vx = 0;
        l.vy = 0;
        l.combo = 1;
        this.showCallout(l, 'LEAF FLUTTER RECOVERY!');
        this.audio.playBounce();
      }

      for (let i = 0; i < this.aphids.length; i++) {
        const ap = this.aphids[i];
        if (Math.hypot(l.x - ap.x, l.y - ap.y) < 32) {
          const base = ap.royalGolden ? 95 : 50;
          const pts = base * l.combo * (this.suddenDeath ? 2 : 1);
          l.score += pts;
          l.combo = Math.min(4, l.combo + 1);
          this.showCallout(l, ap.royalGolden ? `ROYAL APHID +${pts}!` : `APHID +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(ap.x, ap.y, '#4ade80', 10);
          this.aphids[i] = this.spawnAphid(width, height, ap.id);
        }
      }
    }

    // Ladybug Sumo Bumping
    for (let i = 0; i < this.ladybugs.length; i++) {
      for (let j = i + 1; j < this.ladybugs.length; j++) {
        const a = this.ladybugs[i];
        const b = this.ladybugs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 38) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 340;
          a.vy -= ny * 340;
          b.vx += nx * 340;
          b.vy += ny * 340;
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
    const bot = this.ladybugs.find((l) => l.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.16 : 0.24;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.aphids.find((a) => a.royalGolden) ?? this.aphids[0];
    let dx = 0;
    let dy = 0;
    if (best) {
      dx = best.x - bot.x;
      dy = best.y - bot.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / d) * 1100 * dt;
      bot.vy += (dy / d) * 1100 * dt;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotInput(botId, hold, Math.sign(dx), Math.sign(-dy), hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // 1. Garden Canopy Backdrop Gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const leafX = width * 0.5 + this.leafTiltX * 18;
    const leafY = height * 0.54 + this.leafTiltY * 18;

    // 2. 3D Tilting Giant Rose Leaf Arena
    ctx.save();
    ctx.translate(leafX, leafY);

    // Leaf Underside 3D Depth Shadow
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.ellipse(0, 14, 256, 190, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leaf Main Blade Surface
    ctx.fillStyle = pal.leafColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 252, 186, 0, 0, Math.PI * 2);
    ctx.fill();

    // Serrated Leaf Tip and Stem
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.moveTo(-252, 0);
    ctx.lineTo(-270, 8);
    ctx.lineTo(-246, 16);
    ctx.closePath();
    ctx.fill();

    // Botanical Leaf Vein Networks
    ctx.strokeStyle = '#86EFAC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Central Primary Rib (Midrib)
    ctx.moveTo(-240, 0);
    ctx.lineTo(240, 0);
    ctx.stroke();

    // Lateral Branching Veins
    ctx.lineWidth = 1.6;
    for (let vx = -200; vx <= 200; vx += 35) {
      const vLen = Math.sqrt(Math.max(0, 1 - Math.pow(vx / 240, 2))) * 160;
      ctx.beginPath();
      // Upper branch
      ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + 20, -vLen * 0.5, vx + 40, -vLen * 0.85);
      // Lower branch
      ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + 20, vLen * 0.5, vx + 40, vLen * 0.85);
      ctx.stroke();
    }

    // Leaf Perimeter Border
    ctx.strokeStyle = '#BBF7D0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 252, 186, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Glistening Morning Dew Droplets on Leaf
    const dewList = [
      { dx: -120, dy: -60, r: 5 },
      { dx: 140, dy: 50, r: 6 },
      { dx: -40, dy: 80, r: 4 },
      { dx: 80, dy: -90, r: 5.5 }
    ];
    for (const dew of dewList) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(dew.dx + this.leafTiltX * 8, dew.dy + this.leafTiltY * 8, dew.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(dew.dx + this.leafTiltX * 8 - 1.5, dew.dy + this.leafTiltY * 8 - 1.5, dew.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Cute Rolling Aphids with Wiggling Antennae & Legs
    for (const ap of this.aphids) {
      ctx.save();
      ctx.translate(ap.x, ap.y);
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 6, ap.royalGolden ? 13 : 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Plump Aphid Body
      ctx.fillStyle = ap.royalGolden ? '#FBBF24' : '#4ADE80';
      ctx.shadowColor = ap.royalGolden ? '#F59E0B' : '#22C55E';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, ap.royalGolden ? 14 : 10, ap.royalGolden ? 11 : 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Tiny Twitching Antennae
      const antWiggle = Math.sin(this.timeElapsed * 15 + ap.id) * 3;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(-7 + antWiggle, -12);
      ctx.moveTo(4, -6);
      ctx.lineTo(7 - antWiggle, -12);
      ctx.stroke();

      // Cute Startled Black Bead Eyes
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-3, -3, 1.8, 0, Math.PI * 2);
      ctx.arc(3, -3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-3.5, -3.5, 0.7, 0, Math.PI * 2);
      ctx.arc(2.5, -3.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Armored Ladybug Sumo Mascots
    for (const l of this.ladybugs) {
      ctx.save();
      ctx.translate(l.x, l.y);

      // Ladybug Wing Shell (Elytra)
      const isRamming = l.flutterTimer > 0;
      ctx.save();
      ctx.fillStyle = l.color;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Black Wing Shell Spots
      ctx.fillStyle = '#0F172A';
      const spots = [
        { sx: -10, sy: -8, r: 3.5 },
        { sx: 10, sy: -8, r: 3.5 },
        { sx: -12, sy: 6, r: 4 },
        { sx: 12, sy: 6, r: 4 },
        { sx: 0, sy: 12, r: 3.5 }
      ];
      for (const sp of spots) {
        ctx.beginPath();
        ctx.arc(sp.sx, sp.sy, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Elytra Center Split Line
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(0, 22);
      ctx.stroke();

      // Fluttering Hindwings when boosting
      if (isRamming) {
        const wingFlap = Math.sin(this.timeElapsed * 40) * 8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(-18, -4 + wingFlap, 16, 7, -0.4, 0, Math.PI * 2);
        ctx.ellipse(18, -4 - wingFlap, 16, 7, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Mascot Character Rider on Back
      const mood = l.flutterTimer > 0 ? 'triumph' : l.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, l.id, 0, -2, 14, mood, this.timeElapsed, l.vx * 0.0005);

      // Charge Reticle Indicator
      if (l.holding && l.charge > 0.05) {
        const sweet = l.charge >= 0.72 && l.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ADE80' : '#FBBF24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + l.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (l.calloutTimer > 0 && l.calloutText) {
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 12.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.calloutText, 0, -32);
      }
      ctx.restore();
    }

    // 5. HUD Top Bar
    const remaining = Math.max(0, Math.ceil(this.roundTime - this.timeElapsed));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, width, 48);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 14px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🐞 LADYBUG APHID HUNT • ${pal.name} • ${remaining}s ${this.suddenDeath ? '🔥 2X LEAF SUMO' : ''}`,
      width * 0.5,
      20
    );

    this.ladybugs.forEach((l, idx) => {
      ctx.fillStyle = l.color;
      ctx.font = '900 12.5px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${l.id + 1}: ${Math.round(l.score)} pts (${l.combo}x)`, 70 + idx * 165, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.ladybugs].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((l, i) => ({
        playerId: l.id,
        score: Math.round(l.score),
        place: i + 1,
      })),
      mvpHighlight: `Tilting Leaf Sumo Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    if (y <= 48) {
      this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
      this.audio.playTap();
      return true;
    }
    const midX = width / 2;
    const midY = height / 2;
    const pid: PlayerId = x < midX ? (y < midY ? 0 : 2) : (y < midY ? 1 : 3);
    const l = this.ladybugs.find((lb) => lb.id === pid);
    if (!l) return false;

    // Steer toward tap location on mobile and execute sumo boost
    const dx = x - l.x;
    const dy = y - l.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      l.vx += (dx / dist) * 750;
      l.vy += (dy / dist) * 750;
      l.flutterTimer = 1.0;
      this.audio.playBoost();
    }
    return true;
  }
}
