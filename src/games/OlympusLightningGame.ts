import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type OlympusThemeId = 'olympus' | 'asgard' | 'tesla';

interface OlympusTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  plazaTop: string;
  plazaBot: string;
  boltPrimary: string;
  boltRoyal: string;
  accent: string;
}

const THEMES: Record<OlympusThemeId, OlympusTheme> = {
  olympus: {
    name: 'Mount Olympus Pantheon',
    skyTop: '#0f0722',
    skyMid: '#2e1065',
    skyBot: '#4c1d95',
    plazaTop: '#e2e8f0',
    plazaBot: '#94a3b8',
    boltPrimary: '#38bdf8',
    boltRoyal: '#facc15',
    accent: '#facc15',
  },
  asgard: {
    name: 'Bifrost Thunder Bridge',
    skyTop: '#041326',
    skyMid: '#0c4a6e',
    skyBot: '#155e75',
    plazaTop: '#334155',
    plazaBot: '#0f172a',
    boltPrimary: '#22d3ee',
    boltRoyal: '#c084fc',
    accent: '#22d3ee',
  },
  tesla: {
    name: 'Wardenclyffe Plasma Lab',
    skyTop: '#180828',
    skyMid: '#3b0764',
    skyBot: '#701a75',
    plazaTop: '#78350f',
    plazaBot: '#451a03',
    boltPrimary: '#e879f9',
    boltRoyal: '#fde047',
    accent: '#e879f9',
  },
};

const THEME_ORDER: OlympusThemeId[] = ['olympus', 'asgard', 'tesla'];

interface StormBolt {
  id: number;
  x: number;
  progress: number;
  speed: number;
  kind: 'cyan' | 'royal' | 'overlord';
  state: 'descending' | 'caught' | 'grounded';
  fadeTimer: number;
}

interface AmbrosiaSpark {
  id: number;
  x: number;
  y: number;
  vy: number;
  value: number;
  collected: boolean;
  life: number;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ConduitHero {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  patrolDir: 1 | -1;
  score: number;
  combo: number;
  charge: number;
  charging: boolean;
  dischargeAnim: number;
  shockTimer: number;
  shuntCooldown: number;
  boltsCaught: number;
  chainArcs: number;
  botReactionTimer: number;
  botTargetX: number;
  botReleaseThreshold: number;
}

export class OlympusLightningGame extends BaseGame {
  public heroes: Map<PlayerId, ConduitHero> = new Map();
  public bolts: StormBolt[] = [];
  public sparks: AmbrosiaSpark[] = [];
  public currentMapName: string = 'Mount Olympus Pantheon';

