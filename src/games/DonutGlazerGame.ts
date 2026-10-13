import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface DonutType {
  name: string;
  doughColor: string;
  glazeColor: string;
  points: number;
  isGolden?: boolean;
  isHazard?: boolean;
  radius: number;
}

const DONUT_TYPES: DonutType[] = [
  { name: 'Classic Ring', doughColor: '#FFCC80', glazeColor: '#F48FB1', points: 15, radius: 14 },
  { name: 'Chocolate Cruller', doughColor: '#8D6E63', glazeColor: '#5D4037', points: 18, radius: 15 },
  { name: 'Blueberry Glaze', doughColor: '#FFE082', glazeColor: '#64B5F6', points: 20, radius: 14 },
  { name: 'Matcha Twist', doughColor: '#C8E6C9', glazeColor: '#81C784', points: 22, radius: 14 },
  { name: 'Golden Brioche', doughColor: '#FFF59D', glazeColor: '#FFD700', points: 40, isGolden: true, radius: 16 },
  { name: 'Burnt Charcoal', doughColor: '#37474F', glazeColor: '#212121', points: -15, isHazard: true, radius: 13 }
];

interface RollingDonut {
  id: number;
  x: number;
  y: number;
  vx: number;
  type: DonutType;
  glazed: boolean;
  glazedBy: PlayerId | null;
  glazeQuality: number; // 0 to 1
  rot: number;
}

interface GlazePuddle {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface GlazerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  pressure: number; // 0 to 100%
  isFiring: boolean;
  shuntCooldown: number;
  shuntActiveTimer: number;
  shuntDir: number;
  stunTimer: number;
  slipTimer: number;
  score: number;
  donutsGlazed: number;
  combo: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface DonutTheme {
  id: string;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  conveyorColor: string;
  conveyorTrim: string;
  deckColor: string;
  accentColor: string;
}

const THEMES: DonutTheme[] = [
  {
    id: 'artisan_pastry',
    name: 'Artisanal Boutique 🍩',
    icon: '🍩',
    bgTop: '#FFF8E7',
    bgBottom: '#FFE0B2',
    conveyorColor: '#ECEFF1',
    conveyorTrim: '#B0BEC5',
    deckColor: '#D7CCC8',
    accentColor: '#F48FB1'
  },
  {
    id: 'cyber_bakery',
    name: 'Cyberpunk Bakery ⚡',
    icon: '⚡',
    bgTop: '#0D0914',
    bgBottom: '#030206',
    conveyorColor: '#1F1A2C',
    conveyorTrim: '#E040FB',
    deckColor: '#120D1A',
    accentColor: '#00E5FF'
  },
  {
    id: 'boardwalk_fair',
    name: 'Boardwalk Fair 🎪',
    icon: '🎪',
    bgTop: '#FFF3E0',
    bgBottom: '#FFCCBC',
    conveyorColor: '#8D6E63',
    conveyorTrim: '#FFD54F',
    deckColor: '#5D4037',
    accentColor: '#FF6F00'
  }
];

export class DonutGlazerGame extends BaseGame {
  public currentMapName: string = 'Artisanal Boutique 🍩';
  private currentThemeIdx: number = 0;

  private glazerPlayers: Map<PlayerId, GlazerPlayer> = new Map();
  private rollingDonuts: RollingDonut[] = [];
  private glazePuddles: GlazePuddle[] = [];
  private nextDonutId: number = 1;
  private donutSpawnTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetDonut: Map<PlayerId, number | null> = new Map();

