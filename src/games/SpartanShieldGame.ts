import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type SpartanThemeId = 'thermopylae' | 'marathon' | 'hades';

interface SpartanTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  cliffBack: string;
  cliffFront: string;
  groundTop: string;
  groundBot: string;
  arrowGlow: string;
  accent: string;
}

const THEMES: Record<SpartanThemeId, SpartanTheme> = {
  thermopylae: {
    name: 'Hot Gates of Thermopylae',
    skyTop: '#2c0b0e',
    skyMid: '#7b241c',
    skyBot: '#d35400',
    cliffBack: '#26140c',
    cliffFront: '#3e2215',
    groundTop: '#5d3420',
    groundBot: '#211109',
    arrowGlow: '#ff6b35',
    accent: '#f59e0b',
  },
  marathon: {
    name: 'Plains of Marathon',
    skyTop: '#0c2461',
    skyMid: '#1e3799',
    skyBot: '#f6b93b',
    cliffBack: '#2c3a47',
    cliffFront: '#485460',
    groundTop: '#825832',
    groundBot: '#3d2817',
    arrowGlow: '#facc15',
    accent: '#38bdf8',
  },
  hades: {
    name: 'Tartarus Obsidian Pass',
    skyTop: '#090314',
    skyMid: '#240b36',
    skyBot: '#6f1e51',
    cliffBack: '#13071e',
    cliffFront: '#220e35',
    groundTop: '#301446',
    groundBot: '#12061c',
    arrowGlow: '#4ade80',
    accent: '#c084fc',
  },
};

const THEME_ORDER: SpartanThemeId[] = ['thermopylae', 'marathon', 'hades'];

interface FireArrow {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  active: boolean;
  isRoyal: boolean;
}

interface PersianUnit {
  id: number;
  x: number;
  vx: number;
  hp: number;
  maxHp: number;
  kind: 'immortal' | 'captain';
  active: boolean;
  hitFlash: number;
  stridePhase: number;
}

interface WarRelic {
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

export interface HopliteState {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  patrolDir: 1 | -1;
  shieldRaised: boolean;
  charge: number;
  charging: boolean;
  spearThrustAnim: number;
  sweetThrustAnim: number;
  score: number;
  combo: number;
  staggerTimer: number;
  shuntCooldown: number;
  arrowsBlocked: number;
  foesSlain: number;
  botReactionTimer: number;
  botTargetX: number;
  botReleaseThreshold: number;
}

export class SpartanShieldGame extends BaseGame {
  public hoplites: Map<PlayerId, HopliteState> = new Map();
  public currentMapName: string = 'Hot Gates of Thermopylae';

  private themeId: SpartanThemeId = 'thermopylae';
  private arrows: FireArrow[] = [];
  private enemies: PersianUnit[] = [];
  private relics: WarRelic[] = [];
  private callouts: Callout[] = [];

  private arrowIdCounter: number = 0;
  private enemyIdCounter: number = 0;
  private relicIdCounter: number = 0;