  private themeId: OlympusThemeId = 'olympus';
  private callouts: Callout[] = [];
  private boltIdCounter: number = 0;
  private sparkIdCounter: number = 0;
  private nextBoltTimer: number = 0.7;
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    this.cleanupControls();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      } else if (e.key === '1') {
        this.setTheme('olympus');
      } else if (e.key === '2') {
        this.setTheme('asgard');
      } else if (e.key === '3') {
        this.setTheme('tesla');
      }
    };
    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (mx >= 20 && mx <= 190 && my >= canvas.height - 44 && my <= canvas.height - 12) {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private setTheme(id: OlympusThemeId): void {
    this.themeId = id;
    this.currentMapName = THEMES[id].name;
    this.audio.playTap();
  }

  private cleanupControls(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.heroes.clear();
    this.bolts = [];
    this.sparks = [];
    this.callouts = [];
    this.nextBoltTimer = 0.5;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const plazaLeft = 100;
    const plazaRight = width - 100;
    const groundY = height * 0.72;

    active.forEach((p, idx) => {
      const startX = plazaLeft + ((idx + 0.5) / count) * (plazaRight - plazaLeft);
      this.heroes.set(p.id, {
        id: p.id,
        x: startX,
        y: groundY,
        vx: 0,
        patrolDir: idx % 2 === 0 ? 1 : -1,
        score: 0,
        combo: 0,
        charge: 0,
        charging: false,
        dischargeAnim: 0,
        shockTimer: 0,
        shuntCooldown: 0,
        boltsCaught: 0,
        chainArcs: 0,
        botReactionTimer: 0.14,
        botTargetX: startX,
        botReleaseThreshold: 0.82,
      });
    });

    // Spawn 3 initial descending bolts across the plaza
    for (let i = 0; i < 3; i++) {
      this.spawnBolt(width, false);
    }
  }

  private spawnBolt(width: number, suddenDeath: boolean): void {
    const plazaLeft = 95;
    const plazaRight = width - 95;
    const roll = Math.random();
    const kind: 'cyan' | 'royal' | 'overlord' =
      roll < (suddenDeath ? 0.28 : 0.14)
        ? 'overlord'
        : roll < (suddenDeath ? 0.65 : 0.48)
        ? 'royal'
        : 'cyan';

    this.bolts.push({
      id: ++this.boltIdCounter,
      x: plazaLeft + Math.random() * (plazaRight - plazaLeft),
      progress: 0,
      speed: (kind === 'overlord' ? 0.72 : kind === 'royal' ? 0.64 : 0.56) + Math.random() * 0.16,
      kind,
      state: 'descending',
      fadeTimer: 0.45,
    });
  }

  private spawnSpark(x: number, y: number, value: number): void {
    this.sparks.push({
      id: ++this.sparkIdCounter,
      x,
      y,
      vy: -140 - Math.random() * 40,
      value,
      collected: false,
      life: 6.0,
    });
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.heroes.forEach((h) => {
      if (h.score > best) best = h.score;
    });
    return best;
  }

  private isUnderdog(h: ConduitHero): boolean {
    return this.getLeaderScore() - h.score >= 110;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupControls();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 28);
    }

    const suddenDeath = this.roundTimer <= 12.0;
    if (suddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.spawnCallout(width * 0.5, height * 0.22, '⚡ ZEUS WRATH SUPERSTORM (2X SCORE)! ⚡', '#facc15');
    }

    const plazaLeft = 88;
    const plazaRight = width - 88;
    const groundY = height * 0.72;
    const scoreMult = suddenDeath ? 2 : 1;

    // Spawn descending bolts across the shared Pantheon plaza
    this.nextBoltTimer -= dt * (suddenDeath ? 1.45 : 1.0);
    if (this.nextBoltTimer <= 0 && this.bolts.filter((b) => b.state === 'descending').length < 6) {
      this.spawnBolt(width, suddenDeath);
      this.nextBoltTimer = 0.85 + Math.random() * 0.45;
    }

    this.updateBots(dt, width, height);

    // Update Heroes
    this.heroes.forEach((h) => {
      h.y = groundY;
      if (h.shockTimer > 0) h.shockTimer = Math.max(0, h.shockTimer - dt);
      if (h.shuntCooldown > 0) h.shuntCooldown = Math.max(0, h.shuntCooldown - dt);
      if (h.dischargeAnim > 0) h.dischargeAnim = Math.max(0, h.dischargeAnim - dt * 3.0);

      const p = this.getPlayer(h.id);
      const underdog = this.isUnderdog(h);
      const moveSpeed = underdog ? 255 : 220;

      if (p && !p.type.startsWith('bot_') && h.shockTimer <= 0) {
        const steer = this.input.getSteer(h.id);
        const holdAction = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);

        if (Math.abs(steer) > 0.1) {
          h.vx += steer * moveSpeed * 5.4 * dt;
          h.patrolDir = steer >= 0 ? 1 : -1;
        } else {
          // 1-button auto-patrol toward nearest descending bolt
          h.vx += h.patrolDir * 85 * dt;
          if (h.x > plazaRight - 40) h.patrolDir = -1;
          if (h.x < plazaLeft + 40) h.patrolDir = 1;
        }

        if (holdAction) {
          h.charging = true;
          h.charge = Math.min(1.0, h.charge + dt * 1.15);
          // Holding the Astrape Rod gently pulls nearby descending bolts toward your rod!
          this.bolts.forEach((b) => {
            if (b.state === 'descending' && Math.abs(b.x - h.x) < 95) {
              b.x += Math.sign(h.x - b.x) * 42 * dt;
            }
          });
          if (h.charge >= 1.0) {
            h.charging = false;
            h.charge = 0;
            h.shockTimer = 0.45;
            this.audio.playStun();
            this.spawnCallout(h.x, h.y - 54, 'ROD OVERLOAD!', '#ef4444');
          }
        } else if (h.charging) {
          const released = h.charge;
          h.charging = false;
          h.charge = 0;
          this.executeConduitDischarge(h, released, scoreMult);
        }
      }

      h.vx *= Math.pow(0.06, dt);
      h.x += h.vx * dt;
      if (h.x < plazaLeft) {
        h.x = plazaLeft;
        h.vx = Math.abs(h.vx) * 0.4;
        h.patrolDir = 1;
      } else if (h.x > plazaRight) {
        h.x = plazaRight;
        h.vx = -Math.abs(h.vx) * 0.4;
        h.patrolDir = -1;
      }
    });

    // Elastic Hero-to-Hero Collisions
    const heroList = Array.from(this.heroes.values());
    for (let i = 0; i < heroList.length; i++) {
      for (let j = i + 1; j < heroList.length; j++) {
        const a = heroList[i];
        const b = heroList[j];
        const dx = b.x - a.x;
        const minDist = 38;
        if (Math.abs(dx) < minDist) {
          const dir = dx >= 0 ? 1 : -1;
          const overlap = minDist - Math.abs(dx);
          a.x -= dir * overlap * 0.5;
          b.x += dir * overlap * 0.5;
          const vRel = b.vx - a.vx;
          if (vRel * dir < 0) {
            const imp = -vRel * 0.85 + 60;
            a.vx -= dir * imp;
            b.vx += dir * imp;
            this.audio.playBounce();
            this.particles.spawnSparks((a.x + b.x) * 0.5, groundY - 22, '#38bdf8', 8);
          }
        }
      }
    }

    // Update Descending Storm Bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (b.state === 'descending') {
        b.progress += b.speed * dt;
        // Passive rod absorption if a hero is holding their charged rod directly underneath when bolt reaches 0.85..0.98
        if (b.progress >= 0.86 && b.progress <= 0.99) {
          for (const h of heroList) {
            if (h.charging && h.shockTimer <= 0 && Math.abs(h.x - b.x) <= 38) {
              this.awardBoltCatch(h, b, h.charge >= 0.72 && h.charge <= 0.98, scoreMult);
              break;
            }
          }
        }

        if (b.state === 'descending' && b.progress >= 1.0) {
          b.state = 'grounded';
          b.fadeTimer = 0.35;
          this.particles.spawnExplosion(b.x, groundY, '#38bdf8', 14);
          this.audio.playBounce();
          // Shock any unshielded hero standing directly on the ground impact point
          for (const h of heroList) {
            if (Math.abs(h.x - b.x) < 34 && !h.charging && !this.isUnderdog(h)) {
              h.shockTimer = 0.6;
              h.combo = 0;
              h.score = Math.max(0, h.score - 20);
              h.vx += (h.x >= b.x ? 1 : -1) * 140;
              this.audio.playStun();
              this.spawnCallout(h.x, h.y - 54, '-20 GROUND SHOCK!', '#ef4444');
            }
          }
        }
      } else {
        b.fadeTimer -= dt;
        if (b.fadeTimer <= 0) {
          this.bolts.splice(i, 1);
        }
      }
    }

    // Update Ambrosia Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life -= dt;
      sp.vy += 350 * dt;
      sp.y += sp.vy * dt;
      if (sp.y >= groundY - 12) {
        sp.y = groundY - 12;
        sp.vy = -Math.abs(sp.vy) * 0.45;
      }

      for (const h of heroList) {
        if (!sp.collected && Math.hypot(sp.x - h.x, sp.y - (h.y - 22)) < 36) {
          sp.collected = true;
          const pts = sp.value * scoreMult;
          h.score += pts;
          h.combo++;
          this.audio.playCoin();
          this.particles.spawnConfetti(sp.x, sp.y, 10);
          this.spawnCallout(sp.x, sp.y - 24, `✨ +${pts} AMBROSIA!`, '#facc15');
          break;
        }
      }

      if (sp.collected || sp.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private awardBoltCatch(
    h: ConduitHero,
    b: StormBolt,
    isSweetSpot: boolean,
    scoreMult: number
  ): void {
    b.state = 'caught';
    b.fadeTimer = 0.42;
    h.boltsCaught++;
    h.combo++;
    const basePts = b.kind === 'overlord' ? 90 : b.kind === 'royal' ? 60 : 38;
    const pts = Math.round(
      (basePts + Math.min(35, h.combo * 4)) * (isSweetSpot ? 1.6 : 1.0) * scoreMult
    );
    h.score += pts;
    this.audio.playScore();
    this.particles.spawnExplosion(b.x, h.y - 42, '#facc15', 18);
    this.spawnCallout(
      b.x,
      h.y - 62,
      isSweetSpot ? `⚡ ASTRAPE CONDUIT! +${pts}` : `⚡ CAUGHT +${pts}`,
      b.kind === 'overlord' ? '#e879f9' : '#facc15'
    );
    if (isSweetSpot || b.kind !== 'cyan') {
      this.spawnSpark(b.x + (Math.random() - 0.5) * 50, h.y - 45, 45);
    }
  }

  private executeConduitDischarge(h: ConduitHero, chargeLevel: number, scoreMult: number): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    h.dischargeAnim = 1.0;

    if (isSweetSpot) {
      this.screenShake = Math.min(14, this.screenShake + 7);
      this.audio.playExplosion();
      this.particles.spawnExplosion(h.x, h.y - 38, '#facc15', 18);
    } else {
      this.audio.playWhoosh();
      this.particles.spawnSparks(h.x, h.y - 36, '#38bdf8', 10);
    }

    const catchReach = isSweetSpot ? 95 : 58;
    let caughtAny = false;

    for (const b of this.bolts) {
      if (b.state !== 'descending') continue;
      if (Math.abs(b.x - h.x) <= catchReach && b.progress >= 0.45) {
        caughtAny = true;
        this.awardBoltCatch(h, b, isSweetSpot, scoreMult);
      }
    }

    // Sweet-Spot Chain-Lightning Shunt against rival Demigods!
    if (isSweetSpot) {
      this.heroes.forEach((other) => {
        if (other.id === h.id || other.shuntCooldown > 0) return;
        const dx = other.x - h.x;
        if (Math.abs(dx) <= 115) {
          const dir = dx >= 0 ? 1 : -1;
          other.vx += dir * 290;
          other.shockTimer = 0.55;
          other.charging = false;
          other.charge = 0;
          other.shuntCooldown = 1.2;
          const pts = 70 * scoreMult;
          h.score += pts;
          h.chainArcs++;
          this.audio.playStun();
          this.particles.spawnExplosion(other.x, other.y - 24, '#38bdf8', 14);
          this.spawnCallout(other.x, other.y - 64, `⚡ CHAIN ARC SHUNT! +${pts}`, '#38bdf8');
        }
      });

      if (!caughtAny) {
        this.spawnCallout(h.x, h.y - 56, '⚡ OLYMPUS SURGE!', '#facc15');
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
    const h = this.heroes.get(botId);
    if (!h || h.shockTimer > 0) return;

    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    h.botReactionTimer -= dt;
    if (h.botReactionTimer <= 0) {
      h.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.40;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Pick highest-utility descending bolt
      let bestBolt: StormBolt | null = null;
      let bestScore = -Infinity;
      for (const b of this.bolts) {
        if (b.state !== 'descending') continue;
        const val = b.kind === 'overlord' ? 140 : b.kind === 'royal' ? 95 : 60;
        const score = val + b.progress * 70 - Math.abs(b.x - h.x) * 0.35;
        if (score > bestScore) {
          bestScore = score;
          bestBolt = b;
        }
      }

      const spark = this.sparks.find((s) => !s.collected && Math.abs(s.x - h.x) < 140);
      if (spark && (!bestBolt || bestBolt.progress < 0.55) && Math.random() > blunder) {
        h.botTargetX = spark.x;
      } else if (bestBolt && Math.random() > blunder) {
        h.botTargetX = bestBolt.x;
        if (bestBolt.progress >= 0.42 && Math.abs(bestBolt.x - h.x) < 75 && !h.charging) {
          h.charging = true;
          h.botReleaseThreshold =
            difficulty === 'bot_hard'
              ? 0.78 + Math.random() * 0.14
              : difficulty === 'bot_normal'
              ? 0.68 + Math.random() * 0.22
              : 0.52 + Math.random() * 0.35;
        }
      } else {
        h.botTargetX = width * (0.28 + Number(botId) * 0.14);
      }
    }

    const dx = h.botTargetX - h.x;
    if (Math.abs(dx) > 10) {
      const moveSpeed = this.isUnderdog(h) ? 245 : 210;
      h.vx += Math.sign(dx) * moveSpeed * 4.8 * dt;
    }

    if (h.charging) {
      h.charge = Math.min(1.0, h.charge + dt * 1.15);
      const readyBolt = this.bolts.some(
        (b) => b.state === 'descending' && Math.abs(b.x - h.x) <= 75 && b.progress >= 0.68
      );
      if ((h.charge >= h.botReleaseThreshold && readyBolt) || h.charge >= 0.94) {
        const released = h.charge;
        h.charging = false;
        h.charge = 0;
        this.executeConduitDischarge(h, released, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const groundY = height * 0.72;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Stormy Olympus Sky Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.5, theme.skyMid);
    bgGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Parthenon Marble Columns in Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    for (let x = 70; x < width - 50; x += 115) {
      ctx.fillRect(x - 12, 115, 24, groundY - 115);
      ctx.fillRect(x - 18, 106, 36, 10);
    }

    // 3. 2.5D Pantheon Marble Plaza Deck
    const plazaGrad = ctx.createLinearGradient(0, groundY, 0, height);
    plazaGrad.addColorStop(0, theme.plazaTop);
    plazaGrad.addColorStop(1, theme.plazaBot);
    ctx.fillStyle = plazaGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // 4. Render Descending Storm Bolts & Ground Strike Reticles
    const topY = 92;
    this.bolts.forEach((b) => {
      const boltColor =
        b.kind === 'overlord'
          ? '#e879f9'
          : b.kind === 'royal'
          ? theme.boltRoyal
          : theme.boltPrimary;
      const headY = topY + (groundY - 38 - topY) * b.progress;

      // Ground strike reticle
      if (b.state === 'descending') {
        ctx.save();
        ctx.strokeStyle = boltColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(b.x, groundY + 2, 26 * (1.2 - b.progress * 0.4), 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Jagged Plasma Bolt
      ctx.save();
      ctx.strokeStyle = b.state === 'caught' ? '#facc15' : boltColor;
      ctx.lineWidth = b.state === 'caught' ? 7 : b.kind === 'overlord' ? 5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(b.x, topY);
      let segY = topY;
      let seed = b.id * 17 + Math.floor(this.animTime * 24);
      while (segY < headY) {
        const nextY = Math.min(headY, segY + 24);
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const zag = ((seed % 100) / 100 - 0.5) * 20;
        ctx.lineTo(b.x + zag, nextY);
        segY = nextY;
      }
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, headY, b.kind === 'overlord' ? 9 : 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Render Ambrosia Sparks
    this.sparks.forEach((sp) => {
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // 6. Render 2.5D Demigod Mascot Heroes with Golden Astrape Conduit Rods
    this.heroes.forEach((h, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#a855f7';
      const isSweetSpot = h.charge >= 0.72 && h.charge <= 0.98;

      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.shockTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, 0);
      }

      if (h.dischargeAnim > 0) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${h.dischargeAnim})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -24, (1 - h.dischargeAnim) * 95 + 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2.5D Mascot Avatar
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -22,
        19,
        h.shockTimer > 0 ? 'shocked' : h.dischargeAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Golden Astrape Lightning Rod
      const rodLift = h.charging ? -10 : 0;
      ctx.strokeStyle = isSweetSpot ? '#fef08a' : '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(14, -12);
      ctx.lineTo(18, -48 + rodLift);
      ctx.stroke();

      // Tuning Fork Prongs at top of Rod
      ctx.beginPath();
      ctx.moveTo(11, -56 + rodLift);
      ctx.lineTo(18, -48 + rodLift);
      ctx.lineTo(25, -56 + rodLift);
      ctx.stroke();

      if (h.charging) {
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(18, -54 + rodLift, 6 + Math.sin(this.animTime * 18) * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hold-to-Charge Conduit Gauge (72%–98% Sweet Spot)
      if (h.charging && h.charge > 0.04) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -64, bw + 2, 7);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -63, bw * 0.26, 5);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -63, bw * h.charge, 5);
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? `P${pId + 1}`}`, 0, 20);
      ctx.restore();
    });

    // 7. Callouts
    this.callouts.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });

    ctx.restore();

    // 8. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '⚡ STEER: INTERCEPT BOLTS • HOLD & RELEASE (72–98%): ASTRAPE CATCH & CHAIN SHUNT!',
      width / 2,
      74
    );

    // 9. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const h = this.heroes.get(p.id);
      if (!h) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(h.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`⚡${h.boltsCaught} 🔗${h.chainArcs}`, cardX + 150, cardY + 37);
    });

    // 10. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 [T] ${theme.name}`, 105, height - 24);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.heroes.forEach((h, pId) => scores.set(pId, Math.floor(h.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.heroes.entries())
      .map(([playerId, h]) => ({ playerId, score: Math.floor(h.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    const winnerCfg = winnerId ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerCfg
        ? `${winnerCfg.name} channeled the thunder of Zeus with ${rankings[0].score} pts!`
        : 'All challengers struck by Olympus lightning!',
    };
  }
}