  private screenShake: number = 0;
  private hitStopTimer: number = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.code === 'KeyT') {
          this.cycleTheme();
        } else if (e.code === 'Digit1') {
          this.setTheme(0);
        } else if (e.code === 'Digit2') {
          this.setTheme(1);
        } else if (e.code === 'Digit3') {
          this.setTheme(2);
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        const pillX = 20;
        const pillY = canvas.height - 44;
        const pillW = 170;
        const pillH = 32;

        if (
          clickX >= pillX &&
          clickX <= pillX + pillW &&
          clickY >= pillY &&
          clickY <= pillY + pillH
        ) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.rollingDonuts = [];
    this.glazePuddles = [];
    this.glazerPlayers.clear();
    this.botReactionTimers.clear();
    this.botTargetDonut.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.glazerPlayers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 120,
        vx: 0,
        pressure: 0,
        isFiring: false,
        shuntCooldown: 0,
        shuntActiveTimer: 0,
        shuntDir: 0,
        stunTimer: 0,
        slipTimer: 0,
        score: 0,
        donutsGlazed: 0,
        combo: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
      this.botTargetDonut.set(p.id, null);
    });

    this.currentThemeIdx = 0;
    this.currentMapName = THEMES[0].name;
  }

  public cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIdx = index;
      this.currentMapName = THEMES[this.currentThemeIdx].name;
      this.audio.playTap();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Identify leader score for Underdog surge
    let maxScore = 0;
    for (const gp of this.glazerPlayers.values()) {
      if (gp.score > maxScore) maxScore = gp.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning rolling donuts across conveyor
    this.donutSpawnTimer -= dt;
    const spawnRate = this.roundTimer < 15 ? 0.5 : 0.85;
    if (this.donutSpawnTimer <= 0) {
      this.donutSpawnTimer = spawnRate + Math.random() * 0.35;
      this.spawnRollingDonut(width);
    }

    // Update rolling donuts along conveyor (y: height - 190)
    for (let i = this.rollingDonuts.length - 1; i >= 0; i--) {
      const d = this.rollingDonuts[i];
      d.x += d.vx * dt;
      d.rot += (d.vx / 20) * dt;

      // Off-screen check
      if (d.x < -40 || d.x > width + 40) {
        this.rollingDonuts.splice(i, 1);
      }
    }

    // Update glaze puddles
    for (let i = this.glazePuddles.length - 1; i >= 0; i--) {
      const p = this.glazePuddles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.glazePuddles.splice(i, 1);
      }
    }

    // Update player bakers
    for (const p of this.getActivePlayers()) {
      const gp = this.glazerPlayers.get(p.id);
      if (!gp) continue;

      gp.animTimer += dt;
      if (gp.moodTimer > 0) {
        gp.moodTimer -= dt;
        if (gp.moodTimer <= 0) gp.mood = 'idle';
      }

      // Check Underdog
      gp.isUnderdog = maxScore >= 35 && gp.score <= maxScore - 30;

      // Handle Stun & Slip
      if (gp.stunTimer > 0) {
        gp.stunTimer -= dt;
        gp.vx *= 0.85;
        gp.x += gp.vx * dt;
        gp.x = Math.max(45, Math.min(width - 45, gp.x));
        continue;
      }
      if (gp.slipTimer > 0) {
        gp.slipTimer -= dt;
        gp.vx *= 0.96; // slippery ice drift
        gp.x += gp.vx * dt;
        gp.x = Math.max(45, Math.min(width - 45, gp.x));
        continue;
      }

      // Handle Shunt Cooldown & Active Timer
      if (gp.shuntCooldown > 0) gp.shuntCooldown -= dt;
      if (gp.shuntActiveTimer > 0) {
        gp.shuntActiveTimer -= dt;
        gp.vx = gp.shuntDir * 580;
        this.particles.emit(gp.x - gp.shuntDir * 16, gp.y - 15, 2, '#F48FB1');
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const baseSpeed = gp.isUnderdog ? 330 : 270;

      // Hold-to-Charge Pressure & Injector Jet
      if (isAction && gp.shuntActiveTimer <= 0) {
        gp.isFiring = true;
        gp.pressure = Math.min(100, gp.pressure + 75 * dt);

        // While firing, movement is slowed for precision aiming
        const aimSpeed = baseSpeed * 0.5;
        if (Math.abs(steer) > 0.15) {
          gp.vx = steer * aimSpeed;
        } else {
          gp.vx *= 0.8;
        }

        // Emit glaze stream particles upward towards conveyor
        const nozzleX = gp.x + (gp.vx > 10 ? 12 : gp.vx < -10 ? -12 : 6);
        const nozzleY = gp.y - 35;
        this.particles.emit(nozzleX, nozzleY - 10, 2, gp.isUnderdog ? '#FFD700' : '#F48FB1');

        // Check if hitting an unglazed rolling donut overhead
        this.checkGlazeStreamHit(gp, nozzleX, nozzleY);

        // Overpressure blowout risk!
        if (gp.pressure >= 100) {
          this.triggerGlazeBlowout(gp);
        }
      } else {
        if (gp.isFiring) {
          // Release: if high pressure (> 75%), check if can execute jet shunt!
          if (gp.pressure >= 65 && Math.abs(steer) > 0.35 && gp.shuntCooldown <= 0) {
            gp.shuntActiveTimer = 0.22;
            gp.shuntDir = Math.sign(steer);
            gp.shuntCooldown = 0.8;
            this.audio.playWhoosh();
            this.particles.emit(gp.x, gp.y - 20, 10, '#E040FB');
          }
          gp.isFiring = false;
        }
        // Pressure slowly dissipates
        gp.pressure = Math.max(0, gp.pressure - 120 * dt);

        if (gp.shuntActiveTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            gp.vx = steer * baseSpeed;
          } else {
            gp.vx *= 0.82;
          }
        }
      }

      gp.x += gp.vx * dt;
      // Screen bounds
      if (gp.x < 50) {
        gp.x = 50;
        gp.vx = 0;
      }
      if (gp.x > width - 50) {
        gp.x = width - 50;
        gp.vx = 0;
      }

      // Check collision with slippery glaze puddles on deck
      if (!gp.isUnderdog) {
        for (const puddle of this.glazePuddles) {
          if (Math.abs(gp.x - puddle.x) < puddle.radius) {
            gp.slipTimer = 0.6;
            gp.mood = 'shocked';
            gp.moodTimer = 0.8;
            this.audio.playBounce();
            break;
          }
        }
      }
    }

    // Inter-Player Body & Shunt Collisions
    const bakersArr = this.getActivePlayers().map(p => this.glazerPlayers.get(p.id)!);
    for (let i = 0; i < bakersArr.length; i++) {
      for (let j = i + 1; j < bakersArr.length; j++) {
        const b1 = bakersArr[i];
        const b2 = bakersArr[j];
        const dist = Math.abs(b1.x - b2.x);
        const touchDist = 48;

        if (dist < touchDist) {
          const overlap = touchDist - dist;
          const dir = b1.x < b2.x ? -1 : 1;
          b1.x += dir * overlap * 0.5;
          b2.x -= dir * overlap * 0.5;

          // Check if one was shunting
          if (b1.shuntActiveTimer > 0 && b2.shuntActiveTimer <= 0) {
            this.executeGlazeShunt(b1, b2, -dir);
          } else if (b2.shuntActiveTimer > 0 && b1.shuntActiveTimer <= 0) {
            this.executeGlazeShunt(b2, b1, dir);
          } else {
            // Normal bump
            const avgVx = (b1.vx + b2.vx) * 0.5;
            b1.vx = avgVx + dir * 110;
            b2.vx = avgVx - dir * 110;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnRollingDonut(width: number): void {
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -20 : width + 20;
    const speed = (90 + Math.random() * 60) * (this.roundTimer < 15 ? 1.3 : 1.0);
    const vx = fromLeft ? speed : -speed;

    const isSuddenDeath = this.roundTimer < 15;
    let pool = DONUT_TYPES;
    if (isSuddenDeath) {
      pool = [
        ...DONUT_TYPES,
        DONUT_TYPES[4], // Golden Brioche
        DONUT_TYPES[4]
      ];
    }
    const template = pool[Math.floor(Math.random() * pool.length)];

    this.rollingDonuts.push({
      id: this.nextDonutId++,
      x: startX,
      y: 190,
      vx,
      type: template,
      glazed: false,
      glazedBy: null,
      glazeQuality: 0,
      rot: 0
    });
  }

  private checkGlazeStreamHit(gp: GlazerPlayer, nozzleX: number, _nozzleY: number): void {
    const sprayTargetY = 190;
    const hitTolerance = gp.isUnderdog ? 38 : 24;

    for (const d of this.rollingDonuts) {
      if (d.glazed) continue;

      const dist = Math.abs(d.x - nozzleX);
      if (dist < hitTolerance) {
        // Hit!
        d.glazed = true;
        d.glazedBy = gp.id;

        if (d.type.isHazard) {
          // Charcoal donut!
          gp.score = Math.max(0, gp.score + d.type.points);
          gp.stunTimer = 0.75;
          gp.combo = 0;
          gp.mood = 'shocked';
          gp.moodTimer = 1.0;
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(d.x, sprayTargetY, 12, d.type.doughColor);
          return;
        }

        // Glaze score calculation
        const inSweetSpot = gp.pressure >= 75 && gp.pressure <= 98;
        const multiplier = inSweetSpot ? 2.0 : 1.0;
        const pts = Math.round((d.type.points + gp.combo * 4) * multiplier);

        gp.score += pts;
        gp.donutsGlazed++;
        gp.combo++;
        d.glazeQuality = inSweetSpot ? 1.0 : 0.7;

        gp.mood = 'happy';
        gp.moodTimer = 0.7;

        if (inSweetSpot || d.type.isGolden) {
          gp.mood = 'triumph';
          gp.moodTimer = 1.3;
          this.audio.playFanfare();
          this.particles.emit(d.x, sprayTargetY, 20, d.type.glazeColor);
          this.particles.emit(d.x, sprayTargetY, 15, '#FFD700');
          this.screenShake = 7;
          this.hitStopTimer = 0.04;
        } else {
          this.audio.playScore();
          this.particles.emit(d.x, sprayTargetY, 8, d.type.glazeColor);
        }
        break;
      }
    }
  }

  private triggerGlazeBlowout(gp: GlazerPlayer): void {
    gp.pressure = 0;
    gp.isFiring = false;
    gp.combo = 0;
    gp.score = Math.max(0, gp.score - 10);
    gp.stunTimer = 0.8;
    gp.mood = 'shocked';
    gp.moodTimer = 1.0;

    // Drop a slippery glaze puddle on deck
    this.glazePuddles.push({
      x: gp.x,
      y: gp.y + 10,
      radius: 35,
      color: '#F48FB1',
      life: 4.5,
      maxLife: 4.5
    });

    this.audio.playExplosion();
    this.particles.emit(gp.x, gp.y - 20, 16, '#F48FB1');
    this.screenShake = 7;
  }

  private executeGlazeShunt(attacker: GlazerPlayer, victim: GlazerPlayer, dir: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = dir * 420;
    victim.stunTimer = 0.75;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Spurt glaze puddle where victim lands
    this.glazePuddles.push({
      x: victim.x,
      y: victim.y + 10,
      radius: 30,
      color: '#E040FB',
      life: 4.0,
      maxLife: 4.0
    });

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, attacker.y - 25, 18, '#FF5252');
    this.screenShake = 9;
    this.hitStopTimer = 0.045;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const gp = this.glazerPlayers.get(botId);
    if (!gp || gp.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // 1. Check nearby rival for aggressive nozzle shunt (Hard bot)
    if (difficulty === 'bot_hard' && gp.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.glazerPlayers.get(p.id);
        if (rival && Math.abs(rival.x - gp.x) < 75) {
          const shuntDir = rival.x > gp.x ? 1 : -1;
          this.input.setBotInput(botId, true, shuntDir, 0, false);
          this.botReactionTimers.set(botId, 0.28);
          return;
        }
      }
    }

    // 2. Locate best upcoming unglazed donut
    let bestDonut: RollingDonut | null = null;
    let bestScore = -9999;

    for (const d of this.rollingDonuts) {
      if (d.glazed) continue;
      if (d.type.isHazard) continue; // avoid charcoal

      let weight = d.type.points;
      if (d.type.isGolden) weight += 30;

      const dist = Math.abs(d.x - gp.x);
      const score = weight - dist * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestDonut = d;
      }
    }

    let steer = 0;
    let fire = false;

    if (bestDonut) {
      const dist = bestDonut.x - gp.x;
      if (Math.abs(dist) > 16) {
        steer = dist > 0 ? 1 : -1;
      } else {
        // Aligned under donut! Fire glaze!
        fire = true;
      }
    }

    if (blunder) {
      steer = -steer;
      fire = Math.random() < 0.2;
    }

    this.input.setBotInput(botId, fire, steer, 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const gp = this.glazerPlayers.get(p.id);
      return {
        playerId: p.id,
        score: gp?.score || 0,
        glazed: gp?.donutsGlazed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPlayer = scores[0];
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} frosted ${topPlayer.glazed} bakery-fresh gourmet glazed donuts!`
      : 'The bakery conveyor was covered in spilled frosting!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Theme Elements
    this.renderThemeBackdrop(ctx, width, height, theme);

    // Overhead Donut Conveyor Belt System (y: 190)
    this.renderConveyorBelt(ctx, width, theme);

    // Bakery Floor Deck
    const deckY = height - 90;
    ctx.fillStyle = theme.deckColor;
    ctx.fillRect(0, deckY, width, 90);

    // Render Glaze Puddles on Deck
    for (const puddle of this.glazePuddles) {
      ctx.save();
      const alpha = Math.max(0, puddle.life / puddle.maxLife);
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = puddle.color;
      ctx.beginPath();
      ctx.ellipse(puddle.x, puddle.y, puddle.radius, puddle.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Rolling Donuts along Conveyor
    for (const d of this.rollingDonuts) {
      this.renderRollingDonut(ctx, d);
    }

    // Render Baker Players
    for (const p of this.getActivePlayers()) {
      const gp = this.glazerPlayers.get(p.id);
      if (!gp) continue;
      this.renderBakerPlayer(ctx, p, gp, theme);
    }

    // Render Particles
    this.particles.render(ctx);

    ctx.restore();

    // UI Header & Theme Pill
    this.renderUI(ctx, width, height);
  }

  private renderThemeBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: DonutTheme
  ): void {
    ctx.save();
    if (theme.id === 'artisan_pastry') {
      // Pastel Pink Bakery Shelves & Jars
      ctx.fillStyle = 'rgba(244, 143, 177, 0.12)';
      for (let x = 30; x < width; x += 100) {
        ctx.fillRect(x, 70, 20, 90);
      }
    } else if (theme.id === 'cyber_bakery') {
      // Neon Rails & Circuit Lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
      }
    } else {
      // Carnival Awnings & Marquee Lights
      ctx.fillStyle = 'rgba(255, 111, 0, 0.12)';
      for (let x = 0; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 30, 60);
        ctx.lineTo(x + 60, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderConveyorBelt(
    ctx: CanvasRenderingContext2D,
    width: number,
    theme: DonutTheme
  ): void {
    ctx.save();
    const beltY = 190;

    // Conveyor Rail Beam
    ctx.fillStyle = theme.conveyorColor;
    ctx.fillRect(0, beltY - 6, width, 18);

    // Rollers / Trim
    ctx.fillStyle = theme.conveyorTrim;
    ctx.fillRect(0, beltY + 12, width, 4);

    // Animated belt rollers
    const rollerSpacing = 35;
    const rollerOffset = (this.roundTimer * 60) % rollerSpacing;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = -rollerSpacing; x < width + rollerSpacing; x += rollerSpacing) {
      ctx.fillRect(x + rollerOffset, beltY - 4, 6, 14);
    }
    ctx.restore();
  }

  private renderRollingDonut(ctx: CanvasRenderingContext2D, d: RollingDonut): void {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);

    // Doughnut Body
    ctx.fillStyle = d.type.doughColor;
    ctx.beginPath();
    ctx.arc(0, 0, d.type.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glaze Frosting if glazed
    if (d.glazed) {
      ctx.fillStyle = d.type.glazeColor;
      ctx.beginPath();
      ctx.arc(0, 0, d.type.radius * 0.78, 0, Math.PI * 2);
      ctx.fill();

      // Rainbow Sprinkles on perfect glaze
      if (d.glazeQuality >= 0.9) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-4, -6, 2, 4);
        ctx.fillRect(3, -4, 2, 4);
        ctx.fillRect(-5, 3, 2, 4);
      }
    }

    // Center Donut Hole
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(0, 0, d.type.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderBakerPlayer(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    gp: GlazerPlayer,
    _theme: DonutTheme
  ): void {
    ctx.save();

    // Underdog Golden Glow Aura
    if (gp.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(gp.animTimer * 8) * 6 + 18;
      const grad = ctx.createRadialGradient(gp.x, gp.y - 30, 10, gp.x, gp.y - 30, auraPulse + 25);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y - 30, auraPulse + 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Chef Mascot
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      gp.x,
      gp.y - 22,
      22,
      p.id,
      isBot,
      gp.mood,
      gp.animTimer,
      undefined
    );

    // Draw Baker Toque Hat
    ctx.save();
    ctx.translate(gp.x, gp.y - 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.lineTo(14, -14);
    ctx.quadraticCurveTo(0, -24, -14, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Draw Pastry Glaze Injector Tool in Hands
    const toolX = gp.x + (gp.vx > 10 ? 14 : gp.vx < -10 ? -14 : 8);
    const toolY = gp.y - 26;

    ctx.save();
    ctx.translate(toolX, toolY);

    // Injector Gun Body
    ctx.fillStyle = gp.isUnderdog ? '#FFD700' : '#ECEFF1';
    ctx.beginPath();
    ctx.roundRect(-5, -14, 10, 22, 3);
    ctx.fill();

    ctx.strokeStyle = gp.isUnderdog ? '#FF8F00' : '#78909C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nozzle tip pointing upward
    ctx.fillStyle = gp.isUnderdog ? '#FF8F00' : '#455A64';
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(4, -14);
    ctx.lineTo(2, -22);
    ctx.lineTo(-2, -22);
    ctx.closePath();
    ctx.fill();

    // Glaze Tank level
    const tankFill = (gp.pressure / 100) * 16;
    ctx.fillStyle = gp.isUnderdog ? '#FFD700' : '#F48FB1';
    ctx.fillRect(-3, 6 - tankFill, 6, tankFill);

    ctx.restore();

    // Pressure Gauge above Head
    if (gp.pressure > 0) {
      const barW = 50;
      const barH = 5;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(gp.x - barW / 2, gp.y - 68, barW, barH);

      // Sweet spot [75% to 98%]
      ctx.fillStyle = 'rgba(76, 175, 80, 0.45)';
      ctx.fillRect(gp.x - barW / 2 + barW * 0.75, gp.y - 68, barW * 0.23, barH);

      const fillW = (gp.pressure / 100) * barW;
      ctx.fillStyle = gp.pressure > 98 ? '#FF1744' : gp.pressure > 75 ? '#4CAF50' : '#E040FB';
      ctx.fillRect(gp.x - barW / 2, gp.y - 68, fillW, barH);
      ctx.restore();
    }

    // Overhead Name & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(gp.x - 38, gp.y + 12, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${gp.score}`, gp.x, gp.y + 27);
    ctx.restore();

    ctx.restore();
  }

  private renderUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Top-Center Safe Zone (y: 12-44) is strictly reserved for global timer
    // Minigame Header Badge strictly at y: 56
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 130, 56, 260, 28, 8);
    ctx.fill();

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🍩 DONUT GLAZER • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
    ctx.restore();

    // Theme Pill (bottom-left at x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`[T] ${THEMES[this.currentThemeIdx].name}`, pillX + 10, pillY + pillH / 2);
    ctx.restore();

    // Player Cards at Corners (Offset to y: height - 128 to never overlap Theme Pill)
    this.renderCornerPlayerCards(ctx, width, height);

    // Control Hints at Bottom Right
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(width - 260, height - 36, 240, 26, 6);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: Move • Hold Action: Glaze Stream & Shunt', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const gp = this.glazerPlayers.get(p.id);
      if (!gp) return;

      const cardW = 130;
      const cardH = 48;
      let cx = 20;
      let cy = height - 128; // safe offset above Theme Pill

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 90;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 90;
      }

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 6);
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 10, cy + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 13px monospace';
      ctx.fillText(`${gp.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🍩 ${gp.donutsGlazed}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