  private nextSalvoTimer: number = 1.2;
  private nextEnemyTimer: number = 1.8;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private animTime: number = 0;

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
        this.setTheme('thermopylae');
      } else if (e.key === '2') {
        this.setTheme('marathon');
      } else if (e.key === '3') {
        this.setTheme('hades');
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

  private setTheme(id: SpartanThemeId): void {
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
    this.hoplites.clear();
    this.arrows = [];
    this.enemies = [];
    this.relics = [];
    this.callouts = [];
    this.nextSalvoTimer = 1.1;
    this.nextEnemyTimer = 1.6;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;
    this.animTime = 0;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const passLeft = 110;
    const passRight = width - 140;
    const groundY = height * 0.69;

    active.forEach((p, idx) => {
      const startX = passLeft + ((idx + 0.5) / count) * (passRight - passLeft);
      this.hoplites.set(p.id, {
        id: p.id,
        x: startX,
        y: groundY,
        vx: 0,
        facing: 1,
        patrolDir: idx % 2 === 0 ? 1 : -1,
        shieldRaised: false,
        charge: 0,
        charging: false,
        spearThrustAnim: 0,
        sweetThrustAnim: 0,
        score: 0,
        combo: 0,
        staggerTimer: 0,
        shuntCooldown: 0,
        arrowsBlocked: 0,
        foesSlain: 0,
        botReactionTimer: 0.15,
        botTargetX: startX,
        botReleaseThreshold: 0.82,
      });
    });

    // Spawn initial war relic and arrow salvo so action starts on frame 1
    this.spawnRelic(width * 0.52, groundY - 120, 45);
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private spawnRelic(x: number, y: number, value: number): void {
    this.relics.push({
      id: ++this.relicIdCounter,
      x,
      y,
      vy: -130,
      value,
      collected: false,
      life: 6.5,
    });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.hoplites.forEach((h) => {
      if (h.score > best) best = h.score;
    });
    return best;
  }

  private isUnderdog(h: HopliteState): boolean {
    const leader = this.getLeaderScore();
    return leader - h.score >= 120;
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
      this.spawnCallout(width * 0.5, height * 0.25, '⚡ XERXES ECLIPSE BARRAGE (2X SCORE)! ⚡', '#facc15');
    }

    const passLeft = 86;
    const passRight = width - 96;
    const groundY = height * 0.69;

    // Spawn shared Persian Fire Arrow Salvos across the pass
    this.nextSalvoTimer -= dt * (suddenDeath ? 1.45 : 1.0);
    if (this.nextSalvoTimer <= 0) {
      const count = suddenDeath ? 6 : 4;
      const playersArr = Array.from(this.hoplites.values());
      for (let i = 0; i < count; i++) {
        // Target near players + spread across the pass
        const refPlayer = playersArr[i % Math.max(1, playersArr.length)];
        const targetX = refPlayer
          ? Math.max(passLeft + 20, Math.min(passRight - 30, refPlayer.x + (Math.random() - 0.5) * 140))
          : passLeft + Math.random() * (passRight - passLeft);
        const startX = targetX - 55 + (Math.random() - 0.5) * 40;
        const flightTime = 0.95 + i * 0.08;
        this.arrows.push({
          id: ++this.arrowIdCounter,
          x: startX,
          y: 65 - i * 24,
          vx: (targetX - startX) / flightTime,
          vy: (groundY - (65 - i * 24)) / flightTime,
          targetX,
          active: true,
          isRoyal: suddenDeath || i === count - 1,
        });
      }
      this.nextSalvoTimer = 2.15 + Math.random() * 0.75;
      this.audio.playWhoosh();
    }

    // Spawn shared Persian Immortals & Royal Captains charging from the right pass gate
    this.nextEnemyTimer -= dt * (suddenDeath ? 1.4 : 1.0);
    if (this.nextEnemyTimer <= 0) {
      const isCaptain = Math.random() < (suddenDeath ? 0.42 : 0.25);
      this.enemies.push({
        id: ++this.enemyIdCounter,
        x: passRight + 35,
        vx: -(isCaptain ? 118 : 96) * (suddenDeath ? 1.18 : 1.0),
        hp: isCaptain ? 2 : 1,
        maxHp: isCaptain ? 2 : 1,
        kind: isCaptain ? 'captain' : 'immortal',
        active: true,
        hitFlash: 0,
        stridePhase: Math.random() * Math.PI * 2,
      });
      this.nextEnemyTimer = 2.4 + Math.random() * 1.1;
    }

    this.updateBots(dt, width, height);

    // Update Hoplites
    this.hoplites.forEach((h) => {
      h.y = groundY;
      if (h.staggerTimer > 0) h.staggerTimer = Math.max(0, h.staggerTimer - dt);
      if (h.shuntCooldown > 0) h.shuntCooldown = Math.max(0, h.shuntCooldown - dt);
      if (h.spearThrustAnim > 0) h.spearThrustAnim = Math.max(0, h.spearThrustAnim - dt * 4.2);
      if (h.sweetThrustAnim > 0) h.sweetThrustAnim = Math.max(0, h.sweetThrustAnim - dt * 3.0);

      const p = this.getPlayer(h.id);
      const underdog = this.isUnderdog(h);
      const moveSpeed = (underdog ? 245 : 210) * (h.shieldRaised ? 0.72 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(h.id);
        const holdAction = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);

        if (h.staggerTimer <= 0) {
          if (Math.abs(steer) > 0.1) {
            h.vx += steer * moveSpeed * 5.5 * dt;
            h.facing = steer >= 0 ? 1 : -1;
            h.patrolDir = h.facing;
          } else {
            // Subtle auto-patrol for 1-button players so they traverse the pass
            h.vx += h.patrolDir * 85 * dt;
            if (h.x > passRight - 45) h.patrolDir = -1;
            if (h.x < passLeft + 45) h.patrolDir = 1;
          }

          if (holdAction) {
            h.shieldRaised = true;
            h.charging = true;
            h.charge = Math.min(1.0, h.charge + dt * 1.05);
            if (h.charge >= 1.0) {
              // Overcharge guard fatigue
              h.shieldRaised = false;
              h.charging = false;
              h.charge = 0;
              h.staggerTimer = 0.5;
              this.audio.playStun();
              this.spawnCallout(h.x, h.y - 54, 'GUARD FATIGUE!', '#ef4444');
            }
          } else if (h.charging) {
            const releasedCharge = h.charge;
            h.charging = false;
            h.shieldRaised = false;
            h.charge = 0;
            this.executeSpearCounter(h, releasedCharge, suddenDeath);
          } else {
            h.shieldRaised = false;
          }
        } else {
          h.shieldRaised = false;
          h.charging = false;
          h.charge = 0;
        }
      }

      // Physics integration & damping
      h.vx *= Math.pow(0.06, dt);
      h.x += h.vx * dt;

      if (h.x < passLeft) {
        h.x = passLeft;
        h.vx = Math.abs(h.vx) * 0.4;
        h.patrolDir = 1;
      } else if (h.x > passRight) {
        h.x = passRight;
        h.vx = -Math.abs(h.vx) * 0.4;
        h.patrolDir = -1;
      }
    });

    // Elastic Player-to-Player Phalanx Collisions
    const list = Array.from(this.hoplites.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const minDist = 38;
        if (Math.abs(dx) < minDist) {
          const dir = dx >= 0 ? 1 : -1;
          const overlap = minDist - Math.abs(dx);
          a.x -= dir * overlap * 0.5;
          b.x += dir * overlap * 0.5;

          const vRel = b.vx - a.vx;
          if (vRel * dir < 0) {
            const impulse = -vRel * 0.85;
            a.vx -= dir * (impulse + 55);
            b.vx += dir * (impulse + 55);
            this.audio.playBounce();
            this.particles.spawnSparks((a.x + b.x) * 0.5, groundY - 22, '#f59e0b', 6);
          }
        }
      }
    }

    // Update Fire Arrows
    const scoreMult = suddenDeath ? 2 : 1;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arr = this.arrows[i];
      arr.x += arr.vx * dt;
      arr.y += arr.vy * dt;

      if (arr.active && arr.y >= groundY - 46 && arr.y <= groundY + 8) {
        for (const h of list) {
          if (Math.abs(arr.x - h.x) <= 32) {
            arr.active = false;
            if (h.shieldRaised && h.staggerTimer <= 0) {
              const pts = ((arr.isRoyal ? 30 : 20) + Math.min(25, h.combo * 3)) * scoreMult;
              h.score += pts;
              h.combo++;
              h.arrowsBlocked++;
              // Blocking an arrow also boosts charge slightly toward the sweet spot!
              h.charge = Math.min(0.95, h.charge + 0.12);
              this.audio.playBounce();
              this.particles.spawnSparks(arr.x, groundY - 38, '#facc15', 10);
              this.spawnCallout(h.x, h.y - 58, `🛡️ +${pts}`, '#fde047');
            } else if (!this.isUnderdog(h)) {
              h.staggerTimer = 0.65;
              h.combo = 0;
              h.score = Math.max(0, h.score - 20);
              h.vx -= 90;
              this.audio.playStun();
              this.particles.spawnExplosion(h.x, groundY - 24, '#ef4444', 12);
              this.spawnCallout(h.x, h.y - 58, '-20 PIERCED!', '#ef4444');
            } else {
              // Underdog armor deflects grazing arrow without point loss
              this.audio.playBounce();
              this.spawnCallout(h.x, h.y - 58, 'SURGE ARMOR!', '#38bdf8');
            }
            break;
          }
        }
      }

      if (!arr.active || arr.y > groundY + 12) {
        if (arr.active) {
          this.particles.spawnSparks(arr.x, groundY, '#ea580c', 4);
        }
        this.arrows.splice(i, 1);
      }
    }

    // Update Persian Units
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const ene = this.enemies[i];
      ene.x += ene.vx * dt;
      ene.stridePhase += dt * 8.5;
      if (ene.hitFlash > 0) ene.hitFlash = Math.max(0, ene.hitFlash - dt * 4);

      if (ene.active) {
        for (const h of list) {
          const dist = ene.x - h.x;
          // Body collision with Hoplite
          if (Math.abs(dist) < 28) {
            if (h.shieldRaised && h.staggerTimer <= 0) {
              // Shield brace pushes enemy back and awards brace points!
              ene.x = h.x + 42;
              ene.vx = -Math.abs(ene.vx) * 0.85;
              h.vx -= 75;
              const pts = 20 * scoreMult;
              h.score += pts;
              this.audio.playBounce();
              this.particles.spawnSparks(ene.x - 14, groundY - 24, '#f59e0b', 8);
              this.spawnCallout(h.x, h.y - 52, `PHALANX BRACE +${pts}`, '#fbbf24');
            } else {
              ene.active = false;
              if (!this.isUnderdog(h)) {
                h.staggerTimer = 0.75;
                h.combo = 0;
                h.score = Math.max(0, h.score - 25);
                h.vx -= 140;
                this.audio.playStun();
                this.particles.spawnExplosion(h.x, groundY - 24, '#ef4444', 14);
                this.spawnCallout(h.x, h.y - 54, '-25 TRAMPLED!', '#ef4444');
              }
            }
            break;
          }
        }
      }

      if (!ene.active || ene.x < passLeft - 40) {
        this.enemies.splice(i, 1);
      }
    }

    // Update War Relics
    for (let i = this.relics.length - 1; i >= 0; i--) {
      const r = this.relics[i];
      r.life -= dt;
      r.vy += 340 * dt;
      r.y += r.vy * dt;
      if (r.y >= groundY - 14) {
        r.y = groundY - 14;
        r.vy = -Math.abs(r.vy) * 0.45;
      }

      for (const h of list) {
        if (!r.collected && Math.hypot(r.x - h.x, r.y - (h.y - 20)) < 36) {
          r.collected = true;
          const pts = r.value * scoreMult;
          h.score += pts;
          h.combo++;
          this.audio.playCoin();
          this.particles.spawnConfetti(r.x, r.y, 12);
          this.spawnCallout(r.x, r.y - 28, `🏛️ +${pts} LAUREL!`, '#facc15');
          break;
        }
      }

      if (r.collected || r.life <= 0) {
        this.relics.splice(i, 1);
      }
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 32 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private executeSpearCounter(h: HopliteState, chargeLevel: number, suddenDeath: boolean): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    const scoreMult = suddenDeath ? 2 : 1;
    h.facing = 1; // Spear counter thrusts toward advancing Persian line (or nearest foe)
    h.spearThrustAnim = 1.0;

    if (isSweetSpot) {
      h.sweetThrustAnim = 1.0;
      h.vx += 165;
      this.screenShake = Math.min(14, this.screenShake + 8);
      this.audio.playExplosion();
      this.particles.spawnExplosion(h.x + 48, h.y - 22, '#facc15', 18);
    } else {
      h.vx += 75;
      this.audio.playWhoosh();
      this.particles.spawnSparks(h.x + 36, h.y - 20, '#f59e0b', 8);
    }

    const reach = isSweetSpot ? 122 : 76;
    let hitAny = false;

    for (const ene of this.enemies) {
      if (!ene.active) continue;
      const dx = ene.x - h.x;
      if (dx >= -18 && dx <= reach) {
        hitAny = true;
        const dmg = isSweetSpot ? 2 : 1;
        ene.hp -= dmg;
        ene.hitFlash = 1.0;
        if (ene.hp <= 0) {
          ene.active = false;
          h.foesSlain++;
          h.combo++;
          const basePts = ene.kind === 'captain' ? 95 : 55;
          const pts = Math.round((basePts + Math.min(35, h.combo * 5)) * (isSweetSpot ? 1.65 : 1.0) * scoreMult);
          h.score += pts;
          this.audio.playScore();
          this.particles.spawnExplosion(ene.x, h.y - 24, '#f97316', 16);
          this.spawnCallout(
            ene.x,
            h.y - 62,
            isSweetSpot ? `⚡ 300 SPEAR! +${pts}` : `⚔️ +${pts}`,
            isSweetSpot ? '#facc15' : '#fdba74'
          );
          if (isSweetSpot || ene.kind === 'captain') {
            this.spawnRelic(ene.x, h.y - 45, ene.kind === 'captain' ? 65 : 45);
          }
        } else {
          ene.x += 52;
          const pts = 30 * scoreMult;
          h.score += pts;
          this.audio.playBounce();
          this.spawnCallout(ene.x, h.y - 52, `SHIELD CRACK +${pts}`, '#fb923c');
        }
      }
    }

    // Sweet-Spot Aspis Shield-Bash Shunt against rival Hoplites!
    if (isSweetSpot) {
      this.hoplites.forEach((other) => {
        if (other.id === h.id) return;
        const dx = other.x - h.x;
        if (Math.abs(dx) <= 95 && other.shuntCooldown <= 0) {
          const dir = dx >= 0 ? 1 : -1;
          other.vx += dir * 310;
          other.staggerTimer = 0.55;
          other.shieldRaised = false;
          other.charging = false;
          other.charge = 0;
          other.shuntCooldown = 1.2;
          const shuntPts = 65 * scoreMult;
          h.score += shuntPts;
          this.audio.playStun();
          this.particles.spawnExplosion(other.x, other.y - 24, '#facc15', 14);
          this.spawnCallout(other.x, other.y - 68, `🦵 SPARTAN KICK! +${shuntPts}`, '#facc15');
        }
      });

      if (!hitAny) {
        this.spawnCallout(h.x, h.y - 58, '⚡ MOLON LABE SURGE!', '#facc15');
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
    const h = this.hoplites.get(botId);
    if (!h || h.staggerTimer > 0) return;

    const passLeft = 95;
    const passRight = width - 105;
    const suddenDeath = this.roundTimer <= 12.0;

    h.botReactionTimer -= dt;
    if (h.botReactionTimer <= 0) {
      h.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.40;

      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Check incoming arrows overhead
      const overheadArrow = this.arrows.find(
        (a) => a.active && Math.abs(a.targetX - h.x) < 44 && a.y > h.y - 210
      );

      // Find nearest Persian enemy
      let nearestEnemy: PersianUnit | null = null;
      let nearestDist = Infinity;
      for (const ene of this.enemies) {
        if (!ene.active) continue;
        const d = ene.x - h.x;
        if (d > -20 && d < nearestDist) {
          nearestDist = d;
          nearestEnemy = ene;
        }
      }

      // Find nearest War Relic
      const relic = this.relics.find((r) => !r.collected && Math.abs(r.x - h.x) < 180);

      if (relic && !overheadArrow && Math.random() > blunder) {
        h.botTargetX = relic.x;
      } else if (nearestEnemy) {
        h.botTargetX = Math.max(passLeft, Math.min(passRight, nearestEnemy.x - 68));
      } else {
        h.botTargetX = width * 0.5 + Math.sin(this.animTime * 1.5 + Number(botId)) * 110;
      }

      // Decide shield / charge state
      if (overheadArrow && Math.random() > blunder) {
        h.shieldRaised = true;
        h.charging = true;
        h.botReleaseThreshold = 0.84;
      } else if (nearestEnemy && nearestDist < 135 && !h.charging && Math.random() > blunder) {
        h.shieldRaised = true;
        h.charging = true;
        h.botReleaseThreshold =
          difficulty === 'bot_hard'
            ? 0.78 + Math.random() * 0.14
            : difficulty === 'bot_normal'
            ? 0.68 + Math.random() * 0.22
            : 0.48 + Math.random() * 0.35;
      } else if (!overheadArrow && (!nearestEnemy || nearestDist > 155) && h.charging && h.charge > 0.35) {
        // Release if safe and no immediate arrow
        const released = h.charge;
        h.charging = false;
        h.shieldRaised = false;
        h.charge = 0;
        this.executeSpearCounter(h, released, suddenDeath);
      }
    }

    // Continuous steering & charge progression for bots
    const dx = h.botTargetX - h.x;
    if (Math.abs(dx) > 12) {
      const dir = dx > 0 ? 1 : -1;
      const moveSpeed = (this.isUnderdog(h) ? 235 : 198) * (h.shieldRaised ? 0.72 : 1.0);
      h.vx += dir * moveSpeed * 4.6 * dt;
      h.facing = 1;
    }

    if (h.charging) {
      h.charge = Math.min(1.0, h.charge + dt * 1.05);
      const imminentEnemy = this.enemies.some((e) => e.active && e.x - h.x >= -10 && e.x - h.x <= 105);
      const overheadArrow = this.arrows.some(
        (a) => a.active && Math.abs(a.targetX - h.x) < 38 && a.y > h.y - 140
      );
      if (
        (h.charge >= h.botReleaseThreshold && (imminentEnemy || !overheadArrow)) ||
        h.charge >= 0.94
      ) {
        const released = h.charge;
        h.charging = false;
        h.shieldRaised = false;
        h.charge = 0;
        this.executeSpearCounter(h, released, suddenDeath);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const groundY = height * 0.69;
    const suddenDeath = this.roundTimer <= 12.0;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Epic Mythic Sky Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.55, theme.skyMid);
    skyGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Solar / Eclipse Orb
    const sunX = width * 0.74;
    const sunY = height * 0.26;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, suddenDeath ? 74 : 58);
    sunGrad.addColorStop(0, suddenDeath ? '#111827' : '#fef08a');
    sunGrad.addColorStop(0.45, suddenDeath ? '#dc2626' : theme.accent);
    sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, suddenDeath ? 74 : 58, 0, Math.PI * 2);
    ctx.fill();

    // 2. Parallax Cliffs of Thermopylae
    ctx.fillStyle = theme.cliffBack;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(0, height * 0.36);
    ctx.lineTo(width * 0.22, height * 0.44);
    ctx.lineTo(width * 0.46, height * 0.31);
    ctx.lineTo(width * 0.72, height * 0.48);
    ctx.lineTo(width, height * 0.34);
    ctx.lineTo(width, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.cliffFront;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(0, height * 0.48);
    ctx.lineTo(width * 0.18, height * 0.56);
    ctx.lineTo(width * 0.42, height * 0.47);
    ctx.lineTo(width * 0.66, height * 0.57);
    ctx.lineTo(width, height * 0.45);
    ctx.lineTo(width, groundY);
    ctx.closePath();
    ctx.fill();

    // Greek Doric Ruin Pillars & Flaming Braziers along the pass
    for (let i = 0; i < 4; i++) {
      const px = width * (0.16 + i * 0.22);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(px - 10, groundY - 78, 20, 78);
      ctx.fillRect(px - 14, groundY - 84, 28, 7);
      // Flaming brazier glow
      const flicker = Math.sin(this.animTime * 9 + i * 2) * 3;
      const fireGrad = ctx.createRadialGradient(px, groundY - 92, 2, px, groundY - 92, 22 + flicker);
      fireGrad.addColorStop(0, '#fef08a');
      fireGrad.addColorStop(0.5, theme.arrowGlow);
      fireGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(px, groundY - 92, 22 + flicker, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 2.5D Stone Pass Deck
    const deckGrad = ctx.createLinearGradient(0, groundY, 0, height);
    deckGrad.addColorStop(0, theme.groundTop);
    deckGrad.addColorStop(1, theme.groundBot);
    ctx.fillStyle = deckGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Persian Invasion Gate indicator on right
    ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
    ctx.fillRect(width - 96, groundY - 90, 96, 90);
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ PERSIAN BREACH', width - 48, groundY - 96);

    // 4. Arrow Target Reticles on Ground
    this.arrows.forEach((arr) => {
      if (!arr.active) return;
      ctx.save();
      ctx.strokeStyle = arr.isRoyal ? '#facc15' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(arr.targetX, groundY + 2, 18, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 5. Render War Relics (Golden Spartan Laurels)
    this.relics.forEach((r) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.85)');
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 10, Math.PI * 0.2, Math.PI * 0.8, true);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${r.value}`, 0, -14);
      ctx.restore();
    });

    // 6. Render Advancing Persian Immortals & Royal Captains
    this.enemies.forEach((ene) => {
      if (!ene.active) return;
      const isCap = ene.kind === 'captain';
      const bob = Math.abs(Math.sin(ene.stridePhase)) * 4;
      ctx.save();
      ctx.translate(ene.x, groundY - bob);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, bob + 2, isCap ? 20 : 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cloaked Immortal Torso
      ctx.fillStyle = ene.hitFlash > 0 ? '#ffffff' : isCap ? '#6d28d9' : '#4c1d95';
      ctx.strokeStyle = isCap ? '#facc15' : '#a78bfa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(isCap ? -15 : -12, isCap ? -42 : -34, isCap ? 30 : 24, isCap ? 40 : 32, 6);
      ctx.fill();
      ctx.stroke();

      // Persian Tiara / Turban & Gold Face Mask
      ctx.fillStyle = isCap ? '#facc15' : '#d97706';
      ctx.beginPath();
      ctx.arc(0, isCap ? -48 : -40, isCap ? 12 : 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-7, isCap ? -50 : -42, 8, 5);

      // Wicker Shield & Curved Scimitar
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-10, -20);
      ctx.quadraticCurveTo(-26, -26, -30, -14);
      ctx.stroke();

      if (ene.maxHp > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-16, -66, 32, 5);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-16, -66, 32 * (ene.hp / ene.maxHp), 5);
      }
      ctx.restore();
    });

    // 7. Render Raining Fire Arrows
    this.arrows.forEach((arr) => {
      if (!arr.active) return;
      const angle = Math.atan2(arr.vy, arr.vx);
      ctx.save();
      ctx.translate(arr.x, arr.y);
      ctx.rotate(angle);

      // Flame trail
      const trailGrad = ctx.createLinearGradient(-26, 0, 8, 0);
      trailGrad.addColorStop(0, 'rgba(255, 107, 53, 0)');
      trailGrad.addColorStop(1, arr.isRoyal ? '#facc15' : theme.arrowGlow);
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = arr.isRoyal ? 5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();

      // Broadhead tip
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(3, -4);
      ctx.lineTo(3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 8. Render 2.5D Spartan Hoplites
    this.hoplites.forEach((h) => {
      const cfg = this.getPlayer(h.id);
      const color = cfg?.color ?? '#ef4444';
      const underdog = this.isUnderdog(h);
      const isSweetSpot = h.charge >= 0.72 && h.charge <= 0.98;

      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.staggerTimer > 0) {
        ctx.rotate(-0.28 * Math.sin(this.animTime * 28));
      }

      // Ground Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 22, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Surge Aura
      if (underdog) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -24, 34 + Math.sin(this.animTime * 10) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sweet-spot Phalanx Shockwave Arc on release
      if (h.sweetThrustAnim > 0) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${h.sweetThrustAnim})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(38, -22, 55 * (1.15 - h.sweetThrustAnim * 0.6), -0.8, 0.8);
        ctx.stroke();
      }

      // Crimson Spartan Cloak
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(-8, -32);
      ctx.lineTo(-24 - Math.abs(h.vx) * 0.03, -4);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();

      // 2.5D Mascot Avatar
      this.drawPlayerMascot(
        ctx,
        h.id,
        0,
        -22,
        20,
        h.staggerTimer > 0 ? 'shocked' : h.spearThrustAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Spartan Horsehair Helmet Crest on top of Mascot
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-11, -46, 22, 5);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -48, 13, Math.PI, 0);
      ctx.fill();

      // Dory Spear (extends dramatically on counter-thrust)
      const thrustReach = h.spearThrustAnim * (h.sweetThrustAnim > 0 ? 88 : 54);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(28 + thrustReach, -20);
      ctx.stroke();

      // Gleaming Leaf Spearhead
      ctx.fillStyle = h.sweetThrustAnim > 0 ? '#fef08a' : '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(28 + thrustReach, -26);
      ctx.lineTo(44 + thrustReach, -20);
      ctx.lineTo(28 + thrustReach, -14);
      ctx.closePath();
      ctx.fill();

      // Bronze Lambda (Λ) Aspis Shield
      const shieldX = h.shieldRaised ? 4 : -10;
      const shieldY = h.shieldRaised ? -34 : -18;
      ctx.save();
      ctx.translate(shieldX, shieldY);
      if (h.shieldRaised) ctx.rotate(-0.45);

      const shieldGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 19);
      shieldGrad.addColorStop(0, '#fde047');
      shieldGrad.addColorStop(0.65, '#d97706');
      shieldGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = shieldGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSweetSpot ? '#fef08a' : '#451a03';
      ctx.lineWidth = isSweetSpot ? 3.5 : 2.5;
      ctx.stroke();

      // Crimson Lambda (Λ) Emblem
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.lineTo(0, -8);
      ctx.lineTo(7, 7);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Sweet-Spot Gauge (72%–98%)
      if (h.charging && h.charge > 0.04) {
        const barW = 48;
        const barH = 7;
        const bx = -barW / 2;
        const by = -66;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
        // Sweet spot band (72%–98%)
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(bx + barW * 0.72, by, barW * 0.26, barH);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(bx, by, barW * h.charge, barH);
      }

      // Player Name & Combo Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cfg?.name ?? `P${h.id + 1}`, 0, 22);
      if (h.combo >= 2) {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${h.combo}x PHALANX`, 0, 35);
      }
      ctx.restore();
    });

    // 9. Floating Callouts
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

    // 10. Top Instruction Pill (respects y: 12-44 timer safe zone)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🛡️ STEER: MARCH PASS • HOLD ACTION: ASPIS BLOCK & RELEASE (72–98%) SPEAR COUNTER!',
      width / 2,
      74
    );

    // 11. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const h = this.hoplites.get(p.id);
      if (!h) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}`, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(h.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🛡️${h.arrowsBlocked} ⚔️${h.foesSlain}`, cardX + 150, cardY + 37);
    });

    // 12. Interactive Theme Switcher Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
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
    this.hoplites.forEach((h, pId) => scores.set(pId, Math.floor(h.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.hoplites.entries())
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
        ? `${winnerCfg.name} held the Hot Gates with ${rankings[0].score} pts!`
        : 'The Spartan Phalanx stood unbroken!',
    };
  }
}
